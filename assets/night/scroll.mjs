/* Night Shift scroll: Lenis on the shared GSAP clock, the page progress bar, editorial reveals and the next-card
   glow parallax. Coursework holds still while it is read: no marquee band, no leaning rows (retired, plan §9).
   On a semester book route it also owns the book's scroll input (semester-book spec §6.4–§6.6):
   - the bounded pin: fine pointer and full motion only, at most 150vh, pinType transform; scrolling scrubs
     the pages from the selected week through the next two, then closes the book into the dock;
   - touch swipe on the stage: horizontal intent only, native vertical scroll, no pin;
   - teleports (Skip to coursework, hashes, item opening, big jumps) rebase the pin instead of turning pages.
   Shared surface for other modules (this file is imported with a query string, so never import it):
   window.NightScroll = {refresh(), scrollTo(target,{immediate,offset}), lenis()}, or dispatch 'night-refresh'.
   The pure scrub plan (scrubPlan, scrubAt, rebase, forward) is exported for tests. */
import {scope} from '../route-lifecycle.mjs';
import {vendor,META,TERM,escape,$,$$,motionAllowed,sceneMotionAllowed,ambientAllowed,onAmbient,hold,release,held,finePointer,atLeast,onTier,track,dispose,view,frames} from './core.mjs?v=20261023-mth141';
import {currentBookHost} from '../book/book-state.mjs?v=20261023-mth141';

const SCOPE='scroll',BOOK='book-scrub',SWIPE='book-swipe';
const ROWS='#assessment-list>li,#teamlist>.tile,#youlist>.tile';
const TITLES='.workspace-page-title,.math-lab .workbench-title h2'; // display titles only; card headings stay put
const INNER=':scope>details>summary>span,:scope>.head>.date,:scope>.head>.info';
const NATIVE='dialog,.detail-sheet,.lab-dialog,[data-lenis-prevent]';
const COMPLETE='[data-quick-complete],#undo-complete';
const REFLOW='[data-check],[data-completed],[data-k],[data-completion],[data-topic],#hide-completed,#workspace-show-past';
const desktop=matchMedia('(min-width:1001px)');
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const expoInOut=t=>t<=0?0:t>=1?1:t<.5?2**(20*t-10)/2:(2-2**(10-20*t))/2;
const smoothstep=t=>{const x=clamp(t,0,1);return x*x*(3-2*x);};
const safe=fn=>{const owner=life;return (...args)=>{if(owner?.signal.aborted)return;try{return fn(...args);}catch(error){console.warn('Night Shift scroll:',error);}};};
const fontsReady=()=>Promise.race([document.fonts?.ready??Promise.resolve(),new Promise(r=>life.timeout(r,1200))]);

let G=null,ST=null,Split=null,LenisClass=null,lenis=null,mounted=false,motionOn=false,life=null;
let scrollPos=0,maxScroll=1,lastProgress=-1;

/* ---- Page progress: --ns-progress (0..1) on :root; layout.css draws the dock's 2 px bar from it.
   Quantised so a resting page never restyles, and the scroll height is cached (no layout read per frame). ---- */
function measure(){maxScroll=Math.max(1,document.documentElement.scrollHeight-innerHeight);}
function progress(){
 const p=clamp(scrollPos/maxScroll,0,1);
 if(p===lastProgress||Math.abs(p-lastProgress)<.0005&&p>0&&p<1)return;
 lastProgress=p;document.documentElement.style.setProperty('--ns-progress',p.toFixed(4));
}

/* ---- Sheets: any modal dialog or the detail sheet rests ambient motion and Lenis through a temporary
   hold, never the saved pause. Rows moved into a sheet are shown at once (they may still be pending). ---- */
let modal='dialog:modal';try{document.querySelector(modal);}catch{modal='dialog[open]';}
let sheetHeld=false;
function syncSheets(){
 const open=document.body.classList.contains('sheet-open')||!!document.querySelector(modal);
 if(open===sheetHeld)return;sheetHeld=open;
 if(open){flushWhere(el=>el.closest('dialog'));hold('sheet');}else release('sheet');
}
function watchSheets(){
 const owner=life;let queued=false;const queue=()=>{if(queued||owner.signal.aborted)return;queued=true;queueMicrotask(()=>{queued=false;if(!owner.signal.aborted)syncSheets();});};
 life.observer(new MutationObserver(queue),document.body,{attributes:true,attributeFilter:['class']});
 life.observer(new MutationObserver(queue),document.body,{subtree:true,attributes:true,attributeFilter:['open']});
 life.on(document,'close',queue,true);
 syncSheets();
}

