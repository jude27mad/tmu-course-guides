/* Storage access for the guides' saved state.

   The old site's keys and value formats are kept byte for byte (features-map §4). Every access is wrapped: when
   storage is missing, blocked (the getter or a call throws) or full (setItem throws QuotaExceededError), reads
   fall back to "nothing saved" and writes are kept in memory for this page view, so the interface still reflects
   what the person just did. A write reports whether it reached storage.

   No DOM or storage access happens at import. */

export const KEYS = {
  cen100: {
    ticks: 'cen100-g9-ticks',
    profile: 'cen100-contact-choice-v1',
    plan: 'cen100-personal-plan-v1',
    hideCompleted: 'cen100-hide-completed-v1',
    seen: 'cen100-last-seen-update-v1',
  },
  mth140: { progress: 'mth140-progress-v1', section: 'mth140-section-v1', view: 'mth140-view-v1', seen: 'mth140-last-seen-update-v1' },
  mth141: { progress: 'mth141-progress-v1', section: 'mth141-section-v1', view: 'mth141-view-v1', seen: 'mth141-last-seen-update-v1' },
  motion: 'guide-motion-paused',
  legacyMotion: 'guide-motion-level',
  theme: 'tmu-guide-theme-v1',
  sound: 'tmu-guide-sound-v1',
};

const COURSE_OF_KEY = new Map();
for (const course of ['cen100', 'mth140', 'mth141']) for (const key of Object.values(KEYS[course])) COURSE_OF_KEY.set(key, course);
/** The course a storage key belongs to, or null (motion, theme, unknown keys). */
export const courseOfKey = (key) => COURSE_OF_KEY.get(key) ?? null;
export const KNOWN_KEYS = new Set([...COURSE_OF_KEY.keys(), KEYS.motion]);

/** The browser's localStorage, or null when it is missing or its getter throws (blocked cookies, sandboxed frames). */
export function defaultStorage() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}
/** `undefined` means "the browser's storage"; `null` means "no storage" (server render, tests). */
export const resolveStorage = (storage) => (storage === undefined ? defaultStorage() : storage);

// Values written while storage refused them, per storage object, so the page keeps showing what was done.
const memories = new WeakMap();
const nullMemory = new Map();
function memoryFor(storage) {
  if (!storage || (typeof storage !== 'object' && typeof storage !== 'function')) return nullMemory;
  let memory = memories.get(storage);
  if (!memory) {
    memory = new Map();
    memories.set(storage, memory);
  }
  return memory;
}

/** The raw string stored under `key`, or null. Never throws. */
export function readRaw(storage, key) {
  const memory = memoryFor(storage);
  if (memory.has(key)) return memory.get(key);
  try {
    return storage ? storage.getItem(key) ?? null : null;
  } catch {
    return null;
  }
}
/** JSON value under `key` as the old pages read it: JSON.parse(raw) ?? fallback, and the fallback on any error. */
export function readJSON(storage, key, fallback) {
  try {
    return JSON.parse(readRaw(storage, key)) ?? fallback;
  } catch {
    return fallback;
  }
}

// Same-page change notifications (the browser only sends `storage` events to other tabs).
const listeners = new Set();
export function onLocalChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
function emit(storage, key) {
  for (const listener of [...listeners]) {
    try {
      listener({ storage, key });
    } catch {
      // A failing subscriber must not stop the others.
    }
  }
}

/** Write a raw string (or remove the key when `value` is null). Returns true when storage accepted it. */
export function writeRaw(storage, key, value) {
  const memory = memoryFor(storage);
  let saved = false;
  try {
    if (!storage) throw new Error('No storage');
    if (value === null) storage.removeItem(key);
    else storage.setItem(key, value);
    memory.delete(key);
    saved = true;
  } catch {
    memory.set(key, value);
  }
  emit(storage, key);
  return saved;
}
export const writeJSON = (storage, key, value) => writeRaw(storage, key, JSON.stringify(value));

/** Drop the in-memory copy of a key (another tab wrote a newer value). `key` null drops all. */
export function forget(storage, key) {
  const memory = memoryFor(storage);
  if (key === null || key === undefined) memory.clear();
  else memory.delete(key);
}

/** A read-only Storage view for the vendored readers, which see the in-memory writes too. */
export const view = (storage) => ({ getItem: (key) => readRaw(storage, key) });

/**
 * Listen for changes to the guides' keys: writes from this page (any createProgress/setSection/... call) and
 * `storage` events from other tabs. `target` defaults to `window`. Returns an unsubscribe function.
 * The callback receives { key, courseId, source: 'local' | 'storage' }; key null means "everything" (storage cleared).
 */
export function subscribeKeys(storage, callback, target) {
  const events = target === undefined ? (typeof window !== 'undefined' ? window : null) : target;
  const offLocal = onLocalChange((detail) => {
    if (detail.storage !== storage) return;
    callback({ key: detail.key, courseId: courseOfKey(detail.key), source: 'local' });
  });
  const onStorage = (event) => {
    const key = event.key ?? null;
    if (key !== null && !KNOWN_KEYS.has(key)) return;
    if (storage && event.storageArea && event.storageArea !== storage) return;
    forget(storage, key);
    callback({ key, courseId: key === null ? null : courseOfKey(key), source: 'storage' });
  };
  events?.addEventListener?.('storage', onStorage);
  return () => {
    offLocal();
    events?.removeEventListener?.('storage', onStorage);
  };
}
