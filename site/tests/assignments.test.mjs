import test from 'node:test';
import assert from 'node:assert/strict';

import * as lib from '../src/lib/index.js';
import { memoryStorage, toronto } from './helpers.mjs';

const NOW = toronto('2026-10-12', '12:00');
const GROUPS = ['pastDue', 'thisWeek', 'nextWeek', 'later', 'done'];
const COUNTS = { cen100: 17, mth140: 6, mth141: 7 };
const sorted = (values) => [...values].sort();
const entry = (list, id) => list.entries.find((item) => item.id === id);
const event = (events, rowId) => events.find((item) => item.rowId === rowId);
const cards = (courseId) => {
  const info = lib.courseInfo(courseId);
  return courseId === 'cen100' ? info.items : info.assessments;
};

/* Saved values use the existing guide formats; constructing fixtures never writes storage. */
function saved(courseId, { section = 0, completed = {} } = {}) {
  return memoryStorage(courseId === 'cen100' ? {
    'cen100-contact-choice-v1': JSON.stringify(section ? { section, group: null } : null),
    'cen100-personal-plan-v1': JSON.stringify({ completed, notes: {}, targets: {} }),
  } : {
    [`${courseId}-section-v1`]: JSON.stringify(section),
    [`${courseId}-progress-v1`]: JSON.stringify({ checks: {}, completed, notes: {}, targets: {}, topics: {} }),
  });
}

const rowsFor = (courseId, { now = NOW, ...state } = {}) => lib.deadlines(courseId, { now, storage: saved(courseId, state) });

function withStorage(storage, run) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
  try {
    return run();
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
    else delete globalThis.localStorage;
  }
}

function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

test('every content card appears once, with its canonical anchor, across fixed clocks and saved states', () => {
  const clocks = [
    toronto('2026-09-14', '12:00'),
    NOW,
    toronto('2026-11-04', '15:01'),
    toronto('2026-12-03', '12:00'),
  ];
  for (const [courseId, count] of Object.entries(COUNTS)) {
    const content = cards(courseId);
    const allDone = Object.fromEntries(rowsFor(courseId).filter((row) => row.markable).map((row) => [row.id, 1]));
    const someDone = courseId === 'cen100' ? { 'notebook-1': 1, failure: 1, entry: 1 } : { 'quiz-1': true, midterm: true };
    for (const now of clocks) {
      for (const state of [{}, { section: courseId === 'cen100' ? 29 : 3, completed: someDone }, { completed: allDone }]) {
        const items = rowsFor(courseId, { now, ...state });
        const list = lib.assignmentList(courseId, { now, items });
        const grouped = GROUPS.flatMap((group) => list[group]);
        const label = `${courseId}, ${new Date(now).toISOString()}, ${JSON.stringify(state)}`;
        assert.equal(list.entries.length, count, label);
        assert.equal(grouped.length, count, label);
        assert.equal(new Set(grouped.map((item) => item.id)).size, count, label);
        assert.deepEqual(sorted(grouped.map((item) => item.id)), sorted(content.map((item) => item.id)), label);
        assert.deepEqual(sorted(list.entries.map((item) => item.id)), sorted(content.map((item) => item.id)), label);
        assert.equal(new Set(list.entries.map((item) => item.anchor)).size, count, label);
        assert.deepEqual(sorted(list.entries.map((item) => item.anchor)), sorted(content.map((item) => item.anchor)), label);
        for (const item of list.entries) {
          const card = content.find((candidate) => candidate.id === item.id);
          const own = items.filter((row) => (courseId === 'cen100' ? row.item : row.id) === item.id);
          const records = own.filter((row) => row.markable === true);
          const group = GROUPS.find((name) => list[name].some((candidate) => candidate.id === item.id));
          assert.equal(item.courseId, courseId, label);
          assert.equal(item.anchor, card.anchor, label);
          assert.equal(item.title, courseId === 'cen100' ? card.name : card.title, label);
          assert.equal(item.list, courseId === 'cen100' ? card.list : null, label);
          assert.deepEqual(item.rows, own, label);
          assert.deepEqual(item.records, records, label);
          assert.equal(item.recorded, records.filter((row) => row.done).length, label);
          assert.equal(item.done, records.length > 0 && records.every((row) => row.done), label);
          assert.equal(item.pastDue, records.some((row) => row.overdue), label);
          assert.equal(item.group, group, label);
          if (item.done) assert.equal(group, 'done', label);
          else if (item.pastDue) assert.equal(group, 'pastDue', label);
          assert.deepEqual(item.lead, records.find((row) => !row.done) ?? records.at(-1) ?? null, label);
        }
      }
    }
  }
});