/* ---- Lenis: fine pointer and mid tier or better, raf driven by gsap.ticker. Touch keeps native scroll.
   Holds stop it; reduced or disabled motion destroys it, because a stopped Lenis would also swallow the
   wheel. Nested scrollers stay native: dialogs and sheets through prevent, overflow scrollers through
   allowNestedScroll, horizontal gestures (timeline track, week ticks) by skipping Lenis entirely. ---- */
const wantLenis=()=>!!LenisClass&&finePointer.matches&&atLeast('mid')&&motionAllowed();
const lenisRaf=time=>lenis?.raf(time*1000);
function syncLenis(){
 if(!G)return;
 if(wantLenis()&&!lenis){
  lenis=new LenisClass({autoRaf:false,lerp:.1,smoothWheel:true,syncTouch:false,allowNestedScroll:true,
   prevent:node=>node.matches?.(NATIVE),virtualScroll:({deltaX,deltaY})=>Math.abs(deltaX)<=Math.abs(deltaY)});
  lenis.on('scroll',onLenis);
  G.ticker.add(lenisRaf);G.ticker.lagSmoothing(0);
 }else if(!wantLenis()&&lenis){
  G.ticker.remove(lenisRaf);lenis.destroy();lenis=null;G.ticker.lagSmoothing(500,33);
 }
 if(lenis)held()?lenis.stop():lenis.start();
}
function onLenis(l){ST?.update();scrollPos=l.animatedScroll;progress();}
/* Lenis re-syncs on native scroll only while idle; mid-glide it would overwrite the guide's own jumps
   (scrollIntoView, hash routes, the sheet's scroll restore). Any press, key or route change ends the glide
   first, and a native position that disagrees with the glide wins. */
const settle=()=>{if(lenis?.isScrolling==='smooth')lenis.reset();};

let sweepTimer=0;
function onScroll(){
 scrollPos=window.scrollY;
 if(lenis&&lenis.isScrolling==='smooth'&&Math.abs(scrollPos-lenis.animatedScroll)>2)lenis.reset();
 progress();
 if(pending.size){clearTimeout(sweepTimer);sweepTimer=setTimeout(safe(sweep),160);}
}

/* ---- Editorial reveals: only for elements still below the fold when a view binds, and only once.
   Rows animate opacity and clip-path alone (Flip owns their transforms); their inner columns rise inside
   the opening mask. Titles rise line by line from SplitText masks while the page rule draws across. ---- */
