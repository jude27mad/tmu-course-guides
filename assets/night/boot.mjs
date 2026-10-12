/* Night Shift entry, in two explicit modes.
   desk (body[data-page=desk]): mount the Desk directory only. No course identity and no wait for CourseWorkspace.
   course (body[data-course]): static structure mounts with the workspace; motion modules load after first paint.
   Each feature module is independent: one failing to load never affects the guide or the others. */
import {whenWorkspace,isDesk,course,META,$$,asset,VERSION,loadCSS,tier} from './core.mjs';
import {mountDeadline} from './deadline.mjs';
import {mountTimeline} from './timeline.mjs';

/* Order is priority only. warp and backdrop are retired by the Desk & Semester Book plan (their files stay
   until Stage 6 removes them); palette and feel join once those modules exist, so no page requests a missing file. */
const FEATURES=['hero','scroll'];
const root=document.documentElement;

function labelPages(){
 const views=$$('.workspace-panel');
 views.forEach((panel,i)=>{const title=panel.querySelector(':scope > .workspace-page-title');if(title&&!title.dataset.nsIndex)title.dataset.nsIndex=`${META.code} / ${String(i+1).padStart(2,'0')}`;});
}
function failed(name,error){root.dataset.nsFailed=((root.dataset.nsFailed||'')+' '+name).trim();console.warn(`Night Shift: ${name} unavailable`,error);}
function load(name){
 return Promise.all([loadCSS(name),import(asset(`./${name}.mjs?v=${VERSION}`))])
  .then(([,module])=>module.mount?.())
  .catch(error=>failed(name,error));
}
function loadFeatures(){
 const idle=window.requestIdleCallback?cb=>requestIdleCallback(cb,{timeout:900}):cb=>setTimeout(cb,120);
 idle(()=>{for(const name of FEATURES)load(name);});
}

root.dataset.nsTier=tier();
if(isDesk){
 root.dataset.nsPage='desk';
 // Direct load of the Desk route; once the router lands (plan §12) it mounts and unmounts desk.mjs itself.
 import('./desk.mjs?v=20261012-desk2').then(m=>m.mount({root:document.getElementById('desk-main'),route:'desk',signal:new AbortController().signal,direct:true})).catch(error=>failed('desk',error));
}else{
 // Nothing lifts the old course-switch cover any more (warp is retired): a stale flag must never hide the page.
 root.classList.remove('ns-warp-in');
 whenWorkspace(()=>{
  root.classList.add('night');
  root.dataset.nsCourse=course;
  labelPages();
  mountDeadline();
  mountTimeline();
  try{loadFeatures();}catch(error){console.warn('Night Shift motion layer unavailable',error);}
 });
}
