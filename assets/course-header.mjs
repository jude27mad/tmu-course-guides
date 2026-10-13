import {sceneMotionAllowed as motionAllowed,setScenePaused as setPaused,preference} from './guide-motion.mjs';
import {posterPaths} from './scenes/framing.mjs?v=20261012-subject1';
import {scope,rememberDOM} from './route-lifecycle.mjs';
import {BOOK_COURSES,bookPosterPaths,currentTheme,onTheme} from './book/course-styles.mjs?v=20261013-book1';
import {createBookState,attachBookState,detachBookState,describeSpread,setBookHost} from './book/book-state.mjs';
import {recordsForCourse,semesterWeeks,currentWeekIndex} from './book/weeks.mjs';
import {COURSES} from './course-data.mjs?v=20261012-assessments2';
import {held,openItem,today as torontoToday,addDays,timestamp} from './night/core.mjs?v=20261013-shift1';
import {readSaved} from './night/targets.mjs?v=20261013-shift1';
import {currentTarget} from './night/deadline.mjs?v=20261013-shift1';
import {mountRail} from './night/timeline.mjs?v=20261013-shift1';
let live;
export function mount(ctx={}){
 unmount();
 const life=scope(ctx);
 const header=(ctx.root||document).querySelector('.course-heading,.circuit-head');
 if(!header||!document.body.classList.contains('workspace')||header.classList.contains('header-upgraded')){life.dispose();return;}
 const course=ctx.route||document.body.dataset.course;
 if(BOOK_COURSES.includes(course)){mountBook(ctx,life,header,course);return;}
 const state=live={life,restore:rememberDOM(header),scene:null};
 const art=document.createElement('div');art.className='header-art';art.dataset.artRevision='20261012-subject1';
 const info={cen100:['01 / ENGINEERING','Drag to explore'],mth140:['02 / CALCULUS','Drag to explore'],mth141:['03 / LINEAR ALGEBRA','Drag to explore']}[course];
 art.setAttribute('role','group');art.tabIndex=0;art.setAttribute('aria-roledescription','interactive 3D illustration');art.setAttribute('aria-label',course==='cen100'?'Working planetary gearbox. Drag to rotate, or use arrow keys. Home resets the view.':course==='mth140'?'Flowing curves with a moving tangent. Drag to rotate, or use arrow keys. Home resets the view.':'A sphere and three basis vectors transformed by matrices. Drag to rotate, or use arrow keys. Home resets the view.');
 art.dataset.description=art.getAttribute('aria-label').split('. Drag')[0];
 art.innerHTML='<div class="scene-atmosphere"></div>';
 header.prepend(art);header.classList.add('header-upgraded');
 const poster=document.createElement('img');poster.className='scene-poster';poster.alt='';poster.decoding='async';poster.fetchPriority='high';Object.assign(poster.dataset,posterPaths(course));art.dataset.portrait=String(header.clientWidth<680);poster.src=header.clientWidth<680?poster.dataset.tall:poster.dataset.wide;art.append(poster);
 const copy=header.querySelector('.hero-copy');if(copy){const kicker=copy.querySelector('.team,.eyebrow');if(kicker)kicker.textContent=info[0];const h1=copy.querySelector('h1');if(course==='cen100'&&h1)h1.innerHTML='Intro to<br>Engineering';}
 const meta=document.createElement('div');meta.className='scene-meta';meta.innerHTML=`<span><i></i>${info[1]}</span><button class="scene-pause" type="button" aria-label="Pause animation" aria-pressed="false"></button>`;header.append(meta);
 const button=meta.querySelector('button');
 function sync(){const on=motionAllowed(),pref=preference();button.setAttribute('aria-pressed',String(!on));button.setAttribute('aria-label',on?'Pause animation':'Resume animation');button.title=on?'Pause animation':pref.reduced?'Motion follows your device setting':'Resume animation';button.disabled=pref.reduced||pref.forced;button.innerHTML=on?'<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7 5v10M13 5v10"/></svg>':'<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m7 4 8 6-8 6z"/></svg>';art.dataset.motionState=on?'ready':'still';}
 life.on(button,'click',()=>setPaused(!preference().scenePaused));life.on(document,'guide-motion-change',sync);sync();
 function staticArt(){if(art.dataset.renderer!=='poster')return;art.removeAttribute('tabindex');art.setAttribute('role','img');art.removeAttribute('aria-roledescription');art.setAttribute('aria-label',art.dataset.description);meta.hidden=true;}
 const fallbackObserver=new MutationObserver(staticArt);life.observer(fallbackObserver,art,{attributes:true,attributeFilter:['data-renderer']});
 // Coursework and router capture are ready independently of scene import or shader compilation.
 void (async()=>{try{const m=await import('./course-scene.mjs?v=20261013-shift1');if(live!==state||life.signal.aborted)return;const scene=await m.mountScene(art,course,life.signal);if(live!==state||life.signal.aborted)scene?.dispose();else state.scene=scene;}catch{if(live===state){art.dataset.renderer='poster';art.dataset.sceneReady='true';art.dataset.awake='true';staticArt();}}})();
}
export function unmount(){if(!live)return;const state=live;live=null;state.life.dispose();state.scene?.dispose();state.book?.dispose();state.restore();}

