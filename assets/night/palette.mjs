/* The command palette is a shell service. Its data helpers stay pure for the Desk
   and tests; browser services are imported only when mount() initialises it. */
import {SCHEDULE} from '../cen-schedule.mjs?v=20261013-shift1';
import {resolveTarget,readSaved} from './targets.mjs?v=20261013-shift1';
import {recordsForCourse,semesterWeeks,findWeek} from '../book/weeks.mjs';

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
 for(const week of weeks)add('week-'+week.index,'Weeks',week.label,'week',{index:week.index,disabled:desk,hint:desk?'Open a course to choose a week':week.start?`${week.start} – ${week.end}`:'Date pending'});
 if(!desk){
  add('view-assignments','Views','Assignments','view',{target:'assignments',default:true});
  if(math)add('view-study','Views','Study','view',{target:'study',default:true});
  add('view-info','Views','Course info','view',{target:'info',default:true});
 }
 for(const [id,label] of [['desk','Desk'],['cen100','CEN100 · Engineering'],['mth140','MTH140 · Calculus I'],['mth141','MTH141 · Linear Algebra']])add('place-'+id,'Places',label,'place',{url:base?new URL(id==='desk'?'':id+'/',base).href:id==='desk'?'/':'/'+id+'/',default:true});
 if(math&&data)for(const topic of data.topics)add('topic-'+topic.id,'Math topics',topic.title,'topic',{target:'topic-'+topic.id,hint:topic.sections,keywords:topic.description});
 for(const [id,label,selector] of [['work',"This week's work",'#quick-work'],['contacts','Contacts','#quick-contacts'],['tools','Guide tools','.workspace-tools']])if(exists(selector))add('action-'+id,'Actions',label,'click',{target:selector,default:true});
 if(!desk&&exists('#calendar-tools'))add('action-calendar','Actions','Export calendar','calendar',{default:true});
 if(exists('.hub-theme'))add('action-theme','Actions',`Theme · ${theme}`,'click',{target:'.hub-theme',default:true});
 add('action-motion','Actions',motionPaused?'Play motion':'Pause motion','motion',{disabled:motionForced,hint:motionForced?'Reduced motion is enabled by your device or page setting':'',default:true});
 add('action-sound','Actions',sound?'Sound off':'Sound on','sound',{default:true});
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

