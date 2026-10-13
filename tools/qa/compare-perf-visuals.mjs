import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {ROOT,collectPageErrors,inspectBrowserEnvironment,resolveLaunchOptions,resolvePlaywright,startPreview} from './runtime.mjs';

const require=createRequire(import.meta.url);
const {PNG}=require(process.env.PNGJS_PATH||'/opt/codex/cua_node/lib/node_modules/pngjs');
const REPORTS=path.join(ROOT,'tools/qa/reports/perf-visuals');
const FIXED_TIME='2026-10-13T16:00:00.000Z';
const ROUTES=['desk','cen100','mth140','mth141'];
const BASES=['/','/tmu-course-guides/'];
const VIEWPORTS=[{width:1440,height:900},{width:390,height:844}];
const THEMES=['dark','light'];
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const slash=value=>value.split(path.sep).join('/');
const relative=value=>slash(path.relative(ROOT,value));

async function productSourceFingerprint({protectedOnly=false}={}) {
  const files=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z','--','assets','*.html','cen100','mth140','mth141'],{cwd:ROOT,encoding:'utf8'}).split('\0').filter(Boolean);
  const digest=createHash('sha256');
  for(const file of [...new Set(files)].sort()) {
    if(protectedOnly&&['assets/app/router.mjs','assets/app/route-boot.mjs'].includes(file))continue;
    digest.update(file+'\0');
    try {
      const bytes=await readFile(path.join(ROOT,file));
      // Performance changes own the route head hints and router/bootstrap.
      // Every other asset and all authored body markup remain protected.
      digest.update(protectedOnly&&file.endsWith('.html')?bytes.toString('utf8').match(/<body\b[\s\S]*$/i)?.[0]??bytes:bytes);
    }catch(error){if(error.code==='ENOENT')digest.update('missing');else throw error;}
    digest.update('\0');
  }
  return digest.digest('hex');
}

export function cases({noWebGL=false}={}) {
  return BASES.flatMap(base=>ROUTES.flatMap(route=>VIEWPORTS.flatMap(viewport=>THEMES.map(theme=>({
    id:`${base==='/'?'root':'project'}-${route}-${viewport.width}x${viewport.height}-${theme}${noWebGL?'-no-webgl':''}`,
    base,route,viewport,theme,noWebGL
  })))));
}

export function visualCaptureRecipe({fullPage=false,nativeClock=false,noWebGL=false,compositorDrain=false,disablePartialRaster=false,disableGpuRasterization=false,settledDelayMs=1500,observeCompositor=false,legacyScreenshot=false,nativeLayerRedraw=false}={}) {
  return {fullPage,deviceScaleFactor:1,timezone:'America/Toronto',locale:'en-CA',initialSavedScenePause:true,entryAnimations:'normal',settledDelayMs,
    random:'FNV-1a route seed with a 32-bit LCG; seeded before product scripts',initialClock:nativeClock?'native Date (diagnostic)':'moving Date offset',
    freeze:'freeze after settlement, pause through GuideMotion and dispatch workspace-changed/visibilitychange; final visibilitychange redraw immediately before capture',
    sceneReadyGate:true,sceneFrameAndBoundsStableMs:100,screenshotAnimations:'disabled',masking:false,cssInjection:false,noWebGL,
    ...(compositorDrain?{compositorStagesBeforeDraw:true}:{}),...(disablePartialRaster?{partialRaster:false}:{}),...(disableGpuRasterization?{gpuRasterization:false}:{}),...(observeCompositor?{compositorObserver:true}:{}),...(legacyScreenshot?{chromiumScreenshotSurface:'legacy'}:{}),...(nativeLayerRedraw?{nativeLayerInvalidation:'setNeedsDisplayOnAllLayers after DOM settlement, before final visibilitychange static scene redraw'}:{})};
}

export async function requestNativeLayerRedraw(page) {
  await page.evaluate(()=>{
    const gpu=globalThis.chrome?.gpuBenchmarking;
    if(typeof gpu?.setNeedsDisplayOnAllLayers!=='function')throw Error('Required native all-layer invalidation API is unavailable.');
    gpu.setNeedsDisplayOnAllLayers();
    return new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  });
}

export function captureWork(base,{only,historyCases=[],noWebGL=false,resume=false,repeatCheck=false,repeatCase,fullPage=false,nativeClock=false}={},records=[]) {
  const matchesSelection=entry=>!only||entry.id===only||historyCases.includes(entry.id);
  const selected=cases({noWebGL}).filter(entry=>entry.base===base&&matchesSelection(entry)&&(!resume||!records.some(record=>record.id===entry.id&&record.status==='captured'))).sort((a,b)=>Number(b.id===only)-Number(a.id===only)).map(entry=>({...entry,fullPage,nativeClock}));
  const repeatId=only||repeatCase||`root-mth140-1440x900-dark${noWebGL?'-no-webgl':''}`;
  const repeatBase=cases({noWebGL}).find(entry=>entry.id===repeatId)?.base;
  const repeat=repeatCheck&&base===repeatBase
    ?records.find(record=>record.status==='captured'&&record.id===repeatId)||(!repeatCase&&!only?records.find(record=>record.base===base&&record.status==='captured'):undefined)
    :undefined;
  const retries=records.filter(record=>record.base===base&&record.status==='failed'&&matchesSelection(record));
  return {selected,retries,repeat,needsPreview:Boolean(selected.length||repeat)};
}

