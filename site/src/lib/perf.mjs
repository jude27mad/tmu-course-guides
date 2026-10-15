/* fast(fn): run a lib call with Toronto-time formatting cached.

   The vendored date code (schedule.mjs, targets.mjs, weeks.mjs) builds a new Intl.DateTimeFormat, or calls
   Date#toLocaleDateString, on every date it touches. Each costs 50–100 µs, and a Desk snapshot touches dates
   thousands of times (≈180 ms per call on a laptop, worse on a phone). The vendored files must stay byte-identical
   to the old site's, so instead, for the duration of one synchronous lib call only, `Intl.DateTimeFormat` and
   `Date.prototype.toLocaleDateString` are swapped for versions that reuse formatters and remember results per
   instant. Formatters are immutable and deterministic, so results are identical (the parity tests compare every
   output with the old modules running natively). The originals are restored in `finally`, before any other code
   can run; if the globals cannot be replaced, the call simply runs uncached. */

const MAX_ENTRIES = 4000;
const formatters = new Map();
let depth = 0;
let NativeDateTimeFormat = null;
let nativeToLocaleDateString = null;

function remember(native) {
  const parts = new Map();
  const texts = new Map();
  return {
    format(date) {
      if (date === undefined) return native.format();
      const key = +date;
      let value = texts.get(key);
      if (value === undefined) {
        if (texts.size > MAX_ENTRIES) texts.clear();
        value = native.format(date);
        texts.set(key, value);
      }
      return value;
    },
    formatToParts(date) {
      if (date === undefined) return native.formatToParts();
      const key = +date;
      let value = parts.get(key);
      if (!value) {
        if (parts.size > MAX_ENTRIES) parts.clear();
        value = native.formatToParts(date);
        parts.set(key, value);
      }
      return value.map((part) => ({ ...part }));
    },
    resolvedOptions: () => native.resolvedOptions(),
  };
}
function formatter(locales, options) {
  const key = JSON.stringify([locales ?? null, options ?? null]);
  let value = formatters.get(key);
  if (!value) {
    value = remember(new NativeDateTimeFormat(locales, options));
    formatters.set(key, value);
  }
  return value;
}
function CachedDateTimeFormat(locales, options) {
  return formatter(locales, options);
}
CachedDateTimeFormat.supportedLocalesOf = (...args) => NativeDateTimeFormat.supportedLocalesOf(...args);

const DATE_FIELDS = ['weekday', 'year', 'month', 'day'];
// Date#toLocaleDateString(locales, options) is DateTimeFormat(locales, ToDateTimeOptions(options, date, date)).format(date).
function cachedToLocaleDateString(locales, options) {
  if (options !== undefined && (options === null || typeof options !== 'object' || options.dateStyle !== undefined || options.timeStyle !== undefined)) {
    return nativeToLocaleDateString.call(this, locales, options);
  }
  if (Number.isNaN(this.getTime())) return 'Invalid Date';
  const withDefaults = options && DATE_FIELDS.some((field) => options[field] !== undefined) ? options : { ...(options || {}), year: 'numeric', month: 'numeric', day: 'numeric' };
  return formatter(locales, withDefaults).format(this);
}

function swap(format, toLocale) {
  Intl.DateTimeFormat = format;
  Date.prototype.toLocaleDateString = toLocale; // eslint-disable-line no-extend-native
}
function restore(format, toLocale) {
  try {
    swap(format, toLocale);
  } catch {
    // Nothing was replaced.
  }
}

export function fast(fn) {
  return function cached(...args) {
    if (depth > 0 || typeof Intl === 'undefined') return fn.apply(this, args);
    const savedFormat = Intl.DateTimeFormat;
    const savedToLocale = Date.prototype.toLocaleDateString;
    try {
      NativeDateTimeFormat = savedFormat;
      nativeToLocaleDateString = savedToLocale;
      swap(CachedDateTimeFormat, cachedToLocaleDateString);
    } catch {
      restore(savedFormat, savedToLocale);
      return fn.apply(this, args);
    }
    depth += 1;
    try {
      return fn.apply(this, args);
    } finally {
      depth -= 1;
      restore(savedFormat, savedToLocale);
    }
  };
}
