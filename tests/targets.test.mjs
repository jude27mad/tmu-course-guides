import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {SCHEDULE} from '../assets/cen-schedule.mjs';
import {COURSES} from '../assets/course-data.mjs';
import {timestamp,addDays} from '../assets/schedule.mjs';
import {resolveTarget,cenUpcoming,cenCompleted,readSection,readCompleted,readSaved,keys,parts,compact,overall,GRACE,targetDate} from '../assets/night/targets.mjs';

/* Frozen clocks only: every case passes an explicit `now`. Records are the real ones; the two derived record
   sets below are marked and exist only to exercise a rule the real Fall 2026 data never triggers. */
const at=(iso)=>Date.parse(iso);
const toronto=(date,time)=>timestamp(date,time);
const MTH140=COURSES.mth140,MTH141=COURSES.mth141;
const cen=(now,section=0,completed={})=>resolveTarget({course:'cen100',data:SCHEDULE,section,completed,now});
const math=(course,now,section=0,completed={})=>resolveTarget({course,data:COURSES[course],section,completed,now});
const NOON_OCT12=toronto('2026-10-12','12:00');

test('CEN Academic Integrity quiz resolves to Oct 14, 3:00 PM Toronto, exact',()=>{
  const t=cen(NOON_OCT12);
  assert.equal(t.id,'integrity');assert.equal(t.open,'y4');assert.equal(t.title,'Academic Integrity Quiz');
  assert.equal(t.precision,'exact');assert.equal(t.at,at('2026-10-14T19:00:00Z'));assert.equal(t.at,toronto('2026-10-14','15:00'));
  assert.equal(t.when,'Wed Oct 14 · 3:00 PM Toronto');assert.equal(t.label,'Due');
  assert.equal(compact(t,NOON_OCT12),'2d 3h');
});

test('MTH140 midterm resolves to Oct 23, 6:30 PM Toronto, with its end',()=>{
  const t=math('mth140',NOON_OCT12,31,{'quiz-2':true});
  assert.equal(t.id,'midterm');assert.equal(t.precision,'exact');
  assert.equal(t.at,at('2026-10-23T22:30:00Z'));assert.equal(t.end,at('2026-10-24T00:30:00Z'));
  assert.equal(t.when,'Fri Oct 23 · 6:30 PM Toronto');assert.equal(t.label,'Test starts');assert.equal(t.open,'assessment-midterm');
});

test('a quiz week without a section: week precision, the section CTA and no timer',()=>{
  const t=math('mth140',NOON_OCT12);
  assert.equal(t.id,'quiz-2');assert.equal(t.precision,'week');
  assert.equal(t.cta,'Choose section for quiz date');assert.equal(t.label,'Quiz week');
  assert.equal(t.range,'Oct 12–16');assert.equal(t.week,'2026-10-12');assert.equal(t.weekEnd,'2026-10-16');
  assert.equal(t.at,undefined);assert.equal(parts(t,NOON_OCT12).ms,undefined);assert.equal(compact(t,NOON_OCT12),'Quiz week');
  // A week that crosses a month keeps both month names.
  const late=math('mth141',toronto('2026-11-25','12:00'),0,{});
  assert.equal(late.id,'quiz-5');assert.equal(late.range,'Nov 30–Dec 4');
});

test('a quiz week with a saved section: exact lab start, the lab room and the timetable caveat',()=>{
  const t=math('mth141',toronto('2026-10-20','12:00'),3,{});
  assert.equal(t.id,'quiz-3');assert.equal(t.precision,'exact');
  // Wednesday 3:00–4:00 PM in POD367; Nov 4 is after the DST change, so Toronto is UTC−5.
  assert.equal(t.at,at('2026-11-04T20:00:00Z'));assert.equal(t.end,at('2026-11-04T21:00:00Z'));
  assert.equal(t.when,'Wed Nov 4 · 3:00 PM · POD367');assert.equal(t.label,'Your lab quiz starts');
  assert.match(t.note,/lab timetable/);assert.equal(t.cta,undefined);
  // MTH140 quiz 2 runs in the second hour of the lab: the countdown is the lab start and the label says so.
  const second=math('mth140',NOON_OCT12,31);
  assert.equal(second.id,'quiz-2');assert.equal(second.at,toronto('2026-10-15','16:00'));
  assert.equal(second.when,'Thu Oct 15 · 4:00 PM · VIC106');assert.match(second.label,/lab starts.*second hour/);
});

