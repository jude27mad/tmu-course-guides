/* Semester book state and the words on its pages (docs/book/semester-book-spec.md §3.1, §3.2, §3.5, §6.9).
 *
 * One BookState per mounted book route. It owns which spread is selected (`index`) and where the paper is
 * (`turn`), and arbitrates between discrete commands (keys, buttons, palette) and continuous sources
 * (scroll, drag, swipe, the engine's animator). The DOM renders `index`; the engine renders `turn`.
 *
 * Pure: no DOM, Three, storage or timers. The only document access is inside attachBookState() and
 * detachBookState(), which wire the §3.5 events through globalThis.document when one exists. The week is
 * session presentation state (plan §1): it is never read from or written to storage.
 *
 * describeSpread() is the only source of text for the book, its caption and rail. Assessment wording is the
 * resolver's (targets.mjs resolveTarget by id, parts, compact), copied verbatim. Week wording follows
 * docs/copy/interface-copy.md, which overrides the spec draft where they differ:
 *   - `aria` is the week tick's stable accessible name, "Week 6, October 12 to 18. Show this week"; it does
 *     not change on every update (no relative words or counts in it).
 *   - `title` is the visible week label, "Week 1 · Sep 8–13", "Week 6 · Oct 12–18", "Week 16 · Dec 21".
 *   - `note` names the partial weeks "Partial first week" and "Final day of the semester".
 *   - an empty week reads "Nothing scheduled"; a completed entry is announced as "marked complete in this
 *     browser".
 */
import {resolveTarget,parts,compact} from '../night/targets.mjs?v=20261026-cen100';
import {popupRank} from './weeks.mjs?v=20261023-mth141';
import {today as torontoDay,addDays,dateLabel,dayLabel} from '../schedule.mjs';

const MODES=new Set(['full','fade','cut']);
const GESTURES=new Set(['drag','swipe']);
const report=error=>{try{(globalThis.reportError||console.error)(error);}catch{}};

/* ------------------------------------------------------------------ state ------------------------------ */

/**
 * @param {{course:string, weeks:object[], today:number, policy:()=>('full'|'fade'|'cut'),
 *          describe?:(spread:object, index:number)=>object}} options
 *   weeks: Spread[] from semesterWeeks(); today: currentWeekIndex(weeks, now); policy: §4.1, injected.
 *   A missing or throwing policy reads as 'cut', the calm default.
 *   describe: the route's describeSpread bound to its live context (data, section, completion, clock,
 *   target). Injected like policy, so the state stays pure; view(i) memoises it until the next `weeks`
 *   change, which is how every data refresh reaches the views (§6.10).
 */
