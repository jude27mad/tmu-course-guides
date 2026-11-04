import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// eslint-disable-next-line import/extensions
import * as lib from '../src/lib/index.js';
import { informationEntries } from '../src/lib/information.mjs';
import { TERM_FACT_ICONS, TERM_INFORMATION, anyArchived } from '../src/lib/terms.mjs';
import { COURSES as DATA } from '../src/lib/vendor/course-data.mjs';
import { semesterWeeks } from '../src/lib/vendor/book/weeks.mjs';
import { CLOCKS, IDS, SAVED, probe } from './helpers/archived-probe.mjs';

/* The term registry (src/lib/terms.mjs) and what the data layer does with an archived course.

   The committed registry keeps every course current, and that is checked here in this process. The statuses are
   read once, at import, so archived mode runs in child processes with NEXT_PUBLIC_COURSE_STATUS set
   (tests/helpers/archived-probe.mjs, one process per scenario, printing JSON); their results are compared with the
   same probe run here. Nothing changes shared module state. */

const PROBE = fileURLToPath(new URL('./helpers/archived-probe.mjs', import.meta.url));
const SCENARIOS = {
  // CEN100 archived after final grades, MTH141 archived with its calculator still open, MTH140 current.
  mixed: { cen100: { status: 'archived', gradesOpen: false }, mth141: { status: 'archived' } },
  every: { cen100: { status: 'archived' }, mth140: { status: 'archived' }, mth141: { status: 'archived' } },
};
// Values the registry must ignore: every course stays current with its calculator open.
const IGNORED = [
  '',
  'not json',
  'null',
  '"archived"',
  '[{"mth141":{"status":"archived"}}]',
  '{"mth141":"archived"}',
  '{"mth141":{"status":"retired"},"mth140":{"status":"Archived"}}',
  '{"cen100":{"status":"current","gradesOpen":false},"mth141":{"gradesOpen":false}}',
  '{"nope":{"status":"archived"},"__proto__":{"status":"archived"}}',
];
// A valid status with an invalid gradesOpen keeps the default (open).
const PARTIAL = '{"mth141":{"status":"archived","gradesOpen":"no"},"mth140":{"gradesOpen":false}}';

function runProbe(statuses, mode) {
  const env = { ...process.env, NEXT_PUBLIC_COURSE_STATUS: typeof statuses === 'string' ? statuses : JSON.stringify(statuses) };
  delete env.NODE_TEST_CONTEXT;
  const result = new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [PROBE, mode], { env });
    let out = '';
    let err = '';
    child.stdout.setEncoding('utf8').on('data', (chunk) => {
      out += chunk;
    });
    child.stderr.setEncoding('utf8').on('data', (chunk) => {
      err += chunk;
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve(JSON.parse(out));
      else reject(new Error(`probe (${env.NEXT_PUBLIC_COURSE_STATUS}) exited with ${code}:\n${err.slice(-3000)}`));
    });
  });
  // Awaited by the tests; this only keeps an early failure from being reported as unhandled.
  result.catch(() => {});
  return result;
}

// The child processes start together (the first test starts them) and run while this process works.
let children = null;
const startChildren = () => {
  if (!children) {
    children = {
      ...Object.fromEntries(Object.entries(SCENARIOS).map(([name, statuses]) => [name, runProbe(statuses, 'full')])),
      ignored: Promise.all(IGNORED.map((value) => runProbe(value, 'status'))),
      partial: runProbe(PARTIAL, 'status'),
    };
  }
  return children;
};
let currentRun = null;
/** The full probe in this process (every course current), through JSON like the children's output. */
const current = () => {
  if (!currentRun) currentRun = JSON.parse(JSON.stringify(probe('full')));
  return currentRun;
};

const omit = (object, keys) => Object.fromEntries(Object.entries(object).filter(([key]) => !keys.includes(key)));
const pick = (object, keys) => Object.fromEntries(keys.map((key) => [key, object[key]]));
const anchorOf = (href) => String(href).split('#')[1] || '';
const termEntry = (courseId, anchor, archived) => archived(courseId) && TERM_INFORMATION.includes(anchor);
const EMPTY_WORK = { items: [], status: '', empty: '' };

