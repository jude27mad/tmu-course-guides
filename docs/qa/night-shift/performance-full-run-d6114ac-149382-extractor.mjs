import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,realpath} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {BASES,ROUTES,empty,equalSet,sha256,finite,validateCheckRecord,validatePerfReport,validateNewNativeOperations,nativeConditionalRoute,makeBudgets} from './ns-perf-aa7-check-validators.mjs';
import {compareEnvironment,segments,validateClockedDeadlineEvidence,validateMotionReadiness,validatePropagationEvidence} from './ns-perf-aa7-effective-composite.mjs';

const ROOT='/workspace/tmu-course-guides',DOCS=ROOT+'/docs/qa/night-shift';
const DIRECTORY=ROOT+'/tools/qa/reports/2026-10-14T07-09-10-842Z-149382';
const LAUNCH='d6114ac401a7f3b7b52054f0530c9b76c293a1d8';
const BEFORE_SOURCE_SHA='be421f9e1f04cc50a97beae080abde314d985829ad9810a6a3cbdbea2cdd2afe';
const BOUND_SOURCE_SHA='412c0819ab64b78a323f81c4d0c1a8685f76cef4fa81f8a179f994a41be254f2';
const PRODUCT='1795468f427084977fac5a0707eef0b14e461c8d2041cb9c6d1e0315de48851f',PROTECTED='c428377743e2e8a1ee386c55882e182d3b8e750ade67b1bd2b65835c210e0481';
const BEFORE_PERF_SHA='889612c8dc7ba9842230e596f373f35578ca354ff3e3021fb65641d301206256',BUDGET_SHA='d96fdcd150e297673fa925bae5ab171871c2414f4f950bedac6bd47259055a37';
const CHECKS=['perf','routes','stability','frames','deadlines','modes','layout','webkit','nojs','bfcache','failures','crosstab','clock','forward'];
const EXPECTED_SOURCES=new Map([
 ['tools/qa/checks.mjs','e1cc6550f304cd30d092cfcc34a78548365ce3c9b06e2f9ea6b53f1c1deee9ca'],
 ['tools/qa/checks-resilience.mjs','db77a8d9fa49683f6370c87fc1794dbec247bc3c95cf524fee1d5d58d12e0de8'],
 ['tools/qa/checks-perf.mjs','56d2ab6a4ee6af66722301ee131952d3c4fb16e0eba016f70a75d1fbd4fc3657'],
 ['tools/qa/runtime.mjs','a8715a046c02b1e095e8600a29f3c2a39b7b93816d0c0a5fae61f95295bd9587'],
 ['tools/qa/instrument.mjs','d377323d6c2e434f7e488a8c40c5b93d983ae724aab741dfa95f4f606e9fb892']
]);
const git=args=>execFileSync('git',args,{cwd:ROOT,maxBuffer:64*1024*1024});
const final=report=>finite(Date.parse(report.startedAt))&&finite(Date.parse(report.completedAt))&&Date.parse(report.completedAt)>=Date.parse(report.startedAt);
const rowsHash=rows=>sha256(JSON.stringify(rows));

async function ref(input,label,{json=true}={}){
 assert(input&&path.isAbsolute(input.path)&&/^[a-f0-9]{64}$/.test(input.sha256),label+': exact absolute reference required');
 const raw=await readFile(input.path);assert.equal(sha256(raw),input.sha256,label+': bytes changed');
 return {raw,value:json?JSON.parse(raw):null,reference:{path:input.path,sha256:input.sha256}};
}

async function committedRef(input,name,label){
 assert.equal(input?.path,DOCS+'/'+name,label+': exact committed evidence path required');
 const artifact=await ref(input,label);assert(artifact.raw.equals(git(['show',LAUNCH+':docs/qa/night-shift/'+name])),label+': bytes differ from actual committed launch evidence');return artifact;
}

function checkStructure(report,summary,name,bases=BASES){
 assert(final(summary)&&final(report),'Incomplete latest run cannot produce final candidates');
 assert.equal(report.schemaVersion,1);assert.equal(report.check,name);assert.equal(report.startedAt,summary.startedAt);assert.equal(report.completedAt,summary.completedAt);assert.deepEqual(report.environment,summary.environment);assert.deepEqual(report.runErrors,summary.errors);
 const row=summary.checks.find(row=>row.name===name);assert(row);assert.deepEqual(report.cases,row.cases);assert.equal(report.status,row.status);assert.equal(report.failures,row.failures);
 assert.equal(report.cases.length,bases.length);equalSet(report.cases.map(row=>row.base),bases);
 let failures=0;
 for(const record of report.cases){
  assert(Array.isArray(record.assertions)&&Array.isArray(record.skipped)&&record.observations&&typeof record.observations==='object');assert(finite(record.durationMs));
  for(const assertion of record.assertions)assert(typeof assertion.name==='string'&&typeof assertion.pass==='boolean');
  const count=record.assertions.filter(row=>row.pass===false).length;assert.equal(record.failures,count);failures+=count;
  assert.equal(record.status,count?'failed':record.assertions.length?'passed':'skipped');assert(record.assertions.length||record.skipped.length,'Empty unexecuted record');
  assert(Array.isArray(record.observations.runnerErrors),'Missing actual generic runner events');
 }
 assert.equal(report.failures,failures);assert.equal(report.status,failures?'failed':report.cases.every(row=>row.status==='skipped')?'skipped':'passed');
}

async function driverIdentity(capture,environment){
 assert.equal(capture.loader?.modulePath,environment.playwrightPath);assert.equal(capture.loader?.source,environment.playwrightSource);
 assert.deepEqual(capture.launchOptions,{headless:true,executablePath:environment.chromiumPath,args:environment.launchArgs});
 const runtimeRequire=createRequire(ROOT+'/tools/qa/runtime.mjs'),entry=await realpath(runtimeRequire.resolve(environment.playwrightPath)),coreRequire=createRequire(entry);
 const actual={playwright:{entry,package:await realpath(path.join(environment.playwrightPath,'package.json'))},core:{entry:await realpath(coreRequire.resolve('playwright-core')),package:await realpath(coreRequire.resolve('playwright-core/package.json'))}};
 equalSet(Object.keys(capture.driverIdentity??{}),['playwright','core']);
 for(const name of ['playwright','core']){
  const identity=capture.driverIdentity[name];assert.equal(identity.version,'1.57.0');assert.equal(identity.name,name==='core'?'playwright-core':'playwright');assert.equal(identity.entryPath,actual[name].entry);assert.equal(identity.packagePath,actual[name].package);
  assert.equal(sha256(await readFile(actual[name].entry)),identity.entrySHA256);assert.equal(sha256(await readFile(actual[name].package)),identity.packageSHA256);
  const pkg=JSON.parse(await readFile(actual[name].package));assert.equal(pkg.name,identity.name);assert.equal(pkg.version,identity.version);
 }
}

function sourceRows(capture){
 assert.equal(capture.productFingerprint,PRODUCT);assert.equal(capture.protectedFingerprint,PROTECTED);equalSet(capture.sources.map(row=>row.path),[...EXPECTED_SOURCES.keys()]);
 for(const source of capture.sources)assert.equal(source.sha256,EXPECTED_SOURCES.get(source.path),'Actual runtime source changed '+source.path);
}