export function captureEvidenceProblems(manifest) {
  const problems=[],seen=new Set(),canonical=new Map(cases({noWebGL:manifest.recipe?.noWebGL??false}).map(entry=>[entry.id,entry]));
  if(![1,2].includes(manifest.execution?.captureConcurrency))problems.push({scope:'manifest',reason:'Capture concurrency evidence is missing or invalid'});
  if(manifest.interrupted)problems.push({scope:'manifest',reason:'Capture interrupted',detail:manifest.interrupted});
  for(const [flag,start,end,label] of [['sourceUnchanged','productSourceSha256','productSourceSha256After','Product'],['protectedSourceUnchanged','protectedSourceSha256','protectedSourceSha256After','Protected']]) {
    if(manifest[flag]!==true||!manifest[start]||manifest[start]!==manifest[end])problems.push({scope:'manifest',reason:`${label} source completion evidence is missing, inconsistent or changed`,detail:{before:manifest[start],after:manifest[end],unchanged:manifest[flag]}});
  }
  for(const record of manifest.cases||[]) {
    const expected=canonical.get(record.id);
    if(!expected||record.base!==expected.base||record.route!==expected.route||record.theme!==expected.theme||record.viewport?.width!==expected.viewport.width||record.viewport?.height!==expected.viewport.height) {
      problems.push({scope:'case',id:record.id,reason:'Capture identity or metadata does not match the canonical matrix',detail:{base:record.base,route:record.route,theme:record.theme,viewport:record.viewport}});
    }
    if(seen.has(record.id))problems.push({scope:'case',id:record.id,reason:'Duplicate capture ID'});
    seen.add(record.id);
    if(record.status!=='captured')problems.push({scope:'case',id:record.id,reason:'Capture was not successful',detail:record.failure??record.status});
    if(!Array.isArray(record.errors)||record.errors.length)problems.push({scope:'case',id:record.id,reason:'Browser error evidence is missing or nonempty',detail:record.errors??null});
    if(record.naturalSettlementFailure)problems.push({scope:'case',id:record.id,reason:'Natural wrapper settlement failed',detail:record.naturalSettlementFailure});
  }
  if(manifest.repeatCheck) {
    const repeat=manifest.repeatCheck;
    const original=(manifest.cases||[]).find(record=>record.id===repeat.case);
    if(!original||repeat.capture?.id!==repeat.case||repeat.comparison?.beforeSha256!==original.png?.sha256||repeat.comparison?.afterSha256!==repeat.capture?.png?.sha256) {
      problems.push({scope:'repeat',id:repeat.case,reason:'Repeat provenance does not match the original and repeated PNG records'});
    }
    if(repeat.capture?.status!=='captured'||repeat.comparison?.pixelIdentical!==true)problems.push({scope:'repeat',id:repeat.case,reason:'Requested repeat did not capture identical pixels',detail:{status:repeat.capture?.status,failure:repeat.capture?.failure,comparison:repeat.comparison??null}});
    if(!Array.isArray(repeat.capture?.errors)||repeat.capture.errors.length)problems.push({scope:'repeat',id:repeat.case,reason:'Repeat browser error evidence is missing or nonempty',detail:repeat.capture?.errors??null});
    if(repeat.capture?.naturalSettlementFailure)problems.push({scope:'repeat',id:repeat.case,reason:'Repeat natural wrapper settlement failed',detail:repeat.capture.naturalSettlementFailure});
  }
  return problems;
}

export function assertCaptureCompatibility(first,second) {
  if(JSON.stringify(first.recipe)!==JSON.stringify(second.recipe)||first.fixedTime!==second.fixedTime)throw Error('Capture recipes differ.');
  if(first.execution?.captureConcurrency!==second.execution?.captureConcurrency)throw Error('Capture concurrency differs; preserve the old report and capture a fresh matrix.');
}

export function assertResumeSourceEvidence(manifest) {
  const problems=captureEvidenceProblems(manifest).filter(problem=>problem.scope==='manifest');
  if(problems.length)throw Error('Retained capture provenance is incomplete or invalid; preserve the old report and capture a fresh matrix. '+problems.map(problem=>problem.reason).join('; '));
}

