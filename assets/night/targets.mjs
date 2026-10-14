/* Night Shift deadline resolver, data level. One rule set feeds the course card, dock, HUD and the Desk.
   Pure functions over the unchanged course records (CEN100 SCHEDULE, COURSES[course]), a saved section,
   completion records and an explicit clock: no DOM and no storage writes, so the Desk resolves all three
   courses without loading a course page or workspace. Toronto conversion comes from schedule.mjs only. */
import {timestamp,clock,dateLabel,dayLabel,today,daysUntil,resolveAssessment,upcoming,timing,addDays} from '../schedule.mjs';

export const COURSE_IDS=['cen100','mth140','mth141'];
export const GRACE=2*3600e3,WINDOW=14*86400000;
const ms=now=>now==null?Date.now():+now;
const short=d=>`${dayLabel(d).slice(0,3)} ${dateLabel(d)}`;
const isRecord=v=>!!v&&typeof v==='object'&&!Array.isArray(v);

/* Shared records. The CEN guide already holds the one schedule array, so reuse it there. course-data uses the
   math guide's own URL so a math page keeps a single module instance. */
export function loadData(course){
 if(course==='cen100')return globalThis.CEN_SCHEDULE?Promise.resolve(globalThis.CEN_SCHEDULE):import('../cen-schedule.mjs?v=20261013-shift1').then(m=>m.SCHEDULE);
 return import('../course-data.mjs?v=20261012-assessments2').then(m=>m.COURSES[course]);
}

/* ---- Saved state: read-only. Denied storage, corrupt JSON or a stale value read as "nothing saved"; nothing
   here writes, renames or normalizes a key, so the guides' own records stay exactly as they left them. ---- */
export const keys=course=>course==='cen100'?{section:'cen100-contact-choice-v1',progress:'cen100-personal-plan-v1'}:{section:course+'-section-v1',progress:course+'-progress-v1'};
const store=()=>{try{return globalThis.localStorage??null}catch{return null}};
function readJSON(storage,key){try{const raw=storage?.getItem(key);return raw==null?null:JSON.parse(raw);}catch{return null}}
// CEN validProfile(): sections 1–39. Math: only a section that has a lab, as math-guide.mjs.
const cenSection=n=>Number.isInteger(n)&&n>=1&&n<=39?n:0;
const mathSection=(data,n)=>data.labs.some(l=>l.section===n)?n:0;
// CEN cleanPlan(): only dated calendar rows are completion records, as 1 or true. (item:<id> records belong to
// undated items, which never affect a deadline.) Math cleanProgress(): assessment ids, as true or 1.
export function cenCompleted(schedule,entries){const out={};if(isRecord(entries))for(const e of schedule)if(e.calendar!==false&&(entries[e.id]===1||entries[e.id]===true))out[e.id]=1;return out;}
export function mathCompleted(data,entries){const out={};if(isRecord(entries))for(const a of data.assessments)if(entries[a.id]===true||entries[a.id]===1)out[a.id]=true;return out;}
export function readSection(course,data,storage=store()){
 const saved=readJSON(storage,keys(course).section);
 return course==='cen100'?cenSection(saved&&typeof saved==='object'?Number(saved.section):0):mathSection(data,Number(saved??0));
}
export function readCompleted(course,data,storage=store()){
 const saved=readJSON(storage,keys(course).progress),entries=isRecord(saved)?saved.completed:null;
 return course==='cen100'?cenCompleted(data,entries):mathCompleted(data,entries);
}
export const readSaved=(course,data,storage=store())=>({section:readSection(course,data,storage),completed:readCompleted(course,data,storage)});

/* ---- CEN100: cen100/index.html eventPassed, sortEvents, itemDeadlines and upcomingSchedule, unchanged ---- */
// A timed row passes at its Toronto time; a date-only row stays eligible for its whole Toronto day.
const cenPassed=(e,now,day)=>e.time?timestamp(e.date,e.time)<now:e.date<day;
// "23:59" orders rows without a published time last in their day. A sort key only: it is never displayed.
const cenSort=(a,b)=>(a.date+(a.time||'23:59')).localeCompare(b.date+(b.time||'23:59'))||a.id.localeCompare(b.id);
export function cenUpcoming(schedule,completed={},section=0,now=Date.now()){
 now=ms(now);
 const day=today(new Date(now)),rows=item=>schedule.filter(e=>e.item===item&&e.calendar!==false);
 return schedule.filter(e=>{
  if(cenPassed(e,now,day)||(e.section&&e.section!==section)||completed[e.id])return false;
  // A calendar:false reminder retires once every dated row of its item is recorded done.
  if(e.calendar===false){const own=rows(e.item);if(own.length&&own.every(r=>completed[r.id]))return false;}
  return true;
 }).sort(cenSort);
}
function describeCen(e){
 const base={course:'cen100',id:e.id,title:e.title.replace(/ due$/,''),kind:'assignment',open:e.item};
 if(e.time)return {...base,precision:'exact',at:timestamp(e.date,e.time),when:`${short(e.date)} · ${clock(e.time)} Toronto`,label:'Due'};
 // A submission with a date and no posted time is due by the end of its Toronto day (the owner's rule, 13 Oct 2026),
 // so it counts down to the end of that day: Toronto midnight, which keeps the whole 11:59 PM minute open.
 // Dated in-class events (presentations, reviews) keep their date only.
 if(/ due$/.test(e.title))return {...base,precision:'exact',endOfDay:true,at:timestamp(addDays(e.date,1),'00:00'),when:`${short(e.date)} · by 11:59 PM Toronto`,label:'Due by end of day'};
 return {...base,precision:'day',date:e.date,when:short(e.date),label:'Time not posted · check D2L'};
}

