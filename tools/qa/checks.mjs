import {SCHEDULE} from '../../assets/cen-schedule.mjs';
import {COURSES} from '../../assets/course-data.mjs';

export const ROUTES = ['desk', 'cen100', 'mth140', 'mth141'];
const TITLES = {desk:'TMU Course Guides | Fall 2026',cen100:'CEN100 | TMU Course Guides',mth140:'MTH140: Calculus I | TMU Course Guides',mth141:'MTH141: Linear Algebra | TMU Course Guides'};
const routeURL = (env, route, query='') => env.origin + env.base + (route === 'desk' ? '' : route + '/') + query;
const equal = (a,b) => JSON.stringify(a) === JSON.stringify(b);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const result = () => ({assertions:[], observations:{cases:[]}, skipped:[]});
function assert(out, name, pass, actual, expected, detail) {
  out.assertions.push({name,pass:!!pass,...(actual===undefined?{}:{actual}),...(expected===undefined?{}:{expected}),...(detail?{detail}:{})});
}

function telemetry(page) {
  const errors = {consoleErrors:[],pageErrors:[],failedRequests:[],httpErrors:[]};
  page.on('console', message => {if(message.type()==='error') errors.consoleErrors.push(message.text());});
  page.on('pageerror', error => errors.pageErrors.push(error.message));
  page.on('requestfailed', request => errors.failedRequests.push({url:request.url(),error:request.failure()?.errorText}));
  page.on('response', response => {if(response.status()>=400) errors.httpErrors.push({url:response.url(),status:response.status()});});
  return errors;
}

async function runCase(env, out, name, fn, {storage={},contextOptions={},browser=env.browser,clock,linearClock}={}) {
  let context;
  const observation = {name};
  out.observations.cases.push(observation);
  try {
    context = await browser.newContext({viewport:{width:1440,height:900},...contextOptions});
    await context.addInitScript(env.instrument);
    if(linearClock) await context.addInitScript(iso=>{
      // A moving wall-clock offset leaves native rAF/timers intact for lifecycle
      // measurement. Date-only freezing stops GSAP; clock.install replaces rAF.
      const NativeDate=Date,offset=NativeDate.parse(iso)-NativeDate.now();
      window.Date=new Proxy(NativeDate,{
        construct(target,args,newTarget){return Reflect.construct(target,args.length?args:[target.now()+offset],newTarget);},
        apply(target){return new target(target.now()+offset).toString();},
        get(target,key,receiver){return key==='now'?()=>target.now()+offset:Reflect.get(target,key,receiver);}
      });
    },linearClock);
    await context.addInitScript(()=>{document.addEventListener('route-changed',event=>{window.__qaRouteCompleted=event.detail?.route;});});
    await context.addInitScript(seed => {try{for(const [key,value] of Object.entries(seed)) localStorage.setItem(key, typeof value==='string'?value:JSON.stringify(value));}catch{}}, storage);
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    const errors = telemetry(page);
    observation.telemetry = errors;
    if(clock) await page.clock.install({time:new Date(clock)});
    await fn(page, observation);
  } catch(error) {
    assert(out, `${name}: execution`, false, error.stack || String(error), 'case completes');
  } finally {
    if(observation.telemetry) for(const [type,items] of Object.entries(observation.telemetry)) assert(out,`${name}: ${type}`,items.length===0,items,[]);
    await context?.close();
  }
}

async function until(fn,label,timeout=10000) {
  const end=Date.now()+timeout;
  while(Date.now()<end) {if(await fn()) return;await sleep(50);}
  throw new Error(`Timed out waiting for ${label}`);
}

async function ready(page, route) {
  // Poll from Node so browser-installed fake clocks cannot freeze QA's own
  // selector readiness timers. This does not bypass product readiness.
  await until(()=>page.evaluate(route => Boolean((document.body.dataset.page==='desk'?'desk':document.body.dataset.course) === route && window.TMURouter?.route===route && window.__qaRouteCompleted===route && document.querySelector('main[data-route-region]')?.textContent.trim().length > 20 && (route==='desk'?document.querySelector('[data-course-card="cen100"] [data-desk-next]:not([hidden])'):document.querySelector('.ns-count'))),route),`${route} completed navigation, content and deadline`);
  await page.evaluate(() => document.fonts.ready);
}

async function activateClocked(page,selector) {
  // Native button activation tests deadline semantics with a simulated clock.
  // Pointer hit testing and tab navigation are tested with real timers elsewhere.
  await page.locator(selector).first().evaluate(el=>{if(el.disabled||!el.getClientRects().length)throw Error('Deadline action unavailable');el.click();});
}