test('omitting items uses deadlines with the fixed clock and saved state without writing storage', () => {
  for (const courseId of Object.keys(COUNTS)) {
    const storage = saved(courseId, {
      section: courseId === 'cen100' ? 29 : 3,
      completed: courseId === 'cen100' ? { failure: 1, 'notebook-1': 1 } : { 'quiz-1': true },
    });
    withStorage(storage, () => {
      const expected = lib.assignmentList(courseId, { now: NOW, items: lib.deadlines(courseId, { now: NOW, storage }) });
      assert.deepEqual(lib.assignmentList(courseId, { now: NOW }), expected);
    });
    assert.deepEqual(storage.writes(), [], courseId);
  }
});

test('past due wins over this week and every other date group', () => {
  const now = toronto('2026-10-15', '12:00');
  const list = lib.assignmentList('cen100', { now, items: rowsFor('cen100', { now }) });
  assert.equal(entry(list, 'y4').lead.date, '2026-10-14');
  assert.equal(entry(list, 'y4').pastDue, true);
  assert.equal(entry(list, 'y4').group, 'pastDue', 'an earlier date in the current week is still past due');
  assert.equal(entry(list, 'm2').group, 'pastDue', 'a past deadline in an earlier week is retained');
  assert.equal(list.thisWeek.some((item) => item.id === 'y4'), false);
});

test('multi-record items lead with the first unfinished record, then the final record when fully recorded', () => {
  for (const [completed, lead, recorded, done] of [
    [{}, 'notebook-1', 0, false],
    [{ 'notebook-1': 1 }, 'notebook-2', 1, false],
    [{ 'notebook-1': 1, 'notebook-2': 1 }, 'notebook-2', 2, true],
  ]) {
    const list = lib.assignmentList('cen100', { now: NOW, items: rowsFor('cen100', { completed }) });
    const notebook = entry(list, 'y6');
    assert.equal(notebook.lead.id, lead);
    assert.equal(notebook.recorded, recorded);
    assert.equal(notebook.done, done);
    assert.deepEqual(notebook.records.map((row) => row.id), ['notebook-1', 'notebook-2']);
  }
  const list = lib.assignmentList('cen100', { now: NOW, items: rowsFor('cen100') });
  assert.deepEqual(entry(list, 'y1').records.map((row) => row.id), ['entry', 'intro', 'syllabus', 'email']);
  assert.equal(entry(list, 'y1').records.length, 4);
});

test('reminders are retained as rows but never lead, count as records, or block done', () => {
  const items = rowsFor('cen100', { section: 29, completed: { failure: 1 } });
  /* Keep a reminder explicitly open: the list must use markable records, independently of reminder retirement. */
  const reminder = items.find((row) => row.id === 'failure-lab');
  reminder.done = false;
  reminder.overdue = true;
  const list = lib.assignmentList('cen100', { now: NOW, items });
  const failure = entry(list, 'm3');
  assert.deepEqual(failure.rows.map((row) => row.id), ['failure-lab', 'failure']);
  assert.deepEqual(failure.records.map((row) => row.id), ['failure']);
  assert.equal(failure.recorded, 1);
  assert.equal(failure.lead.id, 'failure');
  assert.equal(failure.done, true);
  assert.equal(failure.pastDue, false);
  assert.equal(failure.group, 'done');
  assert.equal(entry(list, 'm6').lead.id, 'presentation-1', 'showcase sign-up is also a reminder');
});

test('Toronto Sunday 23:59 and Monday 00:00 put a quiz week in the correct group', () => {
  const sunday = toronto('2026-10-11', '23:59');
  const monday = toronto('2026-10-12', '00:00');
  const before = lib.assignmentList('mth140', { now: sunday, items: rowsFor('mth140', { now: sunday }) });
  const after = lib.assignmentList('mth140', { now: monday, items: rowsFor('mth140', { now: monday }) });
  assert.equal(before.today, '2026-10-11', 'the UTC date is already Monday');
  assert.equal(after.today, '2026-10-12');
  assert.equal(entry(before, 'quiz-2').group, 'nextWeek');
  assert.equal(entry(after, 'quiz-2').group, 'thisWeek');
  assert.equal(before.focus.nextWeek, '2026-10-12');
  assert.equal(after.focus.thisWeek, '2026-10-12');
});