const pending=new Set(),running=new Set(),seen=new WeakSet();
let io=null,bindToken=0;
const pageTop=el=>{let y=0;for(let n=el;n;n=n.offsetParent)y+=n.offsetTop;return y;};
// Below the fold both as painted (a panel may be mid-transition) and as laid out: hide nothing in view.
function belowFold(el){const vh=innerHeight;return el.getBoundingClientRect().top>=vh&&pageTop(el)-window.scrollY>=vh;}
function bindView(){
 dispose(SCOPE);
 bindParallax();
 if(!motionAllowed()||!G||!('IntersectionObserver' in window))return;
 const panel=document.getElementById('workspace-'+view())||document.body,observer=new IntersectionObserver(safe(onEnter),{rootMargin:'0px 0px -8% 0px'});
 io=observer;
 track(SCOPE,()=>{observer.disconnect();if(io===observer)io=null;flushWhere(()=>true);finishRunning();});
 for(const [selector,kind] of [[TITLES,'title'],[ROWS,'row']])for(const el of $$(selector,panel)){
  if(seen.has(el)||pending.has(el)||!el.getClientRects().length||el.closest('dialog'))continue;
  if(!belowFold(el)){seen.add(el);continue;}
  pending.add(el);el.dataset.nsReveal=kind;observer.observe(el);
 }
}
function rebind(ready=frames(2,life?.signal)){const token=++bindToken;ready.then(safe(()=>{if(token===bindToken)bindView();}));}
const rebindAll=()=>{dispose(SCOPE);rebind();};
function onEnter(entries){play(entries.filter(e=>e.isIntersecting&&pending.has(e.target)).sort((a,b)=>a.boundingClientRect.top-b.boundingClientRect.top).map(e=>e.target));}
/* After a scroll settles, anything left pending inside the view (the bottom margin band) plays too. */
function sweep(){
 const vh=innerHeight,ready=[];
 for(const el of pending){if(!el.isConnected){pending.delete(el);continue;}const r=el.getBoundingClientRect();if(r.height&&r.top<vh&&r.bottom>0)ready.push([el,r.top]);}
 play(ready.sort((a,b)=>a[1]-b[1]).map(([el])=>el));
}
function play(els){
 const step=Math.min(.085,.42/Math.max(1,els.length));
 els.forEach((el,i)=>{
  if(!pending.delete(el))return;io?.unobserve(el);seen.add(el);
  if(!motionAllowed()||!G){delete el.dataset.nsReveal;return;}
  (el.dataset.nsReveal==='title'?revealTitle:revealRow)(el,i*step);
 });
}
function revealRow(el,delay){
 const inner=el.querySelectorAll(INNER);
 const tl=G.timeline({delay,defaults:{ease:'expo.out'},onComplete:end,onInterrupt:end});
 function end(){running.delete(tl);G.set(el,{clearProps:'opacity,clipPath'});if(inner.length)G.set(inner,{clearProps:'transform'});}
 // fromTo renders its start state now, so dropping the pending attribute below never flashes the row.
 tl.fromTo(el,{opacity:0,clipPath:'inset(0% 0% 100% 0%)'},{opacity:1,clipPath:'inset(0% 0% 0% 0%)',duration:1.05},0);
 if(inner.length)tl.fromTo(inner,{y:38},{y:0,duration:1.3,stagger:.07},0);
 delete el.dataset.nsReveal;running.add(tl);
}
function revealTitle(el,delay){
 let split=null;try{split=new Split(el,{type:'lines',mask:'lines',linesClass:'ns-line'});}catch{}
 const lines=split?.lines?.length?split.lines:null;
 el.style.setProperty('--ns-delay',delay.toFixed(3)+'s');el.classList.add('ns-title-in');
 const tl=G.timeline({delay,onComplete:end,onInterrupt:end});
 function end(){running.delete(tl);try{split?.revert();}catch{}el.classList.remove('ns-title-in');el.style.removeProperty('--ns-delay');if(!lines)G.set(el,{clearProps:'opacity'});}
 if(lines)tl.fromTo(lines,{yPercent:118,rotation:2.2,transformOrigin:'0% 100%'},{yPercent:0,rotation:0,duration:1.25,ease:'expo.out',stagger:.1},0);
 else tl.fromTo(el,{opacity:0},{opacity:1,duration:.7,ease:'power2.out'},0);
 tl.to({},{duration:1.45},0); // the CSS rule and index label finish before the class goes
 delete el.dataset.nsReveal;running.add(tl);
}
function flushWhere(test){for(const el of [...pending])if(test(el)){pending.delete(el);io?.unobserve(el);delete el.dataset.nsReveal;}}
function finishRunning(){for(const tl of [...running])tl.progress(1);}

/* ---- Parallax: [data-night-speed] (<1 lags behind the page, >1 leads), desktop fine pointer only.
   data-night-var="--name" writes a custom property instead of a transform so a pseudo-element can ride it
   (the next card's glow). ---- */
function bindParallax(){
 if(!ST||!desktop.matches||!finePointer.matches||!atLeast('mid')||!motionAllowed())return;
 for(const el of $$('[data-night-speed]')){
  const speed=parseFloat(el.dataset.nightSpeed),prop=el.dataset.nightVar;
  if(!(speed>0&&speed<2)||speed===1||!el.getClientRects().length)continue;
  let span=0;const set=prop?v=>el.style.setProperty(prop,v.toFixed(1)+'px'):G.quickSetter(el,'y','px');
  const apply=self=>set((self.progress-.5)*span*(1-speed));
  // A transformed element would skew its own trigger bounds, so transform mode measures the parent.
  const st=ST.create({trigger:prop?el:el.parentElement||el,start:'top bottom',end:'bottom top',onRefresh:self=>{span=self.end-self.start;apply(self);},onUpdate:apply});
  track(SCOPE,()=>{st.kill();if(prop)el.style.removeProperty(prop);else G.set(el,{clearProps:'transform'});});
 }
}

