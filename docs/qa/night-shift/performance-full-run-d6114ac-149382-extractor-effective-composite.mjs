import assert from 'node:assert/strict';
import { readFile, writeFile, realpath } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { BASES, ROUTES, empty, equalSet, sha256, finite, validateCheckRecord, validatePerfReport, validateNewNativeOperations, nativeConditionalRoute, nativeCoverage, makeBudgets } from './ns-perf-aa7-check-validators.mjs';

export const ROOT='/workspace/tmu-course-guides';
export const CHECKS=['perf','routes','stability','frames','deadlines','modes','layout','webkit','nojs','bfcache','failures','crosstab','clock','forward'];
export const REPLACEMENTS=['deadlines','modes','bfcache','failures','crosstab'];
export const ORIGINAL_DIRECTORY=ROOT+'/tools/qa/reports/2026-10-14T04-29-12-369Z-124962';
const DOCS=ROOT+'/docs/qa/night-shift';
const ORIGINAL_SUMMARY_SHA='cce1749b0815925c9a877b39f2c6d56e1c8b5ebb26d9eeb398a70970dfec1901';
const BEFORE_SHA='889612c8dc7ba9842230e596f373f35578ca354ff3e3021fb65641d301206256';
const BUDGET_SHA='d96fdcd150e297673fa925bae5ab171871c2414f4f950bedac6bd47259055a37';
const PERF_SHA='8f02ee6001a545562ea711facd17f8483fd089c0bb5be2014d330bc8453f9ad3';
const PRODUCT='1795468f427084977fac5a0707eef0b14e461c8d2041cb9c6d1e0315de48851f';
const PROTECTED='c428377743e2e8a1ee386c55882e182d3b8e750ade67b1bd2b65835c210e0481';
const ORIGINAL_CHECKS_SHA='340eaf3e1ac9a1aac7958e6e7b97d73c176f991fa754f661f2525f5a34b52e16';
const CLOCK_CHECKS_SHA='90b19585765d2ffc933a3aa75ab09e4b3d8da87d207cb26353fc54c64fb50b5a';
const MERGED_CHECKS_SHA='e1cc6550f304cd30d092cfcc34a78548365ce3c9b06e2f9ea6b53f1c1deee9ca';
const ORIGINAL_RESILIENCE_SHA='b2bafedee3cc0569d4354334d42fcaac55d3ddcbf7ceb0e1ecdf43bddcd1f8d6';
const PROPAGATION_RESILIENCE_SHA='db77a8d9fa49683f6370c87fc1794dbec247bc3c95cf524fee1d5d58d12e0de8';
const OWNER='9ab5abb5d7c54f5c70abb9ef87ee5e2132db24f1';
const SOURCE_PATHS=['tools/qa/checks-resilience.mjs','tools/qa/checks.mjs','tools/qa/checks-perf.mjs','tools/qa/runtime.mjs','tools/qa/instrument.mjs'];
const git=args=>execFileSync('git',args,{cwd:ROOT});
const sorted=rows=>[...rows].sort();
const isFinal=report=>finite(Date.parse(report.startedAt))&&finite(Date.parse(report.completedAt))&&Date.parse(report.completedAt)>=Date.parse(report.startedAt);
const failedRows=report=>report.cases.flatMap(record=>record.assertions.filter(row=>row.pass===false).map(assertion=>({base:record.base,assertion})));
const multiset=rows=>rows.reduce((counts,item)=>(counts.set(item,(counts.get(item)??0)+1),counts),new Map());

async function reference(ref,label){
  assert(ref&&path.isAbsolute(ref.path)&&/^[a-f0-9]{64}$/.test(ref.sha256),label+': absolute path and exact SHA required');
  const raw=await readFile(ref.path);assert.equal(sha256(raw),ref.sha256,label+': raw bytes changed');
  return {raw,value:JSON.parse(raw),reference:{path:ref.path,sha256:ref.sha256}};
}

export function compareEnvironment(candidate,original){
  for(const field of ['node','platform','architecture','requestedMode','playwrightPath','playwrightSource','chromiumPath','chromiumSource','launchArgs'])assert.deepEqual(candidate[field],original[field],'Changed actual browser/driver setting '+field);
  const stable=env=>env.deployments.map(({base,requestedMode,actualMode,chromiumVersion,webgl,probeError})=>({base,requestedMode,actualMode,chromiumVersion,webgl,probeError})).sort((a,b)=>a.base.localeCompare(b.base));
  assert.deepEqual(stable(candidate),stable(original),'Changed actual rendering/browser mode');
}

