import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { OLD } from './helpers.mjs';

const VENDOR = new URL('../src/lib/vendor/', import.meta.url);
const COPIES = ['course-data.mjs', 'cen-schedule.mjs', 'schedule.mjs', 'night/targets.mjs', 'book/weeks.mjs', 'desk/desk-data.mjs'];
const stripQueries = (text) => text.replace(/(\.mjs)\?v=[^'"]*(['"])/g, '$1$2');

test('vendored modules are the old pure modules byte for byte, with only the ?v= cache queries removed', () => {
  for (const file of COPIES) {
    const old = readFileSync(new URL(file, OLD), 'utf8');
    const copy = readFileSync(new URL(file, VENDOR), 'utf8');
    assert.equal(copy, stripQueries(old), file);
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
