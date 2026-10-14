/* Semester book scene (semester-book spec §3.3, §4, §5). Side A owns this module; the DOM side mounts it into
   the hero's art slot after probe() passes (§6.1) and talks to it only through the controller below.

   mountBook(slot, options) → Promise<BookController>
     options: { course, state, getView, signal, arrival = { start: 0 }, onOpen, onFallback, dockTarget }
       extra (captures and tests): poster = false   ink 0, no pop-ups, block split 0.5, hero motif (§5.11)
                                   createTextures, createPopupSet   factories replacing A2's modules
     Listen for book-fallback on the slot before calling, or pass onFallback.
   BookController: { ready, metrics(), setHandoff(p), setFocus(id), close({ ms }), requestFrame(), stats(),
     pick(x, y), dispose() }

   The engine renders `state.turn` (the paper) and never decides which week is selected: commands go through
   the state, which calls the animator registered here. Everything time-based runs on the stage clock (the dt
   the stage hands to update), with GSAP eases from gsap.parseEase; there is no second ticker. Words come only
   from getView (B's describeSpread) through textures.mjs; pop-ups are popup.mjs sets posed on the paper.

   Also exported (pure, for tests, posters and Stage 5): motionMode(), ease(name), TIMING, turnPlan(from, to,
   elapsed, {tier}), POSES ('open-hero' | 'closed-on-desk' | 'docked'), handoffPose(p), and the framing helpers
   re-exported from book-geometry.mjs. Slot dataset written here: renderer, rendererReason, sceneReady, awake,
   motionState, quality, tier, post, sceneFrame, drawCalls, triangles, week, turn, dragging, cursor. Events on
   the slot: book-ready, book-fallback, book-hover {id}, book-turn {phase, from, to}. */
import * as T from '../app/three.mjs?v=20261013-stage1';
import {probe,getStage} from '../app/stage.mjs?v=20261013-stage1';
import {tier as currentTier,onTier,held,preference,sceneMotionAllowed} from '../night/core.mjs?v=20261014-book1';
import {gsap} from '../vendor/gsap-3.15.0.mjs';
import {createBookTextures} from './textures.mjs';
import {createPopupSet,PALETTES,restPose,popupSpec} from './popup.mjs';
import {bookStyle,currentTheme,onTheme} from './course-styles.mjs?v=20261013-book1';
import {createSheet,createPageUniforms,createPageMaterial,pagePlane,sheetRadius,stackMix,dipDepth,bendBounds,GUTTER,STATIC_SEGMENTS,SHEET_SEGMENTS,SHEET_ROWS} from './page-bend.mjs?v=20261013-book1';
import {blockHeights,createBoards,createBlock,createEdgeMaterial,createBlotter,createContactShadow,createShadowCatcher,createRibbon,createBand,createSpine,
 spreadLayout,fitCamera,projectRect,containFactor,pickPaper,faceUV,isCorner,canDrag} from './book-geometry.mjs?v=20261013-book1';

export {OPEN_HERO,framingFor,spreadLayout,bookToWorld,fitCamera,projectRect} from './book-geometry.mjs?v=20261013-book1';

const clamp=(value,low,high)=>Math.min(high,Math.max(low,value));
const lerp=(a,b,t)=>a+(b-a)*t;
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
const DEG=Math.PI/180;
const now=()=>globalThis.performance?.now?.()??Date.now();
const rectFrom=(left,top,width,height)=>({x:left,y:top,left,top,width,height,right:left+width,bottom:top+height});
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const DRIFT_QUIET_MS=2000;

/* ---------------------------------------------------------------- motion policy (§4.1) ------------------- */
/** full: scene motion allowed and no hold. fade: OS reduced motion is the only reason. cut: everything else
    (?motion=off, Pause motion, a dialog hold). The same table as course-header's policy(). */
export function motionMode(){
 if(sceneMotionAllowed()&&!held())return 'full';
 const p=preference()||{};
 return p.reduced&&!p.forced&&!p.scenePaused&&!p.paused&&!held()?'fade':'cut';
}
/** GSAP eases by name (gsap.parseEase), cached; unknown names are linear. */
export const ease=(()=>{const cache=new Map();return name=>{if(!cache.has(name)){let fn=null;try{fn=gsap.parseEase(name);}catch{}cache.set(name,typeof fn==='function'?fn:t=>t);}return cache.get(name);};})();

/* Turn and arrival timings (§5.8), seconds. */
export const TIMING=Object.freeze({turn:.72,step:.46,stepStagger:.11,riffle:.38,riffleStagger:.07,riffleMax:.9,fade:.15,
 arrivalFade:.3,reducedFade:.15,develop:.5,dolly:1.2,riseDelay:.25,rise:.82,riseStagger:.14,late:1.2,theme:.36,refit:.4,close:.35,band:.55});

/** The sheets in the air for an engine-run turn from `from` to `to` (integers) at `elapsed` seconds (§5.8).
    Pure; tests drive it. → {kind, dir, n, m, total, stagger, local: [linear t per sheet], done} */
export function turnPlan(from,to,elapsed,{tier='high'}={}){
 const n=Math.abs(to-from),dir=Math.sign(to-from)||1;
 if(n<=1){const total=TIMING.turn,t=clamp(elapsed/total,0,1);return {kind:'turn',dir,n,m:1,total,stagger:0,local:[t],done:t>=1};}
 if(n<=4){
  // Mid tier keeps at most two sheets in the air.
  const m=n,stagger=tier==='high'?TIMING.stepStagger:Math.max(TIMING.stepStagger,TIMING.step/2),total=TIMING.step+(m-1)*stagger;
  const local=Array.from({length:m},(_,j)=>clamp((elapsed-j*stagger)/TIMING.step,0,1));
  return {kind:'sequence',dir,n,m,total,stagger,local,done:elapsed>=total};
 }
 const m=tier==='high'?4:2,stagger=Math.min(TIMING.riffleStagger,(TIMING.riffleMax-TIMING.riffle)/Math.max(1,m-1)),total=TIMING.riffle+(m-1)*stagger;
 const local=Array.from({length:m},(_,j)=>clamp((elapsed-j*stagger)/TIMING.riffle,0,1));
 return {kind:'riffle',dir,n,m,total,stagger,local,done:elapsed>=total};
}

/* Named poses (§5.8 Stage 5 hooks). fold: the front half over the spine (0 open, 1 shut); travel: the way to
   the dock (0 on the desk, 1 at the dock's course mark); scale of the book. 'closed-on-desk' is defined for
   the Stage 5 Desk and unused here. */
export const POSES=Object.freeze({
 'open-hero':Object.freeze({fold:0,travel:0,scale:1}),
 'closed-on-desk':Object.freeze({fold:1,travel:0,scale:1}),
 docked:Object.freeze({fold:1,travel:1,scale:.16})
});
/** The scroll handoff p ∈ [0, 1] as a blend of the named poses: open-hero → shut by p = 0.55 (the band snaps
    there) → docked at p = 1, the canvas fading over p 0.82–1. Pure. */
export function handoffPose(p){
 const v=clamp(Number(p)||0,0,1),fold=smooth(0,.55,v),k=ease('power2.inOut')(smooth(.55,1,v));
 const a=POSES['open-hero'],b=POSES.docked;
 return {fold:lerp(a.fold,b.fold,fold),travel:k,scale:lerp(a.scale,b.scale,k),opacity:1-smooth(.82,1,v),shut:v>=.55};
}

/* ---------------------------------------------------------------- mountBook ------------------------------ */

export async function mountBook(slot,options={}){
 if(!slot||typeof slot.getBoundingClientRect!=='function')throw new TypeError('mountBook needs the art slot element');
 const {signal}=options;
 if(signal?.aborted)return posterController(slot,options,'aborted',{silent:true});
 const status=probe();
 if(!status.ok)return posterController(slot,options,status.reason);
 const stage=getStage();
 if(!stage.available)return posterController(slot,options,stage.reason||'unavailable');
 const style=bookStyle(options.course||options.state?.course||'mth140');
 if(!style)return posterController(slot,options,'no-style');
 return createBookController(slot,options,stage,style);
}

/* The facade B holds. It survives one remount after a context restore and turns into the poster controller
   on any failure, so B's reference never goes stale. */