let service=null,starting=null;
/** Initialises once, deliberately independent of a route AbortSignal. */
export function mount(){
 if(service)return Promise.resolve(service);
 return starting??=import('./core.mjs?v=20261013-shift2').then(core=>{
  service=createService(core);return service.reindex().then(()=>service);
 }).catch(error=>{starting=null;throw error;});
}
function createService(core){
 const dialog=document.createElement('dialog');dialog.className='ns-palette';dialog.id='ns-palette';dialog.setAttribute('aria-labelledby','ns-palette-title');
 dialog.innerHTML='<header><h2 id="ns-palette-title">Go to…</h2><button type="button" data-palette-close aria-label="Close command palette">Close</button></header><label class="ns-palette-label" for="ns-palette-input">Search commands and course work</label><input id="ns-palette-input" type="text" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="ns-palette-results" autocomplete="off"><div id="ns-palette-results" role="listbox" aria-label="Commands"></div><p class="ns-palette-status" aria-live="polite"></p>';
 document.body.append(dialog);
 const input=dialog.querySelector('input'),list=dialog.querySelector('[role="listbox"]'),status=dialog.querySelector('[aria-live]');
 let index={entries:[],weeks:[]},results=[],active=-1,opener=null,restore=true,bypass=false,version=0,holding=false;
 const release=()=>{if(holding){holding=false;core.release('palette');}};
 const select=position=>{
  active=position;
  for(const option of list.querySelectorAll('[role="option"]'))option.setAttribute('aria-selected',String(Number(option.dataset.result)===active));
  const selected=list.querySelector(`[data-result="${active}"]`);
  if(selected){input.setAttribute('aria-activedescendant',selected.id);selected.scrollIntoView({block:'nearest',behavior:'instant'});}else input.removeAttribute('aria-activedescendant');
 };
 const step=(direction,edge=false)=>{
  const enabled=results.map((entry,i)=>entry.disabled?-1:i).filter(i=>i>=0);
  if(!enabled.length)return;
  const at=enabled.indexOf(active);
  select(edge?(direction>0?enabled.at(-1):enabled[0]):enabled[(at+direction+enabled.length)%enabled.length]);
 };
 const render=(preserve=false)=>{
  const previous=preserve===true?results[active]?.id:null;
  results=[...searchIndex(index,input.value),{id:'guide-search',group:'Search the guide',label:`Search the guide for "${input.value}"`,type:'search',disabled:!document.querySelector('#guide-search'),match:{indices:[]}}];
  list.replaceChildren();let group=null,parent;
  results.forEach((entry,i)=>{
   if(group!==entry.group){group=entry.group;parent=document.createElement('div');parent.setAttribute('role','group');const label=document.createElement('div');label.className='ns-palette-group';label.id='ns-palette-group-'+i;label.textContent=group;parent.setAttribute('aria-labelledby',label.id);parent.append(label);list.append(parent);}
   const option=document.createElement('div');option.id='ns-palette-option-'+i;option.dataset.result=i;option.setAttribute('role','option');option.setAttribute('aria-selected','false');if(entry.disabled)option.setAttribute('aria-disabled','true');
   const title=document.createElement('span'),matched=new Set(entry.match?.indices||[]);let mark=null;
   for(const [position,char] of [...entry.label].entries()){
    if(matched.has(position)){if(!mark){mark=document.createElement('mark');title.append(mark);}mark.append(char);}else{mark=null;title.append(char);}
   }
   option.append(title);if(entry.hint){const hint=document.createElement('small');hint.textContent=entry.hint;option.append(hint);}parent.append(option);
  });
  const remembered=results.findIndex(e=>e.id===previous&&!e.disabled);select(remembered>=0?remembered:results.findIndex(e=>!e.disabled));
  status.textContent=`${results.filter(e=>!e.disabled).length} commands. Use arrow keys to choose and Enter to open.`;
 };
 const reindex=async()=>{
  const ticket=++version,course=core.route(),data=core.isMath()?await core.courseData():course==='cen100'?SCHEDULE:null;
  if(ticket!==version||course!==core.route())return;
  const saved=data?readSaved(course,data):{},itemTitles={};
  document.querySelectorAll('[id^="guide-item-"]').forEach(node=>{const title=node.querySelector('.title');if(title)itemTitles[node.id.replace('guide-item-','')]=title.textContent.trim();});
  const motion=core.preference();
  index=buildIndex({course,data,...saved,itemTitles,base:new URL('../../',import.meta.url).href,exists:selector=>!!document.querySelector(selector),theme:document.documentElement.dataset.theme||'auto',motionPaused:motion.scenePaused,motionForced:matchMedia('(prefers-reduced-motion: reduce)').matches||motion.forced,sound:core.soundEnabled()});
  if(dialog.open)render(true);
 };
 const finish=()=>{
  release();input.setAttribute('aria-expanded','false');
  const target=opener;opener=null;
  if(restore&&target?.isConnected&&!target.closest('[hidden],[inert]')&&!document.querySelector('dialog[open]'))target.focus({preventScroll:true});
  restore=true;
 };
 const close=(returnFocus=true)=>{
  if(!dialog.open)return;
  restore=returnFocus;release();dialog.close();finish();
 };
 const focus=node=>{if(!node)return;if(!node.matches('button,a,input,select,textarea,summary,[tabindex]'))node.tabIndex=-1;node.focus({preventScroll:true});};
 const fallbackSearch=query=>{
  const button=document.querySelector('.workspace-search'),panel=document.querySelector('#workspace-search'),field=document.querySelector('#guide-search');if(!field)return;
  if(button&&button.getAttribute('aria-expanded')!=='true'){bypass=true;try{button.click();}finally{bypass=false;}}
  if(panel)panel.hidden=false;
  window.GuideMotion?.cancel(panel);field.value=query;field.dispatchEvent(new Event('input',{bubbles:true}));field.focus({preventScroll:true});
 };
 const openWeek=async entry=>{
  const route=core.route(),week=index.weeks[entry.index];
  const event=new CustomEvent('book-open-week',{detail:{index:entry.index},cancelable:true});document.dispatchEvent(event);if(event.defaultPrevented||core.route()!==route)return;
  window.CourseWorkspace?.show('assignments',true);await core.frames(2);if(core.route()!==route)return;
  const timeline=document.querySelector('.ns-timeline');if(!timeline)return;
  timeline.scrollIntoView({block:'center',behavior:core.motionAllowed()?'smooth':'auto'});
  const node=[...timeline.querySelectorAll('.ns-tl-node[data-date]')].find(node=>week?.start&&node.dataset.date>=week.start&&node.dataset.date<=week.end);
  const scroller=timeline.querySelector('.ns-tl-scroll'),track=timeline.querySelector('.ns-tl-track');
  if(scroller){
   if(node)scroller.scrollLeft=node.offsetLeft-scroller.clientWidth/2;
   else if(week?.start&&track){
    const day=date=>Date.parse(date+'T12:00:00Z'),fraction=Math.max(0,Math.min(1,(day(week.start)-day(core.TERM.start))/(day(core.TERM.end)-day(core.TERM.start))));
    scroller.scrollLeft=Math.max(0,fraction*track.scrollWidth-scroller.clientWidth/2);
   }
  }
  focus(node||timeline);
 };
 const run=async position=>{
  const entry=results[position];if(!entry||entry.disabled)return;
  const query=input.value,course=index.course;close(false);
  switch(entry.type){
   case 'item':
    // A sheet must remember a route control, never the now-closed combobox.
    focus(document.querySelector('.workspace-nav [data-workspace-view="assignments"]'));
    await core.openItem(entry.target);break;
   case 'week':await openWeek(entry);break;
   case 'view':window.CourseWorkspace?.show(entry.target,true);focus(document.querySelector('.workspace-nav [data-workspace-view="'+entry.target+'"]'));break;
   case 'topic':
    window.CourseWorkspace?.show('study',true);await core.frames(2);if(core.route()!==course)return;
    {const node=document.getElementById(entry.target);if(node){node.hidden=false;node.open=true;window.GuideMotion?.cancel(node);node.scrollIntoView({block:'start',behavior:core.motionAllowed()?'smooth':'auto'});focus(node.querySelector('summary')||node);}}break;
   case 'place':if(window.TMURouter?.navigate)await window.TMURouter.navigate(entry.url);else location.assign(entry.url);break;
   case 'click':document.querySelector(entry.target)?.click();if(entry.target==='.hub-theme')focus(document.querySelector(entry.target));break;
   case 'calendar':
    window.CourseWorkspace?.show('info',true);
    {const calendar=document.querySelector('#calendar-tools');if(calendar){for(let parent=calendar;parent;parent=parent.parentElement)if(parent.matches('details')){window.GuideMotion?.cancel(parent);parent.open=true;}focus(calendar.querySelector('summary')||calendar);calendar.scrollIntoView({block:'start',behavior:'auto'});}}break;
   case 'motion':core.toggleMotion();focus(document.querySelector('[data-ns-motion],.hub-theme'));break;
   case 'sound':core.setSound(!core.soundEnabled());focus(document.querySelector('.hub-theme'));break;
   case 'external':{const link=document.createElement('a');link.href=entry.url;link.target='_blank';link.rel='noopener noreferrer';link.click();}break;
   case 'search':fallbackSearch(query);break;
  }
 };
 const open=async target=>{
  if(dialog.open){input.focus();return;}
  opener=target||document.activeElement;restore=true;input.value='';render();holding=true;core.hold('palette');
  try{dialog.showModal();input.setAttribute('aria-expanded','true');input.focus();await reindex();}catch(error){release();throw error;}
 };
 document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&event.target.closest?.('#workspace-search')){
   const button=document.querySelector('.workspace-search');if(button?.getAttribute('aria-expanded')==='true'){event.preventDefault();event.stopPropagation();bypass=true;try{button.click();}finally{bypass=false;}button.focus();}
   return;
  }
  if((event.metaKey||event.ctrlKey)&&!event.altKey&&!event.isComposing&&event.key.toLowerCase()==='k'){event.preventDefault();if(dialog.open)close();else open(document.activeElement);}
 },true);
 document.addEventListener('click',event=>{
  const target=event.target.closest?.('[data-ns-search],.workspace-search');if(!target||bypass)return;
  event.preventDefault();event.stopImmediatePropagation();open(target);
 },true);
 input.addEventListener('input',render);
 dialog.addEventListener('keydown',event=>{
  if(event.isComposing)return;
  if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();return;}
  if(event.target!==input)return;
  if(['ArrowDown','ArrowUp','Home','End','Enter'].includes(event.key)){event.preventDefault();event.stopPropagation();}
  if(event.key==='ArrowDown')step(1);else if(event.key==='ArrowUp')step(-1);else if(event.key==='Home')step(-1,true);else if(event.key==='End')step(1,true);else if(event.key==='Enter')run(active);
 });
 list.addEventListener('pointermove',event=>{const option=event.target.closest('[data-result]');if(option&&!results[Number(option.dataset.result)]?.disabled)select(Number(option.dataset.result));});
 list.addEventListener('pointerdown',event=>event.preventDefault());
 list.addEventListener('click',event=>{const option=event.target.closest('[data-result]');if(option)run(Number(option.dataset.result));});
 dialog.querySelector('[data-palette-close]').addEventListener('click',()=>close());
 dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
 dialog.addEventListener('close',()=>{if(!dialog.open&&opener)finish();});
 dialog.addEventListener('click',event=>{if(event.target===dialog){const box=dialog.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)close();}});
 document.addEventListener('route-changed',()=>{close(false);reindex();});
 for(const type of ['guide-completion','workspace-changed','course-view-change','course-schedule','guide-motion-change','night-sound'])document.addEventListener(type,()=>reindex());
 document.addEventListener('change',event=>{if(event.target.matches?.('#section-select,#contact-section,#contact-group'))queueMicrotask(reindex);});
 // Theme is changed by a synchronous shell button handler after click capture.
 document.addEventListener('click',event=>{if(event.target.closest?.('.hub-theme'))queueMicrotask(reindex);});
 return {open,close,reindex};
}
