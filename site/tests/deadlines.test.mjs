import test from 'node:test';
import assert from 'node:assert/strict';

import { deadlines, deadlineItem, nextDeadline, countdown, deskSnapshot, buckets, weeklyChecklist } from '../src/lib/index.js';
import { oldModule, oldCall, memoryStorage, toronto, termClocks } from './helpers.mjs';

const OLD_TARGETS = await oldModule('night/targets.mjs');
const OLD_DESK = await oldModule('desk/desk-data.mjs');
const { SCHEDULE } = await oldModule('cen-schedule.mjs');
const { COURSES } = await oldModule('course-data.mjs');
const DATA = { cen100: SCHEDULE, mth140: COURSES.mth140, mth141: COURSES.mth141 };
const at = (iso) => Date.parse(iso);
const NOON_OCT12 = toronto('2026-10-12', '12:00');

/* Saved states written exactly as the old pages stored them. */
const cenStore = (profile, completed = {}) =>
  memoryStorage({
    ...(profile === undefined ? {} : { 'cen100-contact-choice-v1': JSON.stringify(profile) }),
    'cen100-personal-plan-v1': JSON.stringify({ completed, notes: {}, targets: {} }),
  });
const mathStore = (course, section, completed = {}) =>
  memoryStorage({
    ...(section === undefined ? {} : { [`${course}-section-v1`]: JSON.stringify(section) }),
    [`${course}-progress-v1`]: JSON.stringify({ checks: {}, completed, notes: {}, targets: {}, topics: {} }),
  });
const cen = (now, section = 0, completed = {}) => nextDeadline({ now, courseId: 'cen100', storage: cenStore(section ? { section, group: null } : null, completed) });
const math = (course, now, section = 0, completed = {}) => nextDeadline({ now, courseId: course, storage: mathStore(course, section, completed) });

/* ---- The Toronto cases of the old tests/targets.test.mjs, through the new API ---- */

test('CEN Academic Integrity quiz: Oct 14, 3:00 PM Toronto, exact, "2d 3h" from noon Oct 12', () => {
  const t = cen(NOON_OCT12);
  assert.equal(t.id, 'integrity');
  assert.equal(t.item, 'y4');
  assert.equal(t.title, 'Academic Integrity Quiz');
  assert.equal(t.precision, 'exact');
  assert.equal(+t.due, at('2026-10-14T19:00:00Z'));
  assert.equal(t.when, 'Wed Oct 14 · 3:00 PM Toronto');
  assert.equal(t.dateLabel, 'Wed Oct 14');
  assert.equal(t.timeLabel, '3:00 PM Toronto');
  assert.equal(t.label, 'Due');
  assert.equal(t.anchor, 'assignment-y4');
  assert.equal(countdown(t, NOON_OCT12).label, '2d 3h');
  assert.equal(countdown(t.due, NOON_OCT12).label, '2d 3h');
});

test('MTH140 midterm: Oct 23, 6:30 PM Toronto, with its end', () => {
  const t = math('mth140', NOON_OCT12, 31, { 'quiz-2': true });
  assert.equal(t.id, 'midterm');
  assert.equal(t.precision, 'exact');
  assert.equal(+t.due, at('2026-10-23T22:30:00Z'));
  assert.equal(t.target.end, at('2026-10-24T00:30:00Z'));
  assert.equal(t.when, 'Fri Oct 23 · 6:30 PM Toronto');
  assert.equal(t.label, 'Test starts');
  assert.equal(t.anchor, 'assessment-midterm');
  assert.equal(t.weight, 40);
});

