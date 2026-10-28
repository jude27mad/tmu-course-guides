/* The shell's single 3D stage (semester-book spec §3.4, §5.6, §5.9, §7).
   One WebGL2 context, one WebGLRenderer and one canvas for the whole document. Route scenes attach to it on
   mount and detach on unmount, so a router swap never creates a second context: the canvas moves between
   slots and rests in a hidden shell holder in between. Shell module: importing it does nothing; probe()
   creates the context and the first getStage() builds the renderer from it.

   SceneController (what attach() drives):
     resize(w, h, dpr)                CSS px and the device-pixel ratio the stage renders at
     update(dt, gates) → busy         seconds since the last frame; busy = true for another frame now, a
                                      number to cap the rate (30 while drifting), false to sleep. With
                                      gates.motion false the controller jumps to end states and says false,
                                      except for the short fades it owns in reduced-motion mode.
     render(renderer, post)           post is null except at high tier; post.render() then draws the frame
     sleep?(gates)                    optional: the stage stopped scheduling (offscreen, hidden, held). No
                                      frame will finish an animation until the gates open, so land it now
     dispose()                        called by the controller's owner, never by the stage

   Scheduling: requestAnimationFrame runs only while a controller is attached, its slot is on screen (100 px
   margin), the tab is visible, no palette or sheet holds motion, and the controller is busy or a frame was
   requested. There is no idle loop. A gate change requests one frame on wake. */
import * as T from './three.mjs?v=20261013-stage1';
import {tier,onTier,held,sceneMotionAllowed,ambientAllowed,downgrade} from '../night/core.mjs?v=20261026-cen100';

const CONTEXT={alpha:true,antialias:true,powerPreference:'high-performance',failIfMajorPerformanceCaveat:true};
const DPR_CAP={high:2,mid:1.5};
const ENVIRONMENT={sigma:.04,size:{high:256,mid:128}};
const BLOOM={strength:.35,radius:.4,threshold:1};
const ABERRATION_PX=.6; // CSS px at the far corner; zero over the book (§5.6)
const SLOW={frameMs:25,share:.45,windowMs:2000,hitchMs:250};
const MAX_DT=.1;

let probed=null;   // {gl, canvas, reason}: the probe's context, reused by the renderer
let terminal=null; // why the stage is gone for this document: 'tier-low' | 'shader' | 'lost' | 'unloaded'
let stage=null;

const forcedTier=()=>{try{return ['high','mid'].includes(new URLSearchParams(location.search).get('tier'));}catch{return false;}};

/* Can this document render the book? Cached: the first call creates the one WebGL2 context, which the
   stage reuses; later calls cost nothing. ?tier=low forces the poster; ?tier=high|mid also lifts
   failIfMajorPerformanceCaveat so software renderers (SwiftShader captures, QA) can run the engine.
   reason: 'ok' | 'tier-low' | 'no-webgl2' | 'performance-caveat' | 'unavailable' | 'shader' | 'lost' | 'unloaded'.
   options.preserveDrawingBuffer applies only to the call that creates the context (poster capture). */
export function probe(options={}){
 if(terminal)return {ok:false,reason:terminal};
 if(tier()==='low')return {ok:false,reason:'tier-low'};
 probed??=createContext(options);
 return {ok:!!probed.gl,reason:probed.reason};
}

function createContext({preserveDrawingBuffer=false}={}){
 if(typeof document==='undefined')return {gl:null,canvas:null,reason:'unavailable'};
 const canvas=document.createElement('canvas');let message='';
 const note=event=>{message=event.statusMessage||message;};
 canvas.addEventListener('webglcontextcreationerror',note);
 let gl=null;
 try{gl=canvas.getContext('webgl2',{...CONTEXT,failIfMajorPerformanceCaveat:!forcedTier(),preserveDrawingBuffer});}
 catch(error){message=String(error?.message||error);}
 canvas.removeEventListener('webglcontextcreationerror',note);
 if(gl&&!gl.isContextLost?.())return {gl,canvas,reason:'ok'};
 const reason=typeof WebGL2RenderingContext==='undefined'?'no-webgl2':/caveat|performance|software/i.test(message)?'performance-caveat':'unavailable';
 return {gl:null,canvas:null,reason};
}

/* The stage singleton. Creates the renderer on first use; when the probe failed it returns a stage with
   available false, whose methods are safe no-ops. */
export function getStage(){return stage??=createStage();}

