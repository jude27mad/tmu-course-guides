import test from 'node:test';
import assert from 'node:assert/strict';

import { assessments, courseInfo, searchEntries, searchIndex, STORAGE_KEYS } from '../src/lib/index.js';
import {
  GRADE_KEYS,
  GRADE_SCALE,
  QUIZ_DROP,
  gradesSavable,
  ceilTenth,
  floorTenth,
  formatPercent,
  gradeNeeded,
  gradePlan,
  gradeStanding,
  joinMark,
  letterFor,
  roundGrade,
  parseMark,
  percentsFrom,
  readGrades,
  splitMark,
  subscribeGrades,
  writeGrades,
} from '../src/lib/grades.mjs';
import { deniedStorage, memoryStorage } from './helpers.mjs';

const COURSES = ['cen100', 'mth140', 'mth141'];
const close = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-6, `${message ?? ''} ${actual} ≠ ${expected}`);

test('every course plan uses the guide’s own weights and totals 100%', () => {
  for (const id of COURSES) {
    const plan = gradePlan(id);
    assert.equal(plan.total, 100, id);
    assert.equal(plan.total, assessments(id).totalWeight, id);
    const ids = plan.items.map((item) => item.id);
    assert.equal(new Set(ids).size, ids.length, `${id}: unique item ids`);
    // Course points with every item at 100 equal the whole course.
    const full = Object.fromEntries(ids.map((key) => [key, 100]));
    close(gradeStanding(plan, full).secured, 100, id);
  }
  const cen = gradePlan('cen100');
  assert.equal(cen.items.length, 20);
  assert.deepEqual(
    cen.groups.map((group) => [group.id, group.weight]),
    [
      ['orientation', 12],
      ['participation', 5],
      ['coursework', 18],
      ['project', 41],
      ['exam', 24],
    ],
  );
  assert.equal(cen.items.find((item) => item.id === 'y2').title, 'MATLAB Assignments (normally pairs)');
  assert.equal(cen.items.find((item) => item.id === 'y2').parts, 2);
  // Every CEN anchor opens a real assignment.
  const anchors = new Set(courseInfo('cen100').items.map((item) => item.anchor));
  for (const item of cen.items) assert.ok(anchors.has(item.anchor), item.id);
});

test('math lab quizzes follow each course’s drop-lowest policy', () => {
  for (const id of ['mth140', 'mth141']) {
    const plan = gradePlan(id);
    const quizzes = plan.groups[0];
    const policy = assessments(id).quizPolicy;
    assert.match(policy, /lowest quiz is dropped/i, id);
    assert.equal(quizzes.drop, QUIZ_DROP[id]);
    assert.equal(quizzes.keep, quizzes.items.length - 1);
    assert.equal(quizzes.weight, assessments(id).categories[0].weight);
    for (const item of quizzes.items) close(item.weight, quizzes.weight / quizzes.keep, item.id);
  }
  assert.equal(gradePlan('mth140').groups[0].items.length, 4);
  assert.equal(gradePlan('mth141').groups[0].items.length, 5);
  assert.deepEqual(
    gradePlan('mth141').groups.map((group) => group.weight),
    [20, 35, 45],
  );
});

test('letters use the TMU undergraduate scale; display rounding never overstates', () => {
  assert.equal(GRADE_SCALE.length, 13);
  assert.equal(letterFor(100).letter, 'A+');
  assert.equal(letterFor(90).letter, 'A+');
  // TMU rounds the final percentage to a whole number, half up, before the letter.
  assert.equal(letterFor(89.49).letter, 'A');
  assert.equal(letterFor(89.5).letter, 'A+');
  assert.equal(letterFor(80).letter, 'A-');
  assert.equal(letterFor(79.5).letter, 'A-');
  assert.equal(letterFor(79.49).letter, 'B+');
  assert.equal(letterFor(50).letter, 'D-');
  assert.equal(letterFor(49.5).letter, 'D-');
  assert.equal(letterFor(49.4).letter, 'F');
  assert.equal(roundGrade(49.5), 50);
  assert.equal(roundGrade(49.4), 49);
  assert.equal(roundGrade((0.1 + 0.2) * 265), 80, 'float noise at .5 still rounds up');
  // A shown value (rounded down to 0.1) always carries the same letter as the exact value.
  for (let x = 40; x <= 100; x += 0.013) assert.equal(letterFor(floorTenth(x)).letter, letterFor(x).letter, `${x}`);
  assert.equal(letterFor(0).letter, 'F');
  assert.equal(letterFor(null), null);
  assert.equal(floorTenth(79.96), 79.9);
  assert.equal(floorTenth(80), 80);
  assert.equal(floorTenth(82.45), 82.4);
  assert.equal(ceilTenth(74.61), 74.7);
  assert.equal(ceilTenth(74.6), 74.6);
  assert.equal(formatPercent(80), '80%');
  assert.equal(formatPercent(82.4), '82.4%');
});

