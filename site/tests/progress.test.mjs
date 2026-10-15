import test from 'node:test';
import assert from 'node:assert/strict';

import { createProgress, nextDeadline, deadlines, weeklyChecklist, deskSnapshot, setSection } from '../src/lib/index.js';
import { memoryStorage, storageEvent, toronto } from './helpers.mjs';

const NOON_OCT12 = new Date(toronto('2026-10-12', '12:00'));

test('Mark done records the next deadline and Undo restores the exact previous record', () => {
  const before = '{"completed":{"whmis":1},"notes":{"y4":"n"},"targets":{}}';
  const storage = memoryStorage({ 'cen100-personal-plan-v1': before });
  const progress = createProgress(storage, { events: null });
  const next = nextDeadline({ now: NOON_OCT12, courseId: 'cen100', storage });
  assert.equal(next.id, 'integrity');
  const result = progress.markDone('cen100', next.id);
  assert.equal(result.changed, true);
  assert.equal(result.saved, true);
  assert.equal(result.message, 'Marked done: Academic Integrity Quiz due, 3:00 PM Toronto time. Saved on this device.');
  assert.equal(progress.isDone('cen100', 'integrity'), true);
  assert.equal(progress.canUndo(), true);
  assert.equal(nextDeadline({ now: NOON_OCT12, courseId: 'cen100', storage }).id, 'failure', 'the next deadline moves on');
  assert.deepEqual(progress.undo(), { courseId: 'cen100', itemId: 'integrity', saved: true });
  assert.equal(storage.data.get('cen100-personal-plan-v1'), before);
  assert.equal(progress.isDone('cen100', 'integrity'), false);
  assert.equal(progress.canUndo(), false);
  assert.equal(progress.undo(), null, 'Undo runs once');
  assert.equal(nextDeadline({ now: NOON_OCT12, courseId: 'cen100', storage }).id, 'integrity');
});

test('Mark done is a no-op for done or unknown items; math records use true', () => {
  const storage = memoryStorage();
  const progress = createProgress(storage, { events: null });
  progress.markDone('mth141', 'midterm');
  assert.equal(storage.data.get('mth141-progress-v1'), '{"checks":{},"completed":{"midterm":true},"notes":{},"targets":{},"topics":{}}');
  const writes = storage.writes().length;
  assert.deepEqual(progress.markDone('mth141', 'midterm'), { changed: false, saved: true, message: '' });
  assert.deepEqual(progress.markDone('mth141', 'quiz-9'), { changed: false, saved: false, message: '' });
  assert.deepEqual(progress.markDone('cen100', 'failure-lab'), { changed: false, saved: false, message: '' }, 'reminders cannot be marked done');
  assert.equal(storage.writes().length, writes);
  assert.equal(progress.undo().itemId, 'midterm', 'the earlier Mark done is still the one to undo');
});

test('checklist ticks and completion records stay separate', () => {
  const storage = memoryStorage();
  const progress = createProgress(storage, { events: null });
  const now = new Date(toronto('2026-10-13', '09:00'));
  // Tick every step of this week's Academic Integrity checklist: it is not done.
  const week = weeklyChecklist('cen100', { now, storage });
  const quiz = week.find((entry) => entry.item === 'y4');
  for (const step of quiz.steps) progress.toggleTick('cen100', quiz.itemId, step.id);
  assert.equal(progress.isDone('cen100', 'integrity'), false);
  assert.equal(storage.data.get('cen100-personal-plan-v1'), undefined, 'ticking never writes the plan');
  assert.equal(weeklyChecklist('cen100', { now, storage }).find((entry) => entry.item === 'y4').steps.every((step) => step.checked), true);
  assert.equal(weeklyChecklist('cen100', { now, storage }).find((entry) => entry.item === 'y4').done, false);
  assert.equal(nextDeadline({ now, courseId: 'cen100', storage }).id, 'integrity');
  // Mark done: no tick changes.
  const ticks = storage.data.get('cen100-g9-ticks');
  progress.markDone('cen100', 'integrity');
  assert.equal(storage.data.get('cen100-g9-ticks'), ticks, 'Mark done never ticks');
  assert.equal(weeklyChecklist('cen100', { now, storage }).find((entry) => entry.item === 'y4').done, true);
  // Undo keeps the ticks too.
  progress.undo();
  assert.equal(storage.data.get('cen100-g9-ticks'), ticks);
  // Math: preparation checks never complete the assessment, and vice versa.
  const math = memoryStorage();
  const p = createProgress(math, { events: null });
  setSection('mth141', 3, math);
  for (let i = 0; i < 6; i += 1) p.toggleTick('mth141', 'midterm', `midterm-${i}`);
  assert.equal(p.tickCount('mth141', 'midterm').checked, 6);
  assert.equal(p.isDone('mth141', 'midterm'), false);
  assert.equal(nextDeadline({ now: new Date(toronto('2026-10-14', '12:00')), courseId: 'mth141', storage: math }).id, 'midterm');
  p.markDone('mth141', 'midterm');
  assert.equal(p.tickCount('mth141', 'midterm').checked, 6);
  assert.equal(deadlines('mth141', { now: new Date(toronto('2026-10-14', '12:00')), storage: math }).find((item) => item.id === 'midterm').done, true);
  // The Desk counts completion records only.
  assert.equal(deskSnapshot({ now: new Date(toronto('2026-10-14', '12:00')), storage: math })[2].progress.completed, 1);
});

