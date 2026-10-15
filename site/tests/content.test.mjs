import test from 'node:test';
import assert from 'node:assert/strict';

import * as CEN from '../src/lib/content/cen.mjs';
import * as MATH from '../src/lib/content/math.mjs';
import { COURSES as DATA } from '../src/lib/vendor/course-data.mjs';
import { resolveAssessment } from '../src/lib/vendor/schedule.mjs';
import { cenOracle, mathOracle, htmlText, blocksText, toronto } from './helpers.mjs';

const old = await cenOracle();

test('CEN100 content is the old closure’s literals, word for word and in order', () => {
  for (const name of ['I', 'WHO', 'TEAM', 'YOU', 'RULES', 'CONFIRMED', 'OPEN', 'STAFFING', 'SOURCE_INFO', 'PROFILE_KEY', 'FILTER_KEY', 'PLAN_KEY', 'SEEN_KEY']) {
    assert.deepEqual(CEN[name], old[name], name);
  }
  // The release version moves on with each "What's changed?" entry, so the unread badge shows for the new design.
  assert.equal(CEN.GUIDE_VERSION, '2026-10-15-new-design');
  assert.notEqual(CEN.GUIDE_VERSION, old.GUIDE_VERSION);
  assert.equal(CEN.KEY, 'cen100-g9-ticks');
  for (const item of old.allItems) assert.deepEqual(CEN.sourceFor(item), old.sourceFor(item), item.id);
  assert.deepEqual(
    CEN.allItems.map((item) => item.id),
    old.allItems.map((item) => item.id),
  );
});

test('CEN100 checklist keys and completion keys keep the old id schemes', () => {
  // 126 checklist keys `${item}-${group}-${check}`, in card order.
  const keys = old.allItems.flatMap((item) => item.groups.flatMap((g, gi) => g[1].map((_, i) => `${item.id}-${gi}-${i}`)));
  assert.equal(keys.length, 126);
  assert.deepEqual([...CEN.TICK_KEYS], keys);
  // 24 completion keys: 22 dated rows + item:y7 + item:y9.
  assert.deepEqual([...CEN.completionKeys], [...old.completionKeys]);
  assert.equal(CEN.completionKeys.size, 24);
  assert.ok(CEN.completionKeys.has('item:y7') && CEN.completionKeys.has('item:y9'));
  assert.ok(!CEN.completionKeys.has('failure-lab') && !CEN.completionKeys.has('showcase-signup'));
});

test('CEN100 helpers return what the old closure returned', () => {
  const plans = [
    null,
    [],
    'x',
    {},
    { completed: { integrity: 1, whmis: true, bogus: 1, 'failure-lab': 1, 'item:y9': 1, email: 0 }, notes: { y4: 'n', zz: 'x', m2: '' }, targets: { m2: '2026-10-01', y4: '2026-02-30' } },
    { completed: [1], notes: 'x' },
    { notes: { m7: 'a'.repeat(2001), m6: 'a'.repeat(2000) } },
  ];
  for (const plan of plans) assert.deepEqual(CEN.cleanPlan(plan), old.cleanPlan(plan), JSON.stringify(plan));
  for (const value of [null, {}, { section: 29 }, { section: '29', group: '9' }, { section: 29, group: 50 }, { section: 40 }, { section: 3, group: 11 }]) {
    assert.deepEqual(CEN.validProfile(value), old.validProfile(value), JSON.stringify(value));
  }
  for (const item of old.allItems) {
    for (const event of old.recordsFor(item)) assert.equal(CEN.completionText(event), old.completionText(event), event.id);
    assert.deepEqual(CEN.recordsFor(item), old.recordsFor(item));
    for (const completed of [{}, Object.fromEntries([...old.completionKeys].map((key) => [key, 1])), { 'matlab-1': 1 }]) {
      old.setPersonal({ completed, notes: {}, targets: {} });
      assert.deepEqual(CEN.completionSummary(item, completed), old.completionSummary(item), item.id);
    }
  }
  for (const profile of [null, { section: 29, group: 9 }, { section: 29, group: null }, { section: 5, group: 18 }, { section: 12, group: null }]) {
    const page = old.sectionContent(profile);
    const mine = CEN.sectionContent(profile);
    assert.equal(mine.y7.what, page['b-y7 .what']);
    assert.equal(mine.y7.fact, page['b-y7 .fact span']);
    assert.equal(mine.y5.what, page['b-y5 .what']);
  }
  for (const n of [0, 1, 2, 6, 7, 30]) {
    assert.equal(CEN.cd(n), old.cd(n));
    assert.equal(CEN.headUrgency(n), old.headUrgency(n));
  }
});