test('focus dates come from dated leads, with today and next Monday for week groups', () => {
  const list = lib.assignmentList('cen100', { now: NOW, items: rowsFor('cen100', { section: 29 }) });
  assert.deepEqual(list.focus, {
    pastDue: '2026-09-16',
    thisWeek: '2026-10-12',
    nextWeek: '2026-10-19',
    later: '2026-10-28',
    done: null,
  });
  assert.equal(entry(list, 'm3').group, 'nextWeek', 'an earlier reminder does not determine focus or group');
  const math = lib.assignmentList('mth140', { now: NOW, items: rowsFor('mth140') });
  assert.equal(math.focus.pastDue, '2026-09-28', 'week-only lead dates are valid focus dates');
  assert.equal(math.focus.later, '2026-11-09');
  assert.equal(entry(math, 'final').group, 'later');
});

test('items without records remain later and undated groups have null focus', () => {
  const list = lib.assignmentList('cen100', { now: NOW, items: [] });
  assert.equal(list.entries.length, 17, 'the content catalog, rather than deadline rows, defines the entries');
  assert.equal(list.later.length, 17);
  for (const item of list.entries) {
    assert.deepEqual(item.rows, []);
    assert.deepEqual(item.records, []);
    assert.equal(item.recorded, 0);
    assert.equal(item.lead, null);
    assert.equal(item.done, false, 'an empty records array is not a completed item');
    assert.equal(item.pastDue, false);
  }
  assert.deepEqual(list.focus, { pastDue: null, thisWeek: null, nextWeek: null, later: null, done: null });
  const onlyPending = rowsFor('mth140').filter((row) => row.precision === 'pending');
  const pending = lib.assignmentList('mth140', { now: NOW, items: onlyPending });
  assert.equal(pending.focus.later, null);
  assert.equal(entry(pending, 'final').group, 'later');
});

test('within a group lead sortKey wins, with content order as the tie breaker', () => {
  const rows = rowsFor('cen100');
  const due = (id, sortKey) => ({ ...rows.find((row) => row.item === id), date: '2026-10-28', sortKey, done: false, overdue: false });
  const list = lib.assignmentList('cen100', { now: NOW, items: [due('m3', 200), due('m2', 100), due('m1', 200)] });
  assert.deepEqual(list.later.filter((item) => item.lead).map((item) => item.id), ['m2', 'm1', 'm3']);
  const mathRow = rowsFor('mth140').find((row) => row.id === 'quiz-2');
  const math = lib.assignmentList('mth140', { now: NOW, items: [{ ...mathRow, item: 'final' }] });
  assert.equal(entry(math, 'quiz-2').records[0].id, 'quiz-2', 'math groups by row.id, rather than row.item');
  assert.deepEqual(entry(math, 'final').records, []);
});

test('end-of-day outline is an Oct 2 point at 23:59 Toronto, not the following midnight', () => {
  const items = rowsFor('cen100');
  const outline = event(lib.calendarEvents('cen100', items), 'outline');
  assert.deepEqual(outline, {
    id: 'cen100:outline', rowId: 'outline', anchor: 'assignment-m2',
    title: items.find((row) => row.id === 'outline').title,
    qualifier: '', style: 'due', allDay: false,
    start: toronto('2026-10-02', '23:59'), end: toronto('2026-10-02', '23:59'),
  });
  assert.equal(new Date(outline.start).toISOString(), '2026-10-03T03:59:00.000Z');
});

test('only endOfDay exact rows lose a minute; ordinary timed points and ranges keep their published times', () => {
  for (const [courseId, section] of [['cen100', 29], ['mth140', 3], ['mth141', 3]]) {
    const rows = rowsFor(courseId, { section });
    const events = lib.calendarEvents(courseId, rows);
    for (const row of rows.filter((item) => item.precision === 'exact')) {
      const result = event(events, row.id);
      const expected = row.target.at - (row.target.endOfDay ? 60000 : 0);
      assert.equal(result.start, expected, `${courseId}:${row.id}`);
      assert.equal(result.end, row.target.endOfDay ? expected : row.target.end ?? expected, `${courseId}:${row.id}`);
      assert.equal(result.allDay, false);
    }
  }
  const report = event(lib.calendarEvents('cen100', rowsFor('cen100')), 'report');
  assert.equal(report.start, toronto('2026-12-02', '23:59'), 'an explicitly posted 23:59 stays 23:59');
});

