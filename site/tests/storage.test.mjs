import test from 'node:test';
import assert from 'node:assert/strict';

import {
  STORAGE_KEYS,
  createProgress,
  getSection,
  setSection,
  getGroup,
  setGroup,
  getProfile,
  motionPaused,
  setMotionPaused,
  hasUnseenUpdates,
  markUpdatesSeen,
  getHideCompleted,
  setHideCompleted,
  exportBackup,
  importBackup,
  calendarFile,
  deadlines,
  deskSnapshot,
  nextDeadline,
  weeklyChecklist,
  searchIndex,
  workList,
  courseInfo,
} from '../src/lib/index.js';
import { memoryStorage, cenOracle, mathOracle, oldModule, toronto } from './helpers.mjs';

const old = await cenOracle();
const NOW = new Date(toronto('2026-10-15', '12:00'));

test('the keys are the old site’s keys', () => {
  assert.deepEqual(STORAGE_KEYS.cen100, {
    ticks: 'cen100-g9-ticks',
    profile: 'cen100-contact-choice-v1',
    plan: 'cen100-personal-plan-v1',
    hideCompleted: 'cen100-hide-completed-v1',
    seen: 'cen100-last-seen-update-v1',
  });
  for (const id of ['mth140', 'mth141']) {
    assert.deepEqual(STORAGE_KEYS[id], { progress: `${id}-progress-v1`, section: `${id}-section-v1`, view: `${id}-view-v1`, seen: `${id}-last-seen-update-v1` });
  }
  assert.equal(STORAGE_KEYS.motion, 'guide-motion-paused');
});

test('cen100-g9-ticks: {"key":1}, unticked keys deleted, other saved keys kept as the old page kept them', () => {
  const storage = memoryStorage();
  const progress = createProgress(storage, { events: null });
  assert.deepEqual(progress.toggleTick('cen100', 'm2', 'm2-1-3'), { checked: true, saved: true });
  assert.equal(storage.data.get('cen100-g9-ticks'), '{"m2-1-3":1}');
  progress.toggleTick('cen100', 'y4', '0-0');
  assert.equal(storage.data.get('cen100-g9-ticks'), '{"m2-1-3":1,"y4-0-0":1}', 'an index-only step id is joined to its item');
  progress.toggleTick('cen100', 'outline', '1-3');
  assert.equal(storage.data.get('cen100-g9-ticks'), '{"y4-0-0":1}', 'a schedule id resolves to its item (outline → m2)');
  progress.toggleTick('cen100', 'y4', 'y4-0-0', true);
  assert.equal(storage.data.get('cen100-g9-ticks'), '{"y4-0-0":1}', 'setting an already ticked step keeps it');
  // A value the old site wrote, with a key from an older guide and a `true`.
  const saved = memoryStorage({ 'cen100-g9-ticks': '{"m2-1-3":1,"retired-0-0":1,"y4-0-0":true}' });
  const mine = createProgress(saved, { events: null });
  assert.equal(mine.isTicked('cen100', 'm2', 'm2-1-3'), true);
  assert.equal(mine.isTicked('cen100', 'y4', 'y4-0-0'), true);
  assert.equal(mine.isTicked('cen100', 'm2', 'm2-1-4'), false);
  assert.deepEqual(mine.tickCount('cen100', 'm2'), { checked: 1, total: 19 });
  mine.toggleTick('cen100', 'm2', 'm2-1-3');
  // The old page: ticks = JSON.parse(raw); delete ticks[k]; JSON.stringify(ticks).
  const expected = JSON.parse('{"m2-1-3":1,"retired-0-0":1,"y4-0-0":true}');
  delete expected['m2-1-3'];
  assert.equal(saved.data.get('cen100-g9-ticks'), JSON.stringify(expected));
  assert.equal(mine.toggleTick('cen100', 'zz', 'zz-0-0').saved, false, 'unknown checklist keys are not written');
  assert.equal(mine.clearTicks(), true);
  assert.equal(saved.data.get('cen100-g9-ticks'), '{}');
  // Corrupt or non-object values read as no ticks.
  for (const raw of ['{oops', '[1,2]', 'null', '7']) assert.equal(createProgress(memoryStorage({ 'cen100-g9-ticks': raw }), { events: null }).isTicked('cen100', 'm2', 'm2-1-3'), false, raw);
});

