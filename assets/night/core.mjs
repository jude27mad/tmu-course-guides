/* Night Shift runtime: shared state for the layer that sits on top of the existing guide modules.
   Services start once; view-bound effects register disposers and are rebuilt per view. */
export {timestamp,clock,dateLabel,dayLabel,today,addDays,resolveAssessment,timing} from '../schedule.mjs';
import {loadData} from './targets.mjs?v=20261013-shift1';

export const VERSION='20261013-shift2';
/* Resolve paths against this file. Dynamic imports built this way share module instances with the guide
   (gsap-3.15.0.mjs resolves to the same URL guide-motion.mjs imports), so there is only one GSAP core. */
export const asset=path=>new URL(path,import.meta.url).href;

/* The motion controller is shared through window.GuideMotion so this layer never creates a second instance. */
const GM=()=>window.GuideMotion;
export const motionAllowed=()=>GM()?.motionAllowed()??!matchMedia('(prefers-reduced-motion: reduce)').matches;
export const sceneMotionAllowed=()=>GM()?.sceneMotionAllowed()??motionAllowed();
export const preference=()=>GM()?.preference()??{};
export const setScenePaused=value=>GM()?.setScenePaused(value);
/* "Pause motion": one saved control for the hero scene and every ambient loop in this layer. */
export const toggleMotion=()=>setScenePaused(!preference().scenePaused);

/* Page mode is explicit. The Desk (site root, body[data-page=desk]) has no course identity, so nothing may fall
   back to CEN100 there: course is 'desk' and META is null. Course pages keep their data-course. */
// Legacy course, META, page and isDesk exports are live bindings. isMathCourse is the legacy boolean.
// isMath changed from a boolean (f620a7e) to an accessor because the route changes in place: call isMath().
// A bare `if(isMath)` is always true; every in-repo caller uses the call form.
export let isDesk=document.body.dataset.page==='desk';
export let page=isDesk?'desk':'course';
export let course=isDesk?'desk':document.body.dataset.course||'cen100';
export let isMathCourse=course==='mth140'||course==='mth141';
export const route=()=>course;
export const isMath=()=>isMathCourse;
export const $=(selector,root=document)=>root.querySelector(selector);
export const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
export const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const read=(key,fallback)=>{try{const v=localStorage.getItem(key);return v===null?fallback:JSON.parse(v)}catch{return fallback}};
export const write=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));return true}catch{return false}};
export const finePointer=matchMedia('(hover:hover) and (pointer:fine)');
export const TERM={start:'2026-09-08',end:'2026-12-21'};
/* Course identity. accent = the editorial course colour; strong = its readable light-theme ink. */
export const COURSE_META={
 cen100:{code:'CEN100',name:'Engineering',index:'01',accent:'#edbba7',strong:'#954424',motif:'mechanism'},
 mth140:{code:'MTH140',name:'Calculus I',index:'02',accent:'#b9dfc9',strong:'#096450',motif:'flow'},
 mth141:{code:'MTH141',name:'Linear Algebra',index:'03',accent:'#d3c3ee',strong:'#694392',motif:'plane'}
};
export let META=COURSE_META[course]??null;
export const meta=()=>META;
export function setRoute(value){course=value|| (document.body.dataset.page==='desk'?'desk':document.body.dataset.course||'cen100');isDesk=course==='desk';page=isDesk?'desk':'course';isMathCourse=course==='mth140'||course==='mth141';META=COURSE_META[course]??null;}
document.addEventListener('route-changed',e=>setRoute(e.detail?.route));

/* Same module URL as the math guide, so the page holds one copy of the course data. */
const coursesPromises=new Map();
export const courseData=()=>{if(!isMath())return Promise.resolve(null);if(!coursesPromises.has(course))coursesPromises.set(course,loadData(course));return coursesPromises.get(course);};

/* Schedule rows come from the existing semester rail feed, so completion state stays the guides' own. */
export function scheduleRows(){return window.CourseVisuals?.rows||[];}
export function onSchedule(fn){const on=e=>fn(e.detail);document.addEventListener('course-schedule',on);return()=>document.removeEventListener('course-schedule',on);}