export function validateCompleteReport(report,summary,name,{original=false}={}){
  assert.equal(report.schemaVersion,1);assert.equal(report.check,name);assert(isFinal(report));assert(isFinal(summary));
  assert.equal(report.startedAt,summary.startedAt);assert.equal(report.completedAt,summary.completedAt);
  assert.deepEqual(report.environment,summary.environment);empty(report.runErrors,name+' run errors');empty(summary.errors,'summary errors');
  const row=summary.checks.find(row=>row.name===name);assert(row,'Missing whole check in own run summary');
  assert.deepEqual(report.cases,row.cases,'Report cases must be exact own finalized run-summary cases');
  assert.equal(report.status,row.status);assert.equal(report.failures,row.failures);
  assert.equal(report.cases.length,2);equalSet(report.cases.map(row=>row.base),BASES,'Require whole both-base report');
  let failures=0;
  for(const record of report.cases){
    assert(Array.isArray(record.assertions)&&Array.isArray(record.skipped)&&record.observations&&Array.isArray(record.observations.cases));
    assert(!record.error);assert(finite(record.durationMs));
    for(const assertion of record.assertions)assert(typeof assertion.name==='string'&&typeof assertion.pass==='boolean');
    const count=record.assertions.filter(row=>row.pass===false).length;failures+=count;
    assert.equal(record.failures,count);assert.equal(record.status,count?'failed':record.assertions.length?'passed':'skipped');
    assert(record.assertions.length||record.skipped.length,'Every record must actually execute');
    if(!original){assert.equal(record.status,'passed');assert.equal(count,0);}
  }
  assert.equal(report.failures,failures);
  assert.equal(report.status,failures?'failed':report.cases.every(row=>row.status==='skipped')?'skipped':'passed');
  if(!original){assert.equal(report.status,'passed');assert.equal(summary.status,'passed');assert.equal(summary.exitCode,0);assert.equal(summary.failures,0);}
}

export function segments(record){
  let cursor=0;const result=new Map();
  for(const observation of record.observations.cases){
    const terminal=observation.name+': unexpected browser errors';
    const end=record.assertions.findIndex((row,index)=>index>=cursor&&row.name===terminal);
    assert(end>=cursor,'Missing owning terminal telemetry assertion '+terminal);
    result.set(observation.name,record.assertions.slice(cursor,end+1));cursor=end+1;
  }
  assert.equal(cursor,record.assertions.length,'Assertions outside named fixture segments');return result;
}

export function verifyExactFixtureCoverage(name,original,fresh,originalReports){
  const old=original.cases.find(row=>row.base===fresh.base);
  equalSet(fresh.observations.cases.map(row=>row.name),old.observations.cases.map(row=>row.name),'Whole observation identities changed');
  const freshSegments=segments(fresh);
  let expectedNames;
  if(name==='deadlines')expectedNames=originalReports.deadlines.cases.find(row=>row.base==='/tmu-course-guides/').assertions.map(row=>row.name);
  else if(name==='crosstab'){
    const templates=segments(originalReports.crosstab.cases.find(row=>row.base==='/'));
    const cen='cen100: native cross-tab completion, Undo and section changes';
    const math='mth141: native cross-tab completion, Undo and section changes';
    assert(templates.get(cen).every(row=>row.pass));assert(templates.get(math).every(row=>row.pass));
    expectedNames=ROUTES.slice(1).flatMap(course=>templates.get(course==='cen100'?cen:math).map(row=>row.name.replaceAll('mth141:',course+':')));
  } else if(name==='bfcache'){
    const templates=segments(originalReports.bfcache.cases.find(row=>row.base==='/'));
    expectedNames=fresh.observations.cases.flatMap(observation=>{
      if(observation.name.endsWith('(synthetic)'))return templates.get(observation.name).map(row=>row.name);
      const route=observation.name.split(':')[0],persisted=observation.after?.pageshow?.some(row=>row.persisted===true);
      if(!persisted)return [route+': Back page usable',observation.name+': unexpected browser errors'];
      const templateRoute=route==='desk'?'desk':'cen100';
      return templates.get(templateRoute+': native document Back / BFCache').map(row=>row.name.replaceAll(templateRoute+':',route+':'));
    });
    // This failed case already persisted and failed a later router action. A new
    // native-availability skip must not silently omit the unresolved action.
    if(fresh.base==='/tmu-course-guides/'){
      const recovered=fresh.observations.cases.find(row=>row.name==='mth140: native document Back / BFCache');
      assert(recovered.after.pageshow.some(row=>row.persisted===true),'Failed persisted MTH140 BFCache case requires persisted follow-up');
      assert(fresh.assertions.some(row=>row.name==='mth140: router usable after native restoration'&&row.pass),'Previously missing post-restoration router assertion must pass');
    }
  } else expectedNames=old.assertions.filter(row=>!row.name.endsWith(': execution')).map(row=>row.name);
  assert.deepEqual(fresh.assertions.map(row=>row.name),expectedNames,'Exact complete fixture assertion identities/order/multiplicity changed for '+name+' '+fresh.base);
  assert(fresh.assertions.every(row=>row.pass===true),'All full fixture assertions must genuinely pass');
  for(const [observationName,rows]of freshSegments)assert(!rows.some(row=>row.name.endsWith(': execution')),'Execution-only failure was copied into fresh coverage '+observationName);
  const freshCounts=multiset(fresh.assertions.map(row=>row.name));
  const unavailable=new Set(fresh.skipped.map(skip=>skip.feature?.split(':')[0]));
  const conditional=[];
  for(const [assertionName,count]of multiset(old.assertions.filter(row=>!row.name.endsWith(': execution')).map(row=>row.name))){
    if((freshCounts.get(assertionName)??0)>=count)continue;
    const route=name==='bfcache'&&nativeConditionalRoute(assertionName);
    assert(route&&unavailable.has(route)&&!old.assertions.some(row=>row.name===assertionName&&row.pass===false),'Original substantive fixture coverage shrank');
    conditional.push({assertionName,originalCount:count,focusedCount:freshCounts.get(assertionName)??0,route,reason:'Current exact reviewed native feature gap; original native evidence remains archived.'});
  }
  return {base:fresh.base,fullFixtureAssertions:fresh.assertions.length,observationNames:fresh.observations.cases.map(row=>row.name),originalFailures:old.assertions.filter(row=>row.pass===false),conditionalNativeChanges:conditional};
}

