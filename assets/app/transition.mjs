/* Optional scene plumbing, not a visual effect or another navigation handler.
   Scenes register one directional run and return {pose}. Incoming route modules
   receive ctx.transition; shell scenes receive route-changed.detail.transition.
   A run must clean up on signal.abort. For policy:'fade', use opacity only and
   the supplied 150 ms duration; for 'cut' the run is never called.
   Section 12's persistent world needs no storage or cross-document cover. */
export const TRANSITION_CAP=1200;
export const FADE_DURATION=150;
export const ARRIVAL_MAX_AGE=5000;
const controllers=new WeakMap();
const routes=new Set(['desk','cen100','mth140','mth141']);
const selectors=new Set(['desk','course','*']);
const category=route=>route==='desk'?'desk':routes.has(route)?'course':null;
const fresh=()=>({continuing:false});

export function transitionPolicy({window=globalThis.window,url=window.location.href,fromURL=window.location.href}={}){
 // Read the existing gates rather than importing/initialising another core.
 // A history traversal changes location before its outgoing route is unmounted.
 try{
  const gm=window.GuideMotion,p=gm?.preference?.()||{};
  const off=value=>new URL(value,window.location.href).searchParams.get('motion')==='off';
  if(off(url)||off(fromURL)||p.forced||p.paused||p.scenePaused||window.document.documentElement.classList.contains('ns-held')||window.document.hidden)return 'cut';
  if(!gm&&window.localStorage.getItem('guide-motion-paused')==='true')return 'cut';
  if(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches||p.reduced)return 'fade';
  if(gm?.motionAllowed?.()===false||gm?.sceneMotionAllowed?.()===false)return 'cut';
  return 'full';
 }catch{return 'cut';} // Unavailable gates/storage must not prevent navigation.
}

export function transitionOrigin(window=globalThis.window,source){
 try{
  const rect=typeof source?.getBoundingClientRect==='function'?source.getBoundingClientRect():source;
  if(rect&&['left','top','width','height'].every(key=>Number.isFinite(rect[key]))&&rect.width>=0&&rect.height>=0){
   const {left,top,width,height}=rect;
   return {x:left,y:top,left,top,right:left+width,bottom:top+height,width,height};
  }
 }catch{}
 const x=(window.innerWidth||0)/2,y=(window.innerHeight||0)/2;
 return {x,y,left:x,top:y,right:x,bottom:y,width:0,height:0};
}

