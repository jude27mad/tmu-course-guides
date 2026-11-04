/* One list entry per content item, and one calendar event per dated deadline row.
   Dates, completion and section filtering come from deadlines(); nothing here writes storage. */
import { fast } from './perf.mjs';
import { deadlines, buckets, mondayOf, toMs } from './deadlines.mjs';
import { COURSES as DATA } from './vendor/course-data.mjs';
import { today, addDays } from './vendor/schedule.mjs';
import * as CEN from './content/cen.mjs';

const anchorFor = (courseId, id) => `${courseId === 'cen100' ? 'assignment' : 'assessment'}-${id}`;
const leadDate = (entry) => entry.lead?.date || entry.lead?.week || null;
const firstDate = (entries) => leadDate(entries.find((entry) => leadDate(entry)) || {});

function assignmentListNow(courseId, { now, items } = {}) {
  const ms = toMs(now);
  const day = today(new Date(ms));
  const content = courseId === 'cen100' ? CEN.allItems : DATA[courseId]?.assessments || [];
  const rowsByItem = new Map();
  for (const row of items ?? deadlines(courseId, { now: ms })) {
    const id = courseId === 'cen100' ? row.item : row.id;
    if (!rowsByItem.has(id)) rowsByItem.set(id, []);
    rowsByItem.get(id).push(row);
  }
  const groups = { pastDue: [], thisWeek: [], nextWeek: [], later: [], done: [] };
  const entries = content.map((item) => {
    // Stable sort keeps the existing deadline order when sort keys tie.
    const rows = (rowsByItem.get(item.id) || []).sort((a, b) => a.sortKey - b.sortKey);
    const records = rows.filter((row) => row.markable === true);
    const recorded = records.filter((row) => row.done).length;
    // Lead with the next unfinished record that has not passed, so a part due this week is never shown
    // under an earlier part's date. Only an item whose open records have all passed is Past due; an
    // earlier part that passed unmarked still sets pastDue (and `missed`) for its row.
    const lead = records.find((row) => !row.done && !row.overdue) || records.find((row) => !row.done) || records[records.length - 1] || null;
    const done = records.length > 0 && recorded === records.length;
    const pastDue = records.some((row) => row.overdue);
    const missed = records.filter((row) => row.overdue).length;
    let group = 'later';
    if (done) group = 'done';
    else if (lead?.overdue) group = 'pastDue';
    else if (lead) {
      const week = buckets([lead], ms);
      if (week.thisWeek.length) group = 'thisWeek';
      else if (week.nextWeek.length) group = 'nextWeek';
    }
    const entry = {
      id: item.id,
      courseId,
      anchor: anchorFor(courseId, item.id),
      title: courseId === 'cen100' ? item.name : item.title,
      list: courseId === 'cen100' ? CEN.listOf(item) : null,
      rows,
      records,
      recorded,
      missed,
      lead,
      done,
      pastDue,
      group,
    };
    groups[group].push(entry);
    return entry;
  });
  // Groups start in content order; stable sorting keeps that order for tied/undated leads.
  for (const group of Object.values(groups)) group.sort((a, b) => (a.lead?.sortKey ?? Infinity) - (b.lead?.sortKey ?? Infinity));
  const pastDates = groups.pastDue.map(leadDate).filter(Boolean).sort();
  const focus = {
    pastDue: pastDates[0] || null,
    thisWeek: firstDate(groups.thisWeek) ? day : null,
    nextWeek: firstDate(groups.nextWeek) ? addDays(mondayOf(day), 7) : null,
    later: firstDate(groups.later),
    done: null,
  };
  return { ...groups, entries, today: day, focus };
}

function calendarEventsNow(courseId, items = []) {
  const assessments = new Map((DATA[courseId]?.assessments || []).map((item) => [item.id, item]));
  const events = [];
  for (const row of items) {
    const target = row.target || {};
    let title = row.title;
    let qualifier = '';
    let style = 'due';
    let allDay = false;
    let start;
    let end;
    if (row.precision === 'exact') {
      if (!Number.isFinite(target.at)) continue;
      start = target.at;
      end = target.end ?? start;
      if (target.endOfDay) {
        start -= 60000;
        end = start;
      } else if (target.end != null && assessments.get(row.id)?.kind === 'quiz') {
        style = 'window';
        qualifier = 'Lab window';
        if (assessments.get(row.id).quizSecondHour) {
          title += " · in your lab's second hour";
          qualifier = "Quiz is in your lab's second hour";
        }
      }
    } else if (row.precision === 'day') {
      if (!row.date) continue;
      allDay = true;
      start = row.date;
      end = row.date;
      style = 'day';
      qualifier = 'Time not posted';
    } else if (row.precision === 'week') {
      if (!row.week || !target.weekEnd) continue;
      allDay = true;
      start = row.week;
      end = target.weekEnd;
      style = 'week';
      title = `Quiz week · ${title}`;
      qualifier = target.holiday ? 'Date needs confirmation' : 'Date depends on your lab section';
    } else continue;
    if (row.kind === 'reminder') style = 'reminder';
    if (row.done) style = 'done';
    events.push({
      id: `${courseId}:${row.id}`,
      rowId: row.id,
      anchor: anchorFor(courseId, courseId === 'cen100' ? row.item : row.id),
      title,
      qualifier,
      style,
      allDay,
      start,
      end,
    });
  }
  return events;
}

export const assignmentList = fast(assignmentListNow);
export const calendarEvents = fast(calendarEventsNow);
