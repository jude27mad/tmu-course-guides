/* Shared test helpers: fake storages, the old site's modules (imported from the repo's assets/ folder through
   file URLs) and "oracles" — the old guide pages' own closure functions, evaluated from their source text so the
   new modules are compared with the code that actually ran on the old site. */
import { readFileSync } from 'node:fs';

export const OLD = new URL('../../assets/', import.meta.url);
export const ROOT = new URL('../../', import.meta.url);
export const oldModule = (path) => import(new URL(path, OLD).href);

/** A Storage double that records every call. */
export function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  const calls = [];
  return {
    data,
    calls,
    getItem(key) {
      calls.push(['get', key]);
      return data.has(key) ? data.get(key) : null;
    },
    setItem(key, value) {
      calls.push(['set', key, String(value)]);
      data.set(key, String(value));
    },
    removeItem(key) {
      calls.push(['remove', key]);
      data.delete(key);
    },
    clear() {
      data.clear();
    },
    key(index) {
      return [...data.keys()][index] ?? null;
    },
    get length() {
      return data.size;
    },
    writes() {
      return calls.filter(([kind]) => kind !== 'get');
    },
  };
}
/** Every method throws, as with blocked site data. */
export function deniedStorage() {
  const fail = () => {
    throw new Error('SecurityError: The operation is insecure.');
  };
  return { getItem: fail, setItem: fail, removeItem: fail, clear: fail, key: fail, length: 0 };
}
/** Reads work, writes throw QuotaExceededError. */
export function fullStorage(initial = {}) {
  const storage = memoryStorage(initial);
  storage.setItem = (key) => {
    storage.calls.push(['refused', key]);
    const error = new Error('The quota has been exceeded.');
    error.name = 'QuotaExceededError';
    throw error;
  };
  storage.removeItem = storage.setItem;
  return storage;
}

/** A `storage` event as another tab's write delivers it. */
export function storageEvent(key, newValue = null, storageArea = null) {
  const event = new Event('storage');
  Object.defineProperties(event, { key: { value: key }, newValue: { value: newValue }, storageArea: { value: storageArea } });
  return event;
}

const source = (file) => readFileSync(new URL(file, OLD), 'utf8');
function slice(text, from, to) {
  const start = text.indexOf(from);
  const end = text.indexOf(to, start + from.length);
  if (start < 0 || end < 0) throw new Error(`Old source changed: cannot find ${from} … ${to}`);
  return text.slice(start, end);
}

/** The old CEN100 guide's closure (assets/cen-guide.mjs), evaluated from its source with the old SCHEDULE. */
export async function cenOracle() {
  const { SCHEDULE } = await oldModule('cen-schedule.mjs');
  const text = source('cen-guide.mjs');
  const code = [
    slice(text, 'const I={', 'const KEY="cen100-g9-ticks";'),
    slice(text, 'const D=s=>', 'const esc='),
    slice(text, 'const mon=s=>', 'const chip='),
    slice(text, 'const cd=n=>', 'all("[data-i]")'),
    slice(text, 'function torontoToday(', 'function dateMarkup('),
    slice(text, 'function upcomingSchedule(', 'function updateCircuitHead('),
    slice(text, 'const STAFFING=[', 'function setupContactLookup('),
    slice(text, '  const PROFILE_KEY=', '  const $=id=>get(id);'),
    slice(text, '  function validProfile(', '  function updatePickerAction('),
    slice(text, '  function calendarDay(', '  function downloadFile('),
    slice(text, '  function parseBackup(', '  function setupBackups('),
    slice(text, '  const PLAN_KEY=', '  let personal='),
    'let personal={completed:{},notes:{},targets:{}};const setPersonal=value=>{personal=value};',
    slice(text, '  const fullyRecorded=', '  let lastQuickCompletion='),
    slice(text, '  function workEntries(', '  function renderWork('),
    slice(text, '  function updateSectionContent(', '  function setupWorkAndUpdates('),
  ].join('\n');
  // updateSectionContent() writes into the page; a stub $ captures what it would show.
  const factory = new Function(
    'SCHEDULE',
    'captured',
    `const $=id=>({querySelector:sel=>{const key=id+' '+sel;return {set textContent(v){captured[key]=v}}}});const refreshDateDisplays=()=>{};
${code}
return {I,WHO,TEAM,YOU,RULES,CONFIRMED,OPEN,STAFFING,SOURCE_INFO,sourceFor,PROFILE_KEY,FILTER_KEY,PLAN_KEY,SEEN_KEY,GUIDE_VERSION,allItems,byId,CALENDAR_DATES,
  D,mon,wk,cd,torontoToday,torontoTimestamp,torontoUTC,eventPassed,sortEvents,itemDeadlines,clockLabel,eventLabel,itemTiming,upcomingSchedule,headUrgency,
  validProfile,calendarDay,shiftDay,icsEscape,foldLine,buildCalendar,parseBackup,recordsFor,completionKeys,validDate,cleanPlan,setPersonal,fullyRecorded,
  completionVerb,completionText,completionSummary,workEntries,updateSectionContent};`,
  );
  const captured = {};
  const oracle = factory(SCHEDULE, captured);
  oracle.sectionContent = (profile) => {
    for (const key of Object.keys(captured)) delete captured[key];
    oracle.updateSectionContent(profile);
    return { ...captured };
  };
  return oracle;
}

