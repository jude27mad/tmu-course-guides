import test from 'node:test';
import assert from 'node:assert/strict';
import {COURSES} from '../assets/course-data.mjs';
import {SCHEDULE} from '../assets/cen-schedule.mjs';
import {COURSE_IDS,keys,readSaved,resolveTarget,overall,parts,status,compact,targetDate} from '../assets/night/targets.mjs';
import {recordsForCourse,semesterWeeks,currentWeekIndex,termWeek} from '../assets/book/weeks.mjs';
import {timestamp,today} from '../assets/schedule.mjs';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const adapter=await import('../assets/desk/desk-data.mjs').catch(error=>{if(error.code==='ERR_MODULE_NOT_FOUND')return {};throw error;});
const data={cen100:SCHEDULE,mth140:COURSES.mth140,mth141:COURSES.mth141};
const noon=date=>timestamp(date,'12:00');
function store(values={}){
 const entries=new Map(Object.entries(values).map(([key,value])=>[key,typeof value==='string'?value:JSON.stringify(value)]));
 return {getItem:key=>entries.get(key)??null,setItem(){assert.fail('adapter must never write storage');},removeItem(){assert.fail('adapter must never remove storage');}};
}
function summary(options={}){
 assert.equal(typeof adapter.deskSummary,'function','Desk adapter exports deskSummary');
 return adapter.deskSummary({now:noon('2026-10-13'),storage:store(),...options});
}
const sectionSeeds={
 'cen100-contact-choice-v1':{section:29,group:9},'mth140-section-v1':31,'mth141-section-v1':31
};

test('all course targets and presentation fields agree with the existing Desk resolver across the term',()=>{
 for(const date of ['2026-09-07','2026-09-08','2026-10-13','2026-10-23','2026-11-01','2026-12-21','2026-12-22']){
  const now=noon(date),storage=store(sectionSeeds),result=summary({now,storage,data});
  assert.deepEqual(Object.keys(result),COURSE_IDS);
  for(const course of COURSE_IDS){
   const saved=readSaved(course,data[course],storage),target=resolveTarget({course,data:data[course],...saved,now});
   assert.deepEqual(result[course].next,{...target,status:status(target,now),compact:compact(target,now),targetDate:targetDate(target)});
   assert.equal(result[course].urgency,parts(target,now).state);
   assert.equal(result[course].course,course);assert.equal(result[course].now,now);
  }
  assert.equal(typeof adapter.deskOverall,'function');
  assert.equal(adapter.deskOverall(result,now),overall(COURSE_IDS.map(course=>result[course].next),now));
  assert.equal(adapter.deskOverall(result),adapter.deskOverall(result,now),'snapshot clock is the default');
 }
 const result=summary({storage:store(sectionSeeds)});
 assert.equal(result.cen100.next.id,'integrity');
 assert.equal(result.cen100.next.at,Date.parse('2026-10-14T19:00:00Z'));
 assert.equal(result.mth140.next.id,'quiz-2');
});

test('section labels exactly match the real Desk list and unsaved/invalid sections remain null',()=>{
 const result=summary({storage:store(sectionSeeds)});
 assert.equal(result.cen100.section,'Section 29');
 assert.equal(result.mth140.section,'Section 31 · Thu 4:00 PM lab · VIC106');
 assert.equal(result.mth141.section,'Section 31 · Thu 10:00 AM lab · POD367');
 const invalid=summary({storage:store({'cen100-contact-choice-v1':{section:40},'mth140-section-v1':900,'mth141-section-v1':'invalid'})});
 for(const course of COURSE_IDS)assert.equal(invalid[course].section,null);
});

