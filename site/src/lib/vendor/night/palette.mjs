/* The command palette is a shell service. Its data helpers stay pure for the Desk
   and tests; browser services are imported only when mount() initialises it. */
import {SCHEDULE} from '../cen-schedule.mjs';
import {resolveTarget,readSaved} from './targets.mjs';
import {recordsForCourse,semesterWeeks,findWeek} from '../book/weeks.mjs';

/* Visible text and screen-reader labels from docs/copy/interface-copy.md ("Command palette"). */
export const COPY={
 title:'Search',
 placeholder:'Search courses, weeks, topics…',label:'Search courses, assessments, weeks, and topics',
 suggestion:query=>`Search the guide for "${query}"`,suggestionLabel:query=>`Search the guide for ${query}`,
 empty:query=>`No results for "${query}"`,emptyLabel:query=>`No results for ${query}. Try another search`,
 clear:'Clear',clearLabel:'Clear search',close:'Close',closeLabel:'Close search',
 results:count=>count===1?'1 result':`${count} results`
};
/** Group headings in display order of the copy: visible heading -> screen-reader label. */
export const GROUPS={Courses:'Courses',Assessments:'Assessments',Weeks:'Semester weeks',Topics:'Study topics',Actions:'Actions'};

/** Best case-insensitive subsequence, favouring prefixes, words and runs. */
export function fuzzyMatch(label,query){
 const text=String(label).toLowerCase(),needle=String(query).trim().toLowerCase().replace(/\s+/g,'');
 if(!needle)return {score:0,indices:[]};
 let previous=[];
 for(let j=0;j<needle.length;j++){
  const next=[];
  for(let i=0;i<text.length;i++){
   if(text[i]!==needle[j])continue;
   const points=10+(i===0?40:/[^a-z0-9]/.test(text[i-1])?20:0)-i*.1;
   if(j===0)next[i]={score:points,indices:[i]};
   else for(let k=0;k<i;k++)if(previous[k]){
    const score=previous[k].score+points+(i===k+1?12:-2*(i-k-1));
    if(!next[i]||score>next[i].score)next[i]={score,indices:[...previous[k].indices,i]};
   }
  }
  previous=next;
 }
 return previous.reduce((best,value)=>value&&(!best||value.score>best.score)?value:best,null);
}

const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
/** Week wording from the copy's Course book table: "Week 9 · Nov 2–8", read as "Week 9, November 2 to 8";
    the partial first week and the final day keep their own wording. Dates are Toronto calendar strings. */
export function weekCopy(week){
 const n=week.index+1;if(!week.start)return {label:week.label||`Week ${n}`,ariaLabel:null}; // e.g. "Exam · Date pending"
 const [,sm,sd]=week.start.split('-').map(Number),[,em,ed]=(week.end||week.start).split('-').map(Number),short=m=>MONTHS[m-1].slice(0,3);
 const single=week.start===(week.end||week.start),same=sm===em;
 const range=single?`${short(sm)} ${sd}`:same?`${short(sm)} ${sd}–${ed}`:`${short(sm)} ${sd}–${short(em)} ${ed}`;
 const spoken=single?`${MONTHS[sm-1]} ${sd}`:same?`${MONTHS[sm-1]} ${sd} to ${ed}`:`${MONTHS[sm-1]} ${sd} to ${MONTHS[em-1]} ${ed}`;
 const note=!week.partial?'':week.index===0?'. Partial first week':single?'. Final day of the semester':'';
 return {label:`Week ${n} · ${range}`,ariaLabel:`Week ${n}, ${spoken}${note}`};
}

