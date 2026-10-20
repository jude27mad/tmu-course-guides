/* global Temporal */
import 'temporal-polyfill/global';
import '@schedule-x/theme-default/dist/index.css';

import { ScheduleXCalendar, useCalendarApp } from '@schedule-x/react';
import { createViewDay, createViewWeek, createViewMonthGrid, createViewMonthAgenda } from '@schedule-x/calendar';
import { createCalendarControlsPlugin } from '@schedule-x/calendar-controls';
import { createEventsServicePlugin } from '@schedule-x/events-service';
import { useEffect, useState } from 'react';

// Fixed synthetic dates: no course data, saved progress, or deadline calculations.
function sampleEvents() {
  const date = (value) => Temporal.PlainDate.from(value);
  const time = (value) => Temporal.ZonedDateTime.from(`${value}[America/Toronto]`);
  return [
    { id: 'timed', title: "Quiz 2 · in your lab's second hour", start: time('2026-10-20T08:00'), end: time('2026-10-20T10:00') },
    { id: 'all-day', title: 'Time not posted · All-day sample', start: date('2026-10-21'), end: date('2026-10-21') },
    { id: 'quiz-week', title: 'Quiz week · Quiz 2 · date depends on your lab section', start: date('2026-10-19'), end: date('2026-10-23') },
    ...Array.from({ length: 5 }, (_, index) => ({ id: `busy-${index}`, title: `Busy-day event ${index + 1}`, start: date('2026-10-22'), end: date('2026-10-22') })),
  ];
}

export default function CalendarProbe({ responsive, view, overrideMore }) {
  const [controls] = useState(createCalendarControlsPlugin);
  const [events] = useState(createEventsServicePlugin);
  const calendar = useCalendarApp(
    {
      views: [createViewMonthGrid(), createViewMonthAgenda(), createViewWeek(), createViewDay()],
      defaultView: view,
      selectedDate: Temporal.PlainDate.from('2026-10-19'),
      timezone: 'America/Toronto',
      firstDayOfWeek: 1,
      isResponsive: responsive,
      events: sampleEvents(),
      callbacks: overrideMore
        ? {
            onClickPlusEvents: (date) => {
              window.spikeMoreClicks = [...(window.spikeMoreClicks || []), date.toString()];
            },
          }
        : {},
    },
    [controls, events],
  );

  useEffect(() => {
    // Deliberately exposed only by this disposable measurement page.
    window.spikeCalendar = { controls, events };
    return () => {
      delete window.spikeCalendar;
    };
  }, [controls, events]);

  return <ScheduleXCalendar calendarApp={calendar} />;
}