export async function validateRepeatPixels(manifest,{readBytes=readFile}={}) {
  const repeat=manifest.repeatCheck;if(!repeat)return null;
  const original=manifest.cases.find(record=>record.id===repeat.case);
  try {
    if(!original?.screenshot||!repeat.capture?.screenshot)throw Error('Missing original or repeat PNG path');
    const [beforeBytes,afterBytes]=await Promise.all([readBytes(path.join(ROOT,original.screenshot)),readBytes(path.join(ROOT,repeat.capture.screenshot))]);
    const beforeSha256=hash(beforeBytes),afterSha256=hash(afterBytes);
    const {metrics}=comparePixels(PNG.sync.read(beforeBytes),PNG.sync.read(afterBytes));
    const originalHashMatches=beforeSha256===original.png?.sha256,repeatHashMatches=afterSha256===repeat.capture.png?.sha256;
    return {...metrics,beforeSha256,afterSha256,originalHashMatches,repeatHashMatches,pass:metrics.pixelIdentical&&originalHashMatches&&repeatHashMatches};
  } catch(error) {return {pass:false,failure:error.message};}
}

export function comparePixels(before,after) {
  const width=Math.max(before.width,after.width),height=Math.max(before.height,after.height);
  const diff=new PNG({width,height});
  let changedPixels=0,totalAbsoluteChannelDifference=0,maxChannelDifference=0;
  let minX=width,minY=height,maxX=-1,maxY=-1;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++) {
    const bi=(y*before.width+x)*4,ai=(y*after.width+x)*4,di=(y*width+x)*4;
    const beforeExists=x<before.width&&y<before.height,afterExists=x<after.width&&y<after.height;
    let changed=beforeExists!==afterExists;
    for(let channel=0;channel<4;channel++) {
      const difference=Math.abs((beforeExists?before.data[bi+channel]:0)-(afterExists?after.data[ai+channel]:0));
      totalAbsoluteChannelDifference+=difference;maxChannelDifference=Math.max(maxChannelDifference,difference);
      if(difference)changed=true;
    }
    if(changed) {changedPixels++;minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}
    diff.data[di]=changed?255:Math.round((afterExists?after.data[ai]:0)*.25);
    diff.data[di+1]=changed?0:Math.round((afterExists?after.data[ai+1]:0)*.25);
    diff.data[di+2]=changed?255:Math.round((afterExists?after.data[ai+2]:0)*.25);
    diff.data[di+3]=255;
  }
  return {metrics:{beforeDimensions:{width:before.width,height:before.height},afterDimensions:{width:after.width,height:after.height},
    equalDimensions:before.width===after.width&&before.height===after.height,changedPixels,totalPixels:width*height,
    changedPixelShare:changedPixels/(width*height),totalAbsoluteChannelDifference,maxChannelDifference,
    differenceBounds:changedPixels?{left:minX,top:minY,right:maxX,bottom:maxY}:null,pixelIdentical:changedPixels===0},diff};
}

async function until(page,fn,arg,label,timeout=15_000) {
  const end=Date.now()+timeout;
  while(Date.now()<end) {if(await page.evaluate(fn,arg))return;await wait(50);}
  throw Error(`Timed out waiting for ${label}`);
}

function initialize({theme,route,fixedTime,nativeClock}) {
  let seed=2166136261;
  for(const char of route)seed=Math.imul(seed^char.charCodeAt(0),16777619)>>>0;
  Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const NativeDate=Date,epoch=NativeDate.parse(fixedTime),offset=epoch-NativeDate.now();
  let frozen=false;
  const now=()=>frozen?epoch:NativeDate.now()+offset;
  // Advance wall time during GSAP entrance; freezing Date at document creation
  // would freeze GSAP's ticker. Native timers and animation frames stay intact.
  const DeterministicDate=new Proxy(NativeDate,{
    construct(target,args,newTarget){return Reflect.construct(target,args.length?args:[now()],newTarget);},
    apply(){return new NativeDate(now()).toString();},
    get(target,key,receiver){return key==='now'?now:Reflect.get(target,key,receiver);}
  });
  if(!nativeClock)window.Date=DeterministicDate;
  window.__perfVisualFreezeDate=()=>{frozen=true;window.Date=DeterministicDate;};
  document.addEventListener('route-changed',event=>{window.__perfVisualRouteCompleted=event.detail?.route;});
  // Fresh contexts give the same empty saved progress and section choices.
  localStorage.setItem('tmu-guide-theme-v1',theme);
  localStorage.setItem('guide-motion-paused','true');
}

async function fontEvidence(page) {
  const session=await page.context().newCDPSession(page);
  try {
    await session.send('DOM.enable');await session.send('CSS.enable');
    const {root}=await session.send('DOM.getDocument');
    const result=[];
    for(const [label,selector] of [['heading','h1'],['sidebar','.course-code'],['body','main .desk-lede,main .subline,main .workspace-panel:not([hidden]) p:not(.team):not(.eyebrow)']]) {
      const {nodeId}=await session.send('DOM.querySelector',{nodeId:root.nodeId,selector});
      if(!nodeId){result.push({label,selector,missing:true});continue;}
      const {fonts}=await session.send('CSS.getPlatformFontsForNode',{nodeId});
      result.push({label,selector,fonts});
    }
    return result;
  } finally {await session.detach();}
}

