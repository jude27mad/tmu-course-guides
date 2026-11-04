/* Guide tools: calendar files, progress backups, "What's changed?" and the CEN hide filter, in the old formats.
   These build file contents only; the page offers the download (Blob + <a download>) and the file picker. */
import { fast } from './perf.mjs';
import { COURSES as DATA } from './vendor/course-data.mjs';
import { today, calendar } from './vendor/schedule.mjs';
import * as CEN from './content/cen.mjs';
import * as MATH from './content/math.mjs';
import { KEYS, resolveStorage, readJSON, writeJSON } from './storage.mjs';
import { COURSE_UPDATES } from './content/updates.mjs';
import { isMath, readTicks, writeTicks, readPlan, writePlan, readMath, writeMath, readMathSection, readMotionPaused, writeMotionPaused } from './saved.mjs';

const toDate = (now) => (now == null ? new Date() : new Date(+now));
const stampOf = (date) => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

/**
 * An .ics file. CEN100: { item: 'all' | item id, upcomingOnly = true, reminderDays = 1 } (cen100-deadlines-2026.ics,
 * UIDs cen100-f26-<id>-jude27mad-github-io). Math: { includeTentative = false, upcomingOnly = true, section }
 * (<course>-fall-2026.ics). Returns { ok, name, type, text, count, message }; ok false carries the old message.
 */
function calendarFileNow(courseId, { now, item = 'all', upcomingOnly = true, reminderDays = 1, includeTentative = false, section, storage } = {}) {
  const date = toDate(now);
  if (courseId === 'cen100') {
    const events = CEN.calendarEvents(item, upcomingOnly, date);
    if (!events.length) return { ok: false, count: 0, message: CEN.COPY.calendarNoUpcoming };
    return {
      ok: true,
      name: `cen100-${item === 'all' ? 'deadlines' : item}-2026.ics`,
      type: 'text/calendar;charset=utf-8',
      text: CEN.buildCalendar(events, Number(reminderDays), stampOf(date)),
      count: events.length,
      message: CEN.COPY.calendarReady(events.length),
    };
  }
  if (!isMath(courseId)) return { ok: false, count: 0, message: '' };
  const chosen = section === undefined ? readMathSection(courseId, resolveStorage(storage)) : Number(section) || 0;
  if (includeTentative && !chosen) return { ok: false, count: 0, message: MATH.COPY.calendarNeedsSection };
  const result = calendar(DATA[courseId], chosen, { includeTentative, onlyUpcoming: upcomingOnly, now: date });
  if (!result.count) {
    // Without a section only fixed-time assessments can be exported; once those have passed, a section's lab
    // quizzes are what is left, so say so instead of "those choices" (Guide tools offers none).
    const quizzesLeft = !chosen && calendar(DATA[courseId], DATA[courseId].labs[0].section, { includeTentative: true, onlyUpcoming: upcomingOnly, now: date }).count > 0;
    return { ok: false, count: 0, message: quizzesLeft ? MATH.COPY.calendarNeedsSection : MATH.COPY.calendarNone };
  }
  return { ok: true, name: `${courseId}-fall-2026.ics`, type: 'text/calendar;charset=utf-8', text: result.text, count: result.count, message: MATH.COPY.calendarReady(result.count) };
}

/** The progress backup file, exactly as the old Export button wrote it. Returns { name, type, text, message }. */
function exportBackupNow(courseId, { now, storage } = {}) {
  const store = resolveStorage(storage);
  const date = toDate(now);
  if (courseId === 'cen100') {
    const ticks = readTicks(store);
    // The old page exported the checked boxes in card order.
    const checked = Object.fromEntries(CEN.allItems.flatMap(CEN.checkKeys).filter((key) => ticks[key]).map((key) => [key, 1]));
    const data = { format: 'cen100-guide-backup', version: 2, exportedAt: date.toISOString(), ticks: checked, personal: readPlan(store) };
    return { name: `cen100-progress-${today(date)}.json`, type: 'application/json', text: `${JSON.stringify(data, null, 2)}\n`, message: CEN.COPY.backupReady };
  }
  if (!isMath(courseId)) return null;
  const text = JSON.stringify({ format: 'tmu-math-guide', version: 1, course: courseId, exported: date.toISOString(), progress: readMath(courseId, store) }, null, 2);
  return { name: `${courseId}-progress.json`, type: 'application/json', text, message: MATH.COPY.backupExported };
}

/**
 * Merge a backup file's text into saved progress, with the old rules: ticks and completions are added, empty
 * notes/targets are filled, conflicting ones are kept as they are. Returns { ok, saved, message }.
 */
