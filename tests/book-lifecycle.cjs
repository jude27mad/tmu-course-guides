/* Book stage and scene lifecycle (semester-book spec §3.3, §3.4, §5.9, §10.1). Run after
   npm ci --prefix tools/ui-build. jsdom with a WebGLRenderer shim: no GPU claims, only scheduling,
   gating, ownership and release. The engine runs for real (geometry, materials, popup.mjs sets, the
   animator); textures.mjs is replaced by a counting stub (jsdom has no 2D canvas) and GSAP by its ease
   formulas (importing the real core wakes its ticker, which the page shares with guide-motion). */
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {pathToFileURL}=require('node:url');
const {JSDOM}=require('../tools/ui-build/node_modules/jsdom'),esbuild=require('../tools/ui-build/node_modules/esbuild');
const root=path.resolve(__dirname,'..'),three=`${root}/tools/scene-build/node_modules/three`;
// The same URL the stage uses, so the test drives the one core instance (holds, tiers).
const CORE='./assets/night/core.mjs?v='+fs.readFileSync(path.join(root,'assets/night/core.mjs'),'utf8').match(/export const VERSION='([^']+)'/)[1];
// The stage and Three URLs the book modules import (esbuild keeps one module per URL, like the browser).
const STAGE='./assets/app/stage.mjs'+(fs.readFileSync(path.join(root,'assets/book/book-scene.mjs'),'utf8').match(/app\/stage\.mjs(\?v=[^'"]+)/)?.[1]||'');
const THREE='./assets/app/three.mjs'+(fs.readFileSync(path.join(root,'assets/book/book-scene.mjs'),'utf8').match(/app\/three\.mjs(\?v=[^'"]+)/)?.[1]||'');

const shim=`export * from '${three}/build/three.module.js';
import {Texture} from '${three}/build/three.module.js';
export {RoomEnvironment} from '${three}/examples/jsm/environments/RoomEnvironment.js';
export {ShaderPass} from '${three}/examples/jsm/postprocessing/ShaderPass.js';
export {UnrealBloomPass} from '${three}/examples/jsm/postprocessing/UnrealBloomPass.js';
export {RoundedBoxGeometry} from '${three}/examples/jsm/geometries/RoundedBoxGeometry.js';
export {mergeGeometries} from '${three}/examples/jsm/utils/BufferGeometryUtils.js';
export class WebGLRenderer{
 constructor({canvas,context}){window.counts.renderers++;this.domElement=canvas;this.context=context;this.debug={checkShaderErrors:false,onShaderError:null};
  this.info={autoReset:true,render:{calls:0,triangles:0},memory:{geometries:0,textures:0},programs:[],reset(){this.render.calls=0;this.render.triangles=0;}};
  this.shadowMap={enabled:false};this.toneMappingExposure=1;this.autoClear=true;this.pixelRatio=1;this.width=1;this.height=1;}
 setPixelRatio(v){this.pixelRatio=v;}getPixelRatio(){return this.pixelRatio;}setSize(w,h){this.width=w;this.height=h;}
 getClearColor(target){return target;}getClearAlpha(){return 0;}setClearColor(){}getRenderTarget(){return this.target??null;}setRenderTarget(t){this.target=t;}clear(){}
 render(object){this.info.render.calls++;this.info.render.triangles+=12;window.counts.draws++;if(object?.isScene)window.counts.sceneRenders++;
  if(window.failShader)this.debug.onShaderError?.(this.context,{},null,null);}
 dispose(){window.counts.rendererDisposals++;}forceContextLoss(){window.counts.contextLosses++;}compileAsync(){return Promise.resolve();}
}
export class PMREMGenerator{fromScene(){window.counts.environments++;return{texture:new Texture(),dispose(){window.counts.environmentDisposals++;}};}dispose(){}}`;
const gsapStub=`const p=k=>({in:t=>t**k,out:t=>1-(1-t)**k,inOut:t=>t<.5?(2*t)**k/2:1-(2*(1-t))**k/2});
const table={none:t=>t,linear:t=>t,'power1.out':p(2).out,'power1.in':p(2).in,'power2.in':p(3).in,'power2.out':p(3).out,'power2.inOut':p(3).inOut,
 'power3.out':p(4).out,'expo.out':t=>t>=1?1:1-2**(-10*t),'back.out(1.1)':t=>{const s=1.1,u=t-1;return 1+(s+1)*u*u*u+s*u*u;},
 'back.out(1.15)':t=>{const s=1.15,u=t-1;return 1+(s+1)*u*u*u+s*u*u;},'elastic.out(1, 0.5)':t=>t<=0?0:t>=1?1:2**(-10*t)*Math.sin((t*10-.75)*(2*Math.PI)/3)+1};
export const gsap={parseEase:name=>table[name]||(t=>t)};export const Flip={};`;
const plugin={name:'stage-renderer-fixture',setup(build){
 build.onResolve({filter:/vendor\/three-0\.186\.1/},()=>({path:'renderer',namespace:'renderer'}));
 build.onLoad({filter:/.*/,namespace:'renderer'},()=>({contents:shim,resolveDir:root}));
 build.onResolve({filter:/vendor\/gsap-3\.15\.0/},()=>({path:'gsap',namespace:'gsap'}));
 build.onLoad({filter:/.*/,namespace:'gsap'},()=>({contents:gsapStub,resolveDir:root}));
}};
let bundle;
async function script(){
 bundle??=(await esbuild.build({stdin:{contents:`import {probe,getStage} from '${STAGE}';
  import {mountBook,spreadLayout,framingFor,OPEN_HERO,turnPlan,motionMode} from './assets/book/book-scene.mjs';
  import * as T from '${THREE}';
  import * as core from '${CORE}';
  import * as books from './tests/fixtures/book-state-stub.mjs';
  window.book={probe,getStage,mountBook,spreadLayout,framingFor,OPEN_HERO,turnPlan,motionMode,core,books,T};`,resolveDir:root},
  plugins:[plugin],bundle:true,format:'iife',write:false,logLevel:'silent'})).outputFiles[0].text;
 return bundle;
}

async function fixture({gpu=true,query='?tier=high',width=1440}={}){
 const dom=new JSDOM('<body class="workspace" data-course="mth140"><main data-route-region><header class="course-heading"><div class="header-art"></div></header></main></body>',
  {url:'https://guide.test/mth140/'+query,pretendToBeVisual:true,runScripts:'outside-only'}),w=dom.window;
 w.counts={renderers:0,draws:0,sceneRenders:0,rendererDisposals:0,contextLosses:0,environments:0,environmentDisposals:0,contexts:0};
 const callbacks=new Map(),observers={io:new Set(),ro:new Set()},listeners=new Map();let id=0,now=1000,hidden=false,contextAttributes=null;
 w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
 w.requestAnimationFrame=fn=>{callbacks.set(++id,fn);return id;};w.cancelAnimationFrame=i=>callbacks.delete(i);
 Object.defineProperty(w,'innerWidth',{value:width,configurable:true});
 Object.defineProperty(w.document,'hidden',{get:()=>hidden,configurable:true});
 w.IntersectionObserver=class{constructor(fn,options){this.fn=fn;this.options=options;}observe(){observers.io.add(this);}disconnect(){observers.io.delete(this);}};
 w.ResizeObserver=class{constructor(fn){this.fn=fn;}observe(){observers.ro.add(this);}disconnect(){observers.ro.delete(this);}};
 if(gpu)w.WebGL2RenderingContext=class{};
 const gl={isContextLost:()=>false,getProgramInfoLog:()=>'ERROR: 0:1: fixture'};
 w.HTMLCanvasElement.prototype.getContext=function(type,attributes){if(type!=='webgl2'||!gpu)return null;w.counts.contexts++;contextAttributes=attributes;return gl;};
 for(const target of [w.document,w]){
  const add=target.addEventListener.bind(target),remove=target.removeEventListener.bind(target);
  target.addEventListener=(type,fn,options)=>{listeners.set(type,(listeners.get(type)||0)+1);return add(type,fn,options);};
  target.removeEventListener=(type,fn,options)=>{listeners.set(type,(listeners.get(type)||0)-1);return remove(type,fn,options);};
 }
 const warnings=[];w.console.warn=(...args)=>warnings.push(args.join(' '));
 w.eval(await script());
 const slot=w.document.querySelector('.header-art');
 slot.getBoundingClientRect=()=>({left:0,top:0,width,height:width<761?300:640,right:width,bottom:width<761?300:640,x:0,y:0});
 const flush=async()=>{for(let i=0;i<4;i++)await Promise.resolve();};
 return {w,dom,slot,gl,book:w.book,callbacks,observers,warnings,flush,
  get contextAttributes(){return contextAttributes;},
  listeners:type=>listeners.get(type)||0,
  pending:()=>callbacks.size,
  tick(elapsed=16.7){now+=elapsed;const run=[...callbacks.values()];callbacks.clear();for(const fn of run)fn(now);},
  setHidden(value){hidden=value;w.document.dispatchEvent(new w.Event('visibilitychange'));},
  intersect(isIntersecting,ratio=isIntersecting?1:0){for(const io of [...observers.io])io.fn([{isIntersecting,intersectionRatio:ratio}]);},
  close(){dom.window.close();}};
}

/* A scene controller that records what the stage asks of it. busy: frames left to report busy. */
function sceneController(busyFrames=0){
 const calls={resize:[],update:[],render:[]};let busy=busyFrames,rate=0;
 return {calls,set busy(v){busy=v;},set rate(v){rate=v;},
  resize(w,h,dpr){calls.resize.push([w,h,dpr]);},
  update(dt,gates){calls.update.push({dt,gates});if(busy===Infinity)return rate||true;if(busy>0){busy--;return rate||true;}return false;},
  render(renderer,post){calls.render.push(post);const scene={isScene:true};post?post.render(scene,{},{bloom:true,rect:[.3,.1,.9,.9]}):renderer.render(scene,{});},
  dispose(){}};
}

test('no WebGL2 or the low tier gives the poster controller with the whole §3.3 surface and no frame loop',async()=>{
 for(const [options,reason] of [[{gpu:false},'no-webgl2'],[{query:'?tier=low'},'tier-low']]){
  const f=await fixture(options);
  try{
   assert.deepEqual({...f.book.probe()},{ok:false,reason});
   const stage=f.book.getStage();assert.equal(stage.available,false);assert.equal(stage.renderer,null);assert.equal(typeof stage.attach(f.slot,sceneController()),'function');
   let fallback=null,event=null;f.slot.addEventListener('book-fallback',e=>{event=e.detail;});
   const controller=await f.book.mountBook(f.slot,{course:'mth140',onFallback:r=>{fallback=r;}});
   assert.equal(await controller.ready,'poster');assert.equal(fallback,reason);assert.deepEqual({...event},{reason});
   for(const name of ['metrics','setHandoff','setFocus','close','requestFrame','stats','dispose'])assert.equal(typeof controller[name],'function',name);
   assert.equal(f.slot.dataset.renderer,'poster');assert.equal(f.slot.dataset.rendererReason,reason);assert.equal(f.slot.dataset.sceneReady,'true');
   assert.equal(f.slot.querySelector('canvas'),null,'no canvas in the slot');
   for(let i=0;i<5;i++)f.tick();assert.equal(f.pending(),0,'no rAF');assert.equal(f.w.counts.renderers,0);
   controller.dispose();
  }finally{f.close();}
 }
});

test('the probe is cached, honours ?tier=, and the stage renderer reuses the probed context',async()=>{
 const plain=await fixture({query:''});
 try{plain.book.probe();assert.equal(plain.contextAttributes.failIfMajorPerformanceCaveat,true);assert.equal(plain.contextAttributes.antialias,true);assert.equal(plain.contextAttributes.alpha,true);}
 finally{plain.close();}
 const f=await fixture();
 try{
  assert.deepEqual({...f.book.probe()},{ok:true,reason:'ok'});f.book.probe();f.book.probe();
  assert.equal(f.w.counts.contexts,1,'one context for the document');
  assert.equal(f.contextAttributes.failIfMajorPerformanceCaveat,false,'?tier=high lets software renderers through');
  const stage=f.book.getStage();assert.equal(stage,f.book.getStage());assert.equal(f.w.counts.renderers,1);
  assert.equal(stage.renderer.context,f.gl);assert.equal(stage.canvas.getAttribute('aria-hidden'),'true');
  assert.equal(stage.renderer.debug.checkShaderErrors,true);assert.equal(stage.renderer.shadowMap.enabled,true);
 }finally{f.close();}
});

/* A counting stand-in for textures.mjs: one DataTexture per face id. */
function texturesStub(w,{log=[]}={}){
 return opts=>{
  const faces=new Map(),T=w.book.T;let paints=0,disposed=false;
  const face=id=>{if(!faces.has(id)){const t=new T.DataTexture(new Uint8Array(4),1,1);t.name=id;faces.set(id,t);}return faces.get(id);};
  return {ready:Promise.resolve(),opts,log,
   face,paint(id){paints++;log.push('paint:'+id);return face(id);},want(ids,o){log.push('want:'+ids.join()+(o?.prefetch?':prefetch':''));},pump:()=>false,
   refresh(){log.push('refresh');},setScreen:()=>false,setTier(t){log.push('tier:'+t);},labelSlot:()=>null,stamp:()=>null,
   paper:()=>({normal:null}),linen:()=>({}),cover:()=>null,hit:()=>({kind:'page',corner:false}),
   stats:()=>({faces:faces.size,paints,disposed}),dispose(){disposed=true;for(const t of faces.values())t.dispose();faces.clear();log.push('dispose');}};
 };
}
const QUIZ={id:'quiz-2',open:'assessment-quiz-2',kind:'quiz',kindLabel:'Quiz',title:'Lab Quiz 2',when:'Oct 12–Oct 16 · during your assigned lab',label:'Quiz week',
 cta:null,day:null,rowWhen:null,bracket:true,chip:'NEXT',urgency:'none',state:'week',completed:false,passed:false,status:null,rank:2};
const spreadView=(i,{done=false}={})=>({index:i,count:17,datedCount:16,kind:'teaching',partial:false,pending:false,kicker:'WEEK',numeral:String(i+1).padStart(2,'0'),of:'16',
 range:'',note:'Teaching week',relative:'',days:[],entries:i===5?[{...QUIZ,completed:done,chip:done?'DONE':'NEXT'}]:[],popups:i===5?['quiz-2']:[],more:0,aria:'',live:'',signature:`v${i}:${done}`});
async function mounted(f,{policy='full',today=5,views=spreadView}={}){
 const {createBookState}=f.book.books,weeks=Array.from({length:17},(_,i)=>({label:'w'+i}));
 const state=createBookState({course:'mth140',weeks,today,policy:()=>policy});
 const log=[],events=[];
 for(const type of ['book-ready','book-fallback','book-turn','book-hover'])f.slot.addEventListener(type,e=>events.push([type,e.detail]));
 const controller=await f.book.mountBook(f.slot,{course:'mth140',state,getView:i=>views(i),onOpen:id=>events.push(['open',id]),
  onFallback:r=>events.push(['fallback',r]),dockTarget:()=>null,arrival:{start:-1e9},createTextures:texturesStub(f.w,{log})});
 return {state,controller,log,events,base:0};
}
const settle=async(f,n=6)=>{for(let i=0;i<n;i++){f.tick();await f.flush();}};

test('mountBook builds the engine: ready is webgl2 after the first rendered frame, the slot dataset is honest',async()=>{
 const f=await fixture();
 try{
  const {state,controller,events,log}=await mounted(f);
  assert.equal(f.slot.querySelector('canvas'),f.book.getStage().canvas,'the one canvas moved into the slot');
  assert.equal(f.slot.dataset.sceneReady,undefined,'not ready before a frame renders');
  let ready=null;controller.ready.then(v=>{ready=v;});
  await settle(f,2);
  assert.equal(ready,'webgl2');assert.equal(f.slot.dataset.renderer,'webgl2');assert.equal(f.slot.dataset.sceneReady,'true');
  assert.deepEqual(events.filter(e=>e[0]==='book-ready').map(e=>e[1].renderer),['webgl2']);
  for(const key of ['tier','quality','post','sceneFrame','drawCalls','triangles','week','turn','awake','motionState','dragging','cursor'])assert.ok(key in f.slot.dataset,key);
  assert.equal(f.slot.dataset.week,'5');assert.equal(f.slot.dataset.post,'on');
  assert.ok(log.includes('paint:L5')&&log.includes('paint:R5'),'today\'s faces are painted before the first frame');
  assert.ok(f.w.counts.sceneRenders>=1);
  const stats=controller.stats();assert.equal(stats.renderer,'webgl2');assert.equal(stats.popups[0].index,5);assert.equal(stats.popups[0].visible,true);
  controller.dispose();
 }finally{f.close();}
});

test('the book sleeps: 0 rAF after settle, offscreen, hidden and held; cut mode renders one frame per change',async()=>{
 const f=await fixture();
 try{
  f.w.GuideMotion={motionAllowed:()=>false,sceneMotionAllowed:()=>false,preference:()=>({forced:true,reduced:false})};
  const {state,controller}=await mounted(f,{policy:'cut'});
  await settle(f,8);assert.equal(f.pending(),0,'0 rAF after settle');
  const before=f.w.counts.sceneRenders;
  await state.openWeek(9,{source:'control'});assert.equal(state.snapshot().turn,9,'cut: instant');
  await settle(f,4);assert.equal(f.w.counts.sceneRenders-before,1,'one frame for the change');assert.equal(f.pending(),0);
  assert.equal(f.slot.dataset.week,'9');
  f.intersect(false);controller.requestFrame();await settle(f,2);assert.equal(f.w.counts.sceneRenders-before,1,'offscreen: none');
  f.intersect(true);await settle(f,2);assert.equal(f.w.counts.sceneRenders-before,2,'one on wake');
  f.setHidden(true);controller.requestFrame();await settle(f,2);assert.equal(f.w.counts.sceneRenders-before,2,'hidden: none');
  f.setHidden(false);await settle(f,2);
  f.book.core.hold('sheet');controller.requestFrame();const held=f.w.counts.sceneRenders;await settle(f,2);assert.equal(f.w.counts.sceneRenders,held,'held: none');
  f.book.core.release('sheet');await settle(f,2);assert.equal(f.pending(),0);
  controller.dispose();
 }finally{f.close();}
});

test('full mode: the animator turns on the stage clock, emits book-turn, lands and goes back to sleep',async()=>{
 const f=await fixture();
 try{
  const {state,controller,events}=await mounted(f,{policy:'full'});
  await settle(f,4);
  const turning=state.openWeek(6,{source:'control'});
  for(let i=0;i<12;i++)f.tick(33);
  const mid=state.snapshot();assert.ok(mid.turn>5&&mid.turn<6,'mid-turn '+mid.turn);assert.equal(controller.stats().live,1,'one sheet in the air');
  assert.equal(f.slot.dataset.motionState,'running');
  for(let i=0;i<20;i++){f.tick(50);await f.flush();}
  assert.deepEqual(JSON.parse(JSON.stringify(await turning)),{index:6,cancelled:false});assert.equal(state.snapshot().turn,6);
  const turns=events.filter(e=>e[0]==='book-turn').map(e=>e[1].phase);assert.deepEqual(turns.slice(0,2),['start','land']);
  for(let i=0;i<10;i++){f.tick(50);await f.flush();}
  assert.equal(f.pending(),0,'drift needs a fine pointer (the jsdom stub has none): the loop stops after landing');
  // Riffle: > 4 spreads, at most 3 sheets in the air at high tier, never more than 900 ms.
  const plan=f.book.turnPlan(6,15,.3,{tier:'high'});assert.equal(plan.kind,'riffle');assert.equal(plan.m,4);assert.ok(plan.total<=.9);
  assert.equal(f.book.turnPlan(6,9,0,{tier:'mid'}).stagger>=.23,true,'mid tier: two sheets in the air at most');
  controller.dispose();
 }finally{f.close();}
});

test('a context loss falls back to the poster; one restore remounts; a second loss stays on the poster',async()=>{
 const f=await fixture();
 try{
  const {controller,events}=await mounted(f);
  await settle(f,3);
  const canvas=f.book.getStage().canvas,lose=()=>canvas.dispatchEvent(new f.w.Event('webglcontextlost',{cancelable:true}));
  lose();await settle(f,2);
  assert.equal(f.slot.dataset.renderer,'poster');assert.equal(f.slot.dataset.rendererReason,'lost');assert.deepEqual(events.filter(e=>e[0]==='fallback').map(e=>e[1]),['lost']);
  canvas.dispatchEvent(new f.w.Event('webglcontextrestored'));for(let i=0;i<4;i++)await f.flush();await settle(f,3);
  assert.equal(controller.stats().remounts,1);assert.equal(f.slot.dataset.renderer,'webgl2','remounted once');
  lose();canvas.dispatchEvent(new f.w.Event('webglcontextrestored'));await settle(f,3);
  assert.equal(f.slot.dataset.renderer,'poster');assert.equal(controller.stats().remounts,1,'no second remount');
  assert.equal(f.pending(),0);
  controller.dispose();
 }finally{f.close();}
});

test('dispose leaves no listeners or observers; 20 mount and unmount cycles keep one renderer and flat counts',async()=>{
 const f=await fixture();
 try{
  const types=['pointermove','pointerdown','pointerup','pointerleave','pointercancel','lostpointercapture','click'];
  const slotListeners=new Map();const add=f.slot.addEventListener.bind(f.slot),remove=f.slot.removeEventListener.bind(f.slot);
  f.slot.addEventListener=(t,fn,o)=>{slotListeners.set(t,(slotListeners.get(t)||0)+1);return add(t,fn,o);};
  f.slot.removeEventListener=(t,fn,o)=>{slotListeners.set(t,(slotListeners.get(t)||0)-1);return remove(t,fn,o);};
  const docTypes=['night-tier','visibilitychange','guide-motion-change','night-hold','pagehide','pageshow'];
  let docBase=null;
  for(let i=0;i<20;i++){
   const {state,controller,log}=await mounted(f);
   await settle(f,2);
   controller.dispose();state.dispose();
   if(i===0)docBase=docTypes.map(f.listeners);   // the stage's own shell listeners exist from the first mount on
   assert.ok(log.includes('dispose'),'textures released');
  }
  assert.equal(f.w.counts.renderers,1);assert.equal(f.w.counts.contexts,1);
  assert.equal(f.observers.io.size+f.observers.ro.size,0);assert.equal(f.pending(),0);
  for(const t of types)assert.equal(slotListeners.get(t)||0,0,t);
  assert.deepEqual(docTypes.map(f.listeners),docBase,'document and window listeners flat');
  const stage=f.book.getStage().stats();assert.equal(stage.attached,false);assert.equal(stage.environment,true,'the environment survives in the stage');
  assert.ok(f.slot.querySelector('canvas')===null,'the canvas is parked');
 }finally{f.close();}
});

test('phone framing keeps the whole spread at least 360 px wide at 390',async()=>{
 const f=await fixture({width:390});
 try{
  const {controller}=await mounted(f);await settle(f,2);const m=controller.metrics();
  assert.ok(m.spreadRect.width>=360,`spread ${m.spreadRect.width}`);assert.ok(m.spreadRect.left>=0&&m.spreadRect.right<=390);
  assert.equal(f.book.framingFor(390).elevation,60);assert.equal(f.book.framingFor(1000).elevation,52);assert.equal(f.book.framingFor(1440).elevation,46);
  controller.dispose();
 }finally{f.close();}
});

test('the poster controller keeps the §3.3 surface when the scene cannot start; aborted mounts stay silent',async()=>{
 const f=await fixture({query:'?tier=low'});
 try{
  const {createBookState}=f.book.books,state=createBookState({weeks:Array.from({length:17},(_,i)=>i),today:5,policy:()=>'full'}),base=state.subscriberCount;
  const controller=await f.book.mountBook(f.slot,{course:'mth140',state});
  assert.equal(await controller.ready,'poster');assert.equal(f.slot.dataset.week,'5');
  const m=controller.metrics();assert.ok(m.spreadRect.width>780&&m.spreadRect.width<860,'spread about 820 px at 1440');
  controller.setHandoff(4);assert.equal(controller.stats().handoff,1);controller.setHandoff(NaN);assert.equal(controller.stats().handoff,0);
  let closed=false;controller.close({ms:350}).then(()=>{closed=true;});await Promise.resolve();assert.equal(closed,true);
  controller.dispose();controller.dispose();assert.equal(state.subscriberCount,base);
  const abort=new f.w.AbortController();abort.abort();
  const gone=await f.book.mountBook(f.slot,{state,signal:abort.signal,onFallback:()=>assert.fail('aborted mounts stay silent')});
  assert.equal(await gone.ready,'poster');assert.equal(f.slot.dataset.rendererReason,'aborted');
 }finally{f.close();}
});

test('the stage renders on request only and sleeps offscreen, hidden and held',async()=>{
 const f=await fixture();
 try{
  const stage=f.book.getStage(),scene=sceneController();const detach=stage.attach(f.slot,scene);
  assert.equal(f.slot.querySelector('canvas'),stage.canvas);assert.deepEqual(scene.calls.resize[0],[1440,640,1]);
  f.tick();assert.equal(scene.calls.render.length,1,'one frame on attach');assert.equal(f.pending(),0,'0 rAF after settle');
  for(let i=0;i<5;i++)f.tick();assert.equal(scene.calls.render.length,1);
  scene.busy=3;stage.requestFrame();for(let i=0;i<10;i++)f.tick();assert.equal(scene.calls.render.length,5,'busy frames continue, then the loop stops');assert.equal(f.pending(),0);
  f.intersect(false);stage.requestFrame();f.tick();assert.equal(scene.calls.render.length,5,'offscreen: no frame');assert.equal(f.pending(),0);
  f.intersect(true);f.tick();assert.equal(scene.calls.render.length,6,'one frame on wake');
  f.setHidden(true);stage.requestFrame();f.tick();assert.equal(scene.calls.render.length,6,'hidden: no frame');
  f.setHidden(false);f.tick();assert.equal(scene.calls.render.length,7);
  f.book.core.hold('palette');stage.requestFrame();f.tick();assert.equal(scene.calls.render.length,7,'held: no frame');
  f.book.core.release('palette');f.tick();assert.equal(scene.calls.render.length,8);
  const gates=scene.calls.update.at(-1).gates;assert.deepEqual(Object.keys(gates).sort(),['ambient','held','hidden','motion','ratio','visible']);
  scene.busy=Infinity;scene.rate=30;stage.requestFrame();for(let i=0;i<12;i++)f.tick(16.7);const capped=scene.calls.render.length-8;assert.ok(capped>=6&&capped<=7,'a numeric busy value caps the rate at 30 fps: '+capped);
  scene.busy=0;scene.rate=0;for(let i=0;i<8;i++)f.tick(16.7);assert.equal(f.pending(),0);
  detach();assert.equal(f.pending(),0);assert.equal(f.observers.io.size+f.observers.ro.size,0);
  const park=f.w.document.querySelector('[data-ns-stage-park]');assert.ok(park?.hidden);assert.equal(stage.canvas.parentElement,park,'canvas parked, context kept');
  stage.requestFrame();f.tick();assert.equal(scene.calls.render.length>0&&f.pending(),0,'detached: no frames');
 }finally{f.close();}
});

test('20 attach and detach cycles keep one renderer and flat observer counts',async()=>{
 const f=await fixture();
 try{
  const stage=f.book.getStage(),before=stage.stats().listeners;
  for(let i=0;i<20;i++){const scene=sceneController(2);const detach=stage.attach(f.slot,scene);f.tick();f.tick();f.tick();detach();}
  assert.equal(f.w.counts.renderers,1);assert.equal(f.w.counts.contexts,1);assert.equal(f.observers.io.size+f.observers.ro.size,0);assert.equal(f.pending(),0);
  assert.deepEqual(stage.stats().listeners,before);
  const first=sceneController(),second=sceneController();stage.attach(f.slot,first);const keep=stage.attach(f.slot,second);
  assert.equal(f.observers.io.size,1,'attaching replaces the previous controller');keep();
 }finally{f.close();}
});

test('high tier owns the post chain; dropping to mid releases it, low releases the stage',async()=>{
 const f=await fixture();
 try{
  const stage=f.book.getStage(),scene=sceneController();stage.attach(f.slot,scene);f.tick();
  assert.ok(scene.calls.render[0],'post chain handed to the scene at high tier');assert.equal(stage.stats().post,true);assert.ok(stage.stats().targetBytes>0);
  assert.ok(stage.environment());assert.equal(stage.environment(),stage.environment());assert.equal(f.w.counts.environments,1,'environment cached');
  const tiers=[];stage.onQuality(()=>tiers.push(stage.stats().tier));
  f.book.core.downgrade('test');assert.equal(stage.stats().post,false);assert.equal(stage.post(),null);assert.equal(stage.renderer.shadowMap.enabled,false);
  stage.requestFrame();f.tick();assert.equal(scene.calls.render.at(-1),null,'mid tier renders directly');assert.deepEqual(tiers,['mid']);
  const lost=[];stage.onLost(reason=>lost.push(reason));
  f.book.core.downgrade('test');await f.flush();
  assert.deepEqual(lost,['tier-low']);assert.equal(stage.available,false);assert.deepEqual({...f.book.probe()},{ok:false,reason:'tier-low'});
  assert.equal(f.w.counts.contextLosses,1);assert.equal(f.w.counts.rendererDisposals,1);assert.equal(f.w.counts.environmentDisposals,1);
  assert.equal(f.w.document.querySelector('canvas'),null);assert.equal(stage.stats().listeners.shell,0);assert.equal(f.pending(),0);
 }finally{f.close();}
});

test('context loss stops the loop; one restore is reported; a second loss ends the stage',async()=>{
 const f=await fixture();
 try{
  const stage=f.book.getStage(),scene=sceneController(Infinity),events=[];stage.attach(f.slot,scene);
  stage.onLost(reason=>events.push('lost:'+reason));stage.onRestored(()=>events.push('restored'));f.tick();f.tick();
  const canvas=stage.canvas,lose=()=>{const e=new f.w.Event('webglcontextlost',{cancelable:true});canvas.dispatchEvent(e);return e.defaultPrevented;};
  assert.equal(lose(),true,'loss is prevented so the context can come back');assert.equal(stage.available,false);assert.equal(stage.reason,'lost');
  const frames=scene.calls.render.length;f.tick();f.tick();assert.equal(scene.calls.render.length,frames);assert.equal(f.pending(),0);
  canvas.dispatchEvent(new f.w.Event('webglcontextrestored'));assert.equal(stage.available,true);f.tick();assert.equal(scene.calls.render.length,frames+1);
  lose();canvas.dispatchEvent(new f.w.Event('webglcontextrestored'));
  assert.deepEqual(events,['lost:context','restored','lost:context']);assert.equal(stage.available,false);assert.deepEqual({...f.book.probe()},{ok:false,reason:'lost'});
  assert.equal(f.w.counts.contextLosses,1);assert.equal(f.pending(),0);
 }finally{f.close();}
});

test('a shader failure, a throwing scene and an unloading page each end cleanly',async()=>{
 const f=await fixture();
 try{
  const stage=f.book.getStage(),broken={resize(){},update(){throw Error('scene bug');},render(){},dispose(){}},lost=[];stage.onLost(r=>lost.push(r));
  stage.attach(f.slot,broken);f.tick();assert.deepEqual(lost,['error']);assert.equal(stage.available,true,'a scene bug keeps the stage');assert.equal(f.observers.io.size,0);
  const scene=sceneController(Infinity);stage.attach(f.slot,scene);f.w.failShader=true;f.tick();await f.flush();
  assert.deepEqual(lost,['error','shader']);assert.deepEqual({...f.book.probe()},{ok:false,reason:'shader'});assert.equal(f.pending(),0);assert.equal(f.w.counts.contextLosses,1);
  assert.ok(f.warnings.some(w=>w.includes('fixture')),'the program log is reported');
 }finally{f.close();}
 const g=await fixture();
 try{
  const baseline=['visibilitychange','guide-motion-change','night-hold','pagehide','pageshow','night-tier'].map(g.listeners);
  const stage=g.book.getStage();stage.attach(g.slot,sceneController(Infinity));g.tick();
  g.w.dispatchEvent(Object.assign(new g.w.Event('pagehide'),{persisted:true}));g.tick();assert.equal(g.pending(),0,'bfcache: sleeps');
  g.w.dispatchEvent(Object.assign(new g.w.Event('pageshow'),{persisted:true}));assert.equal(g.pending(),1,'restored from bfcache: wakes');
  g.w.dispatchEvent(Object.assign(new g.w.Event('pagehide'),{persisted:false}));
  assert.equal(g.w.counts.contextLosses,1,'unload releases the context');assert.equal(stage.available,false);
  assert.deepEqual(['visibilitychange','guide-motion-change','night-hold','pagehide','pageshow','night-tier'].map(g.listeners),baseline,'0 stage listeners left');
  assert.equal(g.observers.io.size+g.observers.ro.size,0);
 }finally{g.close();}
});

test('sustained slow busy frames lower the resolution once, then drop a tier',async()=>{
 const f=await fixture();
 try{
  const stage=f.book.getStage(),scene=sceneController(Infinity),quality=[];stage.onQuality(q=>quality.push(q));stage.attach(f.slot,scene);
  const tiers=[];f.w.document.addEventListener('night-tier',e=>tiers.push(e.detail));
  for(let i=0;i<60;i++)f.tick(40);
  assert.equal(stage.quality,.8);assert.equal(scene.calls.resize.at(-1)[2],.8,'DPR ×0.8');
  for(let i=0;i<60;i++)f.tick(40);
  assert.deepEqual({...tiers[0]},{tier:'mid',reason:'book frames'});
  assert.ok(quality.length>=2);
 }finally{f.close();}
});

test('the Three URL is single and the book-state stub keeps the §3.1 rules',async()=>{
 const grep=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?grep(path.join(dir,e.name)):/\.m?js$/.test(e.name)&&/three-0\.186\.1\.mjs\?v=/.test(fs.readFileSync(path.join(dir,e.name),'utf8'))?[path.relative(root,path.join(dir,e.name))]:[]);
 assert.deepEqual(grep(path.join(root,'assets')),['assets/app/three.mjs']);
 const {createBookState}=await import(pathToFileURL(path.join(root,'tests/fixtures/book-state-stub.mjs')).href);
 let mode='cut';const weeks=Array.from({length:17},(_,i)=>i),state=createBookState({weeks,today:5,policy:()=>mode}),seen=[];
 state.subscribe((s,c)=>seen.push(c.kind));
 await state.openWeek(30);assert.equal(state.snapshot().index,16);assert.deepEqual(seen,['select','settle']);assert.equal(state.consumeAnchorDirty(),true);
 mode='full';const runs=[];state.setAnimator({animate(from,to,o){runs.push([from,to,o.mode]);return new Promise(r=>{runs.at(-1).done=r;});},cancel(){}});
 const first=state.openWeek(3),second=state.openWeek(4);assert.deepEqual(await first,{index:3,cancelled:true});
 runs.at(-1).done();assert.deepEqual(await second,{index:4,cancelled:false});assert.equal(state.snapshot().turn,4);
 assert.equal(state.grab('drag'),true);assert.equal(state.scrub(6,'scroll'),false,'drag holds the lock');state.scrub(4.6,'drag');
 const landing=state.release('drag',{velocity:-1});runs.at(-1).done();await landing;assert.equal(state.snapshot().index,4,'v < -0.3 lands on floor');
 mode='cut';assert.equal(state.grab('swipe'),false,'grab needs full mode');
 assert.equal(state.scrub(7.01,'scroll'),true);assert.equal(state.snapshot().index,7,'a dwell selects');
});
