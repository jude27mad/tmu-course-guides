import test from 'node:test';
import assert from 'node:assert/strict';
import {COURSES} from '../assets/course-data.mjs';
import {SCHEDULE} from '../assets/cen-schedule.mjs';
import {timestamp} from '../assets/schedule.mjs';
import {semesterWeeks,recordsForCourse,popupRank} from '../assets/book/weeks.mjs';
import {resolveTarget,compact} from '../assets/night/targets.mjs';
import {describeSpread,paletteEntries,createBookState} from '../assets/book/book-state.mjs';

/* describeSpread (docs/book/semester-book-spec.md §3.2, §10.2): the book's only source of text. Assessment
   wording is the resolver's, verbatim; week wording follows docs/copy/interface-copy.md. Frozen clocks only. */
const MTH140=COURSES.mth140;
const NOON=timestamp('2026-10-12','12:00');
const toronto=(date,time='12:00')=>timestamp(date,time);
function context({section=0,completed={},now=NOON,targetId=null,course='mth140',data=MTH140,cenSchedule=[]}={}){
  const weeks=semesterWeeks({records:recordsForCourse(course,{courseData:COURSES,cenSchedule,section,completed})});
  return {course,data,weeks,section,completed,now,targetId};
}
const view=(index,options)=>{const ctx=context(options);return describeSpread(ctx.weeks[index],ctx);};
const resolved=(id,{section=0,completed={},now=NOON}={})=>resolveTarget({course:'mth140',data:MTH140,section,completed,now,id});

test('MTH140 check values (now 2026-10-12, no section): resolver strings verbatim',()=>{
  const ctx=context({targetId:'quiz-2'});
  assert.equal(ctx.weeks.length,17);
  const week6=describeSpread(ctx.weeks[5],ctx);
  assert.equal(week6.index,5);assert.equal(week6.count,17);assert.equal(week6.datedCount,16);
  assert.equal(week6.relative,'THIS WEEK');
  assert.equal(week6.kicker,'WEEK');assert.equal(week6.numeral,'06');assert.equal(week6.of,'16');
  assert.equal(week6.range,'Mon Oct 12 – Sun Oct 18');assert.equal(week6.note,'Teaching week');
  assert.equal(week6.entries.length,1);
  const [quiz]=week6.entries,t=resolved('quiz-2');
  assert.equal(quiz.id,'quiz-2');assert.equal(quiz.open,'assessment-quiz-2');assert.equal(quiz.kind,'quiz');
  assert.equal(quiz.when,'Oct 12–Oct 16 · during your assigned lab');assert.equal(quiz.when,t.when);
  assert.equal(quiz.label,'Quiz week');assert.equal(quiz.label,t.label);
  // The interface copy's quiz-week wording ("Choose section for quiz date") is the resolver's.
  assert.equal(quiz.cta,'Choose section for quiz date');assert.equal(quiz.cta,t.cta);
  assert.equal(quiz.bracket,true);assert.equal(quiz.day,null);assert.equal(quiz.rowWhen,null);
  assert.equal(quiz.chip,'NEXT');assert.equal(quiz.urgency,'none');assert.equal(quiz.state,'week');
  assert.equal(quiz.rank,popupRank({kind:'quiz',weight:null}));
  assert.deepEqual(week6.popups,['quiz-2']);assert.equal(week6.more,0);

  const week7=describeSpread(ctx.weeks[6],ctx),[midterm]=week7.entries;
  assert.equal(midterm.id,'midterm');
  assert.equal(midterm.when,'Fri Oct 23 · 6:30 PM Toronto');assert.equal(midterm.label,'Test starts');
  assert.equal(midterm.when,resolved('midterm').when);
  assert.equal(midterm.day,'2026-10-23');assert.equal(midterm.rowWhen,'6:30 PM Toronto');assert.equal(midterm.bracket,false);
  assert.equal(midterm.chip,null,'only the target carries a chip');

  const exams=describeSpread(ctx.weeks[16],ctx),[final]=exams.entries;
  assert.equal(exams.pending,true);assert.equal(exams.kind,'exam');
  assert.equal(final.id,'final');assert.equal(final.when,'Date pending');assert.equal(final.label,'Awaiting the official schedule');
  assert.equal(final.day,null);assert.equal(final.rowWhen,null);
});