/* ---- ScrollTrigger stays true to the layout: views (after the panel transition), fonts, the timeline,
   completions, filters and any main-column resize. Debounced on the GSAP clock. ---- */
let refreshCall=null;
function refreshSoon(delay=.2){
 if(!G){measure();return;}
 refreshCall?.kill();
 refreshCall=G.delayedCall(delay,safe(()=>{refreshCall=null;measure();lenis?.dimensions?.resize();ST?.refresh();progress();}));
}

function scrollTo(target,{immediate=false,offset=0}={}){
 const smooth=!immediate&&motionAllowed();
 if(lenis&&!lenis.isStopped){lenis.scrollTo(target,{offset,immediate:!smooth,force:true,duration:1.15,easing:expoInOut});return;}
 const el=typeof target==='string'?document.querySelector(target):target;
 const top=typeof target==='number'?target:el?.getBoundingClientRect?el.getBoundingClientRect().top+window.scrollY:null;
 if(top!==null)window.scrollTo({top:top+offset,behavior:smooth?'smooth':'instant'});
}

function onMotionChange(){
 syncLenis();syncBook();
 const on=motionAllowed();if(on===motionOn)return;motionOn=on;
 // Turning motion off shows everything now; turning it on binds only what is still below the fold.
 dispose(SCOPE);
 if(on)rebind();
}

/* =========================================================================== the semester book ========== */

/* Pinned scroll per §6.4, in vh: a lead dwell, then for each of N ≤ 2 turns a turn segment (dwells between
   them), a short dwell and the close into the dock. N = 2 → 150vh; N = 1 → 102vh; N = 0 → 69vh. */
export const PLAN_VH=Object.freeze({lead:27,turn:33,dwell:15,tail:9,close:33});
export function scrubPlan(n){
 const N=clamp(Math.floor(Number(n))||0,0,2),parts=[['dwell',PLAN_VH.lead]];
 for(let k=0;k<N;k++){parts.push(['turn',PLAN_VH.turn]);if(k<N-1)parts.push(['dwell',PLAN_VH.dwell]);}
 parts.push(['dwell',PLAN_VH.tail],['close',PLAN_VH.close]);
 const vh=parts.reduce((sum,[,length])=>sum+length,0);
 let at=0,turns=0;
 const segments=parts.map(([kind,length])=>{const seg=Object.freeze({kind,from:at/vh,to:(at+length)/vh,turn:turns});at+=length;if(kind==='turn')turns++;return seg;});
 return Object.freeze({n:N,vh,segments:Object.freeze(segments)});
}
/** Where the paper is at pin progress p: offset (turns past the anchor, smoothstepped inside each turn
    segment), handoff (0..1 across the close) and whether p sits in a dwell. Pure and monotone. */
export function scrubAt(p,plan){
 const x=clamp(Number(p)||0,0,1),segments=plan.segments;
 let seg=segments[segments.length-1];
 for(const candidate of segments)if(x<=candidate.to){seg=candidate;break;}
 const local=seg.to>seg.from?clamp((x-seg.from)/(seg.to-seg.from),0,1):1;
 if(seg.kind==='turn')return {offset:seg.turn+smoothstep(local),handoff:0,dwell:false};
 if(seg.kind==='close')return {offset:seg.turn,handoff:local,dwell:local===0};
 return {offset:seg.turn,handoff:0,dwell:true};
}
/** A rebase taken at plan offset o: the paper is at the anchor here, and the next stations (integer
    offsets) in either direction are whole turns away, so dwells stay on whole spreads. */
export function rebase(offset){return Object.freeze({lo:Math.floor(offset+1e-9),hi:Math.ceil(offset-1e-9)});}
export function relative(offset,base){return Math.min(0,offset-base.lo)+Math.max(0,offset-base.hi);}
/** The pin's rebase: as rebase(offset) but floored at the plan's start, so relative() is never negative and
    scrolling back up from a teleport never turns pages behind the anchor. */
