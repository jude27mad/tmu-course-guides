import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import {readFileSync,existsSync} from 'node:fs';

/* The semester book's rail and fallback week view (timeline.mjs, layout.css; semester-book spec §6.2, §6.3, §6.8).
   jsdom runs the production rail against the real resolver, weeks and BookState at a fixed Toronto date; only
   deadline.mjs is a stub, so a test chooses the dock's target. The cascade checks load the real stylesheets.
   The last test measures the rail in Chromium when Playwright is installed (PLAYWRIGHT_PATH), and skips otherwise.
   Run after npm ci --prefix tools/ui-build. */
const require=createRequire(new URL('../tools/ui-build/package.json',import.meta.url));
const {JSDOM}=require('jsdom'),{build}=require('esbuild');
const root=new URL('..',import.meta.url).pathname;
// Match the production URL so the fixture observes the rail's state module.
const BOOK_STATE='./assets/book/book-state.mjs'+((await readFile(new URL('../assets/night/timeline.mjs',import.meta.url),'utf8')).match(/book\/book-state\.mjs(\?v=[^'"]+)/)?.[1]||'');
const css=file=>readFileSync(new URL(`../assets/${file}`,import.meta.url),'utf8');

const deadlineStub=`const listeners=new Set();
 export const currentTarget=()=>window.__target??null;
 export function onTarget(fn){listeners.add(fn);if(window.__target)fn(window.__target);return()=>listeners.delete(fn);}
 window.__setTarget=target=>{window.__target=target;for(const fn of [...listeners])fn(target);};`;
let bundle;
async function script(){
 bundle??=(await build({stdin:{contents:`import {targetWeek,mountRail,mount,unmount} from './assets/night/timeline.mjs';
   import {createBookState,attachBookState,detachBookState,describeSpread} from '${BOOK_STATE}';
   import {recordsForCourse,semesterWeeks,currentWeekIndex} from './assets/book/weeks.mjs';
   import {resolveTarget} from './assets/night/targets.mjs';
   import {COURSES} from './assets/course-data.mjs';
   window.t={targetWeek,mountRail,mount,unmount,createBookState,attachBookState,detachBookState,describeSpread,recordsForCourse,semesterWeeks,currentWeekIndex,resolveTarget,COURSES};`,resolveDir:root},
  bundle:true,format:'iife',write:false,logLevel:'silent',
  plugins:[{name:'deadline-fixture',setup(b){
   b.onResolve({filter:/night\/deadline\.mjs(?:\?|$)|^\.\/deadline\.mjs(?:\?|$)/},()=>({path:'deadline',namespace:'fixture'}));
   b.onLoad({filter:/^deadline$/,namespace:'fixture'},()=>({contents:deadlineStub,loader:'js'}));
   b.onLoad({filter:/\.mjs$/,namespace:'file'},async a=>({contents:(await readFile(a.path,'utf8')).replaceAll('import.meta.url',JSON.stringify('https://guide.test/assets/'+a.path.split('/assets/')[1])),loader:'js'}));
  }}]})).outputFiles[0].text;
 return bundle;
}

/* A course page at a fixed instant: Date (and so every Toronto date) reads `iso`. ResizeObservers are recorded so
   a test can deliver their entries. */
async function fixture(iso){
 const dom=new JSDOM(`<!doctype html><body class="workspace" data-course="mth140"><main class="math-wrap"><header class="course-heading header-upgraded"></header>
  <div id="workspace-assignments"><h2 class="workspace-page-title">Assignments</h2><section class="next-layout"></section></div></main></body>`,
  {url:'https://guide.test/mth140/?motion=off&tier=high',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
 const now=Date.parse(iso);
 w.eval(`(()=>{const Real=Date,now=${now};class FixedDate extends Real{constructor(...a){super(...(a.length?a:[now]));}static now(){return now;}}window.Date=FixedDate;})();
  window.__observers=[];window.ResizeObserver=class{constructor(fn){this.fn=fn;this.targets=[];window.__observers.push(this);}observe(el){this.targets.push(el);}unobserve(){}disconnect(){this.targets=[];}};`);
 w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
 w.eval(await script());
 const {t}=w,data=t.COURSES.mth140;
 const target=({section=0,at=now}={})=>t.resolveTarget({course:'mth140',data,section,completed:{},now:at});
 function book(section=0){
  const weeks=t.semesterWeeks({records:t.recordsForCourse('mth140',{courseData:t.COURSES,section,completed:{}})});
  const describe=spread=>t.describeSpread(spread,{course:'mth140',data,weeks,section,completed:{},now,targetId:w.__target?.id??null});
  return t.createBookState({course:'mth140',weeks,today:t.currentWeekIndex(weeks,new w.Date(now)),describe});
 }
 const header=w.document.querySelector('.course-heading');
 return {w,t,now,target,book,header,close(){t.unmount();dom.window.close();}};
}

test('the Next assessment button opens the week that holds an exact-time target, never the date-pending spread (§6.3)',async()=>{
 const f=await fixture('2026-10-13T19:00:00Z');
 try{
  const weeks=f.book().weeks,pending=weeks.findIndex(spread=>spread.pending||!spread.start);
  const Oct20=Date.parse('2026-10-20T19:00:00Z'),Dec25=Date.parse('2026-12-25T17:00:00Z');
  // Section 1: Lab Quiz 2 on Thu Oct 15 (week 6); section 2: the Monday make-up on Oct 19 (week 7).
  assert.equal(f.target({section:1}).precision,'exact');
  assert.equal(f.t.targetWeek(f.target({section:1}),weeks),5,'section 1: Lab Quiz 2 is in week 6, not the Exams spread');
  assert.equal(f.t.targetWeek(f.target({section:2}),weeks),6,'section 2: the Monday make-up is in week 7');
  assert.equal(f.t.targetWeek(f.target({at:Oct20}),weeks),6,'the midterm (exact, Fri Oct 23) is in week 7');
  assert.equal(f.t.targetWeek(f.target(),weeks),5,'no section: the quiz week itself');
  assert.equal(f.t.targetWeek(f.target({at:Dec25}),weeks),pending,'only the undated final goes to the pending spread');
  assert.equal(f.t.targetWeek({precision:'empty'},weeks),-1);
  // A "by end of day" due counts down to the next Toronto midnight but belongs to its own day (Sun Oct 18).
  const midnight=Date.parse('2026-10-19T04:00:00Z');
  assert.equal(f.t.targetWeek({precision:'exact',endOfDay:true,at:midnight},weeks),5);
  assert.equal(f.t.targetWeek({precision:'exact',at:midnight},weeks),6);
 }finally{f.close();}
});

test('the rail button names and opens the target week for a chosen section',async()=>{
 for(const [section,week,label] of [[1,5,'Lab Quiz 2 · Week 6'],[2,6,'Lab Quiz 2 · Week 7']]){
  const f=await fixture('2026-10-13T19:00:00Z');
  try{
   f.w.__target=f.target({section});
   const state=f.book(section),rail=f.t.mountRail(f.header,state),next=rail.element.querySelector('.ns-week-next');
   state.openWeek(0,{source:'control'});
   assert.equal(next.hidden,false);
   assert.equal(next.dataset.week,String(week));assert.equal(next.dataset.mode,'week');
   assert.equal(next.querySelector('.ns-week-next-t').textContent,label,`section ${section}`);
   next.click();
   assert.equal(state.snapshot().index,week,'the click turns to the week that lists the quiz');
   assert.ok(rail.element.querySelector('.ns-spread-item[data-id="quiz-2"]'),'and its caption shows Lab Quiz 2');
   assert.equal(next.dataset.mode,'open');assert.equal(next.querySelector('.ns-week-next-k').textContent,'Open');
   rail.dispose();
  }finally{f.close();}
 }
});

test('outside the term no tick claims today and the note never names a semester week (§6.3)',async()=>{
 for(const [iso,today,note] of [['2026-09-01T16:00:00Z',null,''],['2026-10-13T19:00:00Z',5,'Today, Tuesday, October 13. Semester week 6'],['2026-12-25T17:00:00Z',null,'']]){
  const f=await fixture(iso);
  try{
   const rail=f.t.mountRail(f.header,f.book()),el=rail.element;
   const marked=[...el.querySelectorAll('.ns-tick[data-today]')].map(tick=>Number(tick.dataset.index));
   assert.deepEqual(marked,today===null?[]:[today],iso);
   assert.deepEqual([...el.querySelectorAll('.ns-tick[aria-current]')].map(tick=>Number(tick.dataset.index)),marked);
   assert.deepEqual([...el.querySelectorAll('.ns-tick[aria-describedby]')].map(tick=>Number(tick.dataset.index)),marked);
   assert.equal(el.querySelector('.ns-weeks > .ns-sr').textContent,note,iso);
   if(iso.startsWith('2026-09'))assert.equal(el.querySelector('.ns-week-ticks').style.getPropertyValue('--elapsed'),'0%','nothing has elapsed before the term');
   rail.dispose();
  }finally{f.close();}
 }
});

test('the fallback week view counts weeks only inside the term (§6.8)',async()=>{
 for(const [iso,stats,current] of [['2026-09-01T16:00:00Z','Before term',[]],['2026-10-13T19:00:00Z','6 of 16 weeks',['5']],['2026-12-25T17:00:00Z','After term',[]]]){
  const f=await fixture(iso);
  const state=f.book();
  try{
   f.t.attachBookState(state);f.t.mount({});
   const view=f.w.document.querySelector('.ns-weekview');
   assert.ok(view,'a book course mounts the week view');
   assert.equal(view.querySelector('.ns-tl-stats span').textContent,stats,iso);
   assert.deepEqual([...view.querySelectorAll('.ns-wv-week[aria-current]')].map(week=>week.dataset.index),current);
   assert.deepEqual([...view.querySelectorAll('.ns-wv-week.is-today')].map(week=>week.dataset.index),current);
  }finally{f.t.detachBookState(state);f.close();}
 }
});

test('a pinned rail that changes height asks scroll.mjs to measure again (night-refresh)',async()=>{
 const f=await fixture('2026-10-13T19:00:00Z');
 try{
  const rail=f.t.mountRail(f.header,f.book()),observer=f.w.__observers.find(o=>o.targets.includes(rail.element));
  assert.ok(observer,'the rail observes its own size');
  let refreshes=0;f.w.document.addEventListener('night-refresh',()=>refreshes++);
  const deliver=height=>observer.fn([{target:rail.element,contentRect:{height}}]);
  deliver(142);deliver(196);
  assert.equal(refreshes,0,'unpinned, the main column observer already refreshes');
  const spacer=f.w.document.createElement('div');spacer.className='pin-spacer';f.header.before(spacer);spacer.append(f.header);
  deliver(196);assert.equal(refreshes,0,'same height: nothing to measure');
  deliver(162);assert.equal(refreshes,1,'pinned, a new height re-measures the header');
  rail.dispose();
 }finally{f.close();}
});

/* The real cascade with :focus-visible read as a class (jsdom has no keyboard modality): the rail's rings must
   outrank the shared `.header-upgraded button` and `.workspace button` rings, which sit 4 px outside. */
test('rail and week view focus rings keep their offsets against the shared button rings',()=>{
 const dom=new JSDOM(`<!doctype html><html data-book><body class="workspace editorial" data-course="mth140"><main class="math-wrap"><header class="course-heading header-upgraded">
  <section class="ns-spread"><div class="ns-spread-caption"><div class="ns-spread-body"><ul class="ns-spread-items"><li class="ns-spread-item"><button class="ns-spread-open">Lab Quiz 2</button></li></ul></div></div>
  <div class="ns-spread-jump"><button class="ns-week-today">Go to today</button></div>
  <nav class="ns-weeks"><button class="ns-week-step">Previous week</button><div class="ns-week-scroll"><div class="ns-week-ticks"><button class="ns-tick" role="radio">1</button></div></div></nav></section></header>
  <section class="ns-timeline ns-weekview"><div class="ns-tl-scroll"><div class="ns-tl-track"><button class="ns-wv-week">1</button></div></div></section></main></body></html>`);
 try{
  const w=dom.window;
  for(const file of ['course-header.css','guide-motion.css','night/layout.css']){const style=w.document.createElement('style');style.textContent=css(file).replaceAll(':focus-visible','.fv');w.document.head.append(style);}
  for(const [selector,offset] of [['.ns-tick','-2px'],['.ns-wv-week','-2px'],['.ns-spread-open','2px'],['.ns-week-step','2px'],['.ns-week-today','2px']]){
   const el=w.document.querySelector(selector);el.classList.add('fv');
   const style=w.getComputedStyle(el);
   assert.equal(style.outlineOffset,offset,`${selector}: an inset ring cannot be clipped by its scroller`);
   assert.match(style.outline,/var\(--hub-focus\)/,`${selector}: the rail's focus colour`);
  }
 }finally{dom.window.close();}
});

/* WCAG 1.4.3 for the 9-11 px accent and muted type on the light desk, at the token level: the darker desk stop
   (--ns-desk-2), and for the Next chip its 8% accent tint. Rendered values sit higher (lighter desk under the copy). */
test('light stage labels keep 4.5:1 on the desk for every course accent',()=>{
 const layout=css('night/layout.css'),editorial=css('editorial.css'),math=css('math.css');
 const light=layout.match(/:root\{--ns-desk:[^}]*\}/)[0];
 const token=(text,name)=>text.match(new RegExp(`${name}:(#[0-9a-f]{6})`,'i'))[1];
 const hex=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
 const mix=(a,b,p)=>a.map((v,i)=>v*p+b[i]*(1-p));
 const lum=rgb=>rgb.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
 const ratio=(a,b)=>{const [x,y]=[lum(a),lum(b)].sort((p,q)=>q-p);return (x+.05)/(y+.05);};
 const desk=hex(token(light,'--ns-desk-2')),ink=hex(token(light,'--ns-stage-ink')),muted=hex(token(light,'--ns-stage-muted'));
 assert.ok(ratio(muted,desk)>=4.5,`--ns-stage-muted on the desk: ${ratio(muted,desk).toFixed(2)}`);
 const share=Number(layout.match(/body\.workspace\{--ns-stage-strong:color-mix\(in srgb,var\(--strong\) (\d+)%,var\(--ns-stage-ink\)\)\}/)[1])/100;
 const accents=[...editorial.matchAll(/\.editorial\[data-course=(\w+)\]\{[^}]*--strong:(#[0-9a-f]{6})/gi),...math.matchAll(/^body\[data-course="(\w+)"\]\{[^}]*--strong:(#[0-9a-f]{6})/gim)];
 assert.ok(accents.length>=4,'the light accents of every course');
 for(const [,course,strong] of accents){
  const label=mix(hex(strong),ink,share);
  assert.ok(ratio(label,desk)>=4.5,`${course} ${strong}: ${ratio(label,desk).toFixed(2)}`);
  assert.ok(ratio(label,mix(desk,hex(strong),.92))>=4.5,`${course} ${strong} on the Next chip tint`);
 }
 // The labels use the stage token; the lamp-lit desk keeps --strong itself.
 assert.match(layout,/html\[data-book\] \.ns-hud \.ns-hud-k,html\[data-book\] \.ns-hud \[data-ns-chip\]\{color:var\(--ns-stage-strong\)\}/);
 assert.match(layout,/:root\[data-theme=dark\] body\.workspace\{--ns-stage-strong:var\(--strong\)\}/);
});

/* Layout needs a browser. Chromium on the low tier (the poster, no WebGL) at a fixed date with no section, so
   every quiz week shows its section button: the widest captions there are. */
let playwright=null;
try{playwright=require(process.env.PLAYWRIGHT_PATH||'/opt/node-tools/node_modules/playwright');}catch{try{playwright=require('playwright');}catch{}}
const chromium=[process.env.QA_CHROMIUM_PATH,'/opt/pw-browsers/chromium'].find(path=>path&&existsSync(path));
test('the rail caption is never covered by its buttons, 390-1920 px and at 200% zoom, in both themes (§6.3)',{skip:!playwright&&'Playwright is not installed (set PLAYWRIGHT_PATH)',timeout:180000},async()=>{
 const {createPreview}=await import('../tools/preview-server.mjs');
 const server=createPreview({root});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await playwright.chromium.launch({headless:true,...(chromium?{executablePath:chromium}:{}),args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:800}});
  await page.addInitScript(at=>{const Real=Date,offset=at-Real.now();class Shifted extends Real{constructor(...a){super(...(a.length?a:[Real.now()+offset]));}static now(){return Real.now()+offset;}}window.Date=Shifted;},Date.parse('2026-10-13T16:00:00Z'));
  await page.goto(`http://127.0.0.1:${server.address().port}/mth140/?tier=low&motion=off`);
  await page.waitForFunction(()=>document.querySelectorAll('.ns-spread .ns-tick').length>10,null,{timeout:60000});
  await page.evaluate(()=>document.fonts.ready);
  const problems=[];
  for(const scheme of ['dark','light'])for(const [width,height] of [[390,844],[960,540],[1001,800],[1024,768],[1180,800],[1280,800],[1366,768],[1440,900],[1920,1080]]){
   await page.emulateMedia({colorScheme:scheme});await page.setViewportSize({width,height});
   const found=await page.evaluate(()=>{
    const out=[],spread=document.querySelector('.ns-spread'),ticks=[...spread.querySelectorAll('.ns-tick')];
    const hidden=el=>{for(let e=el;e&&e!==spread;e=e.parentElement){const cs=getComputedStyle(e);if(e.classList.contains('ns-sr')||cs.display==='none'||cs.visibility==='hidden')return true;}return false;};
    const overlap=(a,b)=>Math.min(a.right,b.right)-Math.max(a.left,b.left)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1;
    for(const tick of ticks){
     tick.click();
     const caption=spread.querySelector('.ns-spread-caption'),texts=[],walker=document.createTreeWalker(caption,NodeFilter.SHOW_TEXT);
     for(let node;node=walker.nextNode();){if(!node.textContent.trim()||hidden(node.parentElement))continue;const range=document.createRange();range.selectNodeContents(node);for(const box of range.getClientRects())if(box.width>1)texts.push({node,box,text:node.textContent.trim().slice(0,24)});}
     const controls=[...spread.querySelectorAll('.ns-spread-cta,.ns-spread-jump button:not([hidden]),.ns-item-status,.ns-week-step')].filter(el=>el.getClientRects().length);
     const edge=spread.getBoundingClientRect().right-parseFloat(getComputedStyle(spread).paddingRight)+1;
     for(const a of texts){
      for(const control of controls)if(!control.contains(a.node)&&overlap(a.box,control.getBoundingClientRect()))out.push(`week ${+tick.dataset.index+1}: "${a.text}" under "${control.textContent.trim().slice(0,24)}"`);
      for(const b of texts)if(b!==a&&b.node!==a.node&&a.text<b.text&&overlap(a.box,b.box))out.push(`week ${+tick.dataset.index+1}: "${a.text}" over "${b.text}"`);
      if(a.box.right>edge)out.push(`week ${+tick.dataset.index+1}: "${a.text}" runs past the rail`);
     }
    }
    // ScrollTrigger measures the pin with its margins zeroed: the header (and so the rail) must keep its box then.
    const header=document.querySelector('.header-upgraded'),box=header.getBoundingClientRect();
    header.style.margin='0';const bare=header.getBoundingClientRect();header.style.margin='';
    if(Math.abs(bare.width-box.width)>1||Math.abs(bare.height-box.height)>1)out.push(`header ${Math.round(box.width)}x${Math.round(box.height)} measures ${Math.round(bare.width)}x${Math.round(bare.height)} without margins`);
    return [...new Set(out)];
   });
   problems.push(...found.map(problem=>`${width}x${height} ${scheme}: ${problem}`));
  }
  assert.deepEqual(problems,[]);
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
});
