import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createRouter,routeForURL} from '../assets/app/router.mjs';
import {bootDocument} from '../assets/app/route-boot.mjs';
const require=createRequire(import.meta.url);
const {JSDOM}=require('../tools/ui-build/node_modules/jsdom');
let api;
try{api=await import('../assets/app/transition.mjs');}catch(error){if(error.code!=='ERR_MODULE_NOT_FOUND')throw error;}
const need=()=>{assert.ok(api,'Task I transition controller exists');return api;};
const gate=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const until=async(fn)=>{const start=Date.now();while(!fn()){assert.ok(Date.now()-start<2500,'operation reached the expected boundary');await new Promise(r=>setTimeout(r,2));}};
const html=route=>`<!doctype html><title>${route}</title><script type="module" data-route-module src="/view.mjs"></script><body ${route==='desk'?'data-page="desk"':`data-course="${route}"`}><a class="skip-link" href="#heading">Skip</a><main data-route-region><h1 id="heading">${route}</h1></main></body>`;
function environment(url='https://guide.test/tmu-course-guides/'){
 const dom=new JSDOM(html('desk'),{url,pretendToBeVisual:true}),{window}=dom;
 const media=new window.EventTarget();media.matches=false;window.matchMedia=()=>media;
 let x=0,y=0;Object.defineProperties(window,{scrollX:{get:()=>x},scrollY:{get:()=>y}});window.scrollTo=(a,b)=>{x=a;y=b;};
 return {dom,window,media};
}
function standalone(t,options={}){
 const f=environment(),controller=need().createTransitionController({window:f.window,...options});
 t.after(()=>{controller.dispose();f.window.close();});
 function depart({from='desk',to='mth140',url='https://guide.test/tmu-course-guides/mth140/',signal=new f.window.AbortController().signal,...extra}={}){
  const waits=[],detail={from,route:to,url,signal,origin:need().transitionOrigin(f.window),waitUntil:p=>waits.push(p),...extra};
  f.window.document.dispatchEvent(new f.window.CustomEvent('route-will-change',{cancelable:true,detail}));
  return {detail,done:Promise.all(waits),arrival:opts=>controller.consumeArrival({url,signal,...opts})};
 }
 return {...f,controller,depart};
}
function fixture(t,{fetch:customFetch,url,base='https://guide.test/tmu-course-guides/'}={}){
 const f=environment(url||base),mounts=[],events=[],fallbacks=[],fetches=[];
 const reply=href=>({ok:true,url:href,text:async()=>html(routeForURL(href,new URL(base)))});
 const router=createRouter({window:f.window,moduleURL:new URL('assets/app/router.mjs',base).href,autoPrefetch:false,loadStylesheet:async()=>{},
  fetch:async href=>{fetches.push(href);return customFetch?customFetch(href,reply):reply(href);},
  importModule:async()=>({mount:ctx=>{mounts.push(ctx);},unmount(){}}),assign:href=>fallbacks.push(href)});
 router.start();f.window.document.addEventListener('route-changed',e=>events.push(e.detail));
 t.after(()=>{router.stop();f.window.close();});
 return {...f,router,mounts,events,fetches,fallbacks,controller:()=>need().getTransitionController(f.window),
  register:definition=>need().registerTransition(definition,{window:f.window})};
}
const definition=(run,extra={})=>({name:'test-move',from:'*',to:'*',run,...extra});

test('registration validates descriptors, chooses one most-specific match and unregisters safely',t=>{
 const f=standalone(t),run=async()=>{};
 f.controller.registerTransition(definition(run,{name:'fallback'}));
 const remove=f.controller.registerTransition(definition(run,{name:'dive',from:'desk',to:'course'}));
 assert.equal(f.controller.match('desk','mth140').name,'dive');
 assert.equal(f.controller.match('desk','cen100').name,'dive');
 assert.equal(f.controller.match('mth141','desk').name,'fallback');
 const replacement=f.controller.registerTransition(definition(run,{name:'dive',from:'desk',to:'course'}));
 remove();assert.equal(f.controller.match('desk','mth141').name,'dive','old disposer cannot remove replacement');
 replacement();replacement();assert.equal(f.controller.match('desk','mth140').name,'fallback');
 assert.equal(f.controller.match('external','desk'),null);
 for(const invalid of [{},{name:'x',from:'desk',to:'course'},{name:'x',from:'nope',to:'*',run}])assert.throws(()=>f.controller.registerTransition(invalid),TypeError);
});