test('a quiz week without a section: week precision, the section CTA and no timer', () => {
  const t = math('mth140', NOON_OCT12);
  assert.equal(t.id, 'quiz-2');
  assert.equal(t.precision, 'week');
  assert.equal(t.cta, 'Choose section for quiz date');
  assert.equal(t.label, 'Quiz week');
  assert.equal(t.dateLabel, 'Oct 12–16');
  assert.equal(t.due, null);
  const c = countdown(t, NOON_OCT12);
  assert.equal(c.label, 'Quiz week');
  assert.equal(c.ms, null);
  assert.equal(countdown(t.due, NOON_OCT12).label, '', 'no instant, no countdown');
  assert.equal(math('mth141', toronto('2026-11-25', '12:00')).dateLabel, 'Nov 30–Dec 4');
});

test('a quiz week with a saved section: exact lab start, room and the timetable caveat', () => {
  const t = math('mth141', toronto('2026-10-20', '12:00'), 3);
  assert.equal(t.id, 'quiz-3');
  assert.equal(t.precision, 'exact');
  assert.equal(+t.due, at('2026-11-04T20:00:00Z'));
  assert.equal(t.when, 'Wed Nov 4 · 3:00 PM · POD367');
  assert.equal(t.label, 'Your lab quiz starts');
  assert.match(t.target.note, /lab timetable/);
  const second = math('mth140', NOON_OCT12, 31);
  assert.equal(second.id, 'quiz-2');
  assert.equal(+second.due, toronto('2026-10-15', '16:00'));
  assert.match(second.label, /lab starts.*second hour/);
  assert.equal(second.timeLabel, 'second hour of your 4:00 PM–6:00 PM lab');
});

test('Thanksgiving: the announced Monday make-up is exact', () => {
  const makeup = math('mth140', NOON_OCT12, 2);
  assert.equal(makeup.precision, 'exact');
  assert.equal(+makeup.due, toronto('2026-10-19', '10:00'));
  assert.match(makeup.target.note, /make-up date confirmed for Oct 19 on D2L/);
  assert.match(makeup.detail, /Monday, October 19/);
});

test('the end-of-day rule: a dated submission without a time counts down to 11:59 PM Toronto', () => {
  const t = cen(NOON_OCT12, 0, { integrity: 1 });
  assert.equal(t.id, 'whmis');
  assert.equal(t.precision, 'exact');
  assert.equal(+t.due, toronto('2026-10-15', '00:00'));
  assert.equal(t.when, 'Wed Oct 14 · by 11:59 PM Toronto');
  assert.equal(t.timeLabel, 'by 11:59 PM Toronto');
  assert.equal(t.label, 'Due by end of day');
  assert.equal(t.date, '2026-10-14', 'dated on its due day');
  assert.equal(countdown(t, NOON_OCT12).label, '2d 12h');
  for (const item of deadlines('cen100', { now: NOON_OCT12, section: 29, storage: null }).filter((x) => !x.id.startsWith('item:'))) {
    const row = SCHEDULE.find((e) => e.id === item.id);
    if (row.time) assert.equal(item.precision, 'exact', item.id);
    else if (/ due$/.test(row.title)) {
      assert.equal(item.precision, 'exact', item.id);
      assert.equal(item.timeLabel, 'by 11:59 PM Toronto', item.id);
    } else {
      assert.equal(item.precision, 'day', item.id);
      assert.equal(item.timeLabel, 'Time not posted', item.id);
      assert.equal(item.due, null, `${item.id}: in-class events get no invented time`);
    }
  }
});

test('pending and empty: an undated final is next once nothing dated is left; with nothing open, null', () => {
  const dated = Object.fromEntries(COURSES.mth140.assessments.filter((a) => a.date || a.week).map((a) => [a.id, true]));
  const t = math('mth140', NOON_OCT12, 31, dated);
  assert.equal(t.id, 'final');
  assert.equal(t.precision, 'pending');
  assert.equal(t.dateLabel, 'Date pending');
  assert.equal(countdown(t, NOON_OCT12).label, 'Date pending');
  assert.equal(math('mth140', NOON_OCT12, 31, { ...dated, final: true }), null);
  assert.equal(cen(toronto('2026-12-03', '00:00'), 29), null);
});

