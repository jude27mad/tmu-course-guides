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
   Adapter, by fixture type:
   - exact: a target with the fixture's absolute instant (offsets in the ISO string decide the DST hour).
   - date_only / pending: targets of precision 'day' / 'pending', the shapes the resolver produces for them.
   - quiz_week: a one-lab course in course-data.mjs's own record shape, resolved by resolveTarget(). A fixture
     section is a lab timetable row (weekday only); postedTime is that lab's published start time; overrideDate is
     an announced Monday make-up date (course-data's mondayMakeupDate). */
const cases=JSON.parse(readFileSync(new URL('../docs/qa/toronto-deadline-test-cases.json',import.meta.url),'utf8'));
const WEEKDAY={Monday:1,Tuesday:2,Wednesday:3,Thursday:4,Friday:5};
const WEEK_ONE_MONDAY='2026-09-07';

function fixtureTarget(c){
  const d=c.deadline,now=Date.parse(c.now);
  if(d.type==='exact')return {precision:'exact',at:Date.parse(d.at),id:c.id,title:c.id};
  if(d.type==='date_only')return {precision:'day',date:d.date,id:c.id,title:c.id};
  if(d.type==='pending')return {precision:'pending',id:c.id,title:c.id};
  assert.equal(d.type,'quiz_week',`${c.id}: unknown fixture type ${d.type}`);
  const lab=d.section?{section:1,day:WEEKDAY[d.section.weekday],start:d.postedTime??null,end:null,room:'',assistant:''}:null;
  const data={code:'FIX',labs:lab?[lab]:[],assessments:[{id:'fixture',kind:'quiz',title:'Fixture quiz',week:addDays(WEEK_ONE_MONDAY,(d.week-1)*7),...(d.overrideDate?{mondayMakeupDate:d.overrideDate}:{})}]};
  return targets.resolveTarget({course:'mth140',data,section:lab?1:0,completed:{},now,id:'fixture'});
}

const zone=process.env.TZ||Intl.DateTimeFormat().resolvedOptions().timeZone;
for(const c of cases)test(`${c.id} [system time zone ${zone}]`,()=>{
  assert.equal(typeof targets.status,'function','targets.status(target, now) exists');
  assert.equal(typeof targets.targetDate,'function','targets.targetDate(target) exists');
  assert.equal(typeof weeks.termWeek,'function','weeks.termWeek(date) exists');
  const now=Date.parse(c.now),t=fixtureTarget(c),e=c.expected;
  assert.ok(t,`${c.id}: the resolver returned a target`);
  const date=targets.targetDate(t);
  const actual={nowWeek:weeks.termWeek(today(new Date(now))),deadlineWeek:date?weeks.termWeek(date):null};
  assert.equal(actual.nowWeek,e.nowWeek,`${c.id} nowWeek`);
  assert.equal(actual.deadlineWeek,e.deadlineWeek,`${c.id} deadlineWeek`);
  if('resolvedDate' in e)assert.equal(date,e.resolvedDate,`${c.id} resolvedDate`);
  const p=targets.parts(t,now),label=targets.status(t,now);
  if(e.countdown){
    assert.equal(label,null,`${c.id}: a running countdown has no status label`);
    assert.deepEqual({days:p.d,hours:p.h,minutes:p.m},e.countdown,`${c.id} countdown`);
  }else{
    assert.equal(label,e.label,`${c.id} label`);
    assert.ok(!p?.ms,`${c.id}: "${e.label}" shows no clock digits`);
  }
});

/* The course data stores Toronto wall-clock times, so the converter must land on the fixture instants from any
   host zone. In the repeated 01:00-01:59 hour of Nov 1 a wall-clock time is ambiguous; it must be one of the two. */
const torontoWall=instant=>{
  const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(instant)).map(x=>[x.type,x.value]));
  return {date:`${p.year}-${p.month}-${p.day}`,time:`${p.hour}:${p.minute}`};
};
test(`timestamp() reproduces every exact fixture instant from Toronto wall-clock time [system time zone ${zone}]`,()=>{
  for(const c of cases.filter(x=>x.deadline.type==='exact'||x.deadline.postedTime)){
    const instant=c.deadline.at?Date.parse(c.deadline.at):null;
    for(const value of [instant,Date.parse(c.now)].filter(v=>v!=null)){
      const {date,time}=torontoWall(value),got=timestamp(date,time);
      if(date==='2026-11-01'&&time.startsWith('01:'))assert.ok([value,value+3600e3,value-3600e3].includes(got)&&torontoWall(got).time===time,`${c.id}: ${date} ${time} is one of its two instants`);
      else assert.equal(got,value,`${c.id}: ${date} ${time} Toronto`);
    }
  }
});

/* The same 40 cases must pass when the host computer is elsewhere. Each zone runs in its own process. */
if(!process.env.DEADLINE_TZ_CHILD){
  const file=fileURLToPath(import.meta.url);
  for(const tz of ['America/Toronto','UTC','America/Los_Angeles'])test(`all fixtures pass with system time zone ${tz}`,()=>{
    const run=spawnSync(process.execPath,['--test',file],{env:{...process.env,TZ:tz,DEADLINE_TZ_CHILD:'1'},encoding:'utf8'});
    assert.equal(run.status,0,`${tz}:\n${(run.stdout||'').split('\n').filter(l=>/^not ok|# (pass|fail)/.test(l.trim())).join('\n')}`);
  });
}