async function createBookController(slot,options,stage,style){
 const {signal}=options;
 let engine=null,disposed=false,remounts=0,fallbackReason=null,settleReady,handoff=0,focus=null;
 const ready=new Promise(resolve=>{settleReady=resolve;});
 const data=slot.dataset;
 const report=reason=>{
  if(fallbackReason||disposed)return;fallbackReason=reason;
  Object.assign(data,{renderer:'poster',rendererReason:reason,sceneReady:'true',awake:'false',motionState:'still',post:'off',dragging:'false',cursor:''});
  settleReady('poster');
  try{options.onFallback?.(reason);}catch(error){console.warn('Book fallback handler failed',error);}
  slot.dispatchEvent(new CustomEvent('book-fallback',{detail:{reason}}));
 };
 const fail=reason=>{
  if(disposed)return;
  const old=engine;engine=null;old?.dispose();
  report(reason);
 };
 const offLost=stage.onLost(reason=>{if(!disposed&&engine)fail(reason==='context'?'lost':reason);});
 const offRestored=stage.onRestored(remount);
 function remount(){
  if(disposed||engine||remounts>=1||currentTier()==='low'||fallbackReason!=='lost')return;
  remounts++;fallbackReason=null;
  const losses=stage.stats().losses;
  build().then(()=>attachEngine(losses)).catch(error=>{console.warn('Book remount failed',error);report('lost');});
 }
 async function build(){
  const next=await createEngine(slot,{...options,style,onReady:()=>settleReady('webgl2'),isRemount:remounts>0});
  if(disposed){next.dispose();return;}
  engine=next;
 }
 /* The stage reports a shader failure or a context loss only to an attached scene, so one that came while
    the engine compiled is caught here (§5.9): the poster takes over, a restore remounts once, and a loss
    already restored during the build costs that one remount (the environment and targets went with it). */
 function attachEngine(losses){
  if(disposed||!engine)return;
  if(stage.available&&stage.stats().losses===losses){engine.setHandoff(handoff);engine.setFocus(focus);engine.attach();return;}
  const restored=stage.available;
  fail(restored?'lost':stage.reason||'unavailable');
  if(restored)remount();
 }
 const dispose=()=>{
  if(disposed)return;disposed=true;
  signal?.removeEventListener?.('abort',dispose);
  offLost();offRestored();
  engine?.dispose();engine=null;
  data.awake='false';settleReady('poster');
 };
 signal?.addEventListener?.('abort',dispose,{once:true});
 const losses=stage.stats().losses;
 try{await build();}
 catch(error){console.warn('Book scene unavailable',error);engine=null;report(/shader/i.test(String(error?.message))?'shader':'error');}
 if(disposed||signal?.aborted){dispose();return posterController(slot,options,'aborted',{silent:true});}
 attachEngine(losses);
 const fallbackMetrics=()=>{const r=slot.getBoundingClientRect(),s=spreadLayout(r.width,r.height,globalThis.innerWidth||r.width);
  return {pageWidthPx:s.pageWidth,spreadRect:rectFrom(r.left+s.left,r.top+s.top,s.width,s.height),stageRect:rectFrom(r.left,r.top,r.width,r.height)};};
 return {
  ready,
  metrics(){return engine?.metrics()??fallbackMetrics();},
  setHandoff(p){const v=Number(p);handoff=Number.isFinite(v)?clamp(v,0,1):0;engine?.setHandoff(handoff);},
  setFocus(id){focus=id==null?null:String(id);engine?.setFocus(focus);},
  close(opts={}){return engine?engine.close(opts):Promise.resolve();},
  requestFrame(){engine?.requestFrame();},
  stats(){return {...(engine?.stats()??{renderer:'poster',reason:fallbackReason,frames:0,drawCalls:0,triangles:0}),disposed,remounts,handoff,focus,subscribed:!!engine};},
  /** Diagnostics and tests: what is under client (x, y); null on the poster. */
  pick(x,y){return engine?.pick(x,y)??null;},
  dispose
 };
}

/* ---------------------------------------------------------------- the engine ----------------------------- */

