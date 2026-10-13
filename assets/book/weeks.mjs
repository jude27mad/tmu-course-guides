/** One semester model for the book, its caption, fallback and palette.
 * All dates are Toronto calendar strings. schedule.mjs owns date arithmetic.
 * Source audit: course-data.mjs mentions a MTH141 study-week instruction but
 * provides no dated reading week; neither CEN SCHEDULE nor the guide supplies
 * one. Calendar gaps therefore remain teaching weeks. An explicitly dated
 * input record with kind:'reading' can identify a reading spread later.
 *
 * CEN calendar rows have no individual weights. Keep those null unless a row
 * supplies one; never divide the combined MATLAB/notebook/reflection grades.
 * Math weights are [all quizzes, midterm, final], so only midterm/final map to
 * an individual record. CEN's y9 date is the start of an exam period, not an
 * exam date: its guide completion key is item:y9 and its date stays pending.
 */
import {COURSES} from '../course-data.mjs';
import {today, addDays, dateLabel, dayLabel, resolveAssessment, timestamp} from '../schedule.mjs';

const WEEKDAYS=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const isObject=value=>Boolean(value)&&typeof value==='object'&&!Array.isArray(value);
const publishedWeight=value=>typeof value==='number'&&Number.isFinite(value)?value:null;
function calendarDate(value){
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;
  try {return today(new Date(timestamp(value,'12:00')))===value?value:null;} catch {return null;}
}
const monday=date=>addDays(date,-WEEKDAYS.indexOf(dayLabel(date)));
const recordDay=record=>calendarDate(record.date)||calendarDate(record.week);
const short=date=>`${dayLabel(date).slice(0,3)} ${dateLabel(date)}`;
// CEN final presentations/report are final-size project landmarks in teaching
// weeks. Their item handles distinguish them from the actual final exam.
const finalExam=record=>record.kind==='final'&&!['m6','m7'].includes(record.open);

/** Inclusive calendar spreads, followed by a dateless pending exam spread. */
export function semesterWeeks({start='2026-09-08',end='2026-12-21',records=[]}={}){
  if(!calendarDate(start)||!calendarDate(end)||end<start)throw new RangeError('Semester dates must form a valid inclusive range.');
  let last=end;
  for(const record of records){const date=recordDay(record);if(date&&date>last)last=date;}
  const weeks=[];
  for(let anchor=monday(start);anchor<=last;anchor=addDays(anchor,7)){
    const from=anchor<start?start:anchor,to=addDays(anchor,6)>last?last:addDays(anchor,6);
    const index=weeks.length,partial=from!==anchor||to!==addDays(anchor,6);
    const own=records.filter(record=>{const day=recordDay(record);return day&&day>=from&&day<=to;});
    const kind=anchor>end||own.some(finalExam)?'exam':own.some(r=>r.kind==='reading')?'reading':'teaching';
    const suffix=from!==anchor?` · from ${short(from)}`:partial?` · through ${short(to)}`:'';
    weeks.push({index,label:`Week ${index+1}${suffix}`,start:from,end:to,partial,kind,records:own});
  }
  // No fake anchor or date for a final that has only a month/period description.
  const pending=records.filter(record=>finalExam(record)&&!recordDay(record));
  if(pending.length)weeks.push({index:weeks.length,label:'Exam · Date pending',start:null,end:null,partial:false,kind:'exam',pending:true,records:pending});
  return weeks;
}

/** A zero-based array index; an empty model has the harmless sentinel 0. */
export function weekIndexFor(date,weeks){
  if(!weeks?.length||!calendarDate(date))return 0;
  const dated=weeks.filter(w=>w.start&&w.end);
  if(!dated.length||date<dated[0].start)return 0;
  const index=weeks.findIndex(w=>w.start&&w.end&&date>=w.start&&date<=w.end);
  return index<0?weeks.length-1:index;
}
export function currentWeekIndex(weeks,now=new Date()){return weekIndexFor(today(now),weeks);}

/** The 1-based term week of a Toronto date, for labels and deadline contracts: Monday-anchored weeks of the term
 * (Week 1 is the partial Sep 8-13), null before Sep 8 or after Dec 21. Unlike weekIndexFor(), which clamps to a
 * book spread, this never extends for exams. Fixtures: docs/qa/toronto-deadline-test-cases.md. */
const TERM_WEEKS=new Map();
export function termWeek(date,{start='2026-09-08',end='2026-12-21'}={}){
  if(!calendarDate(date)||date<start||date>end)return null;
  const key=start+end;
  if(!TERM_WEEKS.has(key))TERM_WEEKS.set(key,semesterWeeks({start,end}));
  return weekIndexFor(date,TERM_WEEKS.get(key))+1;
}