test('Toronto timed events retain their correct offsets around the Nov 1 clock change', () => {
  for (const now of [toronto('2026-10-31', '12:00'), toronto('2026-11-02', '12:00'), toronto('2026-11-04', '12:00')]) {
    const notebook = event(lib.calendarEvents('cen100', rowsFor('cen100', { now })), 'notebook-1');
    assert.equal(notebook.start, toronto('2026-11-04', '15:00'));
    assert.equal(new Date(notebook.start).toISOString(), '2026-11-04T20:00:00.000Z', '15:00 EST');
  }
  /* The current schedule has no Oct 31 or Nov 2 event: explicit rows cover those two wall-clock cases. */
  const notebook = rowsFor('cen100').find((row) => row.id === 'notebook-1');
  for (const [date, expected] of [['2026-10-31', '2026-10-31T19:00:00.000Z'], ['2026-11-02', '2026-11-02T20:00:00.000Z']]) {
    const at = toronto(date, '15:00');
    const [result] = lib.calendarEvents('cen100', [{ ...notebook, date, target: { ...notebook.target, at } }]);
    assert.equal(new Date(result.start).toISOString(), expected, date);
    assert.equal(result.end, at, date);
  }
});

test('MTH140 Section 3 quiz 2 shows the full make-up lab window and second-hour wording without an invented start', () => {
  const rows = rowsFor('mth140', { section: 3 });
  const events = lib.calendarEvents('mth140', rows);
  const quiz = event(events, 'quiz-2');
  assert.equal(quiz.title, "Lab Quiz 2 · in your lab's second hour");
  assert.match(quiz.qualifier, /second hour/i);
  assert.equal(quiz.style, 'window');
  assert.equal(quiz.allDay, false);
  assert.equal(quiz.start, toronto('2026-10-19', '08:00'));
  assert.equal(quiz.end, toronto('2026-10-19', '10:00'));
  assert.deepEqual(Object.keys(quiz).sort(), ['id', 'rowId', 'anchor', 'title', 'qualifier', 'style', 'allDay', 'start', 'end'].sort());
  assert.equal(events.filter((item) => item.rowId === 'quiz-2').length, 1, 'no extra event at an inferred 09:00');
  assert.equal(event(events, 'quiz-1').style, 'window', 'ordinary lab quizzes are also windows');
  assert.equal(event(events, 'quiz-1').title, 'Lab Quiz 1');
});

test('the MTH140 midterm is a due event running 18:30–20:30 Toronto', () => {
  const midterm = event(lib.calendarEvents('mth140', rowsFor('mth140', { section: 3 })), 'midterm');
  assert.equal(midterm.style, 'due');
  assert.equal(midterm.allDay, false);
  assert.equal(midterm.start, toronto('2026-10-23', '18:30'));
  assert.equal(midterm.end, toronto('2026-10-23', '20:30'));
});

test('day precision stays all-day with no invented time', () => {
  const review = event(lib.calendarEvents('cen100', rowsFor('cen100')), 'review');
  assert.equal(review.style, 'day');
  assert.equal(review.allDay, true);
  assert.equal(review.start, '2026-11-04');
  assert.equal(review.end, '2026-11-04');
  assert.equal(review.qualifier, 'Time not posted');
});

test('without a saved section, every quiz is a Monday–Friday week event with the section qualifier', () => {
  for (const courseId of ['mth140', 'mth141']) {
    const rows = rowsFor(courseId);
    const events = lib.calendarEvents(courseId, rows);
    const quizzes = rows.filter((row) => row.kind === 'quiz');
    assert.equal(events.filter((item) => item.style === 'week').length, quizzes.length);
    for (const quiz of quizzes) {
      const result = event(events, quiz.id);
      assert.equal(result.title, `Quiz week · ${quiz.title}`);
      assert.equal(result.qualifier, 'Date depends on your lab section');
      assert.equal(result.style, 'week');
      assert.equal(result.allDay, true);
      assert.equal(result.start, quiz.week);
      assert.equal(result.end, quiz.target.weekEnd);
      assert.equal(typeof result.start, 'string');
      assert.equal(typeof result.end, 'string');
    }
  }
});

test('an unconfirmed holiday week says its date needs confirmation and keeps week precision', () => {
  /* Current Monday make-ups are confirmed; supply the unresolved state without altering course data. */
  const quiz = rowsFor('mth140').find((row) => row.id === 'quiz-2');
  const [result] = lib.calendarEvents('mth140', [{ ...quiz, target: { ...quiz.target, holiday: true } }]);
  assert.equal(result.qualifier, 'Date needs confirmation');
  assert.equal(result.title, 'Quiz week · Lab Quiz 2');
  assert.equal(result.style, 'week');
  assert.equal(result.allDay, true);
  assert.equal(result.start, '2026-10-12');
  assert.equal(result.end, '2026-10-16');
});