test('completed items are skipped, including reminders whose item is fully recorded; ticks never count', () => {
  assert.equal(cen(NOON_OCT12, 29).id, 'integrity');
  assert.equal(cen(NOON_OCT12, 29, { integrity: 1 }).id, 'failure-lab');
  assert.equal(cen(NOON_OCT12, 29, { integrity: 1, failure: 1 }).id, 'whmis');
  assert.equal(cen(NOON_OCT12, 29, { integrity: 1, 'failure-lab': 1 }).id, 'failure-lab');
  assert.equal(cen(NOON_OCT12, 0, { integrity: 0 }).id, 'integrity');
  assert.equal(math('mth140', NOON_OCT12, 31, { 'quiz-2': 'yes' }).id, 'quiz-2');
  // Every Academic Integrity checklist tick, but no completion record: still next.
  const storage = cenStore(null, {});
  storage.setItem('cen100-g9-ticks', JSON.stringify({ 'y4-0-0': 1 }));
  assert.equal(nextDeadline({ now: NOON_OCT12, courseId: 'cen100', storage }).id, 'integrity');
});

test('Toronto/UTC boundaries decide eligibility', () => {
  const late = at('2026-10-15T03:30:00Z');
  const t = cen(late);
  assert.equal(t.id, 'whmis');
  assert.equal(countdown(t, late).label, '30m');
  assert.equal(cen(at('2026-10-15T04:00:00Z')).id, 'failure');
  assert.equal(math('mth140', at('2026-10-17T03:59:00Z')).id, 'quiz-2');
  assert.equal(math('mth140', at('2026-10-17T04:00:00Z')).id, 'midterm');
  const review = deadlineItem('cen100', 'review', { now: at('2026-11-02T03:00:00Z'), storage: null });
  assert.equal(review.precision, 'day');
  assert.equal(countdown(review, at('2026-11-02T03:00:00Z')).label, 'In 3 days');
  assert.equal(cen(toronto('2026-10-14', '14:59')).id, 'integrity');
  assert.equal(cen(toronto('2026-10-14', '15:00') + 1).id, 'whmis');
});

test('the overall next deadline never manufactures a timer from an uncertain target', () => {
  const storage = memoryStorage();
  const first = nextDeadline({ now: NOON_OCT12, storage });
  assert.equal(first.courseId, 'mth140');
  assert.equal(first.precision, 'week');
  assert.equal(first.due, null);
  storage.setItem('mth140-section-v1', '31');
  const exact = nextDeadline({ now: NOON_OCT12, storage });
  assert.equal(exact.courseId, 'cen100');
  assert.equal(exact.id, 'integrity');
});

/* ---- Sweeps: the new API against the old modules, clock by clock ---- */

const CEN_STATES = [
  [undefined, {}],
  [null, { integrity: 1 }],
  [{ section: 29, group: 9 }, {}],
  [{ section: 29, group: 9 }, { integrity: 1, failure: 1 }],
  [{ section: 5, group: null }, { whmis: 1, 'matlab-1': 1, 'failure-lab': 1 }],
  [{ section: 29, group: 9 }, Object.fromEntries(SCHEDULE.map((e) => [e.id, 1]))],
];
const mathStates = (course) => [
  [undefined, {}],
  [0, { 'quiz-1': true }],
  [2, {}],
  [3, { 'quiz-2': 1 }],
  [31, Object.fromEntries(COURSES[course].assessments.filter((a) => a.kind === 'quiz').map((a) => [a.id, true]))],
  [99, {}],
];
const storeFor = (course, [saved, completed]) => (course === 'cen100' ? cenStore(saved, completed) : mathStore(course, saved, completed));
const oldTarget = (course, storage, now, id = null) => oldCall(() => OLD_TARGETS.resolveTarget({ course, data: DATA[course], ...OLD_TARGETS.readSaved(course, DATA[course], storage), now, id }));
const clocks = await termClocks();