export function validateClockedDeadlineEvidence(record){
  const output=[];
  for(const observation of record.observations.cases){
    const policy=observation.clockedCompletionPolicy;
    assert.deepEqual(policy,{browserName:'chromium',gpu:false,timeoutMs:30000},'Deadline limit requires actual software Chromium context');
    const selectors=observation.name==='Quiz week without section'?[]:['[data-quick-complete]','#undo-complete'];
    assert.equal(observation.clockedCompletionActions?.length,selectors.length);
    for(const [index,trace]of observation.clockedCompletionActions.entries()){
      assert.equal(trace.selector,selectors[index]);assert.equal(trace.method,'evaluate-click');assert.equal(trace.first,true);assert.deepEqual(trace.policy,policy);assert.equal(trace.timeoutMs,30000);
      assert.deepEqual(trace.nativeCall,{method:'Locator.first().evaluate',argument:'undefined',options:{timeout:30000}});
      assert.equal(trace.status,'activated');assert(!trace.error);assert(finite(trace.startedAt)&&finite(trace.completedAt)&&finite(trace.elapsedMs));assert.equal(trace.elapsedMs,trace.completedAt-trace.startedAt);
      for(const field of ['failureSnapshot','failureSnapshotError','failureDiagnosticStartedAt','failureDiagnosticCompletedAt','failureDiagnosticElapsedMs'])assert(!Object.hasOwn(trace,field));
      for(const field of ['beforeDiagnosticStartedAt','beforeDiagnosticCompletedAt','beforeDiagnosticElapsedMs'])assert(finite(trace[field]));
      assert.equal(trace.beforeDiagnosticElapsedMs,trace.beforeDiagnosticCompletedAt-trace.beforeDiagnosticStartedAt);assert(trace.beforeDiagnosticCompletedAt<=trace.startedAt);
      assert(Boolean(trace.beforeSnapshot)!==Object.hasOwn(trace,'beforeSnapshotError'),'Actual before-action diagnostic or its truthful error required');
      if(trace.beforeSnapshot){assert.equal(trace.beforeSnapshot.selector,trace.selector);assert(Number.isInteger(trace.beforeSnapshot.count)&&trace.beforeSnapshot.count>=0);}
    }
    output.push({name:observation.name,nativeActions:selectors.length,beforeDiagnosticErrors:observation.clockedCompletionActions.filter(row=>row.beforeSnapshotError!==undefined).length});
  }
  return output;
}

export function validateMotionReadiness(record){
  for(const observation of record.observations.cases){
    const route=observation.name.split(':')[0],state=observation.sceneReadiness;
    assert(ROUTES.includes(route));assert(state&&state.route===route);assert.equal(state.exempt,route==='desk');assert(Array.isArray(state.renderers));
    const ready=state.exempt||state.renderers.length>0&&state.renderers.every(row=>/^webgl/.test(row.renderer)?row.sceneReady==='true':row.renderer==='poster'&&row.posterLoaded===true&&row.posterVisible===true);
    assert.equal(ready,true);assert.equal(state.ready,ready,'Actual authored scene-ready or loaded visible poster required');
    assert(observation.before&&observation.after);
    for(const sample of [observation.before,observation.after])for(const renderer of sample.renderers){for(const field of ['sceneReady','sceneFrame','motionState'])assert(Object.hasOwn(renderer,field),'Latest motionState field missing');}
  }
  return {fixtureCount:record.observations.cases.length,authoredSceneReadiness:true,deskExemptionExplicit:true};
}

export function validateCapturedSources(captured,allowlist){
  assert.equal(captured.productFingerprint,PRODUCT);assert.equal(captured.protectedFingerprint,PROTECTED);
  equalSet(captured.sources.map(row=>row.path),SOURCE_PATHS,'Complete five-file runtime boundary required');
  for(const source of captured.sources){
    assert.match(source.sha256,/^[a-f0-9]{64}$/);
    if(source.path==='tools/qa/checks.mjs')assert(allowlist.approved.has(source.sha256)&&allowlist.known.has(source.sha256),'Unreviewed checks.mjs source');
    else if(source.path==='tools/qa/checks-resilience.mjs')assert(allowlist.resilienceKnown.has(source.sha256)&&allowlist.resilienceApproved.has(source.sha256),'Resilience source outside exact reviewed propagation scope changed');
    else assert.equal(source.sha256,allowlist.frozen.get(source.path),'Runtime source outside reviewed scope changed');
  }
}

