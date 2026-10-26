/* CEN100 guide logic and interface copy that lived inside the mount() closure of assets/cen-guide.mjs.
   The data literals are in ./cen-literals.mjs (copied line for line). Below, the closure's helpers are lifted
   to module scope unchanged except that the closure variables they read (SCHEDULE, STAFFING, the plan) are now
   module imports or parameters. Every string is the old page's own wording, in the order the closure has it.
   Pure: no DOM, no storage access at import. */
import {SCHEDULE} from '../vendor/cen-schedule.mjs';
import {TEAM,YOU,RULES,CONFIRMED,OPEN,STAFFING,SOURCE_INFO,sourceFor,WHO,I,KEY,PROFILE_KEY,FILTER_KEY,PLAN_KEY,SEEN_KEY,GUIDE_VERSION} from './cen-literals.mjs';

export {TEAM,YOU,RULES,CONFIRMED,OPEN,STAFFING,SOURCE_INFO,sourceFor,WHO,I,KEY,PROFILE_KEY,FILTER_KEY,PLAN_KEY,SEEN_KEY,GUIDE_VERSION};

// cen-guide.mjs:229-235
export const D=s=>new Date(s+"T12:00:00Z");
export const mon=s=>D(s).toLocaleDateString("en-CA",{month:"short",timeZone:"UTC"}).replace(".","");
export const wk=s=>D(s).toLocaleDateString("en-CA",{weekday:"short",timeZone:"UTC"}).replace(".","");
export const cd=n=>n===0?"Today":n===1?"1 day":n+" days";

