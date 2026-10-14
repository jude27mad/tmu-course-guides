import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {assertCaptureCompatibility,assertResumeSourceEvidence,cases,captureCaseURL,captureWork,captureEvidenceProblems,comparePixels,nativeLayerRedrawPhase,parseCaptureOptions,requestNativeLayerRedraw,validateRepeatPixels,visualCaptureRecipe} from './compare-perf-visuals.mjs';
const require=createRequire(import.meta.url);
const {PNG}=require(process.env.PNGJS_PATH||'/opt/codex/cua_node/lib/node_modules/pngjs');

test('visual capture matrix covers four routes, two deployment bases, two viewports and two themes',()=>{
  const matrix=cases();
  assert.equal(matrix.length,32);
  assert.equal(new Set(matrix.map(entry=>entry.id)).size,32);
  for(const base of ['/','/tmu-course-guides/'])for(const route of ['desk','cen100','mth140','mth141'])for(const viewport of ['1440x900','390x844'])for(const theme of ['dark','light']) {
    assert.ok(matrix.some(entry=>entry.base===base&&entry.route===route&&`${entry.viewport.width}x${entry.viewport.height}`===viewport&&entry.theme===theme));
  }
});

test('raw comparison detects a one-channel difference without tolerance and gives its exact bounds',()=>{
  const before={width:2,height:2,data:Buffer.alloc(16,255)},after={...before,data:Buffer.from(before.data)};
  assert.equal(comparePixels(before,after).metrics.pixelIdentical,true);
  after.data[12]=254;
  const {metrics,diff}=comparePixels(before,after);
  assert.equal(metrics.pixelIdentical,false);
  assert.equal(metrics.changedPixels,1);
  assert.equal(metrics.changedPixelShare,.25);
  assert.equal(metrics.totalAbsoluteChannelDifference,1);
  assert.equal(metrics.maxChannelDifference,1);
  assert.deepEqual(metrics.differenceBounds,{left:1,top:1,right:1,bottom:1});
  assert.deepEqual([...diff.data.subarray(12,16)],[255,0,255,255]);
});

test('raw comparison reports unequal page heights even when added pixels are transparent black',()=>{
  const before={width:2,height:1,data:Buffer.alloc(8)},after={width:2,height:2,data:Buffer.alloc(16)};
  const {metrics}=comparePixels(before,after);
  assert.equal(metrics.equalDimensions,false);
  assert.equal(metrics.pixelIdentical,false);
  assert.equal(metrics.changedPixels,2);
  assert.deepEqual(metrics.differenceBounds,{left:0,top:1,right:1,bottom:1});
});

test('a missing --only value fails before any browser capture can start',()=>{
  assert.throws(()=>parseCaptureOptions(['--only']),/--only requires a case ID/);
  assert.throws(()=>parseCaptureOptions(['--only','--repeat-check']),/--only requires a case ID/);
  assert.deepEqual(parseCaptureOptions(['--only','root-mth140-1440x900-dark','--resume']),{only:'root-mth140-1440x900-dark',resume:true});
});

const capturedRecords=()=>cases().map(record=>({...record,status:'captured',errors:[]}));
const completedManifest=records=>({recipe:{noWebGL:false},execution:{captureConcurrency:1},sourceUnchanged:true,productSourceSha256:'product',productSourceSha256After:'product',protectedSourceUnchanged:true,protectedSourceSha256:'protected',protectedSourceSha256After:'protected',cases:records??capturedRecords()});

test('public book-tier override preserves matrix IDs and changes only MTH140 URLs at both bases',()=>{
  const options=parseCaptureOptions(['--book-tier','high']),matrix=cases(options);
  assert.deepEqual(options,{bookTier:'high'});
  assert.deepEqual(matrix.map(entry=>entry.id),cases().map(entry=>entry.id));
  for(const entry of matrix) {
    const url=new URL(captureCaseURL(entry,'http://localhost:4321'));
    assert.equal(url.pathname,entry.base+(entry.route==='desk'?'':entry.route+'/'));
    assert.equal(url.search,entry.route==='mth140'?'?tier=high':'');
    assert.equal(entry.bookTier,entry.route==='mth140'?'high':undefined);
  }
  for(const base of ['/','/tmu-course-guides/'])assert.ok(captureWork(base,options).selected.filter(entry=>entry.route==='mth140').every(entry=>entry.bookTier==='high'));
  for(const options of [['--book-tier'],['--book-tier','--serial'],['--book-tier','mid'],['--book-tier','high','--no-webgl']])assert.throws(()=>parseCaptureOptions(options),/book-tier/);
});