async function currentSource(){
 for(const [file,expected]of EXPECTED_SOURCES){const bytes=await readFile(ROOT+'/'+file);assert.equal(sha256(bytes),expected);assert(bytes.equals(git(['show',LAUNCH+':'+file])),'Working runtime no longer equals actual committed launch blob');}
 const files=git(['ls-files','--cached','--others','--exclude-standard','-z','--','assets','*.html','cen100','mth140','mth141']).toString('utf8').split('\0').filter(Boolean),full=createHash('sha256'),protectedDigest=createHash('sha256');
 for(const file of [...new Set(files)].sort()){
  const bytes=await readFile(ROOT+'/'+file);full.update(file+'\0').update(bytes).update('\0');
  if(['assets/app/router.mjs','assets/app/route-boot.mjs'].includes(file))continue;
  const body=file.endsWith('.html')?bytes.toString('utf8').match(/<body\b[\s\S]*$/i)?.[0]??bytes:bytes;protectedDigest.update(file+'\0').update(body).update('\0');
 }
 assert.equal(full.digest('hex'),PRODUCT);assert.equal(protectedDigest.digest('hex'),PROTECTED);return {productFingerprint:PRODUCT,protectedFingerprint:PROTECTED,selectedFiles:files.length};
}

async function sources(manifest,summary){
 const before=await ref(manifest.sourceBefore,'Actual true prelaunch capture');assert.equal(before.reference.sha256,BEFORE_SOURCE_SHA);assert.equal(before.value.repositoryCommit,LAUNCH);assert(Date.parse(before.value.recordedAt)<Date.parse(summary.startedAt));sourceRows(before.value);await driverIdentity(before.value,summary.environment);
 const bound=await ref(manifest.sourceBeforeBound,'Later honest metadata binding');assert.equal(bound.reference.sha256,BOUND_SOURCE_SHA);
 for(const [name,value]of Object.entries(before.value))if(name!=='runDirectory')assert.deepEqual(bound.value[name],value,'Prelaunch field relabeled or changed '+name);
 assert.equal(path.resolve(ROOT,bound.value.runDirectory),DIRECTORY);assert.equal(bound.value.runStartedAt,summary.startedAt);assert.deepEqual(bound.value.runSelection,summary.selection);assert.equal(bound.value.prelaunchSourceArtifact.sha256,BEFORE_SOURCE_SHA);
 const after=await ref(manifest.sourceAfter,'Actual postclosure capture');assert(Date.parse(after.value.recordedAt)>=Date.parse(summary.completedAt));assert.equal(after.value.observedAfterClosureAt,after.value.recordedAt);sourceRows(after.value);await driverIdentity(after.value,summary.environment);
 assert.deepEqual(after.value.sources,before.value.sources);assert.deepEqual(after.value.driverIdentity,before.value.driverIdentity);assert.equal(after.value.sourceUnchanged,true);assert.equal(after.value.driverIdentityUnchanged,true);
 const {closure,cli}=await closedRun(manifest,summary,DIRECTORY);
 return {before,bound,after,closure,cli,current:await currentSource()};
}

async function closedRun(manifest,summary,directory){
 const closure=await ref(manifest.resourceClosure,'Actual resource closure'),proof=closure.value,res=proof.resources??proof;
 const observedAt=proof.recordedAt??proof.observedAt;
 assert.equal(path.resolve(proof.rawDirectory),directory);assert(Date.parse(observedAt)>=Date.parse(summary.completedAt));if(proof.observationCompletedAt!==undefined)assert(Date.parse(proof.observationCompletedAt)>=Date.parse(observedAt));assert.equal(res.fullQaProcessPresent,false);empty(res.activeChromiumProcesses,'All actual browser processes closed');
 assert.equal(proof.sourceUnchanged,true);assert.equal(proof.productUnchanged,true);assert.equal(proof.protectedUnchanged,true);
 const runCleanup=summary.errors.filter(error=>error.phase==='cleanup'),caseResources=summary.checks.flatMap(check=>check.cases.map(record=>({check:check.name,base:record.base,runnerErrors:record.observations.runnerErrors??[],cleanupErrors:record.observations.cleanupErrors??[]}))),caseCleanup=caseResources.filter(record=>record.cleanupErrors.length).map(record=>({check:record.check,base:record.base,errors:record.cleanupErrors}));
 assert.deepEqual(proof.runnerCleanupErrors??res.runnerCleanupErrors,runCleanup);assert.deepEqual(proof.caseCleanupErrors??res.caseCleanupErrors,caseCleanup);assert.deepEqual(proof.caseResourceRecords,caseResources);assert.deepEqual(proof.rawRunErrors,summary.errors);
 const ports=proof.previewClosure??proof.ports??res.previewClosure??res.ownedPreviewPorts;assert(Array.isArray(ports));
 equalSet(ports.map(row=>row.origin),summary.environment.deployments.map(row=>row.origin));assert(ports.every(row=>row.result==='ECONNREFUSED'||row.error==='ECONNREFUSED'||row.result==='refused'&&row.error?.code==='ECONNREFUSED'),'Every actual preview port must independently be closed');
 assert.equal(proof.allObservedResourcesClosed,true);assert.equal(proof.runStartedAt,summary.startedAt);assert.equal(proof.runCompletedAt,summary.completedAt);assert.equal(proof.rawStatus,summary.status);assert.equal(proof.rawExitCode,summary.exitCode);assert.equal(proof.rawFailures,summary.failures);
 assert.deepEqual(proof.artifacts.summary,{path:directory+'/summary.json',sha256:sha256(await readFile(directory+'/summary.json'))});assert.deepEqual(proof.artifacts.before,{path:manifest.sourceBefore.path,sha256:manifest.sourceBefore.sha256});assert.deepEqual(proof.artifacts.after,{path:manifest.sourceAfter.path,sha256:manifest.sourceAfter.sha256});
 equalSet(proof.currentSources.map(row=>row.path),[...EXPECTED_SOURCES.keys()]);for(const row of proof.currentSources)assert.equal(row.sha256,EXPECTED_SOURCES.get(row.path));
 const actualAfter=await ref(manifest.sourceAfter,'Closure-bound source-after');assert.equal(proof.driverIdentityUnchanged,true);assert.deepEqual(proof.driverIdentity,actualAfter.value.driverIdentity);assert.deepEqual(proof.loader,actualAfter.value.loader);assert.deepEqual(proof.launchOptions,actualAfter.value.launchOptions);
 const cli=await ref(manifest.cliObservation,'Actual independently retrieved CLI verdict');assert.equal(cli.value.observer,'/root');assert.equal(cli.value.exitCode,summary.exitCode);assert.equal(path.resolve(cli.value.rawDirectory),directory);assert(Date.parse(cli.value.recordedAt)>=Date.parse(summary.completedAt));assert.equal(cli.value.reportedAfterRunClosure,true);assert(typeof cli.value.source==='string'&&cli.value.source.length>=20);
 return {closure,cli};
}