// Kind follows the existing CEN item mapping, not the schedule id's DOM prefix.
const CEN_KINDS={m3:'lab',y2:'lab',m4:'midterm',m6:'final',m7:'final',y4:'quiz',y9:'final'};
function flags(completed){
  if(!isObject(completed))return {};
  return Object.hasOwn(completed,'completed')?(isObject(completed.completed)?completed.completed:{}):completed;
}
const done=(entries,id)=>entries[id]===true||entries[id]===1;

/**
 * Inputs may be COURSES or a single course object; completed may be the saved
 * progress/plan envelope or its completed map. cenSchedule is explicit so this
 * pure module never imports the old classic schedule's global-writing wrapper.
 * A quiz's date follows resolveAssessment, but lab start is not a published quiz
 * time (especially the second-hour quiz): keep day precision and time:null.
 */
export function recordsForCourse(course,{courseData=COURSES,cenSchedule=[],section=0,completed={}}={}){
  const entries=flags(completed);
  if(course==='cen100'){
    const rows=cenSchedule.filter(row=>row.calendar!==false&&(!row.section||row.section===Number(section))).map(row=>{
      const date=calendarDate(row.date),week=calendarDate(row.week),time=date?(row.time||null):null;
      return {id:row.id,open:row.item,title:row.title,kind:row.kind||CEN_KINDS[row.item]||(/quiz/i.test(row.title)?'quiz':'minor'),
        date,week,time,precision:date?(time?'exact':'day'):week?'week':'pending',weight:publishedWeight(row.weight),completed:done(entries,row.id)};
    });
    // The final has no SCHEDULE row. The guide owns this stable item completion
    // key; y9's displayed Dec 9 is explicitly an exam-period placeholder.
    if(!rows.some(row=>row.open==='y9'))rows.push({id:'item:y9',open:'y9',title:'Final exam',kind:'final',date:null,week:null,time:null,precision:'pending',weight:24,completed:done(entries,'item:y9')});
    return rows;
  }
  const data=courseData?.[course]||courseData;
  if(!['mth140','mth141'].includes(course)||!Array.isArray(data?.assessments))return [];
  return data.assessments.map(assessment=>{
    const event=resolveAssessment(data,assessment,section),date=calendarDate(event.date),week=calendarDate(event.week),time=date?(event.time||null):null;
    const weight=publishedWeight(assessment.weight)??(assessment.kind==='midterm'?publishedWeight(data.weights?.[1]):assessment.kind==='final'?publishedWeight(data.weights?.[2]):null);
    return {id:assessment.id,open:'assessment-'+assessment.id,title:assessment.title,kind:assessment.kind,date,week,time,
      precision:date?(time?'exact':'day'):week?'week':'pending',weight,completed:done(entries,assessment.id)};
  });
}

/** Higher numbers sort larger. A bounded monotone cue cannot cross categories. */
export function popupRank(record){
  const category={minor:0,quiz:1,lab:1,midterm:2,final:3}[record.kind]??0;
  const weight=publishedWeight(record.weight);
  return category*2+(weight!==null&&weight>0?weight/(weight+100):0);
}

/** Match a displayed week number or a real date in the available calendar. */
export function findWeek(query,weeks){
  if(typeof query!=='string'||!weeks?.length)return null;
  const text=query.trim().toLowerCase().replace(/\s+/g,' ');
  const number=/^(?:week|wk|w)\s*(\d+)$/.exec(text);
  if(number){const index=Number(number[1])-1;return index>=0&&index<weeks.length?index:null;}
  const iso=calendarDate(text);
  if(iso){const index=weeks.findIndex(w=>w.start&&iso>=w.start&&iso<=w.end);return index<0?null:index;}
  const named=/^(?:week of )?([a-z]+)\.? (\d{1,2})(?:,? (\d{4}))?$/.exec(text);
  if(!named)return null;
  const [,month,day,year]=named;
  if(month.length<3)return null;
  for(const [index,week] of weeks.entries()){
    if(!week.start||!week.end)continue;
    for(let date=week.start;date<=week.end;date=addDays(date,1)){
      const [labelMonth,labelDay]=dateLabel(date).toLowerCase().split(' ');
      // Accept the full English month spelling as well as its familiar label.
      const fullMonth=['january','february','march','april','may','june','july','august','september','october','november','december'][Number(date.slice(5,7))-1];
      if((month===labelMonth||month===fullMonth)&&Number(day)===Number(labelDay)&&(!year||year===date.slice(0,4)))return index;
    }
  }
  return null;
}
