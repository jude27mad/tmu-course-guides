import test from 'node:test';
import assert from 'node:assert/strict';

import { memoryStorage } from './helpers.mjs';
import { getCourse, dataFor, sections, groups, getSection, setSection, getGroup, setGroup, getProfile, COURSES } from '../src/lib/courses.mjs';
import { COURSES as DATA } from '../src/lib/vendor/course-data.mjs';
import { SCHEDULE } from '../src/lib/vendor/cen-schedule.mjs';

test('getCourse() returns the course object or null', () => {
  assert.equal(getCourse('cen100'), COURSES.find(c => c.id === 'cen100'));
  assert.equal(getCourse('mth140'), COURSES.find(c => c.id === 'mth140'));
  assert.equal(getCourse('mth141'), COURSES.find(c => c.id === 'mth141'));
  assert.equal(getCourse('unknown'), null);
});

test('dataFor() returns the raw data or null', () => {
  assert.equal(dataFor('cen100'), SCHEDULE);
  assert.equal(dataFor('mth140'), DATA['mth140']);
  assert.equal(dataFor('mth141'), DATA['mth141']);
  assert.equal(dataFor('unknown'), null);
});

test('sections() returns correct options', () => {
  const cenSections = sections('cen100');
  assert.ok(Array.isArray(cenSections) && cenSections.length > 0);
  assert.equal(cenSections[0].value, 1);
  assert.equal(cenSections[cenSections.length - 1].value, 39);

  const mth140Sections = sections('mth140');
  assert.ok(Array.isArray(mth140Sections) && mth140Sections.length > 0);
  assert.equal(typeof mth140Sections[0].value, 'number');

  assert.deepEqual(sections('unknown'), []);
});

test('groups() returns valid groups for a CEN100 section', () => {
  const g = groups(1);
  assert.ok(Array.isArray(g) && g.length > 0);

  // Empty or invalid section returns an empty array
  assert.deepEqual(groups(null), []);
  assert.deepEqual(groups(-1), []);
});

test('Storage functions handle getting and setting sections, groups, and profiles', () => {
  const storage = memoryStorage();

  // Initial state
  assert.equal(getSection('cen100', storage), null);
  assert.equal(getGroup('cen100', storage), null);
  assert.equal(getProfile(storage), null);

  assert.equal(getSection('mth140', storage), null);

  // Set cen100 section
  assert.equal(setSection('cen100', 5, storage), true);
  assert.equal(getSection('cen100', storage), 5);
  assert.deepEqual(getProfile(storage), { section: 5, group: null });

  // Setting same section should return true and not change group
  assert.equal(setSection('cen100', 5, storage), true);

  // Set cen100 group (needs to be a valid group for section 5)
  const validGroups = groups(5);
  const group = validGroups.length > 0 ? validGroups[0].value : null;
  if (group !== null) {
    assert.equal(setGroup('cen100', group, storage), true);
    assert.equal(getGroup('cen100', storage), group);
    assert.deepEqual(getProfile(storage), { section: 5, group });
  }

  // Set different cen100 section, should clear group
  assert.equal(setSection('cen100', 6, storage), true);
  assert.equal(getSection('cen100', storage), 6);
  assert.equal(getGroup('cen100', storage), null);

  // Setting invalid group
  assert.equal(setGroup('cen100', -1, storage), true); // validProfile will clean it to null
  assert.equal(getGroup('cen100', storage), null);

  // Math courses
  assert.equal(setSection('mth140', 31, storage), true);
  assert.equal(getSection('mth140', storage), 31);
  assert.equal(getGroup('mth140', storage), null);

  // setGroup on math course should fail
  assert.equal(setGroup('mth140', 3, storage), false);

  // Clear section
  assert.equal(setSection('cen100', 0, storage), true);
  assert.equal(getSection('cen100', storage), null);

  assert.equal(setSection('mth140', 0, storage), true);
  assert.equal(getSection('mth140', storage), null);

  // Unknown course
  assert.equal(getSection('unknown', storage), null);
  assert.equal(setSection('unknown', 1, storage), false);
  assert.equal(getGroup('unknown', storage), null);
  assert.equal(setGroup('unknown', 1, storage), false);
});
