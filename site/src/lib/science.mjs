/* Deadline rules for CHY102 and PCS211, in the vendored resolver's target shape so every page, the Desk and the
   overall winner treat them like the other guides. Toronto time and formatting come from vendor/schedule.mjs.

   - Homework, tasks and exam wrappers are *due* ("Due"); a midterm *starts* at its time ("Test starts").
   - A dated item with a time is exact. A date without a time is a day (never an invented time).
   - A `window` (PCS211 labs and tutorials, CHY102 exam wrappers) has precision 'week' with `window: true`: the span
     the outline publishes (`windowStart`–`weekEnd`), with no countdown. `chip` is its short status. Against other
     work (the course's next card, the Desk's overall winner) a window ranks by its last day, `week`: a session whose
     day is not published must not hide a dated deadline for two weeks.
   - No date and no window: pending (the final), listed after everything dated.
   Pure: no DOM or storage access. */
import { timestamp, clock, dateLabel, dayLabel, today, addDays } from './vendor/schedule.mjs';

const short = (date) => `${dayLabel(date).slice(0, 3)} ${dateLabel(date)}`;
const DUE = new Set(['homework', 'wrapper', 'task', 'webassign']);
const CHIPS = {
  lab: 'Lab weeks',
  tutorial: 'Tutorial weeks',
  wrapper: 'Due this week',
};

/** "Sep 14–25", "Oct 26–Nov 6". */
export function rangeLabel(start, end) {
  const last = dateLabel(end);
  return `${dateLabel(start)}–${start.slice(0, 7) === end.slice(0, 7) ? last.replace(/^\S+ /, '') : last}`;
}

/** The assessment with its resolved dates: { ...a, date, week, weekEnd, sortDate, lab: null }. */
export function scienceEvent(a) {
  if (a.window)
    return {
      ...a,
      date: null,
      week: a.window.start,
      weekEnd: a.window.end,
      sortDate: a.window.start,
      lab: null,
    };
  return { ...a, week: null, lab: null, sortDate: a.date || '9999-12-31' };
}

/** Whether the item's time (or day, or window) is over. */
export function sciencePassed(e, now = new Date()) {
  const ms = +now;
  if (e.date && e.time) return timestamp(e.date, e.end || e.time) < ms;
  if (e.date) return e.date < today(new Date(ms));
  if (e.window) return e.window.end < today(new Date(ms));
  return false;
}

/** The sentence a card and the Work list show: "Monday, Sep 21 · due 11:59 PM Toronto time". */
export function scienceTiming(e) {
  if (e.date && e.time) {
    const day = `${dayLabel(e.date)}, ${dateLabel(e.date)}`;
    return DUE.has(e.kind) ? `${day} · due ${clock(e.time)} Toronto time` : `${day} · ${clock(e.time)}–${clock(e.end || e.time)} Toronto time`;
  }
  if (e.date) return `${dayLabel(e.date)}, ${dateLabel(e.date)} · time not posted`;
  if (e.window) return `${rangeLabel(e.window.start, e.window.end)} · ${e.timingText}`;
  return e.timingText || 'Date to be announced';
}

/** The date tile a card shows ({ top, main, bottom, unknown }). */
export function scienceTile(e) {
  if (e.date) {
    const [month, day] = dateLabel(e.date).split(' ');
    return { top: month, main: day, bottom: '', unknown: false };
  }
  if (e.window)
    return {
      top: 'Weeks of',
      main: dateLabel(e.window.start),
      bottom: CHIPS[e.kind] || '',
      unknown: true,
    };
  if (e.kind === 'final') return { top: 'Final', main: 'DEC', bottom: 'Date pending', unknown: true };
  return { top: '', main: '—', bottom: 'No date', unknown: true };
}

/** One assessment as a target. */
export function describeScience(course, a) {
  const base = {
    course,
    id: a.id,
    title: a.title,
    kind: a.kind,
    open: `assessment-${a.id}`,
  };
  const note = a.dateNote || null;
  if (a.date && a.time) {
    const due = DUE.has(a.kind);
    return {
      ...base,
      precision: 'exact',
      at: timestamp(a.date, a.time),
      end: a.end && a.end !== a.time ? timestamp(a.date, a.end) : null,
      when: `${short(a.date)} · ${clock(a.time)} Toronto`,
      label: due ? 'Due' : 'Test starts',
      note,
    };
  }
  if (a.date)
    return {
      ...base,
      precision: 'day',
      date: a.date,
      when: short(a.date),
      label: 'Deadline · time not posted',
      note,
    };
  if (a.window) {
    const range = rangeLabel(a.window.start, a.window.end);
    return {
      ...base,
      precision: 'week',
      window: true,
      windowStart: a.window.start,
      week: a.window.end,
      weekEnd: a.window.end,
      range,
      when: `${range} · ${a.timingText}`,
      label: CHIPS[a.kind] || 'Due this week',
      chip: CHIPS[a.kind] || 'Due this week',
      note,
    };
  }
  if (a.kind === 'final')
    return {
      ...base,
      precision: 'pending',
      when: 'Date pending',
      label: 'Awaiting the official schedule',
    };
  return {
    ...base,
    precision: 'pending',
    undated: true,
    when: 'No date',
    label: a.timingText || 'See details',
  };
}