test('comparison and resume require the same public book-tier recipe',()=>{
  const original=completedManifest(),forced={...original,recipe:visualCaptureRecipe({bookTier:'high'})};
  assert.deepEqual(forced.recipe.bookTier,{route:'mth140',value:'high',query:'?tier=high'});
  assert.throws(()=>assertCaptureCompatibility(original,forced),/recipes differ/);
  assert.doesNotThrow(()=>assertCaptureCompatibility(forced,{...forced}));
});

test('public book-tier evidence rejects wrong queries, routes, actual tiers and repeat navigation',()=>{
  const records=cases({bookTier:'high'}).map(entry=>({...entry,status:'captured',errors:[],bookTier:entry.bookTier??null,tier:entry.route==='mth140'?'high':null,requestedURL:captureCaseURL(entry,'http://localhost:4321'),url:captureCaseURL(entry,'http://localhost:4321')}));
  const manifest={...completedManifest(records),recipe:visualCaptureRecipe({bookTier:'high'})};
  assert.deepEqual(captureEvidenceProblems(manifest),[]);
  const original=records.find(entry=>entry.route==='mth140');original.png={sha256:'original'};
  manifest.repeatCheck={case:original.id,capture:{...original,png:{sha256:'repeated'}},comparison:{pixelIdentical:true,beforeSha256:'original',afterSha256:'repeated'}};
  assert.deepEqual(captureEvidenceProblems(manifest),[]);
  const badURL=original.url.replace('?tier=high','');
  for(const patch of [{url:badURL},{requestedURL:badURL},{url:original.url+'&extra=1'},{bookTier:null},{tier:'mid'}]) {
    const saved={...original};Object.assign(original,patch);
    assert.ok(captureEvidenceProblems(manifest).some(problem=>problem.scope==='case'&&problem.reason.includes('book-tier')));
    Object.assign(original,saved);
  }
  manifest.repeatCheck.capture.url=badURL;
  assert.ok(captureEvidenceProblems(manifest).some(problem=>problem.scope==='repeat'&&problem.reason.includes('book-tier')));
  delete manifest.repeatCheck;
  records[0].url+='?tier=high';
  assert.ok(captureEvidenceProblems(manifest).some(problem=>problem.scope==='case'&&problem.reason.includes('book-tier')));
});

test('resume still performs a requested repeat when all matrix captures already exist',()=>{
  const records=capturedRecords(),work=captureWork('/',{resume:true,repeatCheck:true},records);
  assert.equal(work.selected.length,0);
  assert.equal(work.needsPreview,true);
  assert.equal(work.repeat.id,'root-mth140-1440x900-dark');
});

test('an explicit repeat case validates CEN without changing the 32-case matrix',()=>{
  const parsed=parseCaptureOptions(['--repeat-case','root-cen100-1440x900-dark']);
  assert.deepEqual(parsed,{repeatCase:'root-cen100-1440x900-dark',repeatCheck:true});
  const work=captureWork('/',parsed,capturedRecords());
  assert.equal(work.selected.length,16);
  assert.equal(work.repeat.id,'root-cen100-1440x900-dark');
  assert.throws(()=>parseCaptureOptions(['--repeat-case']),/requires a case ID/);
  assert.throws(()=>parseCaptureOptions(['--only','root-desk-1440x900-dark','--repeat-case','root-cen100-1440x900-dark']),/must select the same case/);
});

