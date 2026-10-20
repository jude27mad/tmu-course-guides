import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';

/* The book hero in course-header.mjs (semester-book spec §5.9, §6.2, §6.6, §6.10), in jsdom. The production
   header, state, rail and route scope run; only the GPU side is replaced: the stage probe passes and
   book-scene.mjs is a scripted engine that writes the slot dataset and fires book-ready like the real one.
   Run after npm ci --prefix tools/ui-build. */
const require=createRequire(new URL('../tools/ui-build/package.json',import.meta.url));
const {JSDOM,VirtualConsole}=require('jsdom'),{build}=require('esbuild');
const root=new URL('..',import.meta.url).pathname;
const turn=()=>new Promise(resolve=>setTimeout(resolve,0));
const flush=async()=>{for(let i=0;i<6;i++)await Promise.resolve();};

const sceneStub=`
 // A failed module fetch rejects the dynamic import, as Chromium does for a 503 or a dropped connection.
 if(window.engine.failImport)throw new TypeError('Failed to fetch dynamically imported module');
 export async function mountBook(slot,options){
  const engine=window.engine;engine.mounts++;engine.options=options;
  if(engine.failMount){engine.failMount--;throw new Error('fixture engine failure');}
  let settle;const ready=new Promise(resolve=>{settle=resolve;});
  // The engine's first frame: dataset first, then book-ready, then ready (book-scene.mjs onFirstFrame).
  engine.frame=()=>{Object.assign(slot.dataset,{renderer:'webgl2',rendererReason:'ok',sceneReady:'true'});slot.dispatchEvent(new CustomEvent('book-ready',{detail:{renderer:'webgl2'}}));settle('webgl2');};
  // The facade's context loss: poster, onFallback('lost'); ready has already settled.
  engine.lose=()=>{Object.assign(slot.dataset,{renderer:'poster',rendererReason:'lost',sceneReady:'true'});settle('poster');options.onFallback?.('lost');};
  return {ready,dispose(){engine.disposed++;},setFocus(){},setHandoff(){},close:()=>Promise.resolve(),requestFrame(){},stats:()=>({}),metrics:()=>null,pick:()=>null};
 }`;
let bundle;
async function script(){
 bundle??=(await build({stdin:{contents:`import * as header from './assets/course-header.mjs';
   import {currentBookHost,currentBookState} from './assets/book/book-state.mjs';
   window.t={header,currentBookHost,currentBookState};`,resolveDir:root},
  bundle:true,format:'iife',write:false,logLevel:'silent',
  plugins:[{name:'book-engine-fixture',setup(b){
   b.onResolve({filter:/app\/stage\.mjs(?:\?|$)/},()=>({path:'stage',namespace:'fixture'}));
   b.onResolve({filter:/book\/book-scene\.mjs(?:\?|$)/},()=>({path:'scene',namespace:'fixture'}));
   b.onLoad({filter:/^stage$/,namespace:'fixture'},()=>({contents:"export const probe=()=>({ok:true,reason:'ok'});",loader:'js'}));
   b.onLoad({filter:/^scene$/,namespace:'fixture'},()=>({contents:sceneStub,loader:'js'}));
   b.onLoad({filter:/\.mjs$/,namespace:'file'},async a=>({contents:(await readFile(a.path,'utf8')).replaceAll('import.meta.url',JSON.stringify('https://guide.test/assets/'+a.path.split('/assets/')[1])),loader:'js'}));
  }}]})).outputFiles[0].text;
 return bundle;
}