// cen-guide.mjs:239-253 (Toronto helpers; the site uses vendor/schedule.mjs, these stay for parity checks)
export function torontoToday(now=new Date()){
  const p=Object.fromEntries(new Intl.DateTimeFormat("en-CA",{timeZone:"America/Toronto",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(now).map(x=>[x.type,x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}
export function torontoTimestamp(date,time){
  const [year,month,day]=date.split("-").map(Number),[hour,minute]=time.split(":").map(Number);
  const target=Date.UTC(year,month-1,day,hour,minute);let value=target;
  const fmt=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Toronto",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"});
  for(let i=0;i<2;i++){const p=Object.fromEntries(fmt.formatToParts(new Date(value)).map(x=>[x.type,x.value]));value+=target-Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute,+p.second)}
  return value;
}
export function eventPassed(event,now=new Date()){return event.time?torontoTimestamp(event.date,event.time)<now.getTime():event.date<torontoToday(now)}
export function sortEvents(a,b){return (a.date+(a.time||"23:59")).localeCompare(b.date+(b.time||"23:59"))||a.id.localeCompare(b.id)}
export function itemDeadlines(id){return SCHEDULE.filter(e=>e.item===id&&e.calendar!==false).slice().sort(sortEvents)}
export function clockLabel(time){const [h,m]=time.split(":").map(Number);return `${h%12||12}:${String(m).padStart(2,"0")} ${h<12?"AM":"PM"}`}
export function eventLabel(event){return event.title+(event.time?`, ${clockLabel(event.time)} Toronto time`:"")}
// cen-guide.mjs:254-258: the date a card shows, its next date, and whether it has passed or is still upcoming.
export function itemTiming(item,now=new Date()){
  const events=itemDeadlines(item.id),pending=events.filter(e=>!eventPassed(e,now));
  const current=pending[0]||events.at(-1),next=pending.find(e=>e.date!==current?.date);
  return {past:events.length>0&&!pending.length,date:current?.date||item.date,next:next?.date||null,upcoming:pending.length>0};
}
// cen-guide.mjs:266-272
export function upcomingSchedule(completed={},selected=0,now=new Date()){
  return SCHEDULE.filter(e=>{
    if(eventPassed(e,now)||(e.section&&e.section!==selected)||completed[e.id])return false;
    if(e.calendar===false){const records=itemDeadlines(e.item);if(records.length&&records.every(record=>completed[record.id]))return false}
    return true;
  }).slice().sort(sortEvents);
}
// cen-guide.mjs:273: the header urgency for the next deadline's day count.
export function headUrgency(n){return n<=2?"close":n<=6?"soon":"calm"}

export const allItems=[...TEAM,...YOU];
export const byId=new Map(allItems.map(item=>[item.id,item]));
export const CALENDAR_DATES=SCHEDULE.filter(event=>event.calendar!==false);
/** Which list ("team" / "you") an item belongs to; the old tab titles are in COPY.tabs. */
export const listOf=item=>TEAM.includes(item)?"team":"you";
/** Every checklist key of an item in its literal order: `${item.id}-${groupIndex}-${checkIndex}`. */
export const checkKeys=item=>item.groups.flatMap((g,gi)=>g[1].map((_,i)=>`${item.id}-${gi}-${i}`));
export const TICK_KEYS=new Set(allItems.flatMap(checkKeys));

// cen-guide.mjs:433-439
export function validProfile(value){
  if(!value||typeof value!=="object")return null;
  const section=Number(value.section),staff=STAFFING.find(s=>s.sections.includes(section));
  if(!staff)return null;
  const group=Number(value.group);
  return {section,group:staff.groups.some(g=>g[0]===group)?group:null};
}
// cen-guide.mjs:624-647
export function recordsFor(item){const dates=itemDeadlines(item.id);return dates.length?dates:[{id:"item:"+item.id,item:item.id,title:item.name}]}
export const completionKeys=new Set(allItems.flatMap(item=>recordsFor(item).map(e=>e.id)));
export function validDate(value){return typeof value==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value+"T12:00:00Z"))&&new Date(value+"T12:00:00Z").toISOString().slice(0,10)===value}
export function cleanPlan(value,strict=false){
  const out={completed:{},notes:{},targets:{}};
  if(!value||typeof value!=="object"||Array.isArray(value)){if(strict)throw Error("Invalid personal planning data.");return out}
  for(const field of ["completed","notes","targets"]){
    const entries=value[field];
    if(entries===undefined)continue;
    if(!entries||typeof entries!=="object"||Array.isArray(entries)){if(strict)throw Error("Invalid personal planning data.");continue}
    for(const [key,v] of Object.entries(entries)){
      if(field==="completed"){
        if(!completionKeys.has(key))continue;
        if(v===1||v===true)out.completed[key]=1;
        else if(v!==0&&v!==false&&strict)throw Error("Invalid completion record in backup.");
      }else{
        if(!byId.has(key))continue;
        if(typeof v!=="string"||(field==="notes"?v.length>2000:v!==""&&!validDate(v))){if(strict)throw Error("Invalid note or target date in backup.");continue}
        if(v)out[field][key]=v;
      }
    }
  }
  return out;
}
// cen-guide.mjs:650-659 (completionSummary takes the plan's completed map instead of the closure's plan)
export function completionVerb(event){return event.id.startsWith("reflection-")?"Emailed":/^(intro|email|contract|outline|matlab-1|matlab-2|failure|notebook-1|notebook-2|report|peer|exit)$/.test(event.id)?"Submitted":"Completed"}
export function completionText(event){
  const name=event.title.replace(/ due$/,""),verb=completionVerb(event);
  return `${verb}: ${name}${event.date?` (${mon(event.date)} ${D(event.date).getUTCDate()}${event.time?`, ${clockLabel(event.time)} Toronto`:""})`:""}`;
}
export function completionSummary(item,completed={}){
  const records=recordsFor(item),done=records.filter(e=>completed[e.id]).length,total=records.length;
  const verbs=new Set(records.map(completionVerb));
  return {done,total,label:!done?"":done<total?`${done} of ${total} recorded`:verbs.size===1?[...verbs][0]:"Completed"};
}

/* cen-guide.mjs:753-759, updateSectionContent(): the section-specific texts of y7 (attendance) and y5 (reflections). */
export function sectionContent(profile){
  const section=profile?.section;
  const attendanceWhat=section===29?"Section 29: a D2L quiz opens 5:45 to 6:00 PM in every Wednesday tutorial. One attempt, and you have to be in the room.":section?`Attend your assigned Section ${section} tutorial in person. Check D2L for your section's quiz day, time and attempt rules.`:"Attendance quizzes take place during your assigned tutorial. Select your section above. The confirmed Section 29 window is Wednesday, 5:45 to 6:00 PM; other sections should check D2L.";
  const attendanceFact=section===29?"Section 29: Wednesday, 5:45 to 6:00 PM":"Check your assigned tutorial's quiz schedule on D2L";
  const staff=STAFFING.find(s=>s.sections.includes(section)),pm=staff?.groups.find(g=>g[0]===profile?.group);
  const reflectionsWhat=pm?byId.get("y5").what.replace("your assigned Project Manager",`${pm[1]}, your assigned Project Manager for Group ${pm[0]}`):byId.get("y5").what;
  return {y7:{what:attendanceWhat,fact:attendanceFact},y5:{what:reflectionsWhat}};
}