async function settle(page,out) {
  // Optional effects have an idle-load boundary. Wait for their first initialization,
  // then require the content wrapper itself to settle; a permanent transform fails.
  await page.waitForTimeout(1600);
  try {
    await until(()=>page.evaluate(() => {
      const el=document.querySelector('main[data-route-region]');
      const s=getComputedStyle(el);
      return s.opacity==='1' && s.filter==='none' && (s.transform==='none'||new DOMMatrixReadOnly(s.transform).isIdentity);
    }),'route wrapper settlement',2000);
  } catch(error) {
    const state=await page.evaluate(()=>{const el=document.querySelector('main[data-route-region]'),s=getComputedStyle(el);return {route:document.body.dataset.course||'desk',opacity:s.opacity,filter:s.filter,transform:s.transform,style:el.getAttribute('style')};});
    if(out) assert(out,`${state.route}: route wrapper settles`,false,state,'opacity 1; no filter; identity transform',error.message);
    else throw new Error(`Route wrapper did not settle after initial effects loaded: ${JSON.stringify(state)}`,{cause:error});
  }
}

async function navigate(page, route) {
  await page.locator(`[data-course-link="${route}"]`).click();
  await ready(page,route);
}

async function routeSnapshot(page) {
  return page.evaluate(() => {
    const main=document.querySelector('main[data-route-region]'), active=document.activeElement;
    const skip=document.querySelector('body>.skip-link');
    const skipId=skip?new URL(skip.href).hash.slice(1):null;
    return {url:location.href,shell:document.documentElement.dataset.shellId,title:document.title,course:document.body.dataset.course??null,page:document.body.dataset.page??null,content:main?.innerText.trim().length??0,heading:main?.querySelector('h1')?.textContent.trim()??'',focus:{id:active?.id,tag:active?.tagName,inside:!!main?.contains(active),skipId}};
  });
}

export async function routes(env) {
  const out=result();
  await runCase(env,out,'route and history navigation',async(page, observation) => {
    await page.goto(routeURL(env,'desk')); await ready(page,'desk');
    const first=await routeSnapshot(page);
    assert(out,'initial persistent shell id',!!first.shell,first.shell,'nonempty');
    observation.steps=[{route:'desk',...first}];
    let documents=0;
    page.on('request',request=>{if(request.isNavigationRequest()&&request.frame()===page.mainFrame()) documents++;});
    const inspect=async(route,label)=>{
      const state=await routeSnapshot(page); observation.steps.push({route,label,...state});
      assert(out,`${label}: no document reload`,state.shell===first.shell,state.shell,first.shell);
      assert(out,`${label}: URL`,new URL(state.url).pathname===new URL(routeURL(env,route)).pathname,state.url,routeURL(env,route));
      assert(out,`${label}: title`,state.title===TITLES[route],state.title,TITLES[route]);
      assert(out,`${label}: body identity`,state.course===(route==='desk'?null:route)&&state.page===(route==='desk'?'desk':null),{course:state.course,page:state.page},{course:route==='desk'?null:route,page:route==='desk'?'desk':null});
      assert(out,`${label}: coursework rendered`,state.content>20&&!!state.heading,{characters:state.content,heading:state.heading},'visible route heading and content');
      assert(out,`${label}: focus target`,state.focus.inside&&(!state.focus.skipId||state.focus.id===state.focus.skipId),state.focus,'route Skip destination, or heading within main');
    };
    for(const route of ['cen100','mth140','mth141','desk']) {await navigate(page,route);await inspect(route,`open ${route}`);}
    for(const [direction,sequence] of [['back',['mth141','mth140','cen100']],['forward',['mth140','mth141']]]) {
      for(const route of sequence) {await page.evaluate(direction=>history[direction](),direction);await ready(page,route);await inspect(route,`${direction} to ${route}`);}
    }
    assert(out,'no additional document navigation requests',documents===0,documents,0);
  });
  return out;
}

const completed = ids => Object.fromEntries(ids.map(id=>[id,true]));
const allComplete = () => ({'cen100-personal-plan-v1':{completed:completed(SCHEDULE.filter(e=>e.calendar!==false).map(e=>e.id)),notes:{},targets:{}},...Object.fromEntries(['mth140','mth141'].map(id=>[id+'-progress-v1',{completed:completed(COURSES[id].assessments.map(a=>a.id)),checks:{},notes:{},targets:{},topics:{}}]))});

async function gsapMetrics(page, env) {
  await page.evaluate(async base => {
    const core=await import(base+'assets/vendor/gsap-3.15.0.mjs');
    // Import only the already-present optional bundle. Registration/animation is
    // product-owned; this hook merely observes the shared instance.
    const coreURL=document.querySelector('script[data-shell-module][src*="assets/night/core.mjs"]')?.src;
    if(!coreURL)throw Error('Loaded Night Shift core URL unavailable');
    const services=await import(coreURL);
    const extra=await import(base+'assets/vendor/night-vendor.mjs?v='+services.VERSION);
    window.__qaMetrics.installGsap(core.gsap,extra.ScrollTrigger);
  }, env.origin+env.base);
}