test('marks parse as percentages or scores, with plain errors', () => {
  assert.deepEqual(parseMark('85'), { percent: 85, error: null, field: null });
  assert.deepEqual(parseMark('85%'), { percent: 85, error: null, field: null });
  assert.deepEqual(parseMark('85,5'), { percent: 85.5, error: null, field: null });
  assert.deepEqual(parseMark(''), { percent: null, error: null, field: null });
  assert.deepEqual(parseMark('', '20'), { percent: null, error: null, field: null });
  assert.deepEqual(parseMark('17', '20'), { percent: 85, error: null, field: null });
  assert.deepEqual(parseMark('8.5', '10'), { percent: 85, error: null, field: null });
  assert.deepEqual(parseMark('0', '20'), { percent: 0, error: null, field: null });
  assert.equal(parseMark('101').error, 'Over 100%');
  assert.equal(parseMark('21', '20').error, 'More than 20');
  assert.equal(parseMark('5', '0').error, 'Total can’t be 0');
  // The field at fault, for aria-invalid on that field only.
  assert.equal(parseMark('105').field, 'score');
  assert.equal(parseMark('21', '20').field, 'score');
  assert.equal(parseMark('5', '0').field, 'outOf');
  assert.equal(parseMark('5', '2.0.0').field, 'outOf');
  assert.equal(parseMark('8.5.5', '').field, 'score');
  assert.equal(parseMark('abc').error, 'Not a number');
  assert.equal(parseMark('-5').error, 'Not a number');
  assert.equal(parseMark('8.5.5').error, 'Not a number');
  assert.deepEqual(splitMark('17/20'), { score: '17', outOf: '20' });
  assert.deepEqual(splitMark('74.5'), { score: '74.5', outOf: '' });
  assert.equal(joinMark({ score: '17', outOf: '20' }), '17/20');
  assert.equal(joinMark({ score: '74', outOf: '' }), '74');
  assert.deepEqual(percentsFrom({ a: '17/20', b: '', c: 'x', d: '90' }), {
    a: 85,
    d: 90,
  });
});

test('standing: secured points, highest possible grade and current average', () => {
  const plan = gradePlan('mth140');
  const empty = gradeStanding(plan, {});
  assert.equal(empty.current, null);
  close(empty.secured, 0);
  close(empty.maximum, 100);
  assert.equal(empty.marked, 0);
  assert.equal(empty.complete, false);

  // A 70 on the midterm (40%) and 90 on one quiz (5% when kept).
  const some = gradeStanding(plan, { midterm: 70, 'quiz-1': 90 });
  close(some.secured, 28 + 4.5);
  close(some.marked, 45);
  close(some.current, (32.5 / 45) * 100);
  // Highest: the other three quizzes at 100 drop the 90; the final at 100.
  close(some.maximum, 15 + 28 + 45);
  assert.deepEqual(some.dropped, []);

  // Without drop-lowest effects, keeping the average gives the average.
  close(some.projected, some.current);
  close(some.remaining, 60, 'three quizzes to come fill all 15%, and the final');
  close(empty.remaining, 100);

  // A 0 on Lab Quiz 1 counts now, but keeping an 88 average drops it: 13.2 + 39.6 + 39.6 = 92.4.
  const low = gradeStanding(plan, { 'quiz-1': 0, midterm: 99 });
  close(low.current, 88);
  close(low.projected, 92.4);
  close(low.remaining, 60, 'the quizzes (the 0 can still be replaced) and the final');
  close(gradeStanding(plan, { 'quiz-1': 85, 'quiz-2': 72, 'quiz-3': 90 }).remaining, 90, 'one quiz (5%), the midterm and the final');

  // All four quizzes: the lowest is dropped, ties drop the earliest.
  const quizzes = gradeStanding(plan, {
    'quiz-1': 60,
    'quiz-2': 80,
    'quiz-3': 60,
    'quiz-4': 100,
  });
  assert.deepEqual(quizzes.dropped, ['quiz-1']);
  close(quizzes.secured, ((80 + 60 + 100) / 3) * 0.15);
  close(quizzes.groups[0].average, 80);
  assert.equal(quizzes.groups[0].counted, 3);
});