/* One reliable path to an assessment, shared by the palette and the timeline. */
export async function openItem(target){
 if(!target||isDesk)return; // The Desk links to items instead; there is no workspace to open them in.
 const activeCourse=course,workspace=window.CourseWorkspace;
 const id=isMath()?String(target).replace(/^assessment-/,''):String(target);
 const node=isMath()?document.getElementById('assessment-'+id):document.getElementById('guide-item-'+id);
 const sheet=$('.detail-sheet');
 if(sheet?.open&&node&&sheet.contains(node)){sheet.querySelector('.sheet-close')?.focus();return;}
 workspace?.show('assignments');
 const hide=$('#hide-completed');
 if(hide?.checked&&node&&!node.getClientRects().length){hide.checked=false;hide.dispatchEvent(new Event('change',{bubbles:true}));}
 if(node?.closest('.past')&&!document.body.classList.contains('workspace-show-past')){const past=$('#workspace-show-past');if(past){past.checked=true;past.dispatchEvent(new Event('change',{bubbles:true}));}}
 await frames(2);
 if(course!==activeCourse||window.CourseWorkspace!==workspace)return;
 window.GuideMotion?.cancel(document.querySelector('.wrap,.math-wrap'));
 document.dispatchEvent(new CustomEvent('course-open-item',{detail:isMath()?'assessment-'+id:id}));
}
export const frames=(n=1,signal)=>new Promise(resolve=>{let raf=0;const done=()=>{cancelAnimationFrame(raf);signal?.removeEventListener('abort',done);resolve();};const step=k=>{if(signal?.aborted||!k){done();return;}raf=requestAnimationFrame(()=>step(k-1));};signal?.addEventListener('abort',done,{once:true});step(n);});

/* Temporary holds pause ambient motion without touching the saved preference. */
const holds=new Set();
export function hold(reason){holds.add(reason);document.dispatchEvent(new CustomEvent('night-hold',{detail:held()}));}
export function release(reason){holds.delete(reason);document.dispatchEvent(new CustomEvent('night-hold',{detail:held()}));}
export const held=()=>holds.size>0;
/* Ambient = loops that run on their own (marquee, pulses). Pause motion stops them all. */
export const ambientAllowed=()=>sceneMotionAllowed()&&!held()&&!document.hidden;
/* CSS hooks: html.ns-still stops CSS-driven ambient loops; html.ns-held tells the hero scene to rest
   while a palette or sheet is open (course-scene.mjs reads it; the saved pause is untouched). */
function syncRoot(){const root=document.documentElement;root.classList.toggle('ns-still',!ambientAllowed());root.classList.toggle('ns-held',held());}
for(const t of ['guide-motion-change','night-hold','visibilitychange'])document.addEventListener(t,syncRoot);
syncRoot();
/* Calls fn(allowed) whenever pause, holds, reduced motion or tab visibility change. Returns an unsubscribe. */
export function onAmbient(fn){
 let last;const check=()=>{const now=ambientAllowed();if(now!==last){last=now;fn(now);}};
 const types=['guide-motion-change','night-hold','visibilitychange'];
 for(const t of types)document.addEventListener(t,check);
 check();
 return()=>{for(const t of types)document.removeEventListener(t,check);};
}

/* View-bound effects: register a disposer; all are released before a view rebuild. */
const tracked=new Map();
export function track(scope,dispose){if(!tracked.has(scope))tracked.set(scope,new Set());tracked.get(scope).add(dispose);return dispose;}
export function dispose(scope){const set=tracked.get(scope);if(!set)return;tracked.delete(scope);for(const fn of set){try{fn()}catch{}}}
export const trackedCount=()=>[...tracked.values()].reduce((n,s)=>n+s.size,0);
export const view=()=>document.body.dataset.workspaceView||'assignments';

export function whenWorkspace(fn){
 const ready=()=>document.body.classList.contains('workspace')&&document.querySelector('.header-upgraded');
 let done=false,poll,timeout;
 const cancel=()=>{done=true;clearInterval(poll);clearTimeout(timeout);document.removeEventListener('workspace-changed',go);};
 const go=()=>{if(done||!ready())return;cancel();fn();};
 poll=setInterval(go,120);timeout=setTimeout(cancel,8000);
 document.addEventListener('workspace-changed',go);go();return cancel;
}