test('progress uses strict saved completion records, excludes CEN reminders, and counts work for this Toronto week',()=>{
 const storage=store({...sectionSeeds,
  'cen100-personal-plan-v1':{completed:{intro:1,integrity:true,whmis:'true','failure-lab':1,'showcase-signup':true,'item:y9':1,unknown:1}},
  'mth140-progress-v1':{completed:{'quiz-1':1,'quiz-2':true,midterm:false,final:'true',unknown:true}},
  'mth141-progress-v1':{completed:{'quiz-1':true,midterm:1},checks:{'quiz-2':true},topics:{'quiz-3':true}}
 });
 const result=summary({storage});
 assert.deepEqual(result.cen100.progress,{completed:2,total:23,ratio:2/23,thisWeek:1});
 assert.deepEqual(result.mth140.progress,{completed:2,total:6,ratio:2/6,thisWeek:1});
 assert.deepEqual(result.mth141.progress,{completed:2,total:7,ratio:2/7,thisWeek:1});
 const outside=summary({storage,now:noon('2026-12-22')});
 for(const course of COURSE_IDS)assert.equal(outside[course].progress.thisWeek,0);
});

test('week numbers and book indices use Toronto boundaries, partial weeks, DST and the pending exam spread',()=>{
 for(const instant of ['2026-09-08T03:59:59Z','2026-09-08T04:00:00Z','2026-10-19T03:59:59Z','2026-10-19T04:00:00Z','2026-11-02T04:59:59Z','2026-11-02T05:00:00Z','2026-12-22T05:00:00Z']){
  const now=new Date(instant),storage=store(sectionSeeds),result=summary({now,storage});
  for(const course of COURSE_IDS){
   const saved=readSaved(course,data[course],storage);
   const records=recordsForCourse(course,{courseData:data[course],cenSchedule:SCHEDULE,...saved});
   assert.deepEqual(result[course].week,{termWeek:termWeek(today(now)),spreadIndex:currentWeekIndex(semesterWeeks({records}),now)});
  }
 }
 assert.equal(summary({now:new Date('2026-09-08T03:59:59Z')}).cen100.week.termWeek,null);
 assert.equal(summary({now:new Date('2026-09-08T04:00:00Z')}).cen100.week.termWeek,1);
});

test('upcoming landmark kinds use shared rank categories and exclude completed, past and reminder rows',()=>{
 const before=summary({now:noon('2026-09-08')});
 // The shared book mapping counts both the syllabus quiz and integrity quiz.
 assert.deepEqual(before.cen100.kinds,{final:3,midterm:1,quizLab:6,minor:13});
 assert.deepEqual(before.mth140.kinds,{final:1,midterm:1,quizLab:4,minor:0});
 assert.deepEqual(before.mth141.kinds,{final:1,midterm:1,quizLab:5,minor:0});
 const after=summary({now:noon('2026-12-22')});
 assert.deepEqual(after.cen100.kinds,{final:0,midterm:0,quizLab:0,minor:0});
 assert.deepEqual(after.mth140.kinds,{final:1,midterm:0,quizLab:0,minor:0});
 const finished=summary({now:noon('2026-09-08'),storage:store({'mth140-progress-v1':{completed:{'quiz-1':true,midterm:true,final:true}}})});
 assert.deepEqual(finished.mth140.kinds,{final:0,midterm:0,quizLab:3,minor:0});
});

test('denied, corrupt and stale storage yield no invented saved progress or sections and never write',()=>{
 const empty=summary({storage:null});
 const denied=summary({storage:{getItem(){throw new Error('SecurityError');}}});
 const corrupt=summary({storage:store(Object.fromEntries(COURSE_IDS.flatMap(course=>Object.values(keys(course)).map(key=>[key,'{broken']))))});
 const stale=summary({storage:store(Object.fromEntries(COURSE_IDS.flatMap(course=>Object.values(keys(course)).map(key=>[key,['old']]))))});
 for(const result of [denied,corrupt,stale])assert.deepEqual(result,empty);
 for(const course of COURSE_IDS){assert.equal(empty[course].progress.completed,0);assert.equal(empty[course].section,null);}
 assert.equal(empty.mth140.next.precision,'week');assert.match(empty.mth140.next.cta,/Choose section/);
});

