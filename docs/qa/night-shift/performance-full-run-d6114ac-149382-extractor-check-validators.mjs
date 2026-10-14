import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { expectedNoScriptPreloadEvent, expectedFailureEvent } from '/workspace/tmu-course-guides/tools/qa/checks-resilience.mjs';
import { collectBootCriticalGraph } from '/workspace/tmu-course-guides/tools/module-graph.mjs';
import { makeBudgets, assertBudgets, summarizeNetwork, completeNetworkSample } from '/workspace/tmu-course-guides/tools/qa/checks-perf.mjs';
import path from 'node:path';
const ROOT='/workspace/tmu-course-guides';
const BASES=['/','/tmu-course-guides/'], ROUTES=['desk','cen100','mth140','mth141'], PROFILES=['phone','desktop'];
const SCOPED_RESILIENCE_CHECKS=['nojs','bfcache','failures','crosstab','clock','forward'];
const finite=value=>Number.isFinite(value)&&value>=0;
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const rawSkipSHA256=skip=>sha256(JSON.stringify(skip));
const key=row=>[row.base,row.route,row.profile].join('|');
const sorted=rows=>[...rows].sort();
const requiredKeys=BASES.flatMap(base=>PROFILES.flatMap(profile=>ROUTES.map(route=>key({base,route,profile}))));
const NATIVE_BFCACHE_REASON='The browser performed a document Back without pageshow.persisted. Shell retention/resume cannot be claimed.';
const empty=(rows,label)=>{assert(Array.isArray(rows),label+' must be an array');assert.equal(rows.length,0,label+' must be empty');};
const equalSet=(rows,expected,label)=>assert.deepEqual(sorted(rows),sorted(expected),label);
const EXPECTED_BOOT_MODULE_URLS=new Map(await Promise.all(ROUTES.map(async route=>{
 const graph=await collectBootCriticalGraph({rootDir:ROOT,documentPath:route==='desk'?'index.html':route+'/index.html',baseURL:'https://tmu.invalid/'});
 assert.equal(graph.aliases.length,0);return [route,graph.nodes.map(node=>node.url)];
})));
export function isWebKitUnavailable(check, record, skip) {
  return check === 'webkit' && record.status === 'skipped' && record.assertions.length === 0 && record.skipped.length === 1
    && record.observations?.cases?.length === 0 && !record.observations.browser
    && skip?.feature === 'Playwright WebKit routes, deadlines and layout'
    && typeof skip.reason === 'string'
    && skip.reason.startsWith('WebKit could not launch; install its browser and OS dependencies. ')
    && /Executable doesn['’]t exist at |Host system is missing dependencies to run browsers|error while loading shared libraries: [^\n]+: cannot open shared object file/.test(skip.reason);
}

const stable = value => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([name,item])=>[name,stable(item)])) : value;
const eventIdentity = event => JSON.stringify(stable(Object.fromEntries(Object.entries(event).filter(([name])=>name !== 'expected'))));
function validateResiliencePolicy(record,check,selectedGpu) {
  if (!SCOPED_RESILIENCE_CHECKS.includes(check)) return null;
  assert(Array.isArray(record.observations.cases));
  return record.observations.cases.map(observation=>{
    const label=`${check} ${record.base} ${observation.name}`, policy=observation.readinessPolicy;
    assert(policy && (policy.browserName === null || typeof policy.browserName === 'string') && [true,false,null].includes(policy.gpu),`${label}: missing actual context readiness policy`);
    if (selectedGpu !== undefined) assert.equal(policy.gpu,selectedGpu,`${label}: policy differs from selected rendering mode`);
    const expectedTimeout=policy.browserName === 'chromium' && policy.gpu === false ? 30_000 : 10_000;
    assert.equal(policy.timeoutMs,expectedTimeout,`${label}: readiness limit must be 30s only for explicit software Chromium, 10s otherwise`);
    assert(Array.isArray(observation.readiness) && Array.isArray(observation.routeActions),`${label}: missing recorded readiness/action arrays`);
    const validateSample=(sample,route)=>{
      assert(sample && finite(sample.elapsedMs) && finite(sample.replyMs) && sample.replyMs <= sample.elapsedMs,`${label}: invalid browser sample timing`);
      const state=sample.state, actual=state?.actual;
      assert(actual && Number.isFinite(actual.mainTextLength) && actual.mainTextLength >= 0 && typeof actual.deadlineNode === 'boolean',`${label}: missing actual semantic sample`);
      const components={bodyIdentity:actual.bodyRoute === route,routerIdentity:actual.routerRoute === route,completedMarker:actual.completedRoute === route,renderedMainText:actual.mainTextLength > 20,deadlineNode:actual.deadlineNode};
      assert.deepEqual(state.components,components,`${label}: semantic components differ from actual sample`);
      assert.equal(state.ready,Object.values(components).every(Boolean),`${label}: ready flag differs from semantic components`);
    };
    for (const wait of observation.readiness) {
      assert(ROUTES.includes(wait.route)); assert.deepEqual(wait.policy,policy); assert.equal(wait.timeoutMs,expectedTimeout);
      assert.equal(wait.label,wait.route+' mounted route and deadlines');
      assert.equal(wait.status,'ready',`${label}: failed/incomplete readiness wait`);
      assert(!Object.hasOwn(wait,'error'),`${label}: readiness error cannot be accepted`);
      assert(Number.isInteger(wait.sampleCount) && wait.sampleCount >= 1 && finite(wait.elapsedMs) && finite(wait.maxBrowserReplyMs));
      validateSample(wait.firstSample,wait.route);validateSample(wait.lastSample,wait.route);
      assert.equal(wait.lastSample.state.ready,true,`${label}: final sample lacks semantic readiness`);
      assert(wait.elapsedMs >= wait.lastSample.elapsedMs && wait.lastSample.elapsedMs >= wait.firstSample.elapsedMs && wait.maxBrowserReplyMs >= Math.max(wait.firstSample.replyMs,wait.lastSample.replyMs) && wait.maxBrowserReplyMs <= wait.elapsedMs,`${label}: inconsistent readiness timing diagnostics`);
      if (wait.sampleCount === 1) assert.deepEqual(wait.firstSample,wait.lastSample);
      else assert.equal(wait.firstSample.state.ready,false,`${label}: polling continued after an already ready first sample`);
      // Native RPCs can reply after the scheduling budget. Their elapsed time
      // remains truthful diagnostic evidence, never an artificial failure.
    }
    for (const action of observation.routeActions) {
      assert(ROUTES.includes(action.route)); assert.equal(action.selector,`[data-course-link="${action.route}"]`);
      assert.deepEqual(action.policy,policy);assert.equal(action.timeoutMs,expectedTimeout);
      assert.equal(action.status,'activated',`${label}: failed/incomplete native route action`);
      assert(finite(action.elapsedMs));
      for (const field of ['error','failureNetwork','failureSnapshot','snapshotError','diagnosticElapsedMs']) assert(!Object.hasOwn(action,field),`${label}: route action failure diagnostics cannot be accepted (${field})`);
    }
    return {name:observation.name,policy,readinessWaits:observation.readiness.length,nativeRouteActions:observation.routeActions.length,maxReadinessElapsedMs:Math.max(0,...observation.readiness.map(wait=>wait.elapsedMs)),maxBrowserReplyMs:Math.max(0,...observation.readiness.map(wait=>wait.maxBrowserReplyMs)),maxActionElapsedMs:Math.max(0,...observation.routeActions.map(action=>action.elapsedMs))};
  });
}

