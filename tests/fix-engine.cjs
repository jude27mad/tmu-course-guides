/* Engine regressions from the Stage 2 review (semester-book spec §4.1, §5.7, §5.9, §5.10): a shader failure or
   context loss before the engine attaches, a week change while the stage cannot render, the slow-frame watchdog
   under 10 fps, idle drift after input, and drags that do not turn a page. Run after npm ci --prefix
   tools/ui-build. The same jsdom harness as book-lifecycle.cjs (a WebGLRenderer shim, a counting textures
   stub, GSAP's ease formulas), plus an init hook that runs before the modules load, driving the production
   book-state.mjs (its land and settle rules decide when a click may open an item and when a week is announced). */
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {JSDOM}=require('../tools/ui-build/node_modules/jsdom'),esbuild=require('../tools/ui-build/node_modules/esbuild');
const root=path.resolve(__dirname,'..'),three=`${root}/tools/scene-build/node_modules/three`;
const CORE='./assets/night/core.mjs?v='+fs.readFileSync(path.join(root,'assets/night/core.mjs'),'utf8').match(/export const VERSION='([^']+)'/)[1];
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
 render(object){this.info.render.calls++;window.counts.draws++;if(object?.isScene)window.counts.sceneRenders++;}
 dispose(){window.counts.rendererDisposals++;}forceContextLoss(){window.counts.contextLosses++;}
 compileAsync(){return window.onCompile?.(this)??Promise.resolve();}
}
export class PMREMGenerator{fromScene(){window.counts.environments++;return{texture:new Texture(),dispose(){}};}dispose(){}}`;
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
  import {mountBook} from './assets/book/book-scene.mjs';
  import * as T from '${THREE}';
  import * as core from '${CORE}';
  import {createBookState} from './assets/book/book-state.mjs';
  window.book={probe,getStage,mountBook,core,createBookState,T};`,resolveDir:root},
  plugins:[plugin],bundle:true,format:'iife',write:false,logLevel:'silent'})).outputFiles[0].text;
 return bundle;
}

/* query '' leaves the tier to core's own heuristic; init(w) runs before the modules load. */
async function fixture({query='?tier=high',width=1440,init=null}={}){
 const dom=new JSDOM('<body class="workspace" data-course="mth140"><main data-route-region><header class="course-heading"><div class="header-art"></div></header></main></body>',
  {url:'https://guide.test/mth140/'+query,pretendToBeVisual:true,runScripts:'outside-only'}),w=dom.window;
 w.counts={renderers:0,draws:0,sceneRenders:0,rendererDisposals:0,contextLosses:0,environments:0};
 const callbacks=new Map(),observers={io:new Set(),ro:new Set()};let id=0,now=1000,hidden=false;
 w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
 w.requestAnimationFrame=fn=>{callbacks.set(++id,fn);return id;};w.cancelAnimationFrame=i=>callbacks.delete(i);
 Object.defineProperty(w,'innerWidth',{value:width,configurable:true});
 Object.defineProperty(w.document,'hidden',{get:()=>hidden,configurable:true});
 w.IntersectionObserver=class{constructor(fn){this.fn=fn;}observe(){observers.io.add(this);}disconnect(){observers.io.delete(this);}};
 w.ResizeObserver=class{constructor(fn){this.fn=fn;}observe(){observers.ro.add(this);}disconnect(){observers.ro.delete(this);}};
 w.WebGL2RenderingContext=class{};
 const gl={isContextLost:()=>false,getProgramInfoLog:()=>'ERROR: 0:1: fixture'};
 w.HTMLCanvasElement.prototype.getContext=function(type){return type==='webgl2'?gl:null;};
 const warnings=[];w.console.warn=(...args)=>warnings.push(args.join(' '));
 init?.(w);
 w.eval(await script());
 const slot=w.document.querySelector('.header-art');
 slot.getBoundingClientRect=()=>({left:0,top:0,width,height:640,right:width,bottom:640,x:0,y:0});
 const flush=async()=>{for(let i=0;i<6;i++)await Promise.resolve();};
 return {w,slot,book:w.book,warnings,flush,pending:()=>callbacks.size,
  tick(elapsed=16.7){now+=elapsed;const run=[...callbacks.values()];callbacks.clear();for(const fn of run)fn(now);},
  setHidden(value){hidden=value;w.document.dispatchEvent(new w.Event('visibilitychange'));},
  intersect(isIntersecting,ratio=isIntersecting?1:0){for(const io of [...observers.io])io.fn([{isIntersecting,intersectionRatio:ratio}]);},
  lose(){w.book.getStage().canvas.dispatchEvent(new w.Event('webglcontextlost',{cancelable:true}));},
  restore(){w.book.getStage().canvas.dispatchEvent(new w.Event('webglcontextrestored'));},
  close(){dom.window.close();}};
}

