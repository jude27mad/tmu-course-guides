/* MTH140 / MTH141 guide logic and interface copy that lived inside the mount() closure of assets/math-guide.mjs.
   Extracted word for word and in order. The closure's `courseId` and `course` became parameters; markup that the
   closure built around its text became plain structured data ({type:'p'|'list'|'source', ...}) with the same words.
   Pure: no DOM, no storage access at import. */
import {DAY_NAMES,today,daysUntil,dateLabel,clock,addDays,resolveAssessment,assessmentPassed} from '../vendor/schedule.mjs';

// math-guide.mjs:31-33: the course's storage keys and release version.
export const keysFor=courseId=>({progress:courseId+'-progress-v1',section:courseId+'-section-v1',view:courseId+'-view-v1',seen:courseId+'-last-seen-update-v1'});
export const GUIDE_VERSION='2026-10-16-course-artwork';

// math-guide.mjs:49-54. The order of each list defines the check keys `${assessmentId}-${index}`.
export function prep(assessment,courseId){
  if(assessment.kind==='quiz')return ['Check the announced coverage on D2L.','Review the relevant lecture examples and recommended exercises.','Practise without notes, a calculator or a formula sheet.','Attend my assigned lab with blank paper; write my name, section and student number.','Turn my phone off and put it in my bag.'];
  if(assessment.kind==='midterm'&&courseId==='mth141')return ['Review all four announced chapters and their exact section ranges.','Complete the sample midterm under Course Information → Midterm Test Materials on D2L.','Practise the announced topics under timed, closed-book conditions.','Read the attached cover page and check my assigned test room on D2L.','Bring my physical TMU student ID and know my section number.','Book through the Test Centre by its deadline if using approved AAS accommodations.'];
  if(assessment.kind==='midterm')return ['Check D2L for the exact test coverage and room.','Review the relevant lecture examples and recommended problems.','Practise the assessed skills without any aids.','Read the test instructions and prepare my required identification and supplies.','Arrange approved accommodations or academic consideration in advance when needed.'];
  return ['Check the official exam schedule for my date, time and room.','Check the final coverage announcement and assessment instructions on D2L.','Review the relevant notes and recommended exercises.','Practise without a calculator, formula sheet or other aids.','Arrange any approved exam accommodations through the required process.'];
}
// math-guide.mjs:55-60
export function weight(assessment,course){return assessment.kind==='quiz'?`${course.weights[0]}% quiz category`:assessment.kind==='midterm'?`${course.weights[1]}% of course`:`${course.weights[2]}% of course`;}
export function labSummary(lab){return `${DAY_NAMES[lab.day]} ${clock(lab.start)}–${clock(lab.end)} · ${lab.room}`;}
export function certainty(a){if(a.kind==='final')return 'Date pending';if(a.rescheduled)return 'D2L-confirmed make-up';if(a.holiday)return 'Revised date needed';if(a.kind==='quiz')return a.date?'Lab date from timetable':'Announced week';return a.confirmed?'Announcement confirmed':'Course outline';}
/** dateTile(): the card's date tile as its three text lines ({top, main, bottom}; main is "DEC"-style when unknown). */
export function dateTile(event){if(event.date){const [month,day]=dateLabel(event.date).split(' ');return {top:month,main:day,bottom:event.kind==='quiz'?'lab':'',unknown:false};}return event.week?{top:'Week of',main:dateLabel(event.week),bottom:'',unknown:true}:{top:'Final',main:'DEC',bottom:'Date pending',unknown:true};}
/** countdown(): "N days away" / "Today" / "This week", as the next-assessment card shows it. */
export function countdown(event,now=new Date()){const date=event.date||event.week,n=daysUntil(date,now);if(!event.date&&n<=0)return {value:null,text:'This week'};if(n===0)return {value:null,text:'Today'};return {value:n,text:`${n===1?'day':'days'} away`};}