test('with section 1, quiz 2 has its day and a row time copied from the resolver',()=>{
  const week6=view(5,{section:1}),[quiz]=week6.entries;
  assert.equal(quiz.day,'2026-10-15');
  assert.equal(quiz.when,'Thu Oct 15 · 4:00 PM · POD367');assert.equal(quiz.when,resolved('quiz-2',{section:1}).when);
  assert.equal(quiz.rowWhen,'4:00 PM · POD367');
  assert.equal(quiz.label,'Your lab starts · quiz in its second hour');
  assert.equal(quiz.cta,null);assert.equal(quiz.bracket,false);
  assert.equal(quiz.note,resolved('quiz-2',{section:1}).note);
  // A Monday section writes on the confirmed make-up day, which belongs to the next spread.
  const monday=context({section:2});
  assert.equal(describeSpread(monday.weeks[5],monday).entries.length,0);
  const week7=describeSpread(monday.weeks[6],monday);
  assert.deepEqual(week7.entries.map(e=>e.id),['quiz-2','midterm'],'by date');
  assert.deepEqual(week7.popups,['midterm','quiz-2'],'by popupRank');
  assert.equal(week7.entries[0].rowWhen,'10:00 AM · POD367');
});

test('no composed times: never 23:59, never countdown digits, quiz weeks without a section have no time',()=>{
  const countdown=/\b\d+d \d+h\b|\b\d+h \d{2}m\b|\b\d+m\b/;
  const nows=[toronto('2026-09-01'),NOON,toronto('2026-10-15','15:30'),toronto('2026-10-23','18:30'),toronto('2026-10-23','19:00'),toronto('2026-11-11'),toronto('2027-01-10')];
  for(const section of [0,1,2,7,31])for(const now of nows)for(const completed of [{},{'quiz-2':true,midterm:true}]){
    const ctx=context({section,now,completed,targetId:resolveTarget({course:'mth140',data:MTH140,section,completed,now})?.id});
    for(const spread of ctx.weeks){
      const text=JSON.stringify(describeSpread(spread,ctx));
      assert.doesNotMatch(text,/23:59/);
      assert.doesNotMatch(text,countdown,`${spread.label} @ ${new Date(now).toISOString()}`);
    }
  }
  const ctx=context();
  for(const spread of ctx.weeks)for(const entry of describeSpread(spread,ctx).entries.filter(e=>e.kind==='quiz')){
    assert.equal(entry.bracket,true);assert.equal(entry.cta,'Choose section for quiz date');
    assert.doesNotMatch(entry.when,/\d{1,2}:\d{2}/);assert.equal(entry.rowWhen,null);assert.equal(entry.day,null);
  }
});

test('pending spread: EXAMS, Date pending, no days and no numeral',()=>{
  const exams=view(16);
  assert.equal(exams.kicker,'EXAMS');assert.equal(exams.numeral,null);assert.equal(exams.of,'16');
  assert.equal(exams.range,'Date pending');assert.equal(exams.note,'Exam · Date pending');
  assert.equal(exams.relative,'EXAMS · DATE PENDING');
  assert.deepEqual(exams.days,[]);
  assert.equal(exams.title,'Exam · Date pending');assert.equal(exams.aria,'Exams, date pending. Show this week');
  assert.deepEqual(exams.folio,{verso:'EXAMS',recto:'Date pending'});
  assert.equal(exams.live,'Exams, date pending. Final Exam: Date pending. Awaiting the official schedule.');
});

