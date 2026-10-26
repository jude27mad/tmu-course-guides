/* Drawing inputs for the Desk, independent of the DOM and renderer. Course data
   and saved state remain the guides' own; this adapter never writes storage. */
import {COURSES} from '../course-data.mjs';
import {SCHEDULE} from '../cen-schedule.mjs?v=20261026-cen100';
import {COURSE_IDS,readSaved,resolveTarget,overall,parts,status,compact,targetDate,cenUpcoming} from '../night/targets.mjs?v=20261026-cen100';
import {recordsForCourse,semesterWeeks,currentWeekIndex,termWeek,popupRank} from '../book/weeks.mjs';
import {DAY_NAMES,clock,today,upcoming} from '../schedule.mjs';

const DEFAULT_DATA={cen100:SCHEDULE,mth140:COURSES.mth140,mth141:COURSES.mth141};
const CATEGORIES=['minor','quizLab','midterm','final'];

// Match assets/night/desk.mjs's sectionText without importing its DOM services.
function sectionLabel(course,data,section){
 if(!section)return null;
 if(course==='cen100')return `Section ${section}`;
 const lab=data.labs.find(row=>row.section===section);
 return lab?`Section ${section} · ${DAY_NAMES[lab.day].slice(0,3)} ${clock(lab.start)} lab · ${lab.room}`:`Section ${section}`;
}

function upcomingRecords(course,data,saved,records,now){
 const ids=new Set((course==='cen100'
  ?cenUpcoming(data,saved.completed,saved.section,now)
  :upcoming(data,saved.section,saved.completed,new Date(now))).map(row=>row.id));
 // Math's shared upcoming() excludes undated assessments; resolveTarget() still
 // features an incomplete pending final. Keep it as an upcoming landmark too.
 return records.filter(row=>!row.completed&&(ids.has(row.id)||course!=='cen100'&&!row.date&&!row.week));
}

/**
 * A snapshot keyed by cen100 / mth140 / mth141. `data` is an optional map from
 * those ids to the canonical CEN schedule array and math course objects.
 * `now` accepts a Date or epoch milliseconds; every field uses the same instant.
 * Storage is read exclusively by readSaved: denied/corrupt state means no saved
 * section or completions, while known official targets still match the Desk.
 *
 * Each course has {course, now, next, urgency, progress, kinds, week, section,
 * isOverall}. next preserves resolveTarget's fields and adds {status, compact,
 * targetDate}. progress is {completed, total, ratio, thisWeek}. The existing
 * boolean flags have no marking timestamps: thisWeek counts completed records
 * scheduled in the current Toronto week, not when someone clicked Mark done.
 * CEN progress counts its real calendar rows; book-only pending finals and
 * calendar:false reminders are not counted by the CEN completion reader.
 * kinds is {final, midterm, quizLab, minor}; week is {termWeek, spreadIndex}.
 * section is the Desk's saved-section text or null.
 */
export function deskSummary({now=Date.now(),storage,data=DEFAULT_DATA}={}){
 const instant=+new Date(now),date=new Date(instant),weekNumber=termWeek(today(date));
 const summary={};
 for(const course of COURSE_IDS){
  const source=data?.[course]??null;
  const saved=source?readSaved(course,source,storage):{section:0,completed:{}};
  const records=source?recordsForCourse(course,{courseData:source,cenSchedule:course==='cen100'?source:[],...saved}):[];
  const countedIds=course==='cen100'?new Set(source?.filter(row=>row.calendar!==false).map(row=>row.id)||[]):null;
  const counted=countedIds?records.filter(row=>countedIds.has(row.id)):records;
  const weeks=semesterWeeks({records}),index=currentWeekIndex(weeks,date),week=weeks[index];
  const completed=counted.filter(row=>row.completed).length;
  const thisWeek=weekNumber===null?0:counted.filter(row=>{
   const scheduled=row.date||row.week;
   return row.completed&&scheduled&&scheduled>=week.start&&scheduled<=week.end;
  }).length;
  const kinds={final:0,midterm:0,quizLab:0,minor:0};
  if(source)for(const row of upcomingRecords(course,source,saved,counted,instant))kinds[CATEGORIES[Math.floor(popupRank(row)/2)]]++;
  const target=source?resolveTarget({course,data:source,...saved,now:instant}):null;
  summary[course]={course,now:instant,
   next:target?{...target,status:status(target,instant),compact:compact(target,instant),targetDate:targetDate(target)}:null,
   urgency:parts(target,instant)?.state??'empty',
   progress:{completed,total:counted.length,ratio:counted.length?completed/counted.length:0,thisWeek},
   kinds,week:{termWeek:weekNumber,spreadIndex:index},section:source?sectionLabel(course,source,saved.section):null,isOverall:false};
 }
 const winner=deskOverall(summary,instant);
 for(const course of COURSE_IDS)summary[course].isOverall=winner!==null&&summary[course].next===winner;
 return summary;
}

/** The shared overall target, including presentation fields, or null. Does not
 * mutate the snapshot. Rebuild deskSummary when time or saved state changes so
 * the spine's isOverall/urgency flags continue to describe that same instant. */
export function deskOverall(summary,now=summary?.[COURSE_IDS[0]]?.now??Date.now()){
 return overall(COURSE_IDS.map(course=>summary?.[course]?.next).filter(Boolean),+new Date(now));
}

/** Only the overall exact target inside its positive six-hour window may pulse.
 * Day/week/pending targets, live events and other hot courses stay static. */
export function spineState(courseSummary){
 const next=courseSummary?.next;
 if(!next||next.precision==='empty')return {glow:'none',label:next?.compact||'Nothing scheduled'};
 const urgent=courseSummary.isOverall===true&&next.precision==='exact'&&courseSummary.urgency==='hot';
 return {glow:urgent?'urgent':'static',label:`${next.title} · ${next.compact}`};
}
