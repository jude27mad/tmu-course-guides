/* Deadlines, countdowns, the weekly checklist, assessments and the Desk snapshot.

   Every rule comes from the vendored modules (targets.mjs + schedule.mjs: Toronto time, the end-of-day rule,
   precision levels, grace, the overall winner); this file only shapes their results for the pages.
   Every time-dependent function takes `now` (a Date or epoch ms; omitted = the current time). */
import { fast } from './perf.mjs';
import { COURSES as DATA } from './vendor/course-data.mjs';
import { SCHEDULE } from './vendor/cen-schedule.mjs';
import { today, addDays, dateLabel, dayLabel, timestamp, resolveAssessment, assessmentPassed, timing } from './vendor/schedule.mjs';
import { resolveTarget, overall, parts, compact, status, targetDate, sentence } from './vendor/night/targets.mjs';
import { recordsForCourse, termWeek, semesterWeeks } from './vendor/book/weeks.mjs';
import { deskSummary } from './vendor/desk/desk-data.mjs';
import { weekCopy } from './vendor/night/palette.mjs';
import * as CEN from './content/cen.mjs';
import * as MATH from './content/math.mjs';
import { CEN as CEN_PAGE } from './content/pages.mjs';
import { resolveStorage, view } from './storage.mjs';
import { isMath, readProfile, readSectionNumber, readCompletedMap, readTicks, readMath, readPlan } from './saved.mjs';
import { COURSE_IDS, dataFor, getCourse } from './courses.mjs';

export const toMs = (now) => (now == null ? Date.now() : +now);
const short = (date) => `${dayLabel(date).slice(0, 3)} ${dateLabel(date)}`;
const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const mondayOf = (date) => addDays(date, -WEEKDAYS.indexOf(dayLabel(date)));

/* CEN100 weights per schedule row, from the old "All 20 graded items" table (cen100/index.html). A row that is one
   of several dates of a shared grade (both MATLAB assignments, notebook checkpoints, reflections, presentations)
   has no weight of its own: weeks.mjs's rule, never divide a combined grade. */
const CEN_GRADED = {
  intro: 'Personal Introduction',
  entry: 'Survey Questionnaire (entry)',
  syllabus: 'Course Syllabus Quiz',
  email: 'Professional Email Assignment',
  integrity: 'Academic Integrity Quiz',
  whmis: 'WHMIS Certification',
  exit: 'Exit Survey Questionnaire',
  'item:y7': 'D2L Quizzes / Lab Participation',
  contract: 'Team Contract + Task Outline (M1)',
  outline: 'Project Outline + User Research (M2)',
  failure: 'Failure Analysis Labs (M3)',
  review: 'Midterm Design Review (M4)',
  prototype: 'Low-Fidelity Prototype (M5)',
  report: 'Final Report (M7)',
  peer: 'Peer Evaluation (M8, individual)',
  'item:y9': 'Final Exam',
};
const CEN_SHARED = {
  'matlab-1': 'MATLAB Assignments (normally pairs)',
  'matlab-2': 'MATLAB Assignments (normally pairs)',
  'notebook-1': 'Team Design Notebooks (shared team)',
  'notebook-2': 'Team Design Notebooks (shared team)',
  'reflection-1': 'Personal Reflections (individual)',
  'reflection-2': 'Personal Reflections (individual)',
  'presentation-1': 'Final Project Presentations (M6)',
  'presentation-2': 'Final Project Presentations (M6)',
};
export const CEN_GRADE_TABLE = CEN_PAGE.grading.tables[1];
const GRADE = new Map(CEN_GRADE_TABLE.rows.map((row) => [row.label, parseFloat(row.weight)]));
export const CEN_GRADE_LABELS = { ...CEN_GRADED, ...CEN_SHARED };

function cenWeight(id) {
  if (CEN_GRADED[id]) {
    const weight = GRADE.get(CEN_GRADED[id]) ?? null;
    return { weight, weightLabel: weight == null ? '' : `${weight}%` };
  }
  if (CEN_SHARED[id]) return { weight: null, weightLabel: `${CEN_SHARED[id]} · ${GRADE.get(CEN_SHARED[id])}%` };
  return { weight: null, weightLabel: '' };
}