test('CEN100 calendar, backup parsing and work list match the old closure', () => {
  const stamp = '20261015T120000Z';
  for (const reminder of [0, 1, 2]) {
    assert.equal(CEN.buildCalendar(CEN.calendarEvents('all', false), reminder, stamp), old.buildCalendar(old.CALENDAR_DATES.slice().sort(old.sortEvents), reminder, stamp));
  }
  const backup = JSON.stringify({ format: 'cen100-guide-backup', version: 2, ticks: { 'm2-1-3': 1, 'y4-0-0': true, 'zz-0-0': 1 }, personal: { completed: { integrity: 1 }, notes: { y4: 'x' }, targets: {} } });
  const validKeys = CEN.TICK_KEYS;
  assert.deepEqual(CEN.parseBackup(backup, validKeys), old.parseBackup(backup, validKeys));
  for (const raw of ['{', '{"format":"other"}', JSON.stringify({ format: 'cen100-guide-backup', version: 1, ticks: { 'zz-1': 1 } }), JSON.stringify({ format: 'cen100-guide-backup', version: 2, ticks: { 'm2-1-3': 'yes' } })]) {
    assert.throws(() => old.parseBackup(raw, validKeys));
    assert.throws(
      () => CEN.parseBackup(raw, validKeys),
      (error) => {
        try {
          old.parseBackup(raw, validKeys);
        } catch (expected) {
          return error.message === expected.message;
        }
        return false;
      },
    );
  }
  const plan = { completed: { intro: 1, entry: 1 }, notes: {}, targets: { m7: '2026-10-20' } };
  for (const now of [toronto('2026-10-13', '12:00'), toronto('2026-11-30', '09:00')]) {
    for (const range of ['week', 'all']) {
      old.setPersonal(plan);
      const expected = old.workEntries(range, new Date(now));
      const mine = CEN.workEntries(range, plan.completed, plan.targets, new Date(now));
      assert.deepEqual(
        mine.map((e) => [e.item.id, e.sortDate, e.target, e.pending.map((x) => x.id), e.visible.map((x) => x.id)]),
        expected.map((e) => [e.item.id, e.sortDate, e.target, e.pending.map((x) => x.id), e.visible.map((x) => x.id)]),
      );
    }
  }
});

for (const courseId of ['mth140', 'mth141']) {
  test(`${courseId} content is the old closure’s, word for word`, async () => {
    const course = DATA[courseId];
    for (const section of [0, 2, 3, 31]) {
      const page = await mathOracle(courseId, section);
      for (const a of course.assessments) {
        assert.deepEqual(MATH.prep(a, courseId), page.prep(a), a.id);
        assert.deepEqual(MATH.rulesForAssessment(a, courseId), page.rulesForAssessment(a), a.id);
        assert.equal(MATH.weight(a, course), page.weight(a));
        const e = resolveAssessment(course, a, section);
        assert.equal(MATH.certainty(e), page.certainty(e));
        const tile = MATH.dateTile(e);
        assert.equal([tile.top, tile.main, tile.bottom].filter(Boolean).join(' '), htmlText(page.dateTile(e)));
      }
      for (const lab of course.labs) assert.equal(MATH.labSummary(lab), page.labSummary(lab));
      assert.equal(MATH.GUIDE_VERSION, '2026-10-15-new-design');
      assert.notEqual(MATH.GUIDE_VERSION, page.GUIDE_VERSION);
      assert.deepEqual(
        MATH.ruleCards(course, courseId).map((card) => [card.title, blocksText(card.blocks)]),
        page.cards.map(([title, body]) => [title, htmlText(body)]),
      );
      const notice = MATH.courseNotice(courseId);
      assert.equal(`${notice.title} ${blocksText(notice.blocks)}`, htmlText(page.notice));
    }
    const page = await mathOracle(courseId);
    const inputs = [
      null,
      {},
      [],
      { checks: { 'quiz-1-0': 1, 'quiz-1-9': true, x: true }, completed: { 'quiz-1': 1, midterm: 'yes', final: true }, notes: { 'quiz-1': 'a'.repeat(2100), bogus: 'x', midterm: '' }, targets: { 'quiz-1': '2026-10-01', midterm: 'soon' }, topics: { [`${course.topics[0].id}-0`]: true } },
    ];
    for (const value of inputs) assert.deepEqual(MATH.cleanProgress(value, course, courseId), page.cleanProgress(value), JSON.stringify(value)?.slice(0, 60));
    assert.equal(page.knownChecks.size, courseId === 'mth140' ? 30 : 36);
    assert.equal(page.knownTopics.size, courseId === 'mth140' ? 30 : 31);
  });
}