export function createBookState({course=null,weeks=[],today=0,policy=()=>'cut',describe=null}={}){
 let list=Array.isArray(weeks)?weeks:[];
 const last=()=>Math.max(0,list.length-1);
 const clampIndex=value=>Math.min(last(),Math.max(0,Math.round(value)));
 const clampTurn=value=>Math.min(last(),Math.max(0,value));
 const readPolicy=()=>{try{const mode=typeof policy==='function'?policy():'cut';return MODES.has(mode)?mode:'cut';}catch{return 'cut';}};

 let todayIndex=clampIndex(Number.isFinite(today)?today:0);
 let index=todayIndex,turn=index,settled=true,source='init',lock=null,mode=readPolicy(),version=0;
 let anchorDirty=false,animator=null,run=null,ticket=0,disposed=false,cached=null;
 const subscribers=new Set(),views=new Map();

 const bump=()=>{version++;cached=null;};
 const snapshot=()=>cached??=Object.freeze({course,count:list.length,today:todayIndex,index,turn,settled,source,lock,mode,version});
 function emit(kind,from,reason){
  bump();
  const change=Object.freeze(reason===undefined?{kind,source:from}:{kind,source:from,reason}),snap=snapshot();
  for(const entry of [...subscribers]){
   if(!subscribers.has(entry)||(kind==='turn'&&!entry.continuous))continue;
   try{entry.fn(snap,change);}catch(error){report(error);}
  }
 }
 const done=(value)=>Promise.resolve({index:value,cancelled:false});

 /* One animation at a time. A superseded or cancelled run resolves {cancelled:true}; its animator promise is
    ignored if it settles later (the ticket no longer matches). */
 function startRun(kind,from,to,options,origin){
  const id=++ticket;let resolve;
  const promise=new Promise(r=>{resolve=r;});
  run={id,kind,to,origin,mode:options.mode,resolve,promise};
  let result;
  try{result=animator.animate(from,to,options);}catch(error){result=Promise.reject(error);}
  // A failed animation never traps the book: it lands at its target as a cut.
  Promise.resolve(result).then(()=>finish(id),error=>{report(error);finish(id);});
  return promise;
 }
 function finish(id){
  if(!run||run.id!==id)return;
  const {to,origin,kind,resolve}=run;run=null;
  land(to,origin,kind==='landing');
  resolve({index,cancelled:false});
 }
 function land(to,origin,select){
  const previous=index,moved=turn!==to;
  turn=to;settled=true;
  if(select)index=to;
  if(moved)emit('turn',origin);
  if(index!==previous)emit('select',origin);
  emit('settle',origin);
 }
 /* Stop the current run. `cut` completes it at once (the animator went away); otherwise it is cancelled. */
 function stopRun({cut=false}={}){
  if(!run)return null;
  const stopped=run;run=null;
  try{animator?.cancel?.();}catch(error){report(error);}
  if(cut){land(stopped.to,stopped.origin,stopped.kind==='landing');stopped.resolve({index,cancelled:false});}
  else stopped.resolve({index:stopped.to,cancelled:true});
  return stopped;
 }

 function openWeek(target,{source:origin='control',animate=true}={}){
  if(disposed)return Promise.resolve({index,cancelled:true});
  const to=typeof target==='number'&&Number.isFinite(target)?clampIndex(target):index;
  const previous=index,interrupted=Boolean(run);
  // Asked again for the page already turning there: join that turn rather than restart its easing.
  if(run?.kind==='command'&&run.to===to&&animate!==false&&readPolicy()===run.mode){
   source=origin;anchorDirty=true;bump();
   return run.promise;
  }
  // 1–4: clamp, select immediately, mark the scroll anchor dirty, cancel a gesture in progress.
  if(GESTURES.has(lock))lock=null;
  stopRun();
  index=to;source=origin;anchorDirty=true;
  // The paper is not at the selection yet, so no snapshot claims to be settled until it is.
  if(turn!==index)settled=false;
  if(index!==previous)emit('select',origin);
  else bump();
  if(settled&&turn===index&&!interrupted)return done(index);
  // 5: cut (or no animator), fade or full. Paper already on the spread (a gesture or turn caught exactly
  // there) only needs to settle.
  const chosen=animate===false?'cut':readPolicy();
  if(chosen==='cut'||!animator||turn===index){
   mode=chosen==='cut'||!animator?'cut':chosen;
   const moved=turn!==index;turn=index;settled=true;
   if(moved)emit('turn',origin);
   emit('settle',origin);
   return done(index);
  }
  mode=chosen;settled=false;bump();
  return startRun('command',turn,index,{distance:Math.abs(index-turn),source:origin,mode:chosen},origin);
 }

 function step(delta,options){
  if(typeof delta!=='number'||!Number.isFinite(delta))return Promise.resolve({index,cancelled:true});
  return openWeek(index+Math.round(delta),options);
 }

 function grab(origin){
  if(disposed||!GESTURES.has(origin)||readPolicy()!=='full')return false;
  if(lock===origin)return true;
  if(GESTURES.has(lock))return false;
  stopRun();
  lock=origin;source=origin;settled=false;mode='full';
  emit('turn',origin);
  return true;
 }

 function scrub(value,origin){
  if(disposed||typeof value!=='number'||!Number.isFinite(value))return false;
  const next=clampTurn(value);
  if(origin==='animation'){
   if(!run)return false;
   if(next!==turn){turn=next;emit('turn','animation');}
   return true;
  }
  if(GESTURES.has(origin)){
   if(lock!==origin)return false;
   if(next!==turn){turn=next;settled=false;emit('turn',origin);}
   return true;
  }
  if(origin!=='scroll')return false;
  // A gesture or an animation owns the paper. Keep the anchor dirty so scroll rebases once it is free.
  if(GESTURES.has(lock)||run){anchorDirty=true;return false;}
  const near=Math.round(next),dwell=Math.abs(next-near)<0.02;
  if(source!=='scroll'){source='scroll';bump();}
  if(!dwell){
   if(next!==turn||settled){turn=next;settled=false;emit('turn','scroll');}
   return true;
  }
  // At a dwell the paper rests on the integer: the caption follows, and the sheets can hide.
  const previous=index,wasSettled=settled,moved=turn!==near;
  turn=near;index=clampIndex(near);settled=true;
  if(moved)emit('turn','scroll');
  if(index!==previous)emit('select','scroll');
  if(!wasSettled||index!==previous)emit('settle','scroll');
  return true;
 }

 function release(origin,{velocity=0}={}){
  if(disposed||!GESTURES.has(origin)||lock!==origin)return Promise.resolve({index,cancelled:true});
  lock=null;anchorDirty=true;
  const v=typeof velocity==='number'&&Number.isFinite(velocity)?velocity:0;
  const landing=clampIndex(v>0.3?Math.ceil(turn-1e-6):v<-0.3?Math.floor(turn+1e-6):Math.round(turn));
  const distance=Math.abs(landing-turn);
  if(readPolicy()!=='full'||!animator||distance===0){
   mode=readPolicy()==='full'?'full':'cut';
   land(landing,origin,true);
   return done(index);
  }
  mode='full';settled=false;bump();
  const duration=Math.min(600,Math.max(180,distance*900));
  return startRun('landing',turn,landing,{distance,source:origin,mode:'full',ease:'power2.out',duration},origin);
 }

 function setWeeks(next,{reason,today:day}={}){
  if(disposed)return;
  if(Array.isArray(next))list=next;
  const max=last();
  todayIndex=typeof day==='number'&&Number.isFinite(day)?clampIndex(day):Math.min(todayIndex,max);
  // Keep the selection; clamp it only when the semester got shorter.
  if(index>max||turn>max||(run&&run.to>max)){
   stopRun();
   if(GESTURES.has(lock))lock=null;
   index=Math.min(index,max);turn=index;settled=true;
  }
  views.clear();
  emit('weeks','data',reason);
 }

 /* The words for spread i, from the injected describe(); memoised until the next `weeks` change.
    fresh: compute without reading or filling the memo (the minute check compares signatures). */
 function view(i,{fresh=false}={}){
  if(typeof describe!=='function'||!Number.isInteger(i)||i<0||i>=list.length)return null;
  if(!fresh&&views.has(i))return views.get(i);
  let value=null;
  try{value=describe(list[i],i)??null;}catch(error){report(error);value=null;}
  if(!fresh&&value)views.set(i,value);
  return value;
 }

 function setAnimator(next){
  const valid=next&&typeof next.animate==='function'?next:null;
  if(valid===animator)return;
  // The engine is leaving (or being replaced) mid-animation: land where it was going.
  if(run)stopRun({cut:true});
  animator=valid;
 }

 function subscribe(fn,{continuous=false}={}){
  if(disposed||typeof fn!=='function')return()=>{};
  const entry={fn,continuous:Boolean(continuous)};
  subscribers.add(entry);
  return()=>{subscribers.delete(entry);};
 }

 function consumeAnchorDirty(){const value=anchorDirty;anchorDirty=false;return value;}

 const state={
  course,
  get weeks(){return list;},
  get today(){return todayIndex;},
  snapshot,openWeek,step,grab,scrub,release,setWeeks,setAnimator,subscribe,consumeAnchorDirty,view,
  dispose(){
   if(disposed)return;
   stopRun();lock=null;
   disposed=true;subscribers.clear();animator=null;views.clear();
   if(current===state)detachBookState(state);
  }
 };
 return state;
}