const normaliseSection = (courseId, value) => {
  const section = Number(value) || 0;
  if (courseId === 'cen100') return CEN.STAFFING.some((staff) => staff.sections.includes(section)) ? section : 0;
  return DATA[courseId]?.labs.some((lab) => lab.section === section) ? section : 0;
};

/** Everything a course computation needs, read once: the instant, the section and the completion records. */
export function context(courseId, { now, section, storage } = {}) {
  const store = resolveStorage(storage);
  const ms = toMs(now);
  const chosen = section === undefined ? readSectionNumber(courseId, store) : normaliseSection(courseId, section);
  let profile = null;
  if (courseId === 'cen100') {
    const saved = readProfile(store);
    profile = chosen ? { section: chosen, group: saved?.section === chosen ? saved.group : null } : null;
  }
  return { courseId, store, ms, date: new Date(ms), section: chosen, profile, completed: readCompletedMap(courseId, store) };
}

/** Split a resolver `when` ("Wed Oct 14 · 3:00 PM Toronto") into its date and time parts. */
const splitWhen = (when) => {
  const [first, ...rest] = String(when).split(' · ');
  return [first, rest.join(' · ')];
};

/** The order deadlines are listed in: the instant they are due, a date-only item at 23:59 Toronto of its day, a
    quiz week at its Monday, pending last (targets.mjs dueKey without the grace rule). */
function sortKey(t) {
  if (t.precision === 'exact') return t.endOfDay ? t.at - 60e3 : t.at;
  if (t.precision === 'day') return timestamp(t.date, '23:59');
  if (t.precision === 'week' && t.week) return timestamp(t.week, '00:00');
  return Infinity;
}

const cenKinds = (ctx) => new Map(recordsForCourse('cen100', { cenSchedule: SCHEDULE, section: ctx.section, completed: ctx.completed }).map((record) => [record.id, record.kind]));
// cenUpcoming(): a calendar:false reminder retires once every dated row of its item is recorded.
const retired = (row, completed) => {
  const own = SCHEDULE.filter((record) => record.item === row.item && record.calendar !== false);
  return own.length > 0 && own.every((record) => completed[record.id]);
};

function cenItem(row, ctx, kinds = cenKinds(ctx)) {
  const t = resolveTarget({ course: 'cen100', data: SCHEDULE, section: ctx.section, completed: ctx.completed, now: ctx.ms, id: row.id });
  const item = CEN.byId.get(row.item);
  const reminder = row.calendar === false;
  const passed = row.time ? timestamp(row.date, row.time) < ctx.ms : row.date < today(ctx.date);
  const done = reminder ? retired(row, ctx.completed) : !!ctx.completed[row.id];
  const [date, time] = splitWhen(t.when);
  return {
    id: row.id,
    courseId: 'cen100',
    title: t.title,
    fullTitle: row.title,
    kind: reminder ? 'reminder' : kinds.get(row.id) || 'minor',
    ...cenWeight(row.id),
    due: t.precision === 'exact' ? new Date(t.at) : null,
    precision: t.precision,
    date: targetDate(t),
    week: null,
    termWeek: termWeek(row.date),
    dateLabel: date,
    timeLabel: time || 'Time not posted',
    when: t.when,
    label: t.label,
    cta: null,
    requirement: item.requirements?.[row.id] || item.preview,
    detail: row.note || item.what,
    who: CEN.WHO[row.who || item.who][1],
    item: item.id,
    itemName: item.name,
    anchor: `assignment-${item.id}`,
    href: `/cen100/#assignment-${item.id}`,
    markable: CEN.completionKeys.has(row.id),
    done,
    passed,
    overdue: passed && !done && !reminder,
    target: t,
    sortKey: sortKey(t),
  };
}