export function forward(offset){return Object.freeze({lo:0,hi:rebase(offset).hi});}
/** A jump the pin should rebase on rather than scrub through. */
export function isTeleport({dp=0,dy=0,viewport=800,smoothed=false,flagged=false}={}){
 return flagged||Math.abs(dp)>.35||!smoothed&&Math.abs(dy)>.5*viewport;
}

let pin=null,teleportFlag=false,bookOn=false;
const root=()=>document.documentElement;
/* The dock bar sits over the column from arrival on wide layouts: the pinned stage starts below it. */
function dockOffset(){
 const bar=document.querySelector('.ns-dock-bar');if(!bar||!root().dataset.book)return 0;
 const style=getComputedStyle(bar);if(style.visibility==='hidden'||style.position!=='fixed')return 0;
 const r=bar.getBoundingClientRect();return r.top<=1&&r.bottom>0?Math.round(r.bottom):0;
}
function pinEligible(host){
 if(!host?.controller||host.renderer!=='webgl2'||!ST||!G)return false;
 // Holds (palette, sheets) pause the page but do not tear the pin down; everything else in §4.1 does.
 if(!finePointer.matches||!sceneMotionAllowed()||!atLeast('mid'))return false;
 return host.header.offsetHeight<=innerHeight-dockOffset();
}
function signal(type,detail){document.dispatchEvent(new CustomEvent(type,{detail}));}
/* ScrollTrigger re-parents the pinned header: it wraps it in its spacer on bind and on every refresh, and unwraps
   it on kill. Moving a node blurs whatever is focused inside it, so a rail control would drop focus to <body> on a
   resize, a zoom or a GPU fallback. The control takes focus back once the move is done (never from another one). */
const focusedIn=node=>{const a=document.activeElement;return a&&a!==document.body&&node?.contains(a)?a:null;};
const refocus=el=>{const a=document.activeElement;if(el?.isConnected&&el!==a&&(!a||a===document.body))el.focus({preventScroll:true});};
function keepFocus(node,fn){const el=focusedIn(node);try{return fn();}finally{refocus(el);}}
/* Where the pin starts, in page pixels: the header's top under the dock (ScrollTrigger's 'top top+=offset'),
   never above the page's own top, which the reader can always reach. */
const pinStart=host=>Math.max(0,pageTop(host.header)-dockOffset());

function bindPin(host){
 const {state,header,controller}=host;
 const anchorAt=()=>state.snapshot().index;
 let anchor=anchorAt(),plan=scrubPlan(Math.min(2,state.snapshot().count-1-anchor)),base=rebase(0);
 let lastP=0,lastY=window.scrollY,lastH=-1;
 const offset=dockOffset();
 const setHandoff=h=>{
  if(Math.abs(h-lastH)<1e-4&&!(h===0||h===1)||h===lastH)return;
  lastH=h;controller.setHandoff(h);header.style.setProperty('--hero-p',h.toFixed(4));signal('night-handoff',h);
 };
 const st=keepFocus(header,()=>ST.create({trigger:header,start:'top top+='+offset,end:()=>'+='+Math.round(plan.vh/100*innerHeight),pin:header,pinType:'transform',
  pinSpacing:true,scrub:true,invalidateOnRefresh:true,refreshPriority:1,
  onUpdate:safe(self=>{
   const p=self.progress,y=window.scrollY,at=scrubAt(p,plan);
   const jumped=isTeleport({dp:p-lastP,dy:y-lastY,viewport:innerHeight,smoothed:!!lenis,flagged:teleportFlag});
   teleportFlag=false;lastP=p;lastY=y;
   // A rebase never reaches behind the anchor: the pin scrubs from the selected week forward (§6.4), so after
   // a teleport past it (Skip, a hash, a command below the pin) scrolling back up keeps the reader's week.
   // Back in the lead dwell the paper is at the anchor again, and the next pass turns forward from it.
   if(jumped||state.consumeAnchorDirty()){anchor=anchorAt();base=forward(at.offset);}
   else{
    if(at.offset===0&&base.hi>0)base=forward(0);
    const s=state.snapshot();
    state.scrub(clamp(anchor+relative(at.offset,base),0,s.count-1),'scroll');
   }
   setHandoff(at.handoff);
  }),
  onLeaveBack:safe(()=>{if(pin?.st===st&&pin.stale)G.delayedCall(0,safe(()=>{if(pin?.st===st)rebindPin();}));})
 }));
 // A choice made while the stage rests above the pin changes how far the pin can turn: rebuild it then,
 // never while the reader is inside or past it (that would move the page under them).
 const offState=state.subscribe(safe((snap,change)=>{
  if(change.kind==='turn'||change.source==='scroll')return;
  const n=Math.min(2,snap.count-1-snap.index);if(n===plan.n)return;
  if(window.scrollY<st.start-1)G.delayedCall(0,safe(()=>{if(pin?.st===st)rebindPin();}));else if(pin)pin.stale=true;
 }));
 pin={st,host,offState,stale:false,plan:()=>plan};
 root().dataset.bookPin='on';signal('night-book-pin',{on:true});
 setHandoff(scrubAt(st.progress,plan).handoff);
}
/* Kill with compensation (§6.4): the spacer goes, the reader stays where they were looking. */
function unbindPin({compensate=true}={}){
 if(!pin)return;
 const {st,host,offState}=pin;pin=null;
 offState();
 const y=window.scrollY,start=st.start,length=Math.max(0,st.end-st.start);
 keepFocus(host.header,()=>st.kill(true));
 if(compensate&&length){const to=y>start&&y<start+length?start:y>=start+length?y-length:null;if(to!==null)jumpTo(to);}
 host.controller?.setHandoff?.(0);host.header.style.removeProperty('--hero-p');signal('night-handoff',0);
 const s=host.state.snapshot();
 if(!s.settled||s.turn!==s.index)host.state.openWeek(Math.round(s.turn),{animate:false,source:'scroll'});
 delete root().dataset.bookPin;signal('night-book-pin',{on:false});
}
function jumpTo(y){
 if(lenis){lenis.scrollTo(y,{immediate:true,force:true});}
 window.scrollTo({top:y,behavior:'instant'});scrollPos=window.scrollY;
}
function rebindPin(){if(!pin)return;const host=pin.host;unbindPin({compensate:false});if(pinEligible(host)){bindPin(host);ST.refresh();}}

