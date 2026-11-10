/* CHY102 and PCS211: the guides written from the Fall 2026 outlines. Pins every published date and weight to the
   outlines, the week-window wording (never a timer or a lab-section prompt), the grading schemes and options, and
   the saved formats (math-guide formats, no section key). */
import assert from 'node:assert/strict';
import test from 'node:test';
import { timestamp } from '../src/lib/vendor/schedule.mjs';
import { overall } from '../src/lib/vendor/night/targets.mjs';
import {
  deadlines,
  nextDeadline,
  countdown,
  assessments,
  gradePlan,
  gradeStanding,
  gradeRequirements,
  readGrades,
  writeGrades,
  calendarFile,
  exportBackup,
  importBackup,
  createProgress,
  courseInfo,
  sections,
  setSection,
  getSection,
  calendarEvents,
  weeklyChecklist,
} from '../src/lib/index.js';
import { informationEntries } from '../src/lib/information.mjs';
import { memoryStorage } from './helpers.mjs';

const toronto = (date, time) => timestamp(date, time);
const NOV10 = toronto('2026-11-10', '10:00');
const byId = (courseId, now = NOV10) => Object.fromEntries(deadlines(courseId, { now, storage: null }).map((item) => [item.id, item]));

test('CHY102: homework due Mondays at 11:59 PM, midterms at 6:30–8:30 PM, as the outline lists them', () => {
  const items = byId('chy102');
  const homework = {
    'hw-1': '2026-09-21',
    'hw-2': '2026-09-28',
    'hw-3': '2026-10-05',
    'hw-4': '2026-10-12',
    'hw-5': '2026-10-19',
    'hw-6': '2026-10-26',
    'hw-7': '2026-11-02',
    'hw-8': '2026-11-09',
    'hw-9': '2026-11-23',
    'hw-10': '2026-11-30',
    'hw-11': '2026-12-07',
  };
  for (const [id, date] of Object.entries(homework)) {
    assert.equal(items[id].precision, 'exact', id);
    assert.equal(+items[id].due, toronto(date, '23:59'), id);
    assert.equal(items[id].label, 'Due', id);
    assert.match(items[id].timeLabel, /^due 11:59 PM Toronto time$/, id);
  }
  for (const [id, date] of [
    ['midterm-1', '2026-10-09'],
    ['midterm-2', '2026-11-13'],
  ]) {
    assert.equal(+items[id].due, toronto(date, '18:30'), id);
    assert.equal(items[id].target.end, toronto(date, '20:30'), id);
    assert.equal(items[id].label, 'Test starts', id);
  }
  assert.equal(items['hw-12'].precision, 'pending');
  assert.equal(countdown(items['hw-12'], NOV10).label, 'No date');
  assert.equal(items.final.precision, 'pending');
  assert.equal(countdown(items.final, NOV10).label, 'Date pending');
});

test('windows: the published span, no timer, no lab-section prompt', () => {
  const chy = byId('chy102', toronto('2026-11-25', '09:00'));
  assert.equal(chy['wrapper-2'].precision, 'week');
  assert.equal(chy['wrapper-2'].due, null);
  assert.equal(chy['wrapper-2'].dateLabel, 'Nov 24–30');
  assert.equal(countdown(chy['wrapper-2'], toronto('2026-11-25', '09:00')).label, 'Due this week');
  const pcs = byId('pcs211');
  const windows = [
    ['2026-09-14', '2026-09-25'],
    ['2026-09-28', '2026-10-09'],
    ['2026-10-12', '2026-10-23'],
    ['2026-10-26', '2026-11-06'],
    ['2026-11-09', '2026-11-20'],
  ];
  windows.forEach(([start, end], i) => {
    for (const id of [`lab-${i + 1}`, `tutorial-${i + 1}`]) {
      assert.equal(pcs[id].target.windowStart, start, id);
      assert.equal(pcs[id].target.weekEnd, end, id);
      assert.equal(pcs[id].cta, null, id);
    }
  });
  assert.equal(countdown(pcs['lab-5'], NOV10).label, 'Lab weeks');
  assert.equal(countdown(pcs['tutorial-5'], NOV10).label, 'Tutorial weeks');
  assert.equal(countdown(pcs['lab-4'], NOV10).label, 'Window passed');
  assert.notEqual(countdown(pcs['lab-5'], NOV10).status, 'Select lab section');
  const event = calendarEvents('pcs211', [pcs['lab-5']])[0];
  assert.deepEqual([event.start, event.end, event.allDay, event.style], ['2026-11-09', '2026-11-20', true, 'week']);
  // A window belongs to both of its weeks in the weekly checklist.
  for (const day of ['2026-11-10', '2026-11-17'])
    assert.ok(
      weeklyChecklist('pcs211', { now: toronto(day, '10:00'), storage: null }).some((entry) => entry.itemId === 'lab-5'),
      day,
    );
});