/* cen-guide.mjs:443-450, updateCourseContext(): the course label, page title and profile summary for a profile. */
export function profileText(profile){
  const staff=profile?STAFFING.find(s=>s.sections.includes(profile.section)):null;
  const label=profile?`CEN100 Section ${profile.section}${profile.group?`, Group ${profile.group}`:""}`:"CEN100 · Fall 2026";
  return {
    context:label,
    title:(profile?label:"CEN100")+" | TMU Course Guides",
    summary:profile?`Section ${profile.section}${profile.group?` · Group ${profile.group}`:" · Choose your group"}${staff?` · Lab: ${staff.location}`:""}`:"Choose your section & group",
  };
}

/* cen-guide.mjs:386-407, setupContactLookup(): who to ask for a section and group. */
export function contactLookup(section,group){
  const staff=STAFFING.find(s=>s.sections.includes(Number(section)));
  const pm=staff?.groups.find(([number])=>number===Number(group));
  return {
    ga:staff?{name:staff.ga,role:"Graduate Assistant (GA)",location:staff.location,locationText:"Lab/location: "+staff.location}:null,
    gaPrompt:"Choose your section to see your GA and lab/location.",
    pm:pm?{name:pm[1],role:"Project Manager"}:null,
    pmPrompt:"Choose your group to see your Project Manager.",
    groupPlaceholder:staff?"Choose your group":"Choose your section first",
    groups:staff?staff.groups.map(([number])=>({value:number,label:"Group "+number})):[],
  };
}

/* The rest of the closure's interface copy, in the order it appears in cen-guide.mjs. */
export const COPY={
  // :263 card badges and :288-303 next card
  datePassed:"Date passed",
  nextUp:"Next up",
  viewRequirements:"View requirements",
  markDone:"Mark done",
  markDoneLabel:event=>`Mark ${eventLabel(event)} done`,
  forYourRecords:"For your own records",
  headNoDeadlines:"No upcoming deadlines",
  headNext:n=>`Next deadline · ${cd(n)}`,
  // :329-338 card body bars
  fullMarks:"Full marks",
  loseMarks:"Lose marks",
  // :368 clear ticks
  clearTicksConfirm:"Clear all checklist ticks on this device? Your completion records, notes and target dates will stay saved.",
  // :432 blocked storage
  blocked:"Your browser is blocking local saving. You can still export your ticks.",
  // :487 and :492 hide-completed filter
  filterStatus:hiddenCount=>`${hiddenCount} fully checked ${hiddenCount===1?"item":"items"} hidden. Uncheck the filter to show everything.`,
  filterEmpty:"All items in this tab are fully checked. Turn off ‘Hide fully checked items’ to see them.",
  // :515-516 search
  contactsSearchTitle:"Who to ask: section and group lookup",
  tabs:{team:"Team",you:"Individual + pairs",rules:"Rules"},
  searchStatus:(count)=>`${count} ${count===1?"result":"results"}${count>12?"; showing the first 12. Refine your search for more.":"."}`,
  searchNone:"No matches. Try a shorter term.",
  // :541 calendar descriptions and :560-566 calendar status
  calendarNoUpcoming:"No upcoming dates in this selection. Uncheck ‘Upcoming dates only’ to include past deadlines.",
  calendarReady:count=>`Calendar file ready with ${count} ${count===1?"entry":"entries"}. Open or save the download, then add it to your calendar. Import once to avoid duplicates.`,
  // :573-575 per-card extras
  sources:"Sources: ",
  addToCalendar:"Add to calendar",
  // :581-588 backups
  backupTooLarge:"Choose a CEN100 backup smaller than 250 KB.",
  backupNotJson:"This file is not valid JSON. Choose an exported CEN100 backup.",
  backupUnsupported:"This is not a supported CEN100 backup.",
  backupInvalidTicks:"The backup contains invalid checklist values.",
  backupNoMatch:"This backup has no items matching the current guide.",
  backupReady:"Backup ready. It includes your checklist ticks, completion records, private notes and personal target dates.",
  backupImported:({added,records,filled,kept,skipped})=>`Imported ${added} new checklist ticks, ${records} completion records and ${filled} notes/target dates. Existing progress kept.${kept?` ${kept} conflicting notes/target dates kept as they were on this device.`:""}${skipped?` ${skipped} unrecognised checklist items skipped.`:""}`,
  // :665-666 completion counts and badges
  completionCount:(done,total)=>done?`${done}/${total} submission/completion records marked by you.`:"No submission/completion recorded yet.",
  completionBadgeTitle:(done,total)=>done?`${done}/${total} submission/completion records marked by you; separate from checklist progress.`:"",
  // :693-699 copy link
  copyAssignmentLink:"Copy assignment link",
  linkCopied:"Assignment link copied. Your progress and notes are not included.",
  linkSelect:"Select and copy this link. Your progress and notes are not included.",
  linkFieldLabel:"Assignment link to copy",
  // :702-716 personal tools
  personalSummary:"My plan & completion",
  personalLegend:"My submission / completion record",
  personalHint:"Mark these yourself after submitting or completing the work. Checklist ticks are separate. This guide does not submit work or verify D2L.",
  notesLabel:"My notes / responsibilities",
  targetLabel:"My target date (optional)",
  notesInfo:"Saved on this device and included in your exported backup. These notes are not shared with your team. Your target does not change the official deadline.",
  // :738-749 what should I work on
  workStatus:(count,range)=>count?`${count} ${count===1?"item":"items"} with completion still unrecorded.`:range==="week"?"Nothing unrecorded in the next 7 days. Choose All unfinished to review other work.":"All items are marked submitted/completed in your records.",
  workDatePassed:"Date passed: ",
  workAttendance:"During your assigned tutorial; confirm your section's schedule on D2L.",
  workNoOfficial:"No official deadline in this view.",
  workPending:"Official date pending. Check D2L.",
  workProgress:(remaining,boxes,pending)=>`${remaining}/${boxes} checklist items still unchecked · ${pending} completion ${pending===1?"record":"records"} unmarked.`,
  workTarget:target=>"My target: "+target+" (personal plan)",
  // :766 Mark done confirmation
  markedDone:(event,saved)=>"Marked done: "+eventLabel(event)+(saved?". Saved on this device.":". Local saving is blocked; export a backup to keep it."),
};

