import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as resilience from './checks-resilience.mjs';

const oldSource = readFileSync(new URL('./checks-resilience.mjs', import.meta.url), 'utf8');
const oldUntil = oldSource.match(/async function until\(fn, label, timeout = 10_000\) \{[\s\S]*?\n\}/)[0];
function pagePolicy(browserName, gpu, registered = true) {
  const context = {}, page = { context: () => context }, observation = {};
  if (registered) resilience.registerResilienceReadinessScope(context,
    { browser: { browserType: () => ({ name: () => browserName }) }, gpu, observation }).registerPage(page);
  return resilience.resilienceReadinessForPage(page);
}
function delayedStorage(replyMs, correctedAfterReplyMs, { neverCorrect = false } = {}) {
  let time = 0, calls = 0;
  const pauses = [], observation = {};
  return { observation, pauses, now: () => time, calls: () => calls,
    pause: async ms => { pauses.push(ms);time += ms; },
    sample: async () => { calls++;time += calls === 1 ? replyMs : 20;
      return !neverCorrect && calls > 1 && time >= replyMs + correctedAfterReplyMs; } };
}
const factory = (...args) => { assert.equal(typeof resilience.observeResiliencePropagation, 'function');return resilience.observeResiliencePropagation(...args); };

test('the recorded false native replies exhaust the actual old ten-second loop before storage correction', async () => {
  for (const [replyMs, correctedAfterReplyMs] of [[21_199, 260], [12_573, 396]]) {
    const fixture = delayedStorage(replyMs, correctedAfterReplyMs);
    const legacy = new Function('sleep', 'Date', oldUntil + ';return until;')(fixture.pause, { now: fixture.now });
    await assert.rejects(legacy(fixture.sample, 'course card/dock Undo storage propagation'),
      /^Error: Timed out waiting for course card\/dock Undo storage propagation$/);
    assert.equal(fixture.calls(), 1);assert.deepEqual(fixture.pauses, [50]);
    assert.equal(fixture.now(), replyMs + 50);
  }
});

test('software Chromium progress propagation retains a late false sample and succeeds after the original storage predicate turns true', async () => {
  const policy = pagePolicy('chromium', false);assert.equal(policy.timeoutMs, 30_000);
  for (const [replyMs, correctedAfterReplyMs] of [[21_199, 260], [12_573, 396]]) {
    const fixture = delayedStorage(replyMs, correctedAfterReplyMs);
    const poll = factory(fixture.observation, { now: fixture.now, pause: fixture.pause });
    assert.equal(await poll(fixture.sample, 'course card/dock Undo storage propagation', policy.timeoutMs), undefined);
    const trace = fixture.observation;
    assert.equal(trace.status, 'ready');assert.equal(trace.timeoutMs, 30_000);
    assert.equal(trace.maxBrowserReplyMs, replyMs);assert.equal(trace.firstSample.value, false);
    assert.equal(trace.firstSample.replyMs, replyMs);assert.equal(trace.lastSample.value, true);
    assert.equal(trace.sampleCount, fixture.calls());assert.ok(trace.sampleCount > 1);
    assert.ok(trace.elapsedMs >= replyMs + correctedAfterReplyMs && trace.elapsedMs < 30_000);
    assert.ok(fixture.pauses.every(ms => ms === 50));
  }
});

test('GPU Chromium, WebKit, other or unknown browsers and unregistered pages preserve ten-second propagation scheduling', async () => {
  for (const [browserName, gpu, registered] of [['chromium', true, true], ['webkit', false, true],
    ['firefox', false, true], [null, false, true], ['chromium', undefined, true], [null, null, false]]) {
    const policy = pagePolicy(browserName, gpu, registered);assert.equal(policy.timeoutMs, 10_000);
    const fixture = delayedStorage(21_199, 260), poll = factory(fixture.observation, { now: fixture.now, pause: fixture.pause });
    await assert.rejects(poll(fixture.sample, 'progress propagation', policy.timeoutMs), /^Error: Timed out waiting for progress propagation$/);
    assert.equal(fixture.calls(), 1);assert.deepEqual(fixture.pauses, [50]);
    assert.equal(fixture.observation.status, 'timeout');assert.equal(fixture.observation.timeoutMs, 10_000);
    assert.equal(fixture.observation.firstSample.value, false);assert.equal(fixture.observation.lastSample.value, false);
    assert.equal(fixture.observation.maxBrowserReplyMs, 21_199);assert.equal(fixture.observation.elapsedMs, 21_249);
  }
});