async function sourceAllowlist(manifest,originalSources){
  const original=git(['show','cec2cef7c58752f5f08ffaa979206af25c3ec602:tools/qa/checks.mjs']).toString('utf8');assert.equal(sha256(original),ORIGINAL_CHECKS_SHA);
  const clock=await readFile('/tmp/ns-perf-deadline-proposal-checks-proposed.mjs','utf8');assert.equal(sha256(clock),CLOCK_CHECKS_SHA);
  const known=new Map([[ORIGINAL_CHECKS_SHA,'original frozen checks'],[CLOCK_CHECKS_SHA,'reviewed deadline helper only'],[MERGED_CHECKS_SHA,'actual reviewed merge preserving original geometry/sample metadata and exact owner motion gates']]);
  const peer=await reference(manifest.deadlinePeerReview,'Independent deadline source review');
  assert.equal(peer.value.approvedSourceScope,true);assert(Object.values(peer.value.gates).every(value=>value===true));
  assert.equal(peer.value.bindings.originalChecksSHA256,ORIGINAL_CHECKS_SHA);assert.equal(peer.value.bindings.proposedChecksSHA256,CLOCK_CHECKS_SHA);assert.equal(peer.value.bindings.normalizedAfterSHA256,ORIGINAL_CHECKS_SHA);
  const merge=await reference(manifest.ownerMergeProof,'Actual reviewed owner/deadline merge proof');
  assert.equal(merge.value.ownerRevision,OWNER);assert.equal(merge.value.activeChecksSHA256,CLOCK_CHECKS_SHA);assert.equal(merge.value.previewChecksSHA256,MERGED_CHECKS_SHA);
  assert.equal(sha256(await readFile(merge.value.previewChecksPath)),MERGED_CHECKS_SHA);assert(Object.values(merge.value.ownerChangesPreserved).every(value=>value===true||typeof value==='string'));assert(Object.values(merge.value.ourChangesPreserved).every(value=>value===true));
  assert.equal(merge.value.normalizationOfOnlyNewOwnerChangesReproducesActiveChecksSHA256,CLOCK_CHECKS_SHA);assert.equal(merge.value.runtimeImplications.otherCheckBodiesAndRunCaseByteIdentical,true);assert.equal(merge.value.runtimeImplications.newOwnerSampleMotionFunctionOnlyCalledByModes,true);
  const propagation=await reference(manifest.propagationPeerReview,'Independent progress-propagation source review');
  assert.equal(propagation.value.approvedSourceScope,true);assert.equal(propagation.value.browserAcceptanceEstablished,false);assert(Object.values(propagation.value.gates).every(value=>value===true));
  assert.equal(propagation.value.bindings.oldSHA256,ORIGINAL_RESILIENCE_SHA);assert.equal(propagation.value.bindings.candidateSHA256,PROPAGATION_RESILIENCE_SHA);assert.equal(propagation.value.bindings.normalizedAfterSHA256,ORIGINAL_RESILIENCE_SHA);
  assert.equal(sha256(await readFile(propagation.value.bindings.oldPath)),ORIGINAL_RESILIENCE_SHA);assert.equal(sha256(await readFile(propagation.value.bindings.candidatePath)),PROPAGATION_RESILIENCE_SHA);
  const approval=await reference(manifest.sourceApproval,'Root source-scope approval');
  assert(approval.value.approved===true&&approval.value.reviewedBy==='/root');assert.equal(approval.value.originalSummarySHA256,ORIGINAL_SUMMARY_SHA);
  assert(approval.value.assertionsFixturesAndOtherScopesUnchanged===true&&approval.value.productAndProtectedUnchanged===true);
  assert(typeof approval.value.review==='string'&&approval.value.review.length>=40);
  assert(Array.isArray(approval.value.allowedChecksSources));
  const approved=new Set(approval.value.allowedChecksSources.map(row=>{assert(known.has(row.sha256)&&typeof row.scope==='string'&&row.scope.length>=20);return row.sha256;}));
  const resilienceKnown=new Set([ORIGINAL_RESILIENCE_SHA,PROPAGATION_RESILIENCE_SHA]);assert(Array.isArray(approval.value.allowedResilienceSources));
  const resilienceApproved=new Set(approval.value.allowedResilienceSources.map(row=>{assert(resilienceKnown.has(row.sha256)&&typeof row.scope==='string'&&row.scope.length>=20);return row.sha256;}));
  const frozen=new Map(originalSources.map(row=>[row.path,row.sha256]));
  assert.equal(frozen.get('tools/qa/checks-resilience.mjs'),ORIGINAL_RESILIENCE_SHA);
  for(const source of SOURCE_PATHS)if(!['tools/qa/checks.mjs','tools/qa/checks-resilience.mjs'].includes(source))assert.equal(sha256(await readFile(path.join(ROOT,source))),frozen.get(source),'Source outside reviewed checks/deadline/propagation limits changed');
  assert(resilienceKnown.has(sha256(await readFile(ROOT+'/tools/qa/checks-resilience.mjs'))),'Current resilience source exceeds exact reviewed additions');
  assert(known.has(sha256(await readFile(ROOT+'/tools/qa/checks.mjs'))),'Current checks.mjs contains source changes outside exact reviewed additions');
  return {known,approved,frozen,resilienceKnown,resilienceApproved,combined:MERGED_CHECKS_SHA,approval:approval.reference,deadlinePeerReview:peer.reference,ownerMergeProof:merge.reference,propagationPeerReview:propagation.reference,ownerRevision:OWNER};
}

export function validateExternalPassiveReview(review,sourceSHA){
  const general=review.approvedSourceScope===true||review.approved===true;
  const existing=review.artifactType==='independent-external-runner-source-review'&&review.status==='passed-offline-source-review-only'&&review.sourceApprovalOnly===true&&review.browserAcceptanceEstablished===false&&review.reviewedBy==='/root/final_review'&&review.browsersLaunched===false;
  assert(general||existing,'Exact external runner source approval required');
  assert.equal(general?review.scriptSHA256??review.sourceSHA256:review.runner?.sha256,sourceSHA,'External review must bind actual unchanged runner bytes');
}