async function lifecycleSnapshot(page,observation) {
  const available=typeof page.requestGC==='function';
  observation.garbageCollection={available,method:available?'Playwright page.requestGC before both snapshots':'Unavailable: retained detached objects may await normal garbage collection.'};
  if(available) await page.requestGC();
  return page.evaluate(()=>window.__qaMetrics.snapshot());
}

export function countGrowth(before,after) {
  const paths=['listeners.live','listeners.retained','observers.total','raf.pending','raf.recurring','canvases.connected','webgl.active'];
  for(const kind of ['intersection','mutation','resize'])for(const field of ['instances','active','targets'])paths.push(`observers.${kind}.${field}`);
  for(const field of ['tickerCallbacks','scrollTriggers'])if(Number.isFinite(before.gsap?.[field])&&Number.isFinite(after.gsap?.[field]))paths.push('gsap.'+field);
  const get=(value,path)=>path.split('.').reduce((v,k)=>v?.[k],value);
  return paths.map(path=>({metric:path,baseline:get(before,path),end:get(after,path),delta:get(after,path)-get(before,path)}));
}

async function completionCycle(page,out,label) {
  const before=await page.locator('[data-quick-complete]').first().getAttribute('data-quick-complete');
  await page.locator('[data-quick-complete]').first().click();
  await page.locator('#undo-complete').waitFor({state:'visible'});
  const advanced=await page.locator('[data-quick-complete]').first().getAttribute('data-quick-complete');
  assert(out,`${label}: Mark done advances target`,advanced!==before,{before,advanced},'different target');
  await page.locator('#undo-complete').click();
  await until(()=>page.evaluate(id=>document.querySelector('[data-quick-complete]')?.dataset.quickComplete===id,before),'Undo restores target');
  assert(out,`${label}: Undo restores target`,await page.locator('[data-quick-complete]').first().getAttribute('data-quick-complete')===before,before,before);
}

async function paletteCycle(page) {
  await page.keyboard.press('Control+k');
  await page.waitForFunction(()=>[...document.querySelectorAll('dialog')].some(d=>d.open&&d.querySelector('input[type="search"],input[role="combobox"],.ns-palette-input')));
  await page.keyboard.press('Escape');
  await page.waitForFunction(()=>![...document.querySelectorAll('dialog')].some(d=>d.open));
}

export async function stability(env) {
  const out=result();
  await runCase(env,out,'repeated lifecycle operations',async(page,observation)=>{
    observation.clockMethod='Moving Date offset at Oct 13 noon Toronto; native animation frames and timers remain instrumented.';
    await page.goto(routeURL(env,'desk')); await ready(page,'desk');
    // Warm every lazy route and shell service, then compare the same mounted
    // Desk state. Warm-up counts are reported rather than excluded silently.
    for(const route of ['cen100','mth140','mth141','desk']) {await navigate(page,route);await settle(page,out);}
    await navigate(page,'mth140');
    for(const view of ['study','info','assignments']) await page.locator(`[data-workspace-view="${view}"]`).click();
    await navigate(page,'cen100'); await completionCycle(page,out,'warm-up');
    const palette=await page.locator('dialog.ns-palette,dialog#ns-palette,dialog[data-command-palette]').count();
    if(palette) await paletteCycle(page);
    else out.skipped.push({case:'palette cycles',reason:'No command palette dialog in this product revision; routes/views/completion checks still run.'});
    await navigate(page,'desk'); await settle(page,out);await gsapMetrics(page,env);
    observation.baseline=await lifecycleSnapshot(page,observation);
    env.progress?.('baseline recorded; starting 20 round trips');
    observation.shell=await page.locator('html').getAttribute('data-shell-id');
    for(let i=0;i<20;i++) {await navigate(page,ROUTES[1+i%3]);await navigate(page,'desk');}
    env.progress?.('20 round trips completed');
    await navigate(page,'mth140');
    for(let i=0;i<20;i++) {
      const view=['study','info','assignments'][i%3];
      await page.locator(`[data-workspace-view="${view}"]`).click();
      await until(()=>page.evaluate(view=>document.body.dataset.workspaceView===view,view),'workspace view change');
    }
    if(palette) for(let i=0;i<20;i++) await paletteCycle(page);
    env.progress?.(`20 workspace changes and ${palette?20:0} palette cycles completed`);
    await navigate(page,'cen100');
    for(let i=0;i<10;i++) await completionCycle(page,out,`cycle ${i+1}`);
    env.progress?.('10 Mark done/Undo cycles completed');
    await navigate(page,'desk'); await settle(page,out);
    observation.end=await lifecycleSnapshot(page,observation);
    observation.growth=countGrowth(observation.baseline,observation.end);
    for(const metric of ['tickerCallbacks','scrollTriggers'])if(!Number.isFinite(observation.baseline.gsap?.[metric])||!Number.isFinite(observation.end.gsap?.[metric]))out.skipped.push({case:`GSAP ${metric}`,reason:'The loaded runtime does not expose this GSAP metric. Raw availability and counts remain in the snapshots.'});
    observation.operations={roundTrips:20,workspaceChanges:20,paletteCycles:palette?20:0,completionCycles:10};
    assert(out,'stability keeps one document shell',await page.locator('html').getAttribute('data-shell-id')===observation.shell,await page.locator('html').getAttribute('data-shell-id'),observation.shell);
    for(const entry of observation.growth) assert(out,`${entry.metric} does not grow`,Number.isFinite(entry.delta)&&entry.delta<=0,entry.end,`<= ${entry.baseline}`,`Baseline ${entry.baseline}; end ${entry.end}; delta ${entry.delta}.`);
  },{linearClock:'2026-10-13T16:00:00.000Z'});
  return out;
}