test('motion policy prioritizes off, pause and holds, then OS reduce, with no storage writes',t=>{
 const f=standalone(t),{window,media}=f,policy=options=>need().transitionPolicy({window,...options});
 assert.equal(policy(),'full');media.matches=true;assert.equal(policy(),'fade');
 window.GuideMotion={preference:()=>({full:true}),motionAllowed:()=>true,sceneMotionAllowed:()=>true};
 assert.equal(policy({url:'https://guide.test/?motion=full'}),'fade','OS reduce wins even with explicit full');
 assert.equal(policy({url:'https://guide.test/?motion=off'}),'cut');
 assert.equal(policy({fromURL:'https://guide.test/?motion=off'}),'cut');
 for(const preference of [{paused:true},{scenePaused:true},{forced:true}]){window.GuideMotion.preference=()=>preference;assert.equal(policy(),'cut');}
 window.GuideMotion.preference=()=>({});window.document.documentElement.classList.add('ns-held');assert.equal(policy(),'cut');
 window.document.documentElement.classList.remove('ns-held');media.matches=false;window.GuideMotion.motionAllowed=()=>false;assert.equal(policy(),'cut');
 window.GuideMotion.motionAllowed=()=>true;window.GuideMotion.sceneMotionAllowed=()=>false;assert.equal(policy(),'cut');
 delete window.GuideMotion;window.localStorage.setItem('guide-motion-paused','true');assert.equal(policy(),'cut');
 assert.equal(window.localStorage.length,1);assert.equal(window.localStorage.getItem('guide-motion-paused'),'true');
});

test('origin snapshots an element rect and defaults to the viewport centre',t=>{
 const {window}=standalone(t),a=window.document.createElement('a');
 a.getBoundingClientRect=()=>({left:12,top:24,width:48,height:60});
 assert.deepEqual(need().transitionOrigin(window,a),{x:12,y:24,left:12,top:24,right:60,bottom:84,width:48,height:60});
 const origin=need().transitionOrigin(window);assert.equal(origin.x,window.innerWidth/2);assert.equal(origin.y,window.innerHeight/2);assert.equal(origin.width,0);
 assert.deepEqual(need().transitionOrigin(window,{left:NaN}),origin);
});

test('outgoing animation overlaps document fetching and hands its pose to all incoming mounts and shell event',async t=>{
 const network=gate(),animation=gate(),calls=[];
 const f=fixture(t,{fetch:async(href,reply)=>{await network.promise;return reply(href);}});
 f.register(definition(ctx=>{calls.push(ctx);return animation.promise;},{from:'desk',to:'course'}));
 const move=f.router.navigate('mth140/');await until(()=>f.fetches.length&&calls.length);
 assert.equal(f.mounts.length,0);assert.equal(f.router.route,'desk');
 network.resolve();await new Promise(r=>setTimeout(r,10));assert.equal(f.mounts.length,0,'ready document waits for bounded animation');
 animation.resolve({pose:{cover:.65}});assert.equal(await move,true);
 assert.deepEqual(f.mounts[0].transition,{continuing:true,pose:{cover:.65}});
 assert.deepEqual(f.events[0].transition,f.mounts[0].transition);assert.deepEqual(f.fallbacks,[]);
 assert.deepEqual([calls[0].from,calls[0].to,calls[0].policy,calls[0].history],['desk','mth140','full','push']);
 assert.deepEqual(f.controller().consumeArrival({url:f.window.location.href}),{continuing:false},'handoff is one-shot');
});

