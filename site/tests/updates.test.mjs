import test from 'node:test';
import assert from 'node:assert/strict';

import { COURSE_UPDATES, WEBSITE_UPDATES } from '../src/lib/content/updates.mjs';

const ID = /^(\d{4}-\d{2}-\d{2})-[a-z0-9]+(-[a-z0-9]+)*$/;
const COURSES = ['cen100', 'mth140', 'mth141'];

function checkList(name, list) {
  assert.ok(list.length > 0, name);
  const ids = new Set();
  let previous = '9999-12-31';
  for (const entry of list) {
    const match = entry.id.match(ID);
    assert.ok(match, `${name}: id ${entry.id}`);
    assert.ok(!ids.has(entry.id), `${name}: duplicate id ${entry.id}`);
    ids.add(entry.id);
    assert.ok(match[1] <= previous, `${name}: ${entry.id} is out of date order`);
    previous = match[1];
    assert.equal(new Date(`${entry.date} 12:00 UTC`).toISOString().slice(0, 10), match[1], `${name}: ${entry.id} date label`);
    assert.ok(entry.title.trim(), `${name}: ${entry.id} has a title`);
    assert.ok(entry.text || entry.items.length, `${name}: ${entry.id} has content`);
    for (const course of entry.courses || []) assert.ok(COURSES.includes(course), `${name}: ${entry.id} course ${course}`);
  }
}

test('course and website update lists: titled, dated, unique ids, newest first', () => {
  for (const course of COURSES) checkList(course, COURSE_UPDATES[course]);
  checkList('website', WEBSITE_UPDATES);
});

test('every course update is about that course; website updates name only real guides', () => {
  assert.deepEqual(Object.keys(COURSE_UPDATES), COURSES);
  for (const entry of WEBSITE_UPDATES) {
    if (entry.courses) assert.ok(entry.courses.length > 0 && entry.courses.length < COURSES.length, entry.id);
  }
  // No entry is in both lists.
  const course = new Set(COURSES.flatMap((id) => COURSE_UPDATES[id].map((entry) => entry.id)));
  for (const entry of WEBSITE_UPDATES) assert.ok(!course.has(entry.id), entry.id);
});
