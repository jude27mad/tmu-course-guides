import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { makeBudgets, assertBudgets, computeCLS, summarizeNetwork, perf, PROFILES, collectQuietSample, waitForReadableFrames, isReadableProbe, assertPerfTelemetry } from './checks-perf.mjs';
import * as perfTools from './checks-perf.mjs';

const measurement = (base = '/', route = 'desk', profile = 'phone') => ({
  base, route, profile,
  network: { requestCount: 10, transferBytes: 100_000, bytesByType: { document: 1_000, script: 80_000, font: 19_000 } },
  modules: { chainDepth: 4 },
  timings: { fcpMs: 100, lcpMs: 300, cls: 0, courseworkVisibleMs: 150, deadlineVisibleMs: 200 }
});

test('budgets derive explicit margin from measured counts, wire bytes by type, and static chain depth', () => {
  const sample = measurement();
  const budget = makeBudgets([sample]);
  assert.equal(budget.schemaVersion, 1);
  assert.equal(budget.cases.length, 1);
  assert.deepEqual(budget.cases[0].baseline, {
    requestCount: 10, transferBytes: 100_000, bytesByType: sample.network.bytesByType, chainDepth: 4
  });
  assert.equal(budget.cases[0].limits.requestCount, 12);
  assert.equal(budget.cases[0].limits.transferBytes, 110_000);
  assert.equal(budget.cases[0].limits.bytesByType.script, 88_192);
  assert.equal(budget.cases[0].limits.bytesByType.document, 9_192);
  assert.equal(budget.cases[0].limits.chainDepth, 5);
  assert.equal(assertBudgets([sample], budget).every(item => item.pass), true);
});

test('each budget gate fails when its real measurement exceeds the recorded allowance', () => {
  const sample = measurement();
  const budget = makeBudgets([sample]);
  for (const [metric, change] of [
    ['requestCount', value => { value.network.requestCount = 13; }],
    ['transferBytes', value => { value.network.transferBytes = 110_001; value.network.bytesByType.document += 5001; value.network.bytesByType.font += 5000; }],
    ['bytesByType.script', value => { value.network.bytesByType.script = 88_193; value.network.transferBytes += 8193; }],
    ['chainDepth', value => { value.modules.chainDepth = 6; }]
  ]) {
    const regression = structuredClone(sample);
    change(regression);
    const failures = assertBudgets([regression], budget).filter(item => !item.pass);
    assert.equal(failures.length, 1, metric);
    assert.match(failures[0].name, new RegExp(metric.replaceAll('.', '\\.')));
  }
});

test('per-type baseline margin covers the planned generated head hints in three speculative documents', () => {
  const baseline = measurement('/', 'cen100', 'desktop');
  baseline.network.bytesByType = { fetch: 40_498, script: 59_502 };
  const budget = makeBudgets([baseline]);
  const generatedHints = structuredClone(baseline);
  // 1280B Desk + 2171B MTH140 + 2171B MTH141; before/after source
  // analysis identified this deliberate head overhead before acceptance runs.
  generatedHints.network.bytesByType.fetch += 5622;
  generatedHints.network.transferBytes += 5622;
  assert.equal(budget.cases[0].limits.bytesByType.fetch, 48_690);
  assert.equal(budget.margin.transferBytes, 4096);
  assert.equal(budget.margin.bytesByType, 8192);
  assert.equal(assertBudgets([generatedHints], budget).every(item => item.pass), true);
});

test('budgets keep deployment bases and profiles distinct and accept runner perf reports', () => {
  const samples = [measurement(), measurement('/', 'desk', 'desktop'), measurement('/tmu-course-guides/')];
  const report = { cases: [
    { base: '/', observations: { cases: samples.slice(0, 2).map(({ base, ...item }) => item) } },
    { base: '/tmu-course-guides/', observations: { cases: [samples[2]] } }
  ] };
  const budget = makeBudgets(report);
  assert.equal(budget.cases.length, 3);
  assert.equal(assertBudgets(report, budget).every(item => item.pass), true);
  assert.equal(assertBudgets([measurement('/', 'mth140')], budget).some(item => !item.pass), true);
});

test('unknown resource types and invalid measurements cannot silently pass budgets', () => {
  const sample = measurement();
  const budget = makeBudgets([sample]);
  const unknown = structuredClone(sample);
  unknown.network.bytesByType.newtype = 1;
  unknown.network.transferBytes += 1;
  assert.equal(assertBudgets([unknown], budget).some(item => !item.pass && item.name.includes('bytesByType.newtype')), true);
  const invalid = structuredClone(sample);
  invalid.network.transferBytes = null;
  assert.equal(assertBudgets([invalid], budget).some(item => !item.pass && item.name.includes('transferBytes')), true);
  assert.throws(() => makeBudgets([]), /measurement/i);
  assert.throws(() => makeBudgets([invalid]), /transferBytes/);
});

