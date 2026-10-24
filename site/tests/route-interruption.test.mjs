import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const source = readFileSync(new URL('../src/components/dom/NavigationFeedback.jsx', import.meta.url), 'utf8');

// Next rejects the render of a page change that a newer one replaced, and its
// Back/Forward handler leaves that rejection unhandled: two quick Back presses
// raised "Cancel rendering route" as a page error.
test('a page change interrupted by a newer one is not a page error, and nothing else is hidden', () => {
  const start = source.indexOf('const interrupted = ');
  const end = source.indexOf('};', start) + 2;
  assert.ok(start > 0, 'the unhandled-rejection filter exists');
  const interrupted = new Function(`${source.slice(start, end)}\nreturn interrupted;`)();
  const event = (reason) => ({ reason, prevented: false, preventDefault() { this.prevented = true; } });
  const cancelled = Object.assign(new Error('Cancel rendering route'), { cancelled: true });
  const real = new Error('A real failure');
  const outcomes = [event(cancelled), event(real), event(undefined), event('text')].map((e) => {
    interrupted(e);
    return e.prevented;
  });
  assert.deepEqual(outcomes, [true, false, false, false]);
  assert.match(source, /window\.addEventListener\('unhandledrejection', interrupted\);/);
  assert.match(source, /window\.removeEventListener\('unhandledrejection', interrupted\);/);
});