function validateNoScriptPolicies(record) {
  const observations=record.observations.cases;
  assert(Array.isArray(observations));
  equalSet(observations.map(row=>row.name),ROUTES.map(route=>`${route}: no JavaScript`),'Require all four nojs routes with independent policy evidence.');
  return observations.map(observation=>{
    const route=observation.name.split(':')[0], policy=observation.scriptPolicy;
    assert(policy && policy.javaScriptEnabled === false,`${route}: JavaScript must be explicitly disabled.`);
    assert.equal(policy.documentURL,record.origin+record.base+(route === 'desk' ? '' : route+'/'));
    for (const field of ['declaredPreloads','cspPolicies','requests','failures','completedScripts','executedMarkers']) assert(Array.isArray(policy[field]),`${route}: missing measured script policy ${field}`);
    assert(policy.declaredPreloads.length > 0);
    assert.equal(new Set(policy.declaredPreloads).size,policy.declaredPreloads.length,`${route}: duplicate declared preload URLs`);
    const expectedURLs=EXPECTED_BOOT_MODULE_URLS.get(route).map(href=>{
      const parsed=new URL(href);assert.equal(parsed.origin,'https://tmu.invalid');
      return new URL(parsed.pathname.slice(1)+parsed.search+parsed.hash,record.origin+record.base).href;
    });
    equalSet(policy.declaredPreloads,expectedURLs,`${route}: declarations must match every exact current generated boot graph URL, preserving bare URLs and query tokens`);
    for (const href of policy.declaredPreloads) {
      const parsed=new URL(href), document=new URL(policy.documentURL);
      assert(/^https?:$/.test(parsed.protocol) && parsed.origin === document.origin && !parsed.hash && /\.(?:mjs|js)$/i.test(parsed.pathname),`${route}: preload must be an exact current same-origin module URL`);
    }
    assert(policy.cspPolicies.every(value=>typeof value === 'string'));
    empty(policy.completedScripts,`${route}: completed scripts with JavaScript disabled`);
    empty(policy.executedMarkers,`${route}: application markers with JavaScript disabled`);
    equalSet(policy.requests.map(row=>row.url),policy.declaredPreloads,`${route}: script request/declaration mismatch`);
    equalSet(policy.failures.map(row=>row.url),policy.declaredPreloads,`${route}: blocked script/declaration mismatch`);
    for (const row of policy.requests) assert(row.method === 'GET' && row.resourceType === 'script');
    for (const row of policy.failures) assert(row.resourceType === 'script' && expectedNoScriptPreloadEvent({type:'requestfailed',requestUrl:row.url,method:row.method,message:row.message},policy),`${route}: failed script is not the proven native disabled-script preload policy`);
    assert(Array.isArray(observation.telemetry));
    const failureIdentity=row=>JSON.stringify([row.url,row.method,row.message]);
    const telemetryFailureIdentity=event=>JSON.stringify([event.requestUrl,event.method,event.message]);
    equalSet(observation.telemetry.map(telemetryFailureIdentity),policy.failures.map(failureIdentity),`${route}: script failure targets/owning telemetry mismatch`);
    for (const event of observation.telemetry) assert(event.expected === true && event.url === policy.documentURL && expectedNoScriptPreloadEvent(event,policy),`${route}: unexpected nojs telemetry`);
    const blockedURLs=sorted(policy.failures.map(row=>row.url)), declaredURLs=sorted(policy.declaredPreloads);
    const pendingScriptCount=policy.requests.length-policy.failures.length-policy.completedScripts.length;
    assert.equal(pendingScriptCount,0);
    const proofAssertions=[
      {name:route+': disabled scripts block exactly declared modulepreload URLs',pass:true,actual:{blockedURLs,failures:policy.failures},expected:declaredURLs},
      {name:route+': no application script completes, remains pending or sets an application marker',pass:true,actual:{completedScripts:policy.completedScripts,pendingScriptCount,executedMarkers:policy.executedMarkers},expected:{completedScripts:[],pendingScriptCount:0,executedMarkers:[]}}
    ];
    for (const expected of proofAssertions) assert.deepEqual(record.assertions.filter(row=>row.name === expected.name),[expected],`${route}: missing or inconsistent native nojs proof assertion`);
    return {route,declaredPreloads:policy.declaredPreloads.length,blockedScriptRequests:policy.failures.length,applicableCspPolicies:policy.cspPolicies.length,completedScripts:0,pendingScripts:0,executedMarkers:0};
  });
}