async function createEngine(slot,options){
 const {state,getView,arrival={start:0},onOpen,dockTarget,style,onReady,isRemount=false,poster=false}=options;
 const stage=getStage(),renderer=stage.renderer,data=slot.dataset;
 const {W,H}=style.dims,o=style.dims.board.overhang,t=style.dims.board.thickness;
 let tierName=currentTier()==='high'?'high':'mid',theme=currentTheme(),disposed=false,attached=false,detach=null,firstFrame=false;
 const cleanup=[];
 const fault=(where,error)=>console.warn(`Book ${where} failed`,error);
 let requestFrame=()=>stage.requestFrame();

 /* ---- spread views ---- */
 const count=()=>Math.max(1,state?.weeks?.length??1);
 const snap=()=>state?.snapshot?.()??{index:0,turn:0,settled:true,count:1,today:0};
 const views=new Map();
 const view=i=>{
  if(!Number.isInteger(i)||i<0||i>=count())return null;
  if(!views.has(i)){let v=null;try{v=getView?.(i)??null;}catch(error){fault('view',error);}views.set(i,v);}
  return views.get(i);
 };
 const faceId=(side,i)=>side==='L'?(i<=0?'endpaper':'L'+i):'R'+i;
 const motionNow=()=>motionMode();
 /* Attached, on screen (the stage's 100 px margin) and the tab visible: otherwise no frame runs (§4.1). */
 const renderable=()=>{const g=stage.gates();return attached&&g.visible&&!g.hidden;};

 /* ---- textures (A2) ---- */
 const textures=(options.createTextures||createBookTextures)({getView:view,tier:tierName,renderer,poster,onChange:()=>requestFrame()});
 await Promise.race([textures.ready,wait(1500)]).catch(()=>{});
 function safe(fn,fallback){try{return fn()??fallback;}catch(error){fault('textures',error);return fallback;}}
 const paperMaps=safe(()=>textures.paper(),{}),linenMaps=safe(()=>textures.linen(),{});
 const tooth=paperMaps.normal??null,linenNormal=linenMaps.normal??null,linenRough=linenMaps.roughness??null;
 if(tooth)tooth.repeat.set(6,6*H/W);
 if(linenNormal){linenNormal.repeat.set(1/.0144,1/.0144);if(linenRough)linenRough.repeat.copy(linenNormal.repeat);}

 /* ---- scene graph ---- */
 const scene=new T.Scene();scene.name='semester-book';
 const camera=new T.PerspectiveCamera(24,1,.05,10);
 const world=new T.Group();world.name='world';scene.add(world);
 const desk=new T.Group();desk.name='desk';desk.rotation.x=-Math.PI/2;desk.position.z=H/2;world.add(desk);
 const carrier=new T.Group();carrier.name='book-carrier';world.add(carrier);          // handoff: travel and scale
 const book=new T.Group();book.name='book';book.rotation.x=-Math.PI/2;book.position.z=H/2;carrier.add(book);
 const frontPivot=new T.Group();frontPivot.name='front-pivot';book.add(frontPivot);    // closes over the spine
 const frontHalf=new T.Group();frontHalf.name='front-half';frontPivot.add(frontHalf);
 const backHalf=new T.Group();backHalf.name='back-half';book.add(backHalf);

 const themes={dark:resolveTheme(style.themes.dark),light:resolveTheme(style.themes.light)};
 let look=cloneLook(themes[theme]);

 // Lights (§5.6). One key spot serves both themes (night lamp, distant window), so a theme change tweens.
 const key=new T.SpotLight(0xffffff,1,0,34*DEG,.7,2);key.name='key';
 const keyTarget=new T.Group();keyTarget.name='key-target';scene.add(keyTarget);key.target=keyTarget;
 const fill=new T.HemisphereLight(0xffffff,0x000000,.35);fill.name='fill';
 const rim=new T.DirectionalLight(0xffffff,.5);rim.name='rim';
 scene.add(key,fill,rim);
 key.shadow.bias=-.0002;key.shadow.normalBias=.0005;key.shadow.radius=2;key.shadow.camera.near=.08;key.shadow.camera.far=4;

 // Materials.
 const pageShared=createPageUniforms(style.themes[theme],style.dims);
 const edge=createEdgeMaterial(style.themes[theme]);
 const linen=makeCloth(tierName,{normalMap:linenNormal,roughnessMap:linenRough,normalScale:style.themes[theme].linen.normalScale});linen.name='linen';
 const cover=makeCloth(tierName,{});cover.name='cover';
 const ribbonMaterial=makeCloth(tierName,{});ribbonMaterial.name='ribbon';
 const bandMaterial=makeCloth(tierName,{});bandMaterial.name='band';bandMaterial.side=T.DoubleSide;
 const felt=tooth?.clone?.()??null;if(felt){felt.repeat.set(26,18);felt.needsUpdate=true;}
 const blotterMaterial=makeCloth(tierName,{normalMap:felt,normalScale:.6});blotterMaterial.name='blotter';
 const spineMaterial=makeCloth(tierName,{normalMap:linenNormal,normalScale:.3});spineMaterial.name='spine';
 const coverMaps=safe(()=>textures.cover(),null);
 if(coverMaps?.normal){
  // The front cover is the left board's outer face; folded shut it reads with the spine on the left.
  for(const map of [coverMaps.normal,coverMaps.roughness].filter(Boolean)){map.repeat.set(-1/(W+o),1/(H+2*o));map.offset.set(0,o/(H+2*o));map.needsUpdate=true;}
  cover.normalMap=coverMaps.normal;cover.normalScale=new T.Vector2(.6,.6);if(coverMaps.roughness)cover.roughnessMap=coverMaps.roughness;
 }

 // The object.
 const boards=createBoards(style,linen);
 frontHalf.add(boards.left);backHalf.add(boards.right);book.add(boards.hinge);
 for(const m of [boards.left,boards.right])m.castShadow=true;
 const blocks={left:createBlock(style,edge.material,-1),right:createBlock(style,edge.material,1)};
 frontHalf.add(blocks.left.mesh);backHalf.add(blocks.right.mesh);
 blocks.left.mesh.castShadow=blocks.right.mesh.castShadow=true;
 const statics={left:makeStatic('back'),right:makeStatic('front')};
 frontHalf.add(statics.left.mesh);backHalf.add(statics.right.mesh);
 const ribbon=createRibbon(style,ribbonMaterial);book.add(ribbon.mesh);
 const band=style.band?createBand(style,bandMaterial):null;if(band)backHalf.add(band.group);
 const spine=createSpine(style,spineMaterial);book.add(spine.mesh);
 const blotter=createBlotter(style,blotterMaterial);desk.add(blotter.mesh);
 const catcher=createShadowCatcher(style);desk.add(catcher.mesh);
 const contact=createContactShadow(style);desk.add(contact.mesh);
 const sheetsGroup=new T.Group();sheetsGroup.name='sheets';book.add(sheetsGroup);
 const sheets=[];
 const maxSheets=()=>tierName==='high'?3:2;
 function sheetAt(i){
  while(sheets.length<=i){const s=createSheet({W,H,shared:pageShared,tier:tierName,toothMap:tooth});sheetsGroup.add(s.group);sheets.push(s);}
  return sheets[i];
 }
 function makeStatic(side){
  const {material,uniforms}=createPageMaterial(pageShared,{side,tier:tierName,toothMap:tooth});
  material.polygonOffset=true;material.polygonOffsetFactor=1;material.polygonOffsetUnits=1;
  const mesh=new T.Mesh(pagePlane(W,H,STATIC_SEGMENTS[tierName]??1,1,{gutter:true}),material);
  mesh.name='page-'+(side==='back'?'left':'right');mesh.receiveShadow=true;mesh.raycast=()=>{};mesh.frustumCulled=false;
  return {mesh,material,uniforms,face:null,
   set(z){uniforms.uStackZ.value.set(z,z);uniforms.uDip.value=dipDepth(z);},
   retier(){const old=mesh.geometry;mesh.geometry=pagePlane(W,H,STATIC_SEGMENTS[tierName]??1,1,{gutter:true});old.dispose();}};
 }
 function makeCloth(level,{normalMap=null,roughnessMap=null,normalScale=.35}={}){
  const material=level==='high'
   ?new T.MeshPhysicalMaterial({color:0xffffff,roughness:.8,sheen:.4,sheenRoughness:.5,sheenColor:new T.Color(0xffffff)})
   :new T.MeshStandardMaterial({color:0xffffff,roughness:.8});
  if(normalMap){material.normalMap=normalMap;material.normalScale=new T.Vector2(normalScale,normalScale);}
  if(roughnessMap)material.roughnessMap=roughnessMap;
  return material;
 }

 // Pop-up sets (A2): one per shown spread; two cover a turn (outgoing and incoming).
 const labels=entry=>{try{const spec=popupSpec(entry);return textures.labelSlot(entry,{aspect:spec.tag.w/spec.tag.h});}catch(error){fault('label',error);return null;}};
 const stampTexture=safe(()=>textures.stamp(),null);
 const makeSet=options.createPopupSet||createPopupSet;
 const popupSets=[0,1].map(()=>{
  const set=makeSet({tier:tierName,labels,stamp:stampTexture,palette:PALETTES[theme],castShadow:tierName==='high',ease});
  set.userData={index:-1,signature:null};set.setVisible(false);book.add(set.group);
  return set;
 });

 /* ---- theme (§5.5, §5.6): resolved records, mixed by a tween ---- */
 function resolveTheme(s){
  const c=hex=>new T.Color(hex);
  return {
   paper:c(s.paper),pencil:c(s.pencil),ink:c(s.ink),accent:c(s.accent),ao:s.gutter.ao,
   edgeBase:c(s.edge.base),edgeLine:c(s.edge.line),edgeGap:c(s.edge.gap),
   linen:c(s.linen.color),linenRough:s.linen.roughness,linenSheen:s.linen.sheen,linenSheenColor:c(s.linen.sheenColor),linenSheenRough:s.linen.sheenRoughness,
   elastic:c(s.elastic.color),elasticRough:s.elastic.roughness,elasticSheen:s.elastic.sheen,elasticSheenColor:c(s.elastic.sheenColor),
   ribbon:c(s.ribbon.color),ribbonRough:s.ribbon.roughness,ribbonSheen:s.ribbon.sheen,ribbonSheenColor:c(s.ribbon.sheenColor),
   blotter:c(s.blotter.color),blotterSheen:s.blotter.sheen,blotterSheenColor:c(s.blotter.sheenColor),
   contact:c(s.contact.color),contactOpacity:s.contact.opacity,curl:s.curl,
   keyColor:c(s.key.color),keyPos:new T.Vector3(...s.key.position),keyTarget:new T.Vector3(...s.key.target),keyAngle:s.key.angle,keyPenumbra:s.key.penumbra,keyDecay:s.key.decay,keyE:s.key.E,
   sky:c(s.fill.sky),ground:c(s.fill.ground),fill:s.fill.intensity,
   rimColor:c(s.rim.color),rimPos:new T.Vector3(...s.rim.position),rim:s.rim.intensity,
   env:s.environment,exposure:s.exposure,shadowOpacity:s.shadowOpacity,dark:s===style.themes.dark?1:0,
   spineGlow:c(s.emissive.spine),spineGain:s.emissive.spineGain
  };
 }
 function cloneLook(r){const out={};for(const [k,v] of Object.entries(r))out[k]=v?.clone?v.clone():v;return out;}
 function mixLook(a,b,k,out){
  for(const name of Object.keys(a)){const x=a[name],y=b[name];if(x?.isColor||x?.isVector3)out[name].copy(x).lerp(y,k);else out[name]=lerp(x,y,k);}
  return out;
 }
 function applyLook(l){
  pageShared.uPaper.value.copy(l.paper);pageShared.uPencil.value.copy(l.pencil);pageShared.uInkColor.value.copy(l.ink);pageShared.uAccent.value.copy(l.accent);pageShared.uAO.value.x=l.ao;
  edge.uniforms.uEdgeBase.value.copy(l.edgeBase);edge.uniforms.uEdgeLine.value.copy(l.edgeLine);edge.uniforms.uEdgeGap.value.copy(l.edgeGap);
  for(const m of [linen,cover,spineMaterial])cloth(m,l.linen,l.linenRough,l.linenSheen,l.linenSheenColor,l.linenSheenRough);
  cloth(bandMaterial,l.elastic,l.elasticRough,l.elasticSheen,l.elasticSheenColor,.35);
  cloth(ribbonMaterial,l.ribbon,l.ribbonRough,l.ribbonSheen,l.ribbonSheenColor,.25);
  cloth(blotterMaterial,l.blotter,1,l.blotterSheen,l.blotterSheenColor,.8);
  contact.material.color.copy(l.contact);
  catcher.material.opacity=.3*l.shadowOpacity+.12*l.dark;
  key.color.copy(l.keyColor);key.position.copy(l.keyPos);keyTarget.position.copy(l.keyTarget);key.angle=l.keyAngle*DEG;key.penumbra=l.keyPenumbra;key.decay=l.keyDecay;
  const d=l.keyPos.distanceTo(l.keyTarget);key.intensity=l.keyE*Math.pow(d,l.keyDecay);
  key.shadow.focus=clamp(Math.atan(.24/d)/(l.keyAngle*DEG),.15,1);
  fill.color.copy(l.sky);fill.groundColor.copy(l.ground);fill.intensity=l.fill;
  rim.color.copy(l.rimColor);rim.position.copy(l.rimPos);rim.intensity=l.rim;
  scene.environmentIntensity=l.env;renderer.toneMappingExposure=l.exposure;
 }
 function cloth(material,color,roughness,sheen,sheenColor,sheenRoughness){
  material.color.copy(color);material.roughness=roughness;
  if(material.isMeshPhysicalMaterial){material.sheen=sheen;material.sheenColor.copy(sheenColor);material.sheenRoughness=sheenRoughness;}
 }
 function setShadowSize(){
  const size=tierName==='high'?style.themes[theme].shadow:0;
  key.castShadow=size>0;
  if(size>0&&key.shadow.mapSize.x!==size){key.shadow.mapSize.set(size,size);key.shadow.map?.dispose();key.shadow.map=null;}
 }
 applyLook(look);setShadowSize();
 scene.environment=stage.environment();

 /* ---- the block, ribbon and band follow the settled spread (§5.1) ---- */
 let blockFor=-1;
 const restIndex=()=>poster?(count()-1)/2:snap().index;
 function layoutBlock(index){
  if(blockFor===index)return;blockFor=index;
  const {zL,zR}=blockHeights(index,count(),style.dims.block);
  blocks.left.setHeight(zL);blocks.right.setHeight(zR);statics.left.set(zL);statics.right.set(zR);
  const today=poster?index:snap().today??index;
  if(Math.round(today)===Math.round(index))ribbon.layout({mode:'gutter',zL,zR});
  else{
   const span=Math.max(1,count()-1),side=today>index?1:-1,zHalf=side>0?zR:zL,depth=Math.abs(today-index)*style.dims.block/span;
   ribbon.layout({mode:'block',side,z:clamp(zHalf-depth,.0004,zHalf-.0003),tail:clamp(.008+.0016*Math.abs(today-index),.008,.03)});
  }
 }

 /* ---- the paper: which faces show where (§5.2 swap rules) ---- */
 const motion={run:null};
 let dragVelocity=0;
 /* The current moment: static faces, sheets in the air (local turn, faces) and the spreads whose pop-ups show,
    each with the sheet its feet ride on ('out' stands on its right foot, 'in' on its left). */
 function plan(){
  const run=motion.run;
  if(run?.kind==='fade'){
   return {left:faceId('L',run.from),right:faceId('R',run.from),leftB:faceId('L',run.to),rightB:faceId('R',run.to),fade:run.p,
    sheets:[],spreads:[{index:run.p<.5?run.from:run.to,role:null}]};
  }
  if(run&&run.kind!=='turn')return enginePlan(run);
  const s=snap(),turn=clamp(s.turn,0,count()-1),k=Math.floor(turn+1e-6),f=turn-k;
  if(poster){const i=Math.round(restIndex());return {left:faceId('L',i),right:faceId('R',i),sheets:[],spreads:[]};}
  if(f<1e-4)return {left:faceId('L',k),right:faceId('R',k),sheets:[],spreads:[{index:k,role:null}]};
  const sheet={k,t:f,front:faceId('R',k),back:faceId('L',k+1),v:dragVelocity,slot:0};
  return {left:faceId('L',k),right:faceId('R',k+1),sheets:[sheet],spreads:[{index:k,role:'out',sheet},{index:k+1,role:'in',sheet}]};
 }
 function enginePlan(run){
  const {from,to,dir}=run,p=run.plan,local=p.local.map(x=>run.ease(x)),m=local.length;
  const started=local.filter(x=>x>0).length,landed=local.filter(x=>x>=1).length,list=[];
  local.forEach((x,j)=>{
   if(!(x>0&&x<1))return;
   let k,front,back;
   if(p.kind==='riffle'){
    // Intermediate riffle sheets carry the shared generic face and no pop-ups.
    k=dir>0?from:from-1;front='riffle';back='riffle';
    if(dir>0){if(j===0)front=faceId('R',from);if(j===m-1)back=faceId('L',to);}
    else{if(j===0)back=faceId('L',from);if(j===m-1)front=faceId('R',to);}
   }else{k=dir>0?from+j:from-j-1;front=faceId('R',k);back=faceId('L',k+1);}
   list.push({k,t:dir>0?x:1-x,front,back,slot:j,v:0});
  });
  let left,right;
  if(p.kind==='riffle'){
   if(dir>0){left=landed===0?faceId('L',from):landed<m?'riffle':faceId('L',to);right=started?faceId('R',to):faceId('R',from);}
   else{right=landed===0?faceId('R',from):landed<m?'riffle':faceId('R',to);left=started?faceId('L',to):faceId('L',from);}
  }else{
   left=dir>0?faceId('L',from+landed):faceId('L',from-started);right=dir>0?faceId('R',from+started):faceId('R',from-landed);
  }
  // Outgoing pop-ups ride the first sheet, incoming ones the last; each set shows only while its sheet moves.
  const sheetFor=j=>({t:dir>0?local[j]:1-local[j],v:0,slot:j});
  const spreads=[];
  if(local[0]<1)spreads.push({index:from,role:dir>0?'out':'in',sheet:sheetFor(0)});
  if(local[m-1]>0)spreads.push({index:to,role:dir>0?'in':'out',sheet:sheetFor(m-1)});
  return {left,right,sheets:list.slice(0,maxSheets()),spreads};
 }

 /* ---- animator (registered on the state; §3.1, §5.8) ---- */
 const animator={
  animate(from,to,{mode='full',ease:easeName,duration}={}){
   endRun();
   return new Promise(resolve=>{
    const live=motionNow(),integral=Math.abs(from-Math.round(from))<1e-4&&Math.abs(to-Math.round(to))<1e-4;
    // Offscreen, hidden or not attached yet, the week lands at once (the state settles and announces it)
    // instead of turning later, out of context, when the reader comes back.
    if(mode==='cut'||live==='cut'||disposed||!renderable()){resolve();return;}
    let run;
    if(mode==='fade'||live==='fade')run={kind:'fade',from:Math.round(from),to:Math.round(to),duration:TIMING.fade};
    else if(!integral||Math.abs(to-from)<=1)run={kind:'turn',from,to,duration:(duration??TIMING.turn*1000)/1000,ease:ease(easeName||style.ease.turn)};
    else{const p=turnPlan(Math.round(from),Math.round(to),0,{tier:tierName});run={kind:p.kind,from:Math.round(from),to:Math.round(to),dir:p.dir,plan:p,duration:p.total,ease:ease(style.ease.turn)};}
    run.elapsed=0;run.p=0;run.resolve=resolve;motion.run=run;
    paintFor(run);emitTurn('start',run.from,run.to);
    requestFrame();
   });
  },
  cancel(){endRun();}
 };
 function endRun(){const run=motion.run;if(!run)return;motion.run=null;run.resolve?.();}
 function landRun(){const run=motion.run;if(!run)return;motion.run=null;run.p=1;run.resolve?.();emitTurn('land',run.from,run.to);}
 function emitTurn(phase,from,to){try{slot.dispatchEvent(new CustomEvent('book-turn',{detail:{phase,from,to}}));}catch{}}
 /* The faces a turn shows are painted as it starts (the settle prefetch has usually done it already). */
 function paintFor(run){
  const ids=new Set([faceId('L',run.to),faceId('R',run.to)]);
  if(run.kind==='turn'){const k=Math.floor(Math.min(run.from,run.to)+1e-6);ids.add(faceId('R',k));ids.add(faceId('L',k+1));ids.add(faceId('R',k+1));}
  if(run.kind==='riffle')ids.add('riffle');
  for(const id of ids){try{textures.paint(id);}catch(error){fault('paint',error);}}
 }

 /* ---- state subscription (§3.3) ---- */
 let unsubscribe=null;
 if(state){
  try{state.setAnimator?.(animator);}catch(error){fault('animator',error);}
  unsubscribe=state.subscribe?.((s,change)=>{
   if(disposed)return;
   if(change.kind==='weeks'){
    const before=new Map(views);views.clear();
    for(const [i,old] of before){const fresh=view(i);if(fresh&&old&&fresh.signature===old.signature)views.set(i,old);}
    try{textures.refresh();}catch(error){fault('refresh',error);}
    blockFor=-1;refit();
   }
   if(change.kind==='select'){refit();touched();}
   if(change.kind==='settle'){
    dragVelocity=0;refit();
    if(motion.run?.kind==='turn')motion.run=null;
    if(!poster)prefetch(s.index);
   }
   if(change.kind==='turn')touched();
   data.week=String(s.index);data.turn=Number(s.turn).toFixed(2);
   requestFrame();
  },{continuous:true})??null;
 }
 function prefetch(i){
  const ids=[faceId('R',i+1),faceId('L',i+1),...(tierName==='high'?[faceId('R',i-1),faceId('L',i-1)]:[])]
   .filter(id=>{const n=id==='endpaper'?0:Number(id.slice(1));return n>=0&&n<count();});
  try{textures.want(ids,{prefetch:true});}catch(error){fault('prefetch',error);}
 }

 /* ---- camera (§5.7) ---- */
 let size={w:Math.max(1,slot.clientWidth||1),h:Math.max(1,slot.clientHeight||1),dpr:1};
 const fit={viewport:globalThis.innerWidth||size.w,distance:null,from:null,start:0,target:null,pose:null,limit:''};
 function fitPoints(index){
  const {zL,zR}=blockHeights(index,count(),style.dims.block),pts=[];
  for(const x of [-W-o,W+o])for(const y of [-o,H+o])for(const z of [0,-t])pts.push([x,y,z]);
  for(const [x,z] of [[-W,zL],[W,zR]])for(const y of [0,H])pts.push([x,y,z]);
  pts.push([0,H/2,2*W/Math.PI+Math.max(zL,zR)]);                         // the hood at mid-turn
  const v=poster?null:view(index);let tallest=0;
  for(const id of v?.popups||[]){const e=v.entries?.find(x=>x.id===id);if(e)tallest=Math.max(tallest,popupSpec(e).height);}
  if(tallest)pts.push([0,H*.64,tallest+Math.max(zL,zR)]);
  pts.push([.02,-o-.002,0]);                                               // where the ribbon leaves the board
  return pts;
 }
 /* Recompute the fitted distance (resize, week change); in full mode the camera eases to it over 400 ms. */
 function refit(){
  const index=Math.round(poster?restIndex():snap().index);
  const r=fitCamera(camera,size.w,size.h,fit.viewport,fitPoints(index),{H});
  fit.pose=r.pose;fit.limit=r.limit;
  if(fit.distance==null||motionNow()!=='full'||!firstFrame||!renderable()){fit.distance=fit.target=r.distance;fit.from=null;}
  else if(Math.abs(r.distance-(fit.target??r.distance))>1e-6){fit.from=fit.distance;fit.target=r.distance;fit.start=clock;}
  requestFrame();
 }
 function placeCamera({yaw=0,pitch=0,dolly=1}={}){fitCamera(camera,size.w,size.h,fit.viewport,null,{H,distance:fit.distance,dolly,yaw,pitch});}
 const spreadPoints=()=>[[-W-o,-o,0],[W+o,-o,0],[-W-o,H+o,0],[W+o,H+o,0]];

 /* ---- choreography state (stage clock, seconds) ---- */
 let clock=0,lastInput=-Infinity,readyAt=null,canvasAlpha=0,develop=poster?0:1,arrivalPlan=null,dolly=1;
 const drift={amount:0,yaw:0,pitch:0,dolly:1,px:0,py:0,tx:0,ty:0,phase:0};
 let handoff=0,focus=null,hoverId=null,closing=null,themeTween=null,bandSnap=null,bandClosed=false;
 /* Drift waits 2 s after the last turn, drag or scrub (§5.7). The stage clock stops with the frames, so the
    wait is wall time, and one timer wakes the stage when it ends (nothing else would ask for that frame). */
 let wakeTimer=0;
 function touched(){lastInput=now();if(wakeTimer){clearTimeout(wakeTimer);wakeTimer=0;}}
 function wakeAfter(ms){if(!wakeTimer&&!disposed)wakeTimer=setTimeout(()=>{wakeTimer=0;requestFrame();},Math.ceil(ms)+20);}

 /* ---- input: hover, corner drag, clicks (§5.10; mouse) ---- */
 const raycaster=new T.Raycaster(),inverse=new T.Matrix4(),ndcPoint=new T.Vector2(),pointer={x:0,y:0,inside:false,dirty:false};
 let drag=null,suppressClick=false,liveSheets=[];
 /** Nearest of the interactive pop-up meshes, the live sheets and the static pages, then the face's printed
     regions (textures.hit) or the corner/page zones. Client coordinates. */
 function pick(clientX,clientY){
  const r=slot.getBoundingClientRect();
  ndcPoint.set(((clientX-r.left)/Math.max(1,r.width))*2-1,-((clientY-r.top)/Math.max(1,r.height))*2+1);
  camera.updateMatrixWorld();raycaster.setFromCamera(ndcPoint,camera);
  book.updateMatrixWorld(true);inverse.copy(book.matrixWorld).invert();
  const origin=raycaster.ray.origin.clone().applyMatrix4(inverse),direction=raycaster.ray.direction.clone().transformDirection(inverse);
  const scale=new T.Vector3().setFromMatrixScale(book.matrixWorld).x||1;
  let item=null;
  if(handoff===0&&!closing){
   const meshes=[];for(const set of popupSets)if(set.group.visible)for(const m of set.meshes())meshes.push(m);
   const found=meshes.length?raycaster.intersectObjects(meshes,false)[0]:null;
   const info=found?.object?.userData?.popup;
   if(info)item={kind:'item',source:'popup',distance:found.distance/scale,id:info.id,open:info.open};
  }
  const paper=pickPaper({origin:origin.toArray(),direction:direction.toArray()},{W,H,sheets:liveSheets,
   statics:{left:{z:statics.left.uniforms.uStackZ.value.x,face:statics.left.face},right:{z:statics.right.uniforms.uStackZ.value.x,face:statics.right.face}}});
  if(item&&(!paper||item.distance<=paper.distance+1e-6))return item;
  if(!paper)return null;
  const {u,v}=faceUV(paper,W,H);
  let region=null;
  if(paper.x>GUTTER&&!closing&&handoff===0){try{region=textures.hit(paper.face,u,v);}catch{}}
  if(region?.kind==='item'&&region.id)return {...paper,kind:'item',source:'page',id:region.id,open:region.open??region.id,u,v};
  return {...paper,kind:region?.corner||isCorner(paper,W,H)?'corner':'page',u,v};
 }
 const finePointer=()=>{try{return matchMedia('(hover:hover) and (pointer:fine)').matches;}catch{return false;}};
 const setCursor=value=>{if(data.cursor!==value)data.cursor=value;};
 const settledNow=()=>snap().settled&&!motion.run;
 function onPointerMove(event){
  if(event.pointerType!=='mouse')return;
  pointer.x=event.clientX;pointer.y=event.clientY;pointer.inside=true;
  const r=slot.getBoundingClientRect();drift.tx=((event.clientX-r.left)/Math.max(1,r.width)-.5)*2;drift.ty=((event.clientY-r.top)/Math.max(1,r.height)-.5)*2;
  if(drag){moveDrag(event);return;}
  pointer.dirty=true;requestFrame();
 }
 function onPointerLeave(){pointer.inside=false;drift.tx=drift.ty=0;if(!drag){setHover(null);setCursor('');}}
 function onPointerDown(event){
  suppressClick=false; // a gesture whose click never came must not swallow this press's click
  if(event.pointerType!=='mouse'||event.button!==0||handoff>0||closing||disposed||poster)return;
  const hit=pick(event.clientX,event.clientY);
  if(!hit||hit.kind==='item'||!canDrag(hit,W,H))return;
  const s=snap(),width=Math.max(1,metricsNow().spreadRect.width);
  drag={id:event.pointerId,x0:event.clientX,y0:event.clientY,t0:event.timeStamp||now(),startTurn:s.turn,width,grabbed:false,samples:[[event.timeStamp||now(),event.clientX]],side:hit.side};
  if(motionNow()==='full'&&state?.grab?.('drag')){drag.grabbed=true;data.dragging='true';setCursor('drag');}
  try{slot.setPointerCapture?.(event.pointerId);}catch{}
 }
 function moveDrag(event){
  if(!drag||event.pointerId!==drag.id)return;
  const time=event.timeStamp||now();drag.samples.push([time,event.clientX]);if(drag.samples.length>6)drag.samples.shift();
  if(!drag.grabbed)return;
  const max=count()-1,base=Math.floor(drag.startTurn+1e-6);
  const turn=clamp(drag.startTurn+(drag.x0-event.clientX)/drag.width,Math.max(0,base-1),Math.min(max,base+1));
  const [ta,xa]=drag.samples[0];dragVelocity=time>ta?((xa-event.clientX)/drag.width)/((time-ta)/1000):0;
  state.scrub(turn,'drag');touched();requestFrame();
 }
 function endDrag(event,cancelled=false){
  if(!drag||(event&&event.pointerId!==drag.id))return;
  const d=drag;drag=null;try{slot.releasePointerCapture?.(d.id);}catch{}
  const time=event?.timeStamp||now(),x=event?.clientX??d.x0,dx=x-d.x0,moved=Math.hypot(dx,(event?.clientY??d.y0)-d.y0);
  const click=moved<6&&time-d.t0<300;
  // Anything but a click is a gesture, turned or not (clamped at the last spread, short of a discrete step):
  // the click the browser sends after it must not open the item under the release point (§5.10).
  if(!click)suppressClick=true;
  data.dragging='false';setCursor('');
  if(d.grabbed){
   const [ta,xa]=d.samples[0],velocity=cancelled||time<=ta?0:((xa-x)/d.width)/((time-ta)/1000);
   state.release('drag',{velocity});
  }else if(!cancelled&&!click){
   // Without full motion a drag past a quarter page is one discrete step (§4.1).
   if(Math.abs(dx)>.25*metricsNow().pageWidthPx)state?.step?.(dx<0?1:-1,{source:'drag'});
  }
  requestFrame();
 }
 function onClick(event){
  if(suppressClick){suppressClick=false;return;}
  if(data.gesture||disposed||handoff>0||closing||!settledNow())return;
  const hit=pick(event.clientX,event.clientY);
  if(hit?.kind==='item'&&hit.open){try{onOpen?.(hit.open);}catch(error){fault('open',error);}}
 }
 function setHover(id){
  if(id===hoverId)return;hoverId=id;
  try{slot.dispatchEvent(new CustomEvent('book-hover',{detail:{id}}));}catch{}
  requestFrame();
 }
 function hover(){
  if(!pointer.dirty||!pointer.inside||drag)return;pointer.dirty=false;
  if(!finePointer()||handoff>0){setCursor('');setHover(null);return;}
  const hit=pick(pointer.x,pointer.y);
  if(hit?.kind==='item'&&settledNow()){setHover(hit.id);setCursor('open');}
  else{setHover(null);setCursor(hit&&canDrag(hit,W,H)&&motionNow()==='full'&&settledNow()?'turn':'');}
 }
 const listen=(target,type,fn,opts)=>{target.addEventListener(type,fn,opts);cleanup.push(()=>target.removeEventListener(type,fn,opts));};
 listen(slot,'pointermove',onPointerMove);listen(slot,'pointerleave',onPointerLeave);listen(slot,'pointerdown',onPointerDown);
 listen(slot,'pointerup',e=>endDrag(e));listen(slot,'pointercancel',e=>endDrag(e,true));
 // Only the slot's own capture: a child's (a touch pointer's implicit canvas capture) bubbles here too.
 listen(slot,'lostpointercapture',e=>{if(e.target===slot&&drag&&e.pointerId===drag.id)endDrag(e,true);});
 listen(slot,'click',onClick);

 /* ---- theme and tier ---- */
 cleanup.push(onTheme(next=>{
  if(next===theme||disposed)return;const from=cloneLook(look),previous=theme;theme=next;setShadowSize();
  if(motionNow()==='full'&&firstFrame)themeTween={from,to:themes[theme],start:clock,previous};
  else{look=cloneLook(themes[theme]);applyLook(look);themeTween=null;for(const set of popupSets)set.setPalette(PALETTES[theme]);}
  requestFrame();
 }));
 cleanup.push(onTier(next=>{
  if(next==='low'||disposed)return; // the stage releases itself; onLost brings the poster
  const level=next==='high'?'high':'mid';if(level===tierName)return;tierName=level;
  for(const s of sheets)s.setSegments(SHEET_SEGMENTS[tierName],SHEET_ROWS[tierName]);
  while(sheets.length>maxSheets())sheets.pop().dispose();
  statics.left.retier();statics.right.retier();setShadowSize();
  try{textures.setTier(tierName);}catch(error){fault('tier',error);}
  for(const set of popupSets){set.setTier(tierName);for(const m of set.meshes())m.castShadow=tierName==='high';}
  data.tier=next;data.post=stage.post()?'on':'off';data.quality=String(stage.quality);requestFrame();
 }));

 /* ---- per frame ---- */
 let wanted='',pageCss=0,breathe=1;
 function update(dt,gates){
  const mode=motionNow(),still=!gates.motion||mode!=='full';
  clock+=dt;
  let busy=false;
  // Engine-run animation on the stage clock; cut mode (or offscreen) jumps to the end.
  const run=motion.run;
  if(run){
   run.elapsed+=dt;if(mode==='cut'||!gates.visible)run.elapsed=run.duration;
   run.p=clamp(run.elapsed/Math.max(1e-6,run.duration),0,1);
   if(run.kind==='turn')state?.scrub?.(lerp(run.from,run.to,run.ease(run.p)),'animation');
   else if(run.kind!=='fade'){
    run.plan=turnPlan(run.from,run.to,run.elapsed,{tier:tierName});
    const sum=run.plan.local.reduce((a,x)=>a+run.ease(x),0)/run.plan.m;
    state?.scrub?.(run.from+(run.to-run.from)*sum,'animation');
   }
   if(run.p>=1)landRun();
   busy=true;
  }
  // Theme tween (360 ms power2.inOut): lights, paper, ink, shadows, exposure, environment; no repaint.
  if(themeTween){
   const p=still?1:clamp((clock-themeTween.start)/TIMING.theme,0,1),k=ease('power2.inOut')(p);
   mixLook(themeTween.from,themeTween.to,k,look);applyLook(look);
   for(const set of popupSets)set.setPalette(PALETTES[themeTween.previous],PALETTES[theme],k);
   if(p>=1)themeTween=null;else busy=true;
  }
  // Arrival (§5.8).
  if(readyAt!==null&&arrivalPlan){
   const a=clock-readyAt,plan=arrivalPlan;
   canvasAlpha=plan.fade>0&&!(still&&mode==='cut')?clamp(a/plan.fade,0,1):1;
   develop=poster?0:plan.full&&!still?ease('power1.out')(clamp(a/TIMING.develop,0,1)):1;
   dolly=plan.full&&!still?lerp(1.04,1,ease('expo.out')(clamp(a/TIMING.dolly,0,1))):1;
   if(canvasAlpha>=1&&(!plan.full||still||a>=TIMING.dolly))arrivalPlan=null;else busy=true;
  }
  pageShared.uDevelop.value=develop;
  // Refit ease (400 ms, full mode only).
  if(fit.from!=null){
   const p=still?1:clamp((clock-fit.start)/TIMING.refit,0,1);
   fit.distance=lerp(fit.from,fit.target,ease('power2.inOut')(p));if(p>=1)fit.from=null;else busy=true;
  }
  // Paper, faces and sheets.
  const s=snap(),p=plan();
  layoutBlock(poster?restIndex():s.settled&&!motion.run?s.index:blockFor<0?Math.round(s.turn):blockFor);
  const {zL,zR}=blockHeights(blockFor,count(),style.dims.block);
  // Faces first: the bucket for last frame's page size, the live set, at most one paint per busy frame. A
  // repaint may replace a face's texture, so materials read their textures only after this.
  try{
   const ids=[p.left,p.right,p.leftB,p.rightB,...p.sheets.flatMap(x=>[x.front,x.back])].filter(Boolean);
   const want=ids.join();if(want!==wanted){wanted=want;textures.want(ids);}
   if(textures.pump())busy=true;
  }catch(error){fault('faces',error);}
  setStatic(statics.left,p.left,p.leftB,p.fade);setStatic(statics.right,p.right,p.rightB,p.fade);
  liveSheets=[];
  for(const sheet of sheets)sheet.visible=false;
  p.sheets.slice(0,maxSheets()).forEach((entry,i)=>{
   const sheet=sheetAt(i),offset=(entry.slot??i)*.00025;
   entry.stackZ=[zR+offset,zL+offset];entry.radius=sheetRadius(entry.t,entry.v||0,W);
   sheet.set({turn:entry.t,radius:entry.radius,stackZ:entry.stackZ,dip:dipDepth(Math.min(zL,zR))});
   sheet.setFaces(face(entry.front),face(entry.back));sheet.visible=true;
   setFeet(sheet.materials.front,null);setFeet(sheet.materials.back,null);
   liveSheets.push({sheet,front:entry.front,back:entry.back,k:entry.k,t:entry.t,slot:entry.slot??i});
  });
  for(const spread of p.spreads)if(spread.sheet){const live=liveSheets.find(l=>l.slot===(spread.sheet.slot??0));spread.sheet.radius=sheetRadius(spread.sheet.t,spread.sheet.v||0,W);spread.sheet.stackZ=[zR+(spread.sheet.slot??0)*.00025,zL+(spread.sheet.slot??0)*.00025];spread.live=live??null;}
  curlShadow();
  // Pop-ups on the paper, then the handoff and close poses (§5.8).
  busy=updatePopups(p,dt,still,zL,zR)||busy;
  busy=poseBook(still,zL,zR)||busy;
  // Drift and parallax: high tier, fine pointer, ambient allowed, ≥ 50% visible, full mode, 2 s after input.
  const driftAllowed=!poster&&tierName==='high'&&finePointer()&&gates.ambient&&(gates.ratio??1)>=.5&&mode==='full'&&!drag&&handoff===0&&!closing&&!motion.run&&s.settled;
  const quiet=now()-lastInput,driftOn=driftAllowed&&quiet>DRIFT_QUIET_MS;
  if(driftAllowed&&!driftOn)wakeAfter(DRIFT_QUIET_MS-quiet);
  drift.amount=still?0:clamp(drift.amount+(driftOn?dt:-dt)/.25,0,1);
  if(drift.amount>0){
   drift.phase+=dt;const k=1-Math.exp(-dt/.45);drift.px+=(drift.tx-drift.px)*k;drift.py+=(drift.ty-drift.py)*k;
   drift.yaw=drift.amount*(.5*Math.sin(drift.phase*2*Math.PI/17)+1.5*drift.px);
   drift.pitch=drift.amount*(.3*Math.sin(drift.phase*2*Math.PI/23+1.1)-1*drift.py);
   drift.dolly=1+drift.amount*.004*Math.sin(drift.phase*2*Math.PI/29+.4);
   if(drift.amount<1)busy=true;
  }else{drift.yaw=drift.pitch=0;drift.dolly=1;drift.px=drift.py=0;}
  // A sheet standing mid-turn may rise past the frame: the camera breathes out just enough (τ 120 ms).
  let need=1;
  if(liveSheets.length&&handoff===0){
   placeCamera({});
   const pts=[];for(const live of liveSheets){const b=bendBounds(live.sheet.params),z=b.max[2]+Math.max(zL,zR);for(const x of [b.min[0],b.max[0]])for(const y of [0,H])pts.push([x,y,z]);}
   need=containFactor(camera,size.w,size.h,fit.viewport,pts,{H});
  }
  breathe=still?need:breathe+(need-breathe)*(1-Math.exp(-dt/.12));
  if(Math.abs(breathe-need)>1e-4)busy=true;
  placeCamera({yaw:drift.yaw,pitch:drift.pitch,dolly:dolly*drift.dolly*breathe});
  hover();
  // The page's size on screen picks the texture bucket and the compact variant (next frame).
  const page=projectRect(camera,size.w,size.h,[[0,H/2,zR],[W,H/2,zR]],H);
  if(Math.abs(page.width-pageCss)>.5){pageCss=page.width;try{if(textures.setScreen(pageCss,size.dpr))busy=true;}catch{}}
  // The canvas fades over the poster on arrival and out at the end of the handoff.
  const canvas=stage.canvas;
  if(canvas&&readyAt!==null){const value=String(+(canvasAlpha*handoffPose(handoff).opacity).toFixed(3));if(canvas.style.opacity!==value)canvas.style.opacity=value;}
  data.turn=Number(s.turn).toFixed(2);
  if(busy)return true;
  if(drift.amount>0)return 30;
  return false;
 }
 function face(id){try{return textures.face(id);}catch(error){fault('face',error);return null;}}
 function setStatic(page,id,idB,fade){
  // A static face that changes outside a full turn is painted now, so a cut never shows a stale page.
  if(page.face!==id){page.face=id;if(!motion.run||motionNow()!=='full'){try{textures.paint(id);}catch{}}}
  const tex=face(id);if(tex)page.uniforms.uMask.value=tex;
  if(idB&&fade>0){const b=face(idB);if(b)page.uniforms.uMaskB.value=b;page.uniforms.uFade.value=fade;}else page.uniforms.uFade.value=0;
 }
 /* Curl shadow band on the static page under the turning sheet (§5.2). */
 function curlShadow(){
  statics.left.uniforms.uCurl.value.z=0;statics.right.uniforms.uCurl.value.z=0;
  const live=liveSheets[0];if(!live)return;
  const q=live.sheet.params,b=bendBounds(q),start=(1-q.turn)*W-q.turn*Math.PI*q.radius,k=look.curl*Math.sin(Math.PI*q.turn);
  if(start>0)statics.right.uniforms.uCurl.value.set(b.max[0],1.2*q.radius,k,1);
  else statics.left.uniforms.uCurl.value.set(b.min[0],1.2*q.radius,k,-1);
 }
 /* Each shown spread gets a set; its feet stand on the static pages or ride the sheet (§5.3 step 1). */
 function updatePopups(p,dt,still,zL,zR){
  let busy=false;
  const needed=poster?[]:p.spreads,used=new Set();
  setFeet(statics.left,null);setFeet(statics.right,null);
  for(const entry of needed){
   let set=popupSets.find(x=>x.userData.index===entry.index&&!used.has(x));
   if(!set)set=popupSets.find(x=>!used.has(x)&&!needed.some(n=>n.index===x.userData.index))||popupSets.find(x=>!used.has(x));
   if(!set)continue;
   used.add(set);
   const v=view(entry.index);
   set.setVisible(true);   // before show(): a set lays its pieces out with its current visibility
   if(set.userData.index!==entry.index||set.userData.signature!==(v?.signature??null)){
    // Same spread, new data (Mark done / Undo): the set animates the completion in full mode.
    const animate=set.userData.index===entry.index&&motionNow()==='full';
    try{set.show(v||{entries:[],popups:[]},{animate});}catch(error){fault('pop-ups',error);}
    set.userData.index=entry.index;set.userData.signature=v?.signature??null;
   }
   // popup.mjs puts a sheet's feet at one stack height; give it the paper's height at a typical foot.
   const sheet=entry.sheet?(()=>{const [z0,z1]=entry.sheet.stackZ,zf=lerp(z0,z1,stackMix(.26*W,entry.sheet.t,entry.sheet.radius,W));return {turn:entry.sheet.t,radius:entry.sheet.radius,stackZ:[zf,zf]};})():null;
   const fold=foldAmount();
   let pose=entry.role==='out'&&sheet?{left:{z:zL},right:{sheet}}:entry.role==='in'&&sheet?{left:{sheet},right:{z:zR}}:restPose(zL,zR);
   if(fold>0&&!sheet)pose={left:{z:lerp(zL,zR,fold),angle:fold*Math.PI},right:{z:zR}};
   try{set.pose(pose);}catch(error){fault('pose',error);}
   set.setInteractive(entry.role===null&&settledNow()&&handoff===0&&!closing&&entry.index===snap().index);
   set.setFocus(focus??hoverId);
   try{busy=set.update(dt,{motion:!still})||busy;}catch(error){fault('pop-up update',error);}
   // Contact shadows under the feet, in the page shader.
   let rects=null;try{rects=set.footShadows();}catch{}
   if(rects){
    if(entry.role!=='in')setFeet(statics.left,rects.left,rects.k);
    if(entry.role!=='out')setFeet(statics.right,rects.right,rects.k);
    if(entry.live&&entry.role==='out')setFeet(entry.live.sheet.materials.front,rects.right,rects.k);
    if(entry.live&&entry.role==='in')setFeet(entry.live.sheet.materials.back,rects.left,rects.k);
   }
  }
  for(const set of popupSets)if(!used.has(set))set.setVisible(false);
  return busy;
 }
 function setFeet(target,rects,k){
  const u=target.uniforms;
  for(let i=0;i<3;i++){
   if(rects){u.uFoot.value[i].set(rects[i*4],rects[i*4+1],rects[i*4+2],rects[i*4+3]);u.uFootK.value[i]=k[i];}
   else u.uFootK.value[i]=0;
  }
 }
 /* Tags facing away are not pickable (popup.mjs): give the sets the camera in the book frame. */
 const cameraInBook=new T.Vector3(),bookInverse=new T.Matrix4();
 function syncPopupCamera(){
  book.updateMatrixWorld(true);cameraInBook.copy(camera.position).applyMatrix4(bookInverse.copy(book.matrixWorld).invert());
  for(const set of popupSets)set.setCamera(cameraInBook);
 }

 /* ---- handoff and close (§5.8) ---- */
 function foldAmount(){
  const c=closing?ease('power2.inOut')(clamp((clock-closing.start)/Math.max(1e-3,closing.duration),0,1)):0;
  return Math.max(handoffPose(handoff).fold,c);
 }
 const dockWorld=new T.Vector3(),toDock=new T.Vector3();
 function poseBook(still,zL,zR){
  let busy=false;
  const pose=handoffPose(handoff);
  const fold=foldAmount(),h=(zL+zR)/2;
  // The front half pivots over the spine at the mean block height, so the verso lands on the recto, with a
  // 2° board flex mid-swing.
  frontPivot.position.z=h;frontHalf.position.z=-h;
  frontPivot.rotation.y=fold*Math.PI+Math.sin(fold*Math.PI)*2*DEG;
  // The spine rounds out as the boards meet; the contact shadow follows the footprint to the recto.
  spine.mesh.visible=fold>.35;spine.layout(zL+zR+2*t,(zL+zR)/2-t/2+t/2,smooth(.35,1,fold));
  contact.mesh.scale.x=1-.5*fold;contact.mesh.position.x=.5*fold*(W+o);
  const coverOn=fold>0&&!!cover.normalMap;if((boards.left.material!==linen)!==coverOn)boards.left.material=coverOn?[linen,linen,cover]:linen;
  ribbon.mesh.visible=fold<.35;
  // The band snaps round the closed book at p = 0.55 (550 ms elastic.out) and lets go when p falls back.
  const shut=pose.shut||(!!closing&&fold>=.999);
  if(band&&shut!==bandClosed){bandClosed=shut;bandSnap={start:clock,from:bandSnap?.value??(shut?0:1),to:shut?1:0,value:shut?0:1};}
  if(band&&bandSnap){
   const k=still?1:clamp((clock-bandSnap.start)/TIMING.band,0,1),e=bandSnap.to?ease('elastic.out(1, 0.5)')(k):ease('power2.out')(k);
   bandSnap.value=lerp(bandSnap.from,bandSnap.to,e);
   band.layout({closed:bandSnap.value,top:zL+zR+t});
   if(k>=1)bandSnap=null;else busy=true;
  }
  // p 0.55–1: the closed book shrinks to 0.16 along an arc to the dock's course mark; the spine glows.
  const shrink=smooth(.55,1,handoff);
  // A book in flight casts no lamp shadow on the desk it left.
  const casting=shrink===0;if(boards.left.castShadow!==casting)for(const m of [boards.left,boards.right,blocks.left.mesh,blocks.right.mesh])m.castShadow=casting;
  if(shrink>0){
   const target=dockTarget?.();
   if(target&&target.width>=0){
    const r=slot.getBoundingClientRect(),x=((target.left+target.width/2-r.left)/Math.max(1,r.width))*2-1,y=-(((target.top+target.height/2-r.top)/Math.max(1,r.height))*2-1);
    dockWorld.set(x,y,.5).unproject(camera);
    toDock.copy(dockWorld).sub(camera.position).normalize();
    dockWorld.copy(camera.position).addScaledVector(toDock,camera.position.length()*.7);
   }else dockWorld.set(0,.3,0);
   const k=pose.travel,lift=Math.sin(Math.PI*k)*.05;
   carrier.position.set(dockWorld.x*k,dockWorld.y*k+lift,dockWorld.z*k);
   carrier.scale.setScalar(pose.scale);
   carrier.rotation.set(lerp(0,18*DEG,k),lerp(0,-10*DEG,k),0);
  }else{carrier.position.set(0,0,0);carrier.scale.setScalar(1);carrier.rotation.set(0,0,0);}
  const glow=theme==='dark'&&tierName==='high'?smooth(.55,.8,handoff)*look.spineGain:0;
  spineMaterial.emissive.copy(look.spineGlow).multiplyScalar(glow);
  contact.material.opacity=look.contactOpacity*(1-smooth(.55,.75,handoff));
  if(closing&&clock>=closing.start+closing.duration){const c=closing;closing=null;c.resolve();}
  if(closing)busy=true;
  return busy;
 }
 function setHandoff(p){
  if(p===handoff)return;handoff=p;
  if(p>0){setHover(null);setCursor('');}
  touched();requestFrame();
 }
 function close({ms=TIMING.close*1000}={}){
  if(disposed||motionNow()!=='full'||!firstFrame)return Promise.resolve();
  if(closing)return closing.promise;
  let resolve;const promise=new Promise(r=>{resolve=r;});
  closing={start:clock,duration:Math.min(ms,TIMING.close*1000)/1000,resolve,promise};
  setHover(null);setCursor('');requestFrame();
  return promise;
 }

 /* ---- the stage controller ---- */
 let frames=0;
 const controller={
  resize(w,h,dpr){size={w,h,dpr};fit.viewport=globalThis.innerWidth||w;refit();if(fit.from!=null){fit.distance=fit.target;fit.from=null;}},
  update(dt,gates){data.awake=String(gates.visible&&!gates.hidden);return update(dt,gates);},
  /* The stage stopped scheduling: a turn in progress lands now; the paper shows it on the next frame. */
  sleep(gates){data.awake=String(gates.visible&&!gates.hidden);landRun();},
  render(r,post){
   syncPopupCamera();
   const emitting=theme==='dark'&&(popupSets.some(set=>set.group.visible&&set.emitting?.())||spineMaterial.emissive.r>0);
   if(post){
    const rect=projectRect(camera,size.w,size.h,spreadPoints(),H);
    post.render(scene,camera,{bloom:emitting,rect:[rect.left/size.w,1-rect.bottom/size.h,rect.right/size.w,1-rect.top/size.h]});
   }else r.render(scene,camera);
   frames++;
   const info=r.info.render;data.sceneFrame=String(frames);data.drawCalls=String(info.calls);data.triangles=String(info.triangles);
   data.motionState=motionNow()==='full'&&(motion.run||drift.amount>0||arrivalPlan||closing)?'running':'still';
   if(!firstFrame){firstFrame=true;onFirstFrame();}
  },
  dispose(){}
 };
 function onFirstFrame(){
  readyAt=clock;
  const m=motionNow(),late=now()-(arrival.start||0)>TIMING.late*1000;
  arrivalPlan={full:m==='full'&&!late&&!isRemount&&!poster,fade:m==='cut'||poster?0:m==='fade'?TIMING.reducedFade:TIMING.arrivalFade};
  if(arrivalPlan.full)for(const set of popupSets)if(set.group.visible)set.arrive({delay:TIMING.riseDelay,stagger:TIMING.riseStagger,duration:TIMING.rise});
  Object.assign(data,{renderer:'webgl2',rendererReason:'ok',sceneReady:'true'});
  try{slot.dispatchEvent(new CustomEvent('book-ready',{detail:{renderer:'webgl2'}}));}catch{}
  onReady?.();
  requestFrame();
 }

 /* ---- first paint and compile, while the poster is still up (§5.9) ---- */
 const s0=snap(),i0=Math.round(poster?restIndex():s0.index);
 layoutBlock(poster?restIndex():s0.index);
 refit();placeCamera();
 {const {zR}=blockHeights(blockFor,count(),style.dims.block);pageCss=projectRect(camera,size.w,size.h,[[0,H/2,zR],[W,H/2,zR]],H).width;try{textures.setScreen(pageCss,Math.min(globalThis.devicePixelRatio||1,tierName==='high'?2:1.5));}catch{}}
 for(const id of [faceId('L',i0),faceId('R',i0)]){try{textures.paint(id);}catch(error){fault('paint',error);}}
 setStatic(statics.left,faceId('L',i0));setStatic(statics.right,faceId('R',i0));
 {const {zL,zR}=blockHeights(blockFor,count(),style.dims.block);updatePopups(plan(),0,true,zL,zR);}
 sheetAt(0).set({turn:.5});sheetAt(0).visible=true;
 scene.updateMatrixWorld(true);
 try{await renderer.compileAsync(scene,camera);await stage.post()?.compile?.();}
 catch(error){fault('compile',error);}
 sheetAt(0).visible=false;
 Object.assign(data,{tier:currentTier(),quality:String(stage.quality),post:stage.post()?'on':'off',dragging:'false',cursor:'',week:String(s0.index),turn:Number(s0.turn).toFixed(2)});

 function metricsNow(){
  const r=slot.getBoundingClientRect();
  if(!fit.pose){const s=spreadLayout(r.width,r.height,globalThis.innerWidth||r.width);return {pageWidthPx:s.pageWidth,spreadRect:rectFrom(r.left+s.left,r.top+s.top,s.width,s.height),stageRect:rectFrom(r.left,r.top,r.width,r.height)};}
  const spread=projectRect(camera,size.w,size.h,spreadPoints(),H);
  const {zR}=blockHeights(blockFor<0?snap().index:blockFor,count(),style.dims.block);
  const page=projectRect(camera,size.w,size.h,[[0,H/2,zR],[W,H/2,zR]],H);
  return {pageWidthPx:page.width,spreadRect:rectFrom(r.left+spread.left,r.top+spread.top,spread.width,spread.height),stageRect:rectFrom(r.left,r.top,r.width,r.height)};
 }

 return {
  attach(){
   if(disposed||attached)return;attached=true;
   const canvas=stage.canvas;if(canvas)canvas.style.opacity='0';
   detach=stage.attach(slot,controller);
  },
  metrics:metricsNow,
  setHandoff,
  setFocus(id){if(focus===id)return;focus=id;requestFrame();},
  close,
  requestFrame(){requestFrame();},
  pick,
  stats(){
   let geometries=0,materials=0;scene.traverse(n=>{if(n.geometry)geometries++;if(n.material)materials+=[].concat(n.material).length;});
   let tex=null;try{tex=textures.stats();}catch{}
   return {renderer:'webgl2',reason:'ok',frames,clock,tier:tierName,theme,mode:motionNow(),sheets:sheets.length,live:liveSheets.length,
    popups:popupSets.map(set=>({index:set.userData.index,visible:set.group.visible,...(set.stats?.()??{})})),
    drawCalls:+data.drawCalls||0,triangles:+data.triangles||0,geometries,materials,textures:tex,
    camera:{distance:fit.distance,fov:camera.fov,limit:fit.limit},drift:drift.amount,handoff,closing:!!closing,run:motion.run?.kind??null,runP:motion.run?.p??null,breathe};
  },
  dispose(){
   if(disposed)return;disposed=true;
   clearTimeout(wakeTimer);wakeTimer=0;
   endRun();if(closing){const c=closing;closing=null;c.resolve();}
   if(drag){try{if(drag.grabbed)state?.release?.('drag',{velocity:0});}catch{}drag=null;}
   try{state?.setAnimator?.(null);}catch{}
   try{unsubscribe?.();}catch{}
   for(const off of cleanup.splice(0))try{off();}catch{}
   detach?.();detach=null;requestFrame=()=>{};
   const canvas=stage.canvas;if(canvas)canvas.style.opacity='';
   for(const set of popupSets)try{set.dispose();}catch{}
   for(const s of sheets)s.dispose();sheets.length=0;
   boards.dispose();blocks.left.dispose();blocks.right.dispose();ribbon.dispose();band?.dispose();spine.dispose();blotter.dispose();contact.dispose();catcher.dispose();
   for(const page of [statics.left,statics.right]){page.mesh.geometry.dispose();page.material.dispose();}
   for(const m of [edge.material,linen,cover,ribbonMaterial,bandMaterial,blotterMaterial,spineMaterial])m.dispose();
   felt?.dispose();
   key.shadow.map?.dispose();key.shadow.map=null;key.dispose?.();
   try{textures.dispose();}catch{}
   scene.clear();
   Object.assign(data,{awake:'false',cursor:'',dragging:'false'});
  }
 };
}