test('the committed registry: every course is current, with its calculator open', () => {
  startChildren();
  assert.equal(process.env.NEXT_PUBLIC_COURSE_STATUS || '', '', 'run the suite without NEXT_PUBLIC_COURSE_STATUS');
  const term = { id: 'fall-2026', label: 'Fall 2026', short: 'F26', start: '2026-09-08', end: '2026-12-21' };
  assert.equal(lib.CURRENT_TERM, 'fall-2026');
  assert.deepEqual(lib.TERMS[lib.CURRENT_TERM], term);
  Object.entries(lib.TERMS).forEach(([id, entry]) => assert.equal(entry.id, id));
  assert.equal(lib.currentTerm(), lib.TERMS[lib.CURRENT_TERM]);
  assert.equal(anyArchived(), false);
  lib.COURSES.forEach((course, i) => {
    assert.equal(course.id, IDS[i]);
    const entry = lib.courseTerm(course.id);
    assert.deepEqual(entry, { ...term, status: 'current', archived: false, gradesOpen: true }, course.id);
    // Plain JSON (safe for getStaticProps), and a copy each time.
    assert.equal(Object.getPrototypeOf(entry), Object.prototype);
    assert.deepEqual(JSON.parse(JSON.stringify(entry)), entry);
    assert.notEqual(lib.courseTerm(course.id), entry);
    assert.equal(lib.isArchived(course.id), false);
    assert.equal(lib.gradesOpen(course.id), true);
    assert.deepEqual(pick(course, ['term', 'status', 'archived', 'gradesOpen']), { term: entry.label, status: 'current', archived: false, gradesOpen: true });
  });
  // The label is the one the vendored math data carries.
  assert.equal(DATA.mth140.term, 'Fall 2026');
  assert.equal(DATA.mth141.term, 'Fall 2026');
  assert.equal(lib.courseTerm('mth140').label, DATA.mth140.term);
  assert.equal(lib.courseTerm('mth141').label, DATA.mth141.term);
  [undefined, null, '', 'nope', 'CEN100', 'toString', '__proto__', 'constructor', 'hasOwnProperty'].forEach((id) => {
    assert.equal(lib.courseTerm(id), null, String(id));
    assert.equal(lib.isArchived(id), false, String(id));
    assert.equal(lib.gradesOpen(id), false, String(id));
  });
});

