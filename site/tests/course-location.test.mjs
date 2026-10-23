import test from 'node:test';
import assert from 'node:assert/strict';
import { courseInfo } from '../src/lib/index.js';
import { resolveCourseLocation } from '../src/pages/course/components/workspace/location.mjs';

test('old view links resolve to the focused view, including CEN study alias', () => {
  for (const hash of ['', '#work', '#assignments', '#p-team', '#t-you', '#panel-assessments', '#study']) {
    assert.equal(resolveCourseLocation(hash, 'cen100', courseInfo('cen100')).view, 'work');
  }
  for (const hash of ['#schedule', '#deadlines']) assert.equal(resolveCourseLocation(hash, 'cen100', courseInfo('cen100')).view, 'schedule');
  for (const hash of ['#t-rules', '#p-rules', '#course-grading', '#contacts', '#section-picker']) {
    assert.equal(resolveCourseLocation(hash, 'cen100', courseInfo('cen100')).view, 'info');
  }
  assert.equal(resolveCourseLocation('#study', 'mth140', courseInfo('mth140')).view, 'study');
  assert.equal(resolveCourseLocation('#work/done', 'mth140', courseInfo('mth140')).filter, 'done');
  assert.equal(resolveCourseLocation('#work/all', 'mth140', courseInfo('mth140')).filter, 'all');
});

test('canonical, encoded and legacy links open only a real item in this course', () => {
  const cen = courseInfo('cen100');
  for (const hash of ['#assignment-m2', '#assignment%2Dm2']) {
    assert.equal(resolveCourseLocation(hash, 'cen100', cen).item?.id, 'm2');
  }
  assert.equal(resolveCourseLocation('#assessment-midterm', 'mth140', courseInfo('mth140')).kind, 'assessment');
  assert.equal(resolveCourseLocation('#topic-limits', 'mth140', courseInfo('mth140')).view, 'study');
  assert.equal(resolveCourseLocation('#topic-limits', 'mth140', courseInfo('mth140')).kind, 'topic');
  for (const hash of ['#assignment-m999', '#assessment-midterm', '#%broken']) {
    assert.equal(resolveCourseLocation(hash, 'cen100', cen).item, null);
  }
});
