/* Runs the course data API (src/lib) and returns what it gives, as plain JSON, for tests/terms.test.mjs.

   src/lib/terms.mjs reads NEXT_PUBLIC_COURSE_STATUS once, when it is imported. So the test calls probe() in its own
   process for the committed registry (every course current), and runs this file in a child process with the
   variable set for each archived scenario, then compares the two. Run directly, it prints one JSON object:

     NEXT_PUBLIC_COURSE_STATUS='{"mth141":{"status":"archived"}}' node tests/helpers/archived-probe.mjs full
     NEXT_PUBLIC_COURSE_STATUS='not json' node tests/helpers/archived-probe.mjs status

   `full` covers every function over CLOCKS; `status` gives the statuses and a short fingerprint of the rest. Every
   read uses a memory storage holding SAVED, and the result says whether anything was written to it. */
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

// eslint-disable-next-line import/extensions
import * as lib from '../../src/lib/index.js';
import { informationEntries } from '../../src/lib/information.mjs';
import { anyArchived } from '../../src/lib/terms.mjs';
import { memoryStorage, toronto } from '../helpers.mjs';

export const IDS = ['cen100', 'mth140', 'mth141'];

/** Fixed Toronto clocks across the term. */
export const CLOCKS = [
  toronto('2026-09-09', '10:00'), // week 1
  toronto('2026-10-14', '14:30'), // half an hour before the CEN100 Academic Integrity Quiz closes
  toronto('2026-10-16', '19:00'), // during the MTH141 midterm
  toronto('2026-11-04', '12:00'),
  toronto('2026-12-15', '09:00'), // exam period
];

/** Progress saved on this device: a CEN100 section and group, a math section each, completions, ticks, notes and marks. */
export const SAVED = Object.freeze({
  'cen100-contact-choice-v1': '{"section":29,"group":9}',
  'cen100-personal-plan-v1': '{"completed":{"integrity":1},"notes":{"m2":"Interview list"},"targets":{}}',
  'cen100-g9-ticks': '{"m2-1-3":1}',
  'cen100-grades-v1': '{"marks":{"intro":"9/10","item:y9":"74.5"},"target":80}',
  'mth140-section-v1': '24',
  'mth140-progress-v1': '{"checks":{"quiz-1-0":true},"completed":{"quiz-1":true},"notes":{},"targets":{},"topics":{}}',
  'mth141-section-v1': '31',
  'mth141-progress-v1': '{"checks":{},"completed":{"quiz-1":true},"notes":{},"targets":{},"topics":{"systems-0":true}}',
  'mth141-grades-v1': '{"marks":{"quiz-1":"17/20","midterm":"70"},"target":77}',
});

const each = (fn) => Object.fromEntries(IDS.map((id) => [id, fn(id)]));
const plainJSON = (value) => isDeepStrictEqual(JSON.parse(JSON.stringify(value)), value);
// assessments() and weeklyChecklist() return arrays that carry extra fields (totalWeight, week, …).
const withFields = (list) => ({
  rows: [...list],
  ...Object.fromEntries(
    Object.keys(list)
      .filter((key) => !/^\d+$/.test(key))
      .map((key) => [key, list[key]]),
  ),
});

function statuses() {
  return {
    env: process.env.NEXT_PUBLIC_COURSE_STATUS ?? null,
    terms: each((id) => ({ term: lib.courseTerm(id), archived: lib.isArchived(id), gradesOpen: lib.gradesOpen(id) })),
    unknown: { term: lib.courseTerm('nope'), archived: lib.isArchived('nope'), gradesOpen: lib.gradesOpen('nope') },
    currentTerm: lib.currentTerm(),
    anyArchived: anyArchived(),
    courses: lib.COURSES.map(({ id, term, status, archived, gradesOpen }) => ({ id, term, status, archived, gradesOpen })),
  };
}

/** A short summary of everything the statuses change, at one clock. */
function fingerprint() {
  const now = CLOCKS[3];
  const storage = memoryStorage(SAVED);
  return {
    sections: IDS.map((id) => lib.sections(id).length),
    deadlines: IDS.map((id) => lib.deadlines(id, { now, storage }).map((item) => item.id)),
    next: lib.nextDeadline({ now, storage })?.id ?? null,
    info: IDS.map((id) => 'archived' in lib.courseInfo(id)),
    calendar: IDS.map((id) => lib.calendarFile(id, { now, storage }).ok),
    search: lib.searchIndex({ now, storage, course: 'cen100' }).map((entry) => entry.id),
    guide: lib.searchGuide('KHS134').total,
    writes: storage.writes().length,
  };
}