/* ------------------------------------------------------- current state and document events (§3.5) ----- */

let current=null,wiring=null;
function dispatch(target,type,detail){
 const Custom=globalThis.CustomEvent;
 if(typeof Custom!=='function'||typeof target?.dispatchEvent!=='function')return;
 try{target.dispatchEvent(new Custom(type,{detail}));}catch(error){report(error);}
}

/** Route mount: makes `state` current, fires `book-state`, mirrors select/settle/weeks as `book-week`
 *  (detail: Snapshot) and answers the palette's `book-open-week` (§6.9). Returns `state`. */
export function attachBookState(state){
 if(!state||typeof state.openWeek!=='function'||typeof state.subscribe!=='function')throw new TypeError('attachBookState needs a BookState');
 if(current===state)return state;
 if(current)detachBookState(current);
 current=state;
 const doc=globalThis.document,listening=doc&&typeof doc.addEventListener==='function';
 const onOpenWeek=event=>{
  const value=event?.detail?.index;
  if(current!==state||typeof value!=='number'||!Number.isFinite(value))return;
  event.preventDefault?.();
  state.openWeek(value,{source:'palette'});
 };
 if(listening)doc.addEventListener('book-open-week',onOpenWeek);
 const unsubscribe=listening?state.subscribe(snap=>dispatch(doc,'book-week',snap)):()=>{};
 wiring={state,doc:listening?doc:null,onOpenWeek,unsubscribe};
 if(listening)dispatch(doc,'book-state',{state});
 return state;
}