function fixtureAdmits(observation,event,record){
 if(observation.name.startsWith('fetch ')) {
  const mode=observation.name.slice(6),target=record.origin+record.base+'mth141/?motion=off&qa_failure='+mode+'#assessment-midterm';
  return expectedFailureEvent(event,{target,mode});
 }
 if(observation.name==='offline after warm load')return expectedFailureEvent(event,{mode:'offline',offlineURLs:new Set(observation.expectedOfflineRequestURLs)});
 if(observation.name==='misspelt route')return expectedFailureEvent(event,{target:record.origin+record.base+'cen10o/?qa_failure=404',mode:'404'})||expectedFailureEvent(event,{target:record.origin+'/favicon.ico',mode:'404'});
 return false;
}
function normalizeOrigin(value,origin){
 if(Array.isArray(value))return value.map(row=>normalizeOrigin(row,origin));
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([name,item])=>[name,normalizeOrigin(item,origin)]));
 return typeof value==='string'&&value.startsWith(origin)?'<run-origin>'+value.slice(origin.length):value;
}
function validateOwnedTelemetry(check,record,bootstrapCaptureGap){
 const owned=[];
 for(const observation of record.observations.cases??[]) {
  const telemetry=observation.telemetry;
  if(Array.isArray(telemetry))for(const event of telemetry){
   assert.equal(event.expected,true,'Owning telemetry must keep its actual explicit expected:true');
   const admitted=check==='nojs'?expectedNoScriptPreloadEvent(event,observation.scriptPolicy):check==='failures'&&fixtureAdmits(observation,event,record);
   assert(admitted,check+' '+observation.name+': event is outside exact authored fixture policy');owned.push(event);
  }
  else if(telemetry&&typeof telemetry==='object')for(const [name,rows]of Object.entries(telemetry))empty(rows,check+' '+observation.name+' '+name);
  else assert(Array.isArray(telemetry)||telemetry&&typeof telemetry==='object','Every observation requires owning telemetry');
 }
 const runner=record.observations.runnerErrors;assert(Array.isArray(runner));
 const unowned=[...owned].map(eventIdentity),bootstrap=[];
 for(const event of runner){
  assert.equal(event.expected,false,'Generic runtime expected flags must remain the actual false flags; no rewriting');
  const index=unowned.indexOf(eventIdentity(event));
  if(index>=0){unowned.splice(index,1);continue;}
  if(check==='failures'&&event.type==='pageerror'&&event.name==='SecurityError'&&event.url==='about:blank'){
   const expected=bootstrapCaptureGap?.events?.find(row=>eventIdentity(row)===eventIdentity(event));
   assert(expected,'Opaque about:blank event must match exact source-frozen original fixture event');bootstrap.push(event);continue;
  }
  assert.fail(check+' '+record.base+': unmatched generic event '+JSON.stringify(event));
 }
 empty(unowned,'Every owning fixture event must reconcile with generic runtime evidence');
 if(check==='nojs')assert.equal(runner.length,99,'AA7 frozen graph must produce all 99 JavaScript-disabled module GET failures');
 if(check==='failures'){
  assert.equal(bootstrap.length,4,'All four native opaque storage-method bootstrap events retained');
  assert.equal(runner.length,13,'All thirteen authored failure-fixture generic events must remain present');
  assert.deepEqual(bootstrap.map(eventIdentity).sort(),bootstrapCaptureGap.events.map(eventIdentity).sort());
  assert.deepEqual(runner.map(row=>JSON.stringify(stable(normalizeOrigin(row,record.origin)))).sort(),bootstrapCaptureGap.originalRunnerEvents.map(row=>JSON.stringify(stable(normalizeOrigin(row,bootstrapCaptureGap.originalOrigin)))).sort(),'Generic failure fixture event multiset must match the complete original root fixture, preserving expected:false');
 }
 return {runnerEvents:runner.length,explicitlyExpectedOwningEvents:owned.length,rawGenericExpectedFalsePreserved:true,opaqueBootstrapEvents:bootstrap.length,limitations:bootstrap.length?['Four source-frozen storage-method fixtures initialize on opaque about:blank before owning telemetry attaches; no invented owning events or relabeled raw flags.']:[]};
}
function validateCheckRecord(check, record, reviewedSkips, consumedReviews, {gpu,bootstrapCaptureGap} = {}) {
  assert(BASES.includes(record.base));
  assert(Array.isArray(record.assertions) && Array.isArray(record.skipped));
  assert.equal(record.failures, 0, `${check} ${record.base}: failed record`);
  assert(!record.error, `${check} ${record.base}: execution error`);
  assert(finite(record.durationMs), `${check} ${record.base}: missing duration`);
  assert(record.observations && typeof record.observations === 'object');
  const resiliencePolicy=validateResiliencePolicy(record,check,gpu);
  const nojsPolicy=check === 'nojs' ? validateNoScriptPolicies(record) : null;
  const telemetry = validateOwnedTelemetry(check,record,bootstrapCaptureGap);
  for (const row of record.assertions) assert(typeof row.name === 'string' && row.pass === true, `${check} ${record.base}: assertion did not pass: ${row.name}`);
  if (record.observations?.cleanupErrors !== undefined) empty(record.observations.cleanupErrors, `${check} cleanupErrors`);
  const skips = record.skipped.map(skip => {
    const skipHash = rawSkipSHA256(skip);
    const reviewed = reviewedSkips.find(row => row.check === check && row.base === record.base && row.rawSkipSHA256 === skipHash && skip.feature === `${row.route}: native persisted BFCache restoration` && skip.reason === NATIVE_BFCACHE_REASON && Array.isArray(skip.navigation) && skip.navigation.length > 0);
    if (!isWebKitUnavailable(check, record, skip) && !reviewed) {
      throw new Error(`Unreviewed skip ${check} ${record.base}: ${JSON.stringify(skip)}. rawSkipSHA256=${skipHash}. No repository artifacts were written. Review this exact limitation before using --reviewed-skips.`);
    }
    if (reviewed) consumedReviews.add(reviewed);
    return { feature: skip.feature ?? skip.case ?? null, reason: skip.reason, rawSkipSHA256: skipHash, policy: reviewed ? 'explicitly reviewed environment limitation' : 'WebKit executable or OS dependencies unavailable', ...(reviewed ? { review: reviewed.review } : {}) };
  });
  assert(record.status === 'passed' || record.status === 'skipped' && skips.length > 0 && record.assertions.length === 0, `${check} ${record.base}: incomplete status ${record.status}`);
  if (record.status === 'passed') assert(record.assertions.length > 0, `${check} ${record.base}: no assertions`);
  return { base: record.base, status: record.status, durationMs: record.durationMs, assertions: record.assertions.length, failedAssertions: 0, telemetry, ...(resiliencePolicy ? {resilienceReadiness:resiliencePolicy} : {}), ...(nojsPolicy ? {nativeNojsPolicy:nojsPolicy} : {}), skips };
}

