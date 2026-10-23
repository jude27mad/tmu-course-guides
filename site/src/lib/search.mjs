/* The search panel's index, built from the old command palette's groups, copy and ranking (night/palette.mjs). */
import { fast } from './perf.mjs';
import { SCHEDULE } from './vendor/cen-schedule.mjs';
import { resolveTarget } from './vendor/night/targets.mjs';
import { recordsForCourse, semesterWeeks } from './vendor/book/weeks.mjs';
import { COPY, GROUPS, weekCopy, searchIndex as rankEntries } from './vendor/night/palette.mjs';
import { COURSES as DATA } from './vendor/course-data.mjs';
import * as CEN from './content/cen.mjs';
import { DESK, PRIVACY } from './content/pages.mjs';
import { resolveStorage } from './storage.mjs';
import { isMath, readMotionPaused } from './saved.mjs';
import { COURSE_IDS, COURSES, dataFor, getCourse } from './courses.mjs';
import { context, deadlines, nextDeadline, toMs } from './deadlines.mjs';

export { COPY as SEARCH_COPY, GROUPS as SEARCH_GROUPS };
const D2L = 'https://courses.torontomu.ca/';

/**
 * Every searchable entry: [{ id, group, groupLabel, title, detail, href, keywords, type, ... }] in the old
 * palette's groups (Courses, Assessments, Weeks, Topics, Actions). `course` (the page's course, optional) adds
 * that course's views and actions and makes its next deadline a default entry. The array carries `.weeks`
 * (the semester model searchEntries() uses for "week 9", "oct 13" and ISO dates).
 */
function searchIndexNow({ now, storage, course = null, motionForced = false } = {}) {
  const store = resolveStorage(storage);
  const ms = toMs(now);
  const entries = [];
  const add = (group, entry) => entries.push({ group, groupLabel: GROUPS[group], keywords: '', detail: '', href: null, ...entry });

  // Courses: places, then the current course's views (the old palette kept them together).
  const places = [
    { id: 'desk', title: 'Desk', href: '/', detail: DESK.heading },
    { id: 'courses', title: DESK.coursesHeading, href: '/courses/', detail: '' },
    ...COURSES.map((c) => ({ id: c.id, title: `${c.code} · ${c.name}`, href: c.href, detail: c.summary, keywords: c.title })),
    { id: 'privacy', title: PRIVACY.heading, href: '/privacy/', detail: '' },
  ];
  for (const place of places) add('Courses', { id: `place-${place.id}`, type: 'place', default: place.id !== 'privacy', ...place });
  const current = getCourse(course);
  if (current) {
    add('Courses', { id: 'view-assignments', type: 'view', title: 'Work', href: `${current.href}#work`, default: true, courseId: current.id });
    add('Courses', { id: 'view-schedule', type: 'view', title: 'Schedule', href: `${current.href}#schedule`, courseId: current.id });
    if (isMath(current.id)) add('Courses', { id: 'view-study', type: 'view', title: 'Study', href: `${current.href}#study`, default: true, courseId: current.id });
    add('Courses', { id: 'view-info', type: 'view', title: 'Course info', href: `${current.href}#course-info`, default: true, courseId: current.id });
  }

  // Assessments: every deadline of every course, hinted as the old palette did (when · label · cta · note).
  const allDeadlines = [];
  // The default deadline: the page's course's next one, or on other pages the overall next (old palette: "the real next assessment first").
  const featured = current ? null : nextDeadline({ now: ms, storage: store });
  // The page's own course first, so its items lead ties (the old palette listed only the page's course).
  const order = current ? [current.id, ...COURSE_IDS.filter((id) => id !== current.id)] : COURSE_IDS;
  for (const id of order) {
    const ctx = context(id, { now: ms, storage: store });
    const next = resolveTarget({ course: id, data: dataFor(id), section: ctx.section, completed: ctx.completed, now: ms });
    const code = getCourse(id).code;
    for (const item of deadlines(id, { now: ms, storage: store })) {
      allDeadlines.push(item);
      const t = item.target;
      const hint = item.precision === 'pending' && id === 'cen100' ? 'Date pending · Check D2L' : [t.when, t.label, t.cta, t.note].filter(Boolean).join(' · ');
      add('Assessments', {
        id: `assessment-${id}-${item.id}`,
        type: 'item',
        title: item.title,
        detail: `${code} · ${hint}`,
        href: item.href,
        keywords: [code, id === 'cen100' ? item.itemName : ''].filter(Boolean).join(' '),
        courseId: id,
        precision: item.precision,
        done: item.done,
        default: current ? current.id === id && next?.id === item.id : featured?.courseId === id && featured?.id === item.id,
      });
    }
  }

  // Weeks: the semester spreads, each opening the first deadline due that week.
  const records = COURSE_IDS.flatMap((id) => recordsForCourse(id, { cenSchedule: id === 'cen100' ? SCHEDULE : [], courseData: id === 'cen100' ? undefined : DATA[id] }));
  const weeks = semesterWeeks({ records });
  for (const week of weeks) {
    const copy = weekCopy(week);
    const due = week.start ? allDeadlines.filter((item) => (item.date || item.week) && (item.date || item.week) >= week.start && (item.date || item.week) <= week.end) : allDeadlines.filter((item) => item.kind === 'final' && item.precision === 'pending');
    const first = (current && due.find((item) => item.courseId === current.id)) || due[0] || null;
    add('Weeks', {
      id: `week-${week.index}`,
      type: 'week',
      index: week.index,
      title: copy.label,
      ariaLabel: copy.ariaLabel,
      detail: due
        .slice(0, 3)
        .map((item) => `${getCourse(item.courseId).code} ${item.title}`)
        .join(' · '),
      href: first ? first.href : null,
      disabled: !first,
    });
  }

  // Topics: both math courses.
  for (const id of COURSE_IDS.filter(isMath)) {
    for (const topic of DATA[id].topics) add('Topics', { id: `topic-${id}-${topic.id}`, type: 'topic', title: topic.title, detail: `${getCourse(id).code} · ${topic.sections}`, href: `/${id}/#topic-${topic.id}`, keywords: topic.description, courseId: id });
  }

  // Actions.
  if (current) {
    add('Actions', { id: 'action-work', type: 'action', action: 'work', title: 'Work', href: `${current.href}#work`, default: true, courseId: current.id });
    add('Actions', { id: 'action-contacts', type: 'action', action: 'contacts', title: 'Contacts', href: `${current.href}#contacts`, default: true, courseId: current.id });
    add('Actions', { id: 'action-calendar', type: 'action', action: 'calendar', title: 'Export calendar', href: `${current.href}#guide-tools`, default: true, courseId: current.id });
  }
  const paused = readMotionPaused(store);
  add('Actions', { id: 'action-motion', type: 'action', action: 'motion', title: paused ? 'Play motion' : 'Pause motion', disabled: motionForced, detail: motionForced ? 'Reduced motion is enabled by your device or page setting' : 'Stops animation and makes glass controls solid', default: true });
  add('Actions', { id: 'action-d2l', type: 'action', action: 'external', title: 'Open D2L', href: D2L, external: true, default: true });

  return Object.assign(entries, { weeks, itemTitles: Object.fromEntries(CEN.allItems.map((item) => [item.id, item.name])) });
}

