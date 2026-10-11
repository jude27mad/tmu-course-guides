/* One GSAP timeline per surface. Application state always changes synchronously. */
import {gsap,Flip} from './vendor/gsap-3.15.0.mjs';
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let paused=false,scenePaused=false,full=false;try{scenePaused=localStorage.getItem('guide-motion-paused')==='true';full=localStorage.getItem('guide-motion-level')==='full';}catch{}
if(new URLSearchParams(location.search).get('motion')==='full'){full=true;scenePaused=false;try{localStorage.setItem('guide-motion-level','full');localStorage.setItem('guide-motion-paused','false')}catch{}}
const forced=new URLSearchParams(location.search).get('motion')==='off';
const tracks=new Map(), reflowOwner={};
export const sceneMotionAllowed=()=>motionAllowed()&&!scenePaused;
export function setScenePaused(value){scenePaused=value;try{localStorage.setItem('guide-motion-paused',String(value));}catch{}document.dispatchEvent(new Event('guide-motion-change'));}
export const motionAllowed=()=>!forced&&(!reduced.matches||full)&&!paused;
const clear=(nodes,props='transform,opacity,transformOrigin,filter')=>gsap.set(nodes,{clearProps:props});
export function cancel(owner){const track=tracks.get(owner);if(!track)return;tracks.delete(owner);track.timeline.kill();track.finish();}
function play(owner,build,done=()=>{}){
 cancel(owner);let completed=false;
 const finish=()=>{if(completed)return;completed=true;tracks.delete(owner);done();};
 if(!motionAllowed()){finish();return;}
 const timeline=gsap.timeline({paused:true,defaults:{ease:'power3.out'},onComplete:finish});
 build(timeline);tracks.set(owner,{timeline,finish});timeline.play();return timeline;
}
export function tween(owner,draw,{duration=.32,done=()=>{}}={}){
 const proxy={value:0};return play(owner,tl=>tl.to(proxy,{value:1,duration,onUpdate:()=>draw(proxy.value)}),()=>{draw(1);done();});
}
export function reveal(el,distance=36){if(!el)return;return play(el,tl=>tl.fromTo(el,{opacity:.35,y:distance},{opacity:1,y:0,duration:.42}),()=>clear(el));}
export function entrance(el){if(!el)return;const nodes=[...el.children].filter(n=>!n.hidden);return play(el,tl=>tl.fromTo(nodes,{opacity:.3,y:40},{opacity:1,y:0,duration:.4,stagger:{amount:.1}}),()=>clear(nodes));}
export function transitionPanel(from,to,direction=1){
 if(!to||from===to)return;cancel(to.parentElement);cancel(from);cancel(to);
 const owner=to.parentElement,box=owner.getBoundingClientRect(),rect=from?.getBoundingClientRect();
 to.hidden=false;
 const children=[...to.children].filter(n=>!n.hidden);
 const finish=()=>{if(from){from.hidden=true;from.inert=false;from.removeAttribute('aria-hidden');clear(from,'position,top,left,width,transform,opacity,pointerEvents,filter');}clear(to);clear(children);};
 if(!motionAllowed()){finish();return;}
 if(from){from.hidden=false;from.inert=true;from.setAttribute('aria-hidden','true');gsap.set(from,{position:'absolute',top:rect.top-box.top+owner.scrollTop,left:rect.left-box.left,width:rect.width,pointerEvents:'none'});}
 return play(owner,tl=>{
  if(from)tl.to(from,{opacity:0,x:-110*direction,z:-180,rotationY:-12*direction,scale:.9,filter:'blur(5px)',duration:.48,ease:'power2.inOut'},0);
  tl.fromTo(to,{opacity:.1,x:110*direction,z:-180,rotationY:12*direction,scale:.9,filter:'blur(5px)'},{opacity:1,x:0,z:0,rotationY:0,scale:1,filter:'blur(0px)',duration:.72,ease:'power3.inOut'},0);
  tl.fromTo(children,{opacity:.1,y:54},{opacity:1,y:0,duration:.5,stagger:{amount:.13}},.14);
 },finish);
}
export function visibility(el,open,done=()=>{}){
 if(!el)return;cancel(el);const start=el.hidden?0:el.getBoundingClientRect().height;
 el.hidden=false;el.style.height='auto';const full=el.getBoundingClientRect().height;
 el.style.overflow='clip';el.inert=!open;
 return play(el,tl=>tl.fromTo(el,{height:start,opacity:open?.35:1},{height:open?full:0,opacity:open?1:0,duration:.3}),()=>{el.hidden=!open;el.inert=false;clear(el,'height,overflow,opacity');done();});
}
export function disclosure(details,open){
 if(!details)return;cancel(details);const start=details.getBoundingClientRect().height,summary=details.querySelector(':scope > summary');
 details.open=true;details.style.height='auto';const end=open?details.getBoundingClientRect().height:summary.getBoundingClientRect().height;
 details.style.overflow='clip';details.dataset.closing=String(!open);
 return play(details,tl=>tl.fromTo(details,{height:start},{height:end,duration:.3}),()=>{if(details.open!==open)details.open=open;clear(details,'height,overflow');delete details.dataset.closing;});
}
export function capture(root=document){cancel(reflowOwner);const nodes=[...root.querySelectorAll('#teamlist>.tile,#youlist>.tile,#assessment-list>li')].filter(el=>el.getClientRects().length&&!el.closest('dialog'));return Flip.getState(nodes);}
export function reflow(before){
 if(!before||!motionAllowed())return;
 cancel(reflowOwner);const animation=Flip.from(before,{duration:.4,ease:'power3.inOut',nested:true,prune:true,onComplete:()=>tracks.delete(reflowOwner)});
 tracks.set(reflowOwner,{timeline:animation,finish:()=>{animation.progress(1);clear(before.targets);}});
}
export function dialogOpen(el,from){
 if(!el)return;cancel(el);el.dataset.motionManaged='true';el.dataset.closing='false';
 const lab=el.classList.contains('lab-dialog'),rect=el.getBoundingClientRect(),mobile=innerWidth<=600;
 if(!lab)pageDepth(true);
 const x=lab&&from?from.left-rect.left:mobile?0:rect.width,y=lab&&from?from.top-rect.top:mobile?rect.height*.5:0;
 const sx=lab&&from&&rect.width?Math.max(.15,from.width/rect.width):1,sy=lab&&from&&rect.height?Math.max(.15,from.height/rect.height):1;
 const title=el.querySelector('.sheet-toolbar h2,.workbench-title h2'),content=el.querySelector('.sheet-content,.lab-content');
 return play(el,tl=>{
  tl.fromTo(el,{x,y,scaleX:sx,scaleY:sy,transformOrigin:'0 0',opacity:.45,'--guide-backdrop':0},{x:0,y:0,scaleX:1,scaleY:1,opacity:1,'--guide-backdrop':1,duration:lab?.52:.7},0);
  if(title)tl.fromTo(title,{opacity:.3,y:20},{opacity:1,y:0,duration:.26},.1);
  if(content)tl.fromTo(content,{opacity:.25,y:34},{opacity:1,y:0,duration:.3},.14);
 },()=>{clear(el);el.style.removeProperty('--guide-backdrop');if(title)clear(title);if(content)clear(content);});
}
export function dialogClose(el,done=()=>{},to){
 cancel(el);if(!el?.open){done();return;}el.dataset.closing='true';if(!el.classList.contains('lab-dialog'))pageDepth(false);
 const lab=el.classList.contains('lab-dialog'),rect=el.getBoundingClientRect(),mobile=innerWidth<=600;
 const x=to?to.left-rect.left:mobile?0:120,y=to?to.top-rect.top:mobile?100:0;
 const scale=to&&rect.width?Math.max(.2,Math.min(1,to.width/rect.width)):1;
 return play(el,tl=>tl.to(el,{x,y,scale:lab?scale:.96,opacity:.15,'--guide-backdrop':0,transformOrigin:'0 0',duration:.34,ease:'power2.in'}),()=>{clear(el);el.style.removeProperty('--guide-backdrop');el.dataset.closing='false';done();});
}

