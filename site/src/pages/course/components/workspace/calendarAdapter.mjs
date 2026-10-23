import { Temporal } from './calendarTemporal.mjs';

// Schedule-X requires selector-safe IDs. Only this presentation ID changes;
// the model's deadline IDs, completion keys and shared anchors stay untouched.
export const toScheduleXEvent = (event) => ({
  id: event.id.replaceAll(':', '-'),
  title: [event.title, event.qualifier].filter(Boolean).join(' · '),
  start: event.allDay ? Temporal.PlainDate.from(event.start) : Temporal.Instant.fromEpochMilliseconds(event.start).toZonedDateTimeISO('America/Toronto'),
  end: event.allDay ? Temporal.PlainDate.from(event.end) : Temporal.Instant.fromEpochMilliseconds(event.end).toZonedDateTimeISO('America/Toronto'),
  calendarId: event.style === 'done' ? 'done' : 'due',
  anchor: event.anchor,
});