/* CEN items with no dated row (Tutorial attendance quizzes, Final exam) keep their own completion keys. */
function cenUndated(item, ctx) {
  const id = `item:${item.id}`;
  const done = !!ctx.completed[id];
  const attendance = item.id === 'y7';
  const t = { course: 'cen100', id, title: item.name, kind: attendance ? 'quiz' : 'final', open: item.id, precision: 'pending', when: 'Date pending', label: 'Awaiting the official schedule' };
  return {
    id,
    courseId: 'cen100',
    title: item.name,
    fullTitle: item.name,
    kind: attendance ? 'quiz' : 'final',
    ...cenWeight(id),
    due: null,
    precision: 'pending',
    date: null,
    week: null,
    termWeek: null,
    dateLabel: attendance ? item.small : 'Date pending',
    timeLabel: attendance ? CEN.sectionContent(ctx.profile).y7.fact : 'Check D2L',
    when: attendance ? item.small : 'Date pending',
    label: attendance ? CEN.COPY.workAttendance : 'Date pending · Check D2L',
    cta: null,
    requirement: item.preview,
    detail: attendance ? CEN.sectionContent(ctx.profile).y7.what : item.what,
    who: CEN.WHO[item.who][1],
    item: item.id,
    itemName: item.name,
    anchor: `assignment-${item.id}`,
    href: `/cen100/#assignment-${item.id}`,
    markable: true,
    done,
    passed: false,
    overdue: false,
    target: t,
    sortKey: Infinity,
  };
}

function mathItem(courseId, a, ctx) {
  const course = DATA[courseId];
  const t = resolveTarget({ course: courseId, data: course, section: ctx.section, completed: ctx.completed, now: ctx.ms, id: a.id });
  const e = resolveAssessment(course, a, ctx.section);
  const passed = assessmentPassed(e, ctx.date);
  const done = !!ctx.completed[a.id];
  const sentenceText = timing(e);
  const [, time] = splitWhen(sentenceText);
  let date = 'Date pending';
  if (t.precision === 'exact' || t.precision === 'day') date = short(e.date);
  else if (t.precision === 'week') date = t.holiday ? `Week of ${dateLabel(e.week)}` : t.range;
  const weight = a.kind === 'midterm' ? course.weights[1] : a.kind === 'final' ? course.weights[2] : null;
  return {
    id: a.id,
    courseId,
    title: a.title,
    fullTitle: a.title,
    kind: a.kind,
    weight,
    weightLabel: MATH.weight(a, course),
    due: t.precision === 'exact' ? new Date(t.at) : null,
    precision: t.precision,
    date: targetDate(t),
    week: e.week || null,
    termWeek: termWeek(e.date || e.week || '') ?? null,
    dateLabel: date,
    timeLabel: t.precision === 'pending' ? sentenceText : time,
    when: t.when,
    timing: sentenceText,
    label: t.label,
    cta: t.cta || null,
    requirement: a.scope,
    detail: MATH.dateNote(a, e, courseId) || t.note || MATH.nextNote(e),
    who: null,
    item: a.id,
    itemName: a.title,
    anchor: `assessment-${a.id}`,
    href: `/${courseId}/#assessment-${a.id}`,
    markable: true,
    done,
    passed,
    overdue: passed && !done,
    target: t,
    sortKey: sortKey(t),
  };
}

const byDue = (a, b) => a.sortKey - b.sortKey || (Number.isFinite(a.sortKey) ? a.id.localeCompare(b.id) : 0);

/**
 * Every deadline of a course, sorted by due time: CEN100 schedule rows (the Section 29 lab reminder only for
 * Section 29) plus its two undated items; MTH140/MTH141 assessments. `section` overrides the saved section.
 */
function deadlinesNow(courseId, { now, section, storage } = {}) {
  if (!getCourse(courseId)) return [];
  const ctx = context(courseId, { now, section, storage });
  if (courseId === 'cen100') {
    const kinds = cenKinds(ctx);
    const rows = SCHEDULE.filter((row) => !row.section || row.section === ctx.section).map((row) => cenItem(row, ctx, kinds));
    const undated = CEN.allItems.filter((item) => !CEN.itemDeadlines(item.id).length).map((item) => cenUndated(item, ctx));
    const order = new Map([...rows, ...undated].map((item, index) => [item, index]));
    return [...rows, ...undated].sort((a, b) => byDue(a, b) || order.get(a) - order.get(b));
  }
  return DATA[courseId].assessments.map((a) => mathItem(courseId, a, ctx)).sort((a, b) => byDue(a, b));
}

/** One deadline item by id (as deadlines() shapes it), or null. */
function deadlineItemNow(courseId, id, options = {}) {
  if (!getCourse(courseId) || !id) return null;
  const ctx = context(courseId, options);
  if (courseId === 'cen100') {
    const row = SCHEDULE.find((record) => record.id === id);
    if (row) return cenItem(row, ctx);
    const item = CEN.byId.get(String(id).replace(/^item:/, ''));
    return item && !CEN.itemDeadlines(item.id).length ? cenUndated(item, ctx) : null;
  }
  const a = DATA[courseId].assessments.find((assessment) => assessment.id === id);
  return a ? mathItem(courseId, a, ctx) : null;
}