/* ---- §6.5 touch swipe: pointerType touch or pen, horizontal intent, never a pin ---- */
function bindSwipe(host){
 const {slot,state,controller}=host,own=scope({signal:life.signal});
 let g=null;
 const width=()=>Math.max(120,Number(controller.metrics?.().pageWidthPx)||slot.clientWidth/2||300);
 // One swipe turns one leaf: the paper follows the finger at most one spread either side of the selected week,
 // so a long or fast swipe lands on the neighbouring week, never two weeks on.
 const leaf=()=>{const s=state.snapshot();return [Math.max(0,s.index-1),Math.min(s.count-1,s.index+1)];};
 const clear=()=>setTimeout(()=>{if(slot.dataset.gesture==='swipe')delete slot.dataset.gesture;},0);
 own.on(slot,'pointerdown',event=>{
  if(event.pointerType==='mouse'||!event.isPrimary||host.renderer!=='webgl2')return;
  g={id:event.pointerId,x:event.clientX,y:event.clientY,start:state.snapshot().turn,phase:'wait',grabbed:false,samples:[[event.timeStamp,event.clientX]]};
 },{passive:true});
 own.on(slot,'pointermove',event=>{
  if(!g||event.pointerId!==g.id)return;
  const dx=event.clientX-g.x,dy=event.clientY-g.y;
  if(g.phase==='wait'){
   if(Math.hypot(dx,dy)<10)return;
   // Vertical intent stays native: the browser pans (touch-action: pan-y) and cancels this pointer.
   if(Math.abs(dx)<=1.4*Math.abs(dy)){g=null;return;}
   g.phase='track';g.grabbed=state.grab('swipe');g.start=state.snapshot().turn;g.range=leaf();
   try{slot.setPointerCapture(event.pointerId);}catch{}
   slot.dataset.gesture='swipe';
  }
  g.samples.push([event.timeStamp,event.clientX]);while(g.samples.length>2&&event.timeStamp-g.samples[0][0]>100)g.samples.shift();
  if(g.grabbed)state.scrub(clamp(g.start-dx/(.8*width()),...g.range),'swipe');
 },{passive:true});
 const end=(event,cancelled)=>{
  if(!g||event.pointerId!==g.id)return;
  const gesture=g;g=null;
  if(gesture.phase!=='track')return;
  const dx=event.clientX-gesture.x,[t0,x0]=gesture.samples[0],dt=Math.max(1,event.timeStamp-t0);
  const velocity=cancelled?0:-((event.clientX-x0)/dt*1000)/(.8*width());
  if(gesture.grabbed)state.release('swipe',{velocity});
  else if(!cancelled&&Math.abs(dx)>.25*width())state.step(dx<0?1:-1,{source:'swipe'});
  clear();
 };
 own.on(slot,'pointerup',event=>end(event,false));
 own.on(slot,'pointercancel',event=>end(event,true));
 // Only the slot's own capture ending cancels. A touch pointer is implicitly captured by the canvas it lands
 // on; taking capture for the slot above ends that one, and its lostpointercapture bubbles up here.
 own.on(slot,'lostpointercapture',event=>{if(event.target===slot&&g&&event.pointerId===g.id)end(event,true);});
 track(SWIPE,()=>{if(g?.grabbed)state.release('swipe',{velocity:0});g=null;own.dispose();delete slot.dataset.gesture;});
}