export function validatePropagationEvidence(record){
  const outputs=[];
  for(const observation of record.observations.cases){
    const course=observation.name.split(':')[0],waits=observation.propagationWaits;assert.equal(waits?.length,4);
    const names=['Desk Mark done','Desk Undo','course card/dock Mark done','course card/dock Undo'];
    for(const [index,wait]of waits.entries()){
      const route=index<2?'desk':course,snapshot=observation[names[index]];
      assert.equal(wait.course,course);assert.equal(wait.route,route);assert.equal(wait.label,names[index]+' storage propagation');assert.deepEqual(wait.policy,observation.readinessPolicy);assert.equal(wait.timeoutMs,wait.policy.timeoutMs);assert.equal(wait.status,'ready');assert(!Object.hasOwn(wait,'error'));
      assert.equal(wait.expectedTitle,route==='desk'?snapshot.desk.title:snapshot.dock.title);assert(typeof wait.expectedTitle==='string'&&wait.expectedTitle.length>0);
      assert(Number.isInteger(wait.sampleCount)&&wait.sampleCount>0&&finite(wait.elapsedMs)&&finite(wait.maxBrowserReplyMs));
      for(const sample of [wait.firstSample,wait.lastSample])assert(sample&&typeof sample.value==='boolean'&&finite(sample.elapsedMs)&&finite(sample.replyMs)&&sample.replyMs<=sample.elapsedMs);
      assert.equal(wait.lastSample.value,true);assert(wait.elapsedMs>=wait.lastSample.elapsedMs&&wait.lastSample.elapsedMs>=wait.firstSample.elapsedMs&&wait.maxBrowserReplyMs>=Math.max(wait.firstSample.replyMs,wait.lastSample.replyMs)&&wait.maxBrowserReplyMs<=wait.elapsedMs);
      if(wait.sampleCount===1)assert.deepEqual(wait.firstSample,wait.lastSample);else assert.equal(wait.firstSample.value,false);
    }
    outputs.push({name:observation.name,observedProgressWaits:4,semanticPredicateUnchanged:true,lateNativeTrueReplyBehaviorPreserved:true});
  }
  return outputs;
}

async function currentFingerprints(){
  const files=git(['ls-files','--cached','--others','--exclude-standard','-z','--','assets','*.html','cen100','mth140','mth141']).toString('utf8').split('\0').filter(Boolean);
  const full=createHash('sha256'),protectedDigest=createHash('sha256');
  for(const file of [...new Set(files)].sort()){
    const bytes=await readFile(path.join(ROOT,file));full.update(file+'\0').update(bytes).update('\0');
    if(['assets/app/router.mjs','assets/app/route-boot.mjs'].includes(file))continue;
    const protectedBytes=file.endsWith('.html')?bytes.toString('utf8').match(/<body\b[\s\S]*$/i)?.[0]??bytes:bytes;
    protectedDigest.update(file+'\0').update(protectedBytes).update('\0');
  }
  return {productFingerprint:full.digest('hex'),protectedFingerprint:protectedDigest.digest('hex'),selectedFiles:files.length};
}

async function validateFollowupSource(input,report,allowlist){
  const before=await reference(input.sourceBefore,input.check+' actual source before'),after=await reference(input.sourceAfter,input.check+' actual source after');
  assert(Date.parse(before.value.recordedAt)<=Date.parse(report.startedAt),'Fresh source capture must actually precede launch');
  assert(Date.parse(after.value.recordedAt)>=Date.parse(report.completedAt),'Fresh source end capture must follow closure');
  for(const captured of [before.value,after.value]){
    validateCapturedSources(captured,allowlist);
    const reportDirectory=path.dirname(input.report.path);
    assert(captured.runDirectory&&path.resolve(ROOT,captured.runDirectory)===reportDirectory,'Source capture must bind actual finalized run directory');
    assert.equal(captured.loader?.modulePath,report.environment.playwrightPath);
    assert.deepEqual(captured.launchOptions,{headless:true,executablePath:report.environment.chromiumPath,args:report.environment.launchArgs});
    const runtimeRequire=createRequire(ROOT+'/tools/qa/runtime.mjs');
    const actualPlaywrightEntry=await realpath(runtimeRequire.resolve(report.environment.playwrightPath));
    const actualCoreEntry=await realpath(createRequire(actualPlaywrightEntry).resolve('playwright-core'));
    assert.equal(captured.driverIdentity?.playwright?.entryPath,actualPlaywrightEntry,'Playwright entry identity must be the actual resolved loader entry');
    assert.equal(captured.driverIdentity?.core?.entryPath,actualCoreEntry,'Core entry identity must be the actual entry resolved from that Playwright loader');
    for(const [name,identity]of Object.entries(captured.driverIdentity??{})){
      assert(['playwright','core'].includes(name));assert.equal(identity.version,'1.57.0');assert.equal(identity.name,name==='core'?'playwright-core':'playwright');
      assert.equal(await realpath(identity.packagePath),identity.packagePath);assert.equal(sha256(await readFile(identity.packagePath)),identity.packageSHA256);assert.equal(sha256(await readFile(identity.entryPath)),identity.entrySHA256);
      const pkg=JSON.parse(await readFile(identity.packagePath));assert.equal(pkg.version,identity.version);assert.equal(pkg.name,identity.name);
    }
    equalSet(Object.keys(captured.driverIdentity??{}),['playwright','core']);
    const require=createRequire(path.join(report.environment.playwrightPath,'index.js'));
    assert.equal(await realpath(require.resolve('playwright-core/package.json')),captured.driverIdentity.core.packagePath,'Actual loader must resolve the captured original1.57 core');
    assert.equal(await realpath(path.join(report.environment.playwrightPath,'package.json')),captured.driverIdentity.playwright.packagePath);
  }
  assert.deepEqual(before.value.sources,after.value.sources,'Fresh source changed during native run');assert.deepEqual(before.value.driverIdentity,after.value.driverIdentity,'Native driver changed during run');
  const checksSHA=before.value.sources.find(row=>row.path==='tools/qa/checks.mjs').sha256;
  if(input.check==='deadlines')assert([CLOCK_CHECKS_SHA,allowlist.combined].includes(checksSHA),'Deadline follow-up must exercise reviewed clock helper');
  if(input.check==='modes')assert.equal(checksSHA,allowlist.combined,'Modes follow-up must exercise actual latest reviewed owner merge preserving our existing metadata');
  if(input.check==='crosstab')assert.equal(before.value.sources.find(row=>row.path==='tools/qa/checks-resilience.mjs').sha256,PROPAGATION_RESILIENCE_SHA,'Cross-tab follow-up must exercise exact reviewed progress poll scope');
  let passive=null;
  if(input.externalPassiveRunner){
    const source=await readFile(input.externalPassiveRunner.source.path);assert.equal(sha256(source),input.externalPassiveRunner.source.sha256);
    const review=await reference(input.externalPassiveRunner.review,'External passive runner source review');validateExternalPassiveReview(review.value,input.externalPassiveRunner.source.sha256);
    passive={source:input.externalPassiveRunner.source,review:review.reference,limitation:'External passive diagnostics add observer overhead; timing comparisons are not claimed.'};
  }
  return {before:before.reference,after:after.reference,checksSourceSHA256:checksSHA,sourcePhase:'Actual prelaunch and postclosure captures',...(passive?{externalPassiveInstrumentation:passive}:{})};
}