async function fixture({session={},engine={}}={}){
 const jsdomErrors=[],virtualConsole=new VirtualConsole();
 virtualConsole.on('jsdomError',error=>jsdomErrors.push(String(error?.message||error)));
 const dom=new JSDOM(`<!doctype html><body class="workspace" data-course="mth140"><a class="skip-link" href="#panel-assessments">Skip to coursework</a>
  <main data-route-region class="math-wrap"><header class="course-heading"><div class="hero-copy"><p class="eyebrow">MTH140 · Fall 2026</p><h1>Calculus I</h1></div></header>
  <div id="workspace-assignments"><h2 class="workspace-page-title">Assignments</h2><section class="next-layout"></section>
  <section class="math-panel" id="panel-assessments" role="tabpanel"><ol class="assessment-list"><li><button type="button">Lab Quiz 2</button></li></ol></section></div></main></body>`,
  {url:'https://guide.test/mth140/?motion=off&tier=high',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole}),w=dom.window;
 w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
 for(const name of ['ResizeObserver','IntersectionObserver'])w[name]=class{observe(){}unobserve(){}disconnect(){}};
 w.HTMLElement.prototype.scrollIntoView=()=>{};
 // A fixed clock (as fix-rail.test.mjs does): on Oct 14, 2:30 PM Toronto, Lab Quiz 2 is MTH140's next item,
 // which the Mark done / Undo test below relies on. The real clock would move past it.
 const now=Date.parse('2026-10-14T18:30:00Z');
 w.eval(`(()=>{const Real=Date,now=${now};class FixedDate extends Real{constructor(...a){super(...(a.length?a:[now]));}static now(){return now;}}window.Date=FixedDate;})();`);
 const scrolls=[];w.scrollTo=options=>scrolls.push(options);
 w.requestIdleCallback=fn=>setTimeout(fn,0);w.cancelIdleCallback=id=>clearTimeout(id);
 const warnings=[];w.console.warn=(...args)=>warnings.push(args.join(' '));
 for(const [key,value] of Object.entries(session))w.sessionStorage.setItem(key,value);
 w.engine={mounts:0,disposed:0,failImport:false,failMount:0,...engine};
 w.eval(await script());
 const controller=new w.AbortController();
 const ctx={root:w.document.querySelector('main'),route:'mth140',signal:controller.signal,direct:true};
 w.t.header.mount(ctx);
 const $=s=>w.document.querySelector(s);
 return {w,dom,ctx,$,scrolls,jsdomErrors,warnings,
  header:$('.course-heading'),art:$('.header-art'),notice:$('.ns-book-fallback'),retry:$('.ns-book-retry'),
  view(){const s=w.t.currentBookState(),snap=s.snapshot(),v=s.view(snap.index);return v.entries.map(e=>`${e.id}:${e.completed}:${e.chip}`).join(',');},
  close(){controller.abort();w.t.header.unmount();dom.window.close();}};
}
async function started(f){for(let i=0;i<20&&!f.w.engine.options;i++)await turn();assert.ok(f.w.engine.options,'the book engine was mounted');}

test('after a context loss, the restored book leaves the fallback and is republished as webgl2 (§5.9)',async()=>{
 const f=await fixture();
 try{
  const hosts=[];f.w.document.addEventListener('book-host',e=>hosts.push(e.detail?.renderer));
  await started(f);f.w.engine.frame();await flush();
  assert.equal(f.header.dataset.bookView,'webgl2');assert.equal(f.w.t.currentBookHost().renderer,'webgl2');
  assert.equal(hosts.filter(r=>r==='webgl2').length,1,'the first frame publishes the running book once');
  f.w.engine.lose();await flush();
  assert.equal(f.header.dataset.bookView,'poster');assert.equal(f.notice.hidden,false,'the fallback notice shows while the context is lost');
  assert.equal(f.w.t.currentBookHost().renderer,'poster');
  // The facade's one remount after restore: its first frame fires book-ready on the slot; ready settled long ago.
  Object.assign(f.art.dataset,{renderer:'webgl2',rendererReason:'ok'});f.art.dispatchEvent(new f.w.CustomEvent('book-ready',{detail:{renderer:'webgl2'}}));
  assert.equal(f.header.dataset.bookView,'webgl2','the hero view returns to the book');
  assert.equal(f.notice.hidden,true,'the "Book view unavailable" notice leaves the live book');
  assert.equal(f.w.t.currentBookHost().renderer,'webgl2','scroll.mjs and the timeline see the running book again (pin, swipe, hidden fallback timeline)');
  assert.ok(f.w.t.currentBookHost().controller,'the republished host keeps the controller');
 }finally{f.close();}
});

test('Mark done and Undo reach the book from the committed record, though guide-completion fires before the save (§6.10)',async()=>{
 const f=await fixture();
 try{
  await started(f);f.w.engine.frame();await flush();
  const before=f.view();assert.match(before,/^quiz-2:false:/);
  const key='mth140-progress-v1',record=completed=>JSON.stringify({checks:{},completed,notes:{},targets:{},topics:{}});
  // Real input: guide-motion's capture-phase microtask announces the completion, then math-guide's bubble
  // handler saves. Model that order: the event, a microtask drain, then the save in the same task.
  const markDone=async completed=>{f.w.document.dispatchEvent(new f.w.Event('guide-completion'));await flush();f.w.localStorage.setItem(key,record(completed));await turn();await flush();};
  await markDone({'quiz-2':true});
  assert.equal(f.view(),'quiz-2:true:DONE','Mark done flattens and stamps Lab Quiz 2 in the same interaction');
  await markDone({});
  assert.equal(f.view(),before,'Undo restores the raised pop-up instead of stamping it');
 }finally{f.close();}
});