async function captureCase(browser,server,entry,directory) {
  const context=await browser.newContext({viewport:entry.viewport,deviceScaleFactor:1,colorScheme:entry.theme,
    timezoneId:'America/Toronto',locale:'en-CA',reducedMotion:'no-preference'});
  await context.addInitScript(initialize,{theme:entry.theme,route:entry.route,fixedTime:FIXED_TIME,nativeClock:entry.nativeClock});
  const page=await context.newPage();page.setDefaultTimeout(15_000);
  let layerSession,lastLayers;
  if(entry.diagnostic||entry.observeCompositor) {
    layerSession=await context.newCDPSession(page);
    layerSession.on('LayerTree.layerTreeDidChange',event=>{lastLayers=event.layers;});
    await layerSession.send('LayerTree.enable');
  }
  const errors=collectPageErrors(page),fontRequests=[];
  const normalizeURL=value=>value.replace(server.origin,'');
  page.on('response',response=>{const request=response.request();if(request.resourceType()==='font')fontRequests.push({url:normalizeURL(response.url()),status:response.status()});});
  const record={id:entry.id,base:entry.base,route:entry.route,viewport:entry.viewport,theme:entry.theme,noWebGL:entry.noWebGL,fullPage:entry.fullPage,nativeClock:entry.nativeClock,
    screenshot:relative(path.join(directory,entry.id+'.png'))};
  try {
    await page.goto(server.origin+entry.base+(entry.route==='desk'?'':entry.route+'/'),{waitUntil:'load'});
    await until(page,route=>(document.body.dataset.page==='desk'?'desk':document.body.dataset.course)===route&&window.TMURouter?.route===route&&window.__perfVisualRouteCompleted===route&&document.querySelector('main[data-route-region]')?.textContent.trim().length>20&&(route==='desk'?!!document.querySelector('[data-course-card="cen100"] [data-desk-next]:not([hidden])'):!!document.querySelector('.ns-count')),entry.route,'completed route and deadline content');
    await page.evaluate(()=>document.fonts.ready);
    await page.evaluate(async()=>{await Promise.all([...document.images].map(image=>image.complete?image.decode():new Promise((resolve,reject)=>{image.addEventListener('load',()=>image.decode().then(resolve,reject),{once:true});image.addEventListener('error',()=>reject(Error('Image failed: '+image.currentSrc)),{once:true});})));});
    if(entry.route!=='desk')await until(page,()=>{const art=document.querySelector('.header-art');return art?.dataset.sceneReady==='true'&&art.dataset.motionState==='still';},null,'initial static scene render',30_000);
    // Boot's optional motion layers mount after idle. Let that boundary run
    // before checking the wrapper, then require the documented settled state.
    await page.waitForTimeout(1600);
    const settled=()=>{const el=document.querySelector('main[data-route-region]');if(!el)return false;const s=getComputedStyle(el);return s.opacity==='1'&&s.filter==='none'&&(s.transform==='none'||new DOMMatrixReadOnly(s.transform).isIdentity);};
    record.naturalWrapper=await page.evaluate(()=>{const el=document.querySelector('main[data-route-region]'),s=getComputedStyle(el);return {opacity:s.opacity,filter:s.filter,transform:s.transform,style:el.getAttribute('style')};});
    try {await until(page,settled,null,'wrapper opacity 1, no filter and identity transform',2500);}
    catch(error) {
      record.naturalSettlementFailure=error.message;
      record.unsettledWrapper=await page.evaluate(()=>{const el=document.querySelector('main[data-route-region]'),s=getComputedStyle(el);return {opacity:s.opacity,filter:s.filter,transform:s.transform,style:el.getAttribute('style')};});
    }
    // Use the product's own pause completion hooks before the final settlement
    // gate, preserving any natural-settlement defect above in the evidence.
    await page.evaluate(()=>{window.GuideMotion.setPaused(true);window.GuideMotion.setScenePaused(true);});
    await until(page,settled,null,'wrapper still settled after pause',2500);
    await page.waitForTimeout(entry.settledDelayMs??1500);
    await page.evaluate(()=>{window.__perfVisualFreezeDate();document.dispatchEvent(new Event('workspace-changed'));document.dispatchEvent(new Event('visibilitychange'));});
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    await page.evaluate(()=>document.fonts.ready);
    await page.evaluate(()=>Promise.all([...document.images].map(image=>image.decode())));
    const sceneSnapshot=()=>page.evaluate(()=>[...document.querySelectorAll('[data-renderer]')].map(el=>{const r=el.getBoundingClientRect();return {renderer:el.dataset.renderer,ready:el.dataset.sceneReady,frame:el.dataset.sceneFrame,motionState:el.dataset.motionState,sceneTime:el.dataset.sceneTime,x:r.x,y:r.y,width:r.width,height:r.height};}));
    let firstScene=await sceneSnapshot(),stable=false;
    for(let attempts=0;attempts<20;attempts++) {
      await wait(100);const secondScene=await sceneSnapshot();
      if(JSON.stringify(firstScene)===JSON.stringify(secondScene)){stable=true;record.sceneStability={intervalMs:100,before:firstScene,after:secondScene};break;}
      firstScene=secondScene;
    }
    if(!stable)throw Error('Paused scene dimensions/frame did not stabilize');
    record.platformFonts=await fontEvidence(page);
    record.dom=await page.evaluate(()=>{
      const box=el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};};
      const wrapper=document.querySelector('main[data-route-region]'),style=getComputedStyle(wrapper);
      return {title:document.title,heading:document.querySelector('h1')?.innerText,route:window.TMURouter?.route,
        now:new Date().toISOString(),theme:document.documentElement.dataset.theme,document:{width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight},
        wrapper:{...box(wrapper),opacity:style.opacity,filter:style.filter,transform:style.transform},motion:window.GuideMotion.preference(),
        images:[...document.images].map(image=>({src:new URL(image.currentSrc||image.src,location.href).pathname,naturalWidth:image.naturalWidth,naturalHeight:image.naturalHeight,complete:image.complete,loading:image.loading,decoding:image.decoding,...box(image),aboveFold:image.getBoundingClientRect().top<innerHeight})),
        renderers:[...document.querySelectorAll('[data-renderer]')].map(el=>({renderer:el.dataset.renderer,sceneReady:el.dataset.sceneReady,motionState:el.dataset.motionState,sceneTime:el.dataset.sceneTime,sceneFrame:el.dataset.sceneFrame,...box(el)})),
        fonts:[...document.fonts].map(font=>({family:font.family,weight:font.weight,status:font.status})),
        stylesheets:[...document.styleSheets].map(sheet=>sheet.href&&new URL(sheet.href).pathname)};
    });
    if(entry.nativeLayerRedraw) {
      record.nativeLayerRedraw={before:await sceneSnapshot()};
      await requestNativeLayerRedraw(page);
      record.nativeLayerRedraw.after=await sceneSnapshot();
      if(JSON.stringify(record.nativeLayerRedraw.before)!==JSON.stringify(record.nativeLayerRedraw.after))throw Error('Native layer invalidation changed the paused scene dimensions or state.');
    }
    // A final native resume event asks the paused renderer for its real static
    // frame immediately before capture. No content or style is replaced.
    await page.evaluate(()=>{document.dispatchEvent(new Event('visibilitychange'));return new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});
    record.preCaptureScene=await sceneSnapshot();
    record.dom.renderersAtCapture=record.preCaptureScene;
    if(entry.observeCompositor)record.compositorLayers=lastLayers;
    if(entry.diagnostic) {
      record.captureStyles=await page.evaluate(()=>{
        const nodes=new Set();
        for(const selector of ['.ns-hud-k','.scene-meta i','.scene-pause','.header-art'])for(let node=document.querySelector(selector);node;node=node.parentElement)nodes.add(node);
        const props=['opacity','filter','transform','translate','rotate','scale','perspective','backface-visibility','will-change','isolation','contain','overflow','background-image','background-color','border-color','border-width','border-radius','box-shadow','animation-name','animation-duration','animation-play-state','transition-property','transition-duration'];
        return [...nodes].map(node=>{const s=getComputedStyle(node),r=node.getBoundingClientRect();return {tag:node.tagName,id:node.id,class:node.className,box:{x:r.x,y:r.y,width:r.width,height:r.height},computed:Object.fromEntries(props.map(prop=>[prop,s.getPropertyValue(prop)]))};});
      });
      record.compositorLayers=lastLayers;
    }
    const bytes=await page.screenshot({path:path.join(directory,entry.id+'.png'),fullPage:entry.fullPage??false,animations:'disabled'});
    const png=PNG.sync.read(bytes);
    record.png={width:png.width,height:png.height,bytes:bytes.length,sha256:hash(bytes),pixelSha256:hash(png.data)};
    if(entry.diagnostic) {
      record.consecutive=[];let previous=png;
      for(let sample=1;sample<=2;sample++) {
        await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
        const screenshot=path.join(directory,entry.id+`-consecutive-${sample}.png`),nextBytes=await page.screenshot({path:screenshot,fullPage:entry.fullPage??false,animations:'disabled'}),next=PNG.sync.read(nextBytes);
        const {metrics}=comparePixels(previous,next);record.consecutive.push({sample,screenshot:relative(screenshot),sha256:hash(nextBytes),...metrics});previous=next;
      }
    }
    record.status='captured';
  } catch(error) {
    record.status='failed';record.failure={message:error.message,stack:error.stack};
    try {record.failureState=await page.evaluate(()=>({hidden:document.hidden,visibilityState:document.visibilityState,motion:window.GuideMotion?.preference(),renderers:[...document.querySelectorAll('.header-art')].map(el=>({...el.dataset}))}));}catch{}
  }
  finally {
    record.fontRequests=fontRequests;
    record.errors=errors.events.map(event=>({...event,url:normalizeURL(event.url),...(event.requestUrl?{requestUrl:normalizeURL(event.requestUrl)}:{})}));
    errors.detach();await context.close();
  }
  return record;
}

