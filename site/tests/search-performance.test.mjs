import test from 'node:test';
import assert from 'node:assert/strict';
import { searchGuide } from '../src/lib/search.mjs';

test('guide searches normalize the query without revisiting the full course text', t => {
  const normalize = String.prototype.normalize;
  const normalized = [];
  t.mock.method(String.prototype, 'normalize', function (...args) {
    normalized.push(String(this));
    return normalize.apply(this, args);
  });
  const query = 'FÍSHBONE';
  const result = searchGuide(query);
  assert.deepEqual(result.results.map(item => item.title), ['Failure Analysis Labs', 'Failure Analysis']);
  assert.ok(normalized.length > 0, 'accent-insensitive queries still need normalization');
  assert.ok(normalized.every(value => value === query), 'course text must be normalized when indexed, not on every keystroke');
});

test('cached guide search keeps accents, limits and its public result shape', () => {
  const result = searchGuide('  FÍSHBONE  ', { course: 'cen100', limit: 1 });
  assert.equal(result.total, 2);
  assert.equal(result.status, '2 results.');
  assert.deepEqual(result.results, [{ courseId: 'cen100', title: 'Failure Analysis Labs', tab: 'Team', href: '/cen100/#assignment-m3' }]);
  assert.equal(searchGuide('fishbone', { course: 'mth140' }).results.length, 0);
  assert.equal(searchGuide('fishbone', { limit: 0 }).results.length, 0);
  assert.equal(searchGuide('fishbone', { limit: 0 }).total, 2);
  assert.deepEqual(searchGuide('   '), { results: [], status: '' });
});