/** Each setter on its own copy of SAVED: what it returned and what storage holds afterwards. */
function setters() {
  const attempt = (fn) => {
    const storage = memoryStorage(SAVED);
    const result = fn(storage);
    return { result, writes: storage.writes(), data: Object.fromEntries(storage.data) };
  };
  return {
    setSection: { cen100: attempt((s) => lib.setSection('cen100', 12, s)), mth140: attempt((s) => lib.setSection('mth140', 3, s)), mth141: attempt((s) => lib.setSection('mth141', 5, s)) },
    clearSection: each((id) => attempt((s) => lib.setSection(id, null, s))),
    setGroup: attempt((s) => lib.setGroup('cen100', 2, s)),
  };
}

function atClock(now, storage) {
  const deadlines = each((id) => lib.deadlines(id, { now, storage }));
  return {
    now,
    deadlines,
    item: {
      cen100: lib.deadlineItem('cen100', 'integrity', { now, storage }),
      mth140: lib.deadlineItem('mth140', 'midterm', { now, storage }),
      mth141: lib.deadlineItem('mth141', 'midterm', { now, storage }),
    },
    next: { overall: lib.nextDeadline({ now, storage }), ...each((id) => lib.nextDeadline({ now, courseId: id, storage })) },
    weekly: each((id) => {
      const list = withFields(lib.weeklyChecklist(id, { now, storage }));
      return { items: list.rows, week: list.week, upcoming: list.upcoming };
    }),
    work: each((id) => ({ week: lib.workList(id, { now, range: 'week', storage }), all: lib.workList(id, { now, range: 'all', storage }) })),
    assignments: each((id) =>
      lib.assignmentList(id, { now, items: deadlines[id] }).entries.map((entry) => ({ id: entry.id, anchor: entry.anchor, rows: entry.rows.length, records: entry.records.length })),
    ),
    desk: lib.deskSnapshot({ now, storage }),
    calendar: each((id) => lib.calendarFile(id, { now, storage })),
    unseen: each((id) => lib.hasUnseenUpdates(id, storage)),
    search: { none: lib.searchIndex({ now, storage }), ...each((id) => lib.searchIndex({ now, storage, course: id })) },
  };
}

function full() {
  const storage = memoryStorage(SAVED);
  const info = each((id) => lib.courseInfo(id));
  const infoSection = { cen100: lib.courseInfo('cen100', { section: 29, group: 9 }), mth140: lib.courseInfo('mth140', { section: 24 }), mth141: lib.courseInfo('mth141', { section: 31 }) };
  const result = {
    ...statuses(),
    courses: lib.COURSES,
    sections: each((id) => lib.sections(id)),
    groups: lib.groups(29),
    saved: { section: each((id) => lib.getSection(id, storage)), group: lib.getGroup('cen100', storage), profile: lib.getProfile(storage) },
    setters: setters(),
    assessments: each((id) => withFields(lib.assessments(id))),
    assessmentsSection: { mth140: withFields(lib.assessments('mth140', { section: 24 })), mth141: withFields(lib.assessments('mth141', { section: 31 })) },
    plans: each((id) => lib.gradePlan(id)),
    grades: each((id) => lib.readGrades(id, storage)),
    info,
    infoSection,
    entries: each((id) => informationEntries(id, info[id])),
    guide: { khs: lib.searchGuide('KHS134'), fishbone: lib.searchGuide('fishbone'), plannedLab: lib.searchGuide('nov 18') },
    roundTrip: { courses: plainJSON(lib.COURSES), terms: plainJSON(each(lib.courseTerm)), info: plainJSON(info), infoSection: plainJSON(infoSection) },
    clocks: CLOCKS.map((now) => atClock(now, storage)),
  };
  result.storage = { writes: storage.writes(), unchanged: isDeepStrictEqual(Object.fromEntries(storage.data), { ...SAVED }) };
  return result;
}

/** 'full' or 'status' (see the top of this file). Values may hold Dates and Infinity: pass them through JSON to compare. */
export const probe = (mode = 'full') => (mode === 'status' ? { ...statuses(), fingerprint: fingerprint() } : full());

const isMain = () => {
  try {
    return realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
};
if (isMain()) process.stdout.write(JSON.stringify(probe(process.argv[2] === 'status' ? 'status' : 'full')));