function validatePerfReport(report, budgets, { after = false, requireFreshDiagnostics = false } = {}) {
  assert.equal(report.check, 'perf'); assert.equal(report.status, 'passed'); assert.equal(report.failures, 0);
  assert.equal(report.schemaVersion,1);
  assert(Number.isFinite(Date.parse(report.startedAt)) && Number.isFinite(Date.parse(report.completedAt)) && Date.parse(report.completedAt) >= Date.parse(report.startedAt), 'Perf report must be finalized.');
  empty(report.runErrors, 'perf runErrors');
  assert.equal(report.cases.length, 2);
  equalSet(report.cases.map(row => row.base), BASES, 'perf must include exactly both bases');
  const samples = report.cases.flatMap(record => {
    validateCheckRecord('perf',record,[],new Set());
    assert.equal(record.status, 'passed'); assert.equal(record.failures, 0);
    empty(record.skipped, 'perf skips'); empty(record.observations.runnerErrors, 'perf runner telemetry');
    assert(record.assertions.every(row => row.pass === true));
    const mode = record.observations.budget;
    assert.equal(mode.mode, after ? 'gate' : 'record');
    assert.equal(mode.override, false); assert.equal(mode.timingGates, false);
    assert.equal(path.resolve(mode.path), path.join(after ? ROOT : '/workspace/ns-perf-control-aa7', 'tools/qa/perf-budgets.json'));
    assert.equal(record.observations.cases.length, 8);
    if (after) {
      const recomputed = assertBudgets(record.observations.cases, budgets, {base:record.base});
      assert.equal(recomputed.length, 184);
      assert(recomputed.every(row => row.pass === true));
      const names = new Set(recomputed.map(row => row.name));
      const recorded = record.assertions.filter(row => names.has(row.name));
      assert.deepEqual(recorded, recomputed, `All 184 raw budget assertions must match recomputation for ${record.base}`);
    }
    return record.observations.cases;
  });
  equalSet(samples.map(key), requiredKeys, 'perf must have exactly 16 complete unique samples');
  for (const row of samples) {
    const label = key(row);
    assert(row.settings.cacheDisabled === true && row.settings.serviceWorkers === 'blocked and CDP bypassed' && row.settings.lifecycleInstrumentation === false, `${label}: cold collection settings`);
    assert(row.collection.routeReady && row.collection.networkQuiet && row.collection.readiness?.optionalFeaturesAttempted, `${label}: incomplete route/network/optional loading`);
    assert.equal(row.collection.capped, false); assert.equal(row.collection.activeRequestsAtEnd, 0);
    empty(row.telemetry, `${label} telemetry`); empty(row.timings.observerErrors, `${label} observer errors`);
    for (const type of ['paint','largest-contentful-paint','layout-shift','longtask']) assert(row.timings.supportedEntryTypes.includes(type));
    assert(finite(row.timings.sampleEndMs) && finite(row.timings.routeReadyMs));
    for (const field of ['fcpMs','lcpMs','courseworkVisibleMs','deadlineVisibleMs','deadlineChipVisibleMs']) assert(row.timings[field] === null || finite(row.timings[field]), `${label}: invalid ${field}`);
    // Appearance exhaustion and unobserved/offscreen surfaces remain report-only.
    assert(Array.isArray(row.timings.pendingReadableFrames));
    empty(row.network.unfinishedURLs, `${label} unfinished requests`);
    const rebuiltNetwork = summarizeNetwork(row.network.resources);
    empty(rebuiltNetwork.invalidTransferByteURLs, `${label} recomputed invalid transfer evidence`);
    assert(completeNetworkSample(row.collection,rebuiltNetwork), `${label}: recomputed fail-closed network completeness`);
    for (const field of ['requestCount','transferBytes','bytesByType','urlCounts','duplicateURLs','moduleURLCollisions','fetchedModuleURLs','unfinishedURLs']) assert.deepEqual(row.network[field],rebuiltNetwork[field],`${label}: recomputed network ${field}`);
    if (requireFreshDiagnostics) {
      empty(row.network.invalidTransferByteURLs, `${label} fresh invalid transfer evidence`);
      assert(completeNetworkSample(row.collection,row.network),`${label}: fresh fail-closed network guard was exercised`);
    } else if (row.network.invalidTransferByteURLs !== undefined) empty(row.network.invalidTransferByteURLs,`${label} invalid transfer evidence`);
    empty(row.network.moduleURLCollisions, `${label} module URL collisions`);
    empty(row.modules.runtimeURLCollisions, `${label} runtime aliases`);
    empty(row.modules.graph.aliases, `${label} graph aliases`);
    assert(row.modules.moduleCount > 0 && row.modules.graph.nodes.length === row.modules.moduleCount);
    assert(row.network.requestCount === row.network.resources.length);
    const byType = {};
    for (const resource of row.network.resources) {
      assert(resource.finished === true && !resource.failed && finite(resource.transferBytes), `${label}: incomplete resource ${resource.url}`);
      assert(!resource.fromDiskCache && !resource.fromServiceWorker, `${label}: cache used`);
      const type = String(resource.type ?? 'other').toLowerCase();
      byType[type] = (byType[type] ?? 0) + resource.transferBytes;
    }
    for (const type of new Set([...Object.keys(byType),...Object.keys(row.network.bytesByType)])) assert.equal(row.network.bytesByType[type] ?? 0, byType[type] ?? 0, `${label}: ${type} byte sum`);
    assert.equal(row.network.transferBytes, row.network.resources.reduce((total, resource) => total + resource.transferBytes, 0));
    assert.equal(row.network.transferBytes, Object.values(row.network.bytesByType).reduce((total, bytes) => total + bytes, 0));
  }
  const recomputed = assertBudgets(report, budgets);
  assert.equal(recomputed.length, 368); assert(recomputed.every(row => row.pass));
  return samples;
}