async function bindFollowupCapture(input,field,summary,directory,originalCompletedAt){
 const artifact=await ref(input[field],'Later actual '+field),capture=artifact.value,before=field==='sourceBefore';
 if(before){assert(Date.parse(capture.recordedAt)>=Date.parse(originalCompletedAt),'Recovery prelaunch capture must be fresh after original full closure');assert(Date.parse(capture.recordedAt)<Date.parse(summary.startedAt),'Recovery source capture must truly precede its own launch');}
 else {assert(Date.parse(capture.recordedAt)>=Date.parse(summary.completedAt));assert.equal(capture.observedAfterClosureAt,capture.recordedAt);}
 assert(capture.runDirectory===null||capture.runDirectory===undefined||path.resolve(ROOT,capture.runDirectory)===directory,'Unrelated run source capture cannot be rebound');
 const boundField=field+'Bound';let bound=artifact;
 if(capture.runDirectory===null||capture.runDirectory===undefined){
  bound=await ref(input[boundField],'Honest later metadata binding '+field);
  for(const [name,value]of Object.entries(capture))if(name!=='runDirectory')assert.deepEqual(bound.value[name],value,'Source capture field relabeled '+name);
  assert.deepEqual(bound.value.sourceArtifact,artifact.reference);assert(Date.parse(bound.value.bindingObservedAt)>=Date.parse(capture.recordedAt)&&Date.parse(bound.value.bindingObservedAt)>=Date.parse(summary.startedAt),'Binding observation must honestly follow capture and actual launch');
 }else assert(!input[boundField],'Already bound capture must not supply an alternate source binding');
 assert.equal(path.resolve(ROOT,bound.value.runDirectory),directory);assert.deepEqual(bound.value.runSelection,summary.selection);assert.equal(bound.value.runStartedAt,summary.startedAt);
 if(!before||bound.value.runCompletedAt!==undefined)assert.equal(bound.value.runCompletedAt,summary.completedAt);
 sourceRows(capture);await driverIdentity(capture,summary.environment);return {artifact,bound};
}

function failureFixture(){
 const rootRecord=JSON.parse(git(['show',LAUNCH+':docs/qa/night-shift/performance-full-run-aa7bca2-failures.json'])).cases.find(row=>row.base==='/');
 const events=rootRecord.observations.runnerErrors.filter(event=>event.type==='pageerror'&&event.name==='SecurityError'&&event.url==='about:blank');assert.equal(events.length,4);assert.equal(rootRecord.observations.runnerErrors.length,13);
 return {events,originalRunnerEvents:rootRecord.observations.runnerErrors,originalOrigin:rootRecord.origin};
}

function rawRecords(reports){return CHECKS.flatMap(check=>reports[check].cases.map(record=>({check,record})));}
function failureList(reports){return rawRecords(reports).flatMap(({check,record})=>record.assertions.filter(row=>row.pass===false).map(assertion=>({check,base:record.base,rawAssertionSHA256:rowsHash(assertion),assertion})));}
function runnerList(reports){return rawRecords(reports).flatMap(({check,record})=>record.observations.runnerErrors.map(event=>({check,base:record.base,rawEventSHA256:rowsHash(event),event})));}

function validatePerfSettings(report,baseline){
 const key=row=>JSON.stringify([row.base,row.route,row.profile]);
 const prior=baseline.cases.flatMap(record=>record.observations.cases),lookup=new Map(prior.map(row=>[key(row),row]));assert.equal(prior.length,16);assert.equal(lookup.size,16);
 for(const record of report.cases){
  const samples=record.observations.cases;assert.equal(samples.length,8);assert.equal(new Set(samples.map(key)).size,8);
  for(const row of samples){assert.equal(row.base,record.base);const original=lookup.get(key(row));assert(original,'Unknown performance sample profile');assert.deepEqual(row.settings,original.settings,'Performance viewport/CPU/network/DPR/clock/cache profile changed '+key(row));}
 }
 return {samples:report.cases.reduce((n,record)=>n+record.observations.cases.length,0),allSettingsExactlyMatchFrozenAA7Before:true};
}

async function passedEvidence(name,record,reportSHA,reviewedSkips,consumed,budgets,report,{validateWholePerf=true}={}){
 const applicable=reviewedSkips.filter(row=>row.check===name&&row.base===record.base);for(const row of applicable){assert.equal(row.rawReportSHA256,reportSHA);assert.equal(row.reviewedBy,'/root');assert(typeof row.review==='string'&&row.review.length>=40);}
 const checked=validateCheckRecord(name,record,applicable,consumed,{gpu:false,bootstrapCaptureGap:name==='failures'?failureFixture():undefined});
 if(name==='deadlines')checked.clockedNativeActions=validateClockedDeadlineEvidence(record);
 if(name==='modes')checked.ownerSceneReadiness=validateMotionReadiness(record);
 if(name==='crosstab')checked.progressPropagation=validatePropagationEvidence(record);
 if(name==='bfcache'||name==='crosstab')checked.nativeOperations=validateNewNativeOperations(name,record);
 if(name==='perf'&&report.status==='passed'&&validateWholePerf)validatePerfReport(report,budgets,{after:true,requireFreshDiagnostics:true});
 return checked;
}

function zeroPixelComparison(row){
 assert.equal(row.equalDimensions,true);assert.deepEqual(row.beforeDimensions,row.afterDimensions);assert.equal(row.pixelIdentical,true);assert.equal(row.beforeSha256,row.afterSha256);assert(/^[a-f0-9]{64}$/.test(row.beforeSha256));
 for(const key of ['changedPixels','changedPixelShare','totalAbsoluteChannelDifference','maxChannelDifference'])assert.equal(row[key],0,'Visual nonzero pixel difference '+key);assert.equal(row.differenceBounds,null);assert.equal(row.totalPixels,row.beforeDimensions.width*row.beforeDimensions.height);
}