test('next deadline per course and overall: same item as the old resolver, at every clock and saved state', () => {
  let cases = 0;
  for (const now of clocks) {
    const stores = {};
    for (const course of ['cen100', 'mth140', 'mth141']) {
      const states = course === 'cen100' ? CEN_STATES : mathStates(course);
      states.forEach((state, i) => {
        const storage = storeFor(course, state);
        const expected = oldTarget(course, storage, now);
        const mine = nextDeadline({ now, courseId: course, storage });
        if (expected.precision === 'empty') assert.equal(mine, null);
        else {
          assert.deepEqual(mine.target, expected, `${course} ${new Date(now).toISOString()} state ${i}`);
          const old = oldCall(() => ({ label: OLD_TARGETS.compact(expected, now), status: OLD_TARGETS.status(expected, now) }));
          const c = countdown(mine, now);
          assert.equal(c.label, old.label);
          assert.equal(c.status, old.status);
        }
        cases += 1;
        if (i === 2) stores[course] = storage;
      });
    }
    // Overall, with one combined storage holding all three courses' saved state.
    const combined = memoryStorage(Object.fromEntries(Object.values(stores).flatMap((s) => [...s.data])));
    const expected = oldCall(() =>
      OLD_TARGETS.overall(
        ['cen100', 'mth140', 'mth141'].map((course) => oldTarget(course, combined, now)),
        now,
      ),
    );
    const mine = nextDeadline({ now, storage: combined });
    assert.deepEqual(mine ? [mine.courseId, mine.id] : null, expected ? [expected.course, expected.id] : null, new Date(now).toISOString());
  }
  assert.ok(cases > 3000, `${cases} cases`);
});

test('every deadline item carries the old resolver’s target for its id, with the old countdown wording', () => {
  let cases = 0;
  for (const now of clocks.filter((_, i) => i % 5 === 0)) {
    for (const course of ['cen100', 'mth140', 'mth141']) {
      const storage = storeFor(course, course === 'cen100' ? CEN_STATES[3] : mathStates(course)[3]);
      for (const item of deadlines(course, { now, storage })) {
        if (item.id.startsWith('item:')) continue;
        const expected = oldTarget(course, storage, now, item.id);
        assert.deepEqual(item.target, expected, `${course} ${item.id}`);
        assert.equal(countdown(item, now).label, oldCall(() => OLD_TARGETS.compact(expected, now)));
        cases += 1;
      }
    }
  }
  assert.ok(cases > 500, `${cases} cases`);
});

test('deadlines are sorted by due time and flag done and overdue items', () => {
  const storage = cenStore({ section: 29, group: 9 }, { intro: 1, integrity: 1 });
  const now = toronto('2026-10-15', '09:00');
  const items = deadlines('cen100', { now, storage });
  assert.equal(items.length, 22 + 2 + 2, '22 dated rows + the Section 29 lab reminder and the showcase reminder + 2 undated items');
  const keys = items.map((item) => item.sortKey);
  assert.deepEqual(keys, [...keys].sort((a, b) => a - b));
  const byId = Object.fromEntries(items.map((item) => [item.id, item]));
  assert.equal(byId.intro.done, true);
  assert.equal(byId.intro.overdue, false);
  assert.equal(byId.entry.overdue, true);
  assert.equal(byId.integrity.done, true);
  assert.equal(byId.whmis.overdue, true, 'Oct 14 passed at Toronto midnight');
  assert.equal(byId.failure.overdue, false);
  assert.equal(byId['failure-lab'].kind, 'reminder');
  assert.equal(byId['failure-lab'].markable, false);
  assert.deepEqual(
    items.slice(-2).map((item) => item.id),
    ['item:y7', 'item:y9'],
  );
  assert.equal(byId['item:y7'].timeLabel, 'Section 29: Wednesday, 5:45 to 6:00 PM');
  assert.equal(deadlines('cen100', { now, section: 5, storage }).some((item) => item.id === 'failure-lab'), false, 'reminder only for Section 29');
  assert.equal(deadlines('mth141', { now, storage: null }).length, 7);
});