/* A counting stand-in for textures.mjs. hit(face, u, v) is injectable so a test can print an item. */
function texturesStub(w,{log=[],ready=Promise.resolve(),hit=()=>({kind:'page',corner:false})}={}){
 return opts=>{
  const faces=new Map(),T=w.book.T;let disposed=false;
  const face=id=>{if(!faces.has(id)){const t=new T.DataTexture(new Uint8Array(4),1,1);t.name=id;faces.set(id,t);}return faces.get(id);};
  return {ready,opts,face,paint(id){log.push('paint:'+id);return face(id);},want(){},pump:()=>false,refresh(){},setScreen:()=>false,setTier(){},
   labelSlot:()=>null,stamp:()=>null,paper:()=>({normal:null}),linen:()=>({}),cover:()=>null,hit,
   stats:()=>({faces:faces.size,disposed}),dispose(){disposed=true;log.push('dispose');}};
 };
}
const spreadView=i=>({index:i,count:17,datedCount:16,kind:'teaching',partial:false,pending:false,kicker:'WEEK',numeral:String(i+1).padStart(2,'0'),of:'16',
 range:'',note:'Teaching week',relative:'',days:[],entries:[],popups:[],more:0,aria:'',live:'',signature:'v'+i});
/* Mounts the engine on the production book state; `controller` is mountBook's promise. */
function mount(f,{policy='full',today=5,textures={}}={}){
 const {createBookState}=f.book,weeks=Array.from({length:17},(_,i)=>({label:'w'+i}));
 const state=createBookState({course:'mth140',weeks,today,policy:()=>policy});
 const log=[],events=[],changes=[];
 for(const type of ['book-ready','book-fallback','book-turn'])f.slot.addEventListener(type,e=>events.push([type,e.detail]));
 state.subscribe((s,c)=>changes.push(c.kind));
 const controller=f.book.mountBook(f.slot,{course:'mth140',state,getView:spreadView,onOpen:id=>events.push(['open',id]),
  onFallback:r=>events.push(['fallback',r]),dockTarget:()=>null,arrival:{start:-1e9},createTextures:texturesStub(f.w,{log,...textures})});
 return {state,controller,log,events,changes};
}
const settle=async(f,n=6,ms=16.7)=>{for(let i=0;i<n;i++){f.tick(ms);await f.flush();}};
const fallbacks=events=>events.filter(e=>e[0]==='fallback').map(e=>e[1]);
const cutMotion=w=>{w.GuideMotion={motionAllowed:()=>false,sceneMotionAllowed:()=>false,preference:()=>({forced:true,reduced:false})};};

/* ---- finding 1: a failure before the engine attaches still reaches the poster ---- */