test('timing changes are reported without invented FCP, LCP, CLS or long-task budget gates', () => {
  const sample = measurement();
  const budget = makeBudgets([sample]);
  sample.timings = { fcpMs: 30_000, lcpMs: 90_000, cls: 2, longTaskDurationMs: 80_000, courseworkVisibleMs: null, deadlineVisibleMs: null };
  assert.equal(assertBudgets([sample], budget).every(item => item.pass), true);
  assert.equal(Object.keys(budget.cases[0].limits).some(key => /fcp|lcp|cls|tim/i.test(key)), false);
});

test('a missing transfer-byte breakdown cannot be accepted as zero traffic', () => {
  const sample = measurement(), budget = makeBudgets([sample]);
  delete sample.network.bytesByType;
  assert.throws(() => makeBudgets([sample]), /bytesByType/);
  assert.equal(assertBudgets([sample], budget).some(item => !item.pass && item.name.includes('byte breakdown')), true);
  for (const invalid of [null, undefined, NaN, -1]) {
    const malformed = measurement();
    malformed.network.bytesByType.script = invalid;
    assert.equal(assertBudgets([malformed], budget).some(item => !item.pass && item.name.includes('bytesByType.script')), true);
  }
});

test('empty or inconsistent wire-byte breakdowns cannot become valid budgets', () => {
  const valid = measurement(), budget = makeBudgets([valid]);
  const assertionCount = assertBudgets([valid], budget).length;
  for (const [bytesByType, total] of [[{}, 100_000], [{ script: 0 }, 100_000], [{ script: 100_001 }, 100_000], [{}, 0]]) {
    const invalid = measurement();
    invalid.network.bytesByType = bytesByType;
    invalid.network.transferBytes = total;
    assert.throws(() => makeBudgets([invalid]), /bytesByType/);
    const assertions = assertBudgets([invalid], budget);
    assert.equal(assertions.length, assertionCount);
    assert.equal(assertions.find(item => item.name.includes('transfer byte breakdown available')).pass, false);
  }
});

test('partially measured route cases cannot disappear from a baseline or budget comparison', () => {
  const sample = measurement(), partial = { base: '/', route: 'cen100', profile: 'phone' };
  const budget = makeBudgets([sample]);
  assert.throws(() => makeBudgets([sample, partial]), /measurement/);
  assert.equal(assertBudgets([sample, partial], budget).some(item => !item.pass && item.name.includes('cen100')), true);
});

test('budget comparisons reject missing and duplicate expected cases while allowing a selected deployment base', () => {
  const desk = measurement(), cen = measurement('/', 'cen100'), project = measurement('/tmu-course-guides/');
  const budget = makeBudgets([desk, cen, project]);
  assert.equal(assertBudgets([desk], budget).some(item => !item.pass && item.name.includes('cen100') && item.name.includes('measurement case')), true);
  assert.equal(assertBudgets([desk, desk, cen, project], budget).some(item => !item.pass && item.name.includes('duplicate measurement')), true);
  const duplicateBudget = structuredClone(budget);
  duplicateBudget.cases.push(duplicateBudget.cases[0]);
  assert.equal(assertBudgets([desk, cen, project], duplicateBudget).some(item => !item.pass && item.name.includes('duplicate budget')), true);
  assert.equal(assertBudgets([desk, cen], budget, { base: '/' }).every(item => item.pass), true);
  assert.equal(assertBudgets([desk], budget, { base: '/' }).some(item => !item.pass && item.name.includes('cen100')), true);
});

test('a request that starts during a quiet browser snapshot forces another complete capture', async () => {
  let time = 3000, captures = 0;
  const network = { activeCount: 0, lastActivityMs: 0, revision: 0 };
  const result = await collectQuietSample({
    network, started: 0, capMs: 90_000, now: () => time,
    isReady: async () => true,
    pause: async () => { time += 100; if (time >= 6000) network.activeCount = 0; },
    capture: async () => {
      captures++;
      if (captures === 1) { network.activeCount = 5; network.lastActivityMs = time; network.revision++; }
      return { requests: captures === 1 ? 52 : 63 };
    }
  });
  assert.equal(captures, 2);
  assert.equal(result.sample.requests, 63);
  assert.equal(result.collection.networkQuiet, true);
  assert.equal(result.collection.activeRequestsAtEnd, 0);
  assert.equal(result.collection.networkQuietMs, 1500);
  assert.equal(result.collection.optionalSettlementMs, 2500);
});