function createStage(){
 const status=probe();
 const listeners={quality:new Set(),lost:new Set(),restored:new Set()};
 const emit=(set,...args)=>{for(const fn of [...set]){try{fn(...args);}catch(error){console.warn('Stage listener failed',error);}}};
 const subscribe=set=>fn=>{set.add(fn);return()=>set.delete(fn);};
 let ok=status.ok,why=status.reason,renderer=null,canvas=null,park=null,environmentTarget=null,chain=null;
 let current=null,raf=0,requested=false,busy=false,last=0,frames=0,busyFrames=0,rafs=0;
 let quality=1,sleeping=false,lost=false,losses=0,shaderFailed=false;
 let slow={time:0,total:0,count:0},size={w:0,h:0,dpr:0};
 const shell=[];

 const api={
  get available(){return ok&&!lost;},
  get reason(){return lost&&ok?'lost':why;},
  get renderer(){return renderer;},
  get canvas(){return canvas;},
  get quality(){return quality;},
  attach,requestFrame,gates,environment,post,stats,
  onQuality:subscribe(listeners.quality),onLost:subscribe(listeners.lost),onRestored:subscribe(listeners.restored)
 };
 if(!ok)return api;

 try{
  canvas=probed.canvas;
  canvas.className='ns-stage';canvas.setAttribute('aria-hidden','true');
  canvas.style.cssText='position:absolute;inset:0;width:100%;height:100%;display:block';
  renderer=new T.WebGLRenderer({canvas,context:probed.gl,alpha:true,antialias:true,powerPreference:'high-performance'});
  renderer.outputColorSpace=T.SRGBColorSpace;
  renderer.toneMapping=T.NeutralToneMapping;renderer.toneMappingExposure=1;
  renderer.setClearColor(0x000000,0);
  renderer.info.autoReset=false; // reset once per frame so the counts cover the scene and every post pass
  renderer.shadowMap.enabled=tier()==='high'; // r186 PCF is the soft filter (PCFSoftShadowMap was folded into it)
  renderer.debug.checkShaderErrors=true;
  renderer.debug.onShaderError=(gl,program)=>{
   if(shaderFailed)return;shaderFailed=true;
   try{console.warn('Stage shader failed',gl?.getProgramInfoLog?.(program)?.trim()||'');}catch{}
   cancel(); // never draw again with a broken program; release once three has unwound
   queueMicrotask(()=>release('shader'));
  };
 }catch(error){
  console.warn('Stage renderer unavailable',error);
  ok=false;why='unavailable';terminal='unavailable';renderer=null;canvas=null;probed={gl:null,canvas:null,reason:why};
  return api;
 }

 const listen=(target,type,fn,options)=>{target.addEventListener(type,fn,options);shell.push(()=>target.removeEventListener(type,fn,options));};
 listen(canvas,'webglcontextlost',contextLost);
 listen(canvas,'webglcontextrestored',contextRestored);
 for(const type of ['visibilitychange','guide-motion-change','night-hold'])listen(document,type,gateChange);
 listen(window,'pagehide',event=>{if(event.persisted){sleeping=true;cancel();last=0;}else release('unloaded');});
 listen(window,'pageshow',event=>{if(event.persisted&&sleeping){sleeping=false;requestFrame();}});
 shell.push(onTier(tierChanged));
 return api;

 /* ---- attach and detach ---- */
 function attach(slot,controller){
  if(!api.available||!slot||!controller)return()=>{};
  if(current)detach(current);
  const entry={slot,controller,visible:true,ratio:1,io:null,ro:null};
  current=entry;
  slot.append(canvas);
  if(typeof IntersectionObserver==='function'){
   entry.io=new IntersectionObserver(records=>{
    const record=records[records.length-1];if(current!==entry||!record)return;
    const was=entry.visible;entry.visible=record.isIntersecting;entry.ratio=record.intersectionRatio;
    if(entry.visible!==was)gateChange();
   },{rootMargin:'100px',threshold:[0,.5]});
   entry.io.observe(slot);
  }
  if(typeof ResizeObserver==='function'){entry.ro=new ResizeObserver(()=>{if(current===entry)resize(false);});entry.ro.observe(slot);}
  resize(true);requestFrame();
  return()=>detach(entry);
 }
 function detach(entry){
  if(!entry||current!==entry)return;
  entry.io?.disconnect();entry.ro?.disconnect();
  current=null;cancel();busy=requested=false;last=0;slow={time:0,total:0,count:0};
  if(!canvas)return;
  // The context survives in a hidden shell holder until the next scene attaches.
  if(!park||!park.isConnected){park=document.createElement('div');park.hidden=true;park.setAttribute('aria-hidden','true');park.dataset.nsStagePark='';document.body.append(park);}
  park.append(canvas);
 }

 /* ---- size and quality ---- */
 function resize(force){
  if(!current||!renderer)return;
  const {slot,controller}=current,rect=slot.getBoundingClientRect();
  const w=Math.max(1,Math.round(slot.clientWidth||rect.width||1)),h=Math.max(1,Math.round(slot.clientHeight||rect.height||1));
  const dpr=Math.min(globalThis.devicePixelRatio||1,DPR_CAP[tier()]??DPR_CAP.mid)*quality;
  if(!force&&w===size.w&&h===size.h&&dpr===size.dpr)return;
  size={w,h,dpr};
  renderer.setPixelRatio(dpr);renderer.setSize(w,h,false);
  chain?.resize(w,h,dpr);
  try{controller.resize?.(w,h,dpr);}catch(error){fail(error);return;}
  requestFrame();
 }
 function tierChanged(next){
  if(!renderer)return;
  // Scenes read the tier themselves. Let their handlers run first (they drop to the poster on low),
  // then give the GPU back.
  if(next==='low'){queueMicrotask(()=>release('tier-low'));return;}
  renderer.shadowMap.enabled=next==='high';
  if(next!=='high'&&chain){chain.dispose();chain=null;}
  resize(true);emit(listeners.quality,quality);
 }
 /* Busy frames only: more than 45% over 25 ms across 2 s of busy time lowers the resolution once, then
    drops a tier through the shared watchdog path (core.downgrade), which every Night Shift layer obeys.
    A frame over 250 ms is slow too (a device under 10 fps must be caught) but adds at most 250 ms to the
    window, so a window holds at least 8 frames and one hitch (a first-frame upload, a long task) cannot
    decide it alone. Wakes zero `last`, so time asleep is never a frame. A tier forced with ?tier= is the
    QA and capture override that lets software renderers run the engine: it keeps its tier, and only the
    resolution step applies. */
 function measure(elapsed){
  slow.time+=Math.min(elapsed,SLOW.hitchMs);slow.total++;if(elapsed>SLOW.frameMs)slow.count++;
  if(slow.time<SLOW.windowMs)return;
  const tooSlow=slow.count/slow.total>SLOW.share;
  slow={time:0,total:0,count:0};
  if(!tooSlow)return;
  if(quality===1){quality=.8;resize(true);emit(listeners.quality,quality);}
  else if(!forcedTier())downgrade('book frames');
 }

 /* ---- scheduler ---- */
 function gates(){
  return {visible:!!current?.visible,hidden:typeof document!=='undefined'&&document.hidden,held:held(),
   motion:sceneMotionAllowed(),ambient:ambientAllowed(),ratio:current?.ratio??0};
 }
 function runnable(){return api.available&&!sleeping&&!!current&&current.visible&&!document.hidden&&!held();}
 function requestFrame(){requested=true;schedule();}
 function schedule(){if(raf||!runnable()||!(requested||busy))return;rafs++;raf=requestAnimationFrame(frame);}
 function cancel(){if(raf)cancelAnimationFrame(raf);raf=0;}
 function gateChange(){if(runnable()){last=0;requestFrame();}else{cancel();last=0;sleep();}}
 /* Offscreen, hidden or held, no frame runs until a gate opens, so the controller lands what it was
    animating now instead of playing it out of context later (§4.1). */
 function sleep(){
  const entry=current;if(!entry||typeof entry.controller.sleep!=='function')return;
  try{entry.controller.sleep(gates());}catch(error){fail(error);}
 }
 function frame(now){
  raf=0;
  if(!runnable()){last=0;return;}
  const cap=typeof busy==='number'&&busy>0?busy:0;
  if(cap&&!requested&&last&&now-last<1000/cap-4){rafs++;raf=requestAnimationFrame(frame);return;}
  const elapsed=last?now-last:1000/60;
  if(busy===true&&last)measure(elapsed);
  last=now;requested=false;
  const entry=current;let next;
  try{
   next=entry.controller.update(Math.min(MAX_DT,elapsed/1000),gates());
   if(current!==entry||!renderer)return;
   renderer.info.reset();
   entry.controller.render(renderer,post());
  }catch(error){fail(error);return;}
  frames++;if(next)busyFrames++;
  busy=next||false;
  if(!busy&&!requested){last=0;return;}
  schedule();
 }
 /* A scene that throws is a bug, not a GPU fault: that scene drops to its poster, the stage stays. */
 function fail(error){
  console.warn('Stage scene failed',error);
  const entry=current;detach(entry);emit(listeners.lost,'error');
 }

 /* ---- context loss, bfcache and release ---- */
 function contextLost(event){
  event.preventDefault(); // three does too; restoration needs it
  if(lost)return;lost=true;losses++;
  cancel();busy=requested=false;last=0;dropTargets();
  emit(listeners.lost,'context');
 }
 function contextRestored(){
  if(!lost)return;lost=false;
  if(losses>=2){release('lost',false);return;} // a second loss keeps the poster for the rest of the visit
  emit(listeners.restored);requestFrame();
 }
 function dropTargets(){
  chain?.dispose();chain=null;
  environmentTarget?.dispose();environmentTarget=null;
 }
 function release(reason,notify=true){
  if(!renderer)return;
  terminal=reason;
  const entry=current;
  if(entry){if(notify)emit(listeners.lost,reason);detach(entry);}
  cancel();dropTargets();
  for(const off of shell.splice(0))off();
  try{renderer.dispose();}catch{}
  try{renderer.forceContextLoss();}catch{}
  canvas?.remove();park?.remove();
  renderer=null;canvas=null;park=null;ok=false;why=reason;probed={gl:null,canvas:null,reason};
  for(const set of Object.values(listeners))set.clear();
 }

 /* ---- shared GPU resources ---- */
 /* RoomEnvironment PMREM, built once per context (σ 0.04; 256 at high tier, 128 otherwise). Scenes set it as
    scene.environment and never dispose it. A context loss drops it; scenes remount and ask again. */
 function environment(){
  if(!api.available)return null;
  if(!environmentTarget){
   const pmrem=new T.PMREMGenerator(renderer),room=new T.RoomEnvironment();
   try{environmentTarget=pmrem.fromScene(room,ENVIRONMENT.sigma,.1,100,{size:ENVIRONMENT.size[tier()]??ENVIRONMENT.size.mid});}
   finally{room.dispose?.();pmrem.dispose();}
  }
  return environmentTarget.texture;
 }
 /* High tier only: MSAA half-float target → threshold bloom (on request) → Finish to the canvas. */
 function post(){
  if(!api.available||tier()!=='high')return null;
  if(!chain){chain=createPost(renderer);if(size.w)chain.resize(size.w,size.h,size.dpr);}
  return chain;
 }

 function stats(){
  const info=renderer?.info;
  return {available:api.available,reason:api.reason,attached:!!current,running:!!raf,frames,busyFrames,rafs,
   quality,tier:tier(),width:size.w,height:size.h,dpr:size.dpr,
   drawCalls:info?.render.calls??0,triangles:info?.render.triangles??0,
   geometries:info?.memory?.geometries??0,textures:info?.memory?.textures??0,programs:info?.programs?.length??0,
   post:!!chain,targetBytes:chain?.bytes()??0,environment:!!environmentTarget,losses,
   listeners:{quality:listeners.quality.size,lost:listeners.lost.size,restored:listeners.restored.size,shell:shell.length}};
 }
}