export function summarizeFrames(intervals,longTasks) {
  const sorted=[...intervals].sort((a,b)=>a-b), n=intervals.length;
  const over=limit=>{const count=intervals.filter(ms=>ms>limit).length;return {count,share:n?count/n:null,percent:n?100*count/n:null};};
  return {frames:n,over16_7ms:over(16.7),over33ms:over(33),p95ms:n?sorted[Math.min(n-1,Math.ceil(n*.95)-1)]:null,maxMs:n?sorted[n-1]:null,longTasksOver50ms:longTasks.filter(t=>t.duration>50)};
}

export async function frames(env) {
  const out=result();
  out.observations.interpretation=env.gpu?'GPU run: browser renderer and host determine device relevance.':'SwiftShader diagnostics: frame pacing here is not evidence of smoothness on a real device.';
  for(const route of ROUTES) await runCase(env,out,`${route} 5-second wheel scroll`,async(page,observation)=>{
    await page.goto(routeURL(env,route)); await ready(page,route);await settle(page,out);
    observation.environment=await page.evaluate(()=>{
      const canvas=document.createElement('canvas'),gl=canvas.getContext('webgl2');
      const debug=gl?.getExtension('WEBGL_debug_renderer_info');
      const renderer=debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):null;
      gl?.getExtension('WEBGL_lose_context')?.loseContext();
      return {userAgent:navigator.userAgent,renderer,hardwareConcurrency:navigator.hardwareConcurrency,deviceMemory:navigator.deviceMemory??null,viewport:[innerWidth,innerHeight],dpr:devicePixelRatio};
    });
    const sampling=page.evaluate(()=>new Promise(resolve=>{
      const intervals=[],longTasks=[];let last=null,start=null;
      const supported=PerformanceObserver.supportedEntryTypes?.includes('longtask');
      const observer=supported?new PerformanceObserver(list=>{for(const entry of list.getEntries())longTasks.push({start:entry.startTime,duration:entry.duration,name:entry.name});}):null;
      observer?.observe({type:'longtask'});
      const frame=now=>{start??=now;if(last!==null)intervals.push(now-last);last=now;if(now-start<5000)requestAnimationFrame(frame);else{for(const entry of observer?.takeRecords()??[])longTasks.push({start:entry.startTime,duration:entry.duration,name:entry.name});observer?.disconnect();resolve({intervals,longTasks,longTaskSupported:supported,elapsed:now-start});}};
      requestAnimationFrame(frame);
    }));
    await page.mouse.move(720,450);
    for(let i=0;i<50;i++) {await page.mouse.wheel(0,i<25?120:-120);await sleep(100);}
    const sampled=await sampling;
    observation.measurement={...summarizeFrames(sampled.intervals,sampled.longTasks),elapsedMs:sampled.elapsed,longTaskSupported:sampled.longTaskSupported};
    assert(out,`${route}: frame sample collected`,sampled.intervals.length>=2&&sampled.elapsed>=5000,observation.measurement,'5 seconds and at least two frame intervals');
    assert(out,`${route}: long task observation available`,sampled.longTaskSupported,sampled.longTaskSupported,true);
  });
  return out;
}

function deadlineStorage(course,uncompleted,section) {
  const storage=allComplete();
  storage[course==='cen100'?'cen100-personal-plan-v1':course+'-progress-v1'].completed=completed((course==='cen100'?SCHEDULE.filter(e=>e.calendar!==false):COURSES[course].assessments).map(e=>e.id).filter(id=>!uncompleted.includes(id)));
  if(section) storage[course==='cen100'?'cen100-contact-choice-v1':course+'-section-v1']=course==='cen100'?{section,group:1}:section;
  return storage;
}

// Countdown format from docs/copy/interface-copy.md: one day or more `{d}d {h}h`, under a day
// `{h}h {mm}m`, under an hour `{m}m`. The Desk adds "left"; the exact instant is "Happening now".
export function compactExact(at,now) {
  const ms=+new Date(at)-+new Date(now);
  if(ms===0) return 'Happening now';
  if(ms<0) return 'Due time passed';
  const s=Math.floor(ms/1000),d=Math.floor(s/86400),h=Math.floor(s%86400/3600),m=Math.floor(s%3600/60);
  return d?`${d}d ${h}h`:h?`${h}h ${String(m).padStart(2,'0')}m`:`${m}m`;
}

