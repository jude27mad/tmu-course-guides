import test from 'node:test';
import assert from 'node:assert/strict';
import {COURSES} from '../assets/course-data.mjs';
import {today,timestamp,resolveAssessment,upcoming,calendar} from '../assets/schedule.mjs';

test('each course covers all 34 sections with one matching instructor and lab',()=>{
  for(const course of Object.values(COURSES)){
    assert.deepEqual(course.labs.map(x=>x.section),Array.from({length:34},(_,i)=>i+1));
    for(const lab of course.labs){assert.equal(course.instructors.filter(x=>x.sections.includes(lab.section)).length,1);assert.ok(lab.room&&lab.assistant);}
    assert.equal(course.weights.reduce((a,b)=>a+b),100);
    assert.equal(course.assessments.find(a=>a.kind==='final').date,null);
  }
  assert.deepEqual(COURSES.mth140.weights,[15,40,45]);
  assert.deepEqual(COURSES.mth141.weights,[20,35,45]);
  assert.equal(COURSES.mth140.labs[30].room,'VIC106');
  assert.equal(COURSES.mth141.labs[23].room,'SHE651');
});
test('quiz dates follow the section and the announced Monday Thanksgiving make-up',()=>{
  const quiz=COURSES.mth140.assessments.find(a=>a.id==='quiz-2');
  assert.equal(resolveAssessment(COURSES.mth140,quiz,31).date,'2026-10-15');
  assert.equal(resolveAssessment(COURSES.mth140,quiz,7).date,'2026-10-13');
  const monday=resolveAssessment(COURSES.mth140,quiz,2);
  assert.equal(monday.date,'2026-10-19');assert.equal(monday.holiday,false);assert.equal(monday.rescheduled,true);
  assert.equal(resolveAssessment(COURSES.mth140,quiz,0).date,null);
});
test('confirmed scope, make-up day and exam-format privacy are represented in course data',()=>{
  const quiz=COURSES.mth140.assessments.find(a=>a.id==='quiz-2');
  assert.equal(quiz.scope,'Chapter 3: Sections 3.1–3.5.');
  assert.equal(quiz.confirmed,true);
  assert.equal(quiz.mondayMakeupDate,'2026-10-19');
  const midterm=COURSES.mth141.assessments.find(a=>a.id==='midterm');
  assert.match(midterm.scope,/3\.1\.1–3\.1\.3 and 3\.1\.5–3\.2\.2/);
  assert.equal(Object.hasOwn(midterm,'format'),false);
  assert.equal(COURSES.mth141.assessments.some(a=>Object.hasOwn(a,'format')),false);
});
test('next assessment respects the lab day and separate completion records',()=>{
  const now=new Date('2026-10-07T16:00:00Z');
  assert.equal(upcoming(COURSES.mth141,24,{},now)[0].id,'midterm');
  assert.equal(upcoming(COURSES.mth141,3,{},now)[0].id,'quiz-2');
  assert.equal(upcoming(COURSES.mth141,3,{'quiz-2':true},now)[0].id,'midterm');
  assert.equal(upcoming(COURSES.mth141,0,{},now)[0].id,'quiz-2');
  assert.equal(upcoming(COURSES.mth141,24,{},new Date('2026-10-17T01:00:00Z'))[0].id,'quiz-3');
});
test('Toronto calendar dates and daylight-saving offsets are preserved',()=>{
  assert.equal(today(new Date('2026-10-07T02:30:00Z')),'2026-10-06');
  assert.equal(new Date(timestamp('2026-10-16','18:30')).toISOString(),'2026-10-16T22:30:00.000Z');
  assert.equal(new Date(timestamp('2026-11-16','18:30')).toISOString(),'2026-11-16T23:30:00.000Z');
});
test('calendar export avoids invented quiz times, missing final dates and holiday dates',()=>{
  const now=new Date('2026-10-07T16:00:00Z');
  const basic=calendar(COURSES.mth140,31,{now});
  assert.equal(basic.count,1);assert.match(basic.text,/DTSTART:20261023T223000Z/);assert.match(basic.text,/DTEND:20261024T003000Z/);
  const all=calendar(COURSES.mth140,31,{includeTentative:true,now});
  assert.equal(all.count,4);assert.match(all.text,/DTSTART;VALUE=DATE:20261015/);assert.match(all.text,/STATUS:TENTATIVE/);
  assert.doesNotMatch(all.text,/SUMMARY:.*Final/);
  const monday=calendar(COURSES.mth140,2,{includeTentative:true,now});
  assert.equal(monday.count,4);assert.match(monday.text,/DTSTART;VALUE=DATE:20261019/);assert.doesNotMatch(monday.text,/DTSTART.*20261012/);
  assert.equal(calendar(COURSES.mth140,0,{includeTentative:true,now}).count,1);
  for(const line of all.text.split('\r\n'))assert.ok(Buffer.byteLength(line,'utf8')<=75);
});
test('practice references retain the source editions and wrapped ranges without page footers',()=>{
  assert.equal(COURSES.mth140.practice.length,37);assert.equal(COURSES.mth141.practice.length,40);
  const determinant=COURSES.mth141.practice.find(x=>x.section==='3.1');
  assert.match(determinant.kuttler,/3\.1\.22-3\.1\.25/);
  assert.match(COURSES.mth141.practice.find(x=>x.section==='1.2.3').nicholson,/1\.2\.7 b/);
  assert.doesNotMatch(JSON.stringify(COURSES.mth141.practice),/Page \d of/);
});