/* ---- post chain (§5.6) ----
   The scene renders into a multisampled half-float target (4 samples, 2 at DPR ≥ 2) without tone mapping.
   UnrealBloomPass (threshold 1.0, so only emitters above white bloom) adds into that target when asked.
   Finish draws to the canvas: PBR Neutral tone map with the renderer's exposure, sRGB encoding, a radial
   chromatic offset that is zero over the book and reaches 0.6 CSS px at the far corner, and ±½ LSB
   interleaved-gradient dither. Alpha is kept premultiplied so the CSS desk shows through. No
   EffectComposer: it would clone the multisampled target. */
const FINISH={
 name:'StageFinish',
 uniforms:{tDiffuse:{value:null},uExposure:{value:1},uResolution:{value:null},uRect:{value:null},uAberration:{value:0}},
 vertexShader:/* glsl */`
  varying vec2 vUv;
  void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`,
 fragmentShader:/* glsl */`
  uniform sampler2D tDiffuse;
  uniform float uExposure;
  uniform vec2 uResolution;  // drawing-buffer px
  uniform vec4 uRect;        // CA-free rect in uv: x0, y0, x1, y1
  uniform float uAberration; // drawing-buffer px at the far corner
  varying vec2 vUv;
  vec3 neutral(vec3 color){
   const float start=.8-.04,desaturation=.15;
   float x=min(color.r,min(color.g,color.b));
   color-=x<.08?x-6.25*x*x:.04;
   float peak=max(color.r,max(color.g,color.b));
   if(peak<start)return color;
   float d=1.-start,next=1.-d*d/(peak+d-start);
   color*=next/peak;
   return mix(color,vec3(next),1.-1./(desaturation*(peak-next)+1.));
  }
  vec3 encode(vec3 c){return mix(pow(c,vec3(1./2.4))*1.055-.055,c*12.92,vec3(lessThanEqual(c,vec3(.0031308))));}
  float gradientNoise(vec2 p){return fract(52.9829189*fract(dot(p,vec2(.06711056,.00583715))));}
  void main(){
   vec4 color=texture2D(tDiffuse,vUv);
   if(uAberration>0.){
    vec2 outside=max(max(uRect.xy-vUv,vUv-uRect.zw),0.)*uResolution;
    vec2 reach=max(uRect.xy,1.-uRect.zw)*uResolution;
    float t=clamp(length(outside)/max(length(reach),1.),0.,1.);
    vec2 dir=(vUv-.5*(uRect.xy+uRect.zw))*uResolution;
    float len=length(dir);
    if(t>0.&&len>0.){
     vec2 shift=dir/len*uAberration*t*t/uResolution;
     color.r=texture2D(tDiffuse,vUv+shift).r;
     color.b=texture2D(tDiffuse,vUv-shift).b;
    }
   }
   vec3 mapped=neutral(max(color.rgb,0.)*uExposure);
   float alpha=clamp(max(color.a,max(mapped.r,max(mapped.g,mapped.b))),0.,1.);
   vec3 straight=alpha>0.?min(mapped/alpha,1.):vec3(0.);
   vec3 encoded=encode(straight)+(gradientNoise(gl_FragCoord.xy)-.5)/255.;
   gl_FragColor=vec4(clamp(encoded,0.,1.)*alpha,alpha);
  }`
};