test('the hard cap aborts a non-cooperating animation; late resolution cannot create a handoff',async t=>{
 const f=standalone(t,{maxDuration:20}),late=gate();let ctx;
 f.controller.registerTransition(definition(value=>{ctx=value;return late.promise;}));
 const start=Date.now(),move=f.depart();await move.done;
 assert.ok(Date.now()-start<500);assert.equal(ctx.signal.aborted,true);assert.deepEqual(move.arrival(),{continuing:false});
 late.resolve({pose:{late:true}});await Promise.resolve();assert.deepEqual(move.arrival(),{continuing:false});
});

test('the default navigation cap is 1200 ms even when an animation never settles',async t=>{
 const f=fixture(t);let ctx;f.register(definition(value=>{ctx=value;return new Promise(()=>{});}));
 const start=Date.now();assert.equal(await f.router.navigate('mth140/'),true);
 assert.ok(Date.now()-start<2000,'navigation cannot wait indefinitely');assert.equal(ctx.duration,1200);assert.equal(ctx.signal.aborted,true);
 assert.deepEqual(f.mounts[0].transition,{continuing:false});assert.deepEqual(f.fallbacks,[]);
});

test('reduced motion passes a 150 ms fade budget and aborts a longer fade',async t=>{
 const f=standalone(t);f.media.matches=true;let ctx;
 f.controller.registerTransition(definition(value=>{ctx=value;return new Promise(()=>{});}));
 const start=Date.now(),move=f.depart();await move.done;
 assert.equal(ctx.policy,'fade');assert.equal(ctx.duration,150);assert.ok(Date.now()-start<500);assert.equal(ctx.signal.aborted,true);
});

test('failed scene animations never force a reload or block semantic navigation',async t=>{
 for(const run of [()=>{throw Error('scene failed');},()=>Promise.reject(Error('scene failed'))]){
  const f=fixture(t);f.register(definition(run));assert.equal(await f.router.navigate('cen100/'),true);
  assert.deepEqual(f.fallbacks,[]);assert.deepEqual(f.mounts[0].transition,{continuing:false});
 }
});

test('cut skips animation callbacks, including an off destination and saved pause',async t=>{
 for(const mode of ['query','destination','paused','held']){
  const f=fixture(t,{url:'https://guide.test/tmu-course-guides/'+(mode==='query'?'?motion=off':'')});let calls=0;
  if(mode==='paused')f.window.GuideMotion={preference:()=>({scenePaused:true})};
  if(mode==='held')f.window.document.documentElement.classList.add('ns-held');
  f.register(definition(()=>{calls++;return new Promise(()=>{});}));
  assert.equal(await f.router.navigate('mth140/'+(mode==='destination'?'?motion=off':'')),true);
  assert.equal(calls,0,mode);assert.deepEqual(f.mounts[0].transition,{continuing:false});
 }
});

test('a second navigation aborts the first signal and never transfers its late pose',async t=>{
 const f=fixture(t),late=gate(),calls=[];
 f.register(definition(ctx=>{calls.push(ctx);return ctx.to==='mth140'?late.promise:Promise.resolve({pose:{course:ctx.to}});}));
 const first=f.router.navigate('mth140/');await until(()=>calls.length===1);
 const second=f.router.navigate('cen100/');assert.equal(calls[0].signal.aborted,true);
 assert.equal(await first,false);assert.equal(await second,true);late.resolve({pose:{course:'wrong'}});await Promise.resolve();
 assert.equal(f.router.route,'cen100');assert.deepEqual(f.mounts[0].transition.pose,{course:'cen100'});assert.deepEqual(f.fallbacks,[]);
});

test('pagehide aborts both animation and pending navigation before a swap',async t=>{
 const f=fixture(t);let ctx;f.register(definition(value=>{ctx=value;return new Promise(()=>{});}));
 const move=f.router.navigate('mth140/');await until(()=>ctx);f.window.dispatchEvent(new f.window.Event('pagehide'));
 assert.equal(ctx.signal.aborted,true);assert.equal(await move,false);assert.equal(f.router.route,'desk');assert.equal(f.mounts.length,0);
});