export function importBackup(courseId, raw, { storage } = {}) {
  const store = resolveStorage(storage);
  if (courseId === 'cen100') {
    try {
      const { checked, skipped, plan } = CEN.parseBackup(raw);
      const ticks = readTicks(store);
      const personal = readPlan(store);
      let added = 0;
      let records = 0;
      let filled = 0;
      let kept = 0;
      for (const key of CEN.allItems.flatMap(CEN.checkKeys)) {
        if (checked[key]) {
          if (!ticks[key]) added += 1;
          ticks[key] = 1;
        }
      }
      for (const key of Object.keys(plan.completed)) {
        if (!personal.completed[key]) {
          personal.completed[key] = 1;
          records += 1;
        }
      }
      for (const field of ['notes', 'targets']) {
        for (const [id, value] of Object.entries(plan[field])) {
          if (!personal[field][id]) {
            personal[field][id] = value;
            filled += 1;
          } else if (personal[field][id] !== value) kept += 1;
        }
      }
      const savedTicks = writeTicks(store, ticks);
      const savedPlan = writePlan(store, personal);
      return { ok: true, saved: savedTicks && savedPlan, message: CEN.COPY.backupImported({ added, records, filled, kept, skipped }) };
    } catch (error) {
      return { ok: false, saved: false, message: error.message };
    }
  }
  if (!isMath(courseId)) return { ok: false, saved: false, message: '' };
  try {
    if (typeof raw !== 'string' || raw.length > 300000) throw new Error(MATH.COPY.backupTooLarge);
    // An empty, truncated or non-JSON file, or one holding JSON null, is a wrong file too: the same answer as
    // CEN100's, not the parser's wording or a TypeError.
    let data = null;
    try {
      data = JSON.parse(raw);
    } catch {
      // stays null
    }
    if (!data || typeof data !== 'object' || data.format !== 'tmu-math-guide' || data.version !== 1 || data.course !== courseId || !data.progress || typeof data.progress !== 'object') throw new Error(MATH.COPY.backupInvalid(DATA[courseId].code));
    const imported = MATH.cleanProgress(data.progress, DATA[courseId], courseId);
    const progress = readMath(courseId, store);
    let conflicts = 0;
    for (const key of ['checks', 'completed', 'topics']) Object.assign(progress[key], imported[key]);
    for (const key of ['notes', 'targets']) {
      for (const [id, value] of Object.entries(imported[key])) {
        if (!progress[key][id]) progress[key][id] = value;
        else if (progress[key][id] !== value) conflicts += 1;
      }
    }
    return { ok: true, saved: writeMath(courseId, store, progress), message: MATH.COPY.backupImported(conflicts) };
  } catch (error) {
    return { ok: false, saved: false, message: error.message };
  }
}

// "Course updates": the saved value is the id of the newest entry the student has opened (a JSON string, as
// before). Every id ever saved starts with an ISO date, including the old releases' ('2026-10-16-course-artwork'),
// so a saved value dated after the newest course entry also counts as seen.
const latestUpdate = (courseId) => COURSE_UPDATES[courseId]?.[0]?.id || '';
const savedDate = (value) => (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : '');
const seenLatest = (saved, latest) => saved === latest || savedDate(saved) > latest.slice(0, 10);
/** True while the course has a course update the student has not opened (show the "New updates" badge). */
export const hasUnseenUpdates = (courseId, storage) => {
  const latest = latestUpdate(courseId);
  return !!latest && !seenLatest(readJSON(resolveStorage(storage), KEYS[courseId].seen, ''), latest);
};
/** Record that the course updates were opened: saves the newest entry's id, never an older value than the saved one. */
export const markUpdatesSeen = (courseId, storage) => {
  const latest = latestUpdate(courseId);
  if (!latest) return false;
  const target = resolveStorage(storage);
  if (seenLatest(readJSON(target, KEYS[courseId].seen, ''), latest)) return true;
  return writeJSON(target, KEYS[courseId].seen, latest);
};

/** CEN100 "Hide fully checked items" (JSON boolean). */
export const getHideCompleted = (storage) => readJSON(resolveStorage(storage), KEYS.cen100.hideCompleted, false) === true;
export const setHideCompleted = (value, storage) => writeJSON(resolveStorage(storage), KEYS.cen100.hideCompleted, !!value);

/** The saved "Pause motion" choice (guide-motion-paused, raw "true" / "false"). The device's reduced-motion setting is separate. */
export const motionPaused = (storage) => readMotionPaused(resolveStorage(storage));
/** Save "Pause motion" (writes "true" / "false"). Returns true when storage accepted it. */
export const setMotionPaused = (value, storage) => writeMotionPaused(resolveStorage(storage), value);

// Public entry points run with cached Toronto-time formatting (see perf.mjs).
export const calendarFile = fast(calendarFileNow);
export const exportBackup = fast(exportBackupNow);