const pageOwner={},pressOwner={},depthOwner=pageOwner;let depthOpen=false;
export function enterPage(el=document.querySelector('.wrap,.math-wrap')){
 if(!el)return;cancel(pageOwner);return play(pageOwner,tl=>tl.fromTo(el,{opacity:.15,x:120,z:-250,rotationY:13,scale:.9,filter:'blur(7px)',transformPerspective:1500,transformOrigin:'50% 240px'},{opacity:1,x:0,z:0,rotationY:0,scale:1,filter:'blur(0px)',duration:.95,ease:'power3.inOut'}),()=>clear(el));
}
export function leavePage(el,done=()=>{},direction=1){
 if(!el){done();return;}cancel(pageOwner);return play(pageOwner,tl=>tl.set(el,{transformPerspective:1500,transformOrigin:'50% 240px'}).to(el,{opacity:0,x:-160*direction,z:-300,rotationY:-16*direction,scale:.88,filter:'blur(8px)',duration:.5,ease:'power2.inOut'}),done);
}
function reactPage(){
 const el=document.querySelector('.header-upgraded');if(!el||!motionAllowed())return;
 document.dispatchEvent(new Event('guide-scene-impulse'));
 play(pressOwner,tl=>tl.set(el,{transformPerspective:1500}).to(el,{scale:.975,rotationX:2,rotationY:-2,z:-35,duration:.16,ease:'power2.out'}).to(el,{scale:1,rotationX:0,rotationY:0,z:0,duration:.58,ease:'power3.out'}),()=>clear(el));
}
function pageDepth(open){
 if(open===depthOpen)return;depthOpen=open;
 const el=document.querySelector('.wrap,.math-wrap');if(!el)return;cancel(pageOwner);
 play(depthOwner,tl=>tl.set(el,{transformPerspective:1600}).to(el,{scale:open?.94:1,z:open?-90:0,rotationY:open?-4:0,filter:open?'blur(3px)':'blur(0px)',duration:.65,ease:'power3.inOut'}),()=>{if(!open)clear(el);});
}

