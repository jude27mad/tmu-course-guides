import test from 'node:test';
import assert from 'node:assert/strict';

import * as lib from '../src/lib/index.js';
import { memoryStorage, deniedStorage, fullStorage, storageEvent, toronto } from './helpers.mjs';

const NOW = new Date(toronto('2026-10-12', '12:00'));
const COURSES = ['cen100', 'mth140', 'mth141'];

/** Call every read-side export the pages use; none may throw. */
function readEverything(storage) {
  const out = {};
  out.desk = lib.deskSnapshot({ now: NOW, storage });
  out.next = lib.nextDeadline({ now: NOW, storage });
  out.search = lib.searchIndex({ now: NOW, storage });
  out.motion = lib.motionPaused(storage);
  for (const course of COURSES) {
    out[course] = {
      deadlines: lib.deadlines(course, { now: NOW, storage }),
      next: lib.nextDeadline({ now: NOW, courseId: course, storage }),
      week: lib.weeklyChecklist(course, { now: NOW, storage }),
      work: lib.workList(course, { now: NOW, storage }),
      section: lib.getSection(course, storage),
      info: lib.courseInfo(course, {}),
      assessments: lib.assessments(course),
      unseen: lib.hasUnseenUpdates(course, storage),
      backup: lib.exportBackup(course, { now: NOW, storage }),
    };
    out[course].buckets = lib.buckets(out[course].deadlines, NOW);
    out[course].countdown = lib.countdown(out[course].next, NOW);
  }
  return out;
}

test('empty, missing, blocked and full storage all read as "nothing saved" and never throw', () => {
  const baseline = readEverything(memoryStorage());
  for (const [name, storage] of [
    ['missing', null],
    ['blocked', deniedStorage()],
    ['full', fullStorage()],
  ]) {
    const result = readEverything(storage);
    assert.deepEqual(JSON.parse(JSON.stringify(result)), JSON.parse(JSON.stringify(baseline)), name);
  }
  assert.equal(baseline.next.courseId, 'mth140');
  assert.equal(baseline.cen100.section, null);
});

test('a storage getter that throws (blocked site data) is treated as no storage', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get() {
      throw new Error('SecurityError');
    },
  });
  try {
    assert.equal(lib.getSection('cen100'), null);
    assert.equal(lib.nextDeadline({ now: NOW }).courseId, 'mth140');
    assert.equal(lib.deskSnapshot({ now: NOW }).length, 3);
    assert.equal(lib.motionPaused(), false);
    const progress = lib.createProgress(undefined, { events: null });
    assert.equal(progress.isDone('cen100', 'integrity'), false);
    assert.equal(progress.markDone('cen100', 'integrity').saved, false);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
    else delete globalThis.localStorage;
  }
});

test('blocked writes report saved:false, use the old message, and still show the change for this page view', () => {
  for (const make of [deniedStorage, () => fullStorage({ 'cen100-personal-plan-v1': '{"completed":{"whmis":1},"notes":{},"targets":{}}' })]) {
    const storage = make();
    const progress = lib.createProgress(storage, { events: null });
    const result = progress.markDone('cen100', 'integrity');
    assert.equal(result.saved, false);
    assert.equal(result.message, 'Marked done: Academic Integrity Quiz due, 3:00 PM Toronto time. Local saving is blocked; export a backup to keep it.');
    assert.equal(progress.isDone('cen100', 'integrity'), true, 'kept in memory');
    assert.notEqual(lib.nextDeadline({ now: NOW, courseId: 'cen100', storage }).id, 'integrity');
    assert.equal(progress.undo().saved, false);
    assert.equal(progress.isDone('cen100', 'integrity'), false);
    assert.deepEqual(progress.toggleTick('cen100', 'm2', 'm2-1-3'), { checked: true, saved: false });
    assert.equal(progress.isTicked('cen100', 'm2', 'm2-1-3'), true);
    assert.equal(lib.setSection('mth140', 31, storage), false);
    assert.equal(lib.getSection('mth140', storage), 31);
    assert.equal(lib.setMotionPaused(true, storage), false);
    assert.equal(lib.motionPaused(storage), true);
    const math = progress.markDone('mth141', 'quiz-1');
    assert.equal(math.message, 'Marked done: Lab Quiz 1. Local saving is blocked; export a backup to keep it.');
  }
});

test('full storage: once another tab writes the key, its value wins over the unsaved copy', () => {
  const storage = fullStorage();
  const events = new EventTarget();
  const progress = lib.createProgress(storage, { events });
  progress.subscribe(() => {});
  progress.markDone('cen100', 'integrity');
  assert.equal(progress.isDone('cen100', 'integrity'), true);
  storage.data.set('cen100-personal-plan-v1', '{"completed":{"whmis":1},"notes":{},"targets":{}}');
  events.dispatchEvent(storageEvent('cen100-personal-plan-v1', storage.data.get('cen100-personal-plan-v1'), storage));
  assert.equal(progress.isDone('cen100', 'integrity'), false);
  assert.equal(progress.isDone('cen100', 'whmis'), true);
});

test('unknown courses and bad arguments return empty values', () => {
  assert.equal(lib.getCourse('xyz'), null);
  assert.deepEqual(lib.sections('xyz'), []);
  assert.deepEqual(lib.deadlines('xyz', { now: NOW, storage: null }), []);
  assert.equal(lib.deadlineItem('cen100', 'nope', { now: NOW, storage: null }), null);
  assert.equal(lib.nextDeadline({ now: NOW, courseId: 'xyz', storage: null }), null);
  assert.equal(lib.courseInfo('xyz'), null);
  assert.equal(lib.weeklyChecklist('xyz', { now: NOW, storage: null }).length, 0);
  assert.deepEqual(lib.countdown(null, NOW), { label: '', ms: null, state: 'none', status: null });
  assert.deepEqual(lib.countdown(new Date(Number.NaN), NOW).label, '');
  assert.deepEqual(lib.buckets(null, NOW), { thisWeek: [], nextWeek: [], later: [], earlier: [] });
  assert.equal(lib.setSection('xyz', 3, memoryStorage()), false);
  assert.equal(lib.setGroup('mth140', 3, memoryStorage()), false);
  assert.deepEqual(lib.searchEntries(null, 'x'), []);
  assert.equal(lib.deadlines('cen100', { storage: null }).length > 0, true, 'now defaults to the current time');
});