test('pending and empty rows produce no event, even with stale dated fields', () => {
  for (const courseId of Object.keys(COUNTS)) {
    const rows = rowsFor(courseId);
    const events = lib.calendarEvents(courseId, rows);
    assert.equal(events.length, rows.filter((row) => !['pending', 'empty'].includes(row.precision)).length);
    for (const pending of rows.filter((row) => row.precision === 'pending')) {
      assert.equal(event(events, pending.id), undefined);
    }
    const row = rows[0];
    assert.deepEqual(lib.calendarEvents(courseId, [
      { ...row, precision: 'pending', target: { ...row.target, precision: 'pending' } },
      { ...row, id: 'empty-row', precision: 'empty', target: { ...row.target, precision: 'empty' } },
    ]), []);
  }
});

test('section-specific reminders appear only when provided by deadlines, without additional section filtering', () => {
  for (const section of [0, 5, 29]) {
    const rows = rowsFor('cen100', { section });
    const events = lib.calendarEvents('cen100', rows);
    const lab = event(events, 'failure-lab');
    assert.equal(Boolean(lab), section === 29, `Section ${section}`);
    if (lab) {
      assert.equal(lab.style, 'reminder');
      assert.equal(lab.anchor, 'assignment-m3');
      assert.equal(lab.allDay, true);
      assert.equal(lab.start, '2026-10-14');
      assert.equal(lab.end, '2026-10-14');
    }
    assert.equal(event(events, 'showcase-signup').style, 'reminder');
  }
  const reminder = rowsFor('cen100', { section: 29 }).filter((row) => row.id === 'failure-lab');
  assert.equal(withStorage(saved('cen100', { section: 5 }), () => lib.calendarEvents('cen100', reminder)).length, 1,
    'the supplied rows determine membership even if saved section differs');
});

test('each dated record gets its own unique event and several events share one assignment anchor', () => {
  const rows = rowsFor('cen100', { section: 29 });
  const events = lib.calendarEvents('cen100', rows);
  assert.equal(new Set(events.map((item) => item.id)).size, events.length);
  for (const result of events) {
    const row = rows.find((candidate) => candidate.id === result.rowId);
    assert.equal(result.id, `cen100:${row.id}`);
    assert.equal(result.anchor, row.anchor);
    assert.equal(typeof result.title, 'string');
    assert.equal(typeof result.qualifier, 'string');
  }
  assert.deepEqual(sorted(events.filter((item) => item.anchor === 'assignment-y6').map((item) => item.rowId)), ['notebook-1', 'notebook-2']);
  assert.equal(events.filter((item) => item.anchor === 'assignment-y1').length, 4);
  assert.equal(events.filter((item) => item.anchor === 'assignment-m3').length, 2, 'the reminder and record both link to m3');
});

test('done style overrides due, day, week, lab-window and reminder styles without changing dates', () => {
  for (const [courseId, section] of [['cen100', 29], ['mth140', 0], ['mth140', 3]]) {
    const rows = rowsFor(courseId, { section });
    const open = lib.calendarEvents(courseId, rows);
    const done = lib.calendarEvents(courseId, rows.map((row) => ({ ...row, done: true })));
    assert.equal(done.length, open.length);
    for (const result of done) {
      const original = event(open, result.rowId);
      assert.equal(result.style, 'done', `${courseId}:${result.rowId}`);
      assert.deepEqual({ ...result, style: original.style }, original);
    }
  }
  const rows = rowsFor('cen100', { section: 29, completed: { failure: 1, 'notebook-1': 1 } });
  const events = lib.calendarEvents('cen100', rows);
  assert.equal(event(events, 'notebook-1').style, 'done');
  assert.equal(event(events, 'notebook-2').style, 'due');
  assert.equal(event(events, 'failure-lab').style, 'done', 'a retired reminder is also done');
});

test('both functions preserve frozen supplied rows and perform no storage access or writes', () => {
  for (const courseId of Object.keys(COUNTS)) {
    const items = rowsFor(courseId, { section: courseId === 'cen100' ? 29 : 3 });
    const before = structuredClone(items);
    freeze(items);
    const storage = memoryStorage();
    withStorage(storage, () => {
      lib.assignmentList(courseId, { now: NOW, items });
      lib.calendarEvents(courseId, items);
    });
    assert.deepEqual(items, before, courseId);
    assert.deepEqual(storage.calls, [], 'supplied rows make both computations independent of saved state');
  }
});
