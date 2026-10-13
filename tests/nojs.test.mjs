import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {SCHEDULE} from '../assets/cen-schedule.mjs';
import {COURSES} from '../assets/course-data.mjs';

const require = createRequire(new URL('../tools/ui-build/package.json', import.meta.url));
const {JSDOM} = require('jsdom');
const read = route => readFileSync(new URL(`../${route}/index.html`, import.meta.url), 'utf8');
// Without runScripts, jsdom parses noscript as a browser with scripting disabled.
const documentFor = route => new JSDOM(read(route), {url:`https://guide.test/tmu-course-guides/${route}/`}).window.document;
const reachable = node => {
  for (let current=node; current; current=current.parentElement) {
    assert.equal(current.hidden, false, `${node.textContent.trim()} is inside hidden content`);
    assert.equal(current.classList.contains('ns-held'), false, 'no JavaScript-waiting hold');
    assert.notEqual(current.style.opacity, '0', 'no opacity gate');
    assert.notEqual(current.style.visibility, 'hidden', 'no visibility gate');
  }
};

test('CEN100 no-JavaScript coursework retains every published schedule record and exact date', () => {
  const document=documentFor('cen100');
  const list=document.querySelector('[data-nojs-coursework]');
  assert.ok(list, 'readable coursework does not depend on a route module');
  reachable(document.querySelector('h1')); reachable(list);
  for (const record of SCHEDULE) {
    const row=list.querySelector(`[data-nojs-assessment="${record.id}"]`);
    assert.ok(row, record.id); reachable(row);
    assert.ok(row.textContent.includes(record.title), record.title);
    assert.equal(row.querySelector('time').getAttribute('datetime'),record.date,record.id);
    if (record.time) {
      assert.ok(row.textContent.includes('Toronto'),`${record.id}: time zone remains explicit`);
      const [hour,minute]=record.time.split(':').map(Number);
      assert.ok(row.textContent.includes(`${hour % 12 || 12}:${String(minute).padStart(2,'0')} ${hour < 12 ? 'AM' : 'PM'}`),record.id);
    } else assert.ok(row.textContent.includes('Time not posted') || row.textContent.includes(record.note || '\0'), `${record.id}: no invented deadline time`);
    if (record.note) assert.ok(row.textContent.includes(record.note),record.note);
  }
  assert.ok(list.textContent.includes('Final exam'));
  assert.ok(list.textContent.includes('Date pending'));
  assert.ok(list.textContent.includes('Tutorial attendance quizzes'));
});

test('MTH141 no-JavaScript coursework retains each assessment, announced week, scope and pending final', () => {
  const document=documentFor('mth141');
  const list=document.querySelector('[data-nojs-coursework]');
  assert.ok(list, 'readable assessments do not depend on a route module');
  reachable(document.querySelector('h1')); reachable(list);
  for (const assessment of COURSES.mth141.assessments) {
    const row=list.querySelector(`[data-nojs-assessment="${assessment.id}"]`);
    assert.ok(row,assessment.id); reachable(row);
    assert.ok(row.textContent.includes(assessment.title),assessment.title);
    assert.ok(row.textContent.includes(assessment.scope),assessment.scope);
    if (assessment.week) {
      assert.equal(row.querySelector('time').getAttribute('datetime'),assessment.week,assessment.id);
      assert.ok(row.textContent.includes('your assigned lab'),'section-dependent quiz timing stays honest');
    } else if (assessment.date) {
      assert.equal(row.querySelector('time').getAttribute('datetime'),assessment.date,assessment.id);
      assert.ok(row.textContent.includes('6:30–8:30 PM Toronto'));
    } else assert.ok(row.textContent.includes('Date pending'),assessment.id);
  }
});

test('static course fallbacks keep native deployment-base-relative guide links', () => {
  for (const route of ['cen100','mth141']) {
    const document=documentFor(route);
    const nav=document.querySelector('noscript nav[aria-label="Course guides"]');
    assert.ok(nav,route);
    for (const href of ['../','../cen100/','../mth140/','../mth141/']) {
      const link=nav.querySelector(`a[href="${href}"]`);
      assert.ok(link,`${route}: ${href}`);reachable(link);
      assert.equal(new URL(link.href).origin,'https://guide.test');
      assert.ok(new URL(link.href).pathname.startsWith('/tmu-course-guides/'));
    }
  }
});