test('buckets split by Toronto week, Monday to Sunday', () => {
  const now = toronto('2026-10-15', '12:00');
  const items = deadlines('cen100', { now, section: 29, storage: null });
  const b = buckets(items, now);
  assert.deepEqual(
    b.thisWeek.map((item) => item.id),
    ['integrity', 'failure-lab', 'whmis'],
  );
  assert.deepEqual(
    b.nextWeek.map((item) => item.id),
    ['failure'],
  );
  assert.ok(b.later.some((item) => item.id === 'item:y9'));
  assert.ok(b.earlier.some((item) => item.id === 'intro'));
  assert.equal(b.thisWeek.length + b.nextWeek.length + b.later.length + b.earlier.length, items.length);
  // Sunday 11:59 PM is still this week; Monday 00:00 starts the next.
  const sunday = buckets(items, toronto('2026-10-18', '23:59'));
  assert.ok(sunday.thisWeek.some((item) => item.id === 'whmis'));
  const monday = buckets(items, toronto('2026-10-19', '00:00'));
  assert.ok(monday.thisWeek.some((item) => item.id === 'failure'));
  // A math quiz week buckets by its Monday.
  const quiz = buckets(deadlines('mth140', { now, storage: null }), now);
  assert.ok(quiz.thisWeek.some((item) => item.id === 'quiz-2'));
});

test('the weekly checklist lists this week’s items with their steps, grouping one CEN item’s rows', () => {
  const now = toronto('2026-09-14', '12:00');
  const list = weeklyChecklist('cen100', { now, storage: null });
  assert.equal(list.week.label, 'Week 2 · Sep 14–20');
  assert.equal(list.upcoming, false);
  const sept = list.find((entry) => entry.item === 'y1');
  assert.equal(sept.title, 'September items');
  assert.deepEqual(
    sept.records.map((r) => r.id),
    ['entry', 'intro', 'syllabus'],
  );
  assert.deepEqual(
    sept.steps.map((s) => s.id),
    ['y1-0-0', 'y1-0-1', 'y1-0-2', 'y1-0-3'],
  );
  // A week with nothing due shows the next week that has work.
  const empty = weeklyChecklist('mth140', { now: toronto('2026-10-26', '12:00'), section: 31, storage: null });
  assert.equal(empty.upcoming, true);
  assert.equal(empty.week.label, 'Week 10 · Nov 9–15');
  assert.deepEqual(
    empty.map((entry) => [entry.itemId, entry.steps.length]),
    [['quiz-3', 5]],
  );
});

test('the Desk snapshot is the old deskSummary(), course by course', () => {
  const combined = (i) =>
    memoryStorage(
      Object.fromEntries(
        ['cen100', 'mth140', 'mth141'].flatMap((course) => [...storeFor(course, course === 'cen100' ? CEN_STATES[i % CEN_STATES.length] : mathStates(course)[i % 6]).data]),
      ),
    );
  let cases = 0;
  for (const [n, now] of clocks.filter((_, i) => i % 3 === 0).entries()) {
    const storage = combined(n);
    const old = oldCall(() => OLD_DESK.deskSummary({ now, storage }));
    const mine = deskSnapshot({ now, storage });
    assert.deepEqual(
      mine.map((entry) => entry.course.id),
      ['cen100', 'mth140', 'mth141'],
    );
    for (const entry of mine) {
      const expected = old[entry.course.id];
      assert.deepEqual(entry.progress, expected.progress);
      assert.deepEqual(entry.target, expected.next);
      assert.equal(entry.urgency, expected.urgency);
      assert.equal(entry.section, expected.section);
      assert.equal(entry.isOverall, expected.isOverall);
      assert.deepEqual(entry.kinds, expected.kinds);
      assert.equal(entry.next ? entry.next.id : null, expected.next.precision === 'empty' ? null : expected.next.id);
      cases += 1;
    }
  }
  assert.ok(cases > 200);
});
