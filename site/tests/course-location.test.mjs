import test from 'node:test';
import assert from 'node:assert/strict';
// eslint-disable-next-line import/extensions
import { courseInfo, courseTerm } from '../src/lib/index.js';
import { courseViews, resolveCourseLocation } from '../src/pages/course/components/workspace/location.mjs';

test('old view links resolve to the focused view, including CEN study alias', () => {
  ['', '#work', '#assignments', '#p-team', '#t-you', '#panel-assessments', '#study'].forEach((hash) => {
    assert.equal(resolveCourseLocation(hash, 'cen100', courseInfo('cen100')).view, 'work');
  });
  ['#schedule', '#deadlines'].forEach((hash) => assert.equal(resolveCourseLocation(hash, 'cen100', courseInfo('cen100')).view, 'schedule'));
  ['#t-rules', '#p-rules', '#course-grading', '#contacts', '#section-picker'].forEach((hash) => {
    assert.equal(resolveCourseLocation(hash, 'cen100', courseInfo('cen100')).view, 'info');
  });
  assert.equal(resolveCourseLocation('#study', 'mth140', courseInfo('mth140')).view, 'study');
  assert.equal(resolveCourseLocation('#work/done', 'mth140', courseInfo('mth140')).filter, 'done');
  assert.equal(resolveCourseLocation('#work/all', 'mth140', courseInfo('mth140')).filter, 'all');
});

test('canonical, encoded and legacy links open only a real item in this course', () => {
  const cen = courseInfo('cen100');
  ['#assignment-m2', '#assignment%2Dm2'].forEach((hash) => {
    assert.equal(resolveCourseLocation(hash, 'cen100', cen).item?.id, 'm2');
  });
  assert.equal(resolveCourseLocation('#assessment-midterm', 'mth140', courseInfo('mth140')).kind, 'assessment');
  assert.equal(resolveCourseLocation('#topic-limits', 'mth140', courseInfo('mth140')).view, 'study');
  assert.equal(resolveCourseLocation('#topic-limits', 'mth140', courseInfo('mth140')).kind, 'topic');
  ['#assignment-m999', '#assessment-midterm', '#%broken'].forEach((hash) => {
    assert.equal(resolveCourseLocation(hash, 'cen100', cen).item, null);
  });
});

test('specific policy and source links resolve to their own information answer', () => {
  const info = courseInfo('mth140');
  ['policy-regrade', 'policy-missed-assessment', 'sources'].forEach((hash) => {
    const location = resolveCourseLocation(`#${hash}`, 'mth140', info);
    assert.equal(location.view, 'info');
    assert.equal(location.panel, hash);
  });
  assert.equal(resolveCourseLocation('#policy-unknown', 'mth140', info).view, 'work');
});

// An archived course's info as the lib shapes it (info.archived, info.term, no contacts), built here so the tests
// do not depend on NEXT_PUBLIC_COURSE_STATUS.
const archivedInfo = (courseId, gradesOpen) => ({
  ...courseInfo(courseId),
  archived: true,
  term: { ...courseTerm(courseId), status: 'archived', archived: true, gradesOpen },
  contacts: null,
});
const offered = (courseId, info) => ({ views: courseViews(courseId, info).map(([view]) => view) });
const HASHES = ['', '#work', '#work/all', '#work/done', '#schedule', '#deadlines', '#calendar', '#course-schedule', '#grades', '#marks', '#study', '#topics', '#course-info', '#section-picker'];

test('a current course offers every view, and the views option changes nothing', () => {
  assert.deepEqual(courseViews('cen100', courseInfo('cen100')), [
    ['work', 'Work'],
    ['schedule', 'Schedule'],
    ['grades', 'Grades'],
    ['info', 'Course info'],
  ]);
  ['mth140', 'mth141'].forEach((id) => {
    assert.deepEqual(courseViews(id, courseInfo(id)), [
      ['work', 'Work'],
      ['schedule', 'Schedule'],
      ['study', 'Study'],
      ['grades', 'Grades'],
      ['info', 'Course info'],
    ]);
  });
  ['cen100', 'mth140', 'mth141'].forEach((id) => {
    const info = courseInfo(id);
    const anchors = [...(info.items || info.assessments), ...(info.topics || [])].map((entry) => `#${entry.anchor}`);
    [...HASHES, ...anchors, '#contacts', '#course-grading', '#p-rules', '#t-rules', '#policy-unknown', '#%broken'].forEach((hash) => {
      assert.deepEqual(resolveCourseLocation(hash, id, info, offered(id, info)), resolveCourseLocation(hash, id, info), `${id} ${hash}`);
    });
  });
});