async function compareFiles(beforePath,afterPath,diffPath) {
  const [beforeBytes,afterBytes]=await Promise.all([readFile(beforePath),readFile(afterPath)]);
  const {metrics,diff}=comparePixels(PNG.sync.read(beforeBytes),PNG.sync.read(afterBytes));
  await writeFile(diffPath,PNG.sync.write(diff));
  return {...metrics,beforeSha256:hash(beforeBytes),afterSha256:hash(afterBytes),diff:relative(diffPath)};
}

export async function capture(label,{only,historyCases=[],noWebGL=false,repeatCheck=false,repeatCase,resume=false,fullPage=false,nativeClock=false,serial=false,compositorDrain=false,disablePartialRaster=false,disableGpuRasterization=false,settledDelayMs=1500,observeCompositor=false,nativeLayerRedraw=false,diagnostic=false}={}) {
  if(!['before','after'].includes(label))throw Error('Capture label must be before or after.');
  const directory=path.join(REPORTS,label+(nativeClock?'-native-clock':''));await mkdir(directory,{recursive:true});
  const legacyScreenshot=Boolean(process.env.PLAYWRIGHT_LEGACY_SCREENSHOT);
  const {playwright,modulePath}=resolvePlaywright(),launch=resolveLaunchOptions(playwright,{gpu:false});
  if(noWebGL)launch.options.args.push('--disable-webgl');
  if(compositorDrain)launch.options.args.push('--run-all-compositor-stages-before-draw');
  if(disablePartialRaster)launch.options.args.push('--disable-partial-raster');
  if(disableGpuRasterization)launch.options.args.push('--disable-gpu-rasterization');
  if(nativeLayerRedraw)launch.options.args.push('--enable-gpu-benchmarking');
  const browser=await playwright.chromium.launch(launch.options);
  let interrupted=null;
  const interrupt=signal=>{interrupted=signal;process.exitCode=signal==='SIGINT'?130:143;void browser.close();};
  const sigint=()=>interrupt('SIGINT'),sigterm=()=>interrupt('SIGTERM');
  process.once('SIGINT',sigint);process.once('SIGTERM',sigterm);
  let manifest;
  try {
  const browserSession=await browser.newBrowserCDPSession();
  let chromiumCommandLine;
  try {({arguments:chromiumCommandLine}=await browserSession.send('Browser.getBrowserCommandLine'));}finally{await browserSession.detach();}
  manifest={schemaVersion:1,label,capturedAt:new Date().toISOString(),fixedTime:FIXED_TIME,revision:execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim(),productSourceSha256:await productSourceFingerprint(),protectedSourceSha256:await productSourceFingerprint({protectedOnly:true}),
    recipe:visualCaptureRecipe({fullPage,nativeClock,noWebGL,compositorDrain,disablePartialRaster,disableGpuRasterization,settledDelayMs,observeCompositor,legacyScreenshot,nativeLayerRedraw}),
    execution:{captureConcurrency:serial?1:2,diagnostic,...(historyCases.length?{probeHistoryCases:historyCases}:{})},
    environment:{playwrightPath:modulePath,executablePath:launch.options.executablePath,args:launch.options.args,playwrightLegacyScreenshot:legacyScreenshot,chromiumCommandLine,...await inspectBrowserEnvironment(browser,{gpu:false})},cases:[]};
  if(resume) {
    const previous=JSON.parse(await readFile(path.join(directory,'manifest.json'),'utf8'));
    assertResumeSourceEvidence(previous);
    assertCaptureCompatibility(previous,manifest);
    if(previous.revision!==manifest.revision)throw Error('Resume source revision differs from retained captures; capture a fresh matrix.');
    if(previous.productSourceSha256!==manifest.productSourceSha256)throw Error('Resume product content differs from retained captures; capture a fresh matrix.');
    manifest.cases=previous.cases;manifest.capturedAt=previous.capturedAt;manifest.resumedAt=new Date().toISOString();
    if(previous.repeatCheck)manifest.repeatCheck=previous.repeatCheck;
  }
    for(const base of BASES) {
      const options={only,historyCases,noWebGL,resume,repeatCheck,repeatCase,fullPage,nativeClock};
      const work=captureWork(base,options,manifest.cases),selected=work.selected.map(entry=>({...entry,diagnostic,observeCompositor,settledDelayMs,nativeLayerRedraw})),needsPreview=work.needsPreview;
      if(!needsPreview)continue;
      const server=await startPreview({base});
      try {
        const concurrency=serial?1:2;
        for(let index=0;index<selected.length;index+=concurrency) {
          const batch=await Promise.all(selected.slice(index,index+concurrency).map(entry=>captureCase(browser,server,entry,directory)));
          for(const record of batch) {
            const index=manifest.cases.findIndex(previous=>previous.id===record.id);
            if(index<0)manifest.cases.push(record);
            else {record.initialAttempt={failure:manifest.cases[index].failure,errors:manifest.cases[index].errors};manifest.cases[index]=record;}
          }
          for(const record of batch)console.log(`${label}: ${record.id}: ${record.status}${record.failure?' '+record.failure.message:''}`);
          await writeFile(path.join(directory,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
        }
        for(const failed of captureWork(base,options,manifest.cases).retries) {
          const retried=await captureCase(browser,server,{...failed,diagnostic,observeCompositor,settledDelayMs,nativeLayerRedraw},directory);
          retried.initialAttempt={failure:failed.failure,errors:failed.errors};
          manifest.cases[manifest.cases.indexOf(failed)]=retried;
          console.log(`retry: ${retried.id}: ${retried.status}${retried.failure?' '+retried.failure.message:''}`);
          await writeFile(path.join(directory,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
        }
        if(repeatCheck) {
          const first=captureWork(base,options,manifest.cases).repeat;
          if(first) {
            const repeatDir=path.join(directory,'repeat');await mkdir(repeatDir,{recursive:true});
            const repeated=await captureCase(browser,server,{...first,diagnostic,observeCompositor,settledDelayMs,nativeLayerRedraw},repeatDir);
            manifest.repeatCheck={case:first.id,capture:repeated};
            if(repeated.status==='captured')manifest.repeatCheck.comparison=await compareFiles(path.join(ROOT,first.screenshot),path.join(ROOT,repeated.screenshot),path.join(repeatDir,first.id+'-diff.png'));
            console.log(`repeat: ${first.id}: ${JSON.stringify(manifest.repeatCheck.comparison||repeated.failure)}`);
          }
        }
      } finally {await server.stop();}
    }
  } finally {
    process.off('SIGINT',sigint);process.off('SIGTERM',sigterm);
    await browser.close();
    if(interrupted&&manifest) {
      manifest.interrupted={signal:interrupted,at:new Date().toISOString()};
      await writeFile(path.join(directory,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
    }
  }
  manifest.productSourceSha256After=await productSourceFingerprint();
  manifest.sourceUnchanged=manifest.productSourceSha256===manifest.productSourceSha256After;
  manifest.protectedSourceSha256After=await productSourceFingerprint({protectedOnly:true});
  manifest.protectedSourceUnchanged=manifest.protectedSourceSha256===manifest.protectedSourceSha256After;
  manifest.summary={requested:only?1+historyCases.length:32,captured:manifest.cases.filter(record=>record.status==='captured').length,failed:manifest.cases.filter(record=>record.status==='failed').length,
    initialAttemptFailures:manifest.cases.filter(record=>record.initialAttempt?.failure).length,
    naturalSettlementFailures:manifest.cases.filter(record=>record.naturalSettlementFailure).length,errors:manifest.cases.reduce((sum,record)=>sum+record.errors.length,0),
    ...(manifest.repeatCheck?{repeatPixelIdentical:manifest.repeatCheck.comparison?.pixelIdentical===true}:{})};
  await writeFile(path.join(directory,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  return manifest;
}

export async function compare() {
  const [before,after]=await Promise.all(['before','after'].map(async label=>JSON.parse(await readFile(path.join(REPORTS,label,'manifest.json'),'utf8'))));
  const directory=path.join(REPORTS,'compare');await mkdir(directory,{recursive:true});
  const result={schemaVersion:1,comparedAt:new Date().toISOString(),beforeCapturedAt:before.capturedAt,afterCapturedAt:after.capturedAt,
    beforeProductSourceSha256:before.productSourceSha256,afterProductSourceSha256:after.productSourceSha256,
    beforeProtectedSourceSha256:before.protectedSourceSha256,afterProtectedSourceSha256:after.protectedSourceSha256,
    beforeRepeat:before.repeatCheck?.comparison??null,afterRepeat:after.repeatCheck?.comparison??null,
    beforeEvidenceProblems:captureEvidenceProblems(before),afterEvidenceProblems:captureEvidenceProblems(after),
    beforeRepeatValidation:await validateRepeatPixels(before),afterRepeatValidation:await validateRepeatPixels(after),cases:[]};
  assertCaptureCompatibility(before,after);
  const ids=new Set([...before.cases,...after.cases].map(entry=>entry.id));
  for(const id of ids) {
    const first=before.cases.find(entry=>entry.id===id),second=after.cases.find(entry=>entry.id===id);
    if(first?.status!=='captured'||second?.status!=='captured') {result.cases.push({id,status:'failed',failure:'Missing successful before/after capture'});continue;}
    const pixels=await compareFiles(path.join(ROOT,first.screenshot),path.join(ROOT,second.screenshot),path.join(directory,id+'-diff.png'));
    if(pixels.beforeSha256!==first.png?.sha256||pixels.afterSha256!==second.png?.sha256) {
      result.cases.push({id,status:'failed',failure:'PNG hash does not match its capture manifest',...pixels});continue;
    }
    result.cases.push({id,status:'compared',...pixels,beforeErrors:first.errors,afterErrors:second.errors,
      beforeNaturalSettlementFailure:first.naturalSettlementFailure??null,afterNaturalSettlementFailure:second.naturalSettlementFailure??null});
    console.log(`${id}: ${pixels.changedPixels}/${pixels.totalPixels} changed pixels${pixels.differenceBounds?' '+JSON.stringify(pixels.differenceBounds):''}`);
  }
  result.summary={expected:32,compared:result.cases.filter(entry=>entry.status==='compared').length,pixelIdentical:result.cases.filter(entry=>entry.status==='compared'&&entry.pixelIdentical).length,
    different:result.cases.filter(entry=>entry.status==='compared'&&!entry.pixelIdentical).length,failed:result.cases.filter(entry=>entry.status==='failed').length,
    changedPixels:result.cases.reduce((sum,entry)=>sum+(entry.changedPixels||0),0),
    browserErrors:result.cases.reduce((sum,entry)=>sum+(entry.beforeErrors?.length||0)+(entry.afterErrors?.length||0),0),
    naturalSettlementFailures:result.cases.filter(entry=>entry.beforeNaturalSettlementFailure||entry.afterNaturalSettlementFailure).length,
    repeatFailures:[result.beforeRepeatValidation,result.afterRepeatValidation].filter(validation=>validation&&!validation.pass).length,
    evidenceFailures:result.beforeEvidenceProblems.length+result.afterEvidenceProblems.length,
    protectedSourceMatches:Boolean(before.protectedSourceSha256&&before.protectedSourceSha256===after.protectedSourceSha256)};
  await writeFile(path.join(directory,'comparison.json'),JSON.stringify(result,null,2)+'\n');
  return result;
}

export function parseCaptureOptions(options) {
  const parsed={};
  for(let i=0;i<options.length;i++) {if(options[i]==='--repeat-check')parsed.repeatCheck=true;else if(options[i]==='--no-webgl')parsed.noWebGL=true;else if(options[i]==='--resume')parsed.resume=true;else if(options[i]==='--full-page')parsed.fullPage=true;else if(options[i]==='--native-clock')parsed.nativeClock=true;else if(options[i]==='--serial')parsed.serial=true;else if(options[i]==='--compositor-drain')parsed.compositorDrain=true;else if(options[i]==='--disable-partial-raster')parsed.disablePartialRaster=true;else if(options[i]==='--disable-gpu-rasterization')parsed.disableGpuRasterization=true;else if(options[i]==='--probe-history'){const value=options[++i];if(!value||value.startsWith('-'))throw Error('--probe-history requires a case ID.');(parsed.historyCases??=[]).push(value);}else if(options[i]==='--native-layer-redraw')parsed.nativeLayerRedraw=true;else if(options[i]==='--observe-compositor')parsed.observeCompositor=true;else if(options[i]==='--settled-delay-ms'){const value=options[++i];if(!value||!/^\d+$/.test(value)||Number(value)<1500)throw Error('--settled-delay-ms requires an integer of at least1500.');parsed.settledDelayMs=Number(value);}else if(options[i]==='--diagnostic')parsed.diagnostic=true;else if(options[i]==='--only'||options[i]==='--repeat-case'){const option=options[i],value=options[++i];if(!value||value.startsWith('-'))throw Error(option+' requires a case ID.');parsed[option==='--only'?'only':'repeatCase']=value;}else throw Error('Unknown option: '+options[i]);}
  if(parsed.only&&!cases(parsed).some(entry=>entry.id===parsed.only))throw Error('Unknown case: '+parsed.only);
  if(parsed.repeatCase&&!cases(parsed).some(entry=>entry.id===parsed.repeatCase))throw Error('Unknown repeat case: '+parsed.repeatCase);
  if(parsed.only&&parsed.repeatCase&&parsed.only!==parsed.repeatCase)throw Error('--only and --repeat-case must select the same case.');
  if(parsed.historyCases) {
    const matrix=cases(parsed),selected=matrix.find(entry=>entry.id===parsed.only);
    if(!selected||new Set(parsed.historyCases).size!==parsed.historyCases.length||parsed.historyCases.some(id=>id===parsed.only||matrix.find(entry=>entry.id===id)?.base!==selected.base))throw Error('--probe-history requires --only and unique cases on the same deployment base.');
    parsed.repeatCheck=true;
  }
  if(parsed.repeatCase)parsed.repeatCheck=true;
  return parsed;
}

async function main(argv) {
  const [command,label,...options]=argv;
  if(command==='compare') {const result=await compare();console.log(JSON.stringify(result.summary));process.exitCode=!result.summary.protectedSourceMatches||result.summary.different||result.summary.failed||result.summary.browserErrors||result.summary.naturalSettlementFailures||result.summary.repeatFailures||result.summary.evidenceFailures||result.summary.compared!==result.summary.expected?1:0;return;}
  if(command!=='capture'||!['before','after'].includes(label))throw Error('Usage: node tools/qa/compare-perf-visuals.mjs capture before|after [--repeat-check] [--no-webgl] [--only CASE_ID]; or compare');
  const parsed=parseCaptureOptions(options);
  const result=await capture(label,parsed);console.log(JSON.stringify(result.summary));process.exitCode=!result.sourceUnchanged||result.summary.failed||result.summary.errors||result.summary.naturalSettlementFailures||result.summary.repeatPixelIdentical===false?1:0;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main(process.argv.slice(2)).catch(error=>{console.error(error.stack||error);if(!process.exitCode)process.exitCode=2;});