test('Thanksgiving: the announced Monday make-up is exact; without one the date needs confirmation',()=>{
  const makeup=math('mth140',NOON_OCT12,2);
  assert.equal(makeup.precision,'exact');assert.equal(makeup.at,toronto('2026-10-19','10:00'));assert.match(makeup.note,/make-up date confirmed for Oct 19 on D2L/);
  // Derived records: the same quiz without its announced make-up, to exercise the holiday rule.
  const noMakeup={...MTH140,assessments:MTH140.assessments.map(a=>a.id==='quiz-2'?{...a,mondayMakeupDate:undefined}:a)};
  const t=resolveTarget({course:'mth140',data:noMakeup,section:2,completed:{},now:NOON_OCT12});
  assert.equal(t.id,'quiz-2');assert.equal(t.precision,'week');assert.equal(t.label,'Quiz date needs confirmation');
  assert.match(t.when,/Thanksgiving; quiz date needs confirmation/);assert.equal(t.at,undefined);
});

// Owner's rule (13 Oct 2026): a CEN submission with a date and no posted time is due by the end of that Toronto day.
test('a dated submission without a time counts down to 11:59 PM Toronto; a dated in-class event keeps its date only',()=>{
  const t=cen(NOON_OCT12,0,{integrity:1});
  assert.equal(t.id,'whmis');assert.equal(t.precision,'exact');assert.equal(t.at,toronto('2026-10-15','00:00'));assert.equal(t.at,at('2026-10-15T04:00:00Z'));
  assert.equal(t.when,'Wed Oct 14 · by 11:59 PM Toronto');assert.equal(t.label,'Due by end of day');
  assert.equal(compact(t,NOON_OCT12),'2d 12h');
  for(const e of SCHEDULE){
    const d=resolveTarget({course:'cen100',data:SCHEDULE,id:e.id,now:NOON_OCT12});
    if(e.time)assert.equal(d.precision,'exact',e.id);
    else if(/ due$/.test(e.title)){assert.equal(d.precision,'exact',e.id);assert.equal(d.at,toronto(addDays(e.date,1),'00:00'),e.id);assert.equal(targetDate(d),e.date,`${e.id}: dated on its due day, not the midnight after`);assert.equal(d.label,'Due by end of day',e.id);assert.equal(d.when.endsWith('by 11:59 PM Toronto'),true,e.id);}
    // Presentations, reviews and lab reminders happen in class: no invented time.
    else{assert.equal(d.precision,'day',e.id);assert.equal(d.label,'Time not posted · check D2L',e.id);assert.doesNotMatch(d.when+d.label,/\d:\d\d|11:59/,e.id);}
  }
  // The one published 23:59 deadline is real data and keeps its time.
  assert.equal(resolveTarget({course:'cen100',data:SCHEDULE,id:'report',now:NOON_OCT12}).when,'Wed Dec 2 · 11:59 PM Toronto');
});

test('an undated final is pending once nothing dated is left; with nothing open the state is honestly empty',()=>{
  const dated=Object.fromEntries(MTH140.assessments.filter(a=>a.date||a.week).map(a=>[a.id,true]));
  const t=math('mth140',NOON_OCT12,31,dated);
  assert.equal(t.id,'final');assert.equal(t.precision,'pending');assert.equal(t.when,'Date pending');assert.equal(t.at,undefined);
  assert.equal(compact(t),'Date pending');
  assert.equal(math('mth141',toronto('2026-12-22','09:00'),5).precision,'pending');
  const all=math('mth140',NOON_OCT12,31,{...dated,final:true});
  assert.equal(all.precision,'empty');assert.equal(all.id,null);assert.equal(all.at,undefined);assert.equal(compact(all),'Nothing scheduled');
  const cenDone=cen(toronto('2026-12-03','00:00'),29);
  assert.equal(cenDone.precision,'empty');assert.equal(cenDone.title,'No upcoming deadlines');
});

