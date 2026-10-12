/* Night Shift entry. Static structure mounts immediately; motion modules load after first paint.
   Each feature module is independent: one failing to load never affects the guide or the others. */
import {whenWorkspace,course,META,$$,asset,VERSION,loadCSS,tier} from './core.mjs';
import {mountDeadline} from './deadline.mjs';
import {mountTimeline} from './timeline.mjs';

/* Order matters only for priority: warp first (it may be covering the page), then what the visitor sees first. */
const FEATURES=['warp','hero','scroll','backdrop','palette','feel'];

function labelPages(){
 const views=$$('.workspace-panel');
 views.forEach((panel,i)=>{const title=panel.querySelector(':scope > .workspace-page-title');if(title&&!title.dataset.nsIndex)title.dataset.nsIndex=`${META.code} / ${String(i+1).padStart(2,'0')}`;});
}
function load(name){
 return Promise.all([loadCSS(name),import(asset(`./${name}.mjs?v=${VERSION}`))])
  .then(([,module])=>module.mount?.())
  .catch(error=>{document.documentElement.dataset.nsFailed=((document.documentElement.dataset.nsFailed||'')+' '+name).trim();console.warn(`Night Shift: ${name} unavailable`,error);});
}
function loadFeatures(){
 const idle=window.requestIdleCallback?cb=>requestIdleCallback(cb,{timeout:900}):cb=>setTimeout(cb,120);
 // An arriving course switch must uncover the page immediately; everything else waits for an idle moment.
 const arriving=document.documentElement.classList.contains('ns-warp-in');
 const first=arriving?load('warp'):Promise.resolve();
 first.then(()=>idle(()=>{for(const name of FEATURES)if(!(arriving&&name==='warp'))load(name);}));
}
whenWorkspace(()=>{
 document.documentElement.classList.add('night');
 document.documentElement.dataset.nsCourse=course;
 document.documentElement.dataset.nsTier=tier();
 labelPages();
 mountDeadline();
 mountTimeline();
 try{loadFeatures();}catch(error){console.warn('Night Shift motion layer unavailable',error);}
});