test('Back/Forward plays the matching reverse/dive without disturbing focus, hashes or scroll',async t=>{
 const f=fixture(t),calls=[];f.register(definition(ctx=>{calls.push(ctx);return Promise.resolve({pose:{to:ctx.to}});}));
 f.window.scrollTo(0,180);await f.router.navigate('mth140/');f.window.scrollTo(0,420);
 const changed=()=>new Promise(r=>f.window.document.addEventListener('route-changed',r,{once:true}));
 let change=changed();f.window.history.back();await change;assert.equal(f.router.route,'desk');assert.equal(f.window.scrollY,180);
 change=changed();f.window.history.forward();await change;assert.equal(f.router.route,'mth140');assert.equal(f.window.scrollY,420);
 assert.deepEqual(calls.map(({from,to,history})=>[from,to,history]),[['desk','mth140','push'],['mth140','desk','pop'],['desk','mth140','pop']]);
 assert.equal(f.window.document.activeElement.id,'heading');assert.deepEqual(f.fallbacks,[]);
});

test('Back during an unfinished outgoing move aborts it, then restores the visited Desk',async t=>{
 const f=fixture(t);await f.router.navigate('mth140/');let ctx;
 f.register(definition(value=>{ctx=value;return value.to==='mth141'?new Promise(()=>{}):Promise.resolve({pose:{to:value.to}});}));
 const unfinished=f.router.navigate('../mth141/');await until(()=>ctx?.to==='mth141');const old=ctx;
 const changed=new Promise(r=>f.window.document.addEventListener('route-changed',r,{once:true}));f.window.history.back();await changed;
 assert.equal(old.signal.aborted,true);assert.equal(await unfinished,false);assert.equal(f.router.route,'desk');assert.deepEqual(f.fallbacks,[]);
});

test('policy changes abort an in-flight move and invalidate a completed but unconsumed pose',async t=>{
 for(const kind of ['pause','hold','reduced']){
  const f=standalone(t);let ctx;f.controller.registerTransition(definition(value=>{ctx=value;return new Promise(()=>{});}));
  const move=f.depart();await until(()=>ctx);
  if(kind==='pause'){f.window.GuideMotion={preference:()=>({scenePaused:true})};f.window.document.dispatchEvent(new f.window.Event('guide-motion-change'));}
  if(kind==='hold')f.window.document.dispatchEvent(new f.window.CustomEvent('night-hold',{detail:true}));
  if(kind==='reduced'){f.media.matches=true;f.media.dispatchEvent(new f.window.Event('change'));}
  await move.done;assert.equal(ctx.signal.aborted,true,kind);assert.deepEqual(move.arrival(),{continuing:false});
 }
 const f=standalone(t);f.controller.registerTransition(definition(async()=>({pose:{open:1}})));const move=f.depart();await move.done;
 f.window.document.dispatchEvent(new f.window.CustomEvent('night-hold',{detail:true}));assert.deepEqual(move.arrival(),{continuing:false});
});

test('handoffs require the exact request, destination, freshness and a pose; no storage is needed',async t=>{
 let now=0;const f=standalone(t,{now:()=>now,maxAge:10});
 f.controller.registerTransition(definition(async()=>({pose:{open:.5}})));
 let move=f.depart();await move.done;now=11;assert.deepEqual(move.arrival(),{continuing:false});
 move=f.depart();await move.done;assert.deepEqual(move.arrival({url:'https://guide.test/elsewhere/'}),{continuing:false});
 move=f.depart();await move.done;assert.deepEqual(move.arrival({signal:new f.window.AbortController().signal}),{continuing:false});
 move=f.depart();await move.done;assert.deepEqual(move.arrival({direct:true}),{continuing:false});
 f.controller.registerTransition(definition(async()=>undefined));move=f.depart();await move.done;assert.deepEqual(move.arrival(),{continuing:false});
 assert.equal(f.window.localStorage.length,0);assert.equal(f.window.sessionStorage.length,0);
});

