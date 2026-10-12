import test from 'node:test';
import assert from 'node:assert/strict';
import {COURSES} from '../assets/course-data.mjs';
import {SCHEDULE} from '../assets/cen-schedule.mjs';
import {addDays, dayLabel, timestamp} from '../assets/schedule.mjs';

let model;
try { model = await import('../assets/book/weeks.mjs'); }
catch (error) { if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error; }
const ready = {skip: !model};

test('weeks exports the pure semester contract', () => {
  for (const name of ['semesterWeeks','weekIndexFor','currentWeekIndex','recordsForCourse','popupRank','findWeek'])
    assert.equal(typeof model?.[name], 'function', `${name} must be exported`);
});

test('first spread is Tuesday through Sunday and later spreads retain Monday anchors', ready, () => {
  const weeks = model.semesterWeeks();
  assert.equal(weeks[0].start,'2026-09-08'); assert.equal(weeks[0].end,'2026-09-13');
  assert.equal(weeks[0].partial,true); assert.match(weeks[0].label,/Week 1.*from Tue.*Sep 8/);
  assert.equal(weeks[1].start,'2026-09-14'); assert.equal(weeks[1].end,'2026-09-20');
  for (const [index,week] of weeks.entries()) assert.equal(week.index,index);
  for (const week of weeks.slice(1)) assert.equal(dayLabel(week.start),'Monday');
  assert.equal(weeks.at(-1).end,'2026-12-21');
});

test('every announced quiz week selects its unchanged Monday spread', ready, () => {
  for (const course of Object.values(COURSES)) {
    const records = model.recordsForCourse(course.code.toLowerCase(),{courseData:COURSES});
    const weeks = model.semesterWeeks({records});
    for (const assessment of course.assessments.filter(a=>a.week)) {
      assert.equal(dayLabel(assessment.week),'Monday');
      const index = model.weekIndexFor(assessment.week,weeks);
      assert.equal(weeks[index].start,assessment.week);
      assert.equal(weeks[index].records.find(r=>r.id===assessment.id).week,assessment.week);
    }
  }
});

test('Toronto dates and Monday boundaries determine current week, including DST', ready, () => {
  const weeks = model.semesterWeeks();
  for (const [instant,date] of [
    ['2026-10-13T03:30:00Z','2026-10-12'],['2026-10-13T04:00:00Z','2026-10-13'],
    ['2026-10-12T03:59:59Z','2026-10-11'],['2026-10-12T04:00:00Z','2026-10-12'],
    ['2026-11-02T04:30:00Z','2026-11-01'],['2026-11-02T05:00:00Z','2026-11-02'],
  ]) assert.equal(model.currentWeekIndex(weeks,new Date(instant)),model.weekIndexFor(date,weeks));
});

test('selection clamps before and after the term without invalid indices', ready, () => {
  const weeks=model.semesterWeeks();
  assert.equal(model.weekIndexFor('2025-01-01',weeks),0);
  assert.equal(model.weekIndexFor('2027-01-01',weeks),weeks.length-1);
  assert.equal(model.currentWeekIndex(weeks,new Date('2020-01-01Z')),0);
  assert.equal(model.weekIndexFor('bad',weeks),0);
  assert.equal(model.weekIndexFor('2026-10-13',[]),0);
});

test('dated exam records extend the range while undated finals retain pending precision', ready, () => {
  const records=[{id:'dated',kind:'final',date:'2026-12-29'},
    {id:'undated',kind:'final',date:null,week:null,precision:'pending'}];
  const original=structuredClone(records),weeks=model.semesterWeeks({records});
  const dated=weeks[model.weekIndexFor('2026-12-29',weeks)];
  assert.equal(dated.kind,'exam'); assert.equal(dated.start,'2026-12-28');
  assert.ok(dated.records.some(r=>r.id==='dated')); assert.ok(dated.end>='2026-12-29');
  const pending=weeks.at(-1); assert.equal(pending.kind,'exam');assert.equal(pending.pending,true);
  assert.equal(pending.start,null);assert.equal(pending.end,null);
  assert.deepEqual(pending.records,[records[1]]);assert.equal(pending.records[0].date,null);
  assert.deepEqual(records,original);
  assert.equal(model.weekIndexFor('2027-01-05',weeks),pending.index);
});

test('reading weeks require dated source evidence, not guessed calendar gaps', ready, () => {
  assert.ok(model.semesterWeeks().every(w=>w.kind==='teaching'));
  const records=[{id:'break',kind:'reading',date:'2026-10-26'}];
  const weeks=model.semesterWeeks({records});
  assert.equal(weeks[model.weekIndexFor('2026-10-26',weeks)].kind,'reading');
});

test('math normalization preserves section dates, make-up and holiday uncertainty', ready, () => {
  const options={courseData:COURSES,section:2};
  const monday=model.recordsForCourse('mth140',options),quiz=monday.find(r=>r.id==='quiz-2');
  assert.equal(quiz.week,'2026-10-12'); assert.equal(quiz.date,'2026-10-19');
  assert.equal(quiz.open,'assessment-quiz-2');assert.equal(quiz.time,null);assert.equal(quiz.precision,'day');
  const thursday=model.recordsForCourse('mth140',{...options,section:1});
  assert.equal(thursday.find(r=>r.id==='quiz-2').date,'2026-10-15');
  const noSection=model.recordsForCourse('mth140',{courseData:COURSES});
  assert.equal(noSection.find(r=>r.id==='quiz-2').precision,'week');
  assert.equal(noSection.find(r=>r.id==='quiz-2').date,null);
  const synthetic=structuredClone(COURSES);delete synthetic.mth140.assessments[1].mondayMakeupDate;
  const holiday=model.recordsForCourse('mth140',{courseData:synthetic,section:2}).find(r=>r.id==='quiz-2');
  assert.equal(holiday.date,null);assert.equal(holiday.time,null);assert.equal(holiday.precision,'week');
  const midterm=monday.find(r=>r.id==='midterm');
  assert.equal(midterm.date,'2026-10-23');assert.equal(midterm.time,'18:30');assert.equal(midterm.precision,'exact');
  assert.equal(timestamp(midterm.date,midterm.time),Date.parse('2026-10-23T22:30:00Z'));
  const final=monday.find(r=>r.id==='final');assert.equal(final.precision,'pending');assert.equal(final.date,null);
});

