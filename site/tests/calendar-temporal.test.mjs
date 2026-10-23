import test from 'node:test';
import assert from 'node:assert/strict';

test('calendar Temporal setup leaves existing Date/Intl formatting untouched', async () => {
  const format = Intl.DateTimeFormat;
  const locale = Date.prototype.toLocaleDateString;
  const { Temporal } = await import('../src/pages/course/components/workspace/calendarTemporal.mjs');
  const { toScheduleXEvent } = await import('../src/pages/course/components/workspace/calendarAdapter.mjs');
  assert.equal(Intl.DateTimeFormat, format);
  assert.equal(Date.prototype.toLocaleDateString, locale);
  assert.equal(globalThis.Temporal, Temporal);
  const event = toScheduleXEvent({ id: 'cen100:m2', title: 'Outline', start: '2026-10-02', end: '2026-10-02', allDay: true, anchor: 'assignment-m2' });
  assert.ok(event.start instanceof Temporal.PlainDate);
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', hour: 'numeric' }).formatToParts(new Date('2026-11-04T20:00Z'));
  assert.equal(parts.find((part) => part.type === 'hour').value, '3');
});