/* ---------------------------------------------------------------- the semester book (spec §6.1) ----------
   The hero of a book course is the open sketchbook, rendered by Side A into the art slot. Everything a
   visitor needs is real DOM first: the themed poster, the rail (caption and week controls, timeline.mjs) and
   the Skip link work before, without and after WebGL. The scene is imported only when idle and only after the
   stage's probe passes; course-scene.mjs is never imported here.

   Motion policy (§4.1), the one table both sides use:
     full  scene motion allowed and no temporary hold
     fade  OS reduced motion is the only reason (not ?motion=off, Pause motion, a dialog pause or a hold)
     cut   everything else */
export function bookPolicy(){
 if(motionAllowed()&&!held())return 'full';
 const p=preference()||{};
 return p.reduced&&!p.forced&&!p.scenePaused&&!p.paused&&!held()?'fade':'cut';
}
const HINT_SEEN='night-dragged'; // the session flag hero.mjs already keeps for the art's drag hint
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));

function mountBook(ctx,life,header,course){
 const restore=rememberDOM(header),root=document.documentElement,data=COURSES[course];
 const state={life,restore,scene:null,book:null};live=state;
 const arrival={start:ctx.direct===false?performance.now():0};

 /* 1. Stage DOM, from data, with no WebGL: the slot, its themed poster, the hint and the fallback notice. */
 const art=document.createElement('div');art.className='header-art';
 art.setAttribute('aria-hidden','true');art.dataset.book=course;art.dataset.renderer='pending';art.dataset.motionState='still';
 const poster=document.createElement('img');poster.className='scene-poster';poster.alt='';poster.decoding='async';poster.fetchPriority='high';poster.draggable=false;
 art.append(poster);header.prepend(art);header.classList.add('header-upgraded');
 const phone=matchMedia('(max-width:760px)');
 const paintPoster=()=>{const paths=bookPosterPaths(course,currentTheme()),src=phone.matches?paths.tall:paths.wide;if(poster.getAttribute('src')!==src)poster.src=src;};
 paintPoster();
 life.own(onTheme(paintPoster));
 life.on(phone,'change',paintPoster);
 const kicker=header.querySelector('.hero-copy .team,.hero-copy .eyebrow');if(kicker)kicker.textContent='02 / CALCULUS';

 const meta=document.createElement('div');meta.className='scene-meta ns-book-meta';
 meta.innerHTML=`<p class="ns-book-hint"><i aria-hidden="true"></i><span aria-hidden="true">Drag or swipe to turn</span><span class="ns-sr">Drag or swipe to turn pages. You can also use the week buttons</span></p>`+
  `<div class="ns-book-fallback" hidden><p class="ns-book-fallback-title"><span aria-hidden="true">Book view unavailable</span><span class="ns-sr">Three-dimensional book view unavailable</span></p>`+
  `<p class="ns-book-fallback-text"><span aria-hidden="true">Use the week controls to browse.</span><span class="ns-sr">The book could not load. Weeks and assessments remain available through the week controls</span></p>`+
  `<button type="button" class="ns-book-retry" aria-describedby="ns-book-retry-d">Try again</button><span class="ns-sr" id="ns-book-retry-d">Try loading the 3D book again</span></div>`+
  `<button class="scene-pause ns-book-pause" type="button" aria-pressed="false"></button>`;
 header.append(meta);
 const pause=meta.querySelector('.ns-book-pause'),notice=meta.querySelector('.ns-book-fallback'),retry=meta.querySelector('.ns-book-retry');
 const syncPause=()=>{
  const on=motionAllowed(),pref=preference(),locked=!!(pref.reduced||pref.forced);
  pause.setAttribute('aria-pressed',String(!on));pause.setAttribute('aria-label',on?'Pause motion':'Play motion');
  pause.title=locked?'Motion follows your device setting':on?'Pause motion':'Play motion';pause.disabled=locked;
  pause.innerHTML=on?'<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7 5v10M13 5v10"/></svg>':'<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m7 4 8 6-8 6z"/></svg>';
 };
 life.on(pause,'click',()=>setPaused(!preference().scenePaused));
 life.on(document,'guide-motion-change',syncPause);syncPause();
 let hintSeen=false;try{hintSeen=sessionStorage.getItem(HINT_SEEN)==='1';}catch{}
 if(hintSeen)header.classList.add('ns-explored');

 /* 2. Data → weeks → state. The words come from describeSpread, bound here to the live context. */
 const control=()=>document.getElementById('section-select');
 const saved=()=>{try{return readSaved(course,data);}catch{return {section:0,completed:{}};}};
 const section=current=>{const c=control();return c?Number(c.value)||0:current.section;};
 let context=null;
 const recompute=()=>{
  const s=saved(),sec=section(s);
  const records=recordsForCourse(course,{courseData:COURSES,section:sec,completed:s.completed});
  context={section:sec,completed:s.completed,weeks:semesterWeeks({records})};
  return context;
 };
 recompute();
 const describe=(spread,index)=>describeSpread(spread,{course,data,weeks:book.weeks,section:context.section,completed:context.completed,now:Date.now(),targetId:currentTarget()?.id??null,today:book.today});
 const book=createBookState({course,weeks:context.weeks,today:currentWeekIndex(context.weeks),policy:bookPolicy,describe});
 attachBookState(book);
 state.bookState=book;
 root.dataset.book=course;
 life.own(()=>{if(root.dataset.book===course)delete root.dataset.book;delete root.dataset.bookPin;});

 /* 3. The rail (caption and week controls) renders the state now; timeline.mjs owns it. */
 const rail=mountRail(header,book,{signal:life.signal,setFocus:id=>state.book?.setFocus(id),slot:art});
 life.own(()=>rail?.dispose());

 /* The Skip link: the first focusable element, ahead of the shell sidebar (hub.js prepends itself). */
 const skip=document.querySelector('body > .skip-link');
 if(skip&&document.body.firstElementChild!==skip)document.body.prepend(skip);
 if(skip)life.on(skip,'click',event=>{
  if(event.defaultPrevented||event.button||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
  const target=skipTarget();if(!target)return;
  event.preventDefault();
  window.CourseWorkspace?.show('assignments');
  // The pin rebases on this jump instead of turning pages (scroll.mjs).
  document.dispatchEvent(new CustomEvent('night-teleport',{detail:{source:'skip'}}));
  const view=document.getElementById('workspace-assignments')||target;
  if(window.NightScroll)window.NightScroll.scrollTo(view,{immediate:true,offset:-skipOffset()});
  else window.scrollTo({top:view.getBoundingClientRect().top+window.scrollY-skipOffset(),behavior:'instant'});
  if(!target.hasAttribute('tabindex'))target.setAttribute('tabindex','-1');
  target.focus({preventScroll:true});
 });

 /* 6. A route change waits for the book to fold shut when it is the thing on screen. */
 life.on(document,'route-will-change',event=>{
  const controller=state.book;if(!controller||bookPolicy()!=='full'||art.dataset.renderer!=='webgl2')return;
  const r=art.getBoundingClientRect(),shown=Math.max(0,Math.min(r.bottom,innerHeight)-Math.max(r.top,0));
  if(r.height&&shown/r.height>=.5)event.detail?.waitUntil?.(Promise.race([controller.close({ms:350}).catch(()=>{}),wait(400)]));
 });

 /* §6.10: data refresh. Every source becomes setWeeks(); views recompute lazily from the new context. */
 const refresh=reason=>{if(life.signal.aborted)return;recompute();book.setWeeks(context.weeks,{reason});};
 life.on(document,'guide-completion',()=>queueMicrotask(()=>refresh('completion')));
 life.on(document,'change',event=>{if(event.target?.id==='section-select')queueMicrotask(()=>refresh('section'));});
 life.on(window,'storage',event=>{if(event.key===course+'-progress-v1'||event.key===course+'-section-v1')refresh('storage');});
 let day=torontoToday();
 const visibleChanged=()=>{
  const s=book.snapshot(),indices=new Set([s.index,Math.floor(s.turn),Math.ceil(s.turn)]);
  for(const i of indices){const before=book.view(i),after=book.view(i,{fresh:true});if(before&&after&&before.signature!==after.signature)return true;}
  return false;
 };
 const midnight=()=>{const now=torontoToday();if(now===day)return false;day=now;book.setWeeks(context.weeks,{reason:'midnight',today:currentWeekIndex(context.weeks)});return true;};
 const tick=()=>{if(document.hidden||life.signal.aborted)return;if(!midnight()&&visibleChanged())book.setWeeks(book.weeks,{reason:'minute'});};
 let minuteTimer=0;
 const scheduleMinute=()=>{clearTimeout(minuteTimer);if(life.signal.aborted)return;minuteTimer=setTimeout(()=>{tick();scheduleMinute();},60000-Date.now()%60000+50);};
 life.own(()=>clearTimeout(minuteTimer));scheduleMinute();
 let midnightTimer=0;
 const scheduleMidnight=()=>{clearTimeout(midnightTimer);if(life.signal.aborted)return;const next=timestamp(addDays(torontoToday(),1),'00:00')-Date.now();midnightTimer=setTimeout(()=>{midnight();scheduleMidnight();},Math.max(1000,Math.min(next+500,2**31-1)));};
 life.own(()=>clearTimeout(midnightTimer));scheduleMidnight();
 life.on(document,'visibilitychange',()=>{if(!document.hidden){tick();scheduleMinute();scheduleMidnight();}});
 life.on(window,'pageshow',()=>{midnight();scheduleMidnight();});

 /* The drag/swipe hint stays until a gesture actually turns a page, then clears for the session. */
 life.own(book.subscribe((snap,change)=>{
  if(change.kind!=='select'||!['drag','swipe'].includes(change.source))return;
  header.classList.add('ns-explored');try{sessionStorage.setItem(HINT_SEEN,'1');}catch{}
 }));

 /* 4–5. Probe when idle, then the engine. Any failure leaves the poster, the rail and the fallback timeline. */
 const publish=extra=>setBookHost({state:book,header,slot:art,controller:state.book,renderer:art.dataset.renderer,policy:bookPolicy,...extra});
 publish({controller:null});
 const showFallback=reason=>{
  if(life.signal.aborted)return;
  art.dataset.renderer='poster';art.dataset.rendererReason=reason||'unavailable';art.dataset.sceneReady='true';art.dataset.motionState='still';
  header.dataset.bookView='poster';
  notice.hidden=reason==='tier-low'||reason==='aborted';retry.hidden=reason!=='error';
  publish({});
 };
 let attempt=0;
 async function start(){
  const ticket=++attempt;
  header.dataset.bookView='pending';
  try{
   const stage=await import('./app/stage.mjs?v=20261013-stage1');
   if(ticket!==attempt||life.signal.aborted)return;
   const status=stage.probe();
   if(!status.ok){showFallback(status.reason);return;}
   const scene=await import('./book/book-scene.mjs');
   if(ticket!==attempt||life.signal.aborted)return;
   const controller=await scene.mountBook(art,{course,state:book,getView:i=>book.view(i),signal:life.signal,arrival,
    onOpen:open=>openItem(open),onFallback:reason=>showFallback(reason),
    dockTarget:()=>document.querySelector('.ns-dock-id i')?.getBoundingClientRect()??null});
   if(ticket!==attempt||life.signal.aborted){controller?.dispose?.();return;}
   state.book=controller;publish({});
   const renderer=await controller.ready;
   if(ticket!==attempt||life.signal.aborted)return;
   if(renderer==='webgl2'){header.dataset.bookView='webgl2';notice.hidden=true;publish({});}
   else showFallback(art.dataset.rendererReason||'unavailable');
  }catch(error){
   if(ticket!==attempt||life.signal.aborted)return;
   console.warn('Semester book unavailable',error);showFallback('error');
  }
 }
 life.on(retry,'click',()=>{state.book?.dispose?.();state.book=null;notice.hidden=true;art.dataset.renderer='pending';publish({});start();});
 if(window.requestIdleCallback){const id=requestIdleCallback(()=>start(),{timeout:900});life.own(()=>window.cancelIdleCallback?.(id));}
 else life.timeout(()=>start(),120);
 life.own(()=>{attempt++;const controller=state.book;state.book=null;controller?.dispose?.();detachBookState(book);book.dispose();});
}

/* Skip to coursework lands on the Assignments heading, the first thing in the coursework view; without a
   workspace (no JS module), the link's own #panel-assessments anchor still works natively. */
function skipTarget(){
 const view=document.getElementById('workspace-assignments');
 return view?.querySelector(':scope > .workspace-page-title')||document.getElementById('panel-assessments');
}
/* Below the header the dock comes down over the column: land the heading just under it. */
function skipOffset(){
 const bar=document.querySelector('.ns-dock-bar');
 return (bar?.offsetHeight||64)+16;
}
