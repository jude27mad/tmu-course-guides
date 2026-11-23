import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { OLD } from './helpers.mjs';

const VENDOR = new URL('../src/lib/vendor/', import.meta.url);
const COPIES = ['course-data.mjs', 'cen-schedule.mjs', 'schedule.mjs', 'night/targets.mjs', 'book/weeks.mjs', 'desk/desk-data.mjs'];
const stripQueries = (text) => text.replace(/(\.mjs)\?v=[^'"]*(['"])/g, '$1$2');

const adaptedFunctions = {
  'schedule.mjs': ['resolveAssessment', 'timing', 'calendar'],
  'night/targets.mjs': ['readSection', 'readSaved', 'resolveTarget', 'compact', 'status'],
  'desk/desk-data.mjs': ['deskSummary'],
};

test('vendored modules preserve course-wide content and helpers beyond the documented updates', async () => {
  for (const file of COPIES) {
    const old = readFileSync(new URL(file, OLD), 'utf8');
    const copy = readFileSync(new URL(file, VENDOR), 'utf8');
    if (file === 'course-data.mjs') {
      const parse = (text) => JSON.parse(text.replace(/^export const COURSES = /, '').trim().replace(/;$/, ''));
      const previous = parse(old);
      const current = parse(copy);
      for (const course of Object.values(previous)) {
        course.labs = [];
        course.instructors = [];
        course.sources = course.sources.filter(({ title }) => !['MTH140 TAs F26', 'MTH141 Labs'].includes(title));
      }
      const before = previous.mth140;
      const after = current.mth140;
      const quiz = before.assessments.find((item) => item.id === 'quiz-2');
      quiz.weekEnd = quiz.mondayMakeupDate;
      delete quiz.mondayMakeupDate;
      quiz.source = quiz.source.replace('scope, second-hour timing and Monday October 19 make-up.', 'scope and second-hour timing.');
      const quizSource = before.sources.find(({ title }) => title === 'Lab 5 Questions and Quiz 2');
      quizSource.detail = quizSource.detail.replace('; Monday sections on October 19, other sections in their October 13–16 labs.', '.');
      after.updated = before.updated;
      for (const topic of after.topics) topic.midterm = before.topics.find((t) => t.id === topic.id).midterm;
      for (const item of after.assessments) {
        const original = before.assessments.find((a) => a.id === item.id);
        if (item.id === 'quiz-2') item.scope = original.scope;
        if (item.id === 'midterm') for (const key of ['scope', 'source', 'confirmed']) item[key] = original[key];
      }
      assert.equal(after.sources.length, before.sources.length + 1);
      assert.equal(after.sources.pop().title, 'Midterm Exam Content');
      assert.deepEqual(current, previous);
    } else if (file === 'cen-schedule.mjs') {
      const archive = await import(new URL(file, OLD));
      const current = await import(new URL(file, VENDOR));
      assert.deepEqual(current.SCHEDULE, archive.SCHEDULE.filter((item) => !item.section));
    } else if (adaptedFunctions[file]) {
      // The section-related functions are covered by the deadlines, calendar and storage suites.
      const archive = await import(new URL(file, OLD));
      const current = await import(new URL(file, VENDOR));
      for (const [name, value] of Object.entries(archive)) {
        if (adaptedFunctions[file].includes(name)) continue;
        if (typeof value === 'function') assert.equal(String(current[name]), stripQueries(String(value)), name);
        else assert.deepEqual(current[name], value, name);
      }
    } else {
      assert.equal(copy, stripQueries(old), file);
    }
    assert.doesNotMatch(copy, /\?v=/, `${file}: no cache queries left`);
  }
});

test('the vendored palette is the old pure half: everything before mount(), unchanged', () => {
  const old = readFileSync(new URL('night/palette.mjs', OLD), 'utf8');
  const copy = readFileSync(new URL('night/palette.mjs', VENDOR), 'utf8');
  const pure = stripQueries(old.slice(0, old.indexOf('let service=null')));
  assert.ok(copy.startsWith(pure), 'pure half copied unchanged');
  assert.doesNotMatch(copy, /export function mount|import\(['"][^'"]*core\.mjs/, 'mount() and its DOM services are not copied');
});

test('vendored and old modules export the same names and import with no DOM and no new globals', async () => {
  const before = new Set(Object.getOwnPropertyNames(globalThis));
  for (const file of [...COPIES, 'night/palette.mjs']) {
    const copy = await import(new URL(file, VENDOR).href);
    const old = await import(new URL(file, OLD).href);
    const expected = Object.keys(old).filter((name) => !(file === 'night/palette.mjs' && name === 'mount'));
    assert.deepEqual(Object.keys(copy).sort(), expected.sort(), file);
  }
  const added = Object.getOwnPropertyNames(globalThis).filter((name) => !before.has(name));
  assert.deepEqual(added, []);
});

test('the lib entry points import cleanly without a DOM', async () => {
  const lib = await import('../src/lib/index.js');
  for (const name of [
    'COURSES',
    'getCourse',
    'sections',
    'getSection',
    'setSection',
    'deadlines',
    'buckets',
    'nextDeadline',
    'countdown',
    'weeklyChecklist',
    'assessments',
    'courseInfo',
    'deskSnapshot',
    'createProgress',
    'searchIndex',
    'motionPaused',
    'setMotionPaused',
  ]) {
    assert.ok(name in lib, `contract export ${name}`);
  }
  assert.equal(typeof window, 'undefined');
});