test('partial weeks and week labels follow the interface copy',()=>{
  const first=view(0),week6=view(5),crossing=view(3),last=view(15);
  assert.equal(first.title,'Week 1 · Sep 8–13');
  assert.equal(first.name,'Week 1, September 8 to 13. Partial first week');
  assert.equal(first.aria,'Week 1, September 8 to 13. Show this week');
  assert.equal(first.partial,true);assert.equal(first.note,'Partial first week');
  assert.equal(first.range,'Tue Sep 8 – Sun Sep 13');
  assert.deepEqual(first.days.map(d=>[d.dow,d.dom,d.outside,d.mark]),[['MON','7',true,'before term'],['TUE','8',false,null],['WED','9',false,null],['THU','10',false,null],['FRI','11',false,null],['SAT','12',false,null],['SUN','13',false,null]]);
  assert.equal(week6.title,'Week 6 · Oct 12–18');assert.equal(week6.name,'Week 6, October 12 to 18');
  assert.equal(week6.aria,'Week 6, October 12 to 18. Show this week');
  assert.deepEqual(week6.folio,{verso:'WK 06',recto:'Oct 12 – 18'});
  assert.deepEqual(week6.caption,{week:'Week 6 of 16',relative:'This week'});
  assert.equal(crossing.title,'Week 4 · Sep 28–Oct 4');assert.equal(crossing.name,'Week 4, September 28 to October 4');
  assert.equal(crossing.folio.recto,'Sep 28 – Oct 4');
  assert.equal(last.title,'Week 16 · Dec 21');assert.equal(last.name,'Week 16, December 21. Final day of the semester');
  assert.equal(last.note,'Final day of the semester');assert.equal(last.range,'Mon Dec 21');assert.equal(last.folio.recto,'Dec 21');
  assert.deepEqual(last.days.map(d=>d.outside),[false,true,true,true,true,true,true]);
  assert.equal(last.days[1].mark,'after term');
  assert.equal(view(4).empty,'Nothing scheduled');assert.equal(week6.empty,null);
  assert.equal(view(4).live,'Week 5 of 16, October 5 to 11, last week. No assessments scheduled for this week.');
  assert.equal(week6.live,'Week 6 of 16, October 12 to 18, this week. Lab Quiz 2: Oct 12–Oct 16 · during your assigned lab. Quiz week.');
  assert.equal(first.live,'Week 1 of 16, September 8 to 13, 5 weeks ago. Partial first week. No assessments scheduled for this week.');
});

test('relative kickers, including BEFORE TERM and AFTER TERM',()=>{
  const at=(now,index)=>view(index,{now}).relative;
  assert.deepEqual([5,6,8,4,3].map(i=>at(NOON,i)),['THIS WEEK','NEXT WEEK','IN 3 WEEKS','LAST WEEK','2 WEEKS AGO']);
  // Toronto midnight, not UTC: 03:59 UTC on Monday Oct 12 is still Sunday Oct 11 in Toronto.
  assert.equal(view(5,{now:Date.parse('2026-10-12T03:59:00Z')}).relative,'NEXT WEEK');
  assert.equal(view(5,{now:Date.parse('2026-10-12T04:00:00Z')}).relative,'THIS WEEK');
  const before=toronto('2026-09-01');
  assert.equal(at(before,0),'BEFORE TERM');assert.equal(at(before,1),'IN 2 WEEKS');
  assert.equal(at(toronto('2026-09-07'),0),'BEFORE TERM','the Monday before the Tuesday start');
  assert.equal(at(toronto('2026-09-08'),0),'THIS WEEK');
  const after=toronto('2027-01-10');
  assert.equal(at(after,15),'AFTER TERM');assert.equal(at(after,14),'3 WEEKS AGO');assert.equal(at(after,16),'EXAMS · DATE PENDING');
  assert.equal(at(toronto('2026-12-22'),15),'AFTER TERM');assert.equal(at(toronto('2026-12-22'),14),'LAST WEEK');
  assert.equal(at(toronto('2026-12-21'),15),'THIS WEEK');
  assert.match(view(0,{now:before}).live,/, before term\. Partial first week\./);
  // Today's ledger day follows the same Toronto date.
  assert.deepEqual(view(5).days.map(d=>d.today),[true,false,false,false,false,false,false]);
  assert.deepEqual(view(5,{now:toronto('2026-10-15')}).days.map(d=>d.today),[false,false,false,true,false,false,false]);
});