/* cen-guide.mjs:249, 536-570: the calendar file. Unchanged except that `byId` and the stamp come from module scope. */
export function torontoUTC(date,time){return new Date(torontoTimestamp(date,time)).toISOString().replace(/[-:]/g,"").replace(/\.\d{3}/,"")}
export function calendarDay(date){return date.replaceAll("-","")}
export function shiftDay(date,days){const value=new Date(date+"T12:00:00Z");value.setUTCDate(value.getUTCDate()+days);return value.toISOString().slice(0,10)}
export const icsEscape=text=>String(text).replace(/\\/g,"\\\\").replace(/\r?\n/g,"\\n").replace(/;/g,"\\;").replace(/,/g,"\\,");
export function foldLine(text){let line="",count=0,out=[];const encoder=new TextEncoder();for(const char of text){const size=encoder.encode(char).length;if(count+size>75){out.push(line);line=" ";count=1}line+=char;count+=size}out.push(line);return out.join("\r\n")}
export function buildCalendar(events,reminderDays,stamp=new Date().toISOString().replace(/[-:]/g,"").replace(/\.\d{3}/,"")){
  const lines=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//CEN100 Guide//Fall 2026//EN","CALSCALE:GREGORIAN","METHOD:PUBLISH","X-WR-CALNAME:CEN100 Fall 2026","X-WR-TIMEZONE:America/Toronto"];
  for(const event of events){
    const item=byId.get(event.item),description=[event.note||"",event.time?"Deadline time is Toronto time.":"Date confirmed; exact time is not specified in this calendar. Check D2L.","Use the submission method listed for this assignment.","Source: CEN100 Fall 2026 course outline and the guide's assignment summaries / confirmed course-team clarifications.","Calendar copies do not update automatically. Check D2L for changes."].filter(Boolean).join("\n");
    void item;
    lines.push("BEGIN:VEVENT",`UID:cen100-f26-${event.id}-jude27mad-github-io`,`DTSTAMP:${stamp}`,`SUMMARY:${icsEscape("CEN100: "+event.title)}`);
    if(event.time)lines.push(`DTSTART:${torontoUTC(event.date,event.time)}`);
    else lines.push(`DTSTART;VALUE=DATE:${calendarDay(event.date)}`,`DTEND;VALUE=DATE:${calendarDay(shiftDay(event.date,1))}`);
    lines.push(`DESCRIPTION:${icsEscape(description)}`,"URL:https://jude27mad.github.io/tmu-course-guides/cen100/","TRANSP:TRANSPARENT");
    if(reminderDays>0){
      lines.push("BEGIN:VALARM","ACTION:DISPLAY",`DESCRIPTION:${icsEscape("CEN100: "+event.title)}`);
      lines.push(event.time?`TRIGGER:-P${reminderDays}D`:`TRIGGER;VALUE=DATE-TIME:${torontoUTC(shiftDay(event.date,-reminderDays),"09:00")}`);
      lines.push("END:VALARM");
    }
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");return lines.map(foldLine).join("\r\n")+"\r\n";
}
/** cen-guide.mjs:556: the calendar's item choices (items with dated rows), in card order. */
export const calendarItems=()=>allItems.filter(item=>CALENDAR_DATES.some(event=>event.item===item.id)).map(item=>({value:item.id,label:item.name}));
/** cen-guide.mjs:560-562: the rows one download contains. */
export function calendarEvents(id="all",upcoming=true,now=new Date()){return CALENDAR_DATES.filter(event=>(id==="all"||event.item===id)&&(!upcoming||!eventPassed(event,now))).slice().sort(sortEvents)}

/* cen-guide.mjs:580-593: backup parsing, unchanged (validKeys = every checklist key). */
export function parseBackup(raw,validKeys=TICK_KEYS){
  if(typeof raw!=="string"||raw.length>250000)throw new Error("Choose a CEN100 backup smaller than 250 KB.");
  let data;try{data=JSON.parse(raw)}catch(e){throw new Error("This file is not valid JSON. Choose an exported CEN100 backup.")}
  if(!data||data.format!=="cen100-guide-backup"||![1,2].includes(data.version)||!data.ticks||typeof data.ticks!=="object"||Array.isArray(data.ticks))throw new Error("This is not a supported CEN100 backup.");
  const checked={},entries=Object.entries(data.ticks);let skipped=0;
  for(const [key,value] of entries){
    if(!validKeys.has(key)){skipped++;continue}
    if(value!==true&&value!==false&&value!==1&&value!==0)throw new Error("The backup contains invalid checklist values.");
    if(value===true||value===1)checked[key]=1;
  }
  const plan=data.version===2?cleanPlan(data.personal,true):cleanPlan({});
  if(entries.length&&skipped===entries.length&&!Object.values(plan).some(v=>Object.keys(v).length))throw new Error("This backup has no items matching the current guide.");
  return {checked,skipped,plan};
}

/* cen-guide.mjs:723-737, workEntries(): "What should I work on?" over a cleaned plan. */
export function workEntries(range,completed={},targets={},now=new Date()){
  const today=torontoToday(now),entries=[];
  const days=(s,reference)=>Math.round((D(s)-D(reference))/864e5);
  for(const item of allItems){
    if(recordsFor(item).every(e=>completed[e.id]))continue;
    const pending=recordsFor(item).filter(e=>!completed[e.id]);
    const within=date=>{const n=days(date,today);return n>=0&&n<7};
    const target=targets[item.id],dated=pending.filter(e=>e.date);
    const visible=range==="week"?dated.filter(e=>!eventPassed(e,now)&&within(e.date)):dated;
    if(range==="week"&&!visible.length&&!(target&&within(target)))continue;
    const sortDate=[...visible.map(e=>e.date),...(target&&(range!=="week"||within(target))?[target]:[])].sort()[0]||"9999-12-31";
    entries.push({item,pending,visible,target,sortDate});
  }
  return entries.sort((a,b)=>a.sortDate.localeCompare(b.sortDate)||a.item.name.localeCompare(b.item.name));
}
/** cen-guide.mjs:744: the date line of one work entry. */
export function workDates({item,visible,target},now=new Date()){
  return visible.length?visible.map(e=>`${eventPassed(e,now)?"Date passed: ":""}${mon(e.date)} ${D(e.date).getUTCDate()}${e.time?` at ${clockLabel(e.time)} Toronto`:""} — ${e.title}`).join("; "):item.id==="y7"?"During your assigned tutorial; confirm your section's schedule on D2L.":target?"No official deadline in this view.":"Official date pending. Check D2L.";
}
