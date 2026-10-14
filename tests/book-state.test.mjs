import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {COURSES} from '../assets/course-data.mjs';
import {semesterWeeks,recordsForCourse} from '../assets/book/weeks.mjs';

/* BookState (docs/book/semester-book-spec.md §3.1, §3.5, §6.9, §10.2). Plain Node: there is no document, and
   storage is trapped before the module loads, so any read or write fails the first test. */
const touched=[];
for(const name of ['localStorage','sessionStorage','indexedDB'])
  Object.defineProperty(globalThis,name,{configurable:true,get(){touched.push(name);throw new Error(`book-state touched ${name}`);}});
const book=await import('../assets/book/book-state.mjs');
const {createBookState,attachBookState,detachBookState,currentBookState}=book;
const stub=await import('./fixtures/book-controller-stub.mjs');

const WEEKS=semesterWeeks({records:recordsForCourse('mth140',{courseData:COURSES})});
const TODAY=5,LAST=WEEKS.length-1;
const flush=()=>new Promise(resolve=>setImmediate(resolve));

function make({policy='full',today=TODAY,weeks=WEEKS}={}){
  const mode={value:policy};
  const state=createBookState({course:'mth140',weeks,today,policy:()=>mode.value});
  const discrete=[],continuous=[];
  state.subscribe((snap,change)=>discrete.push(change.kind));
  state.subscribe((snap,change)=>continuous.push(change.kind),{continuous:true});
  return {state,mode,discrete,continuous,clear(){discrete.length=0;continuous.length=0;}};
}
/* An animator the test lands by hand. */
function manual(state){
  const runs=[];let cancels=0;
  const animator={
    animate(from,to,options){let resolve;const promise=new Promise(r=>{resolve=r;});runs.push({from,to,...options,resolve});return promise;},
    cancel(){cancels++;}
  };
  state.setAnimator(animator);
  return {runs,get cancels(){return cancels;},get last(){return runs.at(-1);},
    async land(run=runs.at(-1)){state.scrub(run.to,'animation');run.resolve();await flush();}};
}

