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

async function productSourceFingerprint() {
  const files=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z','--','assets','*.html','cen100','mth140','mth141'],{cwd:ROOT,encoding:'utf8'}).split('\0').filter(Boolean);
  const digest=createHash('sha256');
  for(const file of [...new Set(files)].sort()) {
    digest.update(file+'\0');
    try {digest.update(await readFile(path.join(ROOT,file)));}catch(error){if(error.code==='ENOENT')digest.update('missing');else throw error;}
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
    await page.waitForTimeout(1500);
    await page.evaluate(()=>{window.__perfVisualFreezeDate();document.dispatchEvent(new Event('workspace-changed'));document.dispatchEvent(new Event('visibilitychange'));});
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    await page.evaluate(()=>document.fonts.ready);
    await page.evaluate(()=>Promise.all([...document.images].map(image=>image.decode())));
    const sceneSnapshot=()=>page.evaluate(()=>[...document.querySelectorAll('[data-renderer]')].map(el=>{const r=el.getBoundingClientRect();return {renderer:el.dataset.renderer,ready:el.dataset.sceneReady,frame:el.dataset.sceneFrame,x:r.x,y:r.y,width:r.width,height:r.height};}));
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
    // A final native resume event asks the paused renderer for its real static
    // frame immediately before capture. No content or style is replaced.
    await page.evaluate(()=>{document.dispatchEvent(new Event('visibilitychange'));return new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});
    record.preCaptureScene=await sceneSnapshot();
    const bytes=await page.screenshot({path:path.join(directory,entry.id+'.png'),fullPage:entry.fullPage??false,animations:'disabled'});
    const png=PNG.sync.read(bytes);
    record.png={width:png.width,height:png.height,bytes:bytes.length,sha256:hash(bytes),pixelSha256:hash(png.data)};
    record.status='captured';
  } catch(error) {record.status='failed';record.failure={message:error.message,stack:error.stack};}
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

export async function capture(label,{only,noWebGL=false,repeatCheck=false,resume=false,fullPage=false,nativeClock=false}={}) {
  if(!['before','after'].includes(label))throw Error('Capture label must be before or after.');
  const directory=path.join(REPORTS,label+(nativeClock?'-native-clock':''));await mkdir(directory,{recursive:true});
  const {playwright,modulePath}=resolvePlaywright(),launch=resolveLaunchOptions(playwright,{gpu:false});
  if(noWebGL)launch.options.args.push('--disable-webgl');
  const browser=await playwright.chromium.launch(launch.options);
  let interrupted=null;
  const interrupt=signal=>{interrupted=signal;process.exitCode=signal==='SIGINT'?130:143;void browser.close();};
  const sigint=()=>interrupt('SIGINT'),sigterm=()=>interrupt('SIGTERM');
  process.once('SIGINT',sigint);process.once('SIGTERM',sigterm);
  let manifest;
  try {
  manifest={schemaVersion:1,label,capturedAt:new Date().toISOString(),fixedTime:FIXED_TIME,revision:execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim(),productSourceSha256:await productSourceFingerprint(),
    recipe:{fullPage,deviceScaleFactor:1,timezone:'America/Toronto',locale:'en-CA',initialSavedScenePause:true,entryAnimations:'normal',settledDelayMs:1500,
      random:'FNV-1a route seed with a 32-bit LCG; seeded before product scripts',initialClock:nativeClock?'native Date (diagnostic)':'moving Date offset',
      freeze:'freeze after settlement, pause through GuideMotion and dispatch workspace-changed/visibilitychange; final visibilitychange redraw immediately before capture',
      sceneReadyGate:true,sceneFrameAndBoundsStableMs:100,screenshotAnimations:'disabled',masking:false,cssInjection:false,noWebGL},
    environment:{playwrightPath:modulePath,executablePath:launch.options.executablePath,args:launch.options.args,...await inspectBrowserEnvironment(browser,{gpu:false})},cases:[]};
  if(resume) {
    const previous=JSON.parse(await readFile(path.join(directory,'manifest.json'),'utf8'));
    if(JSON.stringify(previous.recipe)!==JSON.stringify(manifest.recipe)||previous.fixedTime!==manifest.fixedTime) {
      throw Error('Resume recipe differs from retained captures; preserve the old report and capture a fresh matrix.');
    }
    if(previous.revision!==manifest.revision)throw Error('Resume source revision differs from retained captures; capture a fresh matrix.');
    if(previous.productSourceSha256!==manifest.productSourceSha256)throw Error('Resume product content differs from retained captures; capture a fresh matrix.');
    manifest.cases=previous.cases;manifest.capturedAt=previous.capturedAt;manifest.resumedAt=new Date().toISOString();
    if(previous.repeatCheck)manifest.repeatCheck=previous.repeatCheck;
  }
    for(const base of BASES) {
      const selected=cases({noWebGL}).filter(entry=>entry.base===base&&(!only||entry.id===only)&&(!resume||!manifest.cases.some(record=>record.id===entry.id&&record.status==='captured'))).map(entry=>({...entry,fullPage,nativeClock}));
      const repeatBase=only?cases({noWebGL}).find(entry=>entry.id===only)?.base:'/';
      if(!selected.length&&!(repeatCheck&&base===repeatBase&&manifest.cases.some(record=>record.base===base&&record.status==='captured')))continue;
      const server=await startPreview({base});
      try {
        for(let index=0;index<selected.length;index+=2) {
          const batch=await Promise.all(selected.slice(index,index+2).map(entry=>captureCase(browser,server,entry,directory)));
          for(const record of batch) {
            const index=manifest.cases.findIndex(previous=>previous.id===record.id);
            if(index<0)manifest.cases.push(record);
            else {record.initialAttempt={failure:manifest.cases[index].failure,errors:manifest.cases[index].errors};manifest.cases[index]=record;}
          }
          for(const record of batch)console.log(`${label}: ${record.id}: ${record.status}${record.failure?' '+record.failure.message:''}`);
          await writeFile(path.join(directory,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
        }
        for(const failed of manifest.cases.filter(record=>record.base===base&&record.status==='failed'&&(!only||record.id===only))) {
          const retried=await captureCase(browser,server,failed,directory);
          retried.initialAttempt={failure:failed.failure,errors:failed.errors};
          manifest.cases[manifest.cases.indexOf(failed)]=retried;
          console.log(`retry: ${retried.id}: ${retried.status}${retried.failure?' '+retried.failure.message:''}`);
          await writeFile(path.join(directory,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
        }
        if(repeatCheck&&base===repeatBase) {
          const first=manifest.cases.find(record=>record.status==='captured'&&record.id===(only||`root-mth140-1440x900-dark${noWebGL?'-no-webgl':''}`))||manifest.cases.find(record=>record.base===base&&record.status==='captured');
          if(first) {
            const repeatDir=path.join(directory,'repeat');await mkdir(repeatDir,{recursive:true});
            const repeated=await captureCase(browser,server,first,repeatDir);
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
  manifest.summary={requested:only?1:32,captured:manifest.cases.filter(record=>record.status==='captured').length,failed:manifest.cases.filter(record=>record.status==='failed').length,
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
    beforeRepeat:before.repeatCheck?.comparison??null,afterRepeat:after.repeatCheck?.comparison??null,cases:[]};
  if(JSON.stringify(before.recipe)!==JSON.stringify(after.recipe)||before.fixedTime!==after.fixedTime)throw Error('Before and after capture recipes differ.');
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
    repeatFailures:[before,after].filter(manifest=>manifest.repeatCheck&&manifest.repeatCheck.comparison?.pixelIdentical!==true).length};
  await writeFile(path.join(directory,'comparison.json'),JSON.stringify(result,null,2)+'\n');
  return result;
}

export function parseCaptureOptions(options) {
  const parsed={};
  for(let i=0;i<options.length;i++) {if(options[i]==='--repeat-check')parsed.repeatCheck=true;else if(options[i]==='--no-webgl')parsed.noWebGL=true;else if(options[i]==='--resume')parsed.resume=true;else if(options[i]==='--full-page')parsed.fullPage=true;else if(options[i]==='--native-clock')parsed.nativeClock=true;else if(options[i]==='--only'){parsed.only=options[++i];if(!parsed.only||parsed.only.startsWith('-'))throw Error('--only requires a case ID.');}else throw Error('Unknown option: '+options[i]);}
  if(parsed.only&&!cases(parsed).some(entry=>entry.id===parsed.only))throw Error('Unknown case: '+parsed.only);
  return parsed;
}

async function main(argv) {
  const [command,label,...options]=argv;
  if(command==='compare') {const result=await compare();console.log(JSON.stringify(result.summary));process.exitCode=result.summary.different||result.summary.failed||result.summary.browserErrors||result.summary.repeatFailures||result.summary.compared!==result.summary.expected?1:0;return;}
  if(command!=='capture'||!['before','after'].includes(label))throw Error('Usage: node tools/qa/compare-perf-visuals.mjs capture before|after [--repeat-check] [--no-webgl] [--only CASE_ID]; or compare');
  const parsed=parseCaptureOptions(options);
  const result=await capture(label,parsed);console.log(JSON.stringify(result.summary));process.exitCode=result.summary.failed||result.summary.errors||result.summary.repeatPixelIdentical===false?1:0;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main(process.argv.slice(2)).catch(error=>{console.error(error.stack||error);if(!process.exitCode)process.exitCode=2;});
