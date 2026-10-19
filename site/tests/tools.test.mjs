import test from 'node:test';
import assert from 'node:assert/strict';

import {
  hasUnseenUpdates,
  markUpdatesSeen,
  getHideCompleted,
  setHideCompleted,
  motionPaused,
  setMotionPaused,
  exportBackup,
  importBackup,
  calendarFile,
} from '../src/lib/index.js';
import { memoryStorage, cenOracle, oldModule, toronto } from './helpers.mjs';

const old = await cenOracle();
const NOW = new Date(toronto('2026-10-15', '12:00'));

test('cen100 hide filter and release badge use the old JSON values', () => {
  const storage = memoryStorage();
  assert.equal(getHideCompleted(storage), false);
  setHideCompleted(true, storage);
  assert.equal(storage.data.get('cen100-hide-completed-v1'), 'true');
  assert.equal(getHideCompleted(storage), true);
  setHideCompleted(false, storage);
  assert.equal(storage.data.get('cen100-hide-completed-v1'), 'false');
  assert.equal(hasUnseenUpdates('cen100', storage), true);
  markUpdatesSeen('cen100', storage);
  assert.equal(storage.data.get('cen100-last-seen-update-v1'), '"2026-10-16-course-artwork"');
  assert.equal(hasUnseenUpdates('cen100', storage), false);
  assert.equal(hasUnseenUpdates('cen100', memoryStorage({ 'cen100-last-seen-update-v1': '"2026-10-01-older"' })), true);
});

for (const courseId of ['mth140', 'mth141']) {
  test(`${courseId} unseen updates`, () => {
    const seen = memoryStorage();
    markUpdatesSeen(courseId, seen);
    assert.equal(seen.data.get(`${courseId}-last-seen-update-v1`), '"2026-10-16-course-artwork"');
  });
}

test('guide-motion-paused: raw "true" / "false"', () => {
  const storage = memoryStorage();
  assert.equal(motionPaused(storage), false);
  assert.equal(setMotionPaused(true, storage), true);
  assert.equal(storage.data.get('guide-motion-paused'), 'true');
  assert.equal(motionPaused(storage), true);
  setMotionPaused(false, storage);
  assert.equal(storage.data.get('guide-motion-paused'), 'false');
  assert.equal(motionPaused(memoryStorage({ 'guide-motion-paused': '"true"' })), false, 'only the raw string true pauses');
});

test('tools functions do not write to storage when reading', () => {
  const storage = memoryStorage({ 'guide-motion-paused': 'true' });
  motionPaused(storage);
  getHideCompleted(storage);
  hasUnseenUpdates('cen100', storage);
  exportBackup('cen100', { now: NOW, storage });
  assert.deepEqual(storage.writes(), []);
});

test('backups: export the old file formats and import them back with the old merge rules', async () => {
  const storage = memoryStorage({
    'cen100-g9-ticks': '{"y4-0-0":1,"m2-1-3":1,"stale-0-0":1}',
    'cen100-personal-plan-v1': '{"completed":{"integrity":1},"notes":{"m2":"mine"},"targets":{"m7":"2026-11-30"}}',
  });
  const file = exportBackup('cen100', { now: NOW, storage });
  assert.equal(file.name, 'cen100-progress-2026-10-15.json');
  const data = JSON.parse(file.text);
  assert.ok(file.text.endsWith('}\n'));
  assert.deepEqual(Object.keys(data), ['format', 'version', 'exportedAt', 'ticks', 'personal']);
  assert.deepEqual(data.ticks, { 'm2-1-3': 1, 'y4-0-0': 1 }, 'card order, known checklist keys only');
  assert.equal(file.text, `${JSON.stringify({ format: 'cen100-guide-backup', version: 2, exportedAt: NOW.toISOString(), ticks: { 'm2-1-3': 1, 'y4-0-0': 1 }, personal: old.cleanPlan(JSON.parse(storage.data.get('cen100-personal-plan-v1'))) }, null, 2)}\n`);
  const target = memoryStorage({ 'cen100-personal-plan-v1': '{"completed":{},"notes":{"m2":"theirs"},"targets":{}}' });
  const result = importBackup('cen100', file.text, { storage: target });
  assert.equal(result.ok, true);
  assert.equal(result.message, 'Imported 2 new checklist ticks, 1 completion records and 1 notes/target dates. Existing progress kept. 1 conflicting notes/target dates kept as they were on this device.');
  assert.equal(target.data.get('cen100-g9-ticks'), '{"m2-1-3":1,"y4-0-0":1}');
  assert.deepEqual(JSON.parse(target.data.get('cen100-personal-plan-v1')), { completed: { integrity: 1 }, notes: { m2: 'theirs' }, targets: { m7: '2026-11-30' } });
  assert.deepEqual(importBackup('cen100', '{', { storage: target }), { ok: false, saved: false, message: 'This file is not valid JSON. Choose an exported CEN100 backup.' });
  // Math: same course only.
  const math = memoryStorage({ 'mth140-progress-v1': '{"completed":{"quiz-1":true},"checks":{"quiz-1-0":true}}' });
  const mathFile = exportBackup('mth140', { now: NOW, storage: math });
  assert.equal(mathFile.name, 'mth140-progress.json');
  assert.equal(mathFile.text, JSON.stringify({ format: 'tmu-math-guide', version: 1, course: 'mth140', exported: NOW.toISOString(), progress: { checks: { 'quiz-1-0': true }, completed: { 'quiz-1': true }, notes: {}, targets: {}, topics: {} } }, null, 2));
  assert.equal(importBackup('mth141', mathFile.text, { storage: math }).message, 'Choose a valid progress backup for MTH141.');
  const fresh = memoryStorage();
  assert.equal(importBackup('mth140', mathFile.text, { storage: fresh }).message, 'Progress imported.');
  assert.equal(fresh.data.get('mth140-progress-v1'), '{"checks":{"quiz-1-0":true},"completed":{"quiz-1":true},"notes":{},"targets":{},"topics":{}}');
});

test('calendar files are the old pages’ .ics files', async () => {
  const schedule = await oldModule('schedule.mjs');
  const { COURSES } = await oldModule('course-data.mjs');
  const stamp = NOW.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const cen = calendarFile('cen100', { now: NOW, item: 'all', upcomingOnly: false, reminderDays: 2 });
  assert.equal(cen.name, 'cen100-deadlines-2026.ics');
  assert.equal(cen.text, old.buildCalendar(old.CALENDAR_DATES.slice().sort(old.sortEvents), 2, stamp));
  assert.equal(cen.count, 22);
  assert.equal(calendarFile('cen100', { now: new Date(toronto('2026-12-10', '12:00')), item: 'all' }).message, 'No upcoming dates in this selection. Uncheck ‘Upcoming dates only’ to include past deadlines.');
  const one = calendarFile('cen100', { now: NOW, item: 'y4', upcomingOnly: false });
  assert.equal(one.name, 'cen100-y4-2026.ics');
  assert.match(one.text, /UID:cen100-f26-integrity-jude27mad-github-io/);
  for (const id of ['mth140', 'mth141']) {
    const file = calendarFile(id, { now: NOW, includeTentative: true, section: 3 });
    assert.equal(file.name, `${id}-fall-2026.ics`);
    assert.equal(file.text, schedule.calendar(COURSES[id], 3, { includeTentative: true, onlyUpcoming: true, now: NOW }).text);
    assert.equal(calendarFile(id, { now: NOW, includeTentative: true, section: 0 }).message, 'Choose your section first to include lab quiz dates.');
  }
});
