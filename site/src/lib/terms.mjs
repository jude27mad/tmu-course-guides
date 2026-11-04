/* Terms: which term each course's details belong to, and whether the course is current or archived.

   This is the one place to switch a course. While a course is `current`, the site shows everything. After its
   exam period, set `status: 'archived'`: the term's details (dates, deadlines, the schedule, sections, labs,
   rooms, contacts, the calendar export, completion records and the course-updates badge) are hidden everywhere,
   and the lasting parts (overview, grading, policies, study material) stay, labelled with the term they came from.
   Keep `gradesOpen: true` until final grades are released, so students can still check them, then set it to false.

   Pure and static: no clock, no storage. The status is decided when the site is built, so the exported pages and
   the browser always agree. The details themselves stay in vendor/ and content/ (tests compare those with the
   previous site), and the lib functions read the status from here.

   Tests and previews can override the statuses with NEXT_PUBLIC_COURSE_STATUS, a JSON object such as
   {"mth141":{"status":"archived","gradesOpen":false}} (next.config.js inlines it into builds). Leave it unset
   for the published site. */

export const TERMS = Object.freeze({
  'fall-2026': Object.freeze({ id: 'fall-2026', label: 'Fall 2026', short: 'F26', start: '2026-09-08', end: '2026-12-21' }),
});

/** The term the site is in now: its label heads the Desk, the page titles and the footer. */
export const CURRENT_TERM = 'fall-2026';

const COURSE_TERMS = Object.freeze({
  cen100: Object.freeze({ term: 'fall-2026', status: 'current', gradesOpen: true }),
  mth140: Object.freeze({ term: 'fall-2026', status: 'current', gradesOpen: true }),
  mth141: Object.freeze({ term: 'fall-2026', status: 'current', gradesOpen: true }),
});

const STATUSES = ['current', 'archived'];

function readOverride() {
  let raw = '';
  try {
    // Written out in full so Next can replace it at build time; in Node it reads the environment.
    raw = process.env.NEXT_PUBLIC_COURSE_STATUS || '';
  } catch {
    raw = '';
  }
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function resolve(base, override) {
  const entries = Object.entries(base).map(([id, entry]) => {
    const change = override[id] && typeof override[id] === 'object' ? override[id] : {};
    const status = STATUSES.includes(change.status) ? change.status : entry.status;
    const open = typeof change.gradesOpen === 'boolean' ? change.gradesOpen : entry.gradesOpen;
    return [id, Object.freeze({ ...entry, status, gradesOpen: status === 'current' ? true : open })];
  });
  return Object.freeze(Object.fromEntries(entries));
}

const RESOLVED = resolve(COURSE_TERMS, readOverride());
// Own entries only, so ids such as 'toString' are unknown rather than read from Object.prototype.
const entryOf = (courseId) => (typeof courseId === 'string' && Object.hasOwn(RESOLVED, courseId) ? RESOLVED[courseId] : null);

/**
 * A course's term and status as plain JSON, or null for an unknown course:
 * { id, label, short, start, end, status, archived, gradesOpen }. A current course always has gradesOpen true.
 */
export function courseTerm(courseId) {
  const entry = entryOf(courseId);
  if (!entry) return null;
  const term = TERMS[entry.term];
  return { ...term, status: entry.status, archived: entry.status === 'archived', gradesOpen: entry.gradesOpen };
}

/** True when a course has been archived: its term details are hidden and only its lasting content is shown. */
export const isArchived = (courseId) => entryOf(courseId)?.status === 'archived';

/** True while a course's grade calculator is offered: always for a current course, and for an archived one until final grades are out. */
export const gradesOpen = (courseId) => entryOf(courseId)?.gradesOpen === true;

/** The term the site is in now, as in TERMS. */
export const currentTerm = () => TERMS[CURRENT_TERM];

/** True when any course is archived (the published site keeps its exact previous output while none is). */
export const anyArchived = () => Object.values(RESOLVED).some((entry) => entry.status === 'archived');

/**
 * Course info entries tied to one term: contacts, clarifications still awaited, and confirmed details or rules
 * that are dates, times or this term's codes. An archived course leaves them out of Course info and search.
 */
export const TERM_INFORMATION = Object.freeze([
  'contacts',
  'pending-final-exam',
  'pending-assignment-instructions',
  'confirmed-notebook',
  'confirmed-failure-analysis',
  'confirmed-whmis',
  'confirmed-integrity',
  'confirmed-attendance',
  'confirmed-upcoming-labs',
  'policy-roles',
  'policy-email',
  'policy-unconfirmed',
  'policy-notice',
]);

/** CEN100 fact icons that carry a date ('cal') or a place ('pin'); an archived course leaves those facts out. */
export const TERM_FACT_ICONS = Object.freeze(['cal', 'pin']);