export function createTransitionController({window=globalThis.window,maxDuration=TRANSITION_CAP,maxAge=ARRIVAL_MAX_AGE,now=()=>window.performance.now()}={}){
 const {document}=window,entries=new Map(),life=new window.AbortController();
 const cap=Number.isFinite(maxDuration)?Math.max(0,Math.min(TRANSITION_CAP,maxDuration)):TRANSITION_CAP;
 const age=Number.isFinite(maxAge)?Math.max(0,maxAge):ARRIVAL_MAX_AGE;
 let active=null,disposed=false;
 function registerTransition(entry){
  if(disposed)throw Error('Transition controller disposed');
  if(!entry||typeof entry.name!=='string'||!entry.name.trim()||!selectors.has(entry.from)||!selectors.has(entry.to)||typeof entry.run!=='function')throw TypeError('Transition requires name, desk/course/* selectors and run');
  const registration={name:entry.name,from:entry.from,to:entry.to,run:entry.run};
  entries.delete(entry.name);entries.set(entry.name,registration);
  return ()=>{if(entries.get(registration.name)===registration)entries.delete(registration.name);};
 }
 function match(from,to){
  if(!routes.has(from)||!routes.has(to)||from===to)return null;
  let best=null,score=-1;
  for(const entry of entries.values()){
   if((entry.from!=='*'&&entry.from!==category(from))||(entry.to!=='*'&&entry.to!==category(to)))continue;
   const specificity=Number(entry.from!=='*')+Number(entry.to!=='*');
   // Prefer specific scene hooks; the latest registration breaks a tie. Never
   // run multiple camera owners for the same navigation.
   if(specificity>=score){best=entry;score=specificity;}
  }
  return best;
 }
 const cancel=()=>active?.cancel();
 function run(detail){
  cancel();
  const from=detail.from,to=detail.route,entry=match(from,to);
  const policy=transitionPolicy({window,url:detail.url,fromURL:detail.fromURL});
  if(disposed||detail.signal?.aborted||!entry||policy==='cut')return Promise.resolve();
  const control=new window.AbortController(),duration=Math.min(cap,policy==='fade'?FADE_DURATION:cap);
  const record={url:new URL(detail.url,window.location.href).href,requestSignal:detail.signal,control,policy,fromURL:detail.fromURL,handoff:null};
  active=record;
  return new Promise(resolve=>{
   let settled=false,timer;
   const detach=()=>{window.clearTimeout(timer);detail.signal?.removeEventListener('abort',record.cancel);};
   record.detach=detach;
   record.cancel=()=>{
    record.handoff=null;detach();if(active===record)active=null;
    control.abort();if(!settled){settled=true;resolve();}
   };
   const finish=result=>{
    if(settled)return;
    try{
     if(result?.pose===undefined||result.pose===null||control.signal.aborted){record.cancel();return;}
     record.handoff={pose:result.pose,at:now()};settled=true;window.clearTimeout(timer);resolve();
     // Keep cancellation live while a slow fetch/import completes; consumeArrival
     // removes this last listener at the swap. No persistent pose cache remains.
    }catch{record.cancel();}
   };
   detail.signal?.addEventListener('abort',record.cancel,{once:true});
   timer=window.setTimeout(record.cancel,duration);
   Promise.resolve().then(()=>{
    if(control.signal.aborted)return;
    return entry.run({from,to,url:record.url,origin:transitionOrigin(window,detail.origin),signal:control.signal,policy,duration,history:detail.history||'push'});
   }).then(finish,record.cancel);
  });
 }
 function consumeArrival({url=window.location.href,signal,direct=false}={}){
  const record=active;if(!record)return fresh();
  const handoff=record.handoff,elapsed=handoff?now()-handoff.at:Infinity;
  let matches=false;
  try{matches=new URL(url,window.location.href).href===record.url;}catch{}
  if(direct||!matches||signal!==record.requestSignal||!handoff||record.control.signal.aborted||elapsed<0||elapsed>age||transitionPolicy({window,url,fromURL:record.fromURL})!==record.policy){record.cancel();return fresh();}
  record.detach();record.handoff=null;active=null;
  return {continuing:true,pose:handoff.pose};
 }
 function willChange(event){
  const detail=event.detail;if(typeof detail?.waitUntil!=='function')return;
  cancel();
  // Let every navigation guard veto first. The router starts its fetch in this
  // same turn, rather than waiting for either animation or network sequentially.
  detail.waitUntil(Promise.resolve().then(()=>{
   if(!event.defaultPrevented&&!detail.signal?.aborted)return run(detail);
  }).catch(()=>{cancel();}));
 }
 function policyChanged(event){
  if(active&&(event.type==='night-hold'&&event.detail===true||transitionPolicy({window,url:active.url,fromURL:active.fromURL})!==active.policy))cancel();
 }
 document.addEventListener('route-will-change',willChange,{signal:life.signal});
 for(const type of ['guide-motion-change','night-hold','visibilitychange'])document.addEventListener(type,policyChanged,{signal:life.signal});
 window.addEventListener('pagehide',cancel,{signal:life.signal});
 const media=window.matchMedia?.('(prefers-reduced-motion: reduce)');
 media?.addEventListener?.('change',policyChanged);
 function dispose(){
  if(disposed)return;disposed=true;cancel();life.abort();entries.clear();media?.removeEventListener?.('change',policyChanged);
  if(controllers.get(document)===controller)controllers.delete(document);
 }
 const controller={registerTransition,match,consumeArrival,cancel,dispose};
 return controller;
}

export function getTransitionController(window=globalThis.window){
 const {document}=window;
 if(!controllers.has(document))controllers.set(document,createTransitionController({window}));
 return controllers.get(document);
}
export function registerTransition(entry,{window=globalThis.window}={}){
 return getTransitionController(window).registerTransition(entry);
}
