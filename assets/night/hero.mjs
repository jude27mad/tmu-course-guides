/* Hero: the arrival and the hero-to-dock hand-off.
   One ScrollTrigger scrubs --hero-p on the stage (0 at rest, 1 once it has scrolled away). hero.css reads it
   to recede the art, fade the eyebrow, HUD and hint, and retract the course motif; the title lifts line by
   line behind SplitText masks. Characters lean toward a fine pointer. Rest (p = 0) is also the reduced look.
   The docked state stays deadline.mjs's dock (html.ns-docked); this module never builds another.
   On a semester book route the book's pin (scroll.mjs, html[data-book-pin=on]) owns --hero-p: it is the
   book's hand-off into the dock. This trigger stands down while the pin exists, and the title lift follows
   the hand-off instead (night-handoff). The art never recedes under CSS there; the engine closes the book. */
import {scope} from '../route-lifecycle.mjs';
import {$,META,motionAllowed,sceneMotionAllowed,finePointer,atLeast,onTier,held,track,dispose,vendor} from './core.mjs?v=20261014-book1';

const SCOPE='hero',DRAGGED='night-dragged';
const phone=matchMedia('(max-width:760px)');
/* Decode glyphs are ASCII so the monospace eyebrow never changes width; each course adds its own marks. */
let GLYPHS='';
let started=false,built=false,kit=null,header=null,art=null,title=null,kicker=null,life=null;

export async function mount(ctx={}){
 if(started)return;started=true;const owner=life=scope(ctx);
 GLYPHS='ABCDEFGHKLMNPRSTUVXYZ0123456789'+({mechanism:'#=+[]',flow:'~^()/',plane:'[]|+-'}[META?.motif]||'');
 header=$('.header-upgraded');if(!header)return;
 art=$('.header-art',header);title=$('.hero-copy>h1',header);kicker=$('.hero-copy>.team,.hero-copy>.eyebrow',header);
 // The book's hint clears on a real page turn (course-header.mjs); other courses use the drag hint here.
 if(!document.documentElement.dataset.book)explore(); // independent of GSAP and of motion
 try{kit=await vendor();}catch{return;}if(life!==owner||owner.signal.aborted)return;
 // Scrub and lean follow the interface-motion gate; reduced motion or ?motion=off tears them down cleanly.
 const sync=()=>{try{if(motionAllowed())build();else if(built){built=false;dispose(SCOPE);}}catch(error){console.warn('Night Shift hero:',error);}};
 life.on(document,'guide-motion-change',sync);
 sync();
 decode();
}

/* ---- Scrub: one trigger, one proxy value. Scrub smoothing gives fine pointers a studio-style catch-up;
   touch stays glued to the finger. Once p settles the trigger does no work while coursework is read. ---- */
function build(){
 if(built||!header)return;built=true;
 const {gsap,SplitText}=kit,state={p:0};let lift=null;
 header.classList.add('ns-scrub');
 track(SCOPE,()=>{header.classList.remove('ns-scrub');header.style.removeProperty('--hero-p');});
 const lean=leanRig(gsap);
 if(title&&SplitText){
  // SplitText's own aria label would read "Intro toEngineering" across the <br>; give it the spoken title.
  const label=(title.innerText||title.textContent||'').replace(/\s+/g,' ').trim();
  const split=SplitText.create(title,{type:lean.on?'lines,words,chars':'lines',mask:'lines',linesClass:'ns-title-line',wordsClass:'ns-title-word',charsClass:'ns-title-char',autoSplit:true,
   onSplit(self){
    if(label)title.setAttribute('aria-label',label);
    lift=liftTimeline(gsap,self.lines);lift.progress(state.p);
    lean.rig(self.chars);
    return lift; // returned so a re-split (resize, font load) reverts it before measuring again
   }});
  track(SCOPE,()=>{lift=null;split.revert();});
 }
 let last=-1;
 const pinned=()=>document.documentElement.dataset.bookPin==='on';
 const paint=()=>{if(pinned())return;const p=Math.round(state.p*1e4)/1e4;if(p===last)return;last=p;header.style.setProperty('--hero-p',String(p));lift?.progress(p);};
 const scrub=gsap.to(state,{p:1,ease:'none',onUpdate:paint,scrollTrigger:{trigger:header,start:'top top',end:'bottom top',scrub:finePointer.matches?.55:true}});
 track(SCOPE,()=>{scrub.scrollTrigger?.kill();scrub.kill();});
 // The book's pin owns --hero-p while it exists; this trigger rests and the lift follows the hand-off.
 const standDown=()=>{
  const st=scrub.scrollTrigger;if(!st)return;
  if(pinned()){st.disable(false);last=-1;}
  else if(!st.enabled){st.enable(false);st.refresh();state.p=st.progress;paint();}
 };
 const follow=event=>{if(pinned())lift?.progress(Math.max(0,Math.min(1,Number(event.detail)||0)));};
 document.addEventListener('night-book-pin',standDown);document.addEventListener('night-handoff',follow);
 track(SCOPE,()=>{document.removeEventListener('night-book-pin',standDown);document.removeEventListener('night-handoff',follow);});
 standDown();
}