function createPost(renderer){
 let target=null,bloom=null,samples=0,width=1,height=1,dpr=1;
 const finish=new T.ShaderPass(FINISH);
 finish.renderToScreen=true;finish.material.toneMapped=false;finish.material.depthTest=finish.material.depthWrite=false;
 finish.uniforms.uResolution.value=new T.Vector2(1,1);
 finish.uniforms.uRect.value=new T.Vector4(.5,.5,.5,.5);
 const rect=finish.uniforms.uRect.value;
 function ensureTarget(){
  const want=dpr>=2?2:4;
  if(target&&samples===want){if(target.width!==width||target.height!==height)target.setSize(width,height);return;}
  target?.dispose();samples=want;
  target=new T.WebGLRenderTarget(width,height,{type:T.HalfFloatType,samples,depthBuffer:true,stencilBuffer:false});
  target.texture.name='StageHDR';
 }
 const chain={
  /* options.bloom: run the threshold bloom (dark theme, emitter visible). options.rect: the projected book
     in uv [x0, y0, x1, y1] (y up), kept free of chromatic offset; without it the offset centres on the frame. */
  render(scene,camera,{bloom:withBloom=false,rect:area=null}={}){
   ensureTarget();
   renderer.setRenderTarget(target);renderer.clear();renderer.render(scene,camera);
   if(withBloom){
    bloom??=new T.UnrealBloomPass(new T.Vector2(width,height),BLOOM.strength,BLOOM.radius,BLOOM.threshold);
    bloom.render(renderer,null,target,0,false);
   }
   const u=finish.uniforms;
   u.uExposure.value=renderer.toneMappingExposure;
   if(area)rect.set(area[0],area[1],area[2],area[3]);else rect.set(.5,.5,.5,.5);
   u.uAberration.value=ABERRATION_PX*dpr;
   finish.render(renderer,null,target,0,false);
  },
  resize(w,h,ratio){
   dpr=ratio;width=Math.max(1,Math.floor(w*ratio));height=Math.max(1,Math.floor(h*ratio));
   finish.uniforms.uResolution.value.set(width,height);
   if(target)ensureTarget();
   bloom?.setSize(width,height);
  },
  /* Compile the Finish program while the poster is still up (§5.9), so the first visible frame does not. */
  compile(){
   const quad=new T.Mesh(new T.PlaneGeometry(2,2),finish.material),camera=new T.PerspectiveCamera(); // the Finish vertex shader ignores the camera
   return Promise.resolve().then(()=>renderer.compileAsync(quad,camera)).catch(()=>{}).finally(()=>quad.geometry.dispose());
  },
  /* Resolved colour, multisampled colour and depth; bloom mips at half size and below. */
  bytes(){
   const px=width*height,main=target?px*(8+samples*8+samples*4):0;
   return main+(bloom?Math.round(px/4*8*2*1.34):0);
  },
  dispose(){target?.dispose();bloom?.dispose();finish.dispose();target=bloom=null;}
 };
 return chain;
}