test('PCS211: the midterm is Friday October 30 at 6 PM for 2 hours', () => {
  const { midterm } = byId('pcs211');
  assert.equal(+midterm.due, toronto('2026-10-30', '18:00'));
  assert.equal(midterm.target.end, toronto('2026-10-30', '20:00'));
  assert.equal(midterm.weight, 25);
});

test('a window never hides a dated deadline: it ranks by its last day', () => {
  // Nov 10: PCS211 Lab 5's window (Nov 9–20) is open; CHY102 Midterm 2 is on Friday Nov 13. The midterm leads.
  const chy = nextDeadline({ now: NOV10, courseId: 'chy102', storage: null });
  const pcs = nextDeadline({ now: NOV10, courseId: 'pcs211', storage: null });
  assert.equal(chy.id, 'midterm-2');
  assert.equal(pcs.id, 'lab-5');
  assert.equal(overall([pcs.target, chy.target], NOV10), chy.target);
  // Lists still show the window from its first day.
  assert.ok(pcs.sortKey < chy.sortKey);
});

test('no section picker: no sections, nothing saved, every date the same', () => {
  for (const id of ['chy102', 'pcs211']) {
    const storage = memoryStorage();
    assert.deepEqual(sections(id), []);
    assert.equal(setSection(id, 11, storage), false);
    assert.equal(getSection(id, storage), null);
    assert.equal(storage.data.size, 0);
  }
  const info = courseInfo('chy102');
  assert.deepEqual(info.section.overview, [
    'Section 11 · Thu 2:00–3:00 PM · Fri 8:00–10:00 AM · TRS1067',
    'Section 21 · Mon 4:00–5:00 PM · Thu 8:00–10:00 AM · TRS1067',
    'Section 31 · Tue 2:00–4:00 PM · Fri 1:00–2:00 PM · TRS1067',
  ]);
  assert.ok(info.contacts.section.some((row) => row.href === 'mailto:alena.celsie@torontomu.ca'));
});

test('grading: every scheme and option totals 100%, as in Course info', () => {
  const chy = assessments('chy102');
  assert.deepEqual(
    chy.variants.map((v) => v.categories.map((c) => c.weight)),
    [
      [10, 5, 5, 22.5, 22.5, 35],
      [10, 5, 25, 25, 35],
    ],
  );
  for (const variant of ['scheme-1', 'scheme-2']) assert.equal(gradePlan('chy102', { variant }).total, 100, variant);
  const pcs = assessments('pcs211');
  assert.deepEqual(
    pcs.variants.map((v) => v.categories.map((c) => c.weight)),
    [
      [10, 20, 5, 25, 40],
      [10, 20, 25, 45],
    ],
  );
  for (const variant of ['option-1', 'option-2']) assert.equal(gradePlan('pcs211', { variant }).total, 100, variant);
});

test('CHY102: best 10 of 11 homework; the chosen scheme is saved', () => {
  const plan = gradePlan('chy102');
  const marks = Object.fromEntries(Array.from({ length: 11 }, (_, i) => [`hw-${i + 1}`, i === 2 ? 20 : 100]));
  const standing = gradeStanding(plan, marks);
  assert.deepEqual(standing.dropped, ['hw-3']);
  assert.equal(standing.current, 100);
  const storage = memoryStorage();
  assert.deepEqual(readGrades('chy102', storage), { marks: {}, target: null, variant: null });
  assert.equal(writeGrades('chy102', storage, { marks: { 'hw-1': '9/10' }, variant: 'scheme-2' }), true);
  assert.equal(storage.data.get('chy102-grades-v1'), '{"marks":{"hw-1":"9/10"},"target":null,"variant":"scheme-2"}');
  assert.equal(
    gradePlan('chy102', { variant: readGrades('chy102', storage).variant }).groups.some((g) => g.id === 'iclicker'),
    false,
  );
  // A mark for an item only Scheme 1 grades survives the switch.
  writeGrades('chy102', storage, { marks: { iclicker: '4/5' }, variant: 'scheme-2' });
  assert.deepEqual(readGrades('chy102', storage).marks, { iclicker: '4/5' });
});