test('only the overall exact hot target has an urgent spine; competing hot items remain static',()=>{
 const at=noon('2026-10-14')+3600000;
 const math=(course,time)=>({...data[course],assessments:[{...data[course].assessments.find(a=>a.id==='midterm'),date:'2026-10-14',time,end:'18:00'}]});
 const custom={cen100:[{id:'urgent',item:'y4',date:'2026-10-14',time:'15:00',title:'CEN work due'}],mth140:math('mth140','14:30'),mth141:math('mth141','16:00')};
 const result=summary({now:at,data:custom});
 assert.equal(typeof adapter.spineState,'function');
 assert.equal(adapter.deskOverall(result,at).course,'mth140');
 assert.deepEqual(COURSE_IDS.map(course=>adapter.spineState(result[course]).glow),['static','urgent','static']);
 assert.equal(adapter.spineState(result.mth140).label,`${result.mth140.next.title} · ${result.mth140.next.compact}`);
 const repeat=summary({now:at,data:custom});assert.deepEqual(repeat,result);
 const sixHours=summary({now:at-4.5*3600000,data:custom});
 assert.equal(sixHours.mth140.urgency,'soon');assert.equal(adapter.spineState(sixHours.mth140).glow,'static','six hours exactly is not hot');
});

test('day-only, week, pending, live, passed and empty targets never receive an urgent pulse',()=>{
 const mathEmpty={...COURSES.mth140,assessments:[]};
 const cases=[
  {records:[{id:'review',item:'m4',date:'2026-10-14',title:'Review'}],now:noon('2026-10-14'),urgency:'hot',glow:'static'},
  {records:[{id:'integrity',item:'y4',date:'2026-10-14',time:'15:00',title:'Quiz due'}],now:timestamp('2026-10-14','15:00'),urgency:'live',glow:'static'},
  {records:[],now:noon('2026-10-14'),urgency:'empty',glow:'none'}
 ];
 for(const c of cases){const result=summary({now:c.now,data:{cen100:c.records,mth140:mathEmpty,mth141:{...COURSES.mth141,assessments:[]}}});assert.equal(result.cen100.urgency,c.urgency);assert.equal(adapter.spineState(result.cen100).glow,c.glow);}
 const week=summary();assert.equal(week.mth140.urgency,'week');assert.equal(adapter.spineState(week.mth140).glow,'static');
 const pending=summary({now:noon('2026-12-22')});assert.equal(pending.mth140.urgency,'pending');assert.equal(adapter.spineState(pending.mth140).glow,'static');
 const passed=summary({now:timestamp('2026-10-15','19:00'),storage:store({'mth140-section-v1':31})});
 assert.equal(passed.mth140.urgency,'passed');assert.equal(adapter.spineState(passed.mth140).glow,'static');
});

test('empty injected data and all completed counted records are honest, with no mutation or extra source assumptions',()=>{
 const none=summary({data:{}});assert.equal(adapter.deskOverall(none),null);
 for(const course of COURSE_IDS){assert.equal(none[course].next,null);assert.deepEqual(none[course].progress,{completed:0,total:0,ratio:0,thisWeek:0});assert.deepEqual(adapter.spineState(none[course]),{glow:'none',label:'Nothing scheduled'});}
 const values={};
 for(const course of COURSE_IDS)values[keys(course).progress]={completed:Object.fromEntries((course==='cen100'?SCHEDULE.filter(r=>r.calendar!==false):data[course].assessments).map(r=>[r.id,true]))};
 const snapshot=JSON.stringify(data),finished=summary({storage:store(values)});
 for(const course of COURSE_IDS){assert.equal(finished[course].progress.ratio,1);assert.equal(finished[course].next.precision,'empty');assert.equal(adapter.spineState(finished[course]).glow,'none');}
 assert.equal(adapter.deskOverall(finished),null);assert.equal(JSON.stringify(data),snapshot);
});

