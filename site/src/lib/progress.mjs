/* createProgress(): completion records ("Mark done", Undo, completion checkboxes), checklist ticks, notes and
   target dates, reading and writing the old keys in the old formats.

   Ticks and completion records stay separate, as on the old site: a tick never marks anything done and Mark
   done never ticks anything. Every call re-reads storage, so another tab's changes are never overwritten. */
import { COURSES as DATA } from './vendor/course-data.mjs';
import { SCHEDULE } from './vendor/cen-schedule.mjs';
import * as CEN from './content/cen.mjs';
import * as MATH from './content/math.mjs';
import { KEYS, resolveStorage, subscribeKeys } from './storage.mjs';
import { isMath, readTicks, writeTicks, readPlan, writePlan, readMath, writeMath } from './saved.mjs';

const MATH_CHECKS = {};
const MATH_TOPICS = {};
for (const id of ['mth140', 'mth141']) {
  MATH_CHECKS[id] = new Set(DATA[id].assessments.flatMap((a) => MATH.checkKeys(a, id)));
  MATH_TOPICS[id] = new Set(DATA[id].topics.flatMap(MATH.topicKeys));
}
const completionKey = (courseId) => (courseId === 'cen100' ? KEYS.cen100.plan : KEYS[courseId]?.progress);
const validCompletion = (courseId, itemId) => (courseId === 'cen100' ? CEN.completionKeys.has(itemId) : isMath(courseId) && DATA[courseId].assessments.some((a) => a.id === itemId));

/** The old confirmation sentence for a completion ("Marked done: … Saved on this device."). */
function doneMessage(courseId, itemId, saved) {
  if (courseId === 'cen100') {
    const event = SCHEDULE.find((row) => row.id === itemId) || { title: CEN.byId.get(String(itemId).replace(/^item:/, ''))?.name || itemId };
    return CEN.COPY.markedDone(event, saved);
  }
  return MATH.COPY.markedDone(DATA[courseId].assessments.find((a) => a.id === itemId), saved);
}
/** Which math map a step belongs to: an assessment's preparation checks or a topic's skill checks. */
function mathMap(courseId, itemId, stepId) {
  if (MATH_CHECKS[courseId].has(stepId) && (!itemId || stepId.startsWith(`${itemId}-`))) return 'checks';
  if (MATH_TOPICS[courseId].has(stepId) && (!itemId || stepId.startsWith(`${itemId}-`))) return 'topics';
  return null;
}
/** A step id may be the full key ("m2-1-3", "quiz-1-0") or its index part ("1-3", "0") under an item id. */
function stepKey(courseId, itemId, stepId) {
  const id = String(stepId);
  if (courseId === 'cen100' ? CEN.TICK_KEYS.has(id) : isMath(courseId) && (MATH_CHECKS[courseId].has(id) || MATH_TOPICS[courseId].has(id))) return id;
  if (!itemId) return id;
  const base = courseId === 'cen100' ? SCHEDULE.find((row) => row.id === itemId)?.item || String(itemId).replace(/^item:/, '') : String(itemId).replace(/^assessment-|^topic-/, '');
  return `${base}-${id}`;
}
const bareItem = (itemId) => (itemId ? String(itemId).replace(/^assessment-|^topic-/, '') : itemId);

/**
 * createProgress(storage?, { events? }) → the progress API for one storage (default: the browser's localStorage;
 * pass null for none). `events` is the EventTarget that receives cross-tab `storage` events (default: window).
 */
