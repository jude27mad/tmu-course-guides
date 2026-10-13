import test from 'node:test';
import assert from 'node:assert/strict';
import { RESILIENCE_CHECKS, IPHONE, expectedTarget, expectedChip, expectedFailureEvent, readableDate, seedDeadlines, webkit } from './checks-resilience.mjs';

test('resilience checks register all seven names with mobile WebKit dimensions', () => {
  assert.deepEqual(Object.keys(RESILIENCE_CHECKS), ['webkit', 'nojs', 'bfcache', 'failures', 'crosstab', 'clock', 'forward']);
  assert.equal(IPHONE.viewport.width, 390);
  assert.equal(IPHONE.hasTouch, true);
  assert.equal(IPHONE.deviceScaleFactor, 3);
});

test('a missing WebKit binary reports a skip with no passing assertions', async () => {
  const report = await webkit({ playwright: { webkit: { launch: async () => { throw Error('Executable does not exist'); } } } });
  assert.equal(report.assertions.length, 0);
  assert.equal(report.skipped.length, 1);
  assert.match(report.skipped[0].reason, /Executable does not exist/);
});

test('clock oracle uses canonical CEN end-of-day deadlines and advances at Toronto midnight', () => {
  const seed = seedDeadlines('cen100', ['whmis', 'failure'], 1), copy = structuredClone(seed);
  const before = Date.parse('2026-10-15T03:59:30Z'), after = Date.parse('2026-10-15T04:00:30Z');
  const first = expectedTarget('cen100', seed, before), next = expectedTarget('cen100', seed, after);
  assert.equal(first.id, 'whmis');
  assert.equal(first.at, Date.parse('2026-10-15T04:00:00Z'));
  assert.equal(expectedChip(first, before, true), '0m left');
  assert.equal(next.id, 'failure');
  assert.equal(expectedChip(first, after), 'Due time passed');
  assert.deepEqual(seed, copy, 'fixtures are read-only and cannot change product records');
});

test('DST repeated Toronto hour and a backwards jump use elapsed absolute time', () => {
  const seed = seedDeadlines('mth140', ['quiz-3', 'quiz-4'], 31);
  const before = Date.parse('2026-11-01T05:59:30Z'), after = Date.parse('2026-11-01T06:00:30Z');
  const target = expectedTarget('mth140', seed, before);
  assert.equal(target.id, 'quiz-3');
  assert.equal(expectedTarget('mth140', seed, after).at, target.at);
  const near = target.at - 30 * 60_000;
  assert.equal(expectedChip(target, near), '30m');
  assert.equal(expectedChip(target, near - 60 * 60_000), '1h 30m');
  assert.ok(!expectedChip(target, target.at + 60_000).includes('-'));
});

test('intentional HTTP404 diagnostics allow only that exact request URL', () => {
  const target = 'http://127.0.0.1:3000/tmu-course-guides/cen10o/';
  const fixture = { target, mode: '404' };
  assert.equal(expectedFailureEvent({ type: 'http', requestUrl: target, status: 404 }, fixture), true);
  assert.equal(expectedFailureEvent({ type: 'console', location: { url: target }, message: 'Failed to load resource: the server responded with a status of 404 (Not Found)' }, fixture), true);
  assert.equal(expectedFailureEvent({ type: 'http', requestUrl: target, status: 500 }, fixture), false);
  assert.equal(expectedFailureEvent({ type: 'http', requestUrl: target + 'other', status: 404 }, fixture), false);
  assert.equal(expectedFailureEvent({ type: 'pageerror', message: 'TypeError in coursework' }, fixture), false);
  assert.equal(expectedFailureEvent({ type: 'console', location: { url: target }, message: 'Unexpected coursework exception' }, fixture), false);
});

test('machine-only datetime and placeholder text do not count as readable assessment dates', () => {
  const date = '2026-10-23';
  assert.equal(readableDate(date, { datetime: date, text: '' }), false);
  assert.equal(readableDate(date, { datetime: date, text: 'Date placeholder' }), false);
  assert.equal(readableDate(date, { datetime: date, text: 'Oct 24' }), false);
  assert.equal(readableDate(date, { datetime: date, text: 'Fri, Oct 23, 2026' }), true);
  assert.equal(readableDate(date, { datetime: date, text: date }), true);
});

test('offline injection allows only exact previously warmed URL diagnostics', () => {
  const resource = 'http://127.0.0.1:3000/assets/scenes/posters/mth140-wide.webp?v=one';
  const fixture = { mode: 'offline', offlineURLs: new Set([resource]) };
  assert.equal(expectedFailureEvent({ type: 'requestfailed', requestUrl: resource, message: 'net::ERR_INTERNET_DISCONNECTED' }, fixture), true);
  assert.equal(expectedFailureEvent({ type: 'console', location: { url: resource }, message: 'Failed to load resource: net::ERR_INTERNET_DISCONNECTED' }, fixture), true);
  assert.equal(expectedFailureEvent({ type: 'requestfailed', requestUrl: resource + 'other', message: 'net::ERR_INTERNET_DISCONNECTED' }, fixture), false);
  assert.equal(expectedFailureEvent({ type: 'console', location: { url: resource }, message: 'Unexpected exception' }, fixture), false);
});