/* ---------------------------------------------------------------- poster controller ---------------------- */

/* The poster-only controller: no renderer, no animator, no frame loop. B shows the poster and the flat
   timeline (§6.8); this keeps the slot's dataset honest and the API callable. */
function posterController(slot,{state,signal,onFallback}={},reason,{silent=false}={}){
 let disposed=false,handoff=0,focus=null,unsubscribe=null;
 const data=slot.dataset;
 const sync=snapshot=>{if(disposed||!snapshot)return;data.week=String(snapshot.index);data.turn=Number(snapshot.turn).toFixed(2);};
 Object.assign(data,{renderer:'poster',rendererReason:reason,sceneReady:'true',awake:'false',motionState:'still',
  quality:'none',post:'off',sceneFrame:'0',drawCalls:'0',triangles:'0',dragging:'false',cursor:''});
 data.tier=currentTier();
 if(state&&!silent){
  try{sync(state.snapshot());unsubscribe=state.subscribe(sync,{continuous:true});}catch(error){console.warn('Book state unavailable',error);}
 }
 const dispose=()=>{
  if(disposed)return;disposed=true;
  signal?.removeEventListener?.('abort',dispose);
  try{unsubscribe?.();}catch{}unsubscribe=null;
  data.awake='false';
 };
 signal?.addEventListener?.('abort',dispose,{once:true});
 const controller={
  ready:Promise.resolve('poster'),
  metrics(){
   const stage=slot.getBoundingClientRect(),viewport=globalThis.innerWidth||stage.width;
   const spread=spreadLayout(stage.width,stage.height,viewport);
   return {pageWidthPx:spread.pageWidth,spreadRect:rectFrom(stage.left+spread.left,stage.top+spread.top,spread.width,spread.height),
    stageRect:rectFrom(stage.left,stage.top,stage.width,stage.height)};
  },
  setHandoff(p){const value=Number(p);handoff=Number.isFinite(value)?Math.min(1,Math.max(0,value)):0;},
  setFocus(id){focus=id==null?null:String(id);},
  close(){return Promise.resolve();},
  requestFrame(){},
  pick(){return null;},
  stats(){return {renderer:'poster',reason,disposed,frames:0,drawCalls:0,triangles:0,geometries:0,textures:0,programs:0,
   handoff,focus,subscribed:!!unsubscribe};},
  dispose
 };
 if(!silent){
  try{onFallback?.(reason);}catch(error){console.warn('Book fallback handler failed',error);}
  slot.dispatchEvent(new CustomEvent('book-fallback',{detail:{reason}}));
 }
 return controller;
}