/* Lines peel upward from the top line down and accelerate out of their masks (power3.in reads as lift-off);
   on wide screens each line also tips from its left foot like a lifted page. Total length is exactly 1 so
   timeline progress equals --hero-p. Never touches the h1 itself (its CSS arrival owns transform/clip-path). */
function liftTimeline(gsap,lines){
 const small=phone.matches,n=lines.length,start=small?0:.04,len=small?.3:.42;
 const each=n>1?Math.min(small?.05:.08,(.92-start-len)/(n-1)):0;
 const tl=gsap.timeline({paused:true});
 lines.forEach((line,i)=>tl.fromTo(line,{yPercent:0,rotation:0,transformOrigin:'0% 100%'},{yPercent:-128,rotation:small?0:-1.6,ease:'power3.in',duration:len},start+i*each));
 return tl.set({},{},1);
}

/* ---- Kinetic title: characters lean a few px toward the cursor (fine pointer, high/mid tier).
   Pointer input is sampled once per gsap tick; quickTo springs carry each char and settle it on leave.
   Chars stay 2D (force3D:false) so the title never splinters into dozens of layers. ---- */
function leanRig(gsap){
 const on=finePointer.matches&&atLeast('mid');
 let chars=[],inside=false,dirty=false,stale=true,px=0,py=0,reach=200;
 const springs=el=>['x','y','rotation'].map(prop=>gsap.quickTo(el,prop,{duration:.9,ease:'elastic.out(1,.55)'}));
 const home=()=>{for(const c of chars)for(const s of c.s)s(0);};
 const drop=()=>{for(const c of chars)for(const s of c.s)s.tween.kill();chars=[];};
 // Centres are read once per scroll/resize burst, not per move.
 const measure=()=>{for(const c of chars){const r=c.el.getBoundingClientRect();c.x=r.left+r.width/2;c.y=r.top+r.height*.6;}stale=false;};
 function tick(){
  try{
   if(!dirty||!chars.length)return;dirty=false;if(stale)measure();
   // Gaussian falloff; damped inside 40 px so the glyph under the cursor never jitters.
   for(const c of chars){const dx=px-c.x,dy=py-c.y,d=Math.hypot(dx,dy)||1,f=Math.exp(-(d*d)/(reach*reach))*Math.min(1,d/40)/d;c.s[0](dx*f*4.5);c.s[1](dy*f*3);c.s[2](dx*f*3.2);}
  }catch{leave();}
 }
 function leave(){if(!inside)return;inside=dirty=false;gsap.ticker.remove(tick);home();}
 const move=e=>{
  try{
   if(e.pointerType==='touch'||!motionAllowed()||!atLeast('mid')||held()||art?.dataset.dragging==='true'){leave();return;}
   px=e.clientX;py=e.clientY;dirty=true;
   if(!inside){inside=true;stale=true;gsap.ticker.add(tick);}
  }catch{}
 };
 const scrolled=()=>{stale=true;};
 const holdOff=()=>{if(held())leave();};
 let offTier=()=>{};
 if(on){
  header.addEventListener('pointermove',move,{passive:true});header.addEventListener('pointerleave',leave,{passive:true});
  addEventListener('scroll',scrolled,{passive:true});addEventListener('resize',scrolled,{passive:true});
  document.addEventListener('night-hold',holdOff);
  offTier=onTier(()=>{if(!atLeast('mid'))leave();});
 }
 track(SCOPE,()=>{leave();drop();header.removeEventListener('pointermove',move);header.removeEventListener('pointerleave',leave);removeEventListener('scroll',scrolled);removeEventListener('resize',scrolled);document.removeEventListener('night-hold',holdOff);offTier();});
 return {on,rig(list){
  drop();if(!on||!list?.length)return;
  gsap.set(list,{transformOrigin:'50% 85%',force3D:false});
  chars=list.map(el=>({el,x:0,y:0,s:springs(el)}));stale=true;dirty=inside;
  reach=Math.max(140,Math.min(320,(parseFloat(getComputedStyle(title).fontSize)||80)*2.4));
 }};
}