test('completed items are skipped, including reminders whose item is fully recorded',()=>{
  assert.equal(math('mth141',at('2026-10-07T16:00:00Z'),3,{}).id,'quiz-2');
  assert.equal(math('mth141',at('2026-10-07T16:00:00Z'),3,{'quiz-2':true}).id,'midterm');
  assert.equal(cen(NOON_OCT12,29).id,'integrity');
  assert.equal(cen(NOON_OCT12,29,{integrity:1}).id,'failure-lab');
  assert.equal(cen(NOON_OCT12,29,{integrity:1,failure:1,'failure-2':1}).id,'whmis','calendar:false reminder retires with its item');
  // cleanPlan(): a calendar:false row is not a completion key, so recording it changes nothing.
  assert.equal(cen(NOON_OCT12,29,{integrity:1,'failure-lab':1}).id,'failure-lab');
  // Values other than 1/true are not completions.
  assert.equal(cen(NOON_OCT12,0,{integrity:0}).id,'integrity');
  assert.equal(math('mth140',NOON_OCT12,31,{'quiz-2':'yes'}).id,'quiz-2');
});

test('an event in progress is never skipped just because two hours passed',()=>{
  const live=at('2026-10-24T00:29:00Z'); // 8:29 PM Toronto, 1 h 59 min into the midterm
  const t=math('mth140',live,31,{'quiz-2':true});
  assert.equal(t.id,'midterm');assert.equal(parts(t,live).state,'live');assert.equal(compact(t,live),'Happening now');
  const after=at('2026-10-24T00:31:00Z');
  assert.equal(math('mth140',after,31,{'quiz-2':true}).id,'quiz-3');
  // Derived record: a three-hour sitting. At 2 h 30 min it is still the target and still live.
  const long={...MTH140,assessments:MTH140.assessments.map(a=>a.id==='final'?{...a,date:'2026-12-14',time:'09:00',end:'12:00'}:a)};
  const done=Object.fromEntries(MTH140.assessments.filter(a=>a.id!=='final').map(a=>[a.id,true]));
  const now=toronto('2026-12-14','11:30'),final=resolveTarget({course:'mth140',data:long,section:31,completed:done,now});
  assert.equal(final.id,'final');assert.ok(now>final.at+GRACE);assert.equal(parts(final,now).state,'live');
  // A lab quiz stays the course target until the end of its Toronto day, as the guide shows it.
  const labEnded=toronto('2026-10-15','19:00');
  const quiz=math('mth140',labEnded,31);assert.equal(quiz.id,'quiz-2');assert.equal(compact(quiz,labEnded),'Due time passed');
});

test('Toronto/UTC date boundaries decide eligibility and day counts',()=>{
  // 11:30 PM Toronto on Oct 14 is already Oct 15 in UTC: the dated WHMIS submission is still due, by 11:59 PM Toronto.
  const late=at('2026-10-15T03:30:00Z'),t=cen(late);
  assert.equal(t.id,'whmis');assert.equal(compact(t,late),'30m');
  assert.equal(cen(at('2026-10-15T04:00:00Z')).id,'failure','midnight Toronto ends the day');
  // A week-only quiz is open through Friday in Toronto.
  assert.equal(math('mth140',at('2026-10-17T03:59:00Z')).id,'quiz-2');
  assert.equal(math('mth140',at('2026-10-17T04:00:00Z')).id,'midterm');
  // Day counts use Toronto calendar days: 10 PM Nov 1 Toronto is Nov 2 UTC, still three days before the Nov 4 review.
  const review=resolveTarget({course:'cen100',data:SCHEDULE,id:'review',now:at('2026-11-02T03:00:00Z')});
  assert.equal(review.precision,'day');assert.equal(compact(review,at('2026-11-02T03:00:00Z')),'In 3 days');
  // Timed CEN rows pass at their Toronto time with no grace.
  assert.equal(cen(toronto('2026-10-14','14:59')).id,'integrity');
  assert.equal(cen(toronto('2026-10-14','15:00')+1).id,'whmis');
});