async function surfaces(page,env,course) {
  return page.evaluate(async({base,course})=>{
    const text=s=>document.querySelector(s)?.textContent.trim()??null;
    if(document.body.dataset.page==='desk') return {kind:'desk',overall:{title:text('[data-desk-overall] .desk-next-title'),when:text('[data-desk-overall] .desk-count-when'),timer:!!document.querySelector('[data-desk-overall] .desk-digits'),precision:document.querySelector('[data-desk-overall]')?.dataset.precision,course:document.querySelector('[data-desk-overall]')?.dataset.deskCourse},course:{title:text(`[data-course-card="${course}"] .desk-course-title`),when:text(`[data-course-card="${course}"] .desk-course-when`),chip:text(`[data-course-card="${course}"] .desk-chip`),cta:text(`[data-course-card="${course}"] .desk-cta`),precision:document.querySelector(`[data-course-card="${course}"] [data-desk-next]`)?.dataset.precision}};
    // Read the page's own module instance: the guide imports deadline.mjs under its ?v= cache token,
    // and a bare URL would evaluate a second, never-mounted copy. Follow boot.mjs's own import
    // (the installed clock replaces performance, so resource timing is not available here).
    let url=new URL('assets/night/deadline.mjs',base).href;
    const boot=document.querySelector('script[src*="assets/night/boot.mjs"]')?.src;
    if(boot){const spec=(await (await fetch(boot)).text()).match(/from\s*['"](\.\/deadline\.mjs[^'"]*)['"]/)?.[1];if(spec)url=new URL(spec,boot).href;}
    const module=await import(url);
    return {kind:'course',target:module.currentTarget(),card:{title:text(course==='cen100'?'#nextsign .next-open .t':'#next-assessment h2'),id:document.querySelector('[data-quick-complete]')?.dataset.quickComplete,when:text('.ns-count-when'),precision:document.querySelector('.ns-count')?.dataset.precision,cta:text('.ns-count [data-ns-section]'),timer:!!document.querySelector('.ns-count .ns-digits'),key:document.querySelector('.ns-count')?.dataset.key},dock:{title:text('.ns-dock [data-ns-title]'),chip:text('.ns-dock [data-ns-chip]')},hero:{title:text('.ns-hud [data-ns-title]'),chip:text('.ns-hud [data-ns-chip]')}};
  },{base:env.origin+env.base,course});
}

function assertSurfaces(out,label,state,fixture,now) {
  const {title,when,at,precision='exact',id}=fixture;
  if(state.kind==='desk') {
    for(const name of ['overall','course']) {
      assert(out,`${label}: Desk ${name} title`,state[name].title===title,state[name].title,title);
      assert(out,`${label}: Desk ${name} date/time`,when.every(part=>state[name].when?.includes(part)),state[name].when,when);
      assert(out,`${label}: Desk ${name} precision`,state[name].precision===precision,state[name].precision,precision);
    }
    if(at) assert(out,`${label}: Desk countdown`,state.course.chip===`${compactExact(at,now)} left`,state.course.chip,`${compactExact(at,now)} left`);
    else {
      assert(out,`${label}: Desk section CTA`,state.course.cta==='Choose section for quiz date',state.course.cta,'Choose section for quiz date');
      assert(out,`${label}: no Desk timer for quiz week`,!state.overall.timer,state.overall.timer,false);
    }
    return;
  }
  assert(out,`${label}: resolved target`,state.target?.id===id&&state.target?.title===title&&state.target?.precision===precision&&(!at||state.target?.at===+new Date(at)),state.target,{id,title,precision,...(at?{at:+new Date(at)}:{})});
  assert(out,`${label}: card target title and id`,state.card.title?.includes(title)&&state.card.id===id,{title:state.card.title,id:state.card.id},{title,id});
  assert(out,`${label}: card date/time`,when.every(part=>state.card.when?.includes(part)),state.card.when,when);
  assert(out,`${label}: card precision`,state.card.precision===precision,state.card.precision,precision);
  for(const name of ['dock','hero']) {
    assert(out,`${label}: ${name} target title`,state[name].title===title,state[name].title,title);
    assert(out,`${label}: ${name} target state`,state[name].chip===(at?compactExact(at,now):'Quiz week'),state[name].chip,at?compactExact(at,now):'Quiz week');
  }
  if(at) assert(out,`${label}: card timer matches target`,state.card.timer&&state.card.key?.includes(String(+new Date(at))),state.card,`timer for ${at}`);
  else {
    assert(out,`${label}: course section CTA`,state.card.cta==='Choose section for quiz date',state.card.cta,'Choose section for quiz date');
    assert(out,`${label}: no timer for quiz week`,!state.card.timer,state.card.timer,false);
  }
}