/* ---- Quality tiers ----
   high: full effects. mid: no skew or cursor trail.
   low: no smooth scroll or custom cursor.
   deviceMemory is a hint only when present; a missing value never counts as weak hardware. */
const coarse=matchMedia('(pointer:coarse)').matches;
const cores=navigator.hardwareConcurrency||4,memory=navigator.deviceMemory;
let tierValue=navigator.connection?.saveData||(memory&&memory<=2)||cores<=2?'low':coarse||cores<=4||(memory&&memory<=4)?'mid':'high';
try{const forced=new URLSearchParams(location.search).get('tier');if(['high','mid','low'].includes(forced))tierValue=forced;}catch{}
export const tier=()=>tierValue;
export const TIERS=['low','mid','high'];
export const atLeast=name=>TIERS.indexOf(tierValue)>=TIERS.indexOf(name);
export function downgrade(reason='slow frames'){
 const i=TIERS.indexOf(tierValue);if(i<=0)return;
 tierValue=TIERS[i-1];document.documentElement.dataset.nsTier=tierValue;
 document.dispatchEvent(new CustomEvent('night-tier',{detail:{tier:tierValue,reason}}));
}
export function onTier(fn){const h=e=>fn(e.detail.tier);document.addEventListener('night-tier',h);return()=>document.removeEventListener('night-tier',h);}

/* ---- Optional vendor chunk (lazy). One GSAP core: the guide's own instance. ---- */
let vendorPromise;
export function vendor(){
 return vendorPromise??=Promise.all([import(asset('../vendor/gsap-3.15.0.mjs')),import(asset('../vendor/night-vendor.mjs?v='+VERSION))]).then(([core,extra])=>{
  const {gsap}=core,{ScrollTrigger,SplitText,Lenis}=extra;
  gsap.registerPlugin(ScrollTrigger,SplitText);
  startWatchdog(gsap);
  return {gsap,ScrollTrigger,SplitText,Lenis};
 });
}

/* Watchdog on the shared ticker: sustained slow frames while ambient motion runs drop one tier.
   A frame over 25 ms already misses 60 Hz pacing, so the share of such frames is what counts. */
let watching=false;
function startWatchdog(gsap){
 if(watching)return;watching=true;
 let slow=0,total=0,since=performance.now(),last=0;
 gsap.ticker.add(()=>{
  const now=performance.now(),delta=last?now-last:0;last=now;
  if(!ambientAllowed()||delta>250){total=slow=0;since=now;return;}
  total++;if(delta>25)slow++;
  if(now-since>3000){if(total>40&&slow/total>.45)downgrade();total=slow=0;since=now;}
 });
}

/* Feature stylesheets load next to their modules. Resolves when the sheet applies (or fails). */
export function loadCSS(name){
 const href=asset(`./${name}.css?v=${VERSION}`);
 const existing=document.querySelector(`link[data-night="${name}"]`);
 if(existing){
  // The router keeps warmed route sheets inert in place for offline reuse. A remounted
  // feature owns this sheet again; change its CSSOM media without restarting its request.
  if(existing.sheet)existing.sheet.media.mediaText='';else existing.removeAttribute('media');
  return Promise.resolve(existing);
 }
 return new Promise(resolve=>{const link=document.createElement('link');link.rel='stylesheet';link.href=href;link.dataset.night=name;link.onload=link.onerror=()=>resolve(link);document.head.append(link);});
}

/* Paper sound + haptics service, opt-in (tmu-guide-sound-v1). One lazy AudioContext for the shell.
   play('page-turn', {intensity:.7, spread:weekIndex}) reports whether a sound was scheduled.
   Supply a stable spread id when scrubbing: repeated calls for that spread stay silent, and
   changed spreads share a 120 ms limit. Calls without a spread still obey the time limit. */