test('new completed requests during a snapshot invalidate it even if quiet has returned by its end', async () => {
  let time = 3000, captures = 0;
  const network = { activeCount: 0, lastActivityMs: 0, revision: 0 };
  const result = await collectQuietSample({
    network, started: 0, capMs: 90_000, now: () => time, isReady: async () => true,
    pause: async () => { time += 100; },
    capture: async () => { captures++; if (captures === 1) { network.revision++; network.lastActivityMs = time; time += 2000; } return { number: captures }; }
  });
  assert.equal(captures, 2);
  assert.equal(result.sample.number, 2);
});

test('a readable viewport candidate is captured after its existing native frame callbacks finish', async () => {
  let time = 0, polls = 0;
  const result = await waitForReadableFrames({
    remainingMs: 90_000, now: () => time,
    pause: async ms => { polls++; time += ms; },
    snapshot: () => ({ pendingReadableFrames: time < 300 ? ['coursework', 'deadline', 'deadlineChip'] : [], courseworkVisibleMs: time < 300 ? null : 7000, deadlineChipVisibleMs: time < 300 ? null : 7001 })
  });
  assert.ok(polls >= 3);
  assert.equal(result.state.courseworkVisibleMs, 7000);
  assert.equal(result.state.deadlineChipVisibleMs, 7001);
  assert.equal(result.wait.capped, false);
});

test('an offscreen Desk chip without a scheduled frame callback never extends appearance collection', async () => {
  let polls = 0;
  const result = await waitForReadableFrames({ remainingMs: 90_000, now: () => 0, pause: async () => { polls++; }, snapshot: () => ({ pendingReadableFrames: [], deadlineChipVisibleMs: null }) });
  assert.equal(polls, 0);
  assert.equal(result.state.deadlineChipVisibleMs, null);
  assert.equal(result.wait.waited, false);
});

test('pending native frame exhaustion is reported while an unchanged network remains quiet', async () => {
  let time = 0;
  const network = { activeCount: 0, lastActivityMs: -10_000, revision: 0 };
  const result = await collectQuietSample({ network, started: 0, capMs: 500, optionalSettlementMs: 0, now: () => time, isReady: async () => true, pause: async ms => { time += ms || 100; },
    capture: async () => {
      const appearance = await waitForReadableFrames({ remainingMs: 500 - time, now: () => time, pause: async ms => { time += ms; }, snapshot: () => ({ pendingReadableFrames: ['deadline'], deadlineVisibleMs: null }) });
      return { state: appearance.state, readabilityWait: appearance.wait };
    }
  });
  assert.equal(result.sample.readabilityWait.capped, true);
  assert.equal(result.sample.state.deadlineVisibleMs, null);
  assert.equal(result.collection.networkQuiet, true);
  assert.equal(time, 500);
});

test('browser errors and failed optional resources remain performance check failures', () => {
  const events = ['console', 'pageerror', 'requestfailed', 'http'].map(type => ({ type, message: 'failure' }));
  assert.equal(assertPerfTelemetry(events, 'desk phone').filter(item => !item.pass).length, 4);
  assert.equal(assertPerfTelemetry([], 'desk phone').every(item => item.pass), true);
});

test('readable text excludes translucent, blurred, clipped and offscreen content without rejecting rounded clipping', () => {
  const readable = { text: 'Academic Integrity Quiz', rect: { width: 100, height: 30, top: 10, bottom: 40, left: 10, right: 110 }, viewport: { width: 390, height: 844 }, effectiveOpacity: .85, blurPx: 0, fullyClipped: false, hidden: false, fcpMs: 500, sampleTimeMs: 550 };
  assert.equal(isReadableProbe(readable), true);
  for (const values of [{ effectiveOpacity: .001 }, { blurPx: 30 }, { fullyClipped: true }, { hidden: true }, { fcpMs: null }, { sampleTimeMs: 400 }, { rect: { ...readable.rect, top: 850, bottom: 880 } }]) assert.equal(isReadableProbe({ ...readable, ...values }), false);
  assert.equal(isReadableProbe({ ...readable, clipPath: 'inset(0px round 10px)' }), true);
});

