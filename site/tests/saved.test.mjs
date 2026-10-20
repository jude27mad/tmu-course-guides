import test from 'node:test';
import assert from 'node:assert/strict';

import {
  isMath,
  readTicks,
  writeTicks,
  readPlan,
  writePlan,
  readProfile,
  writeProfile,
  readMath,
  writeMath,
  readMathSection,
  writeMathSection,
  readCompletedMap,
  readSectionNumber,
  readMotionPaused,
  writeMotionPaused
} from '../src/lib/saved.mjs';
import { memoryStorage } from './helpers.mjs';

test('isMath', () => {
  assert.equal(isMath('mth140'), true);
  assert.equal(isMath('mth141'), true);
  assert.equal(isMath('cen100'), false);
});

test('readTicks and writeTicks', () => {
  const storage = memoryStorage();
  assert.deepEqual(readTicks(storage), {});

  assert.equal(writeTicks(storage, { 'm2-1-3': 1 }), true);
  assert.equal(storage.data.get('cen100-g9-ticks'), '{"m2-1-3":1}');
  assert.deepEqual(readTicks(storage), { 'm2-1-3': 1 });

  storage.data.set('cen100-g9-ticks', '{oops');
  assert.deepEqual(readTicks(storage), {});

  storage.data.set('cen100-g9-ticks', '[1, 2]');
  assert.deepEqual(readTicks(storage), {});

  storage.data.set('cen100-g9-ticks', 'null');
  assert.deepEqual(readTicks(storage), {});
});

test('readPlan and writePlan', () => {
  const storage = memoryStorage();
  assert.deepEqual(readPlan(storage), { completed: {}, notes: {}, targets: {} });

  const plan = { completed: {}, notes: {}, targets: {} };
  assert.equal(writePlan(storage, plan), true);
  assert.deepEqual(readPlan(storage), plan);

  storage.data.set('cen100-personal-plan-v1', '{"completed":{"integrity":1,"bogus":1},"notes":{},"targets":{}}');
  assert.deepEqual(readPlan(storage), { completed: { integrity: 1 }, notes: {}, targets: {} });
});

test('readProfile and writeProfile', () => {
  const storage = memoryStorage();
  assert.equal(readProfile(storage), null);

  assert.equal(writeProfile(storage, { section: 29, group: 9 }), true);
  assert.deepEqual(readProfile(storage), { section: 29, group: 9 });

  assert.equal(writeProfile(storage, { section: 29 }), true);
  assert.deepEqual(readProfile(storage), { section: 29, group: null });

  storage.data.set('cen100-contact-choice-v1', '{"section":"29","group":"9"}');
  assert.deepEqual(readProfile(storage), { section: 29, group: 9 });
});

test('readMath and writeMath', () => {
  const storage = memoryStorage();
  assert.deepEqual(readMath('mth140', storage), { checks: {}, completed: {}, notes: {}, targets: {}, topics: {} });

  const progress = { checks: { 'quiz-1-0': true }, completed: { 'quiz-1': true }, notes: {}, targets: {}, topics: {} };
  assert.equal(writeMath('mth140', storage, progress), true);
  assert.deepEqual(readMath('mth140', storage), progress);

  storage.data.set('mth140-progress-v1', '{"completed":{"quiz-1":1},"checks":{"bogus":true,"quiz-1-0":true}}');
  assert.deepEqual(readMath('mth140', storage), progress);
});

test('readMathSection and writeMathSection', () => {
  const storage = memoryStorage();
  assert.equal(readMathSection('mth140', storage), 0);

  assert.equal(writeMathSection('mth140', storage, 31), true);
  assert.equal(readMathSection('mth140', storage), 31);

  // A saved section with no MTH140 lab reads as no section.
  storage.data.set('mth140-section-v1', '999');
  assert.equal(readMathSection('mth140', storage), 0);

  storage.data.set('mth140-section-v1', '"31"');
  assert.equal(readMathSection('mth140', storage), 31);
});

test('readCompletedMap', () => {
  const storage = memoryStorage();
  writePlan(storage, { completed: { integrity: 1 }, notes: {}, targets: {} });
  writeMath('mth140', storage, { checks: {}, completed: { 'quiz-1': true }, notes: {}, targets: {}, topics: {} });

  assert.deepEqual(readCompletedMap('cen100', storage), { integrity: 1 });
  assert.deepEqual(readCompletedMap('mth140', storage), { 'quiz-1': true });
});

test('readSectionNumber', () => {
  const storage = memoryStorage();
  writeProfile(storage, { section: 29, group: 9 });
  writeMathSection('mth140', storage, 31);

  assert.equal(readSectionNumber('cen100', storage), 29);
  assert.equal(readSectionNumber('mth140', storage), 31);
});

test('readMotionPaused and writeMotionPaused', () => {
  const storage = memoryStorage();
  assert.equal(readMotionPaused(storage), false);

  assert.equal(writeMotionPaused(storage, true), true);
  assert.equal(readMotionPaused(storage), true);

  assert.equal(writeMotionPaused(storage, false), true);
  assert.equal(readMotionPaused(storage), false);
});

test('readers never write to storage', () => {
  const storage = memoryStorage({
    'cen100-g9-ticks': '{oops',
    'cen100-personal-plan-v1': '{"completed":{"integrity":1,"bogus":1},"notes":{},"targets":{}}',
    'cen100-contact-choice-v1': '{"section":"29","group":"9"}',
    'mth140-progress-v1': '{"completed":{"quiz-1":1},"checks":{"bogus":true}}',
    'mth140-section-v1': '999',
  });
  readTicks(storage);
  readPlan(storage);
  readProfile(storage);
  readMath('mth140', storage);
  readMathSection('mth140', storage);
  readCompletedMap('cen100', storage);
  readCompletedMap('mth140', storage);
  readSectionNumber('cen100', storage);
  readSectionNumber('mth140', storage);
  readMotionPaused(storage);
  assert.deepEqual(storage.writes(), []);
});