/** Toronto-week buckets: this week (Mon–Sun), next week, later (and undated); `earlier` holds items dated before this week. */
function bucketsNow(items, now) {
  const day = today(new Date(toMs(now)));
  const thisWeek = mondayOf(day);
  const nextWeek = addDays(thisWeek, 7);
  const later = addDays(thisWeek, 14);
  const out = { thisWeek: [], nextWeek: [], later: [], earlier: [] };
  for (const item of items || []) {
    const date = item.date || item.week || null;
    if (!date) out.later.push(item);
    else if (date < thisWeek) out.earlier.push(item);
    else if (date < nextWeek) out.thisWeek.push(item);
    else if (date < later) out.nextWeek.push(item);
    else out.later.push(item);
  }
  return out;
}

/** The next deadline of one course, or across all three (targets.mjs overall(): exact first by start, grace, ties in course order). */
function nextDeadlineNow({ now, courseId, storage } = {}) {
  const ids = courseId ? [courseId].filter((id) => getCourse(id)) : COURSE_IDS;
  const contexts = ids.map((id) => context(id, { now, storage }));
  const targets = contexts.map((ctx) => resolveTarget({ course: ctx.courseId, data: dataFor(ctx.courseId), section: ctx.section, completed: ctx.completed, now: ctx.ms }));
  const winner = courseId ? targets[0] : overall(targets, toMs(now));
  if (!winner || winner.precision === 'empty') return null;
  return deadlineItem(winner.course, winner.id, { now, storage });
}

/**
 * Countdown wording, as the old chips and Desk show it: "6d 12h", "5h 07m", "42m", "Happening now",
 * "Due time passed"; for items without an exact time "Today", "Tomorrow", "In 3 days", "Quiz week",
 * "Date pending" (never an invented time). Pass a deadline item (preferred) or a Date / epoch ms.
 */
function countdownNow(due, now) {
  if (due == null) return { label: '', ms: null, state: 'none', status: null };
  const ms = toMs(now);
  const t = due instanceof Date || typeof due === 'number' ? { precision: 'exact', at: +due } : due.target || due;
  if (!t || !t.precision || (t.precision === 'exact' && !Number.isFinite(t.at))) return { label: '', ms: null, state: 'none', status: null };
  const p = parts(t, ms) || {};
  const result = { label: compact(t, ms), ms: p.ms ?? null, state: p.state, status: status(t, ms) };
  if (p.ms) Object.assign(result, { days: p.d, hours: p.h, minutes: p.m, seconds: p.s, progress: p.progress });
  if (t.title && t.when) result.sentence = sentence(t, ms);
  return result;
}

/* The term-week label for a Monday ("Week 6 · Oct 12–18"), from the semester model. */
const TERM = semesterWeeks();
function weekInfo(monday) {
  const sunday = addDays(monday, 6);
  const week = TERM.find((w) => w.start && w.start <= sunday && w.end >= monday);
  return { number: week ? week.index + 1 : null, label: week ? weekCopy(week).label : `${dateLabel(monday)}–${dateLabel(sunday)}`, start: monday, end: sunday };
}
const inWeek = (item, monday) => {
  const sunday = addDays(monday, 6);
  if (item.date) return item.date >= monday && item.date <= sunday;
  return item.week === monday;
};

function cenSteps(itemId, ticks) {
  const item = CEN.byId.get(itemId);
  return item.groups.flatMap((group, gi) => group[1].map((text, i) => ({ id: `${item.id}-${gi}-${i}`, text, group: group[0], checked: !!ticks[`${item.id}-${gi}-${i}`] })));
}
function mathSteps(courseId, assessmentId, checks) {
  const a = DATA[courseId].assessments.find((x) => x.id === assessmentId);
  return MATH.prep(a, courseId).map((text, i) => ({ id: `${a.id}-${i}`, text, group: '', checked: !!checks[`${a.id}-${i}`] }));
}

/**
 * The checklist for the items due this Toronto week (Mon–Sun), each with its steps (CEN requirement checks,
 * math preparation checks) and its own Mark done id. CEN rows that share one item's checklist in the same week
 * are one entry with several `records`. When this week has nothing, the next week that has unfinished work is
 * used and the array's `upcoming` is true. `.week` = { number, label, start, end }.
 */