/** Route unmount. A no-op unless `state` is current. Fires `book-state` with {state:null}. */
export function detachBookState(state){
 if(!state||state!==current)return;
 const {doc,onOpenWeek,unsubscribe}=wiring||{};
 current=null;wiring=null;
 if(host)setBookHost(null);
 try{unsubscribe?.();}catch(error){report(error);}
 if(doc){doc.removeEventListener('book-open-week',onOpenWeek);dispatch(doc,'book-state',{state:null});}
}

/** The mounted book's state, or null on the Desk and non-book routes. */
export function currentBookState(){return current;}

/* The mounted book's stage, for Side B's DOM modules (rail, scroll scrub, swipe, dock). The course header
   publishes it in two steps: {state, header, slot, controller:null} as soon as the stage DOM exists, then
   again with the controller once mountBook() resolves (or the poster stands in). Each change fires
   `book-host` on the document with the frozen record (null on unmount). Nothing here touches the DOM. */
let host=null;
export function setBookHost(next){
 if(next&&(!next.state||next.state!==current))return host;
 host=next?Object.freeze({...next}):null;
 const doc=globalThis.document;
 if(doc)dispatch(doc,'book-host',host);
 return host;
}
export function currentBookHost(){return host;}

/* ------------------------------------------------------------------ words (§3.2) ---------------------- */

const KIND_LABELS={final:'Final',midterm:'Midterm',quiz:'Quiz',lab:'Lab',minor:'Coursework',reading:'Reading'};
const NOTES={teaching:'Teaching week',reading:'Reading week',exam:'Exam week'};
const msOf=now=>now==null?Date.now():+now;
const pad2=n=>String(n).padStart(2,'0');
/* Calendar labels are pure functions of a date string, and Intl formatting dominates the cost of a view
   (the rail names every spread), so each label is computed once per date. */
const memo=fn=>{const cache=new Map();return date=>{let value=cache.get(date);if(value===undefined){value=fn(date);cache.set(date,value);}return value;};};
const weekday=memo(date=>dayLabel(date));
const monthDay=memo(date=>dateLabel(date));
const shortDay=memo(date=>`${weekday(date).slice(0,3)} ${monthDay(date)}`);
const monthLong=memo(date=>new Date(date+'T12:00:00Z').toLocaleDateString('en-CA',{month:'long',timeZone:'UTC'}));
const dayOfMonth=date=>String(Number(date.slice(8,10)));
const sameMonth=(a,b)=>a.slice(0,7)===b.slice(0,7);
const mondayOf=date=>addDays(date,-((new Date(date+'T12:00:00Z').getUTCDay()+6)%7));
const dayNumber=date=>Date.parse(date+'T12:00:00Z')/86400000;
const isDone=(map,id)=>map[id]===true||map[id]===1;
const sentenceCase=text=>text.charAt(0)+text.slice(1).toLowerCase();
const sentenceEnd=text=>/[.!?]$/.test(text)?text:text+'.';
function completedMap(value){
 if(!value||typeof value!=='object'||Array.isArray(value))return null;
 if(Object.hasOwn(value,'completed'))return value.completed&&typeof value.completed==='object'&&!Array.isArray(value.completed)?value.completed:{};
 return value;
}
/** FNV-1a, 32-bit, base 36: stable across runs and engines. */
function hash(text){
 let h=0x811c9dc5;
 for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,0x01000193)>>>0;}
 return h.toString(36);
}
const dated=weeks=>weeks.filter(week=>week?.start&&week?.end);