/* ---- Eyebrow decode: once, under 400 ms, only when the eyebrow is on screen and motion is welcome
   (the saved pause counts: a paused visitor asked for a calm page). Screen readers keep the real text
   in a visually hidden copy for the duration; the original single text node is restored at the end. ---- */
function decode(){
 const el=kicker;
 // An arrival flourish only: on a slow device that mounts late, a scramble seconds in would feel random.
 if(!el||!kit||el.children.length||!sceneMotionAllowed()||document.hidden||performance.now()>4500)return;
 const text=el.textContent,box=el.getBoundingClientRect();
 if(!text.trim()||box.bottom<0||box.top>innerHeight||!box.width)return;
 const chars=[...text],keep=/[\s/·.,:]/;
 // Resolve left to right with a little jitter; everything has settled by 88% of the run.
 const settle=chars.map((c,i)=>.12+i/chars.length*.6+Math.random()*.16);
 const sr=document.createElement('span'),face=document.createElement('span');
 sr.className='ns-sr';sr.textContent=text;face.className='ns-decode';face.setAttribute('aria-hidden','true');
 const state={t:0};let frame=0;
 const draw=()=>{face.textContent=chars.map((c,i)=>keep.test(c)||state.t>=settle[i]?c:GLYPHS[Math.random()*GLYPHS.length|0]).join('');};
 const restore=()=>{if(face.isConnected)el.textContent=text;};
 draw();el.replaceChildren(sr,face);
 const decodeTween=kit.gsap.to(state,{t:1,duration:.38,ease:'none',onComplete:restore,onInterrupt:restore,onUpdate(){
  try{if(!motionAllowed()){this.kill();return;}if(frame++%2)return;draw();}catch{restore();} // ~30 Hz glyph changes stay legible
 }});
 life.own(()=>{decodeTween.kill();restore();});
}

/* ---- "Drag to explore" stays until the visitor really drags the art (the scene accepted the drag and
   it travelled more than a few px) or turns it with the arrow keys; then it clears for the session. ---- */
function explore(){
 if(!art)return;
 let seen=false;try{seen=sessionStorage.getItem(DRAGGED)==='1';}catch{}
 if(seen){header.classList.add('ns-explored');return;}
 let from=null;
 const listeners=[
  ['pointerdown',e=>{from=e.isPrimary?[e.clientX,e.clientY,e.pointerId]:null;}],
  ['pointermove',e=>{if(from&&e.pointerId===from[2]&&art.dataset.dragging==='true'&&Math.hypot(e.clientX-from[0],e.clientY-from[1])>8)done();}],
  ['pointerup',()=>{from=null;}],['pointercancel',()=>{from=null;}],
  ['keydown',e=>{if(e.target===art&&/^Arrow/.test(e.key||'')&&art.dataset.renderer==='webgl2')done();}]
 ];
 function done(){
  header.classList.add('ns-explored');
  try{sessionStorage.setItem(DRAGGED,'1');}catch{}
  for(const [type,fn] of listeners)art.removeEventListener(type,fn);
 }
 for(const [type,fn] of listeners)life.on(art,type,fn,{passive:true});
}

export function unmount(){if(!started)return;life?.dispose();dispose(SCOPE);header?.classList.remove('ns-explored');life=null;started=built=false;kit=header=art=title=kicker=null;}