test('a progress target that never becomes correct remains a failure under the software thirty-second allowance', async () => {
  const fixture = delayedStorage(21_199, 260, { neverCorrect: true });
  await assert.rejects(factory(fixture.observation, { now: fixture.now, pause: fixture.pause })(fixture.sample,
    'course card/dock Undo storage propagation', pagePolicy('chromium', false).timeoutMs), /^Error: Timed out waiting for course card\/dock Undo storage propagation$/);
  assert.equal(fixture.observation.status, 'timeout');assert.equal(fixture.observation.timeoutMs, 30_000);
  assert.equal(fixture.observation.firstSample.value, false);assert.equal(fixture.observation.lastSample.value, false);
  assert.equal(fixture.observation.maxBrowserReplyMs, 21_199);assert.ok(fixture.observation.elapsedMs >= 30_000);
  assert.equal(fixture.observation.sampleCount, fixture.calls());assert.ok(fixture.calls() > 1);
});

test('the observed boolean loop keeps do-first and true-result behavior even when a native reply overruns the scheduling deadline', async () => {
  for (const asynchronous of [false, true]) {
    let time = 0, calls = 0, pauses = 0;const observation = {};
    const poll = factory(observation, { now: () => time, pause: async () => { pauses++; } });
    const sample = () => { calls++;time = 31_000;return asynchronous ? Promise.resolve(true) : true; };
    assert.equal(await poll(sample, 'already correct', 30_000), undefined);
    assert.equal(calls, 1);assert.equal(pauses, 0);assert.equal(observation.status, 'ready');
    assert.equal(observation.firstSample.value, true);assert.equal(observation.lastSample.value, true);
    assert.equal(observation.maxBrowserReplyMs, 31_000);assert.equal(observation.elapsedMs, 31_000);
  }
});

test('the observed loop keeps the implicit ten-second default and the original synchronous false-to-true sequence', async () => {
  let time = 0, calls = 0;const observation = {}, pauses = [];
  const poll = factory(observation, { now: () => time, pause: async ms => { pauses.push(ms);time += ms; } });
  assert.equal(await poll(() => ++calls === 2, 'synchronous predicate'), undefined);
  assert.equal(calls, 2);assert.deepEqual(pauses, [50]);assert.equal(observation.timeoutMs, 10_000);
  assert.equal(observation.firstSample.value, false);assert.equal(observation.lastSample.value, true);
  assert.equal(observation.sampleCount, 2);assert.equal(observation.elapsedMs, 50);
  const late = delayedStorage(12_573, 396);
  await assert.rejects(factory(late.observation, { now: late.now, pause: late.pause })(late.sample, 'default deadline'),
    /^Error: Timed out waiting for default deadline$/);
  assert.equal(late.calls(), 1);assert.equal(late.observation.timeoutMs, 10_000);assert.equal(late.observation.status, 'timeout');
});

test('a failed native predicate reply keeps its exact error identity and no retry or sleep', async () => {
  for (const original of [Error('native browser disconnected'), null, undefined]) {
    let time = 0, calls = 0, pauses = 0;const observation = {};
    const poll = factory(observation, { now: () => time, pause: async () => { pauses++; } });
    try { await poll(async () => { calls++;time = 13_000;throw original; }, 'native propagation reply', 30_000);assert.fail('must rethrow'); }
    catch (actual) { assert.equal(actual, original); }
    assert.equal(calls, 1);assert.equal(pauses, 0);assert.equal(observation.status, 'error');
    assert.equal(observation.sampleCount, 1);assert.equal(observation.maxBrowserReplyMs, 13_000);assert.equal(observation.elapsedMs, 13_000);
  }
});

test('crosstab inspect uses the registered receiver policy only for the unchanged original progress predicate', () => {
  assert.match(resilience.crosstab.toString(), /await until\(\(\) => receiver\.evaluate\([\s\S]*?name \+ ' storage propagation', resilienceReadinessForPage\(receiver\)\.timeoutMs\);/);
  assert.equal((resilience.crosstab.toString().match(/observeResiliencePropagation/g) ?? []).length, 1);
  assert.match(resilience.crosstab.toString(), /other tab selected section'\);/);
  assert.match(resilience.crosstab.toString(), /'Desk section storage update'\);/);
});
