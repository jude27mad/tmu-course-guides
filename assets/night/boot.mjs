/* Night Shift entry, in two explicit modes.
   desk (body[data-page=desk]): mount the Desk directory only. No course identity and no wait for CourseWorkspace.
   course (body[data-course]): static structure mounts with the workspace; motion modules load after first paint.
   Each feature module is independent: one failing to load never affects the guide or the others. */
import {setRoute,isDesk,course,META,$$,asset,VERSION,loadCSS,tier} from './core.mjs';
import * as deadline from './deadline.mjs';
import * as timeline from './timeline.mjs';
import {scope} from '../route-lifecycle.mjs';

const FEATURES=['hero','scroll'];
let live=null;
function labelPages(){
 if(!META)return;
 const views=$$('.workspace-panel');
 views.forEach((panel,i)=>{const title=panel.querySelector(':scope > .workspace-page-title');if(title&&!title.dataset.nsIndex)title.dataset.nsIndex=`${META.code} / ${String(i+1).padStart(2,'0')}`;});
}
function failed(name,error){const root=document.documentElement;root.dataset.nsFailed=((root.dataset.nsFailed||'')+' '+name).trim();console.warn(`Night Shift: ${name} unavailable`,error);}
async function load(name,state){
 try{const [,module]=await Promise.all([loadCSS(name),import(asset(`./${name}.mjs?v=${VERSION}`))]);if(live!==state||state.life.signal.aborted)return;state.modules.push(module);await module.mount?.(state.ctx);}catch(error){if(live===state)failed(name,error);}
}
export async function mount(ctx={}){
 unmount();setRoute(ctx.route);
 const life=scope(ctx),state=live={life,ctx:{...ctx,signal:life.signal},modules:[]};
 const root=document.documentElement;delete root.dataset.nsFailed;root.dataset.nsTier=tier();root.classList.remove('ns-warp-in');
 if(isDesk){
 root.dataset.nsPage='desk';root.classList.remove('night');delete root.dataset.nsCourse;
 try{const module=await import('./desk.mjs?v=20261012-desk2');if(live!==state)return;state.modules.push(module);await module.mount(state.ctx);}catch(error){if(live===state)failed('desk',error);}
 }else{
 root.classList.add('night');delete root.dataset.nsPage;root.dataset.nsCourse=course;labelPages();
 await deadline.mount(state.ctx);if(live!==state)return;timeline.mount(state.ctx);
 const run=()=>{for(const name of FEATURES)load(name,state);};
 if(window.requestIdleCallback){const id=window.requestIdleCallback(run,{timeout:900});life.own(()=>window.cancelIdleCallback?.(id));}else life.timeout(run,120);
 }
}
export function unmount(){
 if(!live)return;const state=live;live=null;state.life.dispose();
 for(const module of state.modules.reverse())module.unmount?.();
 timeline.unmount();deadline.unmount();
 document.documentElement.classList.remove('night');delete document.documentElement.dataset.nsCourse;delete document.documentElement.dataset.nsPage;
}