test('a manual completion change or another tab’s update cancels a pending Undo, as on the old pages', () => {
  const storage = memoryStorage();
  const events = new EventTarget();
  const progress = createProgress(storage, { events });
  const seen = [];
  const off = progress.subscribe((detail) => seen.push(detail));
  progress.markDone('cen100', 'whmis');
  assert.deepEqual(seen.at(-1), { key: 'cen100-personal-plan-v1', courseId: 'cen100', source: 'local' });
  progress.setDone('cen100', 'email', true);
  assert.equal(progress.canUndo(), false, 'a completion checkbox clears Undo');
  progress.markDone('mth140', 'quiz-1');
  assert.equal(progress.canUndo(), true);
  // Another tab changes a different course: Undo survives.
  events.dispatchEvent(storageEvent('cen100-personal-plan-v1', '{}', storage));
  assert.equal(progress.canUndo(), true);
  assert.deepEqual(seen.at(-1), { key: 'cen100-personal-plan-v1', courseId: 'cen100', source: 'storage' });
  // Another tab changes this course's record: Undo is cancelled.
  events.dispatchEvent(storageEvent('mth140-progress-v1', '{}', storage));
  assert.equal(progress.canUndo(), false);
  // Unrelated keys and other storage areas are ignored.
  const count = seen.length;
  events.dispatchEvent(storageEvent('some-other-site-key', 'x', storage));
  events.dispatchEvent(storageEvent('mth140-progress-v1', '{}', memoryStorage()));
  assert.equal(seen.length, count);
  // storage.clear() in another tab arrives with key null.
  events.dispatchEvent(storageEvent(null, null, storage));
  assert.deepEqual(seen.at(-1), { key: null, courseId: null, source: 'storage' });
  off();
  progress.markDone('cen100', 'integrity');
  assert.equal(seen.length, count + 1, 'unsubscribed');
});

test('another tab’s write is read immediately (nothing is cached across calls)', () => {
  const storage = memoryStorage();
  const progress = createProgress(storage, { events: null });
  assert.equal(progress.isDone('cen100', 'integrity'), false);
  storage.data.set('cen100-personal-plan-v1', '{"completed":{"integrity":1},"notes":{},"targets":{}}');
  assert.equal(progress.isDone('cen100', 'integrity'), true);
  progress.markDone('cen100', 'whmis');
  assert.equal(storage.data.get('cen100-personal-plan-v1'), '{"completed":{"integrity":1,"whmis":1},"notes":{},"targets":{}}', 'the other tab’s record is kept');
});

test('setDone drives the per-item completion checkboxes, including undated items', () => {
  const storage = memoryStorage();
  const progress = createProgress(storage, { events: null });
  assert.equal(progress.setDone('cen100', 'item:y7', true).changed, true);
  assert.equal(progress.isDone('cen100', 'item:y7'), true);
  assert.equal(progress.setDone('cen100', 'item:y7', true).changed, false);
  assert.equal(progress.setDone('cen100', 'item:y7', false).changed, true);
  assert.equal(storage.data.get('cen100-personal-plan-v1'), '{"completed":{},"notes":{},"targets":{}}');
});