test('cen100-contact-choice-v1: {"section":n,"group":n|null} or null, written as the old selects wrote it', () => {
  const storage = memoryStorage();
  assert.equal(getSection('cen100', storage), null);
  assert.equal(setSection('cen100', 29, storage), true);
  assert.equal(storage.data.get('cen100-contact-choice-v1'), '{"section":29,"group":null}');
  assert.equal(setGroup('cen100', 9, storage), true);
  assert.equal(storage.data.get('cen100-contact-choice-v1'), '{"section":29,"group":9}');
  const writes = storage.writes().length;
  setSection('cen100', '29', storage);
  assert.equal(storage.writes().length, writes, 'the same section writes nothing and keeps the group');
  assert.equal(getGroup('cen100', storage), 9);
  setGroup('cen100', 50, storage);
  assert.equal(storage.data.get('cen100-contact-choice-v1'), '{"section":29,"group":null}', 'a group outside the section is dropped');
  setSection('cen100', 5, storage);
  assert.equal(storage.data.get('cen100-contact-choice-v1'), '{"section":5,"group":null}');
  setSection('cen100', '', storage);
  assert.equal(storage.data.get('cen100-contact-choice-v1'), 'null');
  // Values the old site wrote.
  for (const [raw, section, group] of [
    ['{"section":29,"group":9}', 29, 9],
    ['{"section":"29","group":"9"}', 29, 9],
    ['{"section":3,"group":null}', 3, null],
    ['{"section":40}', null, null],
    ['null', null, null],
    ['{oops', null, null],
  ]) {
    const saved = memoryStorage({ 'cen100-contact-choice-v1': raw });
    assert.equal(getSection('cen100', saved), section, raw);
    assert.equal(getGroup('cen100', saved), group, raw);
    assert.deepEqual(getProfile(saved), old.validProfile(JSON.parse(raw === '{oops' ? 'null' : raw)), raw);
    assert.deepEqual(saved.writes(), [], `${raw}: reading never writes`);
  }
});