function updatePreference(){document.documentElement.dataset.motion=motionAllowed()?'on':'off';if(!motionAllowed())for(const owner of [...tracks.keys()])cancel(owner);document.dispatchEvent(new CustomEvent('guide-motion-change',{detail:{enabled:motionAllowed()}}));}
export function setPaused(value){paused=value;updatePreference();}
export const preference=()=>({paused,scenePaused,full,reduced:reduced.matches&&!full,forced});
window.GuideMotion={reveal,visibility,capture,reflow,dialogOpen,dialogClose,cancel,motionAllowed,transitionPanel,entrance,disclosure,setPaused,setScenePaused,sceneMotionAllowed,preference,enterPage,leavePage};
reduced.addEventListener('change',updatePreference);window.addEventListener('storage',e=>{if(e.key==='guide-motion-paused'){scenePaused=e.newValue==='true';document.dispatchEvent(new Event('guide-motion-change'));}});updatePreference();
let mounted=false;
function mount(){
 const nav=document.querySelector('.workspace-nav');if(!nav||mounted)return;mounted=true;
 const marker=document.createElement('span');marker.className='workspace-nav-marker';marker.setAttribute('aria-hidden','true');nav.prepend(marker);
 function indicator(){const active=nav.querySelector('[aria-current]');if(!active)return;const rect=active.getBoundingClientRect(),box=nav.getBoundingClientRect();cancel(marker);if(!motionAllowed()){gsap.set(marker,{x:rect.left-box.left,y:rect.top-box.top,width:rect.width,height:rect.height});return;}play(marker,tl=>tl.to(marker,{x:rect.left-box.left,y:rect.top-box.top,width:rect.width,height:rect.height,duration:.4}));}
 new ResizeObserver(indicator).observe(nav);document.addEventListener('workspace-changed',indicator);indicator();
 enterPage();
 entrance(document.querySelector('.workspace-panel:not([hidden])'));
 const seen=new WeakSet();const observer=new IntersectionObserver(entries=>{for(const {target,isIntersecting}of entries){if(!isIntersecting||target.closest('[hidden]')||seen.has(target))continue;seen.add(target);observer.unobserve(target);if(!tracks.has(target.closest('.workspace-panel')?.parentElement))reveal(target,36);}},{threshold:.15});
 document.querySelectorAll('.workspace-panel .workspace-disclosure,.workspace-panel .workspace-topic-title').forEach(el=>observer.observe(el));
 document.addEventListener('click',e=>{if(e.target.closest('button,summary,.workspace-nav a,.course-link,.hub-brand,.header-art,input[type=checkbox],.tile .head'))reactPage();},true);
 let navigating=false;document.addEventListener('click',e=>{const a=e.target.closest('.course-link,.hub-brand');if(!a||e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey||a.target||!motionAllowed())return;const u=new URL(a.href,location.href);if(u.origin!==location.origin||u.pathname===location.pathname)return;e.preventDefault();if(navigating)return;navigating=true;const links=[...document.querySelectorAll('.course-link')],direction=links.indexOf(a)>=links.findIndex(x=>x.hasAttribute('aria-current'))?1:-1;leavePage(document.querySelector('.wrap,.math-wrap'),()=>location.assign(u.href),direction);});
 document.addEventListener('close',e=>{if(e.target.classList?.contains('detail-sheet'))pageDepth(false);},true);
 window.addEventListener('pageshow',e=>{if(e.persisted){navigating=false;clear(document.querySelector('.wrap,.math-wrap'));enterPage();}});
 document.addEventListener('pointerdown',e=>{const target=e.target.closest('button,.workspace-nav a');if(target&&motionAllowed())play(target,tl=>tl.to(target,{scale:.96,duration:.08,ease:'power2.out'}).to(target,{scale:1,duration:.08}),()=>clear(target,'transform'));},{passive:true});
 document.addEventListener('click',e=>{
  const summary=e.target.closest('summary');if(!summary||summary.closest('.assessment')||summary.closest('dialog')||e.defaultPrevented)return;
  const details=summary.parentElement;if(details.tagName!=='DETAILS'||!motionAllowed())return;
  e.preventDefault();disclosure(details,details.dataset.closing==='true'||!details.open);
 });
 let completionQueued=false;
 const complete=()=>{if(completionQueued)return;completionQueued=true;const before=capture();queueMicrotask(()=>{window.CourseWorkspace?.refresh();completionQueued=false;reflow(before);reveal(document.querySelector('.next-assessment,.cen-next-layout'),32);document.dispatchEvent(new Event('guide-completion'));});};
 document.addEventListener('click',e=>{if(e.target.closest('[data-quick-complete],#undo-complete'))complete();},true);
 document.addEventListener('change',e=>{if(e.target.matches('[data-check],[data-completed],[data-k],[data-completion],[data-topic]'))complete();else if(e.target.matches('#hide-completed,#workspace-show-past')){const before=capture();queueMicrotask(()=>reflow(before));}},true);
 document.addEventListener('click',e=>{if(e.target.closest('[data-lab],[data-mode],.challenge-navigation button'))queueMicrotask(()=>entrance(document.querySelector('.lab-content')));if(e.target.closest('[data-term]'))queueMicrotask(()=>reveal(document.querySelector('.lab-term-explanation'),30));});
 let hadQuery=false;document.addEventListener('input',e=>{if(e.target.id!=='guide-search')return;const hasQuery=!!e.target.value.trim();if(hasQuery&&!hadQuery)queueMicrotask(()=>entrance(document.querySelector('#guide-search-results')));hadQuery=hasQuery;});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)for(const owner of [...tracks.keys()])cancel(owner);});
}
// Workspace may be mounted by a later module in the same document turn.
document.addEventListener('workspace-changed',mount);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
