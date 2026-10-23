import assert from 'node:assert/strict';
import test from 'node:test';
import { courseInfo } from '../src/lib/info.mjs';
import { resolveHash } from '../src/pages/course/components/assignments/deepLinks.mjs';

const panelsByCourse = {
  cen100: ['p-rules', 'p-confirmed', 'p-open'],
  mth140: ['rules-help', 'textbooks', 'sources'],
  mth141: ['rules-help', 'textbooks', 'sources'],
};
const none = { kind: 'none', target: null, openGroup: null, openPanel: null };

for (const [courseId, panels] of Object.entries(panelsByCourse)) {
  const info = courseInfo(courseId);
  const items = info.items || info.assessments;
  const options = { courseId, entries: [], panels };

  for (const id of ['p-team', 'p-you', 't-team', 't-you', 'panel-assessments']) {
    test(`${courseId}: legacy ${id} opens the assignments section`, () => {
      assert.deepEqual(resolveHash(id, options), { kind: 'section', target: 'assignments', openGroup: null, openPanel: null });
    });
  }

  test(`${courseId}: study keeps the course's intended destination`, () => {
    assert.deepEqual(resolveHash('study', options), {
      kind: 'section', target: courseId === 'cen100' ? 'assignments' : 'study', openGroup: null, openPanel: null,
    });
  });

  for (const group of ['pastDue', 'thisWeek', 'nextWeek', 'later', 'done']) {
    test(`${courseId}: every ${group} item resolves to its row${group === 'done' ? ' and opens Done first' : ''}`, () => {
      const entries = Object.freeze(items.map(({ anchor }) => Object.freeze({ anchor, group })));
      for (const { anchor } of entries) {
        assert.deepEqual(resolveHash(anchor, { ...options, entries }), {
          kind: 'row', target: anchor, openGroup: group === 'done' ? 'done' : null, openPanel: null,
        });
      }
    });
  }

  for (const id of panels) {
    test(`${courseId}: ${id} opens its panel`, () => {
      assert.deepEqual(resolveHash(id, options), { kind: 'panel', target: id, openGroup: null, openPanel: id });
    });
  }

  test(`${courseId}: t-rules opens the legacy p-rules panel`, () => {
    assert.deepEqual(resolveHash('t-rules', options), { kind: 'panel', target: 'p-rules', openGroup: null, openPanel: 'p-rules' });
  });

  test(`${courseId}: unrelated and unknown ids stay with existing handlers`, () => {
    const entries = [...items.map(({ anchor }) => ({ anchor, group: 'later' })), { anchor: 'topic-limits', group: 'done' }];
    for (const id of [
      'contacts', 'course-info', 'section-picker', 'guide-tools', 'math-tools', 'topic-limits', 'topic-unknown',
      'unknown', 'assignment-unknown', 'assessment-unknown', `${items[0].anchor}-details`,
      ...Object.values(panelsByCourse).flat().filter((panel) => !panels.includes(panel)),
    ]) {
      assert.deepEqual(resolveHash(id, { ...options, entries }), none, id);
    }
  });

  test(`${courseId}: empty ids do not claim a destination`, () => {
    for (const id of ['', null, undefined]) assert.deepEqual(resolveHash(id, options), none);
  });
}

test('empty input and missing collections are safe', () => {
  assert.deepEqual(resolveHash(), none);
  assert.deepEqual(resolveHash('', {}), none);
  assert.deepEqual(resolveHash('assignment-m2', { courseId: 'cen100' }), none);
  assert.deepEqual(resolveHash('p-rules', { courseId: 'cen100', entries: [], panels: [] }), none);
  assert.deepEqual(resolveHash('study', { courseId: 'unknown' }), none);
});
