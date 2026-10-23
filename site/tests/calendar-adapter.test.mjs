import test from 'node:test';
import assert from 'node:assert/strict';
import { toScheduleXEvent } from '../src/pages/course/components/workspace/calendarAdapter.mjs';

test('calendar IDs are selector-safe while assignment links and Toronto DST remain intact', () => {
  const event = toScheduleXEvent({
    id: 'cen100:notebook-1',
    anchor: 'assignment-y6',
    title: 'Notebook checkpoint',
    qualifier: '',
    allDay: false,
    start: Date.parse('2026-11-04T20:00:00Z'),
    end: Date.parse('2026-11-04T20:00:00Z'),
    style: 'due',
  });
  assert.equal(event.id, 'cen100-notebook-1');
  assert.equal(event.anchor, 'assignment-y6');
  assert.equal(event.start.hour, 15);
  assert.equal(event.start.offset, '-05:00');
  const before = toScheduleXEvent({
    id: 'mth140:quiz-2',
    anchor: 'assessment-quiz-2',
    title: 'Quiz',
    qualifier: 'Lab window',
    allDay: false,
    start: Date.parse('2026-10-31T14:00:00Z'),
    end: Date.parse('2026-10-31T16:00:00Z'),
    style: 'window',
  });
  assert.equal(before.start.hour, 10);
  assert.equal(before.end.hour, 12);
  assert.equal(before.start.offset, '-04:00');
  assert.match(before.title, /Lab window/);
});

test('week precision stays an inclusive PlainDate band without an invented clock', () => {
  const event = toScheduleXEvent({
    id: 'mth141:quiz-2',
    anchor: 'assessment-quiz-2',
    title: 'Quiz week · Quiz 2',
    qualifier: 'Date needs confirmation',
    allDay: true,
    start: '2026-10-12',
    end: '2026-10-16',
    style: 'week',
  });
  assert.equal(event.start.toString(), '2026-10-12');
  assert.equal(event.end.toString(), '2026-10-16');
  assert.equal(event.start.hour, undefined);
  assert.match(event.title, /Date needs confirmation/);
});