export async function deadlines(env) {
  const out=result();
  const fixtures=[
    {name:'CEN Academic Integrity',course:'cen100',id:'integrity',title:'Academic Integrity Quiz',at:'2026-10-14T19:00:00.000Z',when:['Oct 14','3:00 PM','Toronto'],now:'2026-10-13T16:00:00.000Z',section:1,uncompleted:['integrity','whmis']},
    {name:'MTH140 midterm',course:'mth140',id:'midterm',title:'Midterm Test',at:'2026-10-23T22:30:00.000Z',when:['Oct 23','6:30 PM','Toronto'],now:'2026-10-20T16:00:00.000Z',section:31,uncompleted:['midterm','quiz-3']},
    {name:'Quiz week without section',course:'mth140',id:'quiz-2',title:'Lab Quiz 2',when:['Oct 12','Oct 16'],precision:'week',now:'2026-10-13T16:00:00.000Z',uncompleted:['quiz-2','midterm']}
  ];
  for(const fixture of fixtures) await runCase(env,out,fixture.name,async(page,observation)=>{
    // Fixed Toronto fixtures use explicit UTC instants (EDT on these dates),
    // while the browser timezone is Toronto; no host timezone dependency.
    // This check isolates semantic time/completion behavior. Forced-off motion
    // keeps fake-clock animation scheduling out of Playwright hit testing;
    // motion policy and animated settlement are exercised by modes/layout.
    await page.goto(routeURL(env,'desk','?motion=off'));await ready(page,'desk');
    const now=await page.evaluate(()=>new Date(Date.now()).toISOString());
    observation.fixedClock={requested:fixture.now,actual:now,timezone:'America/Toronto'};
    observation.desk=await surfaces(page,env,fixture.course);assertSurfaces(out,fixture.name,observation.desk,fixture,now);
    await navigate(page,fixture.course);await settle(page,out);
    observation.course=await surfaces(page,env,fixture.course);assertSurfaces(out,fixture.name,observation.course,fixture,await page.evaluate(()=>new Date(Date.now()).toISOString()));
    if(fixture.at) {
      await activateClocked(page,'[data-quick-complete]');
      await until(()=>page.evaluate(id=>!document.querySelector('#quick-confirm')?.hidden&&document.querySelector('[data-quick-complete]')?.dataset.quickComplete!==id,fixture.id),'Mark done advances deadline');
      observation.afterDone=await surfaces(page,env,fixture.course);
      assert(out,`${fixture.name}: completion changes all course surfaces`,observation.afterDone.target?.id!==fixture.id&&observation.afterDone.dock.title===observation.afterDone.target?.title&&observation.afterDone.hero.title===observation.afterDone.target?.title,observation.afterDone,'next eligible target on card, dock, hero');
      await activateClocked(page,'#undo-complete');
      await until(()=>page.evaluate(id=>document.querySelector('[data-quick-complete]')?.dataset.quickComplete===id,fixture.id),'Undo restores deadline');
      observation.afterUndo=await surfaces(page,env,fixture.course);assertSurfaces(out,`${fixture.name} Undo`,observation.afterUndo,fixture,await page.evaluate(()=>new Date(Date.now()).toISOString()));
      await navigate(page,'desk');observation.deskAfterUndo=await surfaces(page,env,fixture.course);assertSurfaces(out,`${fixture.name} Desk Undo`,observation.deskAfterUndo,fixture,await page.evaluate(()=>new Date(Date.now()).toISOString()));
      await navigate(page,fixture.course);
      await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
      await page.clock.setSystemTime(new Date(+new Date(fixture.now)+3600000));
      await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'));});
      await page.waitForTimeout(100);
      observation.afterResume=await surfaces(page,env,fixture.course);
      assertSurfaces(out,`${fixture.name} resume`,observation.afterResume,fixture,await page.evaluate(()=>new Date(Date.now()).toISOString()));
      observation.visibilityMethod='Synthetic visibilitychange with document.hidden getter: verifies resume handler and real-clock jump, not browser background throttling.';
      await navigate(page,'desk');observation.deskAfterResume=await surfaces(page,env,fixture.course);assertSurfaces(out,`${fixture.name} Desk resume`,observation.deskAfterResume,fixture,await page.evaluate(()=>new Date(Date.now()).toISOString()));
    }
  },{storage:deadlineStorage(fixture.course,fixture.uncompleted,fixture.section),contextOptions:{timezoneId:'America/Toronto'},clock:fixture.now});
  return out;
}