const SOUND_KEY='tmu-guide-sound-v1';
const PAPER_SOUNDS={
 'page-turn':{duration:.18,frequency:1400,end:2600,noise:.07,thump:180,body:.012},
 'cover-open':{duration:.28,frequency:650,end:1500,noise:.06,thump:120,body:.035},
 'cover-close':{duration:.16,frequency:1100,end:450,noise:.05,thump:150,body:.09},
 'book-set-down':{duration:.2,frequency:500,end:260,noise:.035,thump:90,body:.12},
 'popup-unfold':{duration:.1,frequency:2200,end:3400,noise:.045,thump:420,body:.018}
};
let soundOn=read(SOUND_KEY,false)===true,audio=null,noiseBuffer=null,userGesture=false,lastTurn=-Infinity,lastSpread;
const noteGesture=e=>{if(e.isTrusted)userGesture=true;};
for(const type of ['pointerdown','keydown','click','touchend'])document.addEventListener(type,noteGesture,{capture:true,passive:true});
export const soundEnabled=()=>soundOn;
export function setSound(on){soundOn=!!on;write(SOUND_KEY,soundOn);document.dispatchEvent(new CustomEvent('night-sound',{detail:soundOn}));}
export function play(name,{intensity=1,spread}={}){
 const volume=Number.isFinite(intensity)?Math.max(0,Math.min(1,intensity)):1;
 if(!Object.hasOwn(PAPER_SOUNDS,name)||!volume||!soundOn||!motionAllowed()||!sceneMotionAllowed()||
    matchMedia('(prefers-reduced-motion: reduce)').matches||new URLSearchParams(location.search).get('motion')==='off'||
    !(userGesture||navigator.userActivation?.hasBeenActive||navigator.userActivation?.isActive))return false;
 const now=performance.now(),spreadId=spread===undefined?undefined:course+':'+spread;
 if(name==='page-turn'&&(now-lastTurn<120||spreadId!==undefined&&spreadId===lastSpread))return false;
 try{
  const Context=window.AudioContext||window.webkitAudioContext;
  if(!audio){if(!Context)return false;audio=new Context();}
  if(audio.state==='closed')return false;
  if(audio.state==='suspended')audio.resume()?.catch(()=>{});
  if(!noiseBuffer){
   noiseBuffer=audio.createBuffer(1,Math.ceil(audio.sampleRate*.4),audio.sampleRate);
   const data=noiseBuffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
  }
  const recipe=PAPER_SOUNDS[name],t=audio.currentTime,out=audio.createGain();out.gain.value=volume;out.connect(audio.destination);
  let playing=2;
  const end=nodes=>()=>{for(const node of nodes)node.disconnect();if(!--playing)out.disconnect();};
  const envelope=(gain,peak,duration)=>{gain.setValueAtTime(0,t);gain.linearRampToValueAtTime(peak,t+.008);gain.exponentialRampToValueAtTime(.0001,t+duration);};
  const paper=audio.createBufferSource(),filter=audio.createBiquadFilter(),paperGain=audio.createGain();
  paper.buffer=noiseBuffer;filter.type='bandpass';filter.Q.value=.7;
  filter.frequency.setValueAtTime(recipe.frequency,t);filter.frequency.exponentialRampToValueAtTime(recipe.end,t+recipe.duration);
  envelope(paperGain.gain,recipe.noise,recipe.duration);
  paper.connect(filter).connect(paperGain).connect(out);paper.onended=end([paper,filter,paperGain]);paper.start(t);paper.stop(t+recipe.duration+.02);
  const body=audio.createOscillator(),bodyGain=audio.createGain();body.type='sine';
  body.frequency.setValueAtTime(recipe.thump,t);body.frequency.exponentialRampToValueAtTime(recipe.thump*.45,t+recipe.duration);
  envelope(bodyGain.gain,recipe.body,recipe.duration);
  body.connect(bodyGain).connect(out);body.onended=end([body,bodyGain]);body.start(t);body.stop(t+recipe.duration+.02);
  if(name==='page-turn'){lastTurn=now;lastSpread=spreadId;}
  return true;
 }catch{return false;}
}
export function haptic(pattern=12){if(!motionAllowed())return;try{navigator.vibrate?.(pattern);}catch{}}