test('the CEN rules are the guide page’s own upcomingSchedule, case for case',()=>{
  // Evaluate the route guide's unchanged functions against the same shared records.
  const guide=readFileSync(new URL('../assets/cen-guide.mjs',import.meta.url),'utf8');
  const slice=(from,to)=>guide.slice(guide.indexOf(from),guide.indexOf(to));
  const source=slice('function torontoToday(','function torontoUTC(')+slice('function eventPassed(','function clockLabel(')+slice('function upcomingSchedule(','function headUrgency(');
  // Formatters are stateless; caching them only keeps the page's own functions fast across thousands of clocks.
  const formats=new Map(),DateTimeFormat=function(locale,options){const k=JSON.stringify([locale,options]);if(!formats.has(k))formats.set(k,new Intl.DateTimeFormat(locale,options));return formats.get(k);};
  const page=vm.runInNewContext(source+';({upcomingSchedule})',{SCHEDULE,Intl:{DateTimeFormat}});
  const completions=[{},{integrity:1},{integrity:1,failure:1},{whmis:1,'matlab-1':1,'failure-lab':1},Object.fromEntries(SCHEDULE.map(e=>[e.id,1]))];
  const clocks=[];
  for(let t=toronto('2026-09-08','00:00');t<toronto('2026-12-04','00:00');t+=23*3600e3+17*60e3)clocks.push(t);
  for(const e of SCHEDULE){const edge=e.time?toronto(e.date,e.time):toronto(e.date,'00:00')+86400e3;clocks.push(edge-1,edge,edge+1);}
  let cases=0;
  for(const now of clocks)for(const section of [0,29])for(const completed of completions){
    // The page always passes cleanPlan() records; the resolver cleans raw records itself.
    const clean=cenCompleted(SCHEDULE,completed),expected=page.upcomingSchedule(clean,section,new Date(now))[0]?.id??null;
    assert.equal(cenUpcoming(SCHEDULE,completed,section,now)[0]?.id??null,page.upcomingSchedule(completed,section,new Date(now))[0]?.id??null);
    assert.equal(cen(now,section,completed).id,expected,new Date(now).toISOString()+' s'+section);
    cases++;
  }
  assert.ok(cases>1500);
});

test('readers are non-destructive on denied, missing and corrupt storage',()=>{
  const memory=(values)=>{const calls=[];return {calls,getItem:k=>{calls.push(['get',k]);return k in values?values[k]:null},setItem:k=>calls.push(['set',k]),removeItem:k=>calls.push(['remove',k])};};
  const good=memory({'cen100-contact-choice-v1':'{"section":29,"group":9}','cen100-personal-plan-v1':'{"completed":{"integrity":1,"failure-lab":1,"item:y7":1,"email":true,"whmis":0,"bogus":1},"notes":{"y4":"n"}}','mth140-section-v1':'31','mth140-progress-v1':'{"completed":{"quiz-1":true,"quiz-2":1,"midterm":"yes","bogus":true}}','mth141-section-v1':'"7"'});
  assert.deepEqual(readSaved('cen100',SCHEDULE,good),{section:29,completed:{integrity:1,email:1}});
  assert.deepEqual(readSaved('mth140',MTH140,good),{section:31,completed:{'quiz-1':true,'quiz-2':true}});
  assert.equal(readSection('mth141',MTH141,good),7);
  assert.ok(good.calls.every(([kind])=>kind==='get'),'never writes or removes');
  const bad=memory({'cen100-contact-choice-v1':'{"section":40}','cen100-personal-plan-v1':'{oops','mth140-section-v1':'99','mth140-progress-v1':'[1,2]','mth141-section-v1':'not json'});
  assert.deepEqual(readSaved('cen100',SCHEDULE,bad),{section:0,completed:{}});
  assert.deepEqual(readSaved('mth140',MTH140,bad),{section:0,completed:{}});
  assert.equal(readSection('mth141',MTH141,bad),0);
  assert.ok(bad.calls.every(([kind])=>kind==='get'));
  const denied={getItem(){throw new Error('SecurityError')},setItem(){throw new Error('no')}};
  for(const course of ['cen100','mth140','mth141'])assert.deepEqual(readSaved(course,course==='cen100'?SCHEDULE:COURSES[course],denied),{section:0,completed:{}});
  assert.deepEqual(readSaved('mth140',MTH140,null),{section:0,completed:{}});
  assert.deepEqual(keys('cen100'),{section:'cen100-contact-choice-v1',progress:'cen100-personal-plan-v1'});
  assert.deepEqual(keys('mth141'),{section:'mth141-section-v1',progress:'mth141-progress-v1'});
  assert.equal(readCompleted('cen100',SCHEDULE,memory({'cen100-personal-plan-v1':'{"completed":[1]}'})).integrity,undefined);
});