async function motionState(page) {
  return page.evaluate(()=>{
    const visible=el=>{const s=getComputedStyle(el),r=el.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0;};
    const animatedTransforms=document.getAnimations().filter(a=>a.playState==='running'&&a.effect?.getKeyframes().some(k=>k.transform&&k.transform!=='none')).map(a=>({target:a.effect.target?.className,duration:a.effect.getTiming().duration}));
    const decorative=[...document.querySelectorAll('[class*="cursor"],[class*="particle"],[class*="dust"]')].filter(visible).map(el=>({tag:el.tagName,class:el.className}));
    const transforms=[...document.querySelectorAll('.header-upgraded,.hero-copy,.header-art,.ns-title-char,main[data-route-region]')].map(el=>({class:el.className,transform:getComputedStyle(el).transform}));
    return {preference:window.GuideMotion?.preference(),motion:document.documentElement.dataset.motion,animatedTransforms,decorative,transforms,metrics:window.__qaMetrics.snapshot(),content:document.querySelector('main[data-route-region]')?.innerText.trim().length??0,renderers:[...document.querySelectorAll('[data-renderer]')].map(el=>({renderer:el.dataset.renderer,poster:!!el.querySelector('img.scene-poster')?.complete,posterVisible:!!el.querySelector('img.scene-poster')&&visible(el.querySelector('img.scene-poster'))})),coursework:!!document.querySelector('.workspace-panel,#assessment-list,#board,[data-course-card]'),itemIds:[...document.querySelectorAll('[id^="guide-item-"],details.assessment[id]')].map(el=>el.id),deskCourses:[...document.querySelectorAll('[data-course-card]')].map(el=>el.dataset.courseCard)};
  });
}

function assertCoursework(out,label,state,route) {
  const expected=route==='desk'?ROUTES.slice(1):route==='cen100'?[...new Set(SCHEDULE.map(row=>row.item).filter(Boolean))].map(id=>'guide-item-'+id):COURSES[route].assessments.map(a=>'assessment-'+a.id);
  const actual=route==='desk'?state.deskCourses:state.itemIds;
  assert(out,`${label}: complete coursework records`,expected.every(id=>actual.includes(id)),actual,expected);
}

export async function modes(env) {
  const out=result();
  const variants=[
    {name:'motion off',query:'?motion=off',reduce:'no-preference',storage:{'guide-motion-level':'full'},locked:true},
    {name:'OS reduced motion',query:'',reduce:'reduce',storage:{},locked:true},
    {name:'OS reduced overrides saved full',query:'',reduce:'reduce',storage:{'guide-motion-level':'full'},locked:true},
    {name:'saved full on normal OS',query:'',reduce:'no-preference',storage:{'guide-motion-level':'full'},locked:false}
  ];
  for(const variant of variants) for(const route of ROUTES) await runCase(env,out,`${route}: ${variant.name}`,async(page,observation)=>{
    await page.goto(routeURL(env,route,variant.query));await ready(page,route);await settle(page,out);
    observation.before=await motionState(page);await page.waitForTimeout(450);observation.after=await motionState(page);
    assert(out,`${route} ${variant.name}: coursework usable`,observation.after.content>20&&observation.after.coursework,observation.after.content,'visible coursework');
    assertCoursework(out,`${route} ${variant.name}`,observation.after,route);
    if(variant.locked) {
      if(route!=='desk') assert(out,`${route} ${variant.name}: preference resolves off`,observation.after.motion==='off',observation.after.preference,'motion off');
      assert(out,`${route} ${variant.name}: no animated transforms`,observation.after.animatedTransforms.length===0,observation.after.animatedTransforms,[]);
      assert(out,`${route} ${variant.name}: transforms remain static`,equal(observation.before.transforms,observation.after.transforms),{before:observation.before.transforms,after:observation.after.transforms},'unchanged over 450 ms');
      assert(out,`${route} ${variant.name}: no canvas drawing loop`,observation.after.metrics.canvases.drawCalls===observation.before.metrics.canvases.drawCalls,{before:observation.before.metrics.canvases.drawCalls,after:observation.after.metrics.canvases.drawCalls},'no drawing during sample');
      assert(out,`${route} ${variant.name}: no cursor, particles or dust`,observation.after.decorative.length===0,observation.after.decorative,[]);
    }
  },{storage:variant.storage,contextOptions:{reducedMotion:variant.reduce}});
  let fallbackBrowser;
  try {
    fallbackBrowser=await env.playwright.chromium.launch({...env.launchOptions,args:[...(env.launchOptions.args??[]),'--disable-webgl']});
    for(const route of ROUTES) await runCase(env,out,`${route}: WebGL disabled`,async(page,observation)=>{
      await page.goto(routeURL(env,route));await ready(page,route);await settle(page,out);
      observation.before=await motionState(page);await page.waitForTimeout(450);observation.after=await motionState(page);
      assert(out,`${route}: fallback coursework present`,observation.after.coursework&&observation.after.content>20,observation.after.content,'complete DOM content');
      assertCoursework(out,`${route} WebGL fallback`,observation.after,route);
      assert(out,`${route}: no WebGL contexts`,observation.after.metrics.webgl.active===0,observation.after.metrics.webgl.active,0);
      if(route!=='desk') assert(out,`${route}: visible authored poster`,observation.after.renderers.length>0&&observation.after.renderers.every(r=>r.renderer==='poster'&&r.poster&&r.posterVisible),observation.after.renderers,'loaded, visible posters');
      else observation.deskPoster='Desk currently has an empty future stage; DOM course links are the authored fallback.';
      assert(out,`${route}: fallback stops canvas drawing`,observation.after.metrics.canvases.drawCalls===observation.before.metrics.canvases.drawCalls,{before:observation.before.metrics.canvases.drawCalls,after:observation.after.metrics.canvases.drawCalls},'no active decorative canvas loop');
    },{browser:fallbackBrowser});
  } catch(error) {assert(out,'WebGL-disabled browser launch',false,String(error),'browser launches');}
  finally {await fallbackBrowser?.close();}
  return out;
}

