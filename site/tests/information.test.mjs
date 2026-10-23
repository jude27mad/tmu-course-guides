import test from 'node:test';
import assert from 'node:assert/strict';
import { courseInfo, searchGuide, searchIndex, searchEntries } from '../src/lib/index.js';
import { informationEntries, informationText } from '../src/lib/information.mjs';
import { resolveCourseLocation } from '../src/pages/course/components/workspace/location.mjs';

test('every policy fact and qualification has an individually addressable answer', () => {
  for (const course of ['cen100', 'mth140', 'mth141']) {
    const info = courseInfo(course);
    const entries = informationEntries(course, info);
    assert.equal(new Set(entries.map((entry) => entry.id)).size, entries.length);
    const content = entries.map((entry) => informationText(entry, info)).join(' ');
    const cards = [...info.rules, ...(info.confirmed || []), ...(info.open || []), ...(info.notice ? [info.notice] : [])];
    for (const card of cards) {
      for (const text of card.blocks?.flatMap((block) => block.items || block.text) || [card.text]) assert.ok(content.includes(text), `${course}: ${text}`);
    }
    for (const entry of entries) {
      const location = resolveCourseLocation(`#${entry.id}`, course, info);
      assert.equal(location.infoDetail, true, entry.id);
      assert.equal(location.panel, entry.id);
    }
  }
});

test('both searches find policy answers and link directly to them', () => {
  const index = searchIndex({ now: new Date('2026-10-23T16:00:00Z'), course: 'mth141' });
  for (const course of ['mth140', 'mth141']) {
    assert.ok(searchGuide('regrade', { course }).results.some((entry) => entry.href === `/${course}/#policy-regrade`));
    assert.ok(searchEntries(index, `${course} regrade`).some((entry) => entry.href === `/${course}/#policy-regrade`));
  }
  assert.ok(searchGuide('real people', { course: 'cen100' }).results.some((entry) => entry.href === '/cen100/#policy-real-data'));
  assert.ok(searchGuide('3 business days', { course: 'mth141' }).results.some((entry) => entry.href === '/mth141/#policy-missed-assessment'));
});

test('exercise references are searchable without opening every topic', () => {
  const info = courseInfo('mth140');
  const topic = info.topics.find((entry) => entry.practice.length);
  const reference = topic.practice[0].rows[0].text;
  assert.ok(searchGuide(reference, { course: 'mth140' }).results.some((entry) => entry.href === `/mth140/#${topic.anchor}`));
});