test('chips and urgency: DONE, PASSED, and NOW / SOON / NEXT for the target only',()=>{
  const midterm=(now,options={})=>view(6,{now,targetId:'midterm',...options}).entries[0];
  const ahead=midterm(NOON);
  assert.deepEqual([ahead.chip,ahead.urgency,ahead.state],['NEXT','none','ahead']);
  const soon=midterm(toronto('2026-10-22','18:30'));
  assert.deepEqual([soon.chip,soon.urgency,soon.state],['SOON','soon','soon']);
  const hot=midterm(toronto('2026-10-23','14:00'));
  assert.deepEqual([hot.chip,hot.urgency,hot.state],['SOON','hot','hot']);
  const live=midterm(toronto('2026-10-23','19:00'));
  assert.deepEqual([live.chip,live.urgency,live.state],['NOW','hot','live']);
  const notTarget=view(6,{now:toronto('2026-10-23','14:00'),targetId:'quiz-3'}).entries[0];
  assert.deepEqual([notTarget.chip,notTarget.urgency],[null,'hot'],'urgency is the entry’s own; the chip is the target’s');
  const passed=midterm(toronto('2026-10-24'));
  assert.deepEqual([passed.chip,passed.urgency,passed.passed],['PASSED','none',true]);
  assert.equal(passed.status,'Due time passed');assert.equal(passed.status,compact(resolved('midterm',{now:toronto('2026-10-24')}),toronto('2026-10-24')));
  for(const now of [NOON,toronto('2026-10-23','19:00'),toronto('2026-10-24')]){
    const done=midterm(now,{completed:{midterm:true}});
    assert.deepEqual([done.chip,done.urgency,done.completed,done.status],['DONE','none',true,null]);
  }
  // A quiz week is over after its Friday, with or without a section.
  const quiz1=view(3).entries[0];
  assert.deepEqual([quiz1.id,quiz1.chip,quiz1.passed,quiz1.status,quiz1.urgency],['quiz-1','PASSED',true,'Date passed','none']);
  // Week or pending precision never carries urgency.
  assert.equal(view(5,{now:toronto('2026-10-14'),targetId:'quiz-2'}).entries[0].urgency,'none');
  assert.equal(view(16,{targetId:'final'}).entries[0].chip,'NEXT');
});

test('completed entries keep their pop-up slot and are announced as recorded in this browser',()=>{
  const completed={midterm:true};
  const week7=view(6,{section:2,completed});
  assert.deepEqual(week7.popups,['midterm','quiz-2']);
  assert.equal(week7.entries[1].completed,true);
  assert.match(week7.live,/Midterm Test marked complete in this browser\./);
  // The saved envelope is accepted as well as the completed map.
  assert.equal(view(6,{section:2,completed:{completed}}).signature,week7.signature);
});

test('at most three pop-ups by rank; the rest are counted and printed as more',()=>{
  const records=[
    {id:'a',kind:'minor',title:'Reading log',date:'2026-10-13',week:null,precision:'day',weight:null,completed:false},
    {id:'b',kind:'quiz',title:'Quiz',date:'2026-10-14',week:null,precision:'day',weight:null,completed:false},
    {id:'c',kind:'final',title:'Project',date:'2026-10-16',week:null,precision:'day',weight:20,completed:true},
    {id:'d',kind:'midterm',title:'Test',date:'2026-10-13',week:null,precision:'day',weight:25,completed:false},
    {id:'e',kind:'lab',title:'Lab report',date:null,week:null,precision:'pending',weight:null,completed:false}
  ];
  const weeks=semesterWeeks({records});
  const spread=weeks[5],v=describeSpread(spread,{course:'mth140',data:null,weeks,now:NOON});
  assert.deepEqual(v.entries.map(e=>e.id),['d','a','b','c'],'by date, then rank; the undated lab is not in a dated spread');
  assert.deepEqual(v.popups,['c','d','b'],'≤ 3 by popupRank; the completed one keeps its slot');
  assert.equal(v.more,1);assert.equal(v.moreLabel,'+1 more on these pages');
  // Records the resolver cannot name keep resolver vocabulary and never get a time.
  assert.equal(v.entries[0].when,'Tue Oct 13');assert.equal(v.entries[0].label,'Time not posted');assert.equal(v.entries[0].rowWhen,'Time not posted');
  assert.equal(v.entries.find(e=>e.id==='c').chip,'DONE');
  const pending=describeSpread(weeks.at(-1),{course:'mth140',data:null,weeks,now:NOON});
  assert.equal(pending.pending,false,'a lab without a date is not a pending exam spread');
});