async function inspectLayout(page) {
  return page.evaluate(()=>{
    const visible=el=>{
      if(el.checkVisibility&&!el.checkVisibility({checkVisibilityCSS:true,contentVisibilityAuto:true}))return false;
      for(let parent=el.parentElement;parent;parent=parent.parentElement)if(parent.matches('dialog:not([open]),details:not([open])')&&!parent.querySelector(':scope > summary')?.contains(el))return false;
      const r=el.getBoundingClientRect(),s=getComputedStyle(el);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden'&&!el.closest('[hidden],[inert]');
    };
    const describe=el=>({tag:el.tagName,id:el.id,text:(el.getAttribute('aria-label')||el.textContent||'').trim().slice(0,90),class:el.className});
    const controls=[...document.querySelectorAll('button,a[href],input:not([type="hidden"]),select,textarea,summary,[role="button"]')].filter(visible);
    const small=controls.filter(el=>{const r=el.getBoundingClientRect();return r.width<44||r.height<44;}).map(el=>{const r=el.getBoundingClientRect();const label=el.labels?.[0];return {...describe(el),width:r.width,height:r.height,label:label?{width:label.getBoundingClientRect().width,height:label.getBoundingClientRect().height}:null};});
    const overflow=[...document.body.querySelectorAll('*')].filter(visible).filter(el=>{const r=el.getBoundingClientRect();return r.right>innerWidth+1||r.left< -1;}).slice(0,30).map(el=>({...describe(el),left:el.getBoundingClientRect().left,right:el.getBoundingClientRect().right}));
    return {width:innerWidth,scrollWidth:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth),smallControls:small,overflow};
  });
}

async function focusState(page) {
  return page.evaluate(()=>{
    const el=document.activeElement,s=getComputedStyle(el),r=el.getBoundingClientRect();
    const outline=s.outlineStyle!=='none'&&parseFloat(s.outlineWidth)>0&&s.outlineColor!=='transparent'&&s.outlineColor!=='rgba(0, 0, 0, 0)';
    return {tag:el.tagName,id:el.id,class:el.className,text:(el.getAttribute('aria-label')||el.textContent||'').trim().slice(0,100),focusVisible:el.matches(':focus-visible'),outline:{style:s.outlineStyle,width:s.outlineWidth,color:s.outlineColor},boxShadow:s.boxShadow,indicator:!!(outline||s.boxShadow!=='none'),visible:r.width>0&&r.height>0&&r.bottom>0&&r.top<innerHeight&&s.visibility!=='hidden'&&s.display!=='none',skip:el.matches('.skip-link')};
  });
}

export async function layout(env) {
  const out=result();
  for(const width of [1440,1024,390]) for(const theme of ['dark','light']) for(const route of ROUTES) await runCase(env,out,`${route} ${width}px ${theme}`,async(page,observation)=>{
    await page.goto(routeURL(env,route,'?motion=off'));await ready(page,route);await settle(page,out);
    observation.layout=await inspectLayout(page);
    assert(out,`${route} ${width} ${theme}: no horizontal overflow`,observation.layout.scrollWidth<=width+1,observation.layout,{maximumScrollWidth:width+1});
    // The visible label is the hit target for native checkboxes/radios. All
    // other small links/buttons remain actionable failures, including footers.
    const tooSmall=observation.layout.smallControls.filter(c=>!(['INPUT'].includes(c.tag)&&c.label?.width>=44&&c.label?.height>=44));
    assert(out,`${route} ${width} ${theme}: controls at least 44px`,tooSmall.length===0,tooSmall,[]);
    await page.evaluate(()=>{document.activeElement?.blur();window.scrollTo(0,0);});
    observation.tabStops=[];
    for(let i=0;i<5;i++) {
      await page.keyboard.press('Tab');const focus=await focusState(page);observation.tabStops.push(focus);
      if(i===0) assert(out,`${route} ${width} ${theme}: Skip link first`,focus.skip,focus,'Skip link');
      assert(out,`${route} ${width} ${theme}: tab ${i+1} visible focus`,focus.visible&&focus.focusVisible&&focus.indicator,focus,'visible focus indicator');
    }
  },{storage:{'tmu-guide-theme-v1':theme},contextOptions:{viewport:{width,height:900},colorScheme:theme}});
  return out;
}

export const CHECKS = {routes,stability,frames,deadlines,modes,layout};