/** "Oct 12–18", "Sep 28–Oct 4", "Dec 21". */
function compactRange(start,end){
 if(start===end)return monthDay(start);
 return `${monthDay(start)}–${sameMonth(start,end)?dayOfMonth(end):monthDay(end)}`;
}
/** "October 12 to 18", "September 28 to October 4", "December 21". */
function spokenRange(start,end){
 if(start===end)return `${monthLong(start)} ${dayOfMonth(start)}`;
 return `${monthLong(start)} ${dayOfMonth(start)} to ${sameMonth(start,end)?'':monthLong(end)+' '}${dayOfMonth(end)}`;
}
/** The visible week label (interface copy): "Week 6 · Oct 12–18"; the pending spread keeps its own label. */
function weekTitle(spread,position){
 if(!spread.start||!spread.end)return spread.label||'Exam · Date pending';
 return `Week ${position+1} · ${compactRange(spread.start,spread.end)}`;
}
function partialNote(spread){
 if(!spread.partial||!spread.start||!spread.end)return null;
 if(mondayOf(spread.start)!==spread.start)return 'Partial first week';
 return spread.start===spread.end?'Final day of the semester':'Partial final week';
}
/* Relative to the Toronto date of `now`, by Monday anchors. Outside the term, the spread the book opens at
   says so instead of claiming THIS WEEK: BEFORE TERM on the first spread, AFTER TERM on the last dated one. */
function relativeFor(spread,weeks,day){
 if(spread.pending||!spread.start||!spread.end)return 'EXAMS · DATE PENDING';
 const calendar=dated(weeks),first=calendar[0],final=calendar.at(-1);
 if(first&&day<first.start&&spread.start===first.start)return 'BEFORE TERM';
 if(final&&day>final.end&&spread.start===final.start)return 'AFTER TERM';
 const diff=Math.round((dayNumber(mondayOf(spread.start))-dayNumber(mondayOf(day)))/7);
 if(diff===0)return 'THIS WEEK';
 if(diff===1)return 'NEXT WEEK';
 if(diff===-1)return 'LAST WEEK';
 return diff>1?`IN ${diff} WEEKS`:`${-diff} WEEKS AGO`;
}

/* Only a record the resolver cannot describe by id lands here (CEN's undated final, `item:y9`). It uses the
   resolver's own vocabulary for its precision and never invents a date or a time. */
function unresolved(record){
 const base={id:record.id,title:record.title,kind:record.kind,open:record.open,precision:record.precision||'pending'};
 if(base.precision==='pending'||!record.date)return {...base,precision:'pending',when:'Date pending',label:'Awaiting the official schedule'};
 return {...base,precision:'day',date:record.date,when:shortDay(record.date),label:'Time not posted'};
}