/** Build commands from unchanged course records; target is the guide's handle. */
export function buildIndex({course='desk',data=null,section=0,completed={},itemTitles={},now=Date.now(),base=null,exists=()=>true,theme='auto',motionPaused=false,motionForced=false,sound=false}={}){
 const entries=[],math=course==='mth140'||course==='mth141',desk=course==='desk';
 const add=(id,group,label,type,extra={})=>entries.push({id,group,label,type,...extra});
 let next=null;
 if(!desk&&data){
  next=resolveTarget({course,data,section,completed,now});
  const assessments=math?data.assessments:data.filter(row=>!row.section||row.section===Number(section));
  for(const row of assessments){
   const target=resolveTarget({course,data,section,completed,now,id:row.id});
   add('assessment-'+row.id,'Assessments',target.title,'item',{target:target.open,hint:[target.when,target.label,target.cta,target.note].filter(Boolean).join(' · '),precision:target.precision,completed:!!completed[row.id],keywords:math?'':itemTitles[row.item]||'',default:row.id===next?.id});
  }
  if(!math)for(const [id,title] of Object.entries(itemTitles))if(!assessments.some(row=>row.item===id))add('item-'+id,'Assessments',title,'item',{target:id,hint:'Date pending · Check D2L',precision:'pending'});
 }
 const records=desk?[]:recordsForCourse(course,{courseData:data,cenSchedule:data||[],section,completed});
 const weeks=semesterWeeks({records});
 for(const week of weeks){const copy=weekCopy(week);add('week-'+week.index,'Weeks',copy.label,'week',{index:week.index,disabled:desk,ariaLabel:copy.ariaLabel,hint:desk?'Open a course to choose a week':week.start||/pending/i.test(copy.label)?'':'Date pending'});}
 // The current course's views sit with the course places: both move between pages of the guide.
 if(!desk){
  add('view-assignments','Courses','Assignments','view',{target:'assignments',default:true});
  if(math)add('view-study','Courses','Study','view',{target:'study',default:true});
  add('view-info','Courses','Course info','view',{target:'info',default:true});
 }
 for(const [id,label] of [['desk','Desk'],['cen100','CEN100 · Engineering'],['mth140','MTH140 · Calculus I'],['mth141','MTH141 · Linear Algebra']])add('place-'+id,'Courses',label,'place',{url:base?new URL(id==='desk'?'':id+'/',base).href:id==='desk'?'/':'/'+id+'/',default:true});
 if(math&&data)for(const topic of data.topics)add('topic-'+topic.id,'Topics',topic.title,'topic',{target:'topic-'+topic.id,hint:topic.sections,keywords:topic.description});
 for(const [id,label,selector] of [['work',"This week's work",'#quick-work'],['contacts','Contacts','#quick-contacts'],['tools','Guide tools','.workspace-tools']])if(exists(selector))add('action-'+id,'Actions',label,'click',{target:selector,default:true});
 if(!desk&&exists('#calendar-tools'))add('action-calendar','Actions','Export calendar','calendar',{default:true});
 if(exists('.hub-theme'))add('action-theme','Actions',`Theme · ${theme}`,'click',{target:'.hub-theme',default:true});
 add('action-motion','Actions',motionPaused?'Play motion':'Pause motion','motion',{disabled:motionForced,hint:motionForced?'Reduced motion is enabled by your device or page setting':'',default:true});
 // Sound reads as its state, with the action alongside ("Sound off. Turn sound on").
 {const turn=sound?'Turn sound off':'Turn sound on',state=sound?'Sound on':'Sound off';
  add('action-sound','Actions',state,'sound',{hint:turn,keywords:turn,ariaLabel:`${state}. ${turn}`,default:true});}
 add('action-d2l','Actions','Open D2L','external',{url:'https://courses.torontomu.ca/',default:true});
 return {course,entries,weeks};
}

/** Curated defaults, otherwise groups ranked by their strongest fuzzy hit. */
export function searchIndex(index,query){
 const text=String(query).trim();
 if(!text)return index.entries.filter(e=>e.default).map(e=>({...e,match:{score:0,indices:[]}}));
 const weekIndex=findWeek(text,index.weeks),groups=new Map();
 for(const entry of index.entries){
  if(entry.type==='week'&&entry.index===weekIndex)continue;
  let match=fuzzyMatch(entry.label,text);
  if(!match&&entry.keywords){const alternate=fuzzyMatch(entry.keywords,text);if(alternate)match={score:alternate.score-100,indices:[]};}
  if(!match)continue;
  if(!groups.has(entry.group))groups.set(entry.group,[]);
  groups.get(entry.group).push({...entry,match});
 }
 const results=[...groups.values()].map(group=>group.sort((a,b)=>b.match.score-a.match.score)).sort((a,b)=>b[0].match.score-a[0].match.score).flat();
 if(weekIndex!==null){const week=index.entries.find(e=>e.type==='week'&&e.index===weekIndex);if(week)results.unshift({...week,match:fuzzyMatch(week.label,text)||{score:Infinity,indices:[]}});}
 return results;
}

/* Vendored pure half: mount() and the browser service below it are not copied (they import night/core.mjs, which touches the DOM). */