test('PCS211: the higher option applies, the bonus adds on top, THEORY and LAB are checked', () => {
  const marks = { midterm: 70, 'tutorial-1': 80, 'lab-1': 90, 'webassign-1': 40 };
  const plan = gradePlan('pcs211', { percents: marks });
  assert.equal(plan.variant, 'option-2', 'a low WebAssign mark: Option 2 is higher');
  assert.equal(gradePlan('pcs211', { percents: { ...marks, 'webassign-1': 100 } }).variant, 'option-1');
  const standing = gradeStanding(plan, marks);
  const [theory, lab] = gradeRequirements(plan, standing);
  // (70 × 0.25 + 80 × 0.10) ÷ 0.35, the marked part of the THEORY formula.
  assert.ok(Math.abs(theory.average - (70 * 0.25 + 80 * 0.1) / 0.35) < 1e-9);
  assert.equal(theory.status, 'met');
  assert.equal(lab.average, 90);
  assert.equal(gradeRequirements(plan, gradeStanding(plan, { 'lab-1': 30 }))[1].status, 'below');
  const bonus = gradeStanding(plan, { ...marks, classquestion: 100 });
  assert.ok(bonus.secured - standing.secured > 1.99 && bonus.secured - standing.secured < 2.01);
  assert.equal(bonus.remaining, standing.remaining, 'the bonus is never "still to be marked"');
  assert.ok(gradeStanding(plan, Object.fromEntries(plan.items.map((item) => [item.id, 100]))).maximum <= 100);
});

test('calendar files: timed work at Toronto time, windows as tentative all-day events, nothing undated', () => {
  const chy = calendarFile('chy102', { now: toronto('2026-09-01', '12:00'), upcomingOnly: true, storage: null });
  assert.equal(chy.ok, true);
  assert.equal(chy.name, 'chy102-fall-2026.ics');
  assert.equal(chy.count, 17);
  assert.match(chy.text, /UID:chy102-hw-1-all-f26@jude27mad\.github\.io/);
  assert.match(chy.text, /DTSTART:20260922T035900Z/);
  const pcs = calendarFile('pcs211', { now: toronto('2026-11-10', '12:00'), storage: null });
  assert.equal(pcs.count, 3);
  assert.match(pcs.text, /DTSTART;VALUE=DATE:20261109\r\nDTEND;VALUE=DATE:20261121\r\nSTATUS:TENTATIVE/);
  assert.doesNotMatch(pcs.text, /Final Exam|WebAssign/);
});

test('progress and backups use the math guides’ formats under the new keys', () => {
  const storage = memoryStorage();
  const progress = createProgress(storage, { events: null });
  assert.equal(progress.markDone('pcs211', 'lab-5').saved, true);
  assert.equal(progress.toggleTick('chy102', 'hw-9', 'hw-9-0').checked, true);
  assert.equal(progress.toggleTick('chy102', 'gases', 'gases-0').checked, true);
  assert.deepEqual(JSON.parse(storage.data.get('pcs211-progress-v1')).completed, { 'lab-5': true });
  assert.deepEqual(JSON.parse(storage.data.get('chy102-progress-v1')), { checks: { 'hw-9-0': true }, completed: {}, notes: {}, targets: {}, topics: { 'gases-0': true } });
  const file = exportBackup('chy102', { now: NOV10, storage });
  const other = memoryStorage();
  assert.equal(importBackup('chy102', file.text, { storage: other }).ok, true);
  assert.equal(other.data.get('chy102-progress-v1'), storage.data.get('chy102-progress-v1'));
  assert.equal(importBackup('pcs211', file.text, { storage: other }).ok, false, 'a CHY102 backup is not a PCS211 backup');
});

test('Course info: rules have stable addresses; every card cites the outline', () => {
  for (const id of ['chy102', 'pcs211']) {
    const info = courseInfo(id);
    const entries = informationEntries(id, info);
    const ids = entries.map((entry) => entry.id);
    assert.equal(new Set(ids).size, ids.length, id);
    assert.ok(ids.includes('policy-missed-assessment'), id);
    for (const card of info.rules) assert.match(card.blocks.at(-1).text, /^Source: (CHY|PCS) [12]\d\d Course Outline/, `${id} ${card.id}`);
    for (const a of info.assessments) {
      assert.ok(a.checklist.length > 0 && a.rules.length > 0 && a.source, `${id} ${a.id}`);
      assert.match(a.source, /Course (Outline|Information & Outline), Fall 2026/, `${id} ${a.id}`);
    }
    assert.ok(info.topics.length >= 14, id);
  }
});
