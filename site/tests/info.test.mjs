import test from 'node:test';
import assert from 'node:assert/strict';

import { courseInfo, courseCopy } from '../src/lib/info.mjs';

test('courseInfo returns null for unknown courses', () => {
  assert.equal(courseInfo('invalid-course'), null);
});

test('courseInfo returns expected structure for cen100', () => {
  const info = courseInfo('cen100');
  assert.equal(info.courseId, 'cen100');
  assert.equal(info.code, 'CEN100');
  assert.ok(info.title);
  assert.ok(info.profile);
  assert.ok(info.page);
  assert.ok(info.leads);
  assert.ok(Array.isArray(info.items));
  assert.ok(Array.isArray(info.rules));
  assert.ok(Array.isArray(info.confirmed));
  assert.ok(Array.isArray(info.open));
  assert.ok(info.openLead);
  assert.ok(info.contacts);
  assert.ok(Array.isArray(info.sections));
  assert.ok(info.grading);
  assert.ok(info.tools);
  assert.ok(info.updates);
  assert.ok(info.footer);
});

test('courseInfo with options for cen100', () => {
  const noProfile = courseInfo('cen100');
  assert.equal(noProfile.profile.value, null);

  const partialProfile = courseInfo('cen100', { section: 29 });
  assert.equal(partialProfile.profile.value.section, 29);
  assert.equal(partialProfile.profile.value.group, null);

  const fullProfile = courseInfo('cen100', { section: 29, group: 9 });
  assert.equal(fullProfile.profile.value.section, 29);
  assert.equal(fullProfile.profile.value.group, 9);
});

test('courseInfo returns expected structure for mth140', () => {
  const info = courseInfo('mth140');
  assert.equal(info.courseId, 'mth140');
  assert.equal(info.code, 'MTH140');
  assert.ok(info.title);
  assert.ok(info.organization);
  assert.ok(info.section);
  assert.equal(info.section.value, null);
  assert.ok(Array.isArray(info.sections));
  assert.ok(info.page);
  assert.ok(Array.isArray(info.assessments));
  assert.ok(Array.isArray(info.topics));
  assert.ok(info.review);
  assert.ok(Array.isArray(info.rules));
  assert.ok(info.notice);
  assert.ok(info.contacts);
  assert.ok(info.textbooks);
  assert.ok(info.sources);
  assert.ok(info.grading);
  assert.ok(info.tools);
  assert.ok(info.updates);
  assert.ok(info.footer);
});

test('courseInfo with section for mth140', () => {
  const withSection = courseInfo('mth140', { section: 2 });
  assert.equal(withSection.section.value, 2);

  const invalidSection = courseInfo('mth140', { section: 999 });
  assert.equal(invalidSection.section.value, null);
});

test('courseInfo returns expected structure for mth141', () => {
  const info = courseInfo('mth141');
  assert.equal(info.courseId, 'mth141');
  assert.equal(info.code, 'MTH141');
  assert.ok(info.title);
  assert.ok(info.organization);
  assert.ok(info.section);
  assert.ok(Array.isArray(info.sections));
  assert.ok(info.page);
  assert.ok(Array.isArray(info.assessments));
  assert.ok(Array.isArray(info.topics));
  assert.ok(info.review);
  assert.ok(Array.isArray(info.rules));
  assert.ok(info.notice);
  assert.ok(info.contacts);
  assert.ok(info.textbooks);
  assert.ok(info.sources);
  assert.ok(info.grading);
  assert.ok(info.tools);
  assert.ok(info.updates);
  assert.ok(info.footer);
});

test('courseInfo caches results via fast', () => {
  const call1 = courseInfo('cen100');
  const call2 = courseInfo('cen100');
  assert.deepEqual(call1, call2, 'courseInfo should return identical structures');
});

test('courseCopy returns null for unknown courses', () => {
  assert.equal(courseCopy('invalid-course'), null);
});

test('courseCopy returns strings for cen100', () => {
  const copy = courseCopy('cen100');
  assert.ok(copy);
  assert.ok(copy.datePassed);
  assert.ok(copy.tabs);
  assert.ok(copy.filterStatus);
});

test('courseCopy returns strings for math courses', () => {
  const copy140 = courseCopy('mth140');
  assert.ok(copy140);
  assert.ok(copy140.next);
  assert.ok(copy140.counts);
  assert.ok(copy140.search);
  assert.ok(copy140.work);

  const copy141 = courseCopy('mth141');
  assert.ok(copy141);
  assert.ok(copy141.next);
  assert.ok(copy141.counts);
  assert.ok(copy141.search);
  assert.ok(copy141.work);
});