test('needed: average on the remaining work, secured, unreachable and complete', () => {
  const plan = gradePlan('mth140');
  // Quizzes 80 each (12 points), midterm 70 (28 points): 40 secured, the final (45%) left.
  const percents = {
    'quiz-1': 80,
    'quiz-2': 80,
    'quiz-3': 80,
    'quiz-4': 80,
    midterm: 70,
  };
  const standing = gradeStanding(plan, percents);
  close(standing.secured, 40);
  // A B is 73%; 72.5% rounds up to it.
  const forB = gradeNeeded(plan, percents, 73, standing);
  assert.equal(forB.status, 'reachable');
  assert.equal(forB.average, ceilTenth((32.5 / 45) * 100));
  assert.equal(forB.item.id, 'final');
  assert.equal(gradeNeeded(plan, percents, 40, standing).status, 'secured');
  assert.equal(gradeNeeded(plan, percents, 85, standing).status, 'reachable', '84.5 is reachable with 100 on the final');
  assert.equal(gradeNeeded(plan, percents, 90, standing).status, 'unreachable');
  assert.equal(gradeNeeded(plan, { ...percents, final: 50 }, 80).status, 'complete');

  // The answer really reaches the target, and 0.1 less does not.
  for (const target of [50, 63, 77, 85]) {
    const need = gradeNeeded(plan, percents, target, standing);
    if (need.status !== 'reachable') continue;
    const reached = gradeStanding(plan, {
      ...percents,
      final: need.average,
    }).secured;
    assert.ok(letterFor(reached).min >= target, `${target}: ${reached}`);
    assert.ok(roundGrade(gradeStanding(plan, { ...percents, final: need.average - 0.1 }).secured) < target, `${target}`);
  }
});

test('needed with a quiz still to come accounts for the dropped quiz', () => {
  const plan = gradePlan('mth141');
  // Four quizzes in; quiz 5 and the final left. A 40 on quiz 1 will be dropped if quiz 5 beats it.
  const percents = {
    'quiz-1': 40,
    'quiz-2': 90,
    'quiz-3': 90,
    'quiz-4': 90,
    midterm: 80,
  };
  const need = gradeNeeded(plan, percents, 85);
  assert.equal(need.status, 'reachable');
  assert.equal(need.item, null);
  const at = (x) => gradeStanding(plan, { ...percents, 'quiz-5': x, final: x }).secured;
  assert.ok(roundGrade(at(need.average)) >= 85);
  assert.ok(roundGrade(at(need.average - 0.1)) < 85);
});

test('CEN100: every target can be checked against the 20 weighted items', () => {
  const plan = gradePlan('cen100');
  const percents = Object.fromEntries(plan.items.filter((item) => item.groupId !== 'exam').map((item) => [item.id, 75]));
  const standing = gradeStanding(plan, percents);
  close(standing.marked, 76);
  close(standing.current, 75);
  close(standing.secured, 57);
  const need = gradeNeeded(plan, percents, 80, standing);
  assert.equal(need.item.id, 'item:y9');
  assert.equal(need.average, ceilTenth((22.5 / 24) * 100));
  for (const row of GRADE_SCALE) {
    const result = gradeNeeded(plan, percents, row.min, standing);
    assert.ok(['secured', 'reachable', 'unreachable'].includes(result.status), row.letter);
  }
});