test('direct loads deliver continuing:false and never add a cover or consume legacy storage',async t=>{
 need();const {window}=environment('https://guide.test/tmu-course-guides/'),mounts=[];
 window.sessionStorage.setItem('tmu-guide-book-dive-v1',JSON.stringify({pose:{open:1},timestamp:Date.now()}));
 const router=await bootDocument({window,autoPrefetch:false,moduleURL:'https://guide.test/tmu-course-guides/assets/app/router.mjs',importModule:async()=>({mount:ctx=>mounts.push(ctx),unmount(){}})});
 t.after(()=>{router.stop();window.close();});assert.equal(mounts[0].direct,true);assert.deepEqual(mounts[0].transition,{continuing:false});
 assert.equal(window.document.querySelectorAll('main').length,1);assert.equal(window.document.querySelector('main').hidden,false);
 assert.equal(window.document.querySelector('[data-transition-cover],.transition-cover,.book-dive-cover'),null);
 assert.equal(window.document.body.children.length,2,'no overlay or loading gate is created');assert.equal(window.sessionStorage.length,1);
});

test('native clicks capture a pointer rect; keyboard and palette navigation use the centre',async t=>{
 const f=fixture(t),calls=[];f.register(definition(ctx=>{calls.push(ctx);return Promise.resolve();}));
 const a=f.window.document.createElement('a');a.href='mth140/';a.getBoundingClientRect=()=>({left:10,top:20,width:40,height:50});f.window.document.body.append(a);
 a.dispatchEvent(new f.window.MouseEvent('click',{bubbles:true,cancelable:true,button:0,detail:1}));await until(()=>f.events.length===1);assert.equal(calls[0].origin.left,10);
 await f.router.navigate('../');assert.equal(calls[1].origin.x,f.window.innerWidth/2);
 const keyboard=f.window.document.createElement('a');keyboard.href='cen100/';f.window.document.body.append(keyboard);keyboard.click();await until(()=>f.events.length===3);
 assert.equal(calls[2].origin.x,f.window.innerWidth/2);assert.equal(calls[2].origin.width,0);
});

test('modified/new-tab/download/external clicks and same-route hashes do not invoke the controller',async t=>{
 const f=fixture(t);let calls=0;f.register(definition(async()=>{calls++;}));
 for(const [attributes,event] of [[{}, {ctrlKey:true}],[{}, {metaKey:true}],[{}, {shiftKey:true}],[{}, {altKey:true}],[{}, {button:1}],[{target:'_blank'},{}],[{download:''},{}],[{rel:'external'},{}],[{href:'https://external.test/'},{}],[{href:'#heading'},{}]]){
  const a=f.window.document.createElement('a');a.href='mth140/';for(const [name,value] of Object.entries(attributes))a.setAttribute(name,value);f.window.document.body.append(a);
  // Prevent jsdom's native navigation only after observing whether the router intercepted it.
  let intercepted;a.addEventListener('click',e=>{intercepted=e.defaultPrevented;e.preventDefault();},{once:true});
  a.dispatchEvent(new f.window.MouseEvent('click',{bubbles:true,cancelable:true,button:0,...event}));assert.equal(intercepted,false);a.remove();
 }
 await Promise.resolve();assert.equal(calls,0);assert.equal(f.router.route,'desk');assert.equal(f.fetches.length,0);
});

test('a vetoed navigation never runs a scene or unmounts content',async t=>{
 const f=fixture(t);let calls=0;f.register(definition(async()=>{calls++;}));
 f.window.document.addEventListener('route-will-change',e=>e.preventDefault());assert.equal(await f.router.navigate('mth140/'),false);
 assert.equal(calls,0);assert.equal(f.router.route,'desk');assert.deepEqual(f.fallbacks,[]);
});