async function suiteAndVisual(manifest){
 const suite=await committedRef(manifest.suiteValidation,'performance-current-suite-validation.json','Committed current root/UI/QA tool verification');assert.equal(suite.value.root.CLIexit,0);assert.equal(suite.value.root.tests,415);assert.equal(suite.value.root.pass,415);assert.equal(suite.value.root.fail,0);assert.equal(suite.value.root.skipped,0);assert.equal(suite.value.root.cancelled,0);
 for(const name of ['ciExit','buildExit','testExit'])assert.equal(suite.value.ui[name],0);assert.equal(suite.value.ui.vendorByteIdenticalFiles,8);assert.equal(suite.value.qaTools.tests,138);assert.equal(suite.value.qaTools.pass,138);for(const name of ['fail','cancelled','skipped','todo'])assert.equal(suite.value.qaTools[name],0);assert(suite.value.copyHashes.length>0);assert.equal(new Set(suite.value.copyHashes.map(row=>row.name)).size,suite.value.copyHashes.length);
 for(const artifact of suite.value.copyHashes){const bytes=await readFile(DOCS+'/'+artifact.name);assert.equal(sha256(bytes),artifact.sha256,'Committed suite evidence changed '+artifact.name);assert(bytes.equals(git(['show',LAUNCH+':docs/qa/night-shift/'+artifact.name])),'Suite supporting bytes differ from launch evidence');}
 const visual=await committedRef(manifest.visualProof,'performance-visual-aa7bca2-proof.json','Committed exact primary screenshot proof'),comparison=await committedRef(manifest.visualComparison,'performance-visual-comparison.json','Committed primary exact comparison');
 const proof=visual.value,compare=comparison.value;assert.equal(proof.source.topic.product,PRODUCT);assert.equal(proof.source.topic.protected,PROTECTED);assert.equal(proof.source.control.protected,PROTECTED);for(const name of ['before','after','compare'])assert.equal(proof.captureCLI[name],0);
 assert.equal(proof.summary.independentRGBAIdentical,32);empty(proof.summary.metadataDifferences,'Visual metadata changes');assert.equal(proof.summary.liveCourseCaptures,48);assert.equal(proof.summary.liveMTH140BookCaptures,16);assert.equal(proof.summary.previewPortsClosed,true);assert.equal(proof.summary.browserProcessesClosed,true);assert(proof.previewClosure.every(row=>row.result==='ECONNREFUSED'));empty(proof.liveChromiumProcesses,'Primary visual browsers closed');
 assert.deepEqual(proof.summary.comparison,compare.summary);for(const key of ['expected','compared','pixelIdentical'])assert.equal(compare.summary[key],32);for(const key of ['different','failed','changedPixels','browserErrors','naturalSettlementFailures','repeatFailures','evidenceFailures'])assert.equal(compare.summary[key],0);assert.equal(compare.summary.protectedSourceMatches,true);empty(compare.beforeEvidenceProblems,'Before visual evidence problems');empty(compare.afterEvidenceProblems,'After visual evidence problems');
 assert.equal(compare.beforeProductSourceSha256,proof.source.control.product);assert.equal(compare.afterProductSourceSha256,PRODUCT);assert.equal(compare.beforeProtectedSourceSha256,PROTECTED);assert.equal(compare.afterProtectedSourceSha256,PROTECTED);assert.equal(proof.files.compare.sha256,comparison.reference.sha256);
 assert.equal(compare.cases.length,32);assert.equal(proof.pixelPairs.length,32);assert.equal(proof.metadataPairs.length,32);
 const expectedIDs=BASES.flatMap(base=>ROUTES.flatMap(route=>[{width:1440,height:900},{width:390,height:844}].flatMap(viewport=>['dark','light'].map(theme=>(base==='/'?'root':'project')+'-'+route+'-'+viewport.width+'x'+viewport.height+'-'+theme))));
 equalSet(compare.cases.map(row=>row.id),expectedIDs);equalSet(proof.pixelPairs.map(row=>row.id),expectedIDs);equalSet(proof.metadataPairs.map(row=>row.id),expectedIDs);
 const {PNG}=createRequire(import.meta.url)('/opt/codex/cua_node/lib/node_modules/pngjs');
 const captures={},decoded={before:new Map(),after:new Map()};
 async function verifyPNG(row,phase){
  const file=path.resolve(ROOT,row.screenshot),allowed=ROOT+'/tools/qa/reports/perf-visuals/'+phase+'/';assert(file.startsWith(allowed));const bytes=await readFile(file);assert.equal(bytes.length,row.png.bytes);assert.equal(sha256(bytes),row.png.sha256);
  const png=PNG.sync.read(bytes);assert.equal(png.width,row.viewport.width);assert.equal(png.height,row.viewport.height);assert.equal(row.png.width,png.width);assert.equal(row.png.height,png.height);assert.equal(sha256(png.data),row.png.pixelSha256);return png;
 }
 for(const phase of ['before','after']){
  const source=phase==='before'?proof.source.control:proof.source.topic,input=proof.files[phase];assert.equal(input.path,ROOT+'/tools/qa/reports/perf-visuals/'+phase+'/manifest.json');const capture=await ref(input,'Frozen '+phase+' screenshot manifest');const value=capture.value;captures[phase]=value;
  assert.equal(value.productSourceSha256,source.product);assert.equal(value.productSourceSha256After,source.product);assert.equal(value.protectedSourceSha256,PROTECTED);assert.equal(value.protectedSourceSha256After,PROTECTED);assert.equal(value.sourceUnchanged,true);assert.equal(value.protectedSourceUnchanged,true);assert.deepEqual(value.summary,proof.summary[phase]);assert.equal(value.summary.requested,32);assert.equal(value.summary.captured,32);for(const name of ['failed','initialAttemptFailures','naturalSettlementFailures','errors','evidenceFailures'])assert.equal(value.summary[name],0);assert.equal(value.summary.repeatPixelIdentical,true);assert.equal(value.cases.length,32);equalSet(value.cases.map(row=>row.id),expectedIDs);assert.deepEqual(value.recipe,proof.captureRecipe);assert.equal(value.execution.captureConcurrency,1);assert.equal(value.execution.diagnostic,false);
  assert.equal(value.environment.playwrightPath,'/opt/codex/cua_node/lib/node_modules/playwright');assert.equal(value.environment.executablePath,'/usr/bin/chromium');assert.equal(value.environment.requestedMode,'SwiftShader');assert.equal(value.environment.actualMode,'SwiftShader');assert.equal(value.environment.chromiumVersion,'154.0.8037.57');assert.equal(value.environment.webgl.available,true);assert(value.environment.webgl.renderer.includes('SwiftShader'));assert.equal(value.environment.playwrightLegacyScreenshot,true);
  for(const row of value.cases){
   assert.equal(row.status,'captured');empty(row.errors,'Screenshot browser errors '+row.id);assert(row.naturalSettlementFailure===undefined||row.naturalSettlementFailure===null);assert.equal(row.noWebGL,false);assert.equal(row.fullPage,false);assert.equal(row.nativeClock,false);assert.equal(row.naturalWrapper.opacity,'1');assert.equal(row.naturalWrapper.filter,'none');assert.equal(row.naturalWrapper.transform,'none');assert.equal(row.sceneStability.intervalMs,100);assert.deepEqual(row.sceneStability.before,row.sceneStability.after);assert.equal(row.dom.route,row.route);assert.equal(row.dom.theme,row.theme);assert.equal(row.dom.now,value.fixedTime);assert.equal(row.dom.motion.paused,true);assert.equal(row.dom.motion.scenePaused,true);assert.equal(row.dom.motion.forced,false);
   const url=new URL(row.requestedURL);assert.equal(url.pathname,row.base+(row.route==='desk'?'':row.route+'/'));assert.equal(url.search,row.route==='mth140'?'?tier=high':'');assert.equal(url.hash,'');assert.equal(row.url,row.requestedURL);assert.equal(row.bookTier,row.route==='mth140'?'high':null);
   if(row.route!=='desk'){
    assert(row.actualWebGLContexts.length>0);for(const context of row.actualWebGLContexts){assert.equal(context.contextLost,false);assert(context.drawingBufferWidth>0&&context.drawingBufferHeight>0);assert(context.unmaskedRenderer.includes('SwiftShader'));}
    assert(row.preCaptureScene.length>0);for(const scene of row.preCaptureScene){assert.equal(scene.renderer,'webgl2');assert.equal(scene.ready,'true');assert.equal(scene.motionState,'still');assert(Number(scene.frame)>0&&scene.width>0&&scene.height>0);}assert.deepEqual(row.dom.renderersAtCapture,row.preCaptureScene);
   }
   decoded[phase].set(row.id,await verifyPNG(row,phase));
  }
  const repeat=value.repeatCheck;assert(expectedIDs.includes(repeat.case));assert.equal(repeat.capture.id,repeat.case);assert.equal(repeat.capture.status,'captured');empty(repeat.capture.errors,'Repeat screenshot errors');assert(repeat.capture.naturalSettlementFailure===undefined||repeat.capture.naturalSettlementFailure===null);zeroPixelComparison(repeat.comparison);
  const original=value.cases.find(row=>row.id===repeat.case),png=await verifyPNG(repeat.capture,phase);assert.equal(original.png.sha256,repeat.capture.png.sha256);assert.deepEqual(decoded[phase].get(repeat.case).data,png.data);zeroPixelComparison(compare[phase+'Repeat']);assert.deepEqual(compare[phase+'Repeat'],repeat.comparison);const validation=compare[phase+'RepeatValidation'];zeroPixelComparison(validation);assert.equal(validation.originalHashMatches,true);assert.equal(validation.repeatHashMatches,true);assert.equal(validation.pass,true);
 }
 assert.equal(captures.before.fixedTime,captures.after.fixedTime);assert.deepEqual(captures.before.recipe,captures.after.recipe);
 for(const key of ['playwrightPath','executablePath','args','playwrightLegacyScreenshot','requestedMode','actualMode','chromiumVersion','webgl'])assert.deepEqual(captures.before.environment[key],captures.after.environment[key],'Visual actual environment changed '+key);
 const command=env=>env.chromiumCommandLine.filter(arg=>!arg.startsWith('--user-data-dir='));assert.deepEqual(command(captures.before.environment),command(captures.after.environment));assert.deepEqual(captures.before.environment.gpuInfo.featureStatus,captures.after.environment.gpuInfo.featureStatus);
 for(const row of compare.cases){
  assert.equal(row.status,'compared');zeroPixelComparison(row);empty(row.beforeErrors,'Compared before browser errors');empty(row.afterErrors,'Compared after browser errors');assert.equal(row.beforeNaturalSettlementFailure,null);assert.equal(row.afterNaturalSettlementFailure,null);
  const before=captures.before.cases.find(entry=>entry.id===row.id),after=captures.after.cases.find(entry=>entry.id===row.id),pair=proof.pixelPairs.find(entry=>entry.id===row.id),meta=proof.metadataPairs.find(entry=>entry.id===row.id);
  assert.equal(row.beforeSha256,before.png.sha256);assert.equal(row.afterSha256,after.png.sha256);assert.deepEqual(decoded.before.get(row.id).data,decoded.after.get(row.id).data);assert.equal(before.png.pixelSha256,after.png.pixelSha256);assert.equal(pair.RGBAIdentical,true);assert.equal(pair.beforeSHA256,before.png.sha256);assert.equal(pair.afterSHA256,after.png.sha256);assert.equal(pair.width,before.viewport.width);assert.equal(pair.height,before.viewport.height);for(const key of ['platformFontsIdentical','headingIdentical','wrapperIdentical','themeIdentical','imagesIdentical','sceneBoundsIdentical'])assert.equal(meta[key],true);
 }
 const defaults=[];for(const input of manifest.additionalVisualProofs??[]){const supplement=await ref(input,'Additional actual visual proof');defaults.push(supplement);}
 return {suite,visual,comparison,additional:defaults,defaultMTH140Validated:false,defaultMTH140Status:defaults.length?'Supplied additional proof is preserved; actual default-URL scope requires separate guarded validation before overall completion.':'Pending explicit default-URL MTH140 supplement; primary MTH140 captures use ?tier=high'};
}