test('Try again reloads after a failed module fetch, and an in-place retry keeps focus off <body>',async()=>{
 const failed=await fixture({engine:{failImport:true}});
 try{
  for(let i=0;i<20&&failed.art.dataset.renderer!=='poster';i++)await turn();
  assert.equal(failed.art.dataset.rendererReason,'error');assert.equal(failed.retry.hidden,false);
  failed.retry.click();
  assert.ok(failed.jsdomErrors.some(message=>/navigation/i.test(message)),'the retry reloads the document: the failed module map entry cannot be fetched again in place');
  assert.equal(failed.w.engine.mounts,0);
 }finally{failed.close();}
 const f=await fixture({engine:{failMount:1}});
 try{
  for(let i=0;i<20&&f.art.dataset.renderer!=='poster';i++)await turn();
  assert.equal(f.art.dataset.rendererReason,'error');assert.equal(f.retry.hidden,false);
  f.retry.focus();assert.equal(f.w.document.activeElement,f.retry);
  f.retry.click();
  const tick=f.$('.ns-tick[aria-checked="true"]');
  assert.ok(tick);assert.equal(f.w.document.activeElement,tick,'focus moves to the current week control before the notice hides');
  for(let i=0;i<20&&f.w.engine.mounts<2;i++)await turn();
  f.w.engine.frame();await flush();
  assert.equal(f.header.dataset.bookView,'webgl2');assert.equal(f.jsdomErrors.filter(m=>/navigation/i.test(m)).length,0,'an engine failure retries without a reload');
 }finally{f.close();}
});

test('Skip to coursework focuses #panel-assessments and keeps it on screen (§6.6, §10.2)',async()=>{
 const f=await fixture();
 try{
  const skip=f.$('body > .skip-link'),panel=f.$('#panel-assessments');
  assert.equal(f.w.document.body.firstElementChild,skip);
  skip.dispatchEvent(new f.w.MouseEvent('click',{bubbles:true,cancelable:true,button:0}));
  assert.equal(f.w.document.activeElement,panel,'focus lands in the assessments panel');
  assert.equal(panel.getAttribute('tabindex'),'-1');
  assert.equal(f.scrolls.at(-1).top,-(64+16),'the jump shows the coursework view from its heading, under the dock');
  // When that would leave the panel below the fold, the jump lands the panel itself.
  panel.getBoundingClientRect=()=>({top:2000,bottom:2600,left:0,right:800,width:800,height:600,x:0,y:2000});
  f.w.document.body.focus();
  skip.dispatchEvent(new f.w.MouseEvent('click',{bubbles:true,cancelable:true,button:0}));
  assert.equal(f.w.document.activeElement,panel);
  assert.equal(f.scrolls.at(-1).top,2000-(64+16));
 }finally{f.close();}
});

test("the book's drag hint uses its own session key, tmu-book-hint-v1 (§6.2)",async()=>{
 // Rotating the CEN100/MTH141 art sets hero.mjs's flag; the book's turn hint must still show.
 const f=await fixture({session:{'night-dragged':'1'}});
 try{
  assert.equal(f.header.classList.contains('ns-explored'),false,'another course\'s drag hint does not hide the book hint');
  const state=f.w.t.currentBookState();
  state.openWeek(state.snapshot().index+1,{source:'drag'});
  assert.equal(f.header.classList.contains('ns-explored'),true,'a gesture page turn hides the hint');
  assert.equal(f.w.sessionStorage.getItem('tmu-book-hint-v1'),'1');
 }finally{f.close();}
 const g=await fixture({session:{'tmu-book-hint-v1':'1'}});
 try{
  assert.equal(g.header.classList.contains('ns-explored'),true,'the hint stays cleared for the session');
  const state=g.w.t.currentBookState();state.openWeek(state.snapshot().index+1,{source:'drag'});
  assert.equal(g.w.sessionStorage.getItem('night-dragged'),null,'a book turn leaves the art hint of CEN100/MTH141 alone');
 }finally{g.close();}
});