function describeEntry(record,{course,data,section,completed,map,nowMs,day,targetId}){
 let t=null;
 if(data){try{t=resolveTarget({course,data,section,completed:map||{},now:nowMs,id:record.id});}catch{t=null;}}
 if(!t||t.id!==record.id)t=unresolved(record);
 const isCompleted=map?isDone(map,record.id):Boolean(record.completed);
 const p=parts(t,nowMs)||{state:t.precision},state=p.state;
 const precise=t.precision==='exact'||t.precision==='day';
 // A quiz week is over once its Friday has passed (schedule.mjs assessmentPassed), whatever the section.
 const weekOver=t.precision==='week'&&typeof t.weekEnd==='string'&&t.weekEnd<day;
 const passed=state==='passed'||weekOver;
 const entryDay=precise&&record.date?record.date:null;
 let rowWhen=null;
 if(entryDay&&typeof t.when==='string'){
  const prefix=shortDay(entryDay);
  rowWhen=t.when.startsWith(prefix+' · ')?t.when.slice(prefix.length+3):t.when===prefix?t.label:t.when;
 }
 const chip=isCompleted?'DONE':passed?'PASSED':record.id===targetId&&targetId!=null?(state==='live'?'NOW':state==='soon'||state==='hot'?'SOON':'NEXT'):null;
 const urgency=!precise||isCompleted||passed?'none':state==='hot'||state==='live'?'hot':state==='soon'?'soon':'none';
 return {
  entry:{
   id:record.id,open:t.open??record.open??null,kind:record.kind,kindLabel:KIND_LABELS[record.kind]||'Coursework',title:t.title??record.title,
   when:t.when,label:t.label,cta:t.cta??null,note:t.note??null,precision:t.precision,
   day:entryDay,rowWhen,bracket:t.precision==='week',
   chip,urgency,state,completed:isCompleted,passed,
   // Line 2 of a passed tag: compact() ("Due time passed"); a finished quiz week keeps the guide's wording.
   status:passed&&!isCompleted?(state==='passed'?compact(t,nowMs):'Date passed'):null,
   rank:popupRank(record)
  },
  sort:entryDay||record.week||t.week||'9999-12-31'
 };
}
function spokenEntry(entry){
 if(entry.completed)return `${entry.title} marked complete in this browser.`;
 const when=entry.when?sentenceEnd(`${entry.title}: ${entry.when}`):sentenceEnd(entry.title);
 const after=entry.status||entry.label;
 return after&&after!==entry.when?`${when} ${sentenceEnd(after)}`:when;
}
const deepFreeze=value=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.freeze(value);for(const key of Object.keys(value))deepFreeze(value[key]);}return value;};

/**
 * Everything the book, caption, rail and live region say about one spread.
 * @param {object|number} spread a Spread from semesterWeeks() (or its index in ctx.weeks)
 * @param {{course:string,data:object,weeks:object[],section?:number,completed?:object,now?:number|Date,
 *          targetId?:string|null,today?:number}} ctx
 *   data is COURSES[course] (or the CEN SCHEDULE); completed is the saved completed map or its envelope
 *   (absent: each record's own flag); targetId is the dock's current target id; today is accepted for
 *   symmetry with the state, but dates come from `now`.
 * @returns {object} a deep-frozen SpreadView (§3.2) plus the copy fields title, name, caption, folio, empty
 *   and moreLabel, and per entry note, precision and status (line 2 of a passed tag).
 */
