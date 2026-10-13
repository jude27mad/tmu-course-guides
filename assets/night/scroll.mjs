/* Night Shift scroll: Lenis on the shared GSAP clock, the page progress bar, the course marquee, editorial
   reveals, velocity skew and parallax. Drama lives between sections; coursework holds still while it is read.
   Shared surface for other modules (this file is imported with a query string, so never import it):
   window.NightScroll = {refresh(), scrollTo(target,{immediate,offset}), lenis()}, or dispatch 'night-refresh'. */
import {scope} from '../route-lifecycle.mjs';
import {vendor,META,TERM,escape,$,$$,motionAllowed,ambientAllowed,onAmbient,hold,release,held,finePointer,atLeast,onTier,track,dispose,view,frames} from './core.mjs?v=20261013-shift1';

const SCOPE='scroll';
const ROWS='#assessment-list>li,#teamlist>.tile,#youlist>.tile';
const TITLES='.workspace-page-title,.math-lab .workbench-title h2'; // display titles only; card headings stay put
const INNER=':scope>details>summary>span,:scope>.head>.date,:scope>.head>.info';
const LISTS='#assessment-list,#teamlist,#youlist';
const NATIVE='dialog,.detail-sheet,.lab-dialog,[data-lenis-prevent]';
const COMPLETE='[data-quick-complete],#undo-complete';
const REFLOW='[data-check],[data-completed],[data-k],[data-completion],[data-topic],#hide-completed,#workspace-show-past';
const desktop=matchMedia('(min-width:1001px)');
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const ease=(dt,tau)=>1-Math.exp(-dt/tau); // frame-rate independent smoothing
const expoInOut=t=>t<=0?0:t>=1?1:t<.5?2**(20*t-10)/2:(2-2**(10-20*t))/2;
const safe=fn=>{const owner=life;return (...args)=>{if(owner?.signal.aborted)return;try{return fn(...args);}catch(error){console.warn('Night Shift scroll:',error);}};};
const fontsReady=()=>Promise.race([document.fonts?.ready??Promise.resolve(),new Promise(r=>life.timeout(r,1200))]);

let G=null,ST=null,Split=null,LenisClass=null,lenis=null,mounted=false,motionOn=false,life=null;
let scrollPos=0,maxScroll=1,lastProgress=-1,lastActive=0,awake=false;

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
   allowNestedScroll, horizontal gestures (timeline track, wide content) by skipping Lenis entirely. ---- */
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
 scrollPos=window.scrollY;lastActive=performance.now();
 if(!awake&&scrollPos>24){awake=true;syncMarquee();} // the marquee wakes on the visitor's first scroll
 if(lenis&&lenis.isScrolling==='smooth'&&Math.abs(scrollPos-lenis.animatedScroll)>2)lenis.reset();
 progress();wake();
 if(pending.size){clearTimeout(sweepTimer);sweepTimer=setTimeout(safe(sweep),160);}
}

/* ---- One callback on the shared ticker turns scroll into velocity for the marquee and the list skew.
   It detaches itself once nothing moves, so a still page runs no loop of its own. ---- */
let ticking=false,lastY=0,vel=0;
const position=()=>lenis?lenis.animatedScroll:scrollPos;
function wake(){if(G&&!ticking&&(marqueeLive()||skewLive()||skewNow)){ticking=true;lastY=position();G.ticker.add(frame);}}
function sleep(){if(ticking){ticking=false;G.ticker.remove(frame);vel=0;}}
function frame(time,deltaMs){
 try{
  const dt=clamp(deltaMs||16.7,1,64)/1000,y=position(),moved=y-lastY;lastY=y;
  // Teleports (view switch, anchor jump) are not momentum.
  vel+=((Math.abs(moved)>1200?0:clamp(moved/dt,-5000,5000))-vel)*ease(dt,.12);
  const live=marqueeLive();
  if(live)stepMarquee(dt);
  stepSkew(dt);
  if(!live&&!skewNow&&Math.abs(vel)<1)sleep();
 }catch(error){sleep();console.warn('Night Shift scroll:',error);}
}

/* ---- Velocity skew (high tier): the list containers lean at most 2deg, never the rows (GuideMotion's Flip
   owns their transforms). A dead zone keeps reading-speed scrolls perfectly still, and the layer is
   promoted only while it leans so text stays sharp at rest. ---- */