test('weights preserve published values and never divide an aggregate quiz grade', ready, () => {
  const records=model.recordsForCourse('mth140',{courseData:COURSES});
  assert.equal(records.find(r=>r.id==='midterm').weight,40);
  assert.equal(records.find(r=>r.id==='final').weight,45);
  assert.equal(records.find(r=>r.id==='quiz-1').weight,null);
  const courses=structuredClone(COURSES);courses.mth140.assessments[0].weight=2.75;
  assert.equal(model.recordsForCourse('mth140',{courseData:courses})[0].weight,2.75);
});

test('CEN mapping excludes reminders and distinguishes schedule ids from item handles', ready, () => {
  const records=model.recordsForCourse('cen100',{cenSchedule:SCHEDULE,section:29});
  for (const row of SCHEDULE) {
    const record=records.find(r=>r.id===row.id);
    if(row.calendar===false) {assert.equal(record,undefined);continue;}
    assert.ok(record);assert.equal(record.open,row.item);assert.equal(record.date,row.date);
    assert.equal(record.time,row.time||null);
  }
  const integrity=records.find(r=>r.id==='integrity');assert.equal(integrity.kind,'quiz');
  assert.equal(integrity.precision,'exact');assert.equal(timestamp(integrity.date,integrity.time),Date.parse('2026-10-14T19:00:00Z'));
  assert.equal(records.find(r=>r.id==='failure').kind,'lab');
  assert.equal(records.find(r=>r.id==='matlab-1').kind,'lab');
  assert.equal(records.find(r=>r.id==='review').kind,'midterm');
  assert.equal(records.find(r=>r.id==='report').kind,'final');
  const final=records.find(r=>r.id==='item:y9');assert.equal(final.open,'y9');
  assert.equal(final.date,null);assert.equal(final.time,null);assert.equal(final.precision,'pending');
});

test('CEN final project landmarks retain teaching spreads before the exam period', ready, () => {
  const records=model.recordsForCourse('cen100',{cenSchedule:SCHEDULE});
  const weeks=model.semesterWeeks({records});
  for(const date of ['2026-11-25','2026-12-02'])
    assert.equal(weeks[model.weekIndexFor(date,weeks)].kind,'teaching');
  assert.equal(weeks.at(-1).kind,'exam');assert.equal(weeks.at(-1).pending,true);
});

test('completion accepts the guides saved envelopes and strict entry flags only', ready, () => {
  const math={completed:{'quiz-1':true,midterm:1,final:'true'},checks:{'quiz-2-0':true}};
  const records=model.recordsForCourse('mth140',{courseData:COURSES,completed:math});
  assert.equal(records.find(r=>r.id==='quiz-1').completed,true);
  assert.equal(records.find(r=>r.id==='midterm').completed,true);
  assert.equal(records.find(r=>r.id==='final').completed,false);
  assert.equal(records.find(r=>r.id==='quiz-2').completed,false);
  const cen=model.recordsForCourse('cen100',{cenSchedule:SCHEDULE,completed:{completed:{integrity:1,'item:y9':true,'item:y4':1,failure:0}}});
  assert.equal(cen.find(r=>r.id==='integrity').completed,true);
  assert.equal(cen.find(r=>r.id==='item:y9').completed,true);
  assert.equal(cen.find(r=>r.id==='failure').completed,false);
  assert.equal(model.recordsForCourse('cen100',{cenSchedule:SCHEDULE,completed:{integrity:true}}).find(r=>r.id==='integrity').completed,true);
  for (const completed of [null,[],{completed:null},'bad'])
    assert.ok(model.recordsForCourse('mth140',{courseData:COURSES,completed}).every(r=>!r.completed));
});

test('popup rank keeps categories dominant and real weight secondary', ready, () => {
  const rank=model.popupRank;
  assert.ok(rank({kind:'final'})>rank({kind:'midterm',weight:100000}));
  assert.ok(rank({kind:'midterm'})>rank({kind:'quiz',weight:100000}));
  assert.ok(rank({kind:'quiz'})>rank({kind:'minor',weight:100000}));
  assert.equal(rank({kind:'quiz',weight:6}),rank({kind:'lab',weight:6}));
  assert.ok(rank({kind:'quiz',weight:7})>rank({kind:'quiz',weight:6}));
  const record={kind:'quiz',weight:2.75};rank(record);assert.equal(record.weight,2.75);
});

test('palette queries resolve numbers and real calendar dates with no false matches', ready, () => {
  const weeks=model.semesterWeeks();
  for (const query of ['week 9','wk 9','w9',' WEEK 9 ']) assert.equal(model.findWeek(query,weeks),8);
  const oct=model.weekIndexFor('2026-10-13',weeks);
  for (const query of ['week of oct 13','oct 13','October 13','Oct 13, 2026','2026-10-13'])
    assert.equal(model.findWeek(query,weeks),oct);
  for (const query of ['week 0','week 99','week nine','midterm','oct 32','Feb 29','oct 13, 2027','aug 1',''])
    assert.equal(model.findWeek(query,weeks),null,query);
  assert.equal(model.findWeek('week 1',[]),null);
});