test('cen100-personal-plan-v1: Mark done writes the old page’s cleaned plan byte for byte', () => {
  const storage = memoryStorage();
  const progress = createProgress(storage, { events: null });
  progress.markDone('cen100', 'integrity');
  assert.equal(storage.data.get('cen100-personal-plan-v1'), '{"completed":{"integrity":1},"notes":{},"targets":{}}');
  // A plan the old site wrote, with stale and invalid entries: the old page cleaned it on load and wrote the
  // cleaned object on its first change.
  const raw = '{"completed":{"bogus":1,"whmis":true,"failure-lab":1,"email":0},"notes":{"y4":"remember","zz":"x"},"targets":{"m2":"2026-10-01","m3":"2026-02-30"},"extra":1}';
  const saved = memoryStorage({ 'cen100-personal-plan-v1': raw });
  const mine = createProgress(saved, { events: null });
  assert.equal(mine.isDone('cen100', 'whmis'), true);
  assert.equal(mine.isDone('cen100', 'email'), false);
  assert.equal(mine.isDone('cen100', 'failure-lab'), false, 'a reminder row is never a completion record');
  assert.deepEqual(saved.writes(), [], 'reading never writes');
  const result = mine.markDone('cen100', 'integrity');
  assert.deepEqual(result, { changed: true, saved: true, message: 'Marked done: Academic Integrity Quiz due, 3:00 PM Toronto time. Saved on this device.' });
  const expected = old.cleanPlan(JSON.parse(raw));
  expected.completed.integrity = 1;
  assert.equal(saved.data.get('cen100-personal-plan-v1'), JSON.stringify(expected));
  assert.equal(saved.data.get('cen100-personal-plan-v1'), '{"completed":{"whmis":1,"integrity":1},"notes":{"y4":"remember"},"targets":{"m2":"2026-10-01"}}');
  // Undated items keep their item:<id> keys.
  mine.setDone('cen100', 'item:y9', true);
  assert.match(saved.data.get('cen100-personal-plan-v1'), /"item:y9":1/);
  assert.equal(mine.isDone('cen100', 'item:y9'), true);
  // Notes and targets: per CEN item; empty values are deleted, invalid dates refused.
  assert.equal(mine.setNote('cen100', 'm2', 'Interview list'), true);
  assert.equal(mine.getNote('cen100', 'm2'), 'Interview list');
  mine.setNote('cen100', 'y4', '');
  assert.equal(JSON.parse(saved.data.get('cen100-personal-plan-v1')).notes.y4, undefined);
  assert.equal(mine.setNote('cen100', 'm2', 'x'.repeat(2001)), false);
  assert.equal(mine.setTarget('cen100', 'm7', '2026-11-30'), true);
  assert.equal(mine.setTarget('cen100', 'm7', '2026-02-30'), false);
  assert.equal(mine.getTarget('cen100', 'm7'), '2026-11-30');
  assert.deepEqual(JSON.parse(saved.data.get('cen100-personal-plan-v1')), {
    completed: { whmis: 1, integrity: 1, 'item:y9': 1 },
    notes: { m2: 'Interview list' },
    targets: { m2: '2026-10-01', m7: '2026-11-30' },
  });
});

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
  test(`${courseId}-progress-v1 and -section-v1: the old math page’s formats`, async () => {
    const page = await mathOracle(courseId);
    const key = `${courseId}-progress-v1`;
    const storage = memoryStorage();
    const progress = createProgress(storage, { events: null });
    assert.equal(progress.markDone(courseId, 'quiz-1').message, 'Marked done: Lab Quiz 1. Saved on this device.');
    assert.equal(storage.data.get(key), '{"checks":{},"completed":{"quiz-1":true},"notes":{},"targets":{},"topics":{}}');
    progress.toggleTick(courseId, 'quiz-1', 'quiz-1-2');
    const topic = page.course.topics[1];
    progress.toggleTick(courseId, topic.id, `${topic.id}-0`);
    progress.toggleTick(courseId, 'midterm', '1');
    assert.deepEqual(JSON.parse(storage.data.get(key)), { checks: { 'quiz-1-2': true, 'midterm-1': true }, completed: { 'quiz-1': true }, notes: {}, targets: {}, topics: { [`${topic.id}-0`]: true } });
    assert.equal(progress.isTicked(courseId, 'quiz-1', 'quiz-1-2'), true);
    assert.equal(progress.isTicked(courseId, topic.id, `${topic.id}-0`), true);
    assert.equal(progress.isDone(courseId, 'midterm'), false, 'a preparation check never marks the assessment done');
    // The old page kept an empty note and cut long ones at 2000 characters.
    progress.setNote(courseId, 'quiz-1', '');
    assert.equal(JSON.parse(storage.data.get(key)).notes['quiz-1'], '');
    progress.setNote(courseId, 'final', 'n'.repeat(2500));
    assert.equal(progress.getNote(courseId, 'final').length, 2000);
    progress.setTarget(courseId, 'final', '2026-12-01');
    progress.setTarget(courseId, 'midterm', 'soon');
    assert.deepEqual(JSON.parse(storage.data.get(key)).targets, { final: '2026-12-01' });
    // A record the old site wrote: 1 for true, unknown ids, bad dates. The first change writes cleanProgress().
    const raw = JSON.stringify({ checks: { 'quiz-1-0': 1, 'quiz-1-9': true, bogus: true }, completed: { midterm: 1, 'quiz-9': true, final: 'yes' }, notes: { midterm: 'room?', bogus: 'x' }, targets: { midterm: '2026-10-20', final: '2026-13-01' }, topics: {} });
    const saved = memoryStorage({ [key]: raw });
    const mine = createProgress(saved, { events: null });
    assert.equal(mine.isDone(courseId, 'midterm'), true);
    assert.equal(mine.isDone(courseId, 'final'), false);
    mine.markDone(courseId, 'quiz-2');
    const expected = page.cleanProgress(JSON.parse(raw));
    expected.completed['quiz-2'] = true;
    assert.equal(saved.data.get(key), JSON.stringify(expected));
    // Section: a number, 0 when none.
    const sections = memoryStorage();
    assert.equal(getSection(courseId, sections), null);
    setSection(courseId, 31, sections);
    assert.equal(sections.data.get(`${courseId}-section-v1`), '31');
    assert.equal(getSection(courseId, sections), 31);
    setSection(courseId, 99, sections);
    assert.equal(sections.data.get(`${courseId}-section-v1`), '0', 'not a lab section');
    setSection(courseId, null, sections);
    assert.equal(sections.data.get(`${courseId}-section-v1`), '0');
    for (const [stored, value] of [
      ['7', 7],
      ['"7"', 7],
      ['0', null],
      ['99', null],
      ['oops', null],
    ]) {
      const s = memoryStorage({ [`${courseId}-section-v1`]: stored });
      assert.equal(getSection(courseId, s), value, stored);
      assert.deepEqual(s.writes(), []);
    }
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

test('nothing that reads saved state writes to storage', () => {
  const storage = memoryStorage({
    'cen100-g9-ticks': '{"m2-1-3":1,"stale-0-0":1}',
    'cen100-contact-choice-v1': '{"section":"29","group":"9"}',
    'cen100-personal-plan-v1': '{"completed":{"integrity":1,"bogus":1},"notes":{"zz":"x"},"targets":{}}',
    'mth140-section-v1': '"31"',
    'mth140-progress-v1': '{"completed":{"quiz-1":1},"checks":{"bogus":true}}',
    'mth141-section-v1': '99',
    'mth141-progress-v1': '[1]',
    'guide-motion-paused': 'true',
  });
  const progress = createProgress(storage, { events: null });
  for (const course of ['cen100', 'mth140', 'mth141']) {
    deadlines(course, { now: NOW, storage });
    weeklyChecklist(course, { now: NOW, storage });
    workList(course, { now: NOW, storage, range: 'all' });
    getSection(course, storage);
    nextDeadline({ now: NOW, courseId: course, storage });
    courseInfo(course, { section: 29 });
    exportBackup(course, { now: NOW, storage });
    hasUnseenUpdates(course, storage);
    progress.isDone(course, 'integrity');
    progress.isTicked(course, 'm2', 'm2-1-3');
    progress.tickCount(course, 'm2');
  }
  deskSnapshot({ now: NOW, storage });
  nextDeadline({ now: NOW, storage });
  searchIndex({ now: NOW, storage });
  motionPaused(storage);
  getHideCompleted(storage);
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

  // Math: error paths
  const invalidJsonResult = importBackup('mth140', '{', { storage: fresh });
  assert.equal(invalidJsonResult.ok, false);
  assert.equal(invalidJsonResult.saved, false);
  assert.equal(typeof invalidJsonResult.message, 'string');
  assert.deepEqual(importBackup('mth140', 'x'.repeat(300001), { storage: fresh }), { ok: false, saved: false, message: 'This file is too large for a course-progress backup.' });
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