test('mixed-history probe captures the original, selected other routes, then repeats the original',()=>{
  const parsed=parseCaptureOptions(['--only','root-cen100-1440x900-dark','--probe-history','root-mth140-1440x900-dark','--probe-history','root-mth141-1440x900-dark']);
  const work=captureWork('/',parsed);
  assert.deepEqual(work.selected.map(record=>record.id),['root-cen100-1440x900-dark','root-mth140-1440x900-dark','root-mth141-1440x900-dark']);
  assert.equal(parsed.repeatCheck,true);
  assert.equal(captureWork('/',parsed,capturedRecords()).repeat.id,parsed.only);
  assert.throws(()=>parseCaptureOptions(['--probe-history','root-mth140-1440x900-dark']),/requires --only/);
});

test('resume and comparison cannot mix capture concurrency or incomplete source evidence',()=>{
  const manifest=completedManifest();
  assert.doesNotThrow(()=>assertCaptureCompatibility(manifest,completedManifest()));
  assert.throws(()=>assertCaptureCompatibility(manifest,{...manifest,execution:{captureConcurrency:2}}),/concurrency differs/);
  assert.deepEqual(captureEvidenceProblems(manifest),[]);
  delete manifest.productSourceSha256After;
  assert.ok(captureEvidenceProblems(manifest).some(problem=>problem.reason.includes('completion evidence')));
  manifest.productSourceSha256After='product';delete manifest.protectedSourceUnchanged;
  assert.ok(captureEvidenceProblems(manifest).some(problem=>problem.reason.includes('Protected source completion')));
});

test('resume preserves invalid run provenance while allowing a completed failed-case retry',()=>{
  const manifest=completedManifest();manifest.cases[0].status='failed';
  assert.doesNotThrow(()=>assertResumeSourceEvidence(manifest));
  assert.throws(()=>assertResumeSourceEvidence({...manifest,sourceUnchanged:false}),/provenance is incomplete or invalid/);
  assert.throws(()=>assertResumeSourceEvidence({...manifest,interrupted:{signal:'SIGTERM'}}),/Capture interrupted/);
  delete manifest.productSourceSha256After;
  assert.throws(()=>assertResumeSourceEvidence(manifest),/completion evidence/);
});

test('compositor stabilization changes only the recorded Chromium environment condition',()=>{
  const original=visualCaptureRecipe(),stabilized=visualCaptureRecipe({compositorDrain:true});
  assert.deepEqual(Object.keys(stabilized).filter(key=>JSON.stringify(stabilized[key])!==JSON.stringify(original[key])),['compositorStagesBeforeDraw']);
  assert.equal(stabilized.fullPage,false);assert.equal(stabilized.masking,false);assert.equal(stabilized.cssInjection,false);
  assert.deepEqual(parseCaptureOptions(['--compositor-drain','--serial']),{compositorDrain:true,serial:true});
  for(const [option,key,field] of [['--disable-partial-raster','disablePartialRaster','partialRaster'],['--disable-gpu-rasterization','disableGpuRasterization','gpuRasterization'],['--disable-gpu-compositing','disableGpuCompositing','gpuCompositing']]) {
    assert.deepEqual(parseCaptureOptions([option]),{[key]:true});
    assert.deepEqual(visualCaptureRecipe({[key]:true}),{...original,[field]:false});
  }
  assert.deepEqual(visualCaptureRecipe({settledDelayMs:5000}),{...original,settledDelayMs:5000});
  assert.deepEqual(visualCaptureRecipe({observeCompositor:true}),{...original,compositorObserver:true});
  assert.deepEqual(visualCaptureRecipe({legacyScreenshot:true}),{...original,chromiumScreenshotSurface:'legacy'});
  assert.deepEqual(visualCaptureRecipe({nativeLayerRedraw:true}),{...original,nativeLayerInvalidation:{desk:'after final visibilitychange DOM reconstruction',course:'before final visibilitychange static scene redraw'}});
  assert.deepEqual(parseCaptureOptions(['--native-layer-redraw']),{nativeLayerRedraw:true});
  assert.deepEqual(parseCaptureOptions(['--settled-delay-ms','5000','--observe-compositor']),{settledDelayMs:5000,observeCompositor:true});
  assert.throws(()=>parseCaptureOptions(['--settled-delay-ms','1400']),/at least1500/);
  assert.throws(()=>parseCaptureOptions(['--settled-delay-ms']),/at least1500/);
});