// math-guide.mjs:35-45
export function cleanProgress(value,course,courseId) {
  const knownChecks=new Set(course.assessments.flatMap(a=>prep(a,courseId).map((_,i)=>a.id+'-'+i)));
  const knownTopics=new Set(course.topics.flatMap(t=>t.skills.map((_,i)=>t.id+'-'+i)));
  const result={checks:{},completed:{},notes:{},targets:{},topics:{}};
  if(!value||typeof value!=='object'||Array.isArray(value))return result;
  for(const [key,allowed] of [['checks',knownChecks],['topics',knownTopics],['completed',new Set(course.assessments.map(a=>a.id))]])
    for(const id of allowed)if(value[key]?.[id]===true||value[key]?.[id]===1)result[key][id]=true;
  for(const a of course.assessments){const note=value.notes?.[a.id],date=value.targets?.[a.id];if(typeof note==='string')result.notes[a.id]=note.slice(0,2000);if(typeof date==='string'&&validDate(date))result.targets[a.id]=date;}
  return result;
}
export function validDate(value){return /^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value+'T12:00:00Z'))&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;}
export const checkKeys=(assessment,courseId)=>prep(assessment,courseId).map((_,i)=>assessment.id+'-'+i);
export const topicKeys=topic=>topic.skills.map((_,i)=>topic.id+'-'+i);

// math-guide.mjs:70-77: the section brief, page title and contacts.
export function sectionText(course,section){
  const lab=course.labs.find(x=>x.section===section);
  return {
    brief:lab?{section:`Section ${section}`,detail:labSummary(lab)}:null,
    briefPrompt:'Choose your section to see your lab, instructor and quiz dates.',
    title:`${course.code}${section?' · Section '+section:''}: ${course.name} | TMU Course Guides`,
    contacts:lab?[{heading:'Lecture instructor',text:'Current staff and office hours on D2L',href:'https://courses.torontomu.ca/'},{heading:'Lab / tutorial',text:labSummary(lab)}]:null,
    contactsPrompt:'Choose a section above to see your instructor and Academic Assistant.',
  };
}
// math-guide.mjs:145: the section select's option label.
export const sectionOption=lab=>`Section ${lab.section} (${String(lab.section).padStart(2,'0')}1 / ${String(lab.section).padStart(2,'0')}2)`;

// math-guide.mjs:87: the next card's eyebrow, note and empty state.
export function nextNote(event){return event.kind==='quiz'?(event.rescheduled?'Monday make-up date confirmed for October 19 on D2L. Check for changes.':'Quiz day follows your section’s lab timetable. Check D2L for changes.'):event.kind==='midterm'?'Room: check D2L. All times are Toronto time.':'';}
export const NEXT={
  eyebrow:(event,course)=>`Next assessment · ${weight(event,course)}`,
  viewRequirements:'View requirements',
  viewRequirementsLabel:event=>`View requirements for ${event.title}`,
  markDone:'Mark done',
  markDoneLabel:event=>`Mark ${event.title} done`,
  emptyEyebrow:'Your assessment records',
  emptyTitle:'No dated assessment ahead',
  emptyText:'Review the final-exam card for its pending schedule. Your completion records are saved on this device.',
  emptyAction:'View final exam',
  // :88 after-that list
  afterDetail:e=>e.holiday?'Thanksgiving conflict; revised date pending':e.time?`${clock(e.time)}–${clock(e.end)}`:e.lab?e.lab.room:'During your lab',
  afterWeek:'week',
  afterEmpty:'No later dated assessments. The final exam is awaiting its schedule.',
};
// math-guide.mjs:90: the per-card status, room and date note.
export function cardStatus(a,e,{completed,passed}){return completed?'Completed in my records':passed?'Date passed':certainty(e);}
export function labLocation(a,e){return e.lab?e.lab.room:a.kind==='quiz'?'Select a section':'Check D2L';}
export function dateNote(a,e,courseId){return e.rescheduled?'The October 8 D2L announcement confirms MTH140 Quiz 2 for Monday, October 19, in the second hour of the regular Monday lab.':e.holiday?'Your Monday lab falls on October 12, when the university is closed. Check D2L for revised arrangements.':a.kind==='quiz'&&a.id==='quiz-2'&&courseId==='mth140'?'The October 8 D2L announcement confirms the second hour of your October 13–16 lab. Check D2L for any changes.':a.kind==='quiz'?'The announced week is from the course documents. The displayed day and lab window come from your section timetable; check D2L for quiz time and changes.':'';}