/** The old math guide's closure (assets/math-guide.mjs) for one course, evaluated from its source. */
export async function mathOracle(courseId, section = 0) {
  const { COURSES } = await oldModule('course-data.mjs');
  const schedule = await oldModule('schedule.mjs');
  const text = source('math-guide.mjs');
  const code = [
    slice(text, "const GUIDE_VERSION='", "let section=Number("),
    slice(text, 'const knownChecks=', 'let progress=cleanProgress('),
    slice(text, 'function prep(', 'function drawFigure('),
    slice(text, 'function rulesForAssessment(', 'function renderAssessments('),
    `const cards=${slice(text, 'const cards=[', "  $('rule-cards')").slice('const cards='.length).trim().replace(/;$/, '')};`,
    `const notice=${slice(text, "$('course-notice').innerHTML=", "\n  $('textbook-list')").slice("$('course-notice').innerHTML=".length).trim().replace(/;$/, '')};`,
  ].join('\n');
  const factory = new Function(
    'COURSES',
    'schedule',
    'courseId',
    'section',
    `const {DAY_NAMES,today,daysUntil,dateLabel,clock,resolveAssessment,assessmentPassed,upcoming,timing,calendar,addDays}=schedule;
const course=COURSES[courseId];
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
${code}
return {course,GUIDE_VERSION,seenKey,knownChecks,knownTopics,cleanProgress,validDate,prep,weight,labSummary,certainty,dateTile,currentEvent,countdown,rulesForAssessment,cards,notice};`,
  );
  return factory(COURSES, schedule, courseId, section);
}

/** Text of an HTML fragment (tags dropped, entities decoded, whitespace collapsed). */
export const htmlText = (html) =>
  String(html)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
/** Text of structured blocks ({type, text|items}). */
export const blocksText = (blocks) =>
  blocks
    .map((block) => (block.items ? block.items.join(' ') : block.text))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Toronto wall-clock time → epoch ms (the old schedule.mjs timestamp). */
export const toronto = (date, time) => {
  const [y, m, d] = date.split('-').map(Number);
  const [h, min] = time.split(':').map(Number);
  const target = Date.UTC(y, m - 1, d, h, min);
  let value = target;
  const format = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
  for (let i = 0; i < 2; i += 1) {
    const p = Object.fromEntries(format.formatToParts(new Date(value)).map((x) => [x.type, x.value]));
    value += target - Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  }
  return value;
};

/** Clocks across the term: every 23 h 17 min from Sep 7 to Dec 23, plus ±1 ms around every CEN and math boundary. */
export async function termClocks() {
  const { SCHEDULE } = await oldModule('cen-schedule.mjs');
  const { COURSES } = await oldModule('course-data.mjs');
  const clocks = [];
  for (let t = toronto('2026-09-07', '00:00'); t < toronto('2026-12-23', '00:00'); t += 23 * 3600e3 + 17 * 60e3) clocks.push(t);
  for (const e of SCHEDULE) {
    const edge = e.time ? toronto(e.date, e.time) : toronto(e.date, '00:00') + 86400e3;
    clocks.push(edge - 1, edge, edge + 1);
  }
  for (const course of Object.values(COURSES)) {
    for (const a of course.assessments) {
      if (a.date && a.time) for (const edge of [toronto(a.date, a.time), toronto(a.date, a.end || a.time), toronto(a.date, a.end || a.time) + 2 * 3600e3]) clocks.push(edge - 1, edge, edge + 1);
      if (a.week) clocks.push(toronto(a.week, '00:00'), toronto(a.week, '00:00') + 5 * 86400e3 - 1, toronto(a.week, '00:00') + 5 * 86400e3);
    }
  }
  return clocks;
}

/** Run old-module code with Intl.DateTimeFormat construction cached (the old tests/targets.test.mjs did the same
    for its 1500-clock sweep: formatters are stateless). Results are not memoised, so the old code still computes
    every value itself; this only keeps the sweeps fast. */
const NativeDTF = Intl.DateTimeFormat;
const dtfCache = new Map();
function CachedDTF(locales, options) {
  const key = JSON.stringify([locales, options]);
  if (!dtfCache.has(key)) dtfCache.set(key, new NativeDTF(locales, options));
  return dtfCache.get(key);
}
export function oldCall(fn) {
  const saved = Intl.DateTimeFormat;
  Intl.DateTimeFormat = CachedDTF;
  try {
    return fn();
  } finally {
    Intl.DateTimeFormat = saved;
  }
}