test('a missing default budget fails before a browser run unless recording is explicitly selected', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'tmu-perf-budget-test-'));
  try {
    const output = await perf({ root: directory, env: {}, base: '/' });
    assert.equal(output.assertions.length, 1);
    assert.equal(output.assertions[0].pass, false);
    assert.match(output.assertions[0].detail, /QA_PERF_RECORD=1/);
    assert.equal(output.observations.budget.mode, 'gate');
    assert.equal(output.observations.cases.length, 0);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('the phone profile uses real touch/mobile context and specified CDP throttle units', () => {
  assert.deepEqual(PROFILES.phone.viewport, { width: 390, height: 844 });
  assert.equal(PROFILES.phone.isMobile, true);
  assert.equal(PROFILES.phone.hasTouch, true);
  assert.equal(PROFILES.phone.cpuRate, 4);
  assert.equal(PROFILES.phone.network.downloadThroughput, 200_000);
  assert.equal(PROFILES.phone.network.uploadThroughput, 93_750);
  assert.equal(PROFILES.phone.network.latency, 150);
  assert.deepEqual(PROFILES.desktop.viewport, { width: 1440, height: 900 });
  assert.equal(PROFILES.desktop.network, null);
});

test('CLS uses the largest five-second session with gaps below one second and excludes recent input', () => {
  const entries = [
    { startTime: 0, value: .1 }, { startTime: 900, value: .2 },
    { startTime: 1500, value: 9, hadRecentInput: true },
    { startTime: 1900, value: .15 }, { startTime: 2500, value: .25 },
    { startTime: 3400, value: .1 }, { startTime: 4300, value: .1 },
    { startTime: 5100, value: .2 }
  ];
  assert.ok(Math.abs(computeCLS(entries) - .8) < 1e-10);
  assert.ok(Math.abs(computeCLS(Array.from({ length: 7 }, (_, index) => ({ startTime: index * 900, value: .1 }))) - .6) < 1e-10);
  assert.equal(computeCLS([]), 0);
});

test('network totals use CDP wire bytes while retaining body-length diagnostics and fetched module aliases', () => {
  const resources = [
    { url: 'http://localhost/assets/core.mjs?v=one', type: 'Script', transferBytes: 900, contentLength: 80, bodyBytes: 80, finished: true },
    { url: 'http://localhost/assets/core.mjs?v=two', type: 'Script', transferBytes: 800, contentLength: 80, bodyBytes: 80, finished: true },
    { url: 'http://localhost/assets/core.mjs?v=one', type: 'Script', transferBytes: 900, finished: true },
    { url: 'http://localhost/assets/core.css?v=one', type: 'Stylesheet', transferBytes: 300, finished: true },
    { url: 'http://localhost/assets/core.css?v=two', type: 'Stylesheet', transferBytes: 300, finished: true },
    { url: 'http://localhost/assets/poster.webp', type: 'Image', transferBytes: null, finished: false }
  ];
  const report = summarizeNetwork(resources);
  assert.equal(report.requestCount, 6);
  assert.equal(report.transferBytes, 3_200);
  assert.equal(report.bytesByType.script, 2_600);
  assert.equal(report.bytesByType.stylesheet, 600);
  assert.equal(report.urlCounts['http://localhost/assets/core.mjs?v=one'], 2);
  assert.deepEqual(report.moduleURLCollisions, [{ path: 'http://localhost/assets/core.mjs', urls: [
    'http://localhost/assets/core.mjs?v=one', 'http://localhost/assets/core.mjs?v=two'
  ] }]);
  assert.deepEqual(report.unfinishedURLs, ['http://localhost/assets/poster.webp']);
  assert.equal(report.resources[0].bodyBytes, 80);
});

test('finished resources with unknown or invalid wire bytes fail sample completeness', () => {
  for (const unknown of [null, undefined, NaN, Infinity, -1, '100']) {
    const resources = [
      { url: 'http://localhost/known.mjs', type: 'Script', transferBytes: 40, finished: true },
      { url: 'http://localhost/unknown.mjs', type: 'Script', transferBytes: unknown, finished: true },
      { url: 'http://localhost/site.css', type: 'Stylesheet', transferBytes: 10, finished: true }
    ];
    const summary = summarizeNetwork(resources);
    assert.deepEqual(summary.invalidTransferByteURLs, ['http://localhost/unknown.mjs']);
    assert.equal(summary.transferBytes, null);
    assert.equal(summary.bytesByType.script, null);
    assert.equal(summary.bytesByType.stylesheet, 10);
    assert.deepEqual(summary.unfinishedURLs, []);
    assert.equal(perfTools.completeNetworkSample({ networkQuiet: true }, summary), false);
    assert.throws(() => makeBudgets([{ ...measurement(), network: summary }]), /transferBytes/);
  }
  const valid = summarizeNetwork([{ url: 'http://localhost/empty.mjs', type: 'Script', transferBytes: 0, finished: true }]);
  assert.deepEqual(valid.invalidTransferByteURLs, []);
  assert.equal(perfTools.completeNetworkSample({ networkQuiet: true }, valid), true);
  assert.equal(perfTools.completeNetworkSample({ networkQuiet: false }, valid), false);
  const pending = summarizeNetwork([{ url: 'http://localhost/pending.mjs', type: 'Script', transferBytes: null, finished: false }]);
  assert.equal(perfTools.completeNetworkSample({ networkQuiet: true }, pending), false);
});