test('the overall next deadline never manufactures a timer from an uncertain target',()=>{
  const targets=(now,sections={})=>['cen100','mth140','mth141'].map(c=>c==='cen100'?cen(now,sections.cen100||0):math(c,now,sections[c]||0));
  // No saved sections: MTH140's quiz week could fall on Monday, so it leads, without a countdown.
  const first=overall(targets(NOON_OCT12),NOON_OCT12);
  assert.equal(first.course,'mth140');assert.equal(first.precision,'week');assert.equal(first.at,undefined);
  // With a section the quiz is Thursday; the exact CEN quiz on Wednesday leads and may count down.
  const exact=overall(targets(NOON_OCT12,{mth140:31}),NOON_OCT12);
  assert.equal(exact.course,'cen100');assert.equal(exact.id,'integrity');assert.equal(exact.precision,'exact');
  // A date-only row orders at the end of its Toronto day, after a timed row on the same day.
  const day={course:'cen100',precision:'day',date:'2026-10-14'},timed={course:'mth141',precision:'exact',at:toronto('2026-10-14','18:00')};
  assert.equal(overall([day,timed],NOON_OCT12),timed);
  // Pending and empty never outrank dated work; all-empty is null.
  const pending={course:'mth140',precision:'pending'},none={course:'cen100',precision:'empty'};
  assert.equal(overall([pending,day,none],NOON_OCT12),day);assert.equal(overall([none,pending],NOON_OCT12),pending);assert.equal(overall([none],NOON_OCT12),null);
  // An ended timed item keeps its place for the grace period, then yields to upcoming work.
  const ended={course:'mth140',precision:'exact',at:toronto('2026-10-15','16:00'),end:toronto('2026-10-15','18:00')},later={course:'mth141',precision:'exact',at:toronto('2026-10-16','18:30')};
  assert.equal(overall([ended,later],toronto('2026-10-15','19:00')),ended);
  assert.equal(overall([ended,later],toronto('2026-10-15','20:01')),later);
});

test('the Desk’s first-paint course accents mirror COURSE_META',()=>{
  // core.mjs touches the DOM at import, so compare the source text: desk.css must not drift from COURSE_META.
  const core=readFileSync(new URL('../assets/night/core.mjs',import.meta.url),'utf8'),css=readFileSync(new URL('../assets/night/desk.css',import.meta.url),'utf8');
  for(const course of ['cen100','mth140','mth141']){
    const [,accent,strong]=core.match(new RegExp(course+":\\{[^}]*accent:'(#[0-9a-f]{6})',strong:'(#[0-9a-f]{6})'"));
    assert.match(css,new RegExp(`\\[data-course-card=${course}\\],\\[data-book=${course}\\]\\{--course:${accent};--course-strong:${strong}\\}`),course);
  }
});