// math-guide.mjs:94-100
export function rulesForAssessment(a,courseId){
  if(a.kind==='midterm'&&courseId==='mth141')return ['Know your MTH141 section number and bring your physical TMU student ID.','The test is closed-book: no calculators, notes, formula sheets or other aids.','Read the official midterm cover page on D2L for full assessment and marking instructions.','Turn phones off and follow the invigilators’ bag and device instructions.','Follow the pen or pencil guidance in the official announcement.'];
  if(a.kind==='quiz'&&courseId==='mth140'&&a.id==='quiz-2')return ['Study the Lab 5 questions on D2L covering Chapter 3, Sections 3.1–3.5.','The October 8 announcement places Quiz 2 in the second hour of your lab; Monday sections write on October 19.','Follow your TA’s instructions and confirm any later changes on D2L.'];
  if(a.kind==='quiz'&&courseId==='mth140'&&a.id==='quiz-1')return ['The September 22 announcement places Quiz 1 in the second hour of your lab. The first hour reviews continuity.','Bring blank paper with your name, section and student number. You do not need to copy the question.','No calculator or formula sheet. Turn your phone off and store it in your bag.'];
  if(a.kind==='quiz')return ['Attend your official assigned lab. This is an individual, closed-book assessment without notes, calculators or formula sheets.','Bring blank paper and write your name, section and student number at the top.','Keep phones turned off and stored in your bag.'];
  return ['Closed book. No calculator, formula sheet or other aids.','Check the latest D2L instructions for required identification, permitted supplies and room assignments.'];
}
// math-guide.mjs:103: the assessment card's text.
export function assessmentCard(a,courseId){
  return {
    roomLabel:a.kind==='quiz'?'Your lab room':'Test room',
    categoryLabel:a.kind==='quiz'?'Quiz category':'Assessment',
    category:a.kind==='quiz'?(courseId==='mth141'?'During your scheduled lab'+(a.duration?' · '+a.duration:''):'During your scheduled lab'):a.duration||'Check D2L for details',
    coversHeading:'What it covers',
    unconfirmed:!a.confirmed?'Check the latest D2L announcement before using this card to prepare.':'',
    rulesHeading:'Before you write',
    rules:rulesForAssessment(a,courseId),
    roomNote:a.kind==='midterm'&&courseId==='mth141'?'For the October 16 test, use the room assignment and cover-page attachment on D2L. The sample midterm and solutions are under Course Information → Midterm Test Materials. Any approved make-up has separate instructions from course staff.':'',
    checklistHeading:'My preparation checklist',
    checklist:prep(a,courseId),
    sourceLabel:'Source:',
    personalSummary:'My plan & completion',
    completedLabel:'I completed this assessment',
    completedNote:'Your own record, separate from the preparation checklist. It does not verify D2L or a grade.',
    notesLabel:'My notes',
    targetLabel:'My study target date',
    targetNote:'A personal study target. It does not change the assessment date.',
    copyLink:'Copy assessment link',
  };
}
// math-guide.mjs:107: the topic card's text.
export function topicCard(t,index,course,courseId){
  return {
    index:String(index+1).padStart(2,'0'),
    sub:`${t.sections} · about ${t.hours} lecture hours`,
    midterm:t.midterm?'On the midterm':'',
    skillsHeading:'My skill review',
    practiceHeading:'Recommended practice',
    practiceNote:'Ungraded. These references follow the official recommended problem sheet.',
    practice:course.practice.filter(r=>t.practiceSections.includes(r.section)).map(r=>({section:`Section ${r.section}`,rows:courseId==='mth140'?[{label:'',text:r.exercises}]:[{label:'Kuttler:',text:r.kuttler||'No exercises listed for this section.'},{label:'Nicholson:',text:r.nicholson||'No exercises listed for this section.'}]})),
    source:`Outline section range and approximate lecture hours: Course Management Form, ${courseId==='mth140'?'p. 5':'p. 4'}. Exercise references: official Recommended Problems document. Skill checklists are this guide’s study prompts, not an official marking rubric.`,
  };
}
// math-guide.mjs:110-111: counts.
export const COUNTS={
  prepared:(count,total)=>`${count}/${total} prepared`,
  completed:(count,total)=>`${count}/${total} completed in my records`,
  topic:(checked,total)=>checked?`${checked}/${total} skill checks`:'',
  review:(count,total)=>`${count}/${total} skill checks`,
};
// math-guide.mjs:112-124: rule cards, course notice, textbooks, sources and coordinator.
export function ruleCards(course,courseId){
  return [
    {title:'Assessment rules',blocks:[{type:'list',items:['At least 50% of total course marks is required to pass.','Quizzes and exams are individual work, closed book, with no calculator, formula sheet or other aids.',course.quizPolicy,'Recommended homework is practice and is not submitted for grading.']},{type:'source',text:'Source: Course Management Form and course FAQ.'}]},
    {title:'If you miss an assessment',blocks:[{type:'p',text:'Your first missed lab quiz is handled by the dropped lowest grade; the course announcements say not to submit an ACR for that first missed quiz.'},{type:'p',text:courseId==='mth141'?'For a second missed lab quiz, email your instructor and submit an Academic Consideration Request within 3 business days. Once approved, the quiz average uses the remaining quizzes.':'For further missed quizzes, contact your instructor or TA and follow the current Academic Consideration procedure. There is no lab-quiz make-up.'},{type:'p',text:'For a missed midterm or final, contact your instructor promptly and follow the official ACR process. Make-ups require a valid, approved reason.'},{type:'source',text:'Source: Course Management Form, missed-evaluation rules, and quiz announcements.'}]},
    {title:'Regrading & communication',blocks:[...(courseId==='mth141'?[{type:'p',text:"The V3 outline allows up to 10 business days for term-test grades, barring unforeseen circumstances. For midterm feedback, start with your AA, then contact your instructor if needed."}]:[]),{type:'p',text:'Request regrading or recalculation within 10 working days after the graded assessment is returned, subject to the current University and course procedure. The whole assessment may be regraded and the mark may increase or decrease.'},{type:'p',text:'Use your official TMU email, include your name, student number, course and section. Check D2L first and allow at least one business day for a response.'},{type:'source',text:'Source: Course Management Form and FAQ.'}]},
    {title:'Dates that still need confirmation',blocks:[{type:'list',items:[courseId==='mth140'?'Quiz 3–4 scope and exact midterm coverage.':'Quiz 3–5 coverage.','Exact final-exam date, time, room and announced topic list.','Any changes to the published section timetable.',courseId==='mth140'?'Check D2L for any later changes to the confirmed Quiz 2 timetable.':'Later quiz instructions and the final-exam Test Centre booking deadline.']},{type:'source',text:courseId==='mth141'?"MTH141 sources reviewed October 23: V3 outline, August 26 FAQ, lab timetable, recommended problems and supplied lecture/lab files. Quiz 1–2 and midterm coverage comes from the September 17, October 1 and October 5 announcements. Check D2L for newer announcements.":'The guide includes supplied course documents and relevant announcements through October 8, reviewed October 12. Check D2L for newer changes.'}]},
    ...(courseId==='mth141'?[
        {
          "title": "Quiz timing & accommodations",
          "blocks": [
            {
              "type": "p",
              "text": "The standard quiz writing time is 10 minutes; everyone receives 15 minutes, including the 50% extra-time allowance. A lab window is not the exact quiz start time."
            },
            {
              "type": "p",
              "text": "If your AAS plan requires more than 50% extra time or another accommodation, contact your instructor promptly. Book accommodated midterms and finals through the Test Centre by its deadline. If you are waiting for an AAS appointment, contact your instructor before the approaching test."
            },
            {
              "type": "source",
              "text": "Source: MTH141 FAQ 4.10. Follow any newer D2L instructions."
            }
          ]
        },
        {
          "title": "Lecture notes & lab practice",
          "blocks": [
            {
              "type": "list",
              "items": [
                "Chapter 4 notes supplied: 4.1–4.7 cover vectors, geometry and dot products; 4.8 covers plane equations; 4.9 covers cross products; 4.10.1–4.10.2 covers spanning, independence and bases.",
                "For earlier material, Lab 1 practises complex arithmetic and polar form; Lab 2 practises complex roots, quadratics and reduced row-echelon form; Lab 3 covers rank, homogeneous systems and matrix operations; Lab 4 covers symmetric matrices, transposes and inverses.",
                "Find the original notes and lab files in your instructor’s D2L materials. Open Study in this guide for all 40 rows of recommended Kuttler/Nicholson exercise references."
              ]
            },
            {
              "type": "p",
              "text": "These are available practice materials, not confirmed Quiz 3 coverage. The announcement determines scope, even when a lab or slide file contains extra topics."
            },
            {
              "type": "source",
              "text": "Source: supplied lecture notes, Lab 1 questions, Lab 2–4 solutions and Recommended Problems MTH141 F26; reviewed October 23."
            }
          ]
        }
    ]:[])
  ];
}
export function courseNotice(courseId){
  return courseId==='mth140'
    ?{title:'Which quiz-drop rule applies?',blocks:[{type:'p',text:'The Fall 2026 outline lists four quizzes, one lowest quiz dropped, and a 15% category. The September 22 Quiz 1 announcement confirms the lowest-grade drop. The FAQ’s “two out of ten” wording conflicts with those documents and is not used here.'}]}
    :{"title": "Remaining quizzes & the final exam", "blocks": [{"type": "p", "text": "The V3 outline lists the remaining quiz weeks as November 2, November 16 and November 30. Write in your assigned lab; the final tutorial is in the week of November 30. Exact Quiz 3–5 coverage still needs the D2L announcements."}, {"type": "p", "text": "The final is worth 45% and is scheduled for the December examination period. The FAQ says post-midterm material unless otherwise announced. The exact final date, time, room and topic list were not supplied as of October 23."}]};
}
// math-guide.mjs:125: the three views, in tab order.
export const VIEWS=['assessments','topics','help'];
// math-guide.mjs:132-135: search.
export const SEARCH={
  assessment:'Assessment',
  topic:'Topic map',
  status:count=>`${count} ${count===1?'result':'results'}${count>12?'; showing the first 12. Refine your search for more.':'.'}`,
  none:'No matches. Try a shorter term.',
};
// math-guide.mjs:137: what should I work on.
export function workRows(course,section,progress,range,now=new Date()){
  const day=today(now),end=addDays(day,6);
  return course.assessments.filter(a=>!progress.completed[a.id]).map(a=>({a,e:resolveAssessment(course,a,section),target:progress.targets[a.id]})).filter(({e,target})=>range==='all'||(!assessmentPassed(e,now)&&((e.date&&e.date<=end)||(e.week&&e.week<=end)))||(target&&target>=day&&target<=end)).sort((a,b)=>(a.target||a.e.sortDate).localeCompare(b.target||b.e.sortDate));
}
export const WORK={
  target:target=>` · My study target: ${target}`,
  empty:'No unrecorded assessments or study targets in this view.',
};
// math-guide.mjs:47, :139, :170, :178-180: saving, sharing, Mark done, calendar and backups.
export const COPY={
  blocked:'This browser is blocking local saving. Export a backup to keep your progress.',
  linkCopied:'Link copied. Your private progress and section choice are not included.',
  linkCopyLabel:'Copy this link',
  linkFieldLabel:'Assessment link to copy',
  markedDone:(a,saved)=>'Marked done: '+a.title+(saved?'. Saved on this device.':'. Local saving is blocked; export a backup to keep it.'),
  calendarNeedsSection:'Choose your section first to include lab quiz dates.',
  calendarNone:'No dated assessments match those choices.',
  calendarReady:count=>`${count} assessment${count===1?'':'s'} exported. Imported calendars do not update automatically.`,
  backupExported:'Backup exported for this course.',
  backupTooLarge:'This file is too large for a course-progress backup.',
  backupInvalid:code=>'Choose a valid progress backup for '+code+'.',
  backupImported:conflicts=>'Progress imported.'+(conflicts?' Existing conflicting notes or target dates were kept.':''),
};
