/* The calendar term week for a moment, from the same semester model as search and the deadline contracts. */
import { semesterWeeks, termWeek } from './vendor/book/weeks.mjs';
import { weekCopy } from './vendor/night/palette.mjs';
import { today } from './vendor/schedule.mjs';

const TERM = semesterWeeks();

/**
 * This Toronto day's term week: { number, label: "Week 8 · Oct 26–Nov 1", ariaLabel }, or null outside the term
 * (before Sep 8 or after Dec 21). Unlike weeklyChecklist().week, it never moves ahead to a week that has work.
 */
export function currentTermWeek(now = Date.now()) {
  const number = termWeek(today(new Date(now)));
  if (!number) return null;
  return { number, ...weekCopy(TERM[number - 1]) };
}