test('a shader failure while the engine compiles falls back to the poster instead of waiting forever',async()=>{
 const f=await fixture();
 try{
  // three reports the broken program from compileAsync, before the scene is attached (§5.9 onShaderError → fallback).
  f.w.onCompile=renderer=>{renderer.debug.onShaderError?.(renderer.context,{},null,null);return Promise.resolve();};
  const {controller:pending,events,log}=mount(f);
  const controller=await pending;
  assert.equal(await controller.ready,'poster','ready settles');
  assert.equal(f.slot.dataset.renderer,'poster');assert.equal(f.slot.dataset.rendererReason,'shader');assert.equal(f.slot.dataset.sceneReady,'true');
  assert.deepEqual(fallbacks(events),['shader']);assert.deepEqual(events.filter(e=>e[0]==='book-fallback').map(e=>e[1].reason),['shader']);
  assert.ok(log.includes('dispose'),'the engine that never attached is released');
  assert.equal(f.book.getStage().available,false);assert.equal(f.slot.querySelector('canvas'),null);
  await settle(f,3);assert.equal(f.pending(),0,'no frame loop');
  assert.equal(controller.stats().renderer,'poster');
  controller.dispose();
 }finally{f.close();}
});

test('a context loss while the engine compiles falls back to the poster; the restore remounts once',async()=>{
 const f=await fixture();
 try{
  let release;const gate=new Promise(r=>{release=r;});
  const {controller:pending,events}=mount(f,{textures:{ready:gate}});
  await f.flush();
  f.lose();release();             // lost after the stage exists, before the engine attaches
  const controller=await pending;
  assert.equal(await controller.ready,'poster');
  assert.equal(f.slot.dataset.renderer,'poster');assert.equal(f.slot.dataset.rendererReason,'lost');assert.deepEqual(fallbacks(events),['lost']);
  assert.equal(f.book.getStage().stats().attached,false);
  f.restore();for(let i=0;i<4;i++)await f.flush();await settle(f,3);
  assert.equal(controller.stats().remounts,1);assert.equal(f.slot.dataset.renderer,'webgl2','remounted once after the restore');
  assert.equal(f.book.getStage().stats().attached,true);
  controller.dispose();
 }finally{f.close();}
});

test('a context lost and restored while the engine compiles costs the one remount, then renders',async()=>{
 const f=await fixture();
 try{
  // Lost and restored during the first compile: the environment target went with the old context.
  let compiles=0;f.w.onCompile=()=>{if(++compiles===1){f.lose();f.restore();}return Promise.resolve();};
  const {controller:pending,events}=mount(f);
  const controller=await pending;
  for(let i=0;i<4;i++)await f.flush();await settle(f,3);
  assert.deepEqual(fallbacks(events),['lost']);
  assert.equal(f.slot.dataset.renderer,'webgl2');assert.equal(controller.stats().remounts,1);
  assert.deepEqual(events.filter(e=>e[0]==='book-ready').map(e=>e[1].renderer),['webgl2'],'book-ready announces the remount');
  assert.equal(f.w.counts.environments,2,'the remount asked the restored context for a new environment');
  // A further loss and restore stays on the poster (the stage ends after a second loss).
  f.lose();f.restore();await settle(f,3);
  assert.equal(f.slot.dataset.renderer,'poster');assert.equal(controller.stats().remounts,1);
  controller.dispose();
 }finally{f.close();}
});

/* ---- finding 20: offscreen or hidden, a week change lands at once ---- */

test('a week change while the stage is offscreen or hidden settles at once and turns nothing later',async()=>{
 const f=await fixture();
 try{
  const {state,controller:pending,events,changes}=mount(f);
  const controller=await pending;await settle(f,4);
  f.intersect(false);
  assert.equal(f.slot.dataset.awake,'false','the slot says the stage sleeps');
  changes.length=0;
  const result=await state.openWeek(6,{source:'control'});
  assert.deepEqual(JSON.parse(JSON.stringify(result)),{index:6,cancelled:false});
  const s=state.snapshot();assert.equal(s.turn,6);assert.equal(s.settled,true);
  assert.ok(changes.includes('settle'),'settled, so the live region can announce it');
  assert.equal(events.filter(e=>e[0]==='book-turn').length,0,'no turn was started');assert.equal(f.pending(),0,'no rAF offscreen');
  f.intersect(true);await settle(f,2);
  assert.equal(controller.stats().run,null,'nothing plays on the way back');assert.equal(f.slot.dataset.week,'6');assert.equal(f.slot.dataset.turn,'6.00');
  assert.equal(f.slot.dataset.awake,'true');
  f.setHidden(true);
  assert.equal((await state.openWeek(7,{source:'control'})).index,7);assert.equal(state.snapshot().settled,true);assert.equal(state.snapshot().turn,7);
  f.setHidden(false);await settle(f,2);assert.equal(controller.stats().run,null);
  controller.dispose();
 }finally{f.close();}
});

