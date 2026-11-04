import { test } from 'node:test';
import assert from 'node:assert/strict';
import { currentTermWeek } from '../src/lib/weeks.mjs';
import { toronto } from './helpers.mjs';

test('currentTermWeek: the calendar week of the Toronto day, never the next week with work', () => {
  assert.deepEqual(currentTermWeek(toronto('2026-09-09', '12:00')), { number: 1, label: 'Week 1 · Sep 8–13', ariaLabel: 'Week 1, September 8 to 13. Partial first week' });
  assert.equal(currentTermWeek(toronto('2026-10-28', '00:15')).label, 'Week 8 · Oct 26–Nov 1');
  assert.equal(currentTermWeek(toronto('2026-12-21', '23:59')).number, 16);
});

test('currentTermWeek: Toronto midnight and the Nov 1 DST change decide the week', () => {
  assert.equal(currentTermWeek(toronto('2026-11-01', '23:59')).number, 8);
  assert.equal(currentTermWeek(toronto('2026-11-02', '00:00')).number, 9);
  // 03:30 UTC on Monday is still Sunday evening in Toronto.
  assert.equal(currentTermWeek(Date.UTC(2026, 10, 2, 3, 30)).number, 8);
});

test('currentTermWeek: null outside the term; accepts a Date or epoch ms', () => {
  assert.equal(currentTermWeek(toronto('2026-09-07', '12:00')), null);
  assert.equal(currentTermWeek(toronto('2026-12-22', '00:00')), null);
  assert.equal(currentTermWeek(new Date(toronto('2026-10-05', '09:00'))).number, 5);
});