function weeklyChecklistNow(courseId, { now, section, storage } = {}) {
  if (!getCourse(courseId)) return Object.assign([], { week: null, upcoming: false });
  const items = deadlines(courseId, { now, section, storage }).filter((item) => item.markable && (item.date || item.week));
  const store = resolveStorage(storage);
  let monday = mondayOf(today(new Date(toMs(now))));
  let upcoming = false;
  if (!items.some((item) => inWeek(item, monday))) {
    const next = items.find((item) => !item.done && (item.date || item.week) > addDays(monday, 6));
    if (next) {
      monday = mondayOf(next.date || next.week);
      upcoming = true;
    }
  }
  const chosen = items.filter((item) => inWeek(item, monday));
  let entries;
  if (courseId === 'cen100') {
    const ticks = readTicks(store);
    const grouped = new Map();
    for (const item of chosen) {
      if (!grouped.has(item.item)) grouped.set(item.item, []);
      grouped.get(item.item).push(item);
    }
    entries = [...grouped.values()].map((records) => {
      const lead = records.find((record) => !record.done) || records[0];
      return {
        itemId: lead.id,
        courseId,
        item: lead.item,
        title: records.length > 1 ? lead.itemName : lead.title,
        due: lead.due,
        dateLabel: lead.dateLabel,
        timeLabel: lead.timeLabel,
        done: records.every((record) => record.done),
        overdue: lead.overdue,
        anchor: lead.anchor,
        href: lead.href,
        deadline: lead,
        records: records.map((record) => ({ id: record.id, title: record.title, done: record.done, dateLabel: record.dateLabel, timeLabel: record.timeLabel, due: record.due })),
        steps: cenSteps(lead.item, ticks),
      };
    });
  } else {
    const { checks } = readMath(courseId, store);
    entries = chosen.map((item) => ({
      itemId: item.id,
      courseId,
      item: item.id,
      title: item.title,
      due: item.due,
      dateLabel: item.dateLabel,
      timeLabel: item.timeLabel,
      done: item.done,
      overdue: item.overdue,
      anchor: item.anchor,
      href: item.href,
      deadline: item,
      records: [{ id: item.id, title: item.title, done: item.done, dateLabel: item.dateLabel, timeLabel: item.timeLabel, due: item.due }],
      steps: mathSteps(courseId, item.id, checks),
    }));
  }
  return Object.assign(entries, { week: weekInfo(monday), upcoming });
}

/**
 * The graded assessments with weights and dates. CEN100: the old "All 20 graded items" table, in its order,
 * dated from the schedule. Math: each assessment (quizzes share the quiz category weight, so their `weight` is
 * null and `weightLabel` says "15% quiz category"). The array carries `totalWeight` (100) and `count`, plus
 * `categories` for math and `table` (the old grouping table) for CEN.
 */
function assessmentsNow(courseId, { section } = {}) {
  if (courseId === 'cen100') {
    const idsFor = (label) => Object.keys(CEN_GRADE_LABELS).filter((id) => CEN_GRADE_LABELS[id] === label);
    const rows = CEN_GRADE_TABLE.rows.map((row) => {
      const ids = idsFor(row.label);
      const dated = ids.map((id) => SCHEDULE.find((record) => record.id === id)).filter(Boolean);
      const undated = ids.find((id) => id.startsWith('item:'));
      let label = dated.map((record) => short(record.date)).join(' · ');
      if (!label) label = undated === 'item:y7' ? CEN.byId.get('y7').small : 'Date pending';
      const item = CEN.byId.get(dated[0]?.item || undated?.slice(5));
      return { title: row.label, dateLabel: label, weight: parseFloat(row.weight), weightLabel: row.weight, ids, item: item?.id || null, anchor: item ? `assignment-${item.id}` : null };
    });
    const total = CEN_GRADE_TABLE.total.length ? parseFloat(CEN_GRADE_TABLE.total[1]) : rows.reduce((sum, row) => sum + row.weight, 0);
    return Object.assign(rows, { totalWeight: total, count: rows.length, table: CEN_PAGE.grading.tables[0], notes: CEN_PAGE.grading.notes, summary: CEN_PAGE.grading.summary });
  }
  if (!isMath(courseId)) return Object.assign([], { totalWeight: 0, count: 0 });
  const course = DATA[courseId];
  const chosen = normaliseSection(courseId, section);
  const rows = course.assessments.map((a) => {
    const e = resolveAssessment(course, a, chosen);
    let label = 'Date pending';
    if (e.date) label = short(e.date);
    else if (e.week) label = `Week of ${dateLabel(e.week)}`;
    return { title: a.title, dateLabel: label, weight: a.kind === 'midterm' ? course.weights[1] : a.kind === 'final' ? course.weights[2] : null, weightLabel: MATH.weight(a, course), ids: [a.id], item: a.id, anchor: `assessment-${a.id}` };
  });
  const labels = ['Lab quizzes', 'Midterm test', 'Final exam'];
  return Object.assign(rows, {
    totalWeight: course.weights.reduce((sum, weight) => sum + weight, 0),
    count: rows.length,
    categories: course.weights.map((weight, i) => ({ title: labels[i], weight })),
    quizPolicy: course.quizPolicy,
  });
}