test('an archived course offers no Schedule, and no Grades once they close', () => {
  assert.deepEqual(
    courseViews('cen100', archivedInfo('cen100', true)).map(([view]) => view),
    ['work', 'grades', 'info'],
  );
  assert.deepEqual(
    courseViews('cen100', archivedInfo('cen100', false)).map(([view]) => view),
    ['work', 'info'],
  );
  assert.deepEqual(
    courseViews('mth141', archivedInfo('mth141', true)).map(([view]) => view),
    ['work', 'study', 'grades', 'info'],
  );
  assert.deepEqual(
    courseViews('mth140', archivedInfo('mth140', false)).map(([view]) => view),
    ['work', 'study', 'info'],
  );
});

test('with the views option, links to views an archived course does not offer open Work', () => {
  const open = archivedInfo('mth141', true);
  const closed = archivedInfo('mth141', false);
  ['#schedule', '#deadlines', '#calendar', '#course-schedule'].forEach((hash) => {
    assert.equal(resolveCourseLocation(hash, 'mth141', open).view, 'schedule', 'opt-in: unchanged without the option');
    assert.deepEqual(resolveCourseLocation(hash, 'mth141', open, offered('mth141', open)), resolveCourseLocation('#work', 'mth141', open));
  });
  ['#grades', '#grade-calculator', '#calculator', '#marks'].forEach((hash) => {
    assert.equal(resolveCourseLocation(hash, 'mth141', open, offered('mth141', open)).view, 'grades');
    assert.equal(resolveCourseLocation(hash, 'mth141', closed).view, 'grades', 'opt-in: unchanged without the option');
    assert.deepEqual(resolveCourseLocation(hash, 'mth141', closed, offered('mth141', closed)), resolveCourseLocation('#work', 'mth141', closed));
  });
  assert.equal(resolveCourseLocation('#study', 'mth141', closed, offered('mth141', closed)).view, 'study');
  assert.equal(resolveCourseLocation('#work/done', 'mth141', closed, offered('mth141', closed)).filter, 'done');
  const cen = archivedInfo('cen100', false);
  ['#schedule', '#grades', '#study'].forEach((hash) => {
    assert.equal(resolveCourseLocation(hash, 'cen100', cen, offered('cen100', cen)).view, 'work');
  });
});

test('an archived course keeps its item and lasting info links', () => {
  const cen = archivedInfo('cen100', false);
  const location = resolveCourseLocation('#assignment-m2', 'cen100', cen, offered('cen100', cen));
  assert.equal(location.item?.id, 'm2');
  assert.equal(location.view, 'work');
  const math = archivedInfo('mth140', false);
  assert.equal(resolveCourseLocation('#assessment-midterm', 'mth140', math, offered('mth140', math)).kind, 'assessment');
  assert.equal(resolveCourseLocation('#topic-limits', 'mth140', math, offered('mth140', math)).view, 'study');
  ['course-grading', 'policy-regrade', 'sources'].forEach((id) => {
    const answer = resolveCourseLocation(`#${id}`, 'mth140', math, offered('mth140', math));
    assert.equal(answer.view, 'info');
    assert.equal(answer.panel, id);
    assert.equal(answer.infoDetail, true);
  });
  assert.equal(resolveCourseLocation('#course-grading', 'cen100', cen, offered('cen100', cen)).panel, 'course-grading');
});

test('Course info entries removed with the term open the Course info list', () => {
  const cen = archivedInfo('cen100', true);
  const math = archivedInfo('mth141', true);
  // Without the option they fall back to Work, as any unknown link does.
  assert.equal(resolveCourseLocation('#contacts', 'cen100', cen).view, 'work');
  [
    ['cen100', cen, '#contacts'],
    ['cen100', cen, '#pending-final-exam'],
    ['cen100', cen, '#confirmed-whmis'],
    ['mth141', math, '#contacts'],
    ['mth141', math, '#policy-notice'],
    ['mth141', math, '#%63ontacts'],
  ].forEach(([id, info, hash]) => {
    const location = resolveCourseLocation(hash, id, info, offered(id, info));
    assert.equal(location.view, 'info', `${id} ${hash}`);
    assert.equal(location.panel, null);
    assert.equal(location.item, null);
  });
  assert.equal(resolveCourseLocation('#section-picker', 'cen100', cen, offered('cen100', cen)).view, 'info');
  assert.equal(resolveCourseLocation('#policy-unknown', 'mth141', math, offered('mth141', math)).view, 'work');
});