test('snapshots do not mutate frozen data, saved state, clocks or other snapshots',()=>{
 const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
 const input=freeze(structuredClone(data)),now=new Date('2026-10-14T17:00:00Z'),storage=store(sectionSeeds),savedTime=+now;
 const result=summary({data:input,now,storage}),copy=structuredClone(result);
 const winner=adapter.deskOverall(result,now);for(const course of COURSE_IDS)adapter.spineState(result[course]);
 assert.deepEqual(result,copy);assert.equal(+now,savedTime);assert.equal(winner.course,'cen100');
 const future=summary({data:input,now:noon('2026-12-22'),storage});
 assert.equal(future.mth140.next.precision,'pending');assert.deepEqual(result,copy,'later clocks have no shared winner or target state');
});

test('holiday uncertainty, Monday make-up dates and sectionless quizzes retain authoritative precision',()=>{
 const result=summary({storage:store({'mth140-section-v1':2,'mth141-section-v1':2}),now:noon('2026-10-12')});
 assert.equal(result.mth140.next.precision,'exact','MTH140 Monday make-up is confirmed');
 assert.match(result.mth140.next.when,/Oct 19/);
 assert.equal(result.mth140.next.targetDate,'2026-10-19');
 // MTH141 quiz weeks do not land on Thanksgiving; a synthetic real-format
 // October quiz pins the shared resolver's unconfirmed holiday behavior.
 const holidayData={...data,mth141:{...COURSES.mth141,assessments:[{...COURSES.mth141.assessments[0],week:'2026-10-12'}]}};
 const holiday=summary({data:holidayData,storage:store({'mth141-section-v1':13}),now:noon('2026-10-12')});
 assert.equal(holiday.mth141.next.holiday,true);assert.equal(holiday.mth141.urgency,'week');
 assert.equal(holiday.mth141.next.status,'Holiday schedule unconfirmed');assert.equal(holiday.mth141.next.targetDate,null);
 assert.equal(adapter.spineState(holiday.mth141).glow,'static');
});

test('actual Desk list rendering agrees with adapter targets, chips, sections and the overall winner',async()=>{
 const require=createRequire(import.meta.url),{createGuide,until}=require('../tools/ui-build/module-harness.cjs');
 const root=fileURLToPath(new URL('..',import.meta.url)),now=noon('2026-10-13');
 const seeds=[sectionSeeds,{...sectionSeeds,'cen100-personal-plan-v1':{completed:{integrity:1}},'mth140-progress-v1':{completed:{'quiz-2':true}}},{}];
 for(const values of seeds){
  const result=summary({now,storage:store(values)});
  const {dom,errors}=await createGuide({root,motion:'off',beforeParse(w){
   for(const [key,value] of Object.entries(values))w.localStorage.setItem(key,typeof value==='string'?value:JSON.stringify(value));
   const NativeDate=w.Date;w.Date=class extends NativeDate{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}};
  }});
  try{
   const d=dom.window.document;
   await until(()=>[...d.querySelectorAll('[data-desk-next]')].every(node=>!node.hidden),'Desk list did not resolve');
   assert.deepEqual(errors,[]);assert.equal(dom.window.CourseWorkspace,undefined,'Desk does not mount hidden course workspaces');
   for(const course of COURSE_IDS){
    const card=d.querySelector(`[data-course-card="${course}"]`),row=result[course],target=row.next;
    assert.equal(card.querySelector('.desk-course-title').textContent,target.title);
    assert.equal(card.querySelector('.desk-course-when').textContent,target.when);
    assert.equal(card.querySelector('.desk-chip').textContent,target.precision==='exact'&&parts(target,now).ms>0?target.compact+' left':target.compact);
    assert.equal(card.querySelector('[data-desk-next]').dataset.precision,target.precision);
    if(!target.cta)assert.equal(card.querySelector('.desk-course-section').textContent,row.section||'No section saved');
   }
   const winner=adapter.deskOverall(result,now);
   assert.equal(d.querySelector('[data-desk-overall]').dataset.deskCourse,winner.course);
   assert.equal(d.querySelector('.desk-next-title').textContent,winner.title);
  }finally{dom.window.close();}
 }
});