/**
 * The Desk: one entry per course, in course order, from the vendored deskSummary(): the next deadline (as a
 * deadlines() item, null when nothing is left), progress {completed, total, ratio, thisWeek}, urgency, the saved
 * section text and whether this course holds the overall next deadline.
 */
function deskSnapshotNow({ now, storage } = {}) {
  const store = resolveStorage(storage);
  const ms = toMs(now);
  const summary = deskSummary({ now: ms, storage: view(store) });
  return COURSE_IDS.map((id) => {
    const course = summary[id];
    const next = course.next && course.next.precision !== 'empty' ? deadlineItem(id, course.next.id, { now: ms, storage: store }) : null;
    return {
      course: getCourse(id),
      next,
      target: course.next,
      progress: course.progress,
      urgency: course.urgency,
      kinds: course.kinds,
      week: course.week,
      section: course.section,
      isOverall: course.isOverall,
    };
  });
}

/** "What should I work on?": unrecorded work in the next 7 days (range 'week') or all of it ('all'), as the old tools listed it. */
function workListNow(courseId, { now, range = 'week', storage, section } = {}) {
  const store = resolveStorage(storage);
  const date = new Date(toMs(now));
  if (courseId === 'cen100') {
    const plan = readPlan(store);
    const ticks = readTicks(store);
    const entries = CEN.workEntries(range, plan.completed, plan.targets, date);
    const items = entries.map((entry) => {
      const keys = CEN.checkKeys(entry.item);
      const remaining = keys.filter((key) => !ticks[key]).length;
      return {
        itemId: entry.item.id,
        title: entry.item.name,
        dates: CEN.workDates(entry, date),
        progress: CEN.COPY.workProgress(remaining, keys.length, entry.pending.length),
        target: entry.target ? CEN.COPY.workTarget(entry.target) : '',
        anchor: `assignment-${entry.item.id}`,
        href: `/cen100/#assignment-${entry.item.id}`,
      };
    });
    return { items, status: CEN.COPY.workStatus(items.length, range), empty: '' };
  }
  if (!isMath(courseId)) return { items: [], status: '', empty: '' };
  const course = DATA[courseId];
  const chosen = section === undefined ? readSectionNumber(courseId, store) : normaliseSection(courseId, section);
  const rows = MATH.workRows(course, chosen, readMath(courseId, store), range, date);
  const items = rows.map(({ a, e, target }) => ({
    itemId: a.id,
    title: a.title,
    dates: `${timing(e)}${target ? MATH.WORK.target(target) : ''}`,
    progress: '',
    target: target || '',
    anchor: `assessment-${a.id}`,
    href: `/${courseId}/#assessment-${a.id}`,
  }));
  return { items, status: '', empty: items.length ? '' : MATH.WORK.empty };
}

// Public entry points run with cached Toronto-time formatting (see perf.mjs).
export const deadlines = fast(deadlinesNow);
export const deadlineItem = fast(deadlineItemNow);
export const buckets = fast(bucketsNow);
export const nextDeadline = fast(nextDeadlineNow);
export const countdown = fast(countdownNow);
export const weeklyChecklist = fast(weeklyChecklistNow);
export const assessments = fast(assessmentsNow);
export const deskSnapshot = fast(deskSnapshotNow);
export const workList = fast(workListNow);