test('Desk repaint follows final DOM reconstruction while course repaint precedes WebGL refresh',()=>{
  assert.equal(nativeLayerRedrawPhase('desk'),'after final visibilitychange DOM reconstruction');
  for(const route of ['cen100','mth140','mth141'])assert.equal(nativeLayerRedrawPhase(route),'before final visibilitychange static scene redraw');
  assert.deepEqual(parseCaptureOptions(['--paint-diagnostic']),{paintDiagnostic:true});
});

test('native layer invalidation requires the real browser API and waits two frames',async()=>{
  const previousChrome=globalThis.chrome,previousRAF=globalThis.requestAnimationFrame,events=[];
  try {
    globalThis.chrome={gpuBenchmarking:{setNeedsDisplayOnAllLayers(){events.push('native-invalidation');}}};
    globalThis.requestAnimationFrame=callback=>{events.push('frame');callback();};
    await requestNativeLayerRedraw({evaluate:fn=>fn()});
    assert.deepEqual(events,['native-invalidation','frame','frame']);
    delete globalThis.chrome;
    await assert.rejects(requestNativeLayerRedraw({evaluate:fn=>fn()}),/API is unavailable/);
  }finally{if(previousChrome===undefined)delete globalThis.chrome;else globalThis.chrome=previousChrome;if(previousRAF===undefined)delete globalThis.requestAnimationFrame;else globalThis.requestAnimationFrame=previousRAF;}
});

test('--only scopes resumed captures and retries to the requested case and deployment base',()=>{
  const records=capturedRecords(),target=records.find(record=>record.id==='project-mth140-1440x900-dark');
  target.status='failed';records[0].status='failed';
  const options={resume:true,only:target.id};
  const project=captureWork('/tmu-course-guides/',options,records),root=captureWork('/',options,records);
  assert.deepEqual(project.selected.map(record=>record.id),[target.id]);
  assert.deepEqual(project.retries.map(record=>record.id),[target.id]);
  assert.equal(root.selected.length,0);assert.equal(root.retries.length,0);assert.equal(root.needsPreview,false);
});

test('software compositor requires native readback and live SwiftShader evidence in captures and repeats',()=>{
  const records=capturedRecords().filter(record=>record.route==='cen100'),manifest=completedManifest(records);
  const live={contextLost:false,drawingBufferWidth:691,drawingBufferHeight:550,unmaskedRenderer:'ANGLE Vulkan SwiftShader'};
  manifest.recipe={gpuCompositing:false,noWebGL:false};
  manifest.environment={gpuInfo:{featureStatus:{gpu_compositing:'disabled_software',webgl:'enabled_readback'},auxAttributes:{glRenderer:'ANGLE Vulkan SwiftShader'}}};
  for(const record of records)record.actualWebGLContexts=[{...live}];
  const original=records[0];original.png={sha256:'original'};
  manifest.repeatCheck={case:original.id,capture:{...original,png:{sha256:'repeated'},actualWebGLContexts:[{...live}]},comparison:{pixelIdentical:true,beforeSha256:'original',afterSha256:'repeated'}};
  assert.deepEqual(captureEvidenceProblems(manifest),[]);
  for(const invalid of [undefined,[],[{...live,contextLost:true}],[{...live,drawingBufferWidth:0}],[{...live,drawingBufferHeight:0}],[{...live,unmaskedRenderer:'llvmpipe'}]]) {
    original.actualWebGLContexts=invalid;manifest.repeatCheck.capture.actualWebGLContexts=invalid;
    assert.ok(captureEvidenceProblems(manifest).some(problem=>problem.scope==='case'&&problem.reason.includes('WebGL2 capture')));
    assert.ok(captureEvidenceProblems(manifest).some(problem=>problem.scope==='repeat'&&problem.reason.includes('WebGL2 repeat')));
  }
  original.actualWebGLContexts=[live];manifest.repeatCheck.capture.actualWebGLContexts=[live];
  for(const invalid of [undefined,{featureStatus:{gpu_compositing:'enabled',webgl:'enabled_readback'},auxAttributes:{glRenderer:'SwiftShader'}},{featureStatus:{gpu_compositing:'disabled_software',webgl:'disabled_off'},auxAttributes:{glRenderer:'SwiftShader'}},{featureStatus:{gpu_compositing:'disabled_software',webgl:'enabled_readback'},auxAttributes:{glRenderer:'llvmpipe'}}]) {
    manifest.environment.gpuInfo=invalid;
    assert.ok(captureEvidenceProblems(manifest).some(problem=>problem.scope==='manifest'&&/compositor|readback/.test(problem.reason)));
  }
});