let skewNow=0,skewEls=[];
const skewLive=()=>atLeast('high')&&motionAllowed()&&!held()&&skewEls.length>0;
function stepSkew(dt){
 const speed=Math.abs(vel),target=skewLive()&&speed>320?-Math.sign(vel)*Math.min(2,(speed-320)/900):0;
 let next=skewNow+(target-skewNow)*ease(dt,.16);
 if(!target&&Math.abs(next)<.01)next=0;
 if(next===skewNow||next&&Math.abs(next-skewNow)<.002)return;
 skewNow=next;const value=next?`skewY(${next.toFixed(3)}deg)`:'';
 for(const el of skewEls){el.style.transform=value;el.style.willChange=next?'transform':'';}
}
function resetSkew(){skewNow=0;for(const el of skewEls){el.style.transform='';el.style.willChange='';}}

/* ---- Marquee: a huge outlined course line between the hero and the coursework. Still on arrival; drifts
   once the visitor scrolls, races and reverses with scroll velocity, then eases back. Near-still while
   the visitor reads (idle > 2 s), frozen whenever ambient motion is not allowed, static on low tier.
   Each course's separator speaks its vocabulary: gears in mesh roll with the line (CEN100), a flowing
   curve carries its tangent (MTH140), a basis grid shears (MTH141). ---- */