async function wholeFollowups(manifest,summary,reports,budgets,baseline){
 const inputs=manifest.wholeCheckFollowups??[];assert(Array.isArray(inputs));
 const failedCases=CHECKS.flatMap(check=>reports[check].cases.filter(record=>record.status==='failed').map(record=>({check,base:record.base})));
 if(!inputs.length)return {status:'none',validated:[],replacements:[],unresolvedCases:failedCases,effectivePerfValidation:null};
 const scope=row=>JSON.stringify([row.check,[...row.bases].sort()]);
 const review=await ref(manifest.wholeFollowupReview,'Exact later whole-check recovery review');assert.equal(review.value.approved,true);assert.equal(review.value.reviewedBy,'/root');assert.equal(review.value.originalSummarySHA256,manifest.summarySHA256);assert.equal(review.value.noOriginalFailureOrEventWaivers,true);
 assert(Array.isArray(review.value.checks));
 for(const row of [...inputs,...review.value.checks])assert(Array.isArray(row.bases)&&row.bases.length>=1&&row.bases.length<=2&&new Set(row.bases).size===row.bases.length&&row.bases.every(base=>BASES.includes(base)),'Every whole-check scope requires exact selected bases');
 equalSet(inputs.map(scope),review.value.checks.map(scope));assert.equal(new Set(inputs.map(scope)).size,inputs.length);
 const validated=[],replacements=[],covered=new Set();
 for(const input of inputs){
  assert(CHECKS.includes(input.check),'Unknown later whole check');
  const selectedOriginal=reports[input.check].cases.filter(record=>input.bases.includes(record.base));
  assert(selectedOriginal.some(record=>record.status==='failed'),'Every recovery must cover an actually failed latest-full case');
  const report=await ref(input.report,'Later whole report'),ownSummary=await ref(input.summary,'Later own summary');
  const directory=path.dirname(input.summary.path);assert.equal(path.dirname(input.report.path),directory);assert.equal(path.basename(input.report.path),input.check+'.json');assert.equal(path.basename(input.summary.path),'summary.json');assert(directory.startsWith(ROOT+'/tools/qa/reports/'),'Require actual raw runner report directory');
  equalSet(ownSummary.value.selection.checks,[input.check]);equalSet(ownSummary.value.checks.map(row=>row.name),[input.check]);equalSet(ownSummary.value.selection.bases,input.bases);assert.equal(ownSummary.value.selection.gpu,false);assert.equal(ownSummary.value.selection.help,false);
  checkStructure(report.value,ownSummary.value,input.check,input.bases);assert.equal(report.value.status,'passed');assert.equal(report.value.failures,0);assert.equal(ownSummary.value.status,'passed');assert.equal(ownSummary.value.exitCode,0);assert.equal(ownSummary.value.failures,0);empty(ownSummary.value.errors,'Later run errors');assert(Date.parse(report.value.startedAt)>=Date.parse(summary.completedAt));
  if(input.check==='perf')validatePerfSettings(report.value,baseline);
  equalSet(report.value.environment.deployments.map(row=>row.base),input.bases);compareEnvironment(report.value.environment,{...summary.environment,deployments:summary.environment.deployments.filter(row=>input.bases.includes(row.base))});
  const approved=review.value.checks.find(row=>scope(row)===scope(input));assert.equal(approved.originalReportSHA256,sha256(await readFile(DIRECTORY+'/'+input.check+'.json')));assert.equal(approved.followupReportSHA256,input.report.sha256);
  const failures=selectedOriginal.flatMap(record=>record.assertions.filter(row=>!row.pass).map(assertion=>({base:record.base,name:assertion.name,rawAssertionSHA256:rowsHash(assertion)})));equalSet(approved.originalFailures.map(row=>JSON.stringify(row)),failures.map(row=>JSON.stringify(row)));
  const capturedBefore=await bindFollowupCapture(input,'sourceBefore',ownSummary.value,directory,summary.completedAt),capturedAfter=await bindFollowupCapture(input,'sourceAfter',ownSummary.value,directory,summary.completedAt),before=capturedBefore.artifact,after=capturedAfter.artifact;
  assert.deepEqual(before.value.sources,after.value.sources);assert.deepEqual(before.value.driverIdentity,after.value.driverIdentity);assert.equal(after.value.sourceUnchanged,true);assert.equal(after.value.driverIdentityUnchanged,true);
  const closure=await closedRun(input,ownSummary.value,directory),log=await ref(input.runnerLog,'Later actual final CLI log',{json:false});assert(log.raw.toString('utf8').includes('QA passed. Reports: '+directory));
  assert.deepEqual(closure.cli.value.argv,['node','tools/qa/run.mjs',input.check,...(input.bases.length===1?['--base',input.bases[0]]:[])],'Bind the literal complete-check CLI selection');
  const peer=await ref(input.peerReview,'Independent actual whole-check evidence review');assert.equal(peer.value.artifactType,'independent-whole-check-followup-evidence-review');assert.equal(peer.value.reviewer,'/root/final_review');assert.equal(peer.value.approved,true);assert.equal(peer.value.sourceApprovalOnly,false);assert.equal(peer.value.check,input.check);equalSet(peer.value.bases,input.bases);assert(Date.parse(peer.value.recordedAt)>=Date.parse(report.value.completedAt));empty(peer.value.findings,'Later independent evidence-review findings');
  for(const name of ['report','summary','sourceBefore','sourceAfter','resourceClosure','cliObservation','runnerLog','reviewedSkips'])assert.deepEqual(peer.value.inputs[name],{path:input[name].path,sha256:input[name].sha256},'Peer review must bind actual evidence '+name);
  for(const name of ['sourceBeforeBound','sourceAfterBound'])if(input[name])assert.deepEqual(peer.value.inputs[name],{path:input[name].path,sha256:input[name].sha256},'Peer review must bind actual source metadata '+name);else assert(!peer.value.inputs[name],'Unrelated alternate metadata binding');
  const currentSkips=await ref(input.reviewedSkips,'Later exact current native gaps');assert(Array.isArray(currentSkips.value));const consumed=new Set(),cases=[];
  for(const record of report.value.cases){
   const old=reports[input.check].cases.find(row=>row.base===record.base);assert.equal(record.status,'passed');equalSet(record.observations.cases.map(row=>row.name),old.observations.cases?.map(row=>row.name)??[],'Later whole fixture identities changed');
   const check=await passedEvidence(input.check,record,input.report.sha256,currentSkips.value,consumed,budgets,report.value,{validateWholePerf:false});
   const oldNames=new Map();for(const row of old.assertions.filter(row=>!row.name.endsWith(': execution')))oldNames.set(row.name,(oldNames.get(row.name)??0)+1);
   for(const [name,count]of oldNames){
    const current=record.assertions.filter(row=>row.name===name&&row.pass===true).length;if(current>=count)continue;
    const route=input.check==='bfcache'&&nativeConditionalRoute(name),availableGap=route&&currentSkips.value.some(row=>row.base===record.base&&row.route===route&&row.rawReportSHA256===input.report.sha256);
    assert(availableGap&&!old.assertions.some(row=>row.name===name&&row.pass===false),'Later substantive fixture assertion or multiplicity missing '+name);
   }
   if(input.check==='bfcache')for(const failed of old.assertions.filter(row=>!row.pass)){
    const oldSegments=segments(old),owner=old.observations.cases?.find(row=>oldSegments.get(row.name)?.some(assertion=>assertion.name===failed.name&&assertion.pass===false));
    if(!owner?.name.endsWith(': native document Back / BFCache'))continue;
    const route=owner.name.split(':')[0],next=record.observations.cases.find(row=>row.name===owner.name);
    assert(next?.after?.pageshow?.some(row=>row.persisted===true),'Previously failed native restoration must execute genuine persisted follow-up; availability cannot substitute');assert(record.assertions.some(row=>row.name===route+': router usable after native restoration'&&row.pass===true));
   }
   const approvedFull=approved.completeFixtureAssertions.find(row=>row.base===record.base);assert(approvedFull&&Array.isArray(approvedFull.names));assert.deepEqual(record.assertions.map(row=>row.name),approvedFull.names,'Every formerly incomplete fixture needs exact reviewed complete substantive assertions');
   cases.push(check);
   if(old.status==='failed'){
    const key=input.check+'\0'+record.base;assert(!covered.has(key),'A failed case cannot have multiple selectively admitted follow-ups');covered.add(key);
    replacements.push({check:input.check,base:record.base,originalReport:{path:DIRECTORY+'/'+input.check+'.json',sha256:approved.originalReportSHA256},originalFailedAssertions:old.assertions.filter(row=>!row.pass),replacementReport:report.reference,actualReplacementCase:record,validatedEvidence:check});
   }
  }
  equalSet(approved.completeFixtureAssertions.map(row=>row.base),input.bases);assert.equal(consumed.size,currentSkips.value.length);
  validated.push({check:input.check,bases:input.bases,report:report.reference,ownSummary:ownSummary.reference,sourceBefore:before.reference,sourceBeforeBound:capturedBefore.bound.reference,sourceAfter:after.reference,sourceAfterBound:capturedAfter.bound.reference,resourceClosure:closure.closure.reference,actualCLI:closure.cli.reference,runnerLog:log.reference,peerReview:peer.reference,reviewedSkips:currentSkips.reference,cases,limitation:'Complete source-bound whole check at its exact selected base(s). Replaces only originally failed effective-coverage cases; latest-normal raw status/failures/events and untouched passed-base evidence remain immutable.'});
 }
 const originalPerfSHA=sha256(await readFile(DIRECTORY+'/perf.json'));
 const unresolvedCases=failedCases.filter(row=>!covered.has(row.check+'\0'+row.base));
 let effectivePerfValidation=null;
 if(replacements.some(row=>row.check==='perf')){
  const records=BASES.map(base=>replacements.find(row=>row.check==='perf'&&row.base===base)?.actualReplacementCase??reports.perf.cases.find(row=>row.base===base));
  if(records.every(record=>record.status==='passed')){
   // This temporary validation container is a disclosed union of actual raw
   // records. It is never represented as a newly executed single full run.
   const validationContainer={...reports.perf,status:'passed',failures:0,runErrors:[],cases:records};
   validatePerfSettings(validationContainer,baseline);validatePerfReport(validationContainer,budgets,{after:true,requireFreshDiagnostics:true});
   effectivePerfValidation={status:'validated-source-bound-effective-per-base-perf-coverage',measurementCases:16,budgetAssertions:368,timings:'report-only',rawSources:BASES.map(base=>{const replacement=replacements.find(row=>row.check==='perf'&&row.base===base);return {base,source:replacement?'complete-source-bound-whole-check-followup':'untouched-passed-latest-normal-full-case',report:replacement?.replacementReport??{path:DIRECTORY+'/perf.json',sha256:originalPerfSHA}};}),singleNewFullRunClaimed:false};
  }
 }
 return {status:'separate-validated-whole-check-followups',review:review.reference,validated,replacements,unresolvedCases,effectivePerfValidation};
}