test('saved grades: own keys, cleaned on read, blocked storage never throws', () => {
  for (const id of COURSES) {
    assert.equal(GRADE_KEYS[id], `${id}-grades-v1`);
    assert.ok(!Object.values(STORAGE_KEYS[id]).includes(GRADE_KEYS[id]), 'separate from progress keys');
  }
  const storage = memoryStorage();
  assert.deepEqual(readGrades('mth140', storage), { marks: {}, target: null });
  assert.equal(
    writeGrades('mth140', storage, {
      marks: { 'quiz-1': '17/20', midterm: '', final: '74.5' },
      target: 80,
    }),
    true,
  );
  assert.equal(storage.data.get('mth140-grades-v1'), '{"marks":{"quiz-1":"17/20","final":"74.5"},"target":80}');
  assert.deepEqual(readGrades('mth140', storage), {
    marks: { 'quiz-1': '17/20', final: '74.5' },
    target: 80,
  });

  const messy = memoryStorage({
    'mth141-grades-v1': JSON.stringify({
      marks: {
        'quiz-1': '90',
        'quiz-9': '80',
        midterm: 70,
        final: '<b>',
        'quiz-2': '1/2/3',
        'quiz-3': '8.5.5',
        'quiz-4': '9'.repeat(30),
      },
      target: 81,
    }),
    'cen100-grades-v1': '{not json',
  });
  // A typo stays (shown with its error); markup, extra slashes, numbers and overlong text do not.
  assert.deepEqual(readGrades('mth141', messy), {
    marks: { 'quiz-1': '90', 'quiz-3': '8.5.5' },
    target: null,
  });
  assert.deepEqual(readGrades('cen100', messy), { marks: {}, target: null });
  assert.deepEqual(messy.writes(), [], 'readers never write');

  // Writes keep only known items and typed text; clearing everything removes the key.
  writeGrades('mth140', storage, { marks: { 'quiz-1': '90', unknown: '50', final: '<b>' }, target: 81 });
  assert.equal(storage.data.get('mth140-grades-v1'), '{"marks":{"quiz-1":"90"},"target":null}');
  writeGrades('mth140', storage, { marks: {}, target: null });
  assert.equal(storage.data.has('mth140-grades-v1'), false);
  assert.equal(gradesSavable(storage), true);
  assert.equal(storage.data.size, 0, 'the storage check leaves nothing behind');
  assert.equal(gradesSavable(deniedStorage()), false);
  assert.equal(gradesSavable(null), false);

  const denied = deniedStorage();
  assert.deepEqual(readGrades('cen100', denied), { marks: {}, target: null });
  assert.equal(writeGrades('cen100', denied, { marks: { intro: '90' } }), false);
  // The refused write is kept for this page view.
  assert.deepEqual(readGrades('cen100', denied).marks, { intro: '90' });
});

test('grade changes notify this page and other tabs', () => {
  const storage = memoryStorage();
  const events = new EventTarget();
  const seen = [];
  const off = subscribeGrades('mth140', storage, (detail) => seen.push(detail.source), events);
  writeGrades('mth140', storage, { marks: { midterm: '70' } });
  writeGrades('mth141', storage, { marks: { midterm: '70' } });
  const other = new Event('storage');
  other.key = 'mth140-grades-v1';
  events.dispatchEvent(other);
  const unrelated = new Event('storage');
  unrelated.key = 'mth140-progress-v1';
  events.dispatchEvent(unrelated);
  off();
  writeGrades('mth140', storage, { marks: {} });
  assert.deepEqual(seen, ['local', 'storage']);
});

test('Search finds the calculator without crowding out exam deadlines', () => {
  const now = new Date('2026-10-26T16:00:00Z');
  for (const course of COURSES) {
    const entries = searchIndex({ now, storage: null, course });
    for (const query of ['calculator', 'grades', 'what do i need']) {
      const [first] = searchEntries(entries, query);
      assert.equal(first.href, `/${course}/#grades`, `${course}: ${query}`);
    }
  }
  // "final" on a math page still leads with that course's own Final Exam.
  for (const course of ['mth140', 'mth141']) {
    const [first] = searchEntries(searchIndex({ now, storage: null, course }), 'final');
    assert.equal(first.title, 'Final Exam', course);
    assert.equal(first.courseId, course);
  }
});