/* A pin that becomes possible while the reader is past its start (Play motion, a tier or pointer change, a
   resize, a deep link) waits for them to come back above it: its spacer would land above the page they are
   reading, scroll anchoring would carry them down by its length and the header would miss its end position.
   One scroll listener at a time, owned by the mount. */
let pinWait=null;
function awaitPinStart(){
 if(pinWait)return;
 const own=pinWait=scope({signal:life.signal});
 own.on(window,'scroll',safe(()=>{const host=currentBookHost();if(host&&window.scrollY>pinStart(host)+1)return;stopPinWait();syncBook();}),{passive:true});
}
function stopPinWait(){const own=pinWait;pinWait=null;own?.dispose();}

/* One place decides what the book's scroll input should be right now. Idempotent. */
function syncBook(){
 const host=currentBookHost();
 if(!host||!host.state){stopPinWait();if(pin)unbindPin({compensate:false});dispose(SWIPE);bookOn=false;return;}
 // Swipe lives as long as the scene runs.
 if(host.renderer==='webgl2'&&!bookOn){bookOn=true;bindSwipe(host);}
 else if(host.renderer!=='webgl2'&&bookOn){bookOn=false;dispose(SWIPE);}
 if(pin&&pin.host!==host)unbindPin({compensate:false});
 const want=pinEligible(host);
 if(want&&!pin&&window.scrollY>pinStart(host)+1){awaitPinStart();return;}
 stopPinWait();
 if(want&&!pin){bindPin(host);refreshSoon(.05);}
 else if(!want&&pin)unbindPin();
}

/* ---- Mount: services that need no vendor first (sheet holds, progress, swipe), then the GSAP-driven
   layer. Idempotent; nothing here throws out of a handler. ---- */
export async function mount(ctx={}){
 if(mounted)return;mounted=true;const owner=life=scope(ctx);motionOn=motionAllowed();
 window.NightScroll={refresh:()=>refreshSoon(.05),scrollTo:safe(scrollTo),lenis:()=>lenis};
 try{
  scrollPos=window.scrollY;measure();progress();
  watchSheets();
  life.on(window,'scroll',safe(onScroll),{passive:true});
  life.on(window,'resize',safe(()=>{measure();progress();if(pending.size){clearTimeout(sweepTimer);sweepTimer=setTimeout(safe(sweep),200);}}),{passive:true});
  for(const el of $$('.next-layout,.cen-next-layout'))if(!el.dataset.nightSpeed){el.dataset.nightSpeed='0.86';el.dataset.nightVar='--ns-glow-y';}
  // Book input that needs no vendor: swipe and teleport flags.
  life.on(document,'book-host',safe(syncBook));
  for(const type of ['night-teleport','course-open-item'])life.on(document,type,()=>{teleportFlag=true;});
  for(const type of ['hashchange','popstate'])life.on(window,type,()=>{teleportFlag=true;});
  syncBook();
 }catch(error){console.warn('Night Shift scroll:',error);}
 let kit;try{kit=await vendor();}
 catch(error){if(life===owner){G=null;console.warn('Night Shift scroll: running without the motion vendor',error);}return;}
 if(life!==owner||owner.signal.aborted)return;
 ({gsap:G,ScrollTrigger:ST,SplitText:Split,Lenis:LenisClass}=kit);
 try{start();}catch(error){console.warn('Night Shift scroll:',error);}
}