test('a turn in progress lands when the stage goes offscreen, hidden or held',async()=>{
 const f=await fixture();
 try{
  const {state,controller:pending,events}=mount(f);
  const controller=await pending;await settle(f,4);
  for(const [sleep,wake,to] of [[()=>f.intersect(false),()=>f.intersect(true),8],[()=>f.setHidden(true),()=>f.setHidden(false),10],
   [()=>f.book.core.hold('palette'),()=>f.book.core.release('palette'),12]]){
   const from=state.snapshot().index,turning=state.openWeek(to,{source:'control'});
   await settle(f,3,33);const mid=state.snapshot();assert.ok(!mid.settled&&mid.turn<to,'mid-turn');
   sleep();
   assert.deepEqual(JSON.parse(JSON.stringify(await turning)),{index:to,cancelled:false});
   const s=state.snapshot();assert.equal(s.turn,to);assert.equal(s.settled,true);
   assert.deepEqual(events.filter(e=>e[0]==='book-turn').slice(-1).map(e=>({...e[1]})),[{phase:'land',from,to}]);
   assert.equal(f.pending(),0);
   wake();await settle(f,3);assert.equal(controller.stats().run,null);assert.equal(f.slot.dataset.turn,to.toFixed(2));
  }
  controller.dispose();
 }finally{f.close();}
});

/* ---- finding 4: the watchdog under 10 fps, but never on one hitch ---- */

function sceneController(){
 const calls={resize:[],render:0};
 return {calls,resize(w,h,dpr){calls.resize.push(dpr);},update(){return true;},render(renderer){calls.render++;renderer.render({isScene:true},{});},dispose(){}};
}
const unforcedHigh=w=>Object.defineProperty(w.navigator,'hardwareConcurrency',{value:8,configurable:true});

test('the watchdog catches a device rendering busy frames slower than 10 fps',async()=>{
 for(const ms of [400,150]){
  const f=await fixture({query:'',init:unforcedHigh});
  try{
   assert.equal(f.book.core.tier(),'high');
   const stage=f.book.getStage(),scene=sceneController(),tiers=[];stage.attach(f.slot,scene);
   f.w.document.addEventListener('night-tier',e=>tiers.push({...e.detail}));
   for(let i=0;i<16;i++)f.tick(ms);
   assert.equal(stage.quality,.8,`${ms} ms frames lower the resolution`);assert.equal(scene.calls.resize.at(-1),.8);
   for(let i=0;i<16;i++)f.tick(ms);
   assert.deepEqual(tiers[0],{tier:'mid',reason:'book frames'},`${ms} ms frames drop a tier`);
  }finally{f.close();}
 }
});

test('one startup hitch never lowers the quality',async()=>{
 const f=await fixture({query:'',init:unforcedHigh});
 try{
  const stage=f.book.getStage(),scene=sceneController(),tiers=[];stage.attach(f.slot,scene);
  f.w.document.addEventListener('night-tier',e=>tiers.push(e.detail));
  f.tick();f.tick(3000);for(let i=0;i<300;i++)f.tick(16.7);
  assert.equal(stage.quality,1);assert.deepEqual(tiers,[]);
  // A hitch with a few frames around it, then sleep, then normal bursts: still nothing.
  const quiet=f.book.getStage();scene.update=()=>false;f.tick();assert.equal(f.pending(),0);
  let left=4;scene.update=()=>left-->0;quiet.requestFrame();f.tick();f.tick(2500);f.tick(30);f.tick(30);f.tick(30);
  scene.update=()=>true;quiet.requestFrame();for(let i=0;i<200;i++)f.tick(16.7);
  assert.equal(stage.quality,1);assert.deepEqual(tiers,[]);
 }finally{f.close();}
});