async function validateFailureReview(ref,summary,reports,raws){
  const reviewed=await reference(ref,'Exact original failure-scope review'),review=reviewed.value;
  assert(review.approved===true&&review.reviewedBy==='/root');assert.equal(review.originalSummarySHA256,ORIGINAL_SUMMARY_SHA);assert(typeof review.review==='string'&&review.review.length>=40);
  equalSet(review.checks.map(row=>row.check),['deadlines','bfcache','failures','crosstab']);
  for(const row of review.checks){
    assert.equal(row.rawReportSHA256,sha256(raws[row.check]));
    const failures=failedRows(reports[row.check]).map(({base,assertion})=>({base,name:assertion.name,rawAssertionSHA256:sha256(JSON.stringify(assertion))}));
    const events=reports[row.check].cases.flatMap(record=>record.observations.runnerErrors.map(event=>({base:record.base,rawEventSHA256:sha256(JSON.stringify(event))})));
    const order=rows=>rows.map(row=>JSON.stringify(row)).sort();assert.deepEqual(order(row.failedAssertions),order(failures));assert.deepEqual(order(row.runnerTelemetry),order(events));
  }
  assert.equal(summary.failures,7);return reviewed.reference;
}

export async function buildComposite(manifest){
  assert.equal(manifest.schemaVersion,1);assert.equal(path.resolve(manifest.originalDirectory),ORIGINAL_DIRECTORY);
  const originalRaw=await readFile(ORIGINAL_DIRECTORY+'/summary.json');assert.equal(sha256(originalRaw),ORIGINAL_SUMMARY_SHA);
  const original=JSON.parse(originalRaw);assert.equal(original.status,'failed');assert.equal(original.exitCode,1);assert.equal(original.failures,7);assert(isFinal(original));empty(original.errors,'Original run errors');
  equalSet(original.selection.checks,CHECKS);equalSet(original.selection.bases,BASES);assert.equal(original.selection.gpu,false);assert.equal(original.selection.help,false);
  const reports={},raws={};
  assert.deepEqual(await readFile(DOCS+'/performance-full-run-aa7bca2-summary-failed.json'),originalRaw,'Original failed summary archive changed');
  for(const name of CHECKS){
    raws[name]=await readFile(ORIGINAL_DIRECTORY+'/'+name+'.json');reports[name]=JSON.parse(raws[name]);validateCompleteReport(reports[name],original,name,{original:true});
    assert.deepEqual(await readFile(DOCS+'/performance-full-run-aa7bca2-'+name+'.json'),raws[name],'Original whole-check archive changed '+name);
  }
  equalSet(CHECKS.filter(name=>reports[name].failures>0),['deadlines','bfcache','failures','crosstab']);assert.equal(sha256(raws.perf),PERF_SHA);
  const failureReview=await validateFailureReview(manifest.failureReview,original,reports,raws);
  const sourceStartRaw=await readFile(DOCS+'/performance-full-run-aa7bca2-source-start.json'),sourceCloseRaw=await readFile(DOCS+'/performance-full-run-aa7bca2-source-close.json');
  const sourceStart=JSON.parse(sourceStartRaw),sourceClose=JSON.parse(sourceCloseRaw);
  assert.equal(sha256(sourceCloseRaw),'4d1e5185244bf39bec665a5fa6537697b41d89ad6ae7521da7f226fab08cef8f','Original actual postclosure proof changed');
  assert.equal(sourceClose.startManifest.sha256,sha256(sourceStartRaw));assert.equal(sourceStart.repositoryCommit,'cec2cef7c58752f5f08ffaa979206af25c3ec602');assert.equal(sourceClose.launchRepositoryCommit,sourceStart.repositoryCommit);
  assert(Date.parse(sourceStart.recordedAt)>=Date.parse(original.startedAt)&&Date.parse(sourceStart.recordedAt)<=Date.parse(original.completedAt));assert(Date.parse(sourceClose.recordedAt)>=Date.parse(original.completedAt));
  assert.equal(sourceStart.productFingerprint,PRODUCT);assert.equal(sourceStart.protectedFingerprint,PROTECTED);
  assert.equal(sourceClose.sourceUnchanged,true);assert.equal(sourceClose.productUnchanged,true);assert.equal(sourceClose.protectedUnchanged,true);assert.equal(sourceClose.resources.fullQaProcessPresent,false);empty(sourceClose.resources.activeChromiumProcesses,'Original browser closure');empty(sourceClose.resources.runnerCleanupErrors,'Original run cleanup');empty(sourceClose.resources.caseCleanupErrors,'Original case cleanup');
  assert.deepEqual(sourceClose.sources.map(({path,sha256})=>({path,sha256})),sourceStart.sources.map(({path,sha256})=>({path,sha256})));
  const allowlist=await sourceAllowlist(manifest,sourceStart.sources),fingerprints=await currentFingerprints();assert.equal(fingerprints.productFingerprint,PRODUCT);assert.equal(fingerprints.protectedFingerprint,PROTECTED);
  const beforeRaw=await readFile(DOCS+'/performance-before.json'),budgetRaw=await readFile(ROOT+'/tools/qa/perf-budgets.json');assert.equal(sha256(beforeRaw),BEFORE_SHA);assert.equal(sha256(budgetRaw),BUDGET_SHA);
  const before=JSON.parse(beforeRaw),budgets=JSON.parse(budgetRaw);assert.deepEqual(budgets,makeBudgets(before));
  const beforeSamples=validatePerfReport(before,budgets),afterSamples=validatePerfReport(reports.perf,budgets,{after:true,requireFreshDiagnostics:true});
  const prior=new Map(beforeSamples.map(row=>[[row.base,row.route,row.profile].join('|'),row]));for(const row of afterSamples)assert.deepEqual(row.settings,prior.get([row.base,row.route,row.profile].join('|')).settings);
  const reviewed=await reference(manifest.reviewedSkips,'Current native feature-gap review');assert(Array.isArray(reviewed.value));
  const skips=reviewed.value,consumed=new Set();for(const row of skips){assert(row.check==='bfcache'&&BASES.includes(row.base)&&ROUTES.includes(row.route)&&row.reviewedBy==='/root'&&typeof row.review==='string'&&row.review.length>=40);assert.match(row.rawSkipSHA256,/^[a-f0-9]{64}$/);assert.match(row.rawReportSHA256,/^[a-f0-9]{64}$/);}
  assert(Array.isArray(manifest.followups));equalSet(manifest.followups.map(row=>row.check),REPLACEMENTS,'All five complete whole-check replacements required');
  const replacements=new Map(),resolutions=[],sourceBindings=[];
  const completeFixture=reports.failures.cases.find(row=>row.base==='/'),blankEvents=completeFixture.observations.runnerErrors.filter(event=>event.type==='pageerror'&&event.name==='SecurityError'&&event.url==='about:blank');assert.equal(blankEvents.length,4);
  const bootstrapCaptureGap={events:blankEvents,originalRunnerEvents:completeFixture.observations.runnerErrors,originalOrigin:completeFixture.origin};
  for(const input of manifest.followups){
    const candidate=await reference(input.report,input.check+' actual whole-check report'),candidateSummary=await reference(input.summary,input.check+' actual run summary');
    validateCompleteReport(candidate.value,candidateSummary.value,input.check);assert(Date.parse(candidate.value.startedAt)>=Date.parse(original.completedAt),'Follow-up must occur after original full closure');compareEnvironment(candidate.value.environment,original.environment);
    assert.equal(candidateSummary.value.selection.gpu,false);equalSet(candidateSummary.value.selection.bases,BASES);assert(candidateSummary.value.selection.checks.includes(input.check));assert.equal(candidateSummary.value.selection.help,false);
    equalSet(candidateSummary.value.selection.checks,candidateSummary.value.checks.map(row=>row.name),'Own summary selection must match actual executed checks');
    for(const row of candidateSummary.value.checks){assert(CHECKS.includes(row.name));assert.equal(row.cases.length,2);equalSet(row.cases.map(record=>record.base),BASES);assert.equal(row.failures,0);assert(row.cases.every(record=>record.assertions.every(assertion=>assertion.pass===true)));}
    const source=await validateFollowupSource(input,candidate.value,allowlist);sourceBindings.push({check:input.check,...source});
    for(const row of skips.filter(row=>row.check===input.check))assert.equal(row.rawReportSHA256,input.report.sha256,'Historic native skip reviews cannot bind a fresh report');
    const records=candidate.value.cases.map(record=>{
      const checked=validateCheckRecord(input.check,record,skips.filter(row=>row.check===input.check),consumed,{gpu:false,bootstrapCaptureGap:input.check==='failures'?bootstrapCaptureGap:undefined});
      const coverage=verifyExactFixtureCoverage(input.check,reports[input.check],record,reports);
      const native=['bfcache','crosstab'].includes(input.check)?validateNewNativeOperations(input.check,record):null;
      const deadline=input.check==='deadlines'?validateClockedDeadlineEvidence(record):null,motion=input.check==='modes'?validateMotionReadiness(record):null;
      const propagation=input.check==='crosstab'?validatePropagationEvidence(record):null;
      return {...checked,coverage,...(native?{nativeOperations:native}:{}),...(deadline?{clockedDeadlineActions:deadline}:{}),...(motion?{latestMotionReadiness:motion}:{}),...(propagation?{progressPropagation:propagation}:{})};
    });
    replacements.set(input.check,{name:input.check,status:'passed',source:'complete whole-check focused follow-up',rawReport:candidate.reference,ownRunSummary:candidateSummary.reference,cases:records});
    resolutions.push({check:input.check,originalStatus:reports[input.check].status,originalFailures:failedRows(reports[input.check]),wholeBothBaseReplacement:candidate.reference,source:source,scope:input.check==='modes'?'Refresh latest owner scene-readiness gates; original mode assertions passed but predate that QA change.':'Complete substantive fixture recovery under reviewed sources; earlier failure cause is not waived or inferred.'});
  }
  assert.equal(consumed.size,skips.length,'Unused/stale native skip approvals rejected');
  const checks=CHECKS.map(name=>replacements.get(name)??{name,status:reports[name].status,source:'unchanged original full-run check',rawReport:{path:ORIGINAL_DIRECTORY+'/'+name+'.json',sha256:sha256(raws[name])},cases:reports[name].cases.map(record=>validateCheckRecord(name,record,[],new Set(),{gpu:false}))});
  const cases=checks.flatMap(check=>check.cases.map(record=>({check:check.name,...record})));assert.equal(cases.length,28);assert.equal(cases.filter(row=>row.status==='passed').length,26);assert.equal(cases.filter(row=>row.status==='skipped').length,2);
  const artifact={schemaVersion:3,status:'original-run-failed-with-validated-interim-whole-check-followups',finalLatestAll14Acceptance:false,limitation:'This is interim composite coverage. The latest merged source still requires a fresh complete all14 run before final acceptance; the original full run remains failed.',originalRun:{status:original.status,exitCode:original.exitCode,failures:original.failures,startedAt:original.startedAt,completedAt:original.completedAt,summary:{path:ORIGINAL_DIRECTORY+'/summary.json',sha256:ORIGINAL_SUMMARY_SHA},failedAssertions:CHECKS.flatMap(name=>failedRows(reports[name]).map(row=>({check:name,...row}))),runnerEvents:CHECKS.flatMap(name=>reports[name].cases.flatMap(record=>record.observations.runnerErrors.map(event=>({check:name,base:record.base,event})))),failureReview},effectiveCoverage:{status:'validated-interim',checkCount:14,baseCount:2,checkBaseRecords:28,passedRecords:26,unavailableRecords:2,originalRetainedRecords:18,focusedReplacementRecords:10,unresolvedInterimFailures:0,limitations:cases.flatMap(row=>row.skips.map(skip=>({check:row.check,base:row.base,...skip})))},resolvedChecks:resolutions,checks,sourceProof:{productFingerprint:PRODUCT,protectedFingerprint:PROTECTED,sourceApproval:allowlist.approval,deadlinePeerReview:allowlist.deadlinePeerReview,ownerMergeProof:allowlist.ownerMergeProof,propagationPeerReview:allowlist.propagationPeerReview,ownerMotionRevision:OWNER,followups:sourceBindings,sourceStartPhase:sourceStart.phase},performance:{canonicalSource:'Complete passed perf check from preserved failed AA7 all14 run',measurementCases:16,budgetAssertions:368,beforeSHA256:BEFORE_SHA,afterSHA256:PERF_SHA,budgetsSHA256:BUDGET_SHA,timingPolicy:'All SwiftShader timings remain report-only; resource budgets and completeness remain active.'}};
  assert.equal(artifact.originalRun.failedAssertions.length,7);assert.equal(artifact.originalRun.runnerEvents.length,229);
  return artifact;
}

async function main(argv){
  assert.equal(argv.length,2,'Usage: node /tmp/ns-perf-aa7-effective-composite.mjs MANIFEST OUTPUT');
  const output=path.resolve(argv[1]);assert(output.startsWith('/tmp/'),'This private builder writes only to /tmp; root promotes evidence after review');
  const manifest=JSON.parse(await readFile(path.resolve(argv[0]))),artifact=await buildComposite(manifest);
  // Every guard above runs before this sole write. No original raw reports,
  // repository documents, expected flags or summary status are mutated.
  await writeFile(output,JSON.stringify(artifact,null,2)+'\n');
  console.log(JSON.stringify({output,sha256:sha256(await readFile(output)),status:artifact.status,finalLatestAll14Acceptance:false,effectiveCoverage:artifact.effectiveCoverage},null,2));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)main(process.argv.slice(2)).catch(error=>{console.error(error.stack??error);process.exitCode=1;});