export function createProgress(storage, { events } = {}) {
  const store = resolveStorage(storage);
  let pending = null; // the last Mark done that Undo can revert: { courseId, itemId }

  function writeCompletion(courseId, itemId, done) {
    if (courseId === 'cen100') {
      const plan = readPlan(store);
      if (done) plan.completed[itemId] = 1;
      else delete plan.completed[itemId];
      return writePlan(store, plan);
    }
    const progress = readMath(courseId, store);
    if (done) progress.completed[itemId] = true;
    else delete progress.completed[itemId];
    return writeMath(courseId, store, progress);
  }

  const api = {
    storage: store,
    /** Whether a completion record is saved ("Submitted", "I completed this assessment", Mark done). */
    isDone(courseId, itemId) {
      if (!validCompletion(courseId, itemId)) return false;
      const completed = courseId === 'cen100' ? readPlan(store).completed : readMath(courseId, store).completed;
      return !!completed[itemId];
    },
    /**
     * Mark a deadline done (the old next-card button). No-op when it is already done or unknown.
     * Returns { changed, saved, message }; `saved` false means storage refused the write (kept for this page view).
     */
    markDone(courseId, itemId) {
      if (!validCompletion(courseId, itemId) || api.isDone(courseId, itemId)) return { changed: false, saved: validCompletion(courseId, itemId), message: '' };
      const saved = writeCompletion(courseId, itemId, true);
      pending = { courseId, itemId };
      return { changed: true, saved, message: doneMessage(courseId, itemId, saved) };
    },
    /** Revert the last markDone() if nothing changed it since. Returns { courseId, itemId, saved } or null. */
    undo() {
      if (!pending) return null;
      const { courseId, itemId } = pending;
      pending = null;
      const saved = writeCompletion(courseId, itemId, false);
      return { courseId, itemId, saved };
    },
    canUndo: () => !!pending,
    pendingUndo: () => (pending ? { ...pending } : null),
    /** Set a completion record directly (the "My plan & completion" checkboxes). Clears a pending Undo. */
    setDone(courseId, itemId, done) {
      if (!validCompletion(courseId, itemId)) return { changed: false, saved: false, message: '' };
      pending = null;
      const was = api.isDone(courseId, itemId);
      const saved = writeCompletion(courseId, itemId, !!done);
      return { changed: was !== !!done, saved, message: done && !was ? doneMessage(courseId, itemId, saved) : '' };
    },
    /** Whether a checklist step is ticked. CEN: cen100-g9-ticks; math: preparation `checks` or topic `topics`. */
    isTicked(courseId, itemId, stepId) {
      const key = stepKey(courseId, itemId, stepId);
      if (courseId === 'cen100') return CEN.TICK_KEYS.has(key) && !!readTicks(store)[key];
      if (!isMath(courseId)) return false;
      const map = mathMap(courseId, bareItem(itemId), key);
      return !!map && !!readMath(courseId, store)[map][key];
    },
    /** Toggle (or set, with `value`) a checklist step. Returns { checked, saved }. Never touches completion records. */
    toggleTick(courseId, itemId, stepId, value) {
      const key = stepKey(courseId, itemId, stepId);
      if (courseId === 'cen100') {
        if (!CEN.TICK_KEYS.has(key)) return { checked: false, saved: false };
        const ticks = readTicks(store);
        const checked = value === undefined ? !ticks[key] : !!value;
        if (checked) ticks[key] = 1;
        else delete ticks[key];
        return { checked, saved: writeTicks(store, ticks) };
      }
      if (!isMath(courseId)) return { checked: false, saved: false };
      const map = mathMap(courseId, bareItem(itemId), key);
      if (!map) return { checked: false, saved: false };
      const progress = readMath(courseId, store);
      const checked = value === undefined ? !progress[map][key] : !!value;
      if (checked) progress[map][key] = true;
      else delete progress[map][key];
      return { checked, saved: writeMath(courseId, store, progress) };
    },
    /** Ticked steps of an item: { checked, total } (CEN item id such as "m2", or a math assessment/topic id). */
    tickCount(courseId, itemId) {
      if (courseId === 'cen100') {
        const item = CEN.byId.get(String(itemId).replace(/^item:/, '')) || CEN.byId.get(SCHEDULE.find((row) => row.id === itemId)?.item);
        if (!item) return { checked: 0, total: 0 };
        const ticks = readTicks(store);
        const keys = CEN.checkKeys(item);
        return { checked: keys.filter((key) => ticks[key]).length, total: keys.length };
      }
      if (!isMath(courseId)) return { checked: 0, total: 0 };
      const progress = readMath(courseId, store);
      const assessment = DATA[courseId].assessments.find((a) => a.id === itemId);
      const topic = DATA[courseId].topics.find((t) => t.id === itemId);
      const keys = assessment ? MATH.checkKeys(assessment, courseId) : topic ? MATH.topicKeys(topic) : [];
      const map = assessment ? progress.checks : progress.topics;
      return { checked: keys.filter((key) => map[key]).length, total: keys.length };
    },
    /** "Clear my ticks" (CEN100): writes {} after the page's own confirmation. Completion records, notes and targets stay. */
    clearTicks: () => writeTicks(store, {}),
    /** Personal notes (CEN: per item such as "m2"; math: per assessment). '' when none. */
    getNote(courseId, itemId) {
      if (courseId === 'cen100') return readPlan(store).notes[itemId] || '';
      return isMath(courseId) ? readMath(courseId, store).notes[itemId] || '' : '';
    },
    /** Save a note as the old page did (CEN deletes an empty note; math keeps it and cuts at 2000 characters). */
    setNote(courseId, itemId, text) {
      const value = String(text ?? '');
      if (courseId === 'cen100') {
        if (!CEN.byId.has(itemId) || value.length > 2000) return false;
        const plan = readPlan(store);
        if (value) plan.notes[itemId] = value;
        else delete plan.notes[itemId];
        return writePlan(store, plan);
      }
      if (!isMath(courseId) || !DATA[courseId].assessments.some((a) => a.id === itemId)) return false;
      const progress = readMath(courseId, store);
      progress.notes[itemId] = value.slice(0, 2000);
      return writeMath(courseId, store, progress);
    },
    /** Personal target date ("YYYY-MM-DD") or ''. It never changes an official deadline. */
    getTarget(courseId, itemId) {
      if (courseId === 'cen100') return readPlan(store).targets[itemId] || '';
      return isMath(courseId) ? readMath(courseId, store).targets[itemId] || '' : '';
    },
    setTarget(courseId, itemId, date) {
      const value = String(date ?? '');
      if (courseId === 'cen100') {
        if (!CEN.byId.has(itemId) || (value && !CEN.validDate(value))) return false;
        const plan = readPlan(store);
        if (value) plan.targets[itemId] = value;
        else delete plan.targets[itemId];
        return writePlan(store, plan);
      }
      if (!isMath(courseId) || !DATA[courseId].assessments.some((a) => a.id === itemId)) return false;
      const progress = readMath(courseId, store);
      if (value && MATH.validDate(value)) progress.targets[itemId] = value;
      else delete progress.targets[itemId];
      return writeMath(courseId, store, progress);
    },
    /**
     * Call `callback({ key, courseId, source })` after any change to the guides' keys, from this page or (via
     * `storage` events) another tab. A change to a course's completion record from another tab cancels a pending
     * Undo for it, as on the old pages. Returns an unsubscribe function.
     */
    subscribe(callback) {
      return subscribeKeys(
        store,
        (detail) => {
          if (detail.source === 'storage' && pending && (detail.key === null || detail.key === completionKey(pending.courseId))) pending = null;
          callback(detail);
        },
        events,
      );
    },
  };
  return api;
}

let shared = null;
/** One shared instance for the browser's storage, so Mark done and Undo work across components. */
export function sharedProgress() {
  if (!shared || shared.storage !== resolveStorage(undefined)) shared = createProgress();
  return shared;
}