test('a tier forced with ?tier= keeps its tier; only the resolution step applies',async()=>{
 const f=await fixture({query:'?tier=mid'});
 try{
  const stage=f.book.getStage(),scene=sceneController(),tiers=[];stage.attach(f.slot,scene);
  f.w.document.addEventListener('night-tier',e=>tiers.push(e.detail));
  for(let i=0;i<60;i++)f.tick(400);
  assert.equal(stage.quality,.8);assert.deepEqual(tiers,[]);assert.equal(f.book.core.tier(),'mid');assert.equal(stage.available,true);
 }finally{f.close();}
});

/* ---- finding 5: drift comes back 2 s after the last input ---- */

test('high tier drift resumes 2 s after a turn: a timer wakes the sleeping stage',async()=>{
 const f=await fixture();
 try{
  let wall=50000;Object.defineProperty(f.w.performance,'now',{value:()=>wall,configurable:true});
  f.w.matchMedia=q=>({matches:/pointer:\s*fine|hover:\s*hover/.test(q),addEventListener(){},removeEventListener(){}});
  const {state,controller:pending}=mount(f);
  const controller=await pending;
  for(let i=0;i<60;i++){f.tick(33);await f.flush();}
  assert.ok(controller.stats().drift>0,'drifting after arrival');assert.equal(f.slot.dataset.motionState,'running');
  // Long-delay timers are held here, so the test drives the wall clock.
  const timers=[],realSet=f.w.setTimeout.bind(f.w),realClear=f.w.clearTimeout.bind(f.w);
  f.w.setTimeout=(fn,ms,...rest)=>ms>=1000&&ms<=3000?(timers.push({fn,ms,cleared:false}),-timers.length):realSet(fn,ms,...rest);
  f.w.clearTimeout=id=>{if(id<0)timers[-id-1].cleared=true;else realClear(id);};
  const turning=state.openWeek(6,{source:'control'});
  for(let i=0;i<40;i++){f.tick(33);await f.flush();wall+=33;}
  await turning;
  for(let i=0;i<40&&f.pending();i++){f.tick(33);await f.flush();}
  assert.equal(f.pending(),0,'asleep once the drift has faded out');assert.equal(controller.stats().drift,0);
  const armed=timers.filter(t=>!t.cleared);
  assert.equal(armed.length,1,'one wake timer');assert.ok(armed[0].ms>=1900&&armed[0].ms<=2100,'for the rest of the quiet period: '+armed[0].ms);
  wall+=2100;armed[0].fn();assert.equal(f.pending(),1,'the timer requests a frame');
  for(let i=0;i<10;i++){f.tick(33);await f.flush();}
  assert.ok(controller.stats().drift>0,'drift is back');assert.ok(f.pending()>0);
  // New input clears the timer; dispose clears it too.
  const fresh=timers.length;state.openWeek(7,{source:'control'});for(let i=0;i<40;i++){f.tick(33);await f.flush();}
  for(let i=0;i<40&&f.pending();i++){f.tick(33);await f.flush();}
  const next=timers.slice(fresh).filter(t=>!t.cleared);assert.equal(next.length,1);
  controller.dispose();assert.equal(next[0].cleared,true,'dispose clears the wake timer');
 }finally{f.close();}
});

/* ---- finding 17 and finding 16: drags that do not turn a page ---- */