const BASE=30; // px/s at rest
let mq=null,mqTrack=null,mqItem='',mqW=0,mqX=NaN,mqTravel=0,mqSpeed=0,mqLean=0,mqVisible=false;
const marqueeLive=()=>!!mq&&awake&&mqVisible&&mqW>0&&ambientAllowed()&&atLeast('mid');
const fx=n=>+n.toFixed(2);
function gearPath(teeth,r){
 const step=2*Math.PI/teeth;let d='';
 for(let i=0;i<teeth;i++)for(const [k,rad] of [[-.28,r-5],[-.16,r+5],[.16,r+5],[.28,r-5]]){const a=(i+k)*step;d+=`${d?'L':'M'}${fx(rad*Math.cos(a))} ${fx(rad*Math.sin(a))}`;}
 return d+'Z';
}
function wavePath(){let d='';for(let u=0;u<=300;u+=5)d+=`${u?'L':'M'}${u} ${fx(50-28*Math.sin(Math.PI*u/50))}`;return d;}
function gridPath(){let d='';for(const v of [-36,-18,0,18,36])d+=`M${v} -36V36M-36 ${v}H36`;return d;}
const MOTIF={
 // 12:7 mesh on a shared tooth size; the 7-tooth gear meets the big gear's tooth with a gap.
 mechanism:()=>`<span class="ns-mq-sep ns-mq-gears"><svg class="ns-gear ns-gear-a" viewBox="-46 -46 92 92"><path d="${gearPath(12,40)}"/><circle r="11"/><circle class="ns-dot" r="3.5"/></svg><svg class="ns-gear ns-gear-b" viewBox="-29.5 -29.5 59 59"><path d="${gearPath(7,70/3)}"/><circle r="7"/><circle class="ns-dot" r="2.5"/></svg></span>`,
 flow:()=>`<span class="ns-mq-sep ns-mq-flow"><svg class="ns-mq-wave" viewBox="0 0 300 100" preserveAspectRatio="none"><path d="${wavePath()}"/></svg><svg class="ns-mq-tan" viewBox="-50 -50 100 100"><path d="M-40 0H40"/><circle class="ns-dot" r="5.5"/></svg></span>`,
 plane:()=>`<span class="ns-mq-sep ns-mq-plane"><svg class="ns-mq-grid" viewBox="-50 -50 100 100"><path class="ns-mq-g" d="${gridPath()}"/><path d="M0 0H32M26 -5L32 0L26 5M0 0V-32M-5 -26L0 -32L5 -26"/><circle class="ns-dot" r="3"/></svg></span>`
};
function mountMarquee(){
 const anchor=document.getElementById('workspace-search');
 if(!anchor||$('.ns-marquee'))return;
 mqItem=`<span class="ns-mq-item"><b class="ns-mq-code">${escape(META.code)}</b><i>—</i><span>${escape(META.name)}</span><i>—</i><span>Fall ${TERM.start.slice(0,4)}</span>${(MOTIF[META.motif]||MOTIF.flow)()}</span>`;
 let ref=anchor.nextElementSibling;while(ref&&!ref.getClientRects().length)ref=ref.nextElementSibling;
 const before=ref?ref.getBoundingClientRect().top:innerHeight;
 mq=document.createElement('div');mq.className='ns-marquee';mq.setAttribute('aria-hidden','true');
 mq.innerHTML=`<div class="ns-mq-track">${mqItem.repeat(3)}</div>`;mqTrack=mq.firstElementChild;
 anchor.after(mq);
 // Keep the reader's place: if the band lands above the fold, the content under the eye must not move
 // (scroll anchoring already does this where supported; Safari needs the manual nudge).
 if(ref){
  const shift=ref.getBoundingClientRect().top-before;
  if(before<0&&Math.abs(shift)>.5)window.scrollTo({top:window.scrollY+shift,behavior:'instant'});
  else if(before<innerHeight&&motionAllowed())mq.classList.add('ns-mq-enter');
 }
 measureMarquee();
 if('ResizeObserver' in window)life.observer(new ResizeObserver(safe(measureMarquee)),mq);
 if('IntersectionObserver' in window)life.observer(new IntersectionObserver(safe(([e])=>{mqVisible=e.isIntersecting;syncMarquee();}),{rootMargin:'160px 0px'}),mq);
 else mqVisible=true;
 document.fonts?.ready.then(safe(measureMarquee));
}
/* One copy's width is the loop length; enough copies to cover the band plus one. */
function measureMarquee(){
 if(!mq)return;
 const items=mqTrack.children;if(items.length<2)return;
 const w=items[1].getBoundingClientRect().left-items[0].getBoundingClientRect().left;if(!(w>0))return;
 const need=Math.max(2,Math.ceil(mq.clientWidth/w)+1);
 if(need!==items.length)mqTrack.innerHTML=mqItem.repeat(need);
 mqW=w;if(Number.isNaN(mqX))mqX=-w*.14;mqX=((mqX%w)-w)%w;
 paintMarquee();syncMarquee();
}
function stepMarquee(dt){
 const reading=performance.now()-lastActive>2000;
 const drift=BASE*(reading?.06:1);
 mqSpeed+=(-(drift+vel*.2)-mqSpeed)*ease(dt,.4);
 const move=mqSpeed*dt;mqX+=move;mqTravel+=move;
 if(mqX<=-mqW||mqX>0)mqX=((mqX%mqW)-mqW)%mqW;
 mqLean+=((atLeast('high')?clamp(-vel/380,-6,6):0)-mqLean)*ease(dt,.22);
 paintMarquee();
}
function paintMarquee(){
 if(!mqTrack||Number.isNaN(mqX))return;
 mqTrack.style.transform=`translate(${mqX.toFixed(2)}px,0)`+(Math.abs(mqLean)>.01?` skewX(${mqLean.toFixed(2)}deg)`:'');
 const s=mq.style,t=mqTravel;
 if(META.motif==='mechanism')s.setProperty('--mq-turn',(t*1.1%360).toFixed(2)); // rolls without slipping
 else if(META.motif==='plane')s.setProperty('--mq-shear',(12*Math.sin(t/520)+clamp(-vel/90,-16,16)).toFixed(2));
 else{
  // The curve slides under a fixed point; the point rides y(u) and its tangent turns to the slope.
  const phase=((-t/360)%1+1)%1,a=2*Math.PI*(.75+phase);
  s.setProperty('--mq-wave',phase.toFixed(4));
  s.setProperty('--mq-ty',(-28*Math.sin(a)).toFixed(2));
  s.setProperty('--mq-ta',(Math.atan(-28*Math.PI/50*Math.cos(a))*180/Math.PI).toFixed(2));
 }
}
function syncMarquee(){
 if(!mq)return;
 const live=marqueeLive();mq.classList.toggle('is-live',live);
 if(!live&&mqLean){mqLean=0;paintMarquee();}
 wake();
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
 skewEls=$$(LISTS).filter(el=>el.getClientRects().length);
 track(SCOPE,resetSkew);
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
 if(lenis&&!lenis.isStopped){lenis.scrollTo(target,{offset,immediate:!smooth,duration:1.15,easing:expoInOut});return;}
 const el=typeof target==='string'?document.querySelector(target):target;
 const top=typeof target==='number'?target:el?.getBoundingClientRect?el.getBoundingClientRect().top+window.scrollY:null;
 if(top!==null)window.scrollTo({top:top+offset,behavior:smooth?'smooth':'instant'});
}