export function describeSpread(spread,{course=null,data=null,weeks=[],section=0,completed,now,targetId=null}={}){
 const list=Array.isArray(weeks)?weeks:[];
 if(typeof spread==='number')spread=list[spread];
 if(!spread||typeof spread!=='object')throw new TypeError('describeSpread needs a spread');
 const nowMs=msOf(now),day=torontoDay(new Date(nowMs)),map=completedMap(completed);
 const position=Number.isInteger(spread.index)?spread.index:Math.max(0,list.indexOf(spread));
 const count=list.length||position+1,datedCount=dated(list).length;
 const pending=Boolean(spread.pending)||!spread.start||!spread.end;
 const records=Array.isArray(spread.records)?spread.records:[];

 const described=records.map(record=>describeEntry(record,{course,data,section,completed,map,nowMs,day,targetId}));
 described.sort((a,b)=>a.sort.localeCompare(b.sort)||b.entry.rank-a.entry.rank||String(a.entry.id).localeCompare(String(b.entry.id)));
 const entries=described.map(item=>item.entry);
 const popups=entries.map((entry,order)=>({entry,order})).sort((a,b)=>b.entry.rank-a.entry.rank||a.order-b.order).slice(0,3).map(item=>item.entry.id);
 const more=Math.max(0,entries.length-3);

 const days=pending?[]:Array.from({length:7},(_,i)=>{
  const date=addDays(mondayOf(spread.start),i),before=date<spread.start,after=date>spread.end;
  return {date,dow:weekday(date).slice(0,3).toUpperCase(),dom:dayOfMonth(date),today:date===day,outside:before||after,mark:before?'before term':after?'after term':null};
 });

 const relative=relativeFor(spread,list,day);
 const partial=partialNote(spread);
 const numeral=pending?null:pad2(position+1);
 const title=weekTitle(spread,position);
 const name=pending?'Exams, date pending':`Week ${position+1}, ${spokenRange(spread.start,spread.end)}${partial?'. '+partial:''}`;
 const aria=pending?'Exams, date pending. Show this week':`Week ${position+1}, ${spokenRange(spread.start,spread.end)}. Show this week`;
 const lead=pending?'Exams, date pending.':`Week ${position+1} of ${datedCount}, ${spokenRange(spread.start,spread.end)}, ${relative.toLowerCase()}.${partial?' '+partial+'.':''}`;
 const live=[lead,...(entries.length?entries.map(spokenEntry):['No assessments scheduled for this week.'])].join(' ');

 const view={
  index:position,count,datedCount,kind:spread.kind||(pending?'exam':'teaching'),partial:Boolean(spread.partial),pending,
  kicker:pending||spread.kind==='exam'?'EXAMS':'WEEK',numeral,of:String(datedCount),
  range:pending?'Date pending':spread.start===spread.end?shortDay(spread.start):`${shortDay(spread.start)} – ${shortDay(spread.end)}`,
  note:pending?(spread.label||'Exam · Date pending'):partial||NOTES[spread.kind]||'Teaching week',
  relative,days,entries,popups,more,
  title,name,aria,live,
  caption:{week:pending?'Exams':`Week ${position+1} of ${datedCount}`,relative:pending?'Date pending':sentenceCase(relative)},
  folio:{verso:pending?'EXAMS':`WK ${numeral}`,recto:pending?'Date pending':spread.start===spread.end?monthDay(spread.start):`${monthDay(spread.start)} – ${sameMonth(spread.start,spread.end)?dayOfMonth(spread.end):monthDay(spread.end)}`},
  empty:entries.length?null:'Nothing scheduled',
  moreLabel:more?`+${more} more on these pages`:null
 };
 view.signature=hash(JSON.stringify(view));
 return deepFreeze(view);
}

/**
 * Week commands for the ⌘K palette (Task F). `state` may be null (the Desk): no entries.
 * @returns {{index:number,label:string,keywords:string[],hint:string,selected:boolean,today:boolean}[]}
 */
export function paletteEntries(state,{now,weeks:override}={}){
 const list=state?.weeks??override??[];
 if(!Array.isArray(list)||!list.length)return [];
 const day=torontoDay(new Date(msOf(now))),selected=state?.snapshot?.().index,todayIndex=state?.today;
 return list.map((spread,position)=>{
  const index=Number.isInteger(spread.index)?spread.index:position,pending=Boolean(spread.pending)||!spread.start||!spread.end;
  const words=new Set();
  if(pending)for(const word of ['exam','exams','date pending'])words.add(word);
  else{
   const n=index+1;
   for(const word of [`week ${n}`,`wk ${n}`,`w${n}`,spread.start,spread.end,monthLong(spread.start).toLowerCase(),monthLong(spread.end).toLowerCase()])words.add(word);
   for(let date=spread.start;date<=spread.end;date=addDays(date,1))words.add(monthDay(date).toLowerCase());
  }
  words.add(relativeFor(spread,list,day).toLowerCase());
  for(const record of spread.records||[]){if(record.title)words.add(String(record.title).toLowerCase());if(record.kind)words.add(record.kind);}
  return {index,label:weekTitle(spread,index),keywords:[...words],hint:pending?'Date pending':`${shortDay(spread.start)} – ${shortDay(spread.end)}`,selected:index===selected,today:index===todayIndex};
 });
}