test('the current term is the semester model’s own term (vendor/book/weeks.mjs)', () => {
  const source = readFileSync(new URL('../src/lib/vendor/book/weeks.mjs', import.meta.url), 'utf8');
  const [, start, end] = source.match(/export function semesterWeeks\(\{start='([\d-]+)',end='([\d-]+)'/) || [];
  assert.equal(start, '2026-09-08');
  assert.equal(end, '2026-12-21');
  assert.deepEqual(pick(lib.currentTerm(), ['start', 'end']), { start, end });
  assert.deepEqual(semesterWeeks({ start: lib.currentTerm().start, end: lib.currentTerm().end }), semesterWeeks());
});

test('while every course is current, nothing is archived and the term lists name real entries', () => {
  const run = current();
  IDS.forEach((id) => {
    assert.ok(!('archived' in run.info[id]) && !('term' in run.info[id]), `${id}: current info is unchanged`);
    assert.ok(run.sections[id].length > 0 && run.info[id].contacts && run.info[id].tools.calendar, id);
    assert.ok(
      run.assessments[id].rows.every((row) => row.dateLabel),
      `${id}: every assessment is dated`,
    );
    assert.ok(
      run.clocks.every((at) => at.deadlines[id].length > 0),
      `${id}: deadlines at every clock`,
    );
    assert.equal(run.clocks[0].unseen[id], true, `${id}: course updates are new`);
    assert.equal(run.clocks[0].calendar[id].ok, true, `${id}: a calendar file in week 1`);
  });
  // Every TERM_INFORMATION id is a real Course info entry of some course, and every term fact icon is used.
  const ids = new Set(IDS.flatMap((id) => informationEntries(id, lib.courseInfo(id)).map((entry) => entry.id)));
  TERM_INFORMATION.forEach((id) => assert.ok(ids.has(id), `${id} is a Course info entry`));
  const icons = new Set(run.info.cen100.items.flatMap((item) => item.facts.map((fact) => fact.icon)));
  assert.deepEqual([...TERM_FACT_ICONS], ['cal', 'pin'], 'date and place facts');
  TERM_FACT_ICONS.forEach((icon) => assert.ok(icons.has(icon), `${icon} is a CEN100 fact icon`));
  // The saved state the archived scenarios must ignore is read here.
  assert.deepEqual(run.saved, { section: { cen100: 29, mth140: 24, mth141: 31 }, group: 9, profile: { section: 29, group: 9 } });
  assert.deepEqual(run.grades.cen100, { marks: { intro: '9/10', 'item:y9': '74.5' }, target: 80 });
  assert.deepEqual(run.grades.mth141, { marks: { 'quiz-1': '17/20', midterm: '70' }, target: 77 });
  assert.equal(run.guide.khs.total, 1);
  assert.deepEqual(run.roundTrip, { courses: true, terms: true, info: true, infoSection: true });
  assert.deepEqual(run.storage, { writes: [], unchanged: true });
  IDS.forEach((id) => assert.equal(run.setters.setSection[id].result, true, `${id}: a current course saves its section`));
  assert.equal(run.setters.setGroup.result, true);
});

test('an invalid or malformed NEXT_PUBLIC_COURSE_STATUS is ignored', async () => {
  const here = JSON.parse(JSON.stringify(probe('status')));
  const runs = await startChildren().ignored;
  runs.forEach((run, i) => {
    assert.equal(run.env, IGNORED[i]);
    assert.deepEqual(omit(run, ['env']), omit(here, ['env']), `NEXT_PUBLIC_COURSE_STATUS=${IGNORED[i]}`);
  });
  assert.equal(here.anyArchived, false);
  assert.equal(here.fingerprint.writes, 0);
});

test('a partial override changes only what it names', async () => {
  const run = await startChildren().partial;
  assert.deepEqual(
    IDS.map((id) => [id, run.terms[id].archived, run.terms[id].gradesOpen]),
    [
      ['cen100', false, true],
      ['mth140', false, true],
      ['mth141', true, true],
    ],
  );
  assert.equal(run.anyArchived, true);
  assert.deepEqual(run.courses[2], { id: 'mth141', term: 'Fall 2026', status: 'archived', archived: true, gradesOpen: true });
  assert.deepEqual(run.fingerprint.sections, [39, 34, 0]);
  assert.deepEqual(run.fingerprint.info, [false, false, true]);
  assert.equal(run.fingerprint.deadlines[2].length, 0);
  assert.equal(run.fingerprint.calendar[2], false);
  assert.equal(run.fingerprint.guide, 1, 'CEN100 is current, so its contacts lookup stays');
  assert.equal(run.fingerprint.writes, 0);
});

Object.entries(SCENARIOS).forEach(([name, statuses]) => {
  const archived = (id) => statuses[id]?.status === 'archived';
  const open = (id) => !archived(id) || statuses[id].gradesOpen !== false;
  const label = `${name} (${JSON.stringify(statuses)})`;
  const scenario = async () => ({ run: await startChildren()[name], was: current() });

  test(`${label}: the registry, COURSES and courseTerm()`, async () => {
    const { run, was } = await scenario();
    assert.equal(run.anyArchived, true);
    assert.deepEqual(run.currentTerm, was.currentTerm);
    assert.deepEqual(run.unknown, was.unknown);
    IDS.forEach((id, i) => {
      const status = archived(id) ? 'archived' : 'current';
      assert.deepEqual(run.terms[id], { term: { ...was.currentTerm, status, archived: archived(id), gradesOpen: open(id) }, archived: archived(id), gradesOpen: open(id) }, id);
      assert.equal(run.terms[id].term.label, 'Fall 2026');
      // An archived course also gets a summary and description that promise only its lasting parts.
      const words = archived(id)
        ? { summary: 'Overview, grading, policies and study material.', description: `${was.courses[i].code} at TMU, archived: overview, grading, policies and study material from Fall 2026.` }
        : {};
      assert.deepEqual(run.courses[i], { ...was.courses[i], status, archived: archived(id), gradesOpen: open(id), ...words }, `${id}: only the status fields change`);
    });
  });

  test(`${label}: no sections, groups or saved choice, and the setters write nothing`, async () => {
    const { run, was } = await scenario();
    IDS.forEach((id) => {
      if (archived(id)) {
        assert.deepEqual(run.sections[id], [], id);
        assert.equal(run.saved.section[id], null, id);
        [run.setters.setSection[id], run.setters.clearSection[id]].forEach((attempt) => {
          assert.deepEqual(attempt, { result: false, writes: [], data: { ...SAVED } }, `${id}: nothing saved`);
        });
      } else {
        assert.deepEqual(run.sections[id], was.sections[id], id);
        assert.equal(run.saved.section[id], was.saved.section[id], id);
        assert.deepEqual(run.setters.setSection[id], was.setters.setSection[id], id);
        assert.deepEqual(run.setters.clearSection[id], was.setters.clearSection[id], id);
      }
    });
    if (archived('cen100')) {
      assert.deepEqual(run.groups, []);
      assert.equal(run.saved.group, null);
      assert.equal(run.saved.profile, null);
      assert.deepEqual(run.setters.setGroup, { result: false, writes: [], data: { ...SAVED } });
    }
  });

  test(`${label}: no deadlines, checklist, work list, calendar or updates badge; current courses unchanged`, async () => {
    const { run, was } = await scenario();
    assert.equal(run.clocks.length, CLOCKS.length);
    run.clocks.forEach((at, k) => {
      const then = was.clocks[k];
      assert.equal(at.now, then.now);
      const when = `${name} at ${new Date(at.now).toISOString()}`;
      IDS.forEach((id) => {
        if (!archived(id)) {
          ['deadlines', 'item', 'weekly', 'work', 'assignments', 'calendar', 'unseen'].forEach((key) => assert.deepEqual(at[key][id], then[key][id], `${id} ${key}, ${when}`));
          assert.deepEqual(at.next[id], then.next[id], `${id} next, ${when}`);
          return;
        }
        assert.deepEqual(at.deadlines[id], [], `${id}, ${when}`);
        assert.equal(at.item[id], null, `${id}, ${when}`);
        assert.equal(at.next[id], null, `${id}, ${when}`);
        assert.deepEqual(at.weekly[id], { items: [], week: null, upcoming: false }, `${id}, ${when}`);
        assert.deepEqual(at.work[id], { week: EMPTY_WORK, all: EMPTY_WORK }, `${id}, ${when}`);
        assert.equal(at.calendar[id].ok, false, `${id}, ${when}`);
        assert.equal(at.calendar[id].count, 0);
        assert.ok(at.calendar[id].message.includes(run.terms[id].term.label), at.calendar[id].message);
        assert.equal(at.unseen[id], false, `${id}, ${when}`);
        // assignmentList() keeps every content item (no rows); the page lists items from courseInfo() instead.
        assert.deepEqual(
          at.assignments[id].map((entry) => [entry.id, entry.anchor, entry.rows, entry.records]),
          then.assignments[id].map((entry) => [entry.id, entry.anchor, 0, 0]),
        );
      });
    });
  });

  test(`${label}: the next deadline and the Desk leave archived courses out`, async () => {
    const { run, was } = await scenario();
    run.clocks.forEach((at, k) => {
      const then = was.clocks[k];
      const when = `${name} at ${new Date(at.now).toISOString()}`;
      const { overall } = at.next;
      // With nothing current there is no next deadline; otherwise MTH140 always has one at these clocks.
      if (IDS.every(archived)) assert.equal(overall, null, when);
      else assert.ok(overall, when);
      if (overall) {
        assert.ok(!archived(overall.courseId), `${when}: ${overall.courseId}`);
        assert.deepEqual(overall, at.next[overall.courseId], `${when}: the overall next is that course's next`);
      }
      // Leaving other courses out cannot change a winner that is still current.
      if (then.next.overall && !archived(then.next.overall.courseId)) assert.deepEqual(overall, then.next.overall, when);
      assert.deepEqual(
        at.desk.map((entry) => entry.course.id),
        IDS,
        when,
      );
      at.desk.forEach((entry, i) => {
        const id = IDS[i];
        assert.deepEqual(entry.course, run.courses[i]);
        if (!archived(id)) {
          assert.deepEqual(omit(entry, ['isOverall']), omit(then.desk[i], ['isOverall']), `${id}, ${when}`);
          return;
        }
        assert.deepEqual(
          pick(entry, ['next', 'target', 'section', 'progress', 'kinds', 'urgency', 'isOverall']),
          {
            next: null,
            target: null,
            section: null,
            progress: { completed: 0, total: 0, ratio: 0, thisWeek: 0 },
            kinds: { final: 0, midterm: 0, quizLab: 0, minor: 0 },
            urgency: 'empty',
            isOverall: false,
          },
          `${id}, ${when}`,
        );
        assert.equal(entry.week.termWeek, then.desk[i].week.termWeek);
      });
      // The Desk marks the course that holds the overall next deadline.
      assert.deepEqual(
        at.desk.filter((entry) => entry.isOverall).map((entry) => entry.course.id),
        overall ? [overall.courseId] : [],
        when,
      );
    });
  });

  test(`${label}: assessments and the grade calculator keep every item and weight, without dates`, async () => {
    const { run, was } = await scenario();
    const undated = (plan) => ({
      ...plan,
      groups: plan.groups.map((group) => ({ ...group, items: group.items.map((item) => omit(item, ['dateLabel'])) })),
      items: plan.items.map((item) => omit(item, ['dateLabel'])),
    });
    IDS.forEach((id) => {
      const rows = run.assessments[id];
      const before = was.assessments[id];
      if (archived(id)) {
        assert.deepEqual(
          rows.rows.map((row) => omit(row, ['dateLabel'])),
          before.rows.map((row) => omit(row, ['dateLabel'])),
          `${id}: same titles, ids, items, anchors, weights and labels`,
        );
        assert.ok(
          rows.rows.every((row) => row.dateLabel === ''),
          id,
        );
        // totalWeight, count, and categories/quizPolicy (math) or table/notes/summary (CEN100).
        assert.deepEqual(omit(rows, ['rows']), omit(before, ['rows']), id);
        assert.deepEqual(
          run.plans[id].items.map((item) => [item.id, item.weight]),
          was.plans[id].items.map((item) => [item.id, item.weight]),
          id,
        );
        assert.deepEqual(undated(run.plans[id]), undated(was.plans[id]), id);
        assert.ok(run.plans[id].items.every((item) => item.dateLabel === ''));
      } else {
        assert.deepEqual(rows, before, id);
        assert.deepEqual(run.plans[id], was.plans[id], id);
      }
      if (id !== 'cen100') assert.deepEqual(run.assessmentsSection[id], archived(id) ? rows : was.assessmentsSection[id], `${id}: with a section`);
      // Saved marks keep their items, so they read back unchanged.
      assert.deepEqual(run.grades[id], was.grades[id], id);
    });
  });

  test(`${label}: courseInfo() keeps the lasting guidance and drops the term's details`, async () => {
    const { run, was } = await scenario();
    const TIMED = ['timing', 'tile', 'room', 'roomNote', 'dateNote'];
    const CEN_TERM = ['date', 'tile', 'facts', 'records', 'calendar'];
    IDS.forEach((id) => {
      const info = run.info[id];
      const before = was.info[id];
      if (!archived(id)) {
        assert.deepEqual(info, before, id);
        assert.deepEqual(run.infoSection[id], was.infoSection[id], id);
        return;
      }
      assert.equal(info.archived, true);
      assert.deepEqual(info.term, run.terms[id].term);
      assert.equal(info.term.label, 'Fall 2026');
      assert.equal(info.contacts, null);
      // CEN100's tools note no longer mentions the section and group it no longer has.
      assert.deepEqual(info.tools, { ...before.tools, calendar: null, ...(id === 'cen100' ? { note: 'Your saved checklist settings stay on this device.' } : {}) });
      assert.deepEqual(info.sections, []);
      assert.deepEqual(run.infoSection[id], info, `${id}: a section or group changes nothing`);
      if (id === 'cen100') {
        assert.deepEqual(omit(info, ['archived', 'term', 'contacts', 'tools', 'sections', 'items']), omit(before, ['contacts', 'tools', 'sections', 'items']));
        assert.equal(info.items.length, before.items.length);
        info.items.forEach((item, i) => {
          const old = before.items[i];
          // Ids, anchors, requirements, checklist groups, traps and sources stay; tutorial attendance (y7) keeps
          // only its lasting first sentences, without the section prompt and Section 29's quiz window.
          const kept = item.id === 'y7' ? [...CEN_TERM, 'what', 'source'] : CEN_TERM;
          assert.deepEqual(omit(item, kept), omit(old, kept), item.id);
          assert.deepEqual(pick(item, ['date', 'tile', 'records', 'calendar']), { date: null, tile: null, records: [], calendar: false }, item.id);
          assert.deepEqual(
            item.facts,
            old.facts.filter((fact) => !['cal', 'pin'].includes(fact.icon)),
            item.id,
          );
        });
        assert.ok(before.items.some((item) => item.date && item.tile && item.records.length && item.calendar));
        const y7 = info.items.find((item) => item.id === 'y7');
        assert.equal(y7.what, 'Attendance quizzes take place during your assigned tutorial.');
        assert.deepEqual(y7.source, { ...before.items.find((item) => item.id === 'y7').source, note: 'Course outline, pp. 9–10: participation weight and in-person attendance.' });
        assert.doesNotMatch(JSON.stringify(y7), /Section 29|Select your section/);
      } else {
        assert.deepEqual(
          omit(info, ['archived', 'term', 'contacts', 'tools', 'sections', 'assessments', 'topics', 'notice']),
          omit(before, ['contacts', 'tools', 'sections', 'assessments', 'topics', 'notice']),
        );
        assert.equal(info.notice, null);
        assert.ok(before.notice);
        assert.equal(info.assessments.length, before.assessments.length);
        info.assessments.forEach((a, i) => {
          assert.deepEqual(omit(a, TIMED), omit(before.assessments[i], TIMED), `${id} ${a.id}: id, anchor, checklist and the rest stay`);
          assert.deepEqual(pick(a, TIMED), { timing: '', tile: null, room: '', roomNote: '', dateNote: '' }, a.id);
        });
        assert.ok(before.assessments.some((a) => a.timing && a.tile));
        assert.deepEqual(
          info.topics,
          before.topics.map((topic) => ({ ...topic, midterm: false })),
        );
      }
    });
    assert.deepEqual(run.roundTrip, { courses: true, terms: true, info: true, infoSection: true });
  });

  test(`${label}: Course info entries and guide search leave out the term's entries`, async () => {
    const { run, was } = await scenario();
    IDS.forEach((id) => {
      if (!archived(id)) {
        assert.deepEqual(run.entries[id], was.entries[id], id);
        return;
      }
      const kept = was.entries[id].filter((entry) => !TERM_INFORMATION.includes(entry.id));
      assert.ok(kept.length < was.entries[id].length, id);
      assert.deepEqual(run.entries[id], kept, `${id}: the same entries in the same order, without the term's`);
    });
    if (archived('cen100')) assert.deepEqual(pick(run.guide.khs, ['results', 'total']), { results: [], total: 0 }, 'no contacts lookup');
    else assert.deepEqual(run.guide.khs, was.guide.khs);
    const fishbone = was.guide.fishbone.results.filter((result) => !termEntry(result.courseId, anchorOf(result.href), archived));
    assert.deepEqual(run.guide.fishbone.results, fishbone);
    assert.equal(run.guide.fishbone.total, fishbone.length);
    assert.ok(run.guide.fishbone.results.some((result) => result.href === '/cen100/#assignment-m3'));
    // The guide search matches what the page shows: 'nov 18' is only in CEN100 m5's lab date fact, which an archived course hides.
    assert.ok(was.guide.plannedLab.results.some((result) => result.href === '/cen100/#assignment-m5'));
    assert.equal(
      run.guide.plannedLab.results.some((result) => result.href === '/cen100/#assignment-m5'),
      !archived('cen100'),
    );
  });

  test(`${label}: search leaves out archived deadlines, weeks, schedule, contacts and calendar`, async () => {
    const { run, was } = await scenario();
    const codes = IDS.filter(archived).map((id) => id.toUpperCase());
    run.clocks.forEach((at, k) => {
      const then = was.clocks[k];
      ['none', ...IDS].forEach((key) => {
        const page = key === 'none' ? null : key;
        const entries = at.search[key];
        const where = `${name}, page ${key}, ${new Date(at.now).toISOString()}`;
        const has = (id) => entries.some((entry) => entry.id === id);
        entries.forEach((entry) => {
          if (entry.group === 'Assessments') assert.ok(!archived(entry.courseId), `${where}: ${entry.id}`);
          if (entry.group === 'Weeks') {
            assert.ok(entry.href === null || !IDS.filter(archived).some((id) => entry.href.startsWith(`/${id}/`)), `${where}: ${entry.title} → ${entry.href}`);
            assert.ok(!codes.some((code) => entry.detail.includes(code)), `${where}: ${entry.title} · ${entry.detail}`);
          }
          if (entry.type === 'information') assert.ok(!termEntry(entry.courseId, anchorOf(entry.href), archived), `${where}: ${entry.id}`);
        });
        if (page) {
          assert.equal(has('view-schedule'), !archived(page), where);
          assert.equal(has('action-contacts'), !archived(page), where);
          assert.equal(has('action-calendar'), !archived(page), where);
          assert.equal(has('view-grades'), open(page), where);
          assert.equal(has('view-study'), page !== 'cen100', where);
          assert.ok(has('view-assignments') && has('view-info') && has('action-work'), where);
        }
        // The default deadline: the page's own next one, or the overall next without a page.
        const featured = page ? at.next[page] : at.next.overall;
        assert.deepEqual(
          entries.filter((entry) => entry.group === 'Assessments' && entry.default).map((entry) => entry.id),
          featured ? [`assessment-${featured.courseId}-${featured.id}`] : [],
          where,
        );
        // Everything else is exactly as before (weeks are rebuilt from the current courses' records).
        const removed = (entry) =>
          (entry.group === 'Assessments' && archived(entry.courseId)) ||
          (entry.type === 'information' && termEntry(entry.courseId, anchorOf(entry.href), archived)) ||
          (page && archived(page) && ['view-schedule', 'action-contacts', 'action-calendar'].includes(entry.id)) ||
          (page && !open(page) && entry.id === 'view-grades');
        // An archived course's place entry describes only its lasting parts.
        IDS.filter(archived).forEach((id) => assert.equal(entries.find((entry) => entry.type === 'place' && entry.id === id).detail, 'Overview, grading, policies and study material.', where));
        const place = (entry) => entry.type === 'place' && archived(entry.id);
        const shape = (entry) => {
          if (entry.group === 'Assessments') return omit(entry, ['default']);
          return place(entry) ? omit(entry, ['detail']) : entry;
        };
        const comparable = (list) => list.filter((entry) => entry.group !== 'Weeks').map(shape);
        assert.deepEqual(comparable(entries), comparable(then.search[key].filter((entry) => !removed(entry))), where);
      });
    });
  });

  test(`${label}: reading archived data never writes storage`, async () => {
    const { run } = await scenario();
    assert.deepEqual(run.storage, { writes: [], unchanged: true });
  });
});
