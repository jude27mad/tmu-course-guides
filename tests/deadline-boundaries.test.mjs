import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import * as targets from '../assets/night/targets.mjs';
import * as weeks from '../assets/book/weeks.mjs';
import {today,addDays,timestamp} from '../assets/schedule.mjs';

/* The 40 synthetic Toronto boundary fixtures (docs/qa/toronto-deadline-test-cases.md), run through the site's own
   resolver. The fixtures are data, never course records: nothing here touches COURSES or SCHEDULE.
   Every fixture becomes a one-record course in course-data.mjs's own shape and is resolved by resolveTarget():
   - exact: an assessment with the fixture instant's Toronto wall-clock date and time, which course data stores
     (resolveTarget must convert it back to the same instant). Only inside the repeated 01:00-01:59 hour of Nov 1
     is wall-clock time ambiguous; there the fixture's absolute instant is used directly, as course data cannot
     express it.
   - date_only: an assessment with a date and no time. pending: an undated final.
   - quiz_week: a quiz with one lab. A fixture section is a lab timetable row (weekday only); postedTime is that
     lab's published start time; overrideDate is an announced Monday make-up date (course-data's mondayMakeupDate). */
const cases=JSON.parse(readFileSync(new URL('../docs/qa/toronto-deadline-test-cases.json',import.meta.url),'utf8'));
const WEEKDAY={Monday:1,Tuesday:2,Wednesday:3,Thursday:4,Friday:5};
const WEEK_ONE_MONDAY='2026-09-07';
const torontoWall=instant=>{
  const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(instant)).map(x=>[x.type,x.value]));
  return {date:`${p.year}-${p.month}-${p.day}`,time:`${p.hour}:${p.minute}`};
};
const repeatedHour=({date,time})=>date==='2026-11-01'&&time.startsWith('01:');
const course=(assessment,labs=[])=>({code:'FIX',labs,assessments:[{id:'fixture',title:'Fixture',...assessment}]});
const resolve=(data,now,section=0)=>targets.resolveTarget({course:'mth140',data,section,completed:{},now,id:'fixture'});

function fixtureTarget(c){
  const d=c.deadline,now=Date.parse(c.now);
  if(d.type==='exact'){
    const instant=Date.parse(d.at),wall=torontoWall(instant);
    if(repeatedHour(wall))return {precision:'exact',at:instant,id:c.id,title:c.id};
    const t=resolve(course({kind:'midterm',date:wall.date,time:wall.time,end:null}),now);
    assert.equal(t.at,instant,`${c.id}: ${wall.date} ${wall.time} Toronto converts back to the fixture instant`);
    return t;
  }
  if(d.type==='date_only')return resolve(course({kind:'midterm',date:d.date,time:null}),now);
  if(d.type==='pending')return resolve(course({kind:'final',date:null,time:null}),now);
  assert.equal(d.type,'quiz_week',`${c.id}: unknown fixture type ${d.type}`);
  const lab=d.section?{section:1,day:WEEKDAY[d.section.weekday],start:d.postedTime??null,end:null,room:'',assistant:''}:null;
  return resolve(course({kind:'quiz',week:addDays(WEEK_ONE_MONDAY,(d.week-1)*7),...(d.overrideDate?{mondayMakeupDate:d.overrideDate}:{})},lab?[lab]:[]),now,lab?1:0);
}
const totalMinutes=p=>p.d*1440+p.h*60+p.m;

const zone=process.env.TZ||Intl.DateTimeFormat().resolvedOptions().timeZone;
for(const c of cases)test(`${c.id} [system time zone ${zone}]`,()=>{
  const now=Date.parse(c.now),t=fixtureTarget(c),e=c.expected;
  assert.ok(t,`${c.id}: the resolver returned a target`);
  const date=targets.targetDate(t);
  assert.equal(weeks.termWeek(today(new Date(now))),e.nowWeek,`${c.id} nowWeek`);
  assert.equal(date?weeks.termWeek(date):null,e.deadlineWeek,`${c.id} deadlineWeek`);
  if('resolvedDate' in e)assert.equal(date,e.resolvedDate,`${c.id} resolvedDate`);
  const p=targets.parts(t,now),label=targets.status(t,now),chip=targets.compact(t,now);
  if(e.countdown){
    assert.equal(label,null,`${c.id}: a running countdown has no status label`);
    assert.deepEqual({days:p.d,hours:p.h,minutes:p.m},e.countdown,`${c.id} countdown`);
    // Seconds are truncated, never rounded: 30 s later the countdown is one whole minute lower.
    assert.equal(totalMinutes(targets.parts(t,now+30e3)),totalMinutes(p)-1,`${c.id}: truncation`);
    assert.doesNotMatch(chip,/passed|now|pending/i,`${c.id}: the chip shows the countdown`);
    return;
  }
  assert.equal(label,e.label,`${c.id} label`);
  assert.ok(!p?.ms,`${c.id}: "${e.label}" shows no clock digits`);
  // The same state reaches what students read: the chip on the card, dock, HUD and Desk.
  if(t.precision==='exact'){assert.equal(chip,e.label,`${c.id} chip`);assert.equal(p.state,e.label==='Happening now'?'live':'passed',`${c.id} state`);}
  else if(t.precision==='day')assert.equal(chip,p.days<0?e.label:p.days===0?'Today':p.days===1?'Tomorrow':`In ${p.days} days`,`${c.id} chip: day-level wording, never a clock`);
  else if(t.holiday)assert.equal(chip,e.label,`${c.id} chip`);
  else if(t.precision==='week'){assert.equal(chip,'Quiz week',`${c.id} chip`);assert.ok(t.cta,`${c.id}: the card asks for a lab section`);}
  else assert.equal(chip,e.label,`${c.id} chip`);
});

/* The same 40 cases must pass when the host computer is elsewhere. Each zone runs in its own process. node --test
   marks its file processes with NODE_TEST_CONTEXT; a child that inherits it skips its tests and exits 0, so it is
   removed, and the child must report every test passed rather than just a clean exit. */
if(!process.env.DEADLINE_TZ_CHILD){
  const file=fileURLToPath(import.meta.url);
  for(const tz of ['America/Toronto','UTC','America/Los_Angeles'])test(`all fixtures pass with system time zone ${tz}`,()=>{
    const env={...process.env,TZ:tz,DEADLINE_TZ_CHILD:'1'};delete env.NODE_TEST_CONTEXT;
    const run=spawnSync(process.execPath,['--test','--test-reporter=tap',file],{env,encoding:'utf8'});
    const count=key=>Number((run.stdout.match(new RegExp(`^# ${key} (\\d+)`,'m'))||[])[1]);
    assert.equal(run.status,0,`${tz} exit:\n${run.stdout.split('\n').filter(l=>/^not ok/.test(l.trim())).join('\n')}`);
    assert.equal(count('tests'),cases.length,`${tz}: every fixture ran`);
    assert.equal(count('pass'),cases.length,`${tz}: every fixture passed`);
    assert.equal(count('fail'),0,`${tz}: no failures`);
  });
}
