import test from 'node:test';
import assert from 'node:assert/strict';

import * as lib from '../src/lib/index.js';
import { memoryStorage, oldModule, toronto, htmlText, cenOracle } from './helpers.mjs';

const NOW = new Date(toronto('2026-10-15', '12:00'));
const PALETTE = await oldModule('night/palette.mjs');

test('COURSES: the three courses keep their names and links and share the Desk palette', () => {
  assert.deepEqual(
    lib.COURSES.map((c) => [c.id, c.code, c.name, c.title, c.index]),
    [
      ['cen100', 'CEN100', 'Engineering', 'Introduction to Engineering', '01'],
      ['mth140', 'MTH140', 'Calculus I', 'Calculus I', '02'],
      ['mth141', 'MTH141', 'Linear Algebra', 'Linear Algebra', '03'],
    ],
  );
  assert.equal(lib.COURSES[0].summary, 'Assignment deadlines, requirements, checklists and section/group contacts.');
  assert.equal(lib.COURSES[1].summary, 'Assessment dates, section labs, announced coverage and practice.');
  for (const course of lib.COURSES) {
    // This record feeds CSS, card panels and generated badge/disc textures.
    assert.deepEqual(course.palette, { primary: '#28282b', accentColor: '#f9f9f9', secondary: '#f0f4f1', fillColor: '#f2ffbd', menuColor: '#28282b', menuFontColor: '#f0f4f1', fluidColor: '#d7d7d4' }, course.id);
    assert.ok(course.links.length > 0);
    for (const link of course.links) assert.match(link.href, /^https:\/\//);
    assert.equal(course.links[0].href, 'https://courses.torontomu.ca/');
  }
  assert.ok(lib.getCourse('mth140').links.some((link) => link.label === 'Calculus, Volume I'));
});

test('sections and groups match the old selects', () => {
  const cen = lib.sections('cen100');
  assert.equal(cen.length, 39);
  assert.deepEqual(cen[28], { value: 29, label: 'Section 29', detail: 'Lab: KHS134' });
  const math = lib.sections('mth140');
  assert.equal(math.length, 34);
  assert.deepEqual(math[23], { value: 24, label: 'Section 24 (241 / 242)', detail: math[23].detail });
  assert.match(math[0].detail, /^Thursday 4:00 PM–6:00 PM · POD367$/);
  assert.deepEqual(
    lib.groups(29).map((g) => g.label),
    ['Group 9', 'Group 10', 'Group 11', 'Group 12'],
  );
  assert.deepEqual(lib.groups(0), []);
});

test('assessments: CEN100’s 20 graded items total 100%; math lists each assessment with the category weights', () => {
  const cen = lib.assessments('cen100');
  assert.equal(cen.count, 20);
  assert.equal(cen.totalWeight, 100);
  assert.equal(
    cen.reduce((sum, row) => sum + row.weight, 0),
    100,
  );
  assert.deepEqual(cen.at(-1), { title: 'Final Exam', dateLabel: 'Date pending', weight: 24, weightLabel: '24%', ids: ['item:y9'], item: 'y9', anchor: 'assignment-y9' });
  assert.equal(cen.find((row) => row.title === 'MATLAB Assignments (normally pairs)').dateLabel, 'Wed Oct 7 · Wed Nov 4');
  assert.equal(cen.find((row) => row.title === 'D2L Quizzes / Lab Participation').dateLabel, 'Weekly');
  for (const id of ['mth140', 'mth141']) {
    const rows = lib.assessments(id);
    assert.equal(rows.totalWeight, 100);
    assert.equal(rows.count, id === 'mth140' ? 6 : 7);
    assert.equal(rows[0].weight, null);
    assert.match(rows[0].weightLabel, /% quiz category$/);
    assert.equal(rows.find((row) => row.title === 'Midterm Test').weight, id === 'mth140' ? 40 : 35);
    assert.equal(rows.at(-1).dateLabel, 'Date pending');
    assert.equal(rows[0].dateLabel.startsWith('Week of'), true);
    assert.match(lib.assessments(id, { section: 3 })[0].dateLabel, /^(Mon|Tue|Wed|Thu|Fri) /);
  }
});

test('deadline items carry everything the pages show', () => {
  const [item] = lib.deadlines('mth141', { now: NOW, section: 3, storage: null }).filter((x) => x.id === 'quiz-3');
  for (const field of ['id', 'courseId', 'title', 'kind', 'weight', 'due', 'precision', 'dateLabel', 'timeLabel', 'requirement', 'detail', 'anchor', 'done', 'overdue']) assert.ok(field in item, field);
  assert.equal(item.dateLabel, 'Wed Nov 4');
  assert.equal(item.timeLabel, 'in your 3:00 PM–4:00 PM lab');
  assert.equal(item.requirement, 'Coverage awaits the course announcement on D2L.');
  assert.equal(item.href, '/mth141/#assessment-quiz-3');
  const reflection = lib.deadlineItem('cen100', 'reflection-1', { now: NOW, storage: null });
  assert.equal(reflection.weight, null, 'one date of a shared grade has no weight of its own');
  assert.equal(reflection.weightLabel, 'Personal Reflections (individual) · 4%');
  assert.equal(reflection.detail, 'Email directly to your assigned Project Manager; no D2L submission box.');
  assert.equal(reflection.who, 'Individual');
  const whmis = lib.deadlineItem('cen100', 'whmis', { now: NOW, storage: null });
  assert.equal(whmis.weight, 2);
  assert.equal(whmis.requirement, '80%+ on all 3 quizzes, then generate and save your certificate.');
});

test('countdown: the old wording for items and bare dates', () => {
  const at = toronto('2026-10-16', '14:30');
  assert.equal(lib.countdown(new Date(at), NOW).label, '1d 2h');
  assert.equal(lib.countdown(at, new Date(at - 3 * 3600e3 - 7 * 60e3)).label, '3h 07m');
  assert.equal(lib.countdown(at, new Date(at - 42 * 60e3)).label, '42m');
  assert.equal(lib.countdown(at, new Date(at)).label, 'Happening now');
  assert.equal(lib.countdown(at, new Date(at + 1)).label, 'Due time passed');
  const c = lib.countdown(new Date(at), NOW);
  assert.deepEqual([c.days, c.hours, c.minutes, c.state], [1, 2, 30, 'soon']);
  const review = lib.deadlineItem('cen100', 'review', { now: NOW, storage: null });
  assert.equal(lib.countdown(review, NOW).label, 'In 20 days');
  assert.equal(lib.countdown(review, new Date(toronto('2026-11-04', '08:00'))).label, 'Today');
  assert.equal(lib.countdown(review, new Date(toronto('2026-11-05', '08:00'))).label, 'Date passed (time not posted)');
  assert.match(lib.countdown(review, NOW).sentence, /^Midterm Design Review: In 20 days\. Wed Nov 4\.$/);
});

test('courseInfo: rules, contacts, topic map and notes as data', async () => {
  const old = await cenOracle();
  const cen = lib.courseInfo('cen100', { section: 29, group: 9 });
  assert.equal(cen.rules.length, 9);
  assert.deepEqual(cen.rules[0], { severity: 'red', icon: 'doc', title: 'Header on every team submission', text: 'Team name or number and section. No signature needed every time.' });
  assert.equal(cen.confirmed.length, 9);
  assert.equal(cen.open[0].title, 'FMEA “Environmental”');
  assert.equal(cen.contacts.ga.location, 'KHS134');
  assert.equal(cen.contacts.pm.role, 'Project Manager');
  assert.equal(cen.profile.summary, 'Section 29 · Group 9 · Lab: KHS134');
  assert.equal(cen.items.length, 17);
  assert.equal(cen.items.find((item) => item.id === 'y7').what, old.sectionContent({ section: 29, group: 9 })['b-y7 .what']);
  assert.equal(cen.items.flatMap((item) => item.groups.flatMap((g) => g.checks)).length, 126);
  assert.equal(cen.grading.tables[1].rows.length, 20);
  assert.ok(cen.updates.entries.length > 10);
  const none = lib.courseInfo('cen100');
  assert.equal(none.profile.summary, 'Choose your section & group');
  assert.equal(none.contacts.ga, null);
  for (const id of ['mth140', 'mth141']) {
    const info = lib.courseInfo(id, { section: 24 });
    assert.equal(info.topics.length, 8);
    assert.equal(info.rules.length, 4);
    assert.match(info.section.brief.section, /^Section 24$/);
    assert.equal(info.contacts.coordinator, 'the coordinator listed on D2L');
    assert.equal(info.assessments[0].checklist.length, 5);
    assert.equal(info.topics.flatMap((t) => t.skills).length, id === 'mth140' ? 30 : 31);
    assert.equal(info.textbooks.books.length, 2);
  }
});

test('searchIndex: the old palette’s groups, copy and ranking across all courses', () => {
  const entries = lib.searchIndex({ now: NOW, storage: null, course: 'mth140' });
  assert.deepEqual([...new Set(entries.map((e) => e.group))], ['Courses', 'Assessments', 'Weeks', 'Topics', 'Actions']);
  assert.deepEqual(lib.SEARCH_GROUPS, PALETTE.GROUPS);
  assert.equal(lib.SEARCH_COPY.placeholder, PALETTE.COPY.placeholder);
  for (const entry of entries) for (const field of ['group', 'title', 'detail', 'href', 'keywords']) assert.ok(field in entry, `${entry.id} ${field}`);
  assert.ok(entries.some((e) => e.title === 'CEN100 · Engineering' && e.href === '/cen100/'));
  assert.ok(entries.some((e) => e.title === 'Work' && e.href === '/mth140/#work'));
  const defaults = lib.searchEntries(entries, '');
  assert.ok(defaults.every((e) => e.default));
  assert.equal(defaults.find((e) => e.group === 'Assessments')?.title, 'Lab Quiz 2', 'the real next assessment is a default');
  assert.equal(lib.searchEntries(entries, 'week 9')[0].title, 'Week 9 · Nov 2–8');
  assert.equal(lib.searchEntries(entries, 'oct 13')[0].title, 'Week 6 · Oct 12–18');
  assert.equal(lib.searchEntries(entries, 'midterm')[0].title, 'Midterm Test');
  const integrity = lib.searchEntries(entries, 'integrity')[0];
  assert.equal(integrity.title, 'Academic Integrity Quiz');
  assert.equal(integrity.href, '/cen100/#assignment-y4');
  assert.match(integrity.detail, /^CEN100 · Wed Oct 14 · 3:00 PM Toronto · Due$/);
  // The same ranking as the old palette for the same entries.
  const old = PALETTE.searchIndex({ entries: entries.map((e) => ({ ...e, label: e.title })), weeks: entries.weeks }, 'quiz');
  assert.deepEqual(
    lib.searchEntries(entries, 'quiz').map((e) => e.id),
    old.map((e) => e.id),
  );
  assert.equal(lib.searchIndex({ now: NOW, storage: memoryStorage({ 'guide-motion-paused': 'true' }) }).find((e) => e.id === 'action-motion').title, 'Play motion');
});

test('searchGuide: the old pages’ full-text search', () => {
  const { results, status } = lib.searchGuide('fishbone');
  assert.deepEqual(
    results.map((r) => r.title),
    ['Failure Analysis Labs', 'Failure Analysis'],
  );
  assert.equal(status, '2 results.');
  assert.equal(lib.searchGuide('zzqq').status, 'No matches. Try a shorter term.');
  assert.equal(lib.searchGuide('').results.length, 0);
  assert.equal(lib.searchGuide('quiz', { course: 'mth141' }).results[0].courseId, 'mth141');
  assert.ok(lib.searchGuide('KHS134').results.some((r) => r.title === 'Who to ask: section and group lookup'));
});

test('workList: "What should I work on?" in the old wording', () => {
  const storage = memoryStorage({ 'cen100-personal-plan-v1': '{"completed":{"integrity":1},"notes":{},"targets":{"m4":"2026-10-18"}}' });
  const cen = lib.workList('cen100', { now: NOW, storage });
  assert.deepEqual(
    cen.items.map((i) => i.itemId),
    ['m4', 'm3'],
    'sorted by the earliest of official date and personal target',
  );
  assert.equal(cen.status, '2 items with completion still unrecorded.');
  assert.equal(cen.items[0].dates, 'No official deadline in this view.');
  assert.equal(cen.items[0].target, 'My target: 2026-10-18 (personal plan)');
  assert.equal(cen.items[1].dates, 'Oct 21 — Failure Analysis Labs: both parts due');
  assert.equal(cen.items[1].progress, '17/17 checklist items still unchecked · 1 completion record unmarked.');
  const math = lib.workList('mth141', { now: NOW, storage: memoryStorage({ 'mth141-section-v1': '3' }) });
  assert.deepEqual(
    math.items.map((i) => i.itemId),
    ['midterm'],
  );
  assert.equal(math.items[0].dates, 'Friday, Oct 16 · 6:30 PM–8:30 PM Toronto time');
  assert.equal(lib.workList('mth140', { now: new Date(toronto('2026-12-30', '12:00')), storage: null }).empty, 'No unrecorded assessments or study targets in this view.');
});

test('the static page text is the old pages’ text', async () => {
  assert.equal(lib.DESK_TEXT.lede, 'Deadlines, requirements, section details and your saved progress for each course. Progress stays in this browser.');
  assert.equal(lib.DESK_TEXT.nextHeading, 'Next across your courses');
  assert.equal(lib.PRIVACY_TEXT.paragraphs.length, 4);
  assert.equal(htmlText('<p>No site analytics, tracking cookies or session recording. Fonts, scripts and artwork load from this site.</p>'), lib.PRIVACY_TEXT.paragraphs[0].text);
});

test('static data is plain JSON (safe for getStaticProps); courseCopy holds the value-taking strings', () => {
  const roundTrip = (value) => JSON.parse(JSON.stringify(value));
  for (const id of ['cen100', 'mth140', 'mth141']) {
    for (const options of [{}, { section: 29, group: 9 }, { section: 3 }]) {
      const info = lib.courseInfo(id, options);
      assert.deepEqual(roundTrip(info), info, `${id} courseInfo`);
    }
    assert.deepEqual(roundTrip([...lib.assessments(id)]), [...lib.assessments(id)]);
    assert.deepEqual(roundTrip(lib.sections(id)), lib.sections(id));
  }
  assert.deepEqual(roundTrip(lib.COURSES), lib.COURSES);
  assert.equal(lib.courseCopy('cen100').filterStatus(3), '3 fully checked items hidden. Uncheck the filter to show everything.');
  assert.equal(lib.courseCopy('mth140').counts.prepared(2, 5), '2/5 prepared');
  assert.equal(lib.courseCopy('mth141').markedDone({ title: 'Lab Quiz 1' }, true), 'Marked done: Lab Quiz 1. Saved on this device.');
  assert.equal(lib.courseCopy('xyz'), null);
});