// The recto prints an item across its middle; its outer edge above that is a draggable page zone.
const printed=(face,u,v)=>face.startsWith('R')&&u>.62&&u<.95&&v>.4&&v<.6?{kind:'item',id:'quiz-2',open:'assessment-quiz-2'}:{kind:'page',corner:false};
/* A draggable point on the recto's outer edge and a printed item at or left of it (forward), close in x. */
function points(controller){
 const items=[],drags=[];
 for(let x=700;x<1440;x+=6)for(let y=40;y<620;y+=6){
  const hit=controller.pick(x,y);if(!hit)continue;
  if(hit.kind==='item')items.push([x,y]);else if(hit.kind==='page'&&hit.u>.7&&hit.v<.3)drags.push([x,y]);
 }
 let best=null;
 for(const d of drags)for(const i of items){const dx=d[0]-i[0];if(dx>=0&&Math.hypot(dx,d[1]-i[1])>=20&&(!best||dx<best.dx))best={dx,down:d,up:i};}
 return {down:best?.down??null,up:best?.up??null};
}
function pointer(f,type,[x,y],{id=1,target=f.slot}={}){
 const event=new f.w.PointerEvent(type,{clientX:x,clientY:y,button:0,pointerId:id,pointerType:'mouse',bubbles:true,cancelable:true});
 target.dispatchEvent(event);return event;
}
async function dragTo(f,from,to){
 pointer(f,'pointerdown',from);
 for(let i=1;i<=6;i++)pointer(f,'pointermove',[from[0]+(to[0]-from[0])*i/6,from[1]+(to[1]-from[1])*i/6]);
 pointer(f,'pointerup',to);f.slot.dispatchEvent(new f.w.MouseEvent('click',{clientX:to[0],clientY:to[1],bubbles:true}));
 await settle(f,30,33);
}

test('a drag that turns nothing never opens the item under the release point',async()=>{
 const f=await fixture();
 try{
  cutMotion(f.w);
  const {state,controller:pending,events}=mount(f,{policy:'cut',textures:{hit:printed}});
  const controller=await pending;await settle(f,4);
  const {down,up}=points(controller);assert.ok(down&&up,'found a drag zone and an item');
  assert.ok(Math.abs(up[0]-down[0])<.25*controller.metrics().pageWidthPx,'short of a discrete step');
  await dragTo(f,down,up);
  assert.equal(state.snapshot().index,5);assert.deepEqual(events.filter(e=>e[0]==='open'),[],'cut mode: no item opens');
  // A plain click on the item still opens it.
  pointer(f,'pointerdown',up);pointer(f,'pointerup',up);f.slot.dispatchEvent(new f.w.MouseEvent('click',{clientX:up[0],clientY:up[1],bubbles:true}));
  assert.deepEqual(events.filter(e=>e[0]==='open').map(e=>e[1]),['assessment-quiz-2']);
  // A gesture whose click never came (cancelled) does not swallow the next real click.
  pointer(f,'pointerdown',down);pointer(f,'pointermove',[down[0],down[1]+60]);pointer(f,'pointercancel',[down[0],down[1]+60]);
  pointer(f,'pointerdown',up);pointer(f,'pointerup',up);f.slot.dispatchEvent(new f.w.MouseEvent('click',{clientX:up[0],clientY:up[1],bubbles:true}));
  assert.equal(events.filter(e=>e[0]==='open').length,2);
  controller.dispose();
 }finally{f.close();}
});

test('full motion: a forward drag clamped at the last spread opens nothing; only the slot losing capture cancels a drag',async()=>{
 const f=await fixture();
 try{
  const {state,controller:pending,events}=mount(f,{today:16,textures:{hit:printed}});
  const controller=await pending;for(let i=0;i<60;i++){f.tick(33);await f.flush();}
  const {down,up}=points(controller);assert.ok(down&&up);
  await dragTo(f,down,up);  // leftward or straight down: forward, clamped at turn 16
  assert.equal(state.snapshot().index,16);assert.equal(state.snapshot().turn,16);
  assert.deepEqual(events.filter(e=>e[0]==='open'),[],'the clamped gesture opens nothing');
  // A child's lost capture (a touch pointer's implicit canvas capture) bubbles to the slot: the drag goes on.
  pointer(f,'pointerdown',down);assert.equal(f.slot.dataset.dragging,'true');
  const lost=(target)=>target.dispatchEvent(new f.w.PointerEvent('lostpointercapture',{pointerId:1,pointerType:'mouse',bubbles:true}));
  lost(f.book.getStage().canvas);assert.equal(f.slot.dataset.dragging,'true','a child losing capture is not a cancel');
  lost(f.slot);assert.equal(f.slot.dataset.dragging,'false','the slot losing capture is');
  await settle(f,20,33);
  controller.dispose();
 }finally{f.close();}
});