const orderKey = (a) => (a.date ? timestamp(a.date, a.time || '23:59') : a.window ? timestamp(a.window.end, '00:00') : Infinity);
const isDone = (completed, id) => completed?.[id] === true || completed?.[id] === 1;

/** The next target for a course (or the item `id` describes), as targets.mjs resolveTarget() answers for the others. */
export function scienceTarget({ course, data, completed = {}, now = Date.now(), id = null } = {}) {
  if (!data) return null;
  if (id) {
    const a = data.assessments.find((x) => x.id === id);
    return a ? describeScience(course, a) : null;
  }
  const date = new Date(+now);
  const next = data.assessments
    .filter((a) => (a.date || a.window) && !isDone(completed, a.id) && !sciencePassed(scienceEvent(a), date))
    .sort((a, b) => orderKey(a) - orderKey(b) || a.id.localeCompare(b.id))[0];
  const a = next || data.assessments.find((x) => x.kind === 'final' && !x.date && !isDone(completed, x.id));
  if (a) return describeScience(course, a);
  return {
    course,
    id: null,
    title: 'No dated assessment ahead',
    kind: null,
    open: null,
    precision: 'empty',
    when: 'Nothing dated is left in your records',
    label: 'Nothing scheduled',
  };
}

/** "Lab weeks" for a window that is open or ahead, "Window passed" after it, "No date" for an undated item that is
    not the final; null for any other target (the vendored wording applies). */
export function windowStatus(t, now = Date.now()) {
  if (t?.undated) return 'No date';
  if (!t?.window) return null;
  return t.weekEnd < today(new Date(+now)) ? 'Window passed' : t.chip;
}

// ---- Calendar file (.ics) ----
const escapeICS = (value) => String(value).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
function fold(line) {
  const encoder = new TextEncoder();
  const rows = [];
  let row = '';
  for (const char of line) {
    if (encoder.encode(row + char).length > 75) {
      rows.push(row);
      row = ` ${char}`;
    } else row += char;
  }
  rows.push(row);
  return rows.join('\r\n');
}
const stamp = (ms) =>
  new Date(ms)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');

/**
 * The course's dated work as an .ics file, in the format the math guides export: timed items at their Toronto
 * time, dates and windows as tentative all-day events, undated items left out. { text, count }.
 */
export function scienceCalendar(course, { onlyUpcoming = true, now = new Date() } = {}) {
  const events = course.assessments.filter((a) => (a.date || a.window) && (!onlyUpcoming || !sciencePassed(scienceEvent(a), now)));
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//TMU Course Guides//Fall 2026//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  for (const a of events) {
    lines.push('BEGIN:VEVENT', `UID:${course.code.toLowerCase()}-${a.id}-all-f26@jude27mad.github.io`, `DTSTAMP:${stamp(+now)}`);
    if (a.date && a.time) {
      const end = a.end && a.end !== a.time ? a.end : a.time;
      lines.push(`DTSTART:${stamp(timestamp(a.date, a.time))}`, `DTEND:${stamp(timestamp(a.date, end))}`);
    } else {
      const start = a.date || a.window.start;
      const last = a.date || a.window.end;
      lines.push(`DTSTART;VALUE=DATE:${start.replace(/-/g, '')}`, `DTEND;VALUE=DATE:${addDays(last, 1).replace(/-/g, '')}`, 'STATUS:TENTATIVE');
    }
    const note = a.window ? ' Your session’s exact day is on D2L.' : ' Check D2L for rooms and updates.';
    lines.push(`SUMMARY:${escapeICS(`${course.code} ${a.title}${a.window ? ` (${CHIPS[a.kind] || 'due this week'})` : ''}`)}`);
    lines.push(`DESCRIPTION:${escapeICS(`${a.scope} Source: ${a.source}${note}`)}`);
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return { text: `${lines.map(fold).join('\r\n')}\r\n`, count: events.length };
}