/**
 * Rank entries for a query with the old palette's rules: empty → the default entries; otherwise fuzzy
 * subsequence scoring (prefix, word-start and run bonuses), keyword matches lower, groups ordered by their best
 * hit, and "week 9" / "wk 9" / "w9" / "oct 13" / ISO dates jump that week to the top. Each result adds `match`.
 */
function searchEntriesNow(entries, query) {
  if (!entries) return [];
  const index = { entries: entries.map((entry) => ({ ...entry, label: entry.title })), weeks: entries.weeks || [] };
  return rankEntries(index, query ?? '');
}

/* The old pages' own "Search the guide" (inline search): every word must appear (accents ignored) in an item's
   full text. CEN100: assignment cards (name, preview, what, facts, checklists, traps, sources), rule rows and the
   contact lookup (cen-guide.mjs:504-535). Math: assessment and topic cards (math-guide.mjs:128-136). */
const normalise = (text) => String(text).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const GUIDE_ENTRIES = (() => {
  const out = [];
  for (const item of CEN.allItems) {
    out.push({ courseId: 'cen100', title: item.name, tab: CEN.COPY.tabs[CEN.listOf(item)], href: `/cen100/#assignment-${item.id}`, text: [item.name, item.preview, item.what, JSON.stringify(item.facts), JSON.stringify(item.groups), JSON.stringify(item.traps), ...CEN.sourceFor(item)].join(' ') });
  }
  for (const [rows, offset] of [
    [CEN.RULES, 2],
    [CEN.CONFIRMED, 0],
    [CEN.OPEN, 0],
  ]) {
    for (const row of rows) out.push({ courseId: 'cen100', title: row[offset], tab: CEN.COPY.tabs.rules, href: '/cen100/#p-rules', text: row.slice(offset).join(' ') });
  }
  out.push({
    courseId: 'cen100',
    title: CEN.COPY.contactsSearchTitle,
    tab: CEN.COPY.tabs.rules,
    href: '/cen100/#contacts',
    text: `Who to ask contacts section group GA Graduate Assistant Project Manager lab room location ${CEN.STAFFING.map((s) => [s.ga, s.location, ...s.groups.map((g) => g[1])].join(' ')).join(' ')}`,
  });
  for (const id of COURSE_IDS.filter(isMath)) {
    for (const a of DATA[id].assessments) out.push({ courseId: id, title: a.title, tab: 'Assessment', href: `/${id}/#assessment-${a.id}`, text: `${a.title} ${a.scope} ${a.kind} ${a.source}` });
    for (const t of DATA[id].topics) out.push({ courseId: id, title: t.title, tab: 'Topic map', href: `/${id}/#topic-${t.id}`, text: `${t.title} ${t.sections} ${t.description} ${t.skills.join(' ')}` });
  }
  // Normalised once here rather than for every entry on every keystroke.
  return out.map((entry) => ({ ...entry, normalisedTitle: normalise(entry.title), normalisedText: normalise(entry.text) }));
})();

/**
 * The guide's full-text search for a query (all courses, or one with `course`): up to `limit` (12) results
 * [{ courseId, title, tab, href }], title matches first, plus the old status line ("3 results." / "No matches.
 * Try a shorter term.").
 */
function searchGuideNow(query, { course = null, limit = 12 } = {}) {
  const words = normalise(query ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return { results: [], status: '' };
  const q = normalise(query).trim();
  const matches = GUIDE_ENTRIES.filter((entry) => (!course || entry.courseId === course) && words.every((word) => entry.normalisedText.includes(word))).sort(
    (a, b) => Number(b.normalisedTitle.includes(q)) - Number(a.normalisedTitle.includes(q)),
  );
  const status = matches.length ? CEN.COPY.searchStatus(matches.length) : CEN.COPY.searchNone;
  return { results: matches.slice(0, limit).map(({ text, normalisedTitle, normalisedText, ...entry }) => entry), status, total: matches.length };
}

// Public entry points run with cached Toronto-time formatting (see perf.mjs).
export const searchIndex = fast(searchIndexNow);
export const searchEntries = fast(searchEntriesNow);
export const searchGuide = fast(searchGuideNow);