test('book-state is pure: no document, storage, timers or Three', async()=>{
  assert.equal(typeof globalThis.document,'undefined');
  const {state}=make();
  const anim=manual(state);
  state.openWeek(9);await anim.land();
  state.grab('drag');state.scrub(8.6,'drag');state.release('drag',{velocity:-1});await anim.land();
  state.setWeeks(WEEKS,{reason:'minute'});
  attachBookState(state);detachBookState(state);
  assert.deepEqual(touched,[],'no storage access');
  const source=readFileSync(new URL('../assets/book/book-state.mjs',import.meta.url),'utf8').replace(/\/\*[\s\S]*?\*\//g,'');
  for(const banned of [/localStorage|sessionStorage|indexedDB/,/\bset(?:Timeout|Interval)\b|requestAnimationFrame|requestIdleCallback/,/three|vendor\//i,/\bwindow\./,/(?<!globalThis\.)\bdocument\./])
    assert.doesNotMatch(source,banned);
  const imports=[...source.matchAll(/from\s*'([^']+)'/g)].map(m=>m[1].split('?')[0]).sort();
  assert.deepEqual(imports,['../night/targets.mjs','../schedule.mjs','./weeks.mjs']);
});

test('initial snapshot: today selected, settled, frozen and cached until something changes',()=>{
  const {state}=make();
  const snap=state.snapshot();
  assert.deepEqual({...snap},{course:'mth140',count:WEEKS.length,today:5,index:5,turn:5,settled:true,source:'init',lock:null,mode:'full',version:0});
  assert.ok(Object.isFrozen(snap));
  assert.equal(state.snapshot(),snap);
  assert.equal(state.weeks,WEEKS);assert.equal(state.today,5);assert.equal(state.course,'mth140');
  assert.equal(createBookState({weeks:WEEKS,today:99}).snapshot().index,LAST,'today clamps');
  assert.equal(createBookState({weeks:WEEKS,today:5,policy:()=>{throw new Error('x');}}).snapshot().mode,'cut','a throwing policy is cut');
  assert.equal(createBookState({weeks:WEEKS,today:5}).snapshot().mode,'cut','a missing policy is cut');
});

test('commands clamp their target to whole spreads',async()=>{
  const {state}=make({policy:'cut'});
  for(const [target,expected] of [[-3,0],[99,LAST],[2.6,3],[Number.NaN,3],['7',3],[null,3],[Infinity,3]]){
    const result=await state.openWeek(target);
    assert.equal(state.snapshot().index,expected,`openWeek(${String(target)})`);
    assert.deepEqual(result,{index:expected,cancelled:false});
  }
  await state.openWeek(5);
  await state.step(4);assert.equal(state.snapshot().index,9);
  await state.step(-4);await state.step(-4);await state.step(-4);assert.equal(state.snapshot().index,0);
  await state.step(1);assert.equal(state.snapshot().index,1);
  assert.equal((await state.step(Number.NaN)).cancelled,true);
  for(const snap of [state.snapshot()]){assert.equal(snap.turn,snap.index);assert.ok(Number.isInteger(snap.index));}
});

test('cut policy, animate:false and a missing animator all swap synchronously',async()=>{
  for(const setup of [
    ({state,mode})=>{manual(state);mode.value='cut';return state.openWeek(8,{source:'key'});},
    ({state})=>{manual(state);return state.openWeek(8,{source:'key',animate:false});},
    ({state})=>state.openWeek(8,{source:'key'})
  ]){
    const ctx=make();
    const runs=[];ctx.state.setAnimator({animate(...args){runs.push(args);return Promise.resolve();},cancel(){}});
    ctx.state.setAnimator(null);
    const promise=setup(ctx);
    const snap=ctx.state.snapshot();
    assert.equal(snap.index,8);assert.equal(snap.turn,8);assert.equal(snap.settled,true);assert.equal(snap.mode,'cut');assert.equal(snap.source,'key');
    assert.deepEqual(ctx.discrete,['select','settle']);
    assert.deepEqual(ctx.continuous,['select','turn','settle']);
    assert.equal(runs.length,0);
    assert.deepEqual(await promise,{index:8,cancelled:false});
  }
});

test('fade policy crossfades through the animator and settles when it resolves',async()=>{
  const {state,discrete}=make({policy:'fade'});
  const anim=manual(state);
  const promise=state.openWeek(7,{source:'today'});
  assert.equal(state.snapshot().index,7,'index is set immediately');
  assert.equal(state.snapshot().settled,false);
  assert.equal(anim.last.mode,'fade');assert.equal(anim.last.from,5);assert.equal(anim.last.to,7);assert.equal(anim.last.distance,2);assert.equal(anim.last.source,'today');
  assert.deepEqual(discrete,['select']);
  anim.last.resolve();
  assert.deepEqual(await promise,{index:7,cancelled:false});
  assert.deepEqual(discrete,['select','settle']);
  assert.equal(state.snapshot().turn,7);assert.equal(state.snapshot().settled,true);assert.equal(state.snapshot().mode,'fade');
});

test('full policy turns through the animator; animation frames reach continuous subscribers only',async()=>{
  const {state,discrete,continuous}=make();
  const anim=manual(state);
  const promise=state.openWeek(6,{source:'control'});
  assert.deepEqual({from:anim.last.from,to:anim.last.to,distance:anim.last.distance,mode:anim.last.mode},{from:5,to:6,distance:1,mode:'full'});
  assert.equal(anim.last.ease,undefined,'commands leave the choreography to the engine');
  assert.equal(state.scrub(5.25,'animation'),true);assert.equal(state.scrub(5.75,'animation'),true);
  assert.equal(state.snapshot().turn,5.75);assert.equal(state.snapshot().index,6);
  await anim.land();
  assert.deepEqual(await promise,{index:6,cancelled:false});
  assert.deepEqual(discrete,['select','settle']);
  assert.deepEqual(continuous,['select','turn','turn','turn','settle']);
  assert.equal(state.scrub(6.5,'animation'),false,'no animation, no animation frames');
});

test('a new command retargets: the old promise resolves cancelled and key repeats collapse',async()=>{
  const {state,discrete}=make();
  const anim=manual(state);
  const first=state.openWeek(6,{source:'key'});
  state.scrub(5.5,'animation');
  const second=state.openWeek(9,{source:'palette'});
  assert.deepEqual(await first,{index:6,cancelled:true});
  assert.equal(anim.cancels,1);
  assert.equal(anim.last.from,5.5,'the retarget starts where the paper is');assert.equal(anim.last.to,9);assert.equal(anim.last.distance,3.5);
  anim.runs[0].resolve();await flush();
  assert.equal(state.snapshot().settled,false,'a superseded run landing late is ignored');
  await anim.land();
  assert.deepEqual(await second,{index:9,cancelled:false});
  assert.equal(state.snapshot().index,9);assert.equal(state.snapshot().source,'palette');

  discrete.length=0;
  const presses=[state.step(1,{source:'key'}),state.step(1,{source:'key'}),state.step(1,{source:'key'})];
  assert.equal(state.snapshot().index,12,'each press moves the target immediately');
  await anim.land();
  const results=await Promise.all(presses);
  assert.deepEqual(results.map(r=>r.cancelled),[true,true,false]);
  assert.deepEqual(discrete,['select','select','select','settle'],'one settle for the collapsed run');
});

test('asking again for the page already turning there joins that turn',async()=>{
  const {state,discrete}=make();
  const anim=manual(state);
  const first=state.openWeek(8,{source:'key'});
  state.scrub(6.5,'animation');
  const again=state.openWeek(8,{source:'palette'});
  assert.equal(again,first,'the same promise');
  assert.equal(anim.runs.length,1);assert.equal(anim.cancels,0);
  assert.equal(state.snapshot().source,'palette');assert.equal(state.consumeAnchorDirty(),true);
  await anim.land();
  assert.deepEqual(await first,{index:8,cancelled:false});
  assert.deepEqual(discrete,['select','settle']);
  // A different motion mode or animate:false is a new command.
  const cut=state.openWeek(9);state.openWeek(9,{animate:false});
  assert.deepEqual(await cut,{index:9,cancelled:true});
  assert.equal(state.snapshot().turn,9);
});

test('lock precedence: a drag or swipe owns the paper over scroll; grab needs full motion',()=>{
  const {state,mode}=make();
  assert.equal(state.scrub(5.3,'drag'),false,'no grab, no drag scrub');
  assert.equal(state.grab('drag'),true);
  assert.equal(state.snapshot().lock,'drag');assert.equal(state.snapshot().settled,false);
  assert.equal(state.grab('drag'),true,'the holder may grab again');
  assert.equal(state.grab('swipe'),false);
  assert.equal(state.scrub(5.3,'scroll'),false,'scroll yields to the drag');
  assert.equal(state.consumeAnchorDirty(),true,'a rejected scroll asks to rebase');
  assert.equal(state.scrub(5.3,'swipe'),false);
  assert.equal(state.scrub(5.3,'drag'),true);assert.equal(state.snapshot().turn,5.3);
  assert.equal(state.scrub(5.3,'mouse'),false,'unknown sources are ignored');
  assert.equal(state.grab('scroll'),false,'only drag and swipe grab');
  const other=make();
  for(const value of ['fade','cut']){other.mode.value=value;assert.equal(other.state.grab('swipe'),false,value);}
  mode.value='cut';
  assert.equal(state.scrub(5.4,'drag'),true,'an existing grab keeps its lock until release');
});

test('a grab catches a turning page; a command cancels a gesture',async()=>{
  const {state}=make();
  const anim=manual(state);
  const command=state.openWeek(7);
  state.scrub(5.6,'animation');
  assert.equal(state.grab('drag'),true);
  assert.deepEqual(await command,{index:7,cancelled:true});
  assert.equal(anim.cancels,1);
  assert.equal(state.snapshot().turn,5.6);
  state.scrub(5.9,'drag');
  const command2=state.openWeek(3,{animate:false});
  assert.equal(state.snapshot().lock,null);assert.equal(state.snapshot().turn,3);
  assert.equal(state.scrub(4,'drag'),false,'the cancelled gesture can no longer scrub');
  assert.deepEqual(await state.release('drag',{velocity:2}),{index:3,cancelled:true},'its release is a no-op');
  assert.deepEqual(await command2,{index:3,cancelled:false});
});

test('index timing: commands at once, scroll at a dwell, gestures at landing',async()=>{
  const {state,discrete}=make();
  const anim=manual(state);
  // Scroll: the caption keeps the last dwell week until the paper rests within 0.02 of a spread.
  assert.equal(state.scrub(5.3,'scroll'),true);
  assert.equal(state.snapshot().index,5);assert.equal(state.snapshot().settled,false);assert.equal(state.snapshot().source,'scroll');
  state.scrub(5.97,'scroll');assert.equal(state.snapshot().index,5,'0.03 away is not a dwell');
  assert.deepEqual(discrete,[]);
  state.scrub(5.985,'scroll');
  assert.deepEqual({index:state.snapshot().index,turn:state.snapshot().turn,settled:state.snapshot().settled},{index:6,turn:6,settled:true});
  assert.deepEqual(discrete,['select','settle']);
  state.scrub(6.01,'scroll');state.scrub(6,'scroll');
  assert.deepEqual(discrete,['select','settle'],'a dwell settles once, not on every update');
  state.scrub(6.4,'scroll');assert.equal(state.snapshot().settled,false);
  state.scrub(5.995,'scroll');
  assert.deepEqual(discrete,['select','settle','settle'],'back at the same spread: settle without select');
  assert.equal(state.consumeAnchorDirty(),false,'scrolling never dirties its own anchor');
  // Drag: index moves only when the sheet lands.
  discrete.length=0;
  state.grab('drag');state.scrub(6.7,'drag');
  assert.equal(state.snapshot().index,6);
  const landing=state.release('drag');
  assert.equal(state.snapshot().index,6,'not yet: the sheet is still in the air');
  assert.equal(state.snapshot().lock,null);
  assert.deepEqual(discrete,[]);
  await anim.land();
  assert.deepEqual(await landing,{index:7,cancelled:false});
  assert.equal(state.snapshot().index,7);
  assert.deepEqual(discrete,['select','settle']);
});

test('landing rules: velocity picks the side, duration is clamp(|Δ|·900, 180, 600)',async()=>{
  for(const [turn,velocity,landing,duration] of [
    [5.2,0.5,6,600],[5.8,-0.5,5,600],[5.4,0,5,360],[5.6,0.2,6,360],[5.6,-0.31,5,540],[5.9,0,6,180],[5.25,0.3,5,225],[6.95,0.31,7,180]
  ]){
    const {state}=make();
    const anim=manual(state);
    state.consumeAnchorDirty();
    state.grab('swipe');state.scrub(turn,'swipe');
    const promise=state.release('swipe',{velocity});
    assert.equal(state.consumeAnchorDirty(),true,'release dirties the scroll anchor');
    const run=anim.last;
    assert.equal(run.to,landing,`${turn} at ${velocity} turns/s`);
    assert.equal(run.ease,'power2.out');assert.equal(run.mode,'full');assert.equal(run.source,'swipe');
    assert.ok(Math.abs(run.duration-duration)<1e-9,`duration ${run.duration} ≈ ${duration}`);
    assert.ok(Math.abs(run.distance-Math.abs(landing-turn))<1e-9);
    await anim.land();
    assert.deepEqual(await promise,{index:landing,cancelled:false});
  }
  // On a spread already, or without full motion, the landing is immediate.
  const {state,mode,discrete}=make();
  const anim=manual(state);
  state.grab('drag');state.scrub(7,'drag');
  assert.deepEqual(await state.release('drag',{velocity:1}),{index:7,cancelled:false});
  assert.equal(anim.runs.length,0);assert.deepEqual(discrete,['select','settle']);
  state.grab('drag');state.scrub(7.6,'drag');mode.value='cut';
  assert.deepEqual(await state.release('drag'),{index:8,cancelled:false});
  assert.equal(anim.runs.length,0);assert.equal(state.snapshot().mode,'cut');
  assert.deepEqual(await state.release('drag'),{index:8,cancelled:true},'a second release is a no-op');
});

test('anchorDirty is set by commands and releases and read once',async()=>{
  const {state}=make({policy:'cut'});
  assert.equal(state.consumeAnchorDirty(),false);
  await state.openWeek(5);
  assert.equal(state.consumeAnchorDirty(),true,'even a command to the current spread rebases');
  assert.equal(state.consumeAnchorDirty(),false);
  await state.step(2);
  assert.equal(state.consumeAnchorDirty(),true);
  const anim={animate:()=>new Promise(()=>{}),cancel(){}};
  const busy=make();busy.state.setAnimator(anim);busy.state.openWeek(9);busy.state.consumeAnchorDirty();
  assert.equal(busy.state.scrub(7,'scroll'),false,'an animation owns the paper');
  assert.equal(busy.state.consumeAnchorDirty(),true,'so scroll rebases after it');
});

test('discrete subscribers hear select, settle and weeks; continuous ones also hear turn',async()=>{
  const {state,discrete,continuous}=make();
  const anim=manual(state);
  state.scrub(5.5,'scroll');state.scrub(6,'scroll');
  state.grab('drag');state.scrub(6.4,'drag');state.release('drag',{velocity:1});await anim.land();
  state.setWeeks(WEEKS,{reason:'minute'});
  for(const kind of discrete)assert.ok(['select','settle','weeks'].includes(kind),kind);
  assert.ok(continuous.includes('turn'));
  assert.deepEqual(continuous.filter(kind=>kind!=='turn'),discrete);
  const seen=[];
  const off=state.subscribe((snap,change)=>{seen.push([snap.version,change]);});
  await state.openWeek(2,{animate:false});
  off();
  await state.openWeek(3,{animate:false});
  assert.deepEqual(seen.map(([,change])=>change),[{kind:'select',source:'control'},{kind:'settle',source:'control'}]);
  assert.ok(seen[1][0]>seen[0][0],'every notification carries a newer snapshot');
  assert.ok(Object.isFrozen(seen[0][1]));
});

test('a throwing subscriber is reported and does not silence the others',async t=>{
  const errors=t.mock.method(console,'error',()=>{});
  const {state}=make({policy:'cut'});
  const heard=[];
  state.subscribe(()=>{throw new Error('subscriber');});
  state.subscribe((snap,change)=>heard.push(change.kind));
  await state.openWeek(8);
  assert.deepEqual(heard,['select','settle']);
  assert.equal(errors.mock.callCount(),2);
});

test('setWeeks keeps the selection, clamps it, and accepts the same array to force a refresh',async()=>{
  const {state,discrete}=make({policy:'cut'});
  const seen=[];state.subscribe((snap,change)=>seen.push(change));
  await state.openWeek(9);
  discrete.length=0;seen.length=0;
  const recomputed=semesterWeeks({records:recordsForCourse('mth140',{courseData:COURSES,section:1})});
  state.setWeeks(recomputed,{reason:'section'});
  assert.equal(state.weeks,recomputed);assert.equal(state.snapshot().index,9);
  state.setWeeks(recomputed,{reason:'minute'});
  state.setWeeks(state.weeks,{reason:'midnight',today:6});
  assert.equal(state.snapshot().today,6);assert.equal(state.today,6);assert.equal(state.snapshot().index,9,'midnight moves today, not the selection');
  assert.deepEqual(seen,[{kind:'weeks',source:'data',reason:'section'},{kind:'weeks',source:'data',reason:'minute'},{kind:'weeks',source:'data',reason:'midnight'}]);
  // A shorter calendar clamps the selection and cancels a turn heading past its end.
  const busy=make();const anim=manual(busy.state);
  const heading=busy.state.openWeek(16);
  busy.state.setWeeks(WEEKS.slice(0,4),{reason:'data'});
  assert.deepEqual(await heading,{index:16,cancelled:true});
  assert.equal(anim.cancels,1);
  assert.deepEqual({index:busy.state.snapshot().index,turn:busy.state.snapshot().turn,settled:busy.state.snapshot().settled,count:busy.state.snapshot().count,today:busy.state.snapshot().today},{index:3,turn:3,settled:true,count:4,today:3});
});

test('removing the animator mid-turn lands the page where it was going',async()=>{
  const {state,discrete}=make();
  const anim=manual(state);
  const promise=state.openWeek(8);
  state.scrub(6.2,'animation');
  state.setAnimator(null);
  assert.equal(anim.cancels,1);
  assert.deepEqual(await promise,{index:8,cancelled:false});
  assert.deepEqual({turn:state.snapshot().turn,settled:state.snapshot().settled},{turn:8,settled:true});
  assert.deepEqual(discrete,['select','settle']);
  await state.openWeek(9);
  assert.equal(anim.runs.length,1,'no animator, no animation');
});

test('a failing animator never traps the book',async t=>{
  t.mock.method(console,'error',()=>{});
  const {state}=make();
  state.setAnimator({animate(){throw new Error('gpu');},cancel(){}});
  assert.deepEqual(await state.openWeek(8),{index:8,cancelled:false});
  assert.equal(state.snapshot().settled,true);
  state.setAnimator({animate:()=>Promise.reject(new Error('lost')),cancel(){}});
  assert.deepEqual(await state.openWeek(9),{index:9,cancelled:false});
  assert.equal(state.snapshot().turn,9);
});

test('attach wires book-state, book-week and the palette book-open-week; detach unwires',async()=>{
  assert.equal(currentBookState(),null);
  const {state}=make({policy:'cut'});
  attachBookState(state);
  assert.equal(currentBookState(),state,'attach without a document still makes it current');
  detachBookState(state);
  assert.equal(currentBookState(),null);

  const doc=new EventTarget();globalThis.document=doc;
  try{
    const events=[];
    for(const type of ['book-state','book-week'])doc.addEventListener(type,event=>events.push([type,event.detail]));
    assert.equal(attachBookState(state),state);
    assert.equal(currentBookState(),state);
    assert.deepEqual(events.shift(),['book-state',{state}]);
    const open=index=>{const event=new CustomEvent('book-open-week',{detail:{index},cancelable:true});doc.dispatchEvent(event);return event.defaultPrevented;};
    assert.equal(open(8),true,'the book takes the palette week');
    assert.equal(state.snapshot().index,8);assert.equal(state.snapshot().source,'palette');
    assert.deepEqual(events.map(([type,snap])=>[type,snap.index,snap.settled]),[['book-week',8,false],['book-week',8,true]]);
    assert.ok(Object.isFrozen(events[0][1]));
    events.length=0;
    assert.equal(open(99),true);assert.equal(state.snapshot().index,LAST,'clamped');
    assert.equal(open('3'),false,'not a number: left for the timeline fallback');
    assert.equal(open(Number.NaN),false);
    state.setWeeks(WEEKS,{reason:'target'});
    assert.deepEqual(events.map(([type])=>type),['book-week','book-week','book-week']);
    state.scrub(LAST-0.5,'scroll');
    assert.equal(events.length,3,'no book-week per scroll frame');
    events.length=0;

    const other=make({policy:'cut'}).state;
    detachBookState(other);
    assert.equal(currentBookState(),state,'detaching a state that is not current is a no-op');
    attachBookState(other);
    assert.equal(currentBookState(),other,'a new mount replaces the old one');
    assert.deepEqual(events.map(([type,detail])=>[type,detail.state]),[['book-state',null],['book-state',other]]);
    open(2);
    assert.equal(other.snapshot().index,2);assert.notEqual(state.snapshot().index,2,'the old state no longer listens');
    events.length=0;
    detachBookState(other);
    assert.equal(currentBookState(),null);
    assert.deepEqual(events,[['book-state',{state:null}]]);
    assert.equal(open(4),false,'after unmount the palette falls back');
    attachBookState(other);other.dispose();
    assert.equal(currentBookState(),null,'dispose detaches');
  }finally{delete globalThis.document;}
  assert.throws(()=>attachBookState({}),TypeError);
});

test('dispose stops everything and later calls are harmless',async()=>{
  const {state,discrete}=make();
  const anim=manual(state);
  const promise=state.openWeek(9);
  state.dispose();
  assert.deepEqual(await promise,{index:9,cancelled:true});
  assert.equal(anim.cancels,1);
  discrete.length=0;
  assert.deepEqual(await state.openWeek(2),{index:9,cancelled:true});
  assert.equal(state.grab('drag'),false);assert.equal(state.scrub(3,'scroll'),false);
  state.setWeeks(WEEKS,{reason:'minute'});
  assert.deepEqual(discrete,[]);
  assert.equal(typeof state.subscribe(()=>{}),'function');
  state.dispose();
});

test('the controller stub plays the engine side of the contract on fake timers',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  const {state,mode}=make();
  const views=[];
  const getView=index=>{views.push(index);return {signature:`s${index}:${state.weeks.length}`};};
  const slot=stub.fakeSlot(),fallbacks=[];
  slot.addEventListener('book-ready',()=>fallbacks.push('ready'));
  const controller=await stub.mountBook(slot,{course:'mth140',state,getView,onFallback:reason=>fallbacks.push(reason)});
  assert.equal(await controller.ready,'webgl2');
  assert.equal(slot.dataset.renderer,'webgl2');assert.equal(slot.dataset.sceneReady,'true');assert.deepEqual(fallbacks,['ready']);
  assert.deepEqual(controller.calls.paint,[5]);
  assert.equal(controller.metrics().pageWidthPx,410);assert.equal(controller.metrics().spreadRect.width,820);
  const turning=state.openWeek(6);
  assert.equal(controller.calls.animate.at(-1).mode,'full');
  t.mock.timers.tick(719);await flush();
  assert.equal(state.snapshot().settled,false);
  t.mock.timers.tick(1);
  assert.deepEqual(await turning,{index:6,cancelled:false});
  assert.equal(slot.dataset.week,'6');assert.equal(slot.dataset.turn,'6.00');
  assert.deepEqual(controller.calls.paint,[5,6]);
  state.setWeeks(state.weeks,{reason:'minute'});
  assert.deepEqual(controller.calls.paint,[5,6],'an unchanged signature is not repainted');
  state.setWeeks(WEEKS.slice(),{reason:'data'});
  state.setWeeks(WEEKS.slice(0,12),{reason:'data'});
  assert.deepEqual(controller.calls.paint,[5,6,6],'a changed signature repaints the live face');
  controller.setHandoff(0.4);controller.setFocus('midterm');controller.setFocus(null);
  assert.deepEqual(controller.calls.setHandoff,[0.4]);assert.deepEqual(controller.calls.setFocus,['midterm',null]);
  let closed=false;controller.close({ms:500}).then(()=>{closed=true;});
  await flush();assert.equal(closed,false,'full mode closes over min(ms, 350)');
  t.mock.timers.tick(350);await flush();assert.equal(closed,true);
  mode.value='cut';await state.openWeek(7);
  await controller.close();assert.deepEqual(controller.calls.close,[500,350]);
  controller.dispose();
  mode.value='full';
  await state.openWeek(8);
  assert.equal(state.snapshot().mode,'cut','the stub unregisters its animator on dispose');
  assert.equal(slot.dataset.sceneReady,undefined);

  const poster=make().state,posterSlot=stub.fakeSlot(),reasons=[],events=[];
  posterSlot.addEventListener('book-fallback',event=>events.push(event.detail.reason));
  const fallback=await stub.mountBook(posterSlot,{state:poster,renderer:'poster',reason:'no-webgl2',onFallback:reason=>reasons.push(reason)});
  assert.equal(await fallback.ready,'poster');
  assert.deepEqual(reasons,['no-webgl2']);assert.deepEqual(events,['no-webgl2']);
  assert.equal(posterSlot.dataset.renderer,'poster');assert.equal(posterSlot.dataset.rendererReason,'no-webgl2');
  fallback.dispose();
});
