/* One interruptible motion owner per element. State changes stay synchronous. */
import {animate} from './vendor/motion-14.1.0.mjs';
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let paused=false;try{paused=localStorage.getItem('guide-motion-paused')==='true';}catch{}
const forced=new URLSearchParams(location.search).get('motion')==='off';
const tracks=new Map();
export const motionAllowed=()=>!forced&&!reduced.matches&&!paused;
export function cancel(el){const track=tracks.get(el);if(track){tracks.delete(el);track.stop();track.finish?.();}}
export function tween(el,draw,{duration=.28,done=()=>{}}={}){
 cancel(el);if(!motionAllowed()){draw(1);done();return;}
 let complete=false;
 const finish=()=>{if(complete)return;complete=true;draw(1);done();};
 const track=animate(0,1,{duration,ease:[.22,.8,.2,1],onUpdate:draw,onComplete:()=>{tracks.delete(el);finish();}});
 track.finish=finish;tracks.set(el,track);
}
export function reveal(el,distance=10){if(!el)return;cancel(el);tween(el,t=>{el.style.opacity=String(.35+.65*t);el.style.transform=`translateY(${distance*(1-t)}px)`;},{done:()=>{el.style.opacity='';el.style.transform='';}});}
export function visibility(el,open,done=()=>{}){
 cancel(el);const start=el.hidden?0:el.getBoundingClientRect().height;el.hidden=false;el.style.height='auto';const full=el.getBoundingClientRect().height;el.style.overflow='clip';
 tween(el,t=>{el.style.height=`${start+((open?full:0)-start)*t}px`;el.style.opacity=String(open?.25+.75*t:1-t);},{duration:.22,done:()=>{el.hidden=!open;el.style.height='';el.style.overflow='';el.style.opacity='';done();}});
}
export function capture(root=document){return new Map([...root.querySelectorAll('#teamlist>.tile,#youlist>.tile,#assessment-list>li')].filter(e=>e.getClientRects().length).map(e=>[e,e.getBoundingClientRect()]));}
export function reflow(before){if(!motionAllowed())return;for(const [el,rect]of before){if(!el.isConnected||!el.getClientRects().length||el.closest('dialog'))continue;const next=el.getBoundingClientRect(),dy=rect.top-next.top;if(Math.abs(dy)>1&&Math.abs(dy)<innerHeight){cancel(el);tween(el,t=>{el.style.transform=`translateY(${dy*(1-t)}px)`;},{done:()=>el.style.transform=''});}}}
export function dialogOpen(el,from){
 cancel(el);el.dataset.motionManaged='true';el.dataset.closing='false';
 // Keep the toolbar fixed so Close remains hittable during the entrance.
 const content=el.querySelector('.lab-content,.sheet-content')||el,rect=content.getBoundingClientRect(),mobile=innerWidth<=600;
 const dx=from?from.left-rect.left:mobile?0:40,dy=from?from.top-rect.top:mobile?40:0,sx=from?Math.max(.45,Math.min(1,from.width/rect.width)):1;
 content.style.transformOrigin='0 0';tween(el,t=>{content.style.opacity=String(.35+.65*t);content.style.transform=`translate(${dx*(1-t)}px,${dy*(1-t)}px) scale(${sx+(1-sx)*t})`;},{duration:.34,done:()=>{content.style.opacity='';content.style.transform='';content.style.transformOrigin='';}});
}
export function dialogClose(el,done,to){cancel(el);if(!el.open){done();return;}el.dataset.closing='true';const rect=el.getBoundingClientRect(),mobile=innerWidth<=600,dx=to?to.left-rect.left:mobile?0:36,dy=to?to.top-rect.top:mobile?36:0,s=to?Math.max(.45,Math.min(1,to.width/rect.width)):1;
 el.style.transformOrigin='0 0';tween(el,t=>{el.style.opacity=String(1-.8*t);el.style.transform=`translate(${dx*t}px,${dy*t}px) scale(${1+(s-1)*t})`;},{duration:.2,done:()=>{el.style.opacity='';el.style.transform='';el.style.transformOrigin='';el.dataset.closing='false';done();}});
}
function updatePreference(){document.documentElement.dataset.motion=motionAllowed()?'on':'off';if(!motionAllowed())for(const el of [...tracks.keys()])cancel(el);document.dispatchEvent(new CustomEvent('guide-motion-change',{detail:{enabled:motionAllowed()}}));}
export function setPaused(value){paused=value;try{localStorage.setItem('guide-motion-paused',String(value));}catch{}updatePreference();}
export const preference=()=>({paused,reduced:reduced.matches,forced});
window.GuideMotion={reveal,visibility,capture,reflow,dialogOpen,dialogClose,cancel,motionAllowed};
reduced.addEventListener('change',updatePreference);window.addEventListener('storage',e=>{if(e.key==='guide-motion-paused'){paused=e.newValue==='true';updatePreference();}});updatePreference();
function mount(){
 const nav=document.querySelector('.workspace-nav');if(!nav)return;
 const marker=document.createElement('span');marker.className='workspace-nav-marker';marker.setAttribute('aria-hidden','true');nav.prepend(marker);
 let previous=null;
 function indicator(){const active=nav.querySelector('[aria-current]');if(!active)return;const rect=active.getBoundingClientRect(),box=nav.getBoundingClientRect(),next={x:rect.left-box.left,y:rect.top-box.top,w:rect.width,h:rect.height};const from=previous||next;previous=next;
 tween(marker,t=>{marker.style.transform=`translate(${from.x+(next.x-from.x)*t}px,${from.y+(next.y-from.y)*t}px)`;marker.style.width=`${from.w+(next.w-from.w)*t}px`;marker.style.height=`${from.h+(next.h-from.h)*t}px`;});}
 new ResizeObserver(indicator).observe(nav);document.addEventListener('workspace-changed',indicator);indicator();
 document.addEventListener('click',e=>{
  const summary=e.target.closest('summary');if(!summary||summary.closest('.assessment')||summary.closest('dialog')||e.defaultPrevented)return;
  const details=summary.parentElement;if(details.tagName!=='DETAILS'||!motionAllowed())return;
  e.preventDefault();const opening=details.dataset.closing==='true'||!details.open;cancel(details);details.dataset.closing=String(!opening);
  const start=details.getBoundingClientRect().height;details.open=true;details.style.height='auto';const end=opening?details.getBoundingClientRect().height:summary.getBoundingClientRect().height;details.style.overflow='clip';
  tween(details,t=>{details.style.height=`${start+(end-start)*t}px`;},{duration:.24,done:()=>{details.open=opening;details.style.height='';details.style.overflow='';delete details.dataset.closing;}});
 });
 document.addEventListener('change',e=>{if(!e.target.matches('input[type=checkbox]'))return;const before=capture();queueMicrotask(()=>{reflow(before);document.dispatchEvent(new Event('guide-completion'));});},true);
 document.addEventListener('click',e=>{if(e.target.closest('[data-lab],[data-mode],.challenge-navigation button'))queueMicrotask(()=>reveal(document.querySelector('.lab-content'),7));});
 let hadQuery=false;document.addEventListener('input',e=>{if(e.target.id!=='guide-search')return;const hasQuery=!!e.target.value.trim();if(hasQuery&&!hadQuery)queueMicrotask(()=>reveal(document.querySelector('#guide-search-results'),4));hadQuery=hasQuery;});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)for(const el of [...tracks.keys()])cancel(el);});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