/* ---- Math: schedule.mjs upcoming() over COURSES[course] with the saved lab section ---- */
function describeMath(course,data,a,section){
 const e=resolveAssessment(data,a,section),base={course,id:a.id,title:a.title,kind:a.kind,open:'assessment-'+a.id};
 // Thanksgiving with no announced make-up: keep the warning; the normal lab slot is not a confirmed quiz time.
 if(e.holiday)return {...base,precision:'week',holiday:true,week:e.week,weekEnd:e.weekEnd,when:timing(e),label:'Quiz date needs confirmation'};
 if(a.kind==='quiz'&&e.date&&e.lab){
  const note=e.rescheduled?`Monday make-up date confirmed for ${dateLabel(e.date)} on D2L. Check for changes.`:'Quiz day follows your section’s lab timetable. Check D2L for changes.';
  // The weekday alone is not a start time: without a published lab start the quiz has a day, never a countdown.
  if(!e.lab.start)return {...base,precision:'day',date:e.date,when:`${short(e.date)}${e.lab.room?` · ${e.lab.room}`:''}`,label:'Time not posted',note};
  return {...base,precision:'exact',at:timestamp(e.date,e.lab.start),end:e.lab.end?timestamp(e.date,e.lab.end):null,
   when:`${short(e.date)} · ${clock(e.lab.start)}${e.lab.room?` · ${e.lab.room}`:''}`,
   // A second-hour quiz counts down to the lab and says so, rather than inventing a quiz start time.
   label:a.quizSecondHour?'Your lab starts · quiz in its second hour':'Your lab quiz starts',note};
 }
 if(a.kind==='quiz'){
  const end=dateLabel(e.weekEnd),sameMonth=e.week.slice(0,7)===e.weekEnd.slice(0,7);
  return {...base,precision:'week',week:e.week,weekEnd:e.weekEnd,range:`${dateLabel(e.week)}–${sameMonth?end.replace(/^\S+ /,''):end}`,when:`${dateLabel(e.week)}–${end} · during your assigned lab`,label:'Quiz week',cta:'Choose section for quiz date'};
 }
 if(e.date&&e.time)return {...base,precision:'exact',at:timestamp(e.date,e.time),end:e.end?timestamp(e.date,e.end):null,when:`${short(e.date)} · ${clock(e.time)} Toronto`,label:a.kind==='midterm'?'Test starts':'Starts'};
 if(e.date)return {...base,precision:'day',date:e.date,when:short(e.date),label:'Time not posted'};
 return {...base,precision:'pending',when:'Date pending',label:'Awaiting the official schedule'};
}

/* Nothing left to feature: say so, never invent a deadline. */
const empty=course=>({course,id:null,title:course==='cen100'?'No upcoming deadlines':'No dated assessment ahead',kind:null,open:null,precision:'empty',when:'Nothing dated is left in your records',label:'Nothing scheduled'});

/* The next target for one course, in the shape every surface uses:
   {course,id,title,kind,open,precision:'exact'|'day'|'week'|'pending'|'empty',at,end,date,week,weekEnd,range,when,label,cta,note}.
   `id` (optional) describes that record instead of choosing: a course page passes the item its own card shows,
   so the countdown inside the card always names the same assessment. */
export function resolveTarget({course,data,section=0,completed={},now=Date.now(),id=null}={}){
 if(!data)return null;
 now=ms(now);
 if(course==='cen100'){
  const done=cenCompleted(data,completed);
  const e=(id&&data.find(x=>x.id===id))||cenUpcoming(data,done,cenSection(Number(section)),now)[0];
  return e?describeCen(e):empty(course);
 }
 const done=mathCompleted(data,completed),sec=mathSection(data,Number(section)),find=x=>data.assessments.find(a=>a.id===x);
 // upcoming() never lists an undated final; once nothing dated is left, an open final is the honest next item.
 const a=(id&&find(id))||find(upcoming(data,sec,done,new Date(now))[0]?.id)||data.assessments.find(x=>x.kind==='final'&&!x.date&&!done[x.id]);
 return a?describeMath(course,data,a,sec):empty(course);
}

