import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import {createRouter,routeForURL} from '../assets/app/router.mjs';

/* Book scroll input, the palette's week jump and the route swap's focus (semester-book spec §6.4–§6.6, §6.9),
   in jsdom. The production scroll.mjs, palette.mjs and book-state.mjs run against a stub core and a
   ScrollTrigger fake that re-parents the pinned header the way the real one does: it wraps it in a
   .pin-spacer on create and on every refresh, and unwraps it on kill. jsdom blurs a focused node that moves,
   like a browser. Run after npm ci --prefix tools/ui-build. */
const require=createRequire(new URL('../tools/ui-build/package.json',import.meta.url));
const {JSDOM}=require('jsdom'),{build}=require('esbuild');
const root=new URL('..',import.meta.url).pathname;
// Match the production URL so the fixture publishes to the scrolling module's state.
const BOOK_STATE='./assets/book/book-state.mjs'+((await readFile(new URL('../assets/night/scroll.mjs',import.meta.url),'utf8')).match(/book\/book-state\.mjs(\?v=[^'"]+)/)?.[1]||'');
const turn=()=>new Promise(resolve=>setTimeout(resolve,0));
const settle=async(n=4)=>{for(let i=0;i<n;i++)await turn();};

const coreStub=`import {COURSES} from './assets/course-data.mjs';
const T=window.__core={holds:new Set(),motion:true,route:'mth140',tracks:new Map(),vendor:null};
export const VERSION='test',META={code:'MTH140'},TERM={start:'2026-09-08',end:'2026-12-21'};
export const escape=value=>String(value);
export const $=(selector,node=document)=>node.querySelector(selector),$$=(selector,node=document)=>[...node.querySelectorAll(selector)];
export const motionAllowed=()=>T.motion,sceneMotionAllowed=()=>T.motion,ambientAllowed=()=>false,onAmbient=()=>()=>{};
export const held=()=>T.holds.size>0;
export const hold=key=>{T.holds.add(key);document.dispatchEvent(new CustomEvent('night-hold',{detail:true}));};
export const release=key=>{if(T.holds.delete(key))document.dispatchEvent(new CustomEvent('night-hold',{detail:held()}));};
export const finePointer=matchMedia('(pointer:fine)');
export const atLeast=()=>true,onTier=()=>()=>{};
export const track=(key,fn)=>{if(!T.tracks.has(key))T.tracks.set(key,[]);T.tracks.get(key).push(fn);};
export const dispose=key=>{const list=T.tracks.get(key)||[];T.tracks.delete(key);for(const fn of list.reverse())fn();};
export const view=()=>'assignments',frames=()=>Promise.resolve();
export const vendor=()=>T.vendor?Promise.resolve(T.vendor):Promise.reject(Error('no vendor'));
export const route=()=>T.route,isMath=()=>true,courseData=()=>Promise.resolve(COURSES.mth140);
export const preference=()=>({scenePaused:false,forced:false}),soundEnabled=()=>false,setSound=()=>{},toggleMotion=()=>{},openItem=async()=>{};`;
const plugin={name:'fix-scroll',setup(b){
 b.onResolve({filter:/(^|\/)core\.mjs(\?|$)/},args=>args.importer.includes('/assets/night/')?{path:'core',namespace:'core'}:undefined);
 b.onLoad({filter:/.*/,namespace:'core'},()=>({contents:coreStub,resolveDir:root}));
 b.onLoad({filter:/night\/palette\.mjs$/},async args=>({contents:(await readFile(args.path,'utf8')).replaceAll('import.meta.url',JSON.stringify('https://guide.test/assets/night/palette.mjs')),loader:'js'}));
}};
let code;
const bundle=async()=>code??=(await build({stdin:{contents:`import * as scroll from './assets/night/scroll.mjs';import * as palette from './assets/night/palette.mjs';import * as book from '${BOOK_STATE}';window.T={scroll,palette,book};`,resolveDir:root,sourcefile:'fix-scroll.mjs'},bundle:true,write:false,format:'iife',logLevel:'silent',plugins:[plugin]})).outputFiles[0].text;

/* ScrollTrigger and GSAP, as far as the book pin uses them. */
function fakeVendor(w){
 const d=w.document,listeners={refreshInit:new Set(),refresh:new Set()},triggers=new Set(),log=[];
 const wrap=st=>{const spacer=d.createElement('div');spacer.className='pin-spacer';st.pin.replaceWith(spacer);spacer.append(st.pin);st.spacer=spacer;};
 const unwrap=st=>{if(st.spacer?.isConnected)st.spacer.replaceWith(st.pin);st.spacer=null;};
 const ScrollTrigger={
  create(vars){const st={vars,pin:vars.pin,start:0,end:1350,progress:0,kill(){triggers.delete(st);unwrap(st);log.push('kill');}};triggers.add(st);wrap(st);log.push('create');return st;},
  refresh(){for(const fn of [...listeners.refreshInit])fn();for(const st of triggers)unwrap(st);for(const st of triggers)wrap(st);for(const fn of [...listeners.refresh])fn();log.push('refresh');},
  addEventListener(type,fn){listeners[type]?.add(fn);},removeEventListener(type,fn){listeners[type]?.delete(fn);},update(){}
 };
 const gsap={ticker:{add(){},remove(){},lagSmoothing(){}},set(){},quickSetter:()=>()=>{},timeline:()=>({fromTo(){return this;},to(){return this;},progress(){}}),
  delayedCall(delay,fn){const call={killed:false,kill(){call.killed=true;}};w.setTimeout(()=>{if(!call.killed)fn();},0);return call;}};
 return {gsap,ScrollTrigger,SplitText:null,Lenis:null,log,triggers};
}

async function environment(t){
 const dom=new JSDOM(`<!doctype html><html><body data-course="mth140"><main class="math-wrap" data-route-region><header class="course-heading"><h1 id="course-title">Calculus I</h1><div class="header-art" data-book><canvas class="ns-stage"></canvas></div><div class="ns-rail"><button type="button" class="ns-tick" data-index="5">Week 6</button><button type="button" class="ns-week-today">Today</button></div></header><section id="panel-assessments"><button type="button" id="row">Quiz 2</button></section></main></body></html>`,{url:'https://guide.test/mth140/',runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window,d=w.document;
 const media=new Map();w.matchMedia=query=>{if(!media.has(query)){const list=new w.EventTarget();list.matches=/pointer:\s*fine|min-width/.test(query);list.media=query;media.set(query,list);}return media.get(query);};
 let y=0;Object.defineProperty(w,'scrollY',{configurable:true,get:()=>y});w.scrollTo=(a,b)=>{y=typeof a==='object'?a.top??y:b;};
 w.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};
 // A browser fires close from a queued task, after the code that closed the dialog has run.
 w.HTMLDialogElement.prototype.close=function(){if(!this.hasAttribute('open'))return;this.removeAttribute('open');w.setTimeout(()=>this.dispatchEvent(new w.Event('close')),0);};
 w.HTMLElement.prototype.scrollIntoView=()=>{};
 // jsdom treats no dialog as :modal. Make scroll.mjs's probe throw so it takes its 'dialog[open]' fallback,
 // as a browser without :modal does, and the modal 'sheet' hold behaves as in Chromium.
 const query=w.Document.prototype.querySelector;
 w.Document.prototype.querySelector=function(selector){if(String(selector).includes(':modal'))throw new w.DOMException('unsupported','SyntaxError');return query.call(this,selector);};
 try{w.eval(await bundle());}finally{w.Document.prototype.querySelector=query;}
 const vendor=w.__core.vendor=fakeVendor(w);
 await w.T.scroll.mount({});
 t.after(()=>{try{w.T.scroll.unmount();}catch{}w.close();});
 const setY=value=>{y=value;};
 return {w,d,vendor,core:w.__core,setY,scroll:w.T.scroll};
}
/* A book on the route, published the way course-header.mjs does it. */
function book({w,d},{policy=()=>'full',renderer='webgl2',index=5}={}){
 const {createBookState,attachBookState,setBookHost}=w.T.book;
 const state=createBookState({course:'mth140',weeks:Array.from({length:17},(_,i)=>({index:i})),today:index,policy});
 attachBookState(state);
 const header=d.querySelector('.course-heading'),slot=d.querySelector('.header-art');
 const controller={handoff:[],setHandoff(h){this.handoff.push(h);},metrics:()=>({pageWidthPx:150})};
 const host={state,header,slot,controller,renderer};
 setBookHost(host);
 return {state,header,slot,controller,host,publish:changes=>setBookHost({...host,...changes})};
}

test('the pin keeps a focused rail control focused when it binds, refreshes and unbinds',async t=>{
 const env=await environment(t),{d,vendor}=env,tick=d.querySelector('.ns-tick'),row=d.querySelector('#row');
 tick.focus();assert.equal(d.activeElement,tick);
 const b=book(env);
 assert.equal(d.documentElement.dataset.bookPin,'on');assert.ok(d.querySelector('.pin-spacer>.course-heading'),'the pin wraps the header');
 assert.equal(d.activeElement,tick,'binding the pin (book ready) keeps focus on the week');
 vendor.ScrollTrigger.refresh();
 assert.equal(d.activeElement,tick,'a refresh (resize, zoom, completion) keeps focus on the week');
 const today=d.querySelector('.ns-week-today');today.focus();vendor.ScrollTrigger.refresh();
 assert.equal(d.activeElement,today,'any control in the header');
 row.focus();vendor.ScrollTrigger.refresh();
 assert.equal(d.activeElement,row,'focus outside the header is never moved');
 row.blur();vendor.ScrollTrigger.refresh();
 assert.equal(d.activeElement,d.body,'nothing focused stays that way');
 tick.focus();
 b.publish({renderer:'poster'}); // context loss, shader failure or a tier drop: the pin goes
 assert.equal(d.documentElement.dataset.bookPin,undefined);assert.equal(d.querySelector('.pin-spacer'),null);
 assert.equal(d.activeElement,tick,'unbinding the pin keeps focus on the week');
 b.publish({renderer:'webgl2'});
 assert.equal(d.documentElement.dataset.bookPin,'on');assert.equal(d.activeElement,tick,'and so does binding it again');
});

test('a pin that becomes possible below its start waits until the reader is back above it',async t=>{
 const env=await environment(t),{d,w,vendor,core,setY}=env,scrollTo=y=>{setY(y);w.dispatchEvent(new w.Event('scroll'));};
 setY(500);
 const b=book(env);
 assert.equal(vendor.log.includes('create'),false,'no spacer lands above the page being read');assert.equal(d.documentElement.dataset.bookPin,undefined);
 scrollTo(300);assert.equal(vendor.log.includes('create'),false);
 scrollTo(0);
 assert.deepEqual(vendor.log.filter(entry=>entry==='create'),['create'],'back at the top, the pin binds');assert.equal(d.documentElement.dataset.bookPin,'on');
 scrollTo(600);scrollTo(0);assert.equal(vendor.log.filter(entry=>entry==='create').length,1,'the wait listener is gone');
 // Pause motion (the pin goes), scroll down, then Play: still no rebind below the start.
 core.motion=false;d.dispatchEvent(new w.CustomEvent('guide-motion-change'));
 assert.equal(d.documentElement.dataset.bookPin,undefined);
 setY(500);core.motion=true;d.dispatchEvent(new w.CustomEvent('guide-motion-change'));
 assert.equal(vendor.log.filter(entry=>entry==='create').length,1,'Play below the pin start waits');
 // A wait the pin no longer wants is dropped: pausing again, then scrolling to the top binds nothing.
 core.motion=false;d.dispatchEvent(new w.CustomEvent('guide-motion-change'));
 scrollTo(0);assert.equal(vendor.log.filter(entry=>entry==='create').length,1);
 core.motion=true;d.dispatchEvent(new w.CustomEvent('guide-motion-change'));
 assert.equal(vendor.log.filter(entry=>entry==='create').length,2,'at the top, Play binds at once');
 assert.equal(b.state.snapshot().index,5);
});

test('scrolling back up after a teleport past the pin keeps the selected week; the next pass turns forward',async t=>{
 const {forward,relative,rebase}=(await environment(t)).scroll;
 for(const offset of [0,.5,1,1.5,2])assert.equal(relative(offset,forward(2)),0,'no turn behind the anchor at offset '+offset);
 assert.equal(relative(1.5,forward(.5)),.5,'a mid-pin rebase still turns forward');
 assert.deepEqual({...forward(1.4)},{lo:0,hi:2});assert.deepEqual({...rebase(1.4)},{lo:1,hi:2},'rebase itself is unchanged');
 const env=await environment(t),{d,w,vendor}=env,b=book(env),[st]=vendor.triggers;
 const at=p=>st.vars.onUpdate({progress:p});
 d.dispatchEvent(new w.CustomEvent('night-teleport'));at(1); // Skip to coursework, a hash load, a command below the pin
 for(let p=.95;p>-.01;p-=.05){at(Math.max(0,p));const s=b.state.snapshot();assert.deepEqual([s.index,s.turn],[5,5],'scrolling up at p='+p.toFixed(2));}
 for(let p=.05;p<.46;p+=.05)at(p);
 assert.deepEqual([b.state.snapshot().index,b.state.snapshot().turn],[6,6],'down again from the top turns forward from week 6');
});

const swipe=({w},{slot},points,{lost='canvas'}={})=>{
 const canvas=slot.querySelector('canvas'),fire=(target,type,x)=>target.dispatchEvent(new w.PointerEvent(type,{bubbles:true,cancelable:true,pointerId:1,pointerType:'touch',isPrimary:true,clientX:x,clientY:120}));
 fire(canvas,'pointerdown',points[0]);fire(canvas,'pointermove',points[1]);
 // The slot takes capture from the canvas that touch implicitly captured: the canvas's lostpointercapture bubbles.
 if(lost)fire(lost==='canvas'?canvas:slot,'lostpointercapture',points[1]);
 for(const x of points.slice(2))fire(canvas,'pointermove',x);
 fire(slot,'pointerup',points.at(-1));
};
test('a touch swipe on the stage turns exactly one week, forward or back',async t=>{
 const env=await environment(t),b=book(env);
 swipe(env,b,[330,300,200,60]);
 assert.deepEqual([b.state.snapshot().index,b.state.snapshot().turn,b.state.snapshot().lock],[6,6,null],'270 px left: the next week, not two');
 swipe(env,b,[60,90,200,330]);swipe(env,b,[60,90,200,330]);
 assert.equal(b.state.snapshot().index,4,'two swipes right: two weeks back, one each');
 // The slot losing its own capture still cancels: the paper settles where it was.
 swipe(env,b,[330,300],{lost:'slot'});
 assert.deepEqual([b.state.snapshot().index,b.state.snapshot().turn],[4,4]);
});
test('the discrete swipe (reduced motion) also survives the canvas losing its implicit capture',async t=>{
 const env=await environment(t),b=book(env,{policy:()=>'fade'});
 swipe(env,b,[330,300,200,60]);
 assert.equal(b.state.snapshot().index,6);
});

test('a palette week jump turns in full motion: the modal hold is gone before book-open-week',async t=>{
 const env=await environment(t),{d,w,core}=env,animations=[],seen=[];
 const b=book(env,{policy:()=>core.holds.size?'cut':'full'});
 b.state.setAnimator({animate:(from,to,options)=>{animations.push([from,to,options.mode]);return Promise.resolve();},cancel(){}});
 d.addEventListener('book-open-week',event=>seen.push([event.detail.index,[...core.holds]]),true);
 const palette=await w.T.palette.mount();
 palette.open();await settle();
 assert.deepEqual([...core.holds].sort(),['palette','sheet'],'the open palette holds the page');
 const input=d.querySelector('#ns-palette-input');input.value='week 9';input.dispatchEvent(new w.Event('input'));
 assert.match(d.querySelector('[role="option"][aria-selected="true"]').textContent,/^Week 9/);
 input.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));
 await settle();
 assert.deepEqual(seen,[[8,[]]],'dispatched once, with no hold left');
 assert.deepEqual(animations,[[5,8,'full']],'the book turns instead of cutting');
 assert.equal(b.state.snapshot().index,8);
});

test('a router swap to MTH140 focuses the route heading; the Skip link keeps #panel-assessments',async()=>{
 const page=(route,skip,main)=>`<!doctype html><html><head><title>${route}</title><script type="module" data-route-module src="modules/${route}.mjs"></script></head><body ${route==='desk'?'data-page="desk"':`data-course="${route}"`}><a class="skip-link" href="${skip}">Skip</a>${main}</body></html>`;
 const docs={
  desk:page('desk','#desk-main','<main data-route-region id="desk-main"><h1>Desk</h1><a href="mth140/">MTH140</a></main>'),
  mth140:page('mth140','#panel-assessments','<main data-route-region id="math-main"><header class="course-heading"><h1 id="course-title">Calculus I</h1></header><section id="panel-assessments"><h2>Assessments</h2><details><summary>Lab Quiz 2</summary></details></section></main>'),
  mth141:page('mth141','#math-main','<main data-route-region id="math-main"><h1>Linear Algebra</h1><section id="panel-assessments"></section></main>')
 };
 const dom=new JSDOM(docs.desk,{url:'https://guide.test/',pretendToBeVisual:true}),w=dom.window,base=new URL('https://guide.test/'),fallbacks=[];
 let y=0;Object.defineProperty(w,'scrollY',{configurable:true,get:()=>y});w.scrollTo=(a,b)=>{y=typeof a==='object'?a.top||0:b;};
 const router=createRouter({window:w,moduleURL:'https://guide.test/assets/app/router.mjs',autoPrefetch:false,assign:url=>fallbacks.push(url),loadStylesheet:async()=>{},
  importModule:async()=>({mount(){},unmount(){}}),fetch:async url=>({ok:true,url,text:async()=>docs[routeForURL(url,base)]})});
 router.start();
 try{
  const moved=await router.navigate('mth140/');assert.deepEqual(fallbacks,[]);assert.equal(moved,true);
  const d=w.document;
  assert.equal(d.activeElement.id,'course-title','the heading at the top of the new page, not coursework below the fold');
  assert.equal(new URL(d.querySelector('body > .skip-link').href).hash,'#panel-assessments');assert.equal(w.scrollY,0);
  assert.equal(await router.navigate('../mth141/'),true);
  assert.equal(d.activeElement,d.querySelector('main[data-route-region]'),'a Skip target that is the region itself still takes focus');
 }finally{router.stop();w.close();}
});
