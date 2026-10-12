/* Night Shift runtime: shared state for the layer that sits on top of the existing guide modules.
   Services start once; view-bound effects register disposers and are rebuilt per view. */
export {timestamp,clock,dateLabel,dayLabel,today,addDays,resolveAssessment,timing} from '../schedule.mjs';
import {loadData} from './targets.mjs';

export const VERSION='20261012-night2';
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
 const workspace=window.CourseWorkspace;
 const id=isMath()?String(target).replace(/^assessment-/,''):String(target);
 const node=isMath()?document.getElementById('assessment-'+id):document.getElementById('guide-item-'+id);
 const sheet=$('.detail-sheet');
 if(sheet?.open&&node&&sheet.contains(node)){sheet.querySelector('.sheet-close')?.focus();return;}
 workspace?.show('assignments');
 const hide=$('#hide-completed');
 if(hide?.checked&&node&&!node.getClientRects().length){hide.checked=false;hide.dispatchEvent(new Event('change',{bubbles:true}));}
 if(node?.closest('.past')&&!document.body.classList.contains('workspace-show-past')){const past=$('#workspace-show-past');if(past){past.checked=true;past.dispatchEvent(new Event('change',{bubbles:true}));}}
 await frames(2);
 window.GuideMotion?.cancel(document.querySelector('.wrap,.math-wrap'));
 document.dispatchEvent(new CustomEvent('course-open-item',{detail:isMath()?'assessment-'+id:id}));
}
export const frames=(n=1)=>new Promise(resolve=>{const step=k=>k?requestAnimationFrame(()=>step(k-1)):resolve();step(n);});

/* Temporary holds pause ambient motion without touching the saved preference. */
const holds=new Set();
export function hold(reason){holds.add(reason);document.dispatchEvent(new CustomEvent('night-hold',{detail:held()}));}
export function release(reason){holds.delete(reason);document.dispatchEvent(new CustomEvent('night-hold',{detail:held()}));}
export const held=()=>holds.size>0;
/* Ambient = loops that run on their own (backdrop, marquee, pulses). Pause motion stops them all. */
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
   high: everything, full frame rate. mid: 30 fps backdrop at reduced resolution, no skew or cursor trail.
   low: static CSS aurora, no canvas, no smooth scroll or custom cursor.
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
 const existing=document.querySelector(`link[data-night="${name}"]`);if(existing)return Promise.resolve(existing);
 return new Promise(resolve=>{const link=document.createElement('link');link.rel='stylesheet';link.href=href;link.dataset.night=name;link.onload=link.onerror=()=>resolve(link);document.head.append(link);});
}

/* Small synthesised sound + haptics service, opt-in (tmu-guide-sound-v1). Shared so every feature
   uses one AudioContext. */
const SOUND_KEY='tmu-guide-sound-v1';
let soundOn=read(SOUND_KEY,false)===true,audio=null;
export const soundEnabled=()=>soundOn;
export function setSound(on){soundOn=!!on;write(SOUND_KEY,soundOn);document.dispatchEvent(new CustomEvent('night-sound',{detail:soundOn}));if(soundOn)play('tick');}
export function play(name){
 if(!soundOn||!motionAllowed())return;
 try{
  audio??=new (window.AudioContext||window.webkitAudioContext)();
  if(audio.state==='suspended')audio.resume();
  const t=audio.currentTime,out=audio.createGain();out.connect(audio.destination);
  const tone=(type,f0,f1,dur,peak,at=0)=>{const o=audio.createOscillator(),g=audio.createGain();o.type=type;o.frequency.setValueAtTime(f0,t+at);o.frequency.exponentialRampToValueAtTime(f1,t+at+dur);g.gain.setValueAtTime(0,t+at);g.gain.linearRampToValueAtTime(peak,t+at+.008);g.gain.exponentialRampToValueAtTime(.0001,t+at+dur);o.connect(g).connect(out);o.start(t+at);o.stop(t+at+dur+.02);};
  if(name==='tick')tone('square',2400,1800,.025,.035);
  else if(name==='pop')tone('sine',520,980,.11,.16);
  else if(name==='chime'){tone('sine',880,880,.5,.09);tone('sine',1318.5,1318.5,.6,.07,.07);tone('sine',1760,1760,.7,.05,.14);}
  else if(name==='whoosh'){const len=Math.floor(audio.sampleRate*.45),buf=audio.createBuffer(1,len,audio.sampleRate),d=buf.getChannelData(0);for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*Math.sin(Math.PI*i/len);const src=audio.createBufferSource(),f=audio.createBiquadFilter(),g=audio.createGain();src.buffer=buf;f.type='bandpass';f.Q.value=.9;f.frequency.setValueAtTime(300,t);f.frequency.exponentialRampToValueAtTime(3200,t+.4);g.gain.value=.12;src.connect(f).connect(g).connect(out);src.start(t);}
 }catch{}
}
export function haptic(pattern=12){if(!motionAllowed())return;try{navigator.vibrate?.(pattern);}catch{}}