test('CEN100: every entry is the resolver’s, and the undated final keeps “Date pending”',()=>{
  const now=NOON;
  const weeks=semesterWeeks({records:recordsForCourse('cen100',{cenSchedule:SCHEDULE,section:3})});
  const ctx={course:'cen100',data:SCHEDULE,weeks,section:3,completed:{},now,targetId:resolveTarget({course:'cen100',data:SCHEDULE,section:3,now}).id};
  let chips=0,endOfDay=0;
  for(const spread of weeks){
    const v=describeSpread(spread,ctx);
    for(const entry of v.entries){
      const row=SCHEDULE.find(r=>r.id===entry.id);
      if(row){
        const t=resolveTarget({course:'cen100',data:SCHEDULE,section:3,now,id:entry.id});
        assert.equal(entry.when,t.when);assert.equal(entry.label,t.label);assert.equal(entry.title,t.title);
        if(t.endOfDay){endOfDay++;assert.match(entry.rowWhen,/^by 11:59 PM Toronto$/);}
      }else{
        assert.equal(entry.id,'item:y9');assert.equal(entry.when,'Date pending');assert.equal(entry.label,'Awaiting the official schedule');
      }
      if(entry.chip&&entry.chip!=='DONE'&&entry.chip!=='PASSED')chips++;
    }
  }
  assert.equal(chips,1,'one target chip across the semester');
  assert.ok(endOfDay>0,'end-of-day submissions are covered');
});

test('signature is stable, ignores the clock between meaningful changes, and changes on completion or section',()=>{
  const base=view(5,{targetId:'quiz-2'});
  assert.equal(view(5,{targetId:'quiz-2'}).signature,base.signature,'fresh weeks, same inputs, same signature');
  assert.equal(view(5,{targetId:'quiz-2',now:NOON+60_000}).signature,base.signature,'a minute tick changes nothing');
  assert.notEqual(view(5,{targetId:'quiz-2',completed:{'quiz-2':true}}).signature,base.signature,'completion');
  assert.notEqual(view(5,{targetId:'quiz-2',section:1}).signature,base.signature,'section');
  assert.notEqual(view(5,{targetId:'midterm'}).signature,base.signature,'target');
  assert.notEqual(view(5,{targetId:'quiz-2',now:toronto('2026-10-13')}).signature,base.signature,'today moved to Tuesday');
  const midterm=now=>view(6,{targetId:'midterm',now}).signature;
  assert.equal(midterm(toronto('2026-10-22','19:00')),midterm(toronto('2026-10-22','20:00')),'no countdown in the signature');
  assert.notEqual(midterm(toronto('2026-10-23','12:00')),midterm(toronto('2026-10-23','13:00')),'soon → hot repaints');
  assert.match(base.signature,/^[0-9a-z]+$/);
  assert.equal(view(5,{targetId:'quiz-2'}).aria,view(5,{targetId:'quiz-2',now:toronto('2026-11-30')}).aria,'the tick name never changes with time');
});

test('views are frozen and accept a spread index',()=>{
  const ctx=context();
  const v=describeSpread(5,ctx);
  assert.equal(v.signature,describeSpread(ctx.weeks[5],ctx).signature);
  assert.ok(Object.isFrozen(v)&&Object.isFrozen(v.entries)&&Object.isFrozen(v.entries[0])&&Object.isFrozen(v.days[0])&&Object.isFrozen(v.folio));
  assert.throws(()=>describeSpread(99,ctx),TypeError);
});

test('paletteEntries: one week command per spread, labelled with the copy',()=>{
  const ctx=context();
  const state=createBookState({course:'mth140',weeks:ctx.weeks,today:5});
  const entries=paletteEntries(state,{now:NOON});
  assert.equal(entries.length,17);
  assert.deepEqual(entries.map(e=>e.index),[...ctx.weeks.keys()]);
  assert.deepEqual({...entries[5],keywords:undefined},{index:5,label:'Week 6 · Oct 12–18',keywords:undefined,hint:'Mon Oct 12 – Sun Oct 18',selected:true,today:true});
  for(const word of ['week 6','wk 6','w6','oct 15','october','this week','lab quiz 2','quiz','2026-10-12'])assert.ok(entries[5].keywords.includes(word),word);
  assert.equal(entries[0].label,'Week 1 · Sep 8–13');assert.equal(entries[15].label,'Week 16 · Dec 21');
  assert.equal(entries[16].label,'Exam · Date pending');assert.equal(entries[16].hint,'Date pending');
  assert.ok(entries[16].keywords.includes('final exam'));
  assert.deepEqual(paletteEntries(null,{now:NOON}),[],'the Desk has no book weeks');
});