test('software compositor rejects the separate no-WebGL poster recipe before launch',()=>{
  assert.throws(()=>parseCaptureOptions(['--no-webgl','--disable-gpu-compositing']),/requires live WebGL/);
  assert.deepEqual(parseCaptureOptions(['--no-webgl']),{noWebGL:true});
});

test('capture evidence rejects browser errors, natural settlement failures and unsuccessful captures',()=>{
  const manifest=completedManifest();
  assert.deepEqual(captureEvidenceProblems(manifest),[]);
  manifest.cases[0].errors=[{type:'pageerror',message:'Visible product failure'}];
  manifest.cases[1].naturalSettlementFailure='Wrapper remained translated';
  manifest.cases[2].status='failed';
  const reasons=captureEvidenceProblems(manifest).map(problem=>problem.reason);
  assert.ok(reasons.includes('Browser error evidence is missing or nonempty'));
  assert.ok(reasons.includes('Natural wrapper settlement failed'));
  assert.ok(reasons.includes('Capture was not successful'));
});

test('capture evidence rejects arbitrary IDs and mismatched canonical viewport metadata',()=>{
  const manifest=completedManifest();
  manifest.cases[0].id='invented-case';manifest.cases[1].viewport={width:1,height:1};
  const problems=captureEvidenceProblems(manifest);
  assert.equal(problems.filter(problem=>problem.reason.includes('canonical matrix')).length,2);
});

test('identical stored repeat metrics cannot override repeat browser or settlement failures',()=>{
  const record={...capturedRecords()[0],png:{sha256:'original'}},repeated={...record,png:{sha256:'repeated'},errors:[{type:'pageerror',message:'Repeat failed'}],naturalSettlementFailure:'Repeat wrapper did not settle'};
  const manifest={...completedManifest([record]),repeatCheck:{case:record.id,capture:repeated,comparison:{pixelIdentical:true,beforeSha256:'original',afterSha256:'repeated'}}};
  const problems=captureEvidenceProblems(manifest);
  assert.ok(problems.some(problem=>problem.reason==='Repeat browser error evidence is missing or nonempty'));
  assert.ok(problems.some(problem=>problem.reason==='Repeat natural wrapper settlement failed'));
  manifest.repeatCheck.comparison.beforeSha256='unrelated';
  assert.ok(captureEvidenceProblems(manifest).some(problem=>problem.reason.includes('provenance')));
});

test('repeat validation decodes actual PNGs and rejects changed, tampered or missing repeat bytes',async()=>{
  const makeBytes=red=>{const png=new PNG({width:1,height:1});png.data.set([red,2,3,255]);return PNG.sync.write(png);};
  const originalBytes=makeBytes(1),repeatedBytes=makeBytes(2),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
  const original={...capturedRecords()[0],screenshot:'original.png',png:{sha256:sha(originalBytes)}},repeated={...original,screenshot:'repeated.png',png:{sha256:sha(repeatedBytes)}};
  const manifest={cases:[original],repeatCheck:{case:original.id,capture:repeated,comparison:{pixelIdentical:true}}};
  const readBytes=async filename=>filename.endsWith('/original.png')?originalBytes:repeatedBytes;
  const changed=await validateRepeatPixels(manifest,{readBytes});
  assert.equal(changed.changedPixels,1);assert.equal(changed.pass,false);
  repeated.png.sha256=sha(originalBytes);
  assert.equal((await validateRepeatPixels(manifest,{readBytes})).repeatHashMatches,false);
  const missing=await validateRepeatPixels(manifest,{readBytes:async()=>{throw Error('ENOENT missing repeat');}});
  assert.equal(missing.pass,false);assert.match(missing.failure,/ENOENT/);
});