function nativeConditionalRoute(name) {
  return ROUTES.find(route=>[`${route}: persisted Back preserves shell`,`${route}: persisted Back doubles nothing`,`${route}: router usable after native restoration`].includes(name)||name.startsWith(`${route}: native restored deadlines re-resolve clock and saved completion: `));
}

function nativeCoverage(record) {
  return ROUTES.map(route=>{
    const observation=record.observations.cases.find(row=>row.name===`${route}: native document Back / BFCache`);
    const persisted=observation?.after?.pageshow?.some(event=>event.persisted===true)??false;
    return {route,observedNativeBack:Boolean(observation?.after),persisted,skip:record.skipped.find(skip=>skip.feature===`${route}: native persisted BFCache restoration`)??null,nativeAssertions:record.assertions.filter(row=>row.pass&&nativeConditionalRoute(row.name)===route).map(row=>row.name)};
  });
}

const failureFields=['error','failureNetwork','failureSnapshot','snapshotError','diagnosticElapsedMs'];
function validateNewNativeOperations(name,record) {
  const outputs=[];
  for (const observation of record.observations.cases) {
    const policy=observation.readinessPolicy;
    assert(Array.isArray(observation.interactionActions)&&Array.isArray(observation.navigations),'Focused checker must expose new scoped native operation evidence');
    const checkSuccess=(trace,status)=>{
      assert.deepEqual(trace.policy,policy);assert.equal(trace.timeoutMs,policy.timeoutMs);assert.equal(trace.status,status);assert(finite(trace.elapsedMs));
      for (const field of failureFields) assert(!Object.hasOwn(trace,field),'Focused native operation contains failure evidence');
    };
    if (name==='crosstab') {
      const course=observation.name.split(':')[0];assert(ROUTES.slice(1).includes(course));empty(observation.navigations,'Cross-tab navigation wrappers');
      const selector=course==='cen100'?'#contact-section':'#section-select';
      const expected=[
        {name:'cross-tab Mark done',selector:'[data-quick-complete]',method:'evaluate-click',first:true},
        {name:'cross-tab Undo',selector:'#undo-complete',method:'evaluate-click',first:false},
        {name:'cross-tab Mark done',selector:'[data-quick-complete]',method:'evaluate-click',first:true},
        {name:'cross-tab Undo',selector:'#undo-complete',method:'evaluate-click',first:false},
        {name:'cross-tab open section',selector:'.workspace-section',method:'click',first:false},
        {name:'cross-tab change section',selector,method:'selectOption',first:false,value:course==='cen100'?'2':'32'},
        {name:'cross-tab restore section',selector,method:'selectOption',first:false,value:course==='cen100'?'1':'31'}
      ];
      assert.equal(observation.interactionActions.length,7);
      for (let index=0;index<7;index++) {
        const trace=observation.interactionActions[index];checkSuccess(trace,'activated');
        assert.deepEqual(Object.fromEntries(['name','selector','method','first',...(trace.method==='selectOption'?['value']:[])].map(field=>[field,trace[field]])),expected[index]);
        const expectedSourceURL=record.origin+record.base+course+'/?motion=off'+(index>=5?'#course-info':'');
        assert.deepEqual(trace.options,{timeout:policy.timeoutMs});assert.equal(trace.sourceURL,expectedSourceURL,'Native action source must preserve the exact authored fragment after the preceding section-button click');
        if (trace.method!=='selectOption') assert(!Object.hasOwn(trace,'value'));
      }
      assert(observation.sectionCourse?.storageEvents?.some(event=>event.trusted===true&&event.key===(course==='cen100'?'cen100-contact-choice-v1':course+'-section-v1')),'Focused cross-tab trusted section propagation missing');
      const progressKey=course==='cen100'?'cen100-personal-plan-v1':course+'-progress-v1';
      const snapshots=[['Desk Mark done','desk'],['Desk Undo','desk'],['course card/dock Mark done',course],['course card/dock Undo',course]];
      for (const [snapshotName,route] of snapshots) {
        const snapshot=observation[snapshotName];
        assert(snapshot?.route===route&&snapshot.heading&&snapshot.content>20,`${course}: missing full readable receiver snapshot ${snapshotName}`);
        assert(snapshot.storageEvents?.some(event=>event.trusted===true&&event.key===progressKey),`${course}: trusted native progress event missing for ${snapshotName}`);
      }
      assert(observation.sectionCourse?.route===course&&observation.sectionDesk?.route==='desk'&&observation.sectionDesk.heading&&observation.sectionDesk.content>20,`${course}: missing section course/Desk restoration evidence`);
      assert(observation.sectionCourse.shell===observation.sectionDesk.shell,`${course}: cross-tab section updates changed receiver shell`);
      assert(observation.sectionDesk.desk?.section?.includes(course==='cen100'?'1':'31'),`${course}: original section not restored on Desk`);
      outputs.push({observation:observation.name,nativeInteractions:7,nativeNavigations:0});
    } else if (name==='bfcache') {
      empty(observation.interactionActions,'BFCache cross-tab interaction wrappers');
      const native=observation.name.endsWith(': native document Back / BFCache');
      if (!native) {empty(observation.navigations,'Synthetic BFCache native navigation wrappers');outputs.push({observation:observation.name,nativeInteractions:0,nativeNavigations:0});continue;}
      const route=observation.name.split(':')[0];assert(ROUTES.includes(route));assert.equal(observation.navigations.length,2);
      const routeURL=record.origin+record.base+(route==='desk'?'':route+'/')+'?motion=off',privacyURL=record.origin+record.base+'privacy.html';
      const expected=[{name:'BFCache park',method:'goto',sourceURL:routeURL,targetURL:privacyURL,waitUntil:'load'},{name:'BFCache Back',method:'goBack',sourceURL:privacyURL,targetURL:routeURL,waitUntil:'commit'}];
      for (let index=0;index<2;index++) {
        const trace=observation.navigations[index], wanted=expected[index];checkSuccess(trace,'navigated');
        for (const field of ['name','method','sourceURL','targetURL']) assert.equal(trace[field],wanted[field]);
        assert.deepEqual(trace.options,{waitUntil:wanted.waitUntil,timeout:policy.timeoutMs});assert.equal(trace.resultURL,wanted.targetURL);
        if (trace.response===null) assert.equal(index,1,'Only native cached Back can have a null response');
        else {assert.equal(trace.response?.url,wanted.targetURL);assert.equal(trace.response.status,200);}
        assert(Array.isArray(trace.events)&&trace.events.length<=100&&Number.isInteger(trace.droppedEvents)&&trace.droppedEvents>=0);
        if (trace.droppedEvents) assert.equal(trace.events.length,100);
        for (const event of trace.events) {
          assert(['request','response','requestfinished','commit','domcontentloaded','load'].includes(event.type),'Failed native navigation event must not be accepted');
          assert(event.phase==='operation'&&finite(event.elapsedMs));
          if (event.status!==undefined) assert(event.status>=200&&event.status<400);
        }
      }
      assert(observation.after?.route===route&&observation.after.heading&&observation.after.content>20,'Focused native Back must remain usable on the same route');
      assert(Array.isArray(observation.after.pageshow)&&observation.after.pageshow.every(event=>typeof event.persisted==='boolean'));
      const persisted=observation.after.pageshow.some(event=>event.persisted===true);
      const skips=record.skipped.filter(skip=>skip.feature===`${route}: native persisted BFCache restoration`);
      const passedName=name=>record.assertions.filter(assertion=>assertion.name===name&&assertion.pass===true).length===1;
      assert(passedName(`${route}: Back page usable`));
      if (!persisted) {
        assert.equal(skips.length,1,'Every nonpersisted focused native Back requires its exact reviewed availability skip');
        assert.deepEqual(skips[0].navigation,observation.navigation,'Native BFCache skip must carry its owning route navigation evidence');
        assert(Array.isArray(observation.navigation)&&observation.navigation.length>0&&observation.navigation.every(entry=>entry.type==='back_forward'));
        assert.equal(record.assertions.filter(assertion=>nativeConditionalRoute(assertion.name)===route).length,0,'A nonpersisted Back cannot supply native restoration assertions');
      } else {
        assert.equal(skips.length,0,'Observed persisted restoration cannot be labelled unavailable');
        const prefix=`${route}: native restored deadlines re-resolve clock and saved completion: `;
        const surfaceNames=route==='desk'?['Desk target title','Desk chip uses current clock','Desk published dates','Desk overall current target/date','Desk overall countdown current/nonnegative']:['course card target','course card published dates','dock target and current chip','HUD target and current chip','countdown digits never negative','card digits use current clock'];
        for (const assertionName of [`${route}: persisted Back preserves shell`,`${route}: persisted Back doubles nothing`,`${route}: router usable after native restoration`,...surfaceNames.map(suffix=>prefix+suffix)]) assert(passedName(assertionName),`Persisted ${route} must retain every native fixture assertion: ${assertionName}`);
        assert.equal(observation.after.shell,observation.before.shell);assert.deepEqual(observation.after.counts,observation.before.counts);
      }
      const syntheticPrefix=`${route}: persisted handler re-resolves deadlines: `;
      assert(record.assertions.some(assertion=>assertion.pass===true&&assertion.name.startsWith(syntheticPrefix)),'Separate synthetic persisted-handler assertions must remain present');
      outputs.push({observation:observation.name,nativeInteractions:0,nativeNavigations:2,persisted});
    }
  }
  if (name==='crosstab') equalSet(record.observations.cases.map(row=>row.name),ROUTES.slice(1).map(course=>course+': native cross-tab completion, Undo and section changes'));
  if (name==='bfcache') equalSet(record.observations.cases.map(row=>row.name),ROUTES.flatMap(route=>[route+': native document Back / BFCache',route+': persisted pageshow handler (synthetic)']));
  return outputs;
}


export { BASES, ROUTES, PROFILES, empty, equalSet, sha256, finite, stable, eventIdentity, normalizeOrigin, validateOwnedTelemetry, validateCheckRecord, validatePerfReport, validateNewNativeOperations, nativeConditionalRoute, nativeCoverage, makeBudgets };