export async function prepareLatestEvidence(manifest){
 assert.equal(manifest.schemaVersion,1);assert.equal(path.resolve(manifest.runDirectory),DIRECTORY);
 const summaryRaw=await readFile(DIRECTORY+'/summary.json'),summary=JSON.parse(summaryRaw);assert(final(summary),'Do not execute before real closure');assert.equal(sha256(summaryRaw),manifest.summarySHA256);equalSet(summary.selection.checks,CHECKS);equalSet(summary.selection.bases,BASES);assert.equal(summary.selection.gpu,false);assert.equal(summary.selection.help,false);equalSet(summary.checks.map(row=>row.name),CHECKS);
 const source=await sources(manifest,summary),log=await ref(manifest.runnerLog,'Actual final runner log',{json:false});assert(log.raw.toString('utf8').includes('QA '+summary.status+'. Reports: '+DIRECTORY),'Final raw CLI report line is absent');
 const raws={},reports={};let failures=0;for(const name of CHECKS){raws[name]=await readFile(DIRECTORY+'/'+name+'.json');reports[name]=JSON.parse(raws[name]);checkStructure(reports[name],summary,name);failures+=reports[name].failures;}assert.equal(summary.failures,failures);assert.equal(summary.status,summary.exitCode===2?'error':failures?'failed':'passed');assert(summary.exitCode===0||summary.exitCode===1||summary.exitCode===2);if(summary.exitCode===0)empty(summary.errors,'Passed latest run errors');
 const before=await ref(manifest.beforeBaseline,'Current AA7 before baseline');assert.equal(before.reference.sha256,BEFORE_PERF_SHA);const budget=await ref(manifest.budgets,'Current frozen baseline-derived budgets');assert.equal(budget.reference.sha256,BUDGET_SHA);assert.deepEqual(budget.value,makeBudgets(before.value));
 const visual=await suiteAndVisual(manifest),skipInput=await ref(manifest.reviewedSkips,'Actual current latest-run native feature gaps');assert(Array.isArray(skipInput.value));const consumed=new Set(),validationIssues=[];
 try{validatePerfSettings(reports.perf,before.value);}catch(error){validationIssues.push({check:'perf',message:error.message,meaning:'Actual settings remain raw; changed profiles block acceptance.'});}
 const checks=[];
 for(const name of CHECKS){const cases=[];for(const record of reports[name].cases){
  const raw={base:record.base,status:record.status,failures:record.failures,durationMs:record.durationMs,assertions:record.assertions.length,failedAssertions:record.assertions.filter(row=>!row.pass),skipped:record.skipped,runnerEvents:record.observations.runnerErrors,fixtureNames:record.observations.cases?.map(row=>row.name)??null,...(record.error?{error:record.error}:{})};
  let validation=null;if(record.status==='passed'||record.status==='skipped')try{validation=await passedEvidence(name,record,sha256(raws[name]),skipInput.value,consumed,budget.value,reports[name]);}catch(error){validationIssues.push({check:name,base:record.base,rawStatusPreserved:record.status,message:error.message,meaning:'Raw verdict is unchanged; this evidence guard blocks acceptance.'});}
  cases.push({raw,...(validation?{validatedPassedEvidence:validation}:{})});
 }checks.push({name,status:reports[name].status,failures:reports[name].failures,rawReport:{path:DIRECTORY+'/'+name+'.json',sha256:sha256(raws[name])},cases});}
 if(consumed.size!==skipInput.value.length)validationIssues.push({check:'bfcache',message:'Unused/stale current native gap review; accepted only when exact passed case consumes it',reviewed:skipInput.value.length,consumed:consumed.size});
 const records=rawRecords(reports),counts={checks:14,records:records.length,passedRecords:records.filter(row=>row.record.status==='passed').length,failedRecords:records.filter(row=>row.record.status==='failed').length,unavailableRecords:records.filter(row=>row.record.status==='skipped').length,assertions:records.reduce((n,row)=>n+row.record.assertions.length,0),passedAssertions:records.reduce((n,row)=>n+row.record.assertions.filter(a=>a.pass===true).length,0),failedAssertions:failures,skipEntries:records.reduce((n,row)=>n+row.record.skipped.length,0),runnerEvents:records.reduce((n,row)=>n+row.record.observations.runnerErrors.length,0)};assert.equal(counts.records,28);
 let perfValidation={status:'failed-original-check-preserved',canonicalAfterCandidate:null,rawReportSHA256:sha256(raws.perf),unvalidatedOrFailedSamples:reports.perf.cases.flatMap(record=>(record.observations.cases??[]).filter(row=>row.collection?.capped||!row.collection?.routeReady||!row.collection?.networkQuiet||!row.collection?.readiness?.optionalFeaturesAttempted).map(row=>({base:record.base,route:row.route,profile:row.profile,collection:row.collection,networkUnfinishedURLs:row.network?.unfinishedURLs,timingObserverErrors:row.timings?.observerErrors}))),limitation:'Latest failed/capped samples are retained and are never substituted into canonical AFTER. Old660 metrics are not used.'};
 if(reports.perf.status==='passed')try{validatePerfReport(reports.perf,budget.value,{after:true,requireFreshDiagnostics:true});perfValidation={status:'validated-complete-latest-check',canonicalAfterCandidate:'archive/perf.json',rawReportSHA256:sha256(raws.perf),measurementCases:16,budgetAssertions:368,timings:'report-only'};}catch(error){validationIssues.push({check:'perf',message:error.message});}
 const followups=await wholeFollowups(manifest,summary,reports,budget.value,before.value),rawFailedAssertions=failureList(reports),rawRunnerEvents=runnerList(reports);
 const acceptance=summary.status==='passed'&&summary.exitCode===0&&!validationIssues.length&&reports.perf.status==='passed';
 const effectiveRecords=records.map(({check,record})=>{
  const replacement=followups.replacements.find(row=>row.check===check&&row.base===record.base);
  return {check,base:record.base,source:replacement?'complete-source-bound-whole-check-followup':'untouched-latest-normal-full-case',report:replacement?.replacementReport??{path:DIRECTORY+'/'+check+'.json',sha256:sha256(raws[check])},record:replacement?.actualReplacementCase??record};
 });
 const effectiveCounts={records:effectiveRecords.length,passedRecords:effectiveRecords.filter(row=>row.record.status==='passed').length,failedRecords:effectiveRecords.filter(row=>row.record.status==='failed').length,unavailableRecords:effectiveRecords.filter(row=>row.record.status==='skipped').length,assertions:effectiveRecords.reduce((n,row)=>n+row.record.assertions.length,0),failedAssertions:effectiveRecords.reduce((n,row)=>n+row.record.assertions.filter(assertion=>!assertion.pass).length,0),skipEntries:effectiveRecords.reduce((n,row)=>n+row.record.skipped.length,0),runnerEvents:effectiveRecords.reduce((n,row)=>n+row.record.observations.runnerErrors.length,0)};
 const effectivePerfComplete=perfValidation.status==='validated-complete-latest-check'||followups.effectivePerfValidation!==null;
 const effectiveAcceptance=!summary.errors.length&&!validationIssues.length&&!effectiveCounts.failedRecords&&!followups.unresolvedCases.length&&effectivePerfComplete;
 const effectiveCoverage={status:effectiveAcceptance?'validated-effective-coverage':'unresolved-effective-coverage',accepted:effectiveAcceptance,counts:effectiveCounts,cases:effectiveRecords,performance:followups.effectivePerfValidation??perfValidation,originalLatestFullVerdictUnchanged:true,singleNewAll14RunClaimed:false};
 const browser={schemaVersion:4,status:summary.status,exitCode:summary.exitCode,failures:summary.failures,latestNormalFullRunVerdictUnchanged:true,latestFullAcceptance:acceptance,launchRepositoryCommit:LAUNCH,reportDirectory:DIRECTORY,startedAt:summary.startedAt,completedAt:summary.completedAt,environment:summary.environment,summaryReport:{path:DIRECTORY+'/summary.json',sha256:manifest.summarySHA256},counts,checks,rawFailedAssertions,rawRunnerEvents,runErrors:summary.errors,evidenceValidationIssues:validationIssues,sourceProof:{before:source.before.reference,bound:source.bound.reference,after:source.after.reference,closure:source.closure.reference,actualCLI:source.cli.reference,productFingerprint:PRODUCT,protectedFingerprint:PROTECTED,truePrelaunchCaptureAt:source.before.value.recordedAt,bindingObservedAt:source.bound.value.bindingObservedAt},performance:perfValidation,separateWholeCheckFollowups:followups,limitation:acceptance?'Raw latest full run and evidence guards passed, with declared availability limits.':'Latest full run has unresolved raw failures and/or evidence guard failures. Separate follow-ups never rewrite this run as passed.'};
 const verification={schemaVersion:3,status:acceptance?'browser-qa-passed-default-visual-supplement-pending':'blocked-by-latest-browser-qa',latestFullAcceptance:acceptance,overallRequestedGoalComplete:acceptance&&visual.defaultMTH140Validated,launchRepositoryCommit:LAUNCH,currentSourceFingerprints:source.current,rootSuite:{reference:visual.suite.reference,...visual.suite.value.root},ui:{reference:visual.suite.reference,...visual.suite.value.ui},qaTools:{reference:visual.suite.reference,...visual.suite.value.qaTools},visual:{primaryProof:visual.visual.reference,comparison:visual.comparison.reference,primaryPixelIdentical:32,primaryChangedPixels:0,primaryMTH140Tier:'high; ?tier=high',defaultURLMTH140:visual.defaultMTH140Status,defaultURLMTH140Validated:visual.defaultMTH140Validated,additionalProofs:visual.additional.map(row=>row.reference)},browserQA:{status:summary.status,exitCode:summary.exitCode,counts,summarySHA256:manifest.summarySHA256,rawFailedAssertions,runErrors:summary.errors,validationIssues},performance:perfValidation,resourceBudgetBaseline:{before:before.reference,budgets:budget.reference,old660MetricsUsed:false},separateWholeCheckFollowups:followups,privateGuardTestsNotAddedToProductionUnitCounts:true};
 browser.effectiveCoverage=effectiveCoverage;verification.effectiveCoverage=effectiveCoverage;verification.effectiveCoverageAcceptance=effectiveAcceptance;verification.overallRequestedGoalComplete=effectiveAcceptance&&visual.defaultMTH140Validated;
 if(!acceptance&&effectiveAcceptance)verification.status='effective-browser-qa-passed-default-visual-supplement-pending';
 const output=path.resolve(manifest.outputDirectory);assert(output.startsWith('/tmp/')&&output!==DIRECTORY,'Only private /tmp candidates may be written');
 const copies=[{name:'summary.json',raw:summaryRaw},...CHECKS.map(name=>({name:name+'.json',raw:raws[name]})),{name:'runner.log',raw:log.raw},...[[source.before,'source-before.json'],[source.bound,'source-before-bound.json'],[source.after,'source-after.json'],[source.closure,'resource-closure.json'],[source.cli,'cli-observation.json']].map(([artifact,name])=>({name,raw:artifact.raw}))];
 if(manifest.wholeCheckFollowups?.length){
  copies.push({name:'whole-followup-root-review.json',raw:(await ref(manifest.wholeFollowupReview,'Archive root recovery review')).raw});
  for(const [index,input]of manifest.wholeCheckFollowups.entries())for(const name of ['report','summary','sourceBefore','sourceAfter','sourceBeforeBound','sourceAfterBound','resourceClosure','cliObservation','runnerLog','reviewedSkips','peerReview'])if(input[name])copies.push({name:'followup-'+index+'-'+name+(name==='runnerLog'?'.log':'.json'),raw:(await ref(input[name],'Archive whole recovery '+name,{json:name!=='runnerLog'})).raw});
 }
 // Nothing above writes any file. Every input verdict/event/expected flag stays
 // intact. This candidate archive is reviewable before root promotes anything.
 await mkdir(output+'/archive',{recursive:true});const archive=[];for(const copy of copies){const target=output+'/archive/'+copy.name;await writeFile(target,copy.raw);assert.deepEqual(await readFile(target),copy.raw);archive.push({name:copy.name,path:target,sha256:sha256(copy.raw),bytes:copy.raw.length,byteIdentical:true});}
 await writeFile(output+'/performance-browser-qa.candidate.json',JSON.stringify(browser,null,2)+'\n');await writeFile(output+'/performance-verification.candidate.json',JSON.stringify(verification,null,2)+'\n');
 const archived={schemaVersion:1,recordedAt:new Date().toISOString(),status:'actual-completed-latest-full-run-preserved',originalStatus:summary.status,originalExitCode:summary.exitCode,counts,archive,originalRawAssertionsAndTelemetryUnchanged:true,repositoryWrites:false,latestFullAcceptance:acceptance};await writeFile(output+'/archive-verification.json',JSON.stringify(archived,null,2)+'\n');
 return {output,originalStatus:summary.status,originalExitCode:summary.exitCode,counts,validationIssues,latestFullAcceptance:acceptance,effectiveCoverageAcceptance:effectiveAcceptance,effectiveCounts,archiveFiles:archive.length,performance:perfValidation};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){assert.equal(process.argv.length,3,'Usage: node /tmp/ns-perf-latest-run-evidence.mjs /tmp/manifest.json');prepareLatestEvidence(JSON.parse(await readFile(process.argv[2]))).then(result=>console.log(JSON.stringify(result,null,2))).catch(error=>{console.error(error.stack??error);process.exitCode=1;});}