function onMotionChange(){
 syncLenis();syncMarquee();
 const on=motionAllowed();if(on===motionOn)return;motionOn=on;
 // Turning motion off shows everything now; turning it on binds only what is still below the fold.
 dispose(SCOPE);resetSkew();
 if(on)rebind();
}

/* ---- Mount: services that need no vendor first (sheet holds, progress, the static marquee), then the
   GSAP-driven layer. Idempotent; nothing here throws out of a handler. ---- */
export async function mount(ctx={}){
 if(mounted)return;mounted=true;const owner=life=scope(ctx);motionOn=motionAllowed();
 window.NightScroll={refresh:()=>refreshSoon(.05),scrollTo:safe(scrollTo),lenis:()=>lenis};
 try{
  scrollPos=window.scrollY;awake=scrollPos>24;lastActive=performance.now();measure();progress();
  watchSheets();
  life.on(window,'scroll',safe(onScroll),{passive:true});
  life.on(window,'resize',safe(()=>{measure();progress();if(pending.size){clearTimeout(sweepTimer);sweepTimer=setTimeout(safe(sweep),200);}}),{passive:true});
  const activity=()=>{lastActive=performance.now();};
  for(const type of ['pointermove','pointerdown','wheel','keydown','touchstart'])life.on(window,type,activity,{passive:true});
  for(const el of $$('.next-layout,.cen-next-layout'))if(!el.dataset.nightSpeed){el.dataset.nightSpeed='0.86';el.dataset.nightVar='--ns-glow-y';}
  mountMarquee();
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
 life.on(document,'night-hold',safe(()=>{syncLenis();syncMarquee();}));
 life.on(document,'guide-motion-change',safe(onMotionChange));
 life.own(onAmbient(safe(syncMarquee)));
 life.own(onTier(safe(()=>{syncLenis();if(!atLeast('high'))resetSkew();syncMarquee();})));
 life.on(finePointer,'change',safe(()=>{syncLenis();rebindAll();}));
 life.on(desktop,'change',safe(rebindAll));
 life.on(document,'night-timeline-render',safe(()=>refreshSoon(.1)));
 life.on(document,'guide-completion',safe(()=>refreshSoon(.5)));
 life.on(document,'change',safe(e=>{if(e.target.matches?.('#hide-completed,#workspace-show-past'))refreshSoon(.5);}));
 life.on(document,'night-refresh',safe(()=>refreshSoon(.05)));
 life.on(document.fonts,'loadingdone',safe(()=>{measureMarquee();refreshSoon(.1);}));
 life.on(window,'pageshow',safe(()=>{lenis?.resize();refreshSoon(.05);}));
 life.on(window,'beforeprint',safe(()=>{flushWhere(()=>true);finishRunning();}));
 const main=$('.wrap,.math-wrap');let lastH=0;
 if(main&&'ResizeObserver' in window)life.observer(new ResizeObserver(safe(([entry])=>{const h=entry.contentRect.height;if(Math.abs(h-lastH)<1)return;lastH=h;measure();progress();refreshSoon(.25);})),main);
 syncMarquee();
 rebind(Promise.all([fontsReady(),frames(2,life.signal)]));
 refreshSoon(.05);
}

export function unmount(){if(!mounted)return;life?.dispose();dispose(SCOPE);flushWhere(()=>true);finishRunning();resetSkew();sleep();G?.ticker.remove(lenisRaf);lenis?.destroy();lenis=null;refreshCall?.kill();refreshCall=null;clearTimeout(sweepTimer);release('sheet');sheetHeld=false;mq?.remove();mq=mqTrack=null;mqItem='';mqW=mqTravel=mqSpeed=mqLean=0;mqX=NaN;mqVisible=false;skewEls=[];delete window.NightScroll;document.documentElement.style.removeProperty('--ns-progress');mounted=false;life=null;lastProgress=-1;G=ST=Split=LenisClass=null;}