function start(){
 syncLenis();
 const onRefresh=safe(()=>{measure();progress();});ST?.addEventListener?.('refresh',onRefresh);life.own(()=>ST?.removeEventListener?.('refresh',onRefresh));
 // Every refresh swaps the pinned header out of its spacer and back: a focused rail control keeps focus.
 let kept=null;const keepInit=()=>{kept=focusedIn(pin?.host.header);},keepDone=()=>{const el=kept;kept=null;refocus(el);};
 ST?.addEventListener?.('refreshInit',keepInit);ST?.addEventListener?.('refresh',keepDone);
 life.own(()=>{ST?.removeEventListener?.('refreshInit',keepInit);ST?.removeEventListener?.('refresh',keepDone);});
 const capture={capture:true,passive:true};
 life.on(window,'pointerdown',safe(settle),capture);life.on(window,'keydown',safe(settle),capture);
 // Window capture runs before GuideMotion's Flip capture on document: reveals finish first, so Flip
 // records clean inline styles and never restores a half-faded row.
 life.on(window,'click',safe(e=>{if(e.target.closest?.(COMPLETE))finishRunning();}),true);
 life.on(window,'change',safe(e=>{if(e.target.matches?.(REFLOW))finishRunning();}),true);
 life.on(document,'workspace-changed',safe(()=>{dispose(SCOPE);lenis?.reset();rebind();refreshSoon(.85);}));
 for(const type of ['hashchange','popstate'])life.on(window,type,safe(()=>lenis?.reset()));
 life.on(document,'course-open-item',safe(()=>{lenis?.reset();flushWhere(()=>true);}));
 life.on(document,'focusin',safe(e=>{for(const el of pending)if(el.contains(e.target)){play([el]);break;}}),true);
 life.on(document,'night-hold',safe(()=>syncLenis()));
 life.on(document,'guide-motion-change',safe(onMotionChange));
 life.own(onTier(safe(()=>{syncLenis();syncBook();})));
 life.on(finePointer,'change',safe(()=>{syncLenis();syncBook();rebindAll();}));
 life.on(desktop,'change',safe(rebindAll));
 life.on(document,'night-timeline-render',safe(()=>refreshSoon(.1)));
 life.on(document,'guide-completion',safe(()=>refreshSoon(.5)));
 life.on(document,'change',safe(e=>{if(e.target.matches?.('#hide-completed,#workspace-show-past'))refreshSoon(.5);}));
 life.on(document,'night-refresh',safe(()=>refreshSoon(.05)));
 life.on(document.fonts,'loadingdone',safe(()=>refreshSoon(.1)));
 life.on(window,'pageshow',safe(()=>{lenis?.resize();refreshSoon(.05);}));
 life.on(window,'beforeprint',safe(()=>{flushWhere(()=>true);finishRunning();}));
 // The header can grow past the viewport (zoom, a long caption): the pin goes; it returns when it fits.
 life.on(window,'resize',safe(()=>G.delayedCall(.15,safe(syncBook))),{passive:true});
 const main=$('.wrap,.math-wrap');let lastH=0;
 if(main&&'ResizeObserver' in window)life.observer(new ResizeObserver(safe(([entry])=>{const h=entry.contentRect.height;if(Math.abs(h-lastH)<1)return;lastH=h;measure();progress();refreshSoon(.25);})),main);
 // The pin is created before hero's own --hero-p trigger rebinds, then everything refreshes once.
 syncBook();
 rebind(Promise.all([fontsReady(),frames(2,life.signal)]));
 refreshSoon(.05);
}

export function unmount(){
 if(!mounted)return;
 stopPinWait();unbindPin({compensate:false});dispose(SWIPE);bookOn=false;teleportFlag=false;
 life?.dispose();dispose(SCOPE);flushWhere(()=>true);finishRunning();G?.ticker.remove(lenisRaf);lenis?.destroy();lenis=null;
 refreshCall?.kill();refreshCall=null;clearTimeout(sweepTimer);release('sheet');sheetHeld=false;
 delete window.NightScroll;document.documentElement.style.removeProperty('--ns-progress');mounted=false;life=null;lastProgress=-1;G=ST=Split=LenisClass=null;
}
