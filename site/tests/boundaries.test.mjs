import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import * as targets from '../src/lib/vendor/night/targets.mjs';
import * as weeks from '../src/lib/vendor/book/weeks.mjs';
import { today, addDays } from '../src/lib/vendor/schedule.mjs';
import { countdown } from '../src/lib/index.js';
import { ROOT, oldModule } from './helpers.mjs';

/* The 40 Toronto boundary fixtures of the old site (docs/qa/toronto-deadline-test-cases.json, run by the old
   tests/deadline-boundaries.test.mjs), through the vendored resolver and the new countdown(), and compared with
   the old modules. Each fixture becomes a one-record course, exactly as the old test built it. */
const cases = JSON.parse(readFileSync(new URL('docs/qa/toronto-deadline-test-cases.json', ROOT), 'utf8'));
const OLD = await oldModule('night/targets.mjs');
const WEEKDAY = { Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5 };
const WEEK_ONE_MONDAY = '2026-09-07';
const torontoWall = (instant) => {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(new Date(instant))
      .map((x) => [x.type, x.value]),
  );
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
};
const repeatedHour = ({ date, time }) => date === '2026-11-01' && time.startsWith('01:');
const course = (assessment, labs = []) => ({ code: 'FIX', labs, assessments: [{ id: 'fixture', title: 'Fixture', ...assessment }] });

function fixtureTarget(resolver, c) {
  const d = c.deadline;
  const now = Date.parse(c.now);
  const resolve = (data, section = 0) => resolver.resolveTarget({ course: 'mth140', data, section, completed: {}, now, id: 'fixture' });
  if (d.type === 'exact') {
    const instant = Date.parse(d.at);
    const wall = torontoWall(instant);
    if (repeatedHour(wall)) return { precision: 'exact', at: instant, id: c.id, title: c.id };
    return resolve(course({ kind: 'midterm', date: wall.date, time: wall.time, end: null }));
  }
  if (d.type === 'date_only') return resolve(course({ kind: 'midterm', date: d.date, time: null }));
  if (d.type === 'pending') return resolve(course({ kind: 'final', date: null, time: null }));
  const lab = d.section ? { section: 1, day: WEEKDAY[d.section.weekday], start: d.postedTime ?? null, end: null, room: '', assistant: '' } : null;
  return resolve(course({ kind: 'quiz', week: addDays(WEEK_ONE_MONDAY, (d.week - 1) * 7), ...(d.overrideDate ? { mondayMakeupDate: d.overrideDate } : {}) }, lab ? [lab] : []), lab ? 1 : 0);
}

const zone = process.env.TZ || Intl.DateTimeFormat().resolvedOptions().timeZone;
test(`all ${cases.length} Toronto boundary fixtures [system time zone ${zone}]`, () => {
  assert.equal(cases.length, 40);
  for (const c of cases) {
    const now = Date.parse(c.now);
    const t = fixtureTarget(targets, c);
    const e = c.expected;
    assert.deepEqual(t, fixtureTarget(OLD, c), `${c.id}: same target as the old resolver`);
    if (c.deadline.type === 'exact' && !t.title.startsWith('T')) assert.equal(t.at, Date.parse(c.deadline.at), `${c.id}: Toronto wall clock converts back`);
    const date = targets.targetDate(t);
    assert.equal(weeks.termWeek(today(new Date(now))), e.nowWeek, `${c.id} nowWeek`);
    assert.equal(date ? weeks.termWeek(date) : null, e.deadlineWeek, `${c.id} deadlineWeek`);
    if ('resolvedDate' in e) assert.equal(date, e.resolvedDate, `${c.id} resolvedDate`);
    const shown = countdown(t, now);
    assert.equal(shown.label, OLD.compact(t, now), `${c.id}: the old chip wording`);
    assert.equal(shown.status, OLD.status(t, now), `${c.id}: the old status`);
    if (e.countdown) {
      assert.equal(shown.status, null, `${c.id}: a running countdown has no status label`);
      assert.deepEqual({ days: shown.days, hours: shown.hours, minutes: shown.minutes }, e.countdown, `${c.id} countdown`);
      // Seconds are truncated: 30 s later the countdown is one whole minute lower.
      const later = countdown(t, now + 30e3);
      assert.equal(later.days * 1440 + later.hours * 60 + later.minutes, e.countdown.days * 1440 + e.countdown.hours * 60 + e.countdown.minutes - 1, `${c.id}: truncation`);
      assert.doesNotMatch(shown.label, /passed|now|pending/i);
    } else {
      assert.equal(shown.status, e.label, `${c.id} label`);
      assert.ok(!shown.ms && shown.days === undefined, `${c.id}: "${e.label}" shows no clock digits`);
      if (t.precision === 'exact') assert.equal(shown.label, e.label, `${c.id} chip`);
      if (t.precision === 'exact' && t.at && !c.deadline.type.startsWith('q')) assert.equal(countdown(new Date(t.at), now).label, e.label, `${c.id}: a bare Date reads the same`);
    }
  }
});

/* The same fixtures with the computer in another time zone, one child process each (as the old test did). */
if (!process.env.DEADLINE_TZ_CHILD) {
  const file = fileURLToPath(import.meta.url);
  for (const tz of ['America/Toronto', 'UTC', 'America/Los_Angeles', 'Asia/Tokyo']) {
    test(`the fixtures pass with system time zone ${tz}`, () => {
      const env = { ...process.env, TZ: tz, DEADLINE_TZ_CHILD: '1' };
      delete env.NODE_TEST_CONTEXT;
      const run = spawnSync(process.execPath, ['--test', '--test-reporter=tap', file], { env, encoding: 'utf8' });
      const count = (key) => Number((run.stdout.match(new RegExp(`^# ${key} (\\d+)`, 'm')) || [])[1]);
      assert.equal(run.status, 0, `${tz}:\n${run.stdout.slice(-2000)}`);
      assert.equal(count('pass'), 1, `${tz}: the fixture test passed`);
      assert.equal(count('fail'), 0);
    });
  }
}