/* ---- Across courses (the Desk) ----
   Order by the earliest moment each target could fall due. Exact: its start; an ended one keeps its place for
   GRACE after it ends, then yields to upcoming work (it stays in its own course). A date without a time: the end
   of that Toronto day, the CEN guide's own ordering. A quiz week: its Monday, since the quiz may be that day.
   Pending: after everything dated. Empty never competes. Ties keep course order. Only an exact result may
   carry a timer; the others keep their own uncertainty labels. */
export function dueKey(t,now=Date.now()){
 now=ms(now);
 if(!t||t.precision==='empty')return null;
 if(t.precision==='exact')return [(t.end??t.at)+GRACE<now?1:0,t.at];
 if(t.precision==='day')return [0,timestamp(t.date,'23:59')];
 if(t.precision==='week'&&t.week)return [0,timestamp(t.week,'00:00')];
 return [2,0];
}
export function overall(targets,now=Date.now()){
 return targets.map((t,i)=>({t,i,k:dueKey(t,now)})).filter(x=>x.k).sort((a,b)=>a.k[0]-b.k[0]||a.k[1]-b.k[1]||a.i-b.i)[0]?.t??null;
}

/* ---- Presentation helpers, pure so every surface agrees (deadline.mjs re-exports them) ---- */
export function parts(t,now=Date.now()){
 if(!t)return null;
 now=ms(now);
 if(t.precision==='exact'){
  const left=t.at-now;
  // The exact instant itself is "happening"; after it, only a known start/end window keeps an event live.
  if(left<=0)return {state:left===0||(t.end&&now<t.end)?'live':'passed',ms:0};
  const s=Math.floor(left/1000);
  return {state:left<6*3600e3?'hot':left<48*3600e3?'soon':'ahead',ms:left,d:Math.floor(s/86400),h:Math.floor(s%86400/3600),m:Math.floor(s%3600/60),s:s%60,progress:Math.max(0,Math.min(1,left/WINDOW))};
 }
 if(t.precision==='day'){
  const days=daysUntil(t.date,new Date(now)); // Toronto calendar days
  return {state:days<0?'passed':days===0?'hot':days<=2?'soon':'ahead',days,progress:Math.max(0,Math.min(1,days*86400000/WINDOW))};
 }
 return {state:t.precision};
}
export function compact(t,now=Date.now()){
 const p=parts(t,now);if(!p)return '';
 if(t.precision==='exact'){if(p.state==='live')return 'Happening now';if(p.state==='passed')return 'Due time passed';return p.d?`${p.d}d ${p.h}h`:p.h?`${p.h}h ${String(p.m).padStart(2,'0')}m`:`${p.m}m`;}
 if(t.precision==='day')return p.days<0?status(t,now):p.days===0?'Today':p.days===1?'Tomorrow':`In ${p.days} days`;
 if(t.precision==='week')return t.holiday?status(t,now):'Quiz week';
 if(t.precision==='empty')return 'Nothing scheduled';
 return 'Date pending';
}
/* The status label for every state without a running countdown, null while one runs. Contract and fixtures:
   docs/qa/toronto-deadline-test-cases.md. Exact: the instant itself is "Happening now", then "Due time passed"
   (a known end keeps it live until then). A date without a time is "Time not posted" through its Toronto day and
   "Date passed (time not posted)" from the next Toronto midnight; no time is ever invented. A quiz week waits for
   a lab section, or for a holiday make-up announcement. compact() shows these where a chip has no better words. */
export function status(t,now=Date.now()){
 if(!t)return null;
 now=ms(now);
 if(t.precision==='exact'){const left=t.at-now;return left>0?null:left===0||(t.end&&now<t.end)?'Happening now':'Due time passed';}
 if(t.precision==='day')return daysUntil(t.date,new Date(now))<0?'Date passed (time not posted)':'Time not posted';
 if(t.precision==='week')return t.holiday?'Holiday schedule unconfirmed':'Select lab section';
 if(t.precision==='empty')return 'Nothing scheduled';
 return 'Date pending';
}
/* The Toronto calendar date a target falls on, or null while it is unresolved (quiz week, pending, empty). */
export function targetDate(t){
 if(!t)return null;
 if(t.precision==='exact')return today(new Date(t.endOfDay?t.at-1:t.at)); // end-of-day dues count to the next midnight
 return t.precision==='day'?t.date:null;
}
/* One sentence for a polite live region (updated at most once a minute by its owner). */
export function sentence(t,now=Date.now()){
 const p=parts(t,now);if(!p)return '';
 if(t.precision==='exact'&&p.ms)return `${p.d?`${p.d} days and ${p.h} hours`:`${p.h} hours and ${p.m} minutes`} remaining until ${t.title}. ${t.when}.`;
 return `${t.title}: ${compact(t,now)}. ${t.when}.`;
}
