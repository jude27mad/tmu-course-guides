/* Book-state stub for engine tests (semester-book spec §3.6). Same API as §3.1 with an injectable policy;
   only needed until Side B's assets/book/book-state.mjs lands. Pure apart from the optional document
   hooks in attachBookState: no storage, no timers, no Three. */
const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
const INSTANT={index:-1,cancelled:false};

export function createBookState({course='mth140',weeks=[],today=0,policy=()=>'cut'}={}){
 let list=weeks,count=Math.max(1,list.length),todayIndex=clamp(Math.round(today)||0,0,count-1);
 let index=todayIndex,turn=index,settled=true,source='init',lock=null,version=0,anchorDirty=false;
 let animator=null,pending=null,disposed=false;
 const subscribers=new Set();
 const mode=()=>{const value=policy();return value==='full'||value==='fade'?value:'cut';};
 const snapshot=()=>Object.freeze({course,count,today:todayIndex,index,turn,settled,source,lock,mode:mode(),version});
 function emit(kind,from,reason){
  version++;const snap=snapshot(),change=Object.freeze({kind,source:from,...(reason?{reason}:{})});
  for(const sub of [...subscribers])if(kind!=='turn'||sub.continuous)sub.fn(snap,change);
 }
 /* Ends the running animation; its command promise resolves cancelled. */
 function interrupt(){
  if(!pending)return;const run=pending;pending=null;
  try{animator?.cancel();}catch{}
  run.resolve({index:run.target,cancelled:true});
 }
 function select(next,from){const changed=next!==index;index=next;source=from;if(changed)emit('select',from);return changed;}
 function land(target,from){
  turn=target;settled=true;source=from;emit('turn',from);
  if(target!==index)select(target,from);
  emit('settle',from);
 }
 function run(target,from,options){
  const token={target,resolve:null};
  const done=new Promise(resolve=>{token.resolve=resolve;});
  pending=token;settled=false;
  Promise.resolve(animator.animate(turn,target,options)).then(()=>{
   if(pending!==token)return;pending=null;land(target,from);token.resolve({index:target,cancelled:false});
  },()=>{if(pending===token){pending=null;token.resolve({index:target,cancelled:true});}});
  return done;
 }
 const state={
  course,
  get weeks(){return list;},
  get today(){return todayIndex;},
  snapshot,
  openWeek(i,{source:from='control',animate=true}={}){
   if(disposed)return Promise.resolve({...INSTANT,index});
   const target=clamp(Math.round(Number(i))||0,0,count-1);
   interrupt();lock=null;
   select(target,from);anchorDirty=true;
   const current=mode();
   if(!animate||current==='cut'||!animator){land(target,from);return Promise.resolve({index:target,cancelled:false});}
   const distance=Math.abs(target-turn);
   return run(target,from,{distance,source:from,mode:current,ease:current==='fade'?'none':'power2.inOut',duration:current==='fade'?150:720});
  },
  step(delta,options){return state.openWeek(index+Math.round(delta),options);},
  grab(from){
   if(disposed||mode()!=='full'||(from!=='drag'&&from!=='swipe'))return false;
   if(lock==='drag'&&from==='swipe')return false;
   interrupt();lock=from;settled=false;source=from;return true;
  },
  scrub(t,from){
   if(disposed)return false;
   if(from==='scroll'&&lock)return false;
   if((from==='drag'||from==='swipe')&&lock!==from)return false;
   turn=clamp(Number(t)||0,0,count-1);source=from;settled=false;emit('turn',from);
   if(from==='scroll'&&Math.abs(turn-Math.round(turn))<.02){select(Math.round(turn),from);settled=true;emit('settle',from);}
   return true;
  },
  release(from,{velocity=0}={}){
   if(disposed||lock!==from)return Promise.resolve();
   lock=null;anchorDirty=true;
   const landing=clamp(velocity>.3?Math.ceil(turn):velocity<-.3?Math.floor(turn):Math.round(turn),0,count-1);
   if(!animator||mode()!=='full'){land(landing,from);return Promise.resolve();}
   const duration=clamp(Math.abs(landing-turn)*900,180,600);
   return run(landing,from,{distance:Math.abs(landing-turn),source:from,mode:'full',ease:'power2.out',duration});
  },
  setWeeks(next,{reason,today:day}={}){
   if(disposed)return;
   list=next||list;count=Math.max(1,list.length);
   if(day!==undefined)todayIndex=clamp(Math.round(day)||0,0,count-1);
   index=clamp(index,0,count-1);turn=clamp(turn,0,count-1);
   emit('weeks','data',reason);
  },
  setAnimator(next){if(animator&&animator!==next)interrupt();animator=next||null;},
  subscribe(fn,{continuous=false}={}){const sub={fn,continuous};subscribers.add(sub);return()=>subscribers.delete(sub);},
  consumeAnchorDirty(){const value=anchorDirty;anchorDirty=false;return value;},
  get subscriberCount(){return subscribers.size;},
  dispose(){if(disposed)return;interrupt();disposed=true;subscribers.clear();animator=null;}
 };
 return state;
}

let current=null,detachDocument=null;
export function attachBookState(state){
 if(current&&current!==state)detachBookState(current);
 current=state;
 if(typeof document==='undefined')return;
 const onOpen=event=>{if(current!==state)return;event.preventDefault();state.openWeek(Number(event.detail?.index)||0,{source:'palette'});};
 document.addEventListener('book-open-week',onOpen);
 const off=state.subscribe(snapshot=>document.dispatchEvent(new CustomEvent('book-week',{detail:snapshot})));
 detachDocument=()=>{document.removeEventListener('book-open-week',onOpen);off();};
 document.dispatchEvent(new CustomEvent('book-state',{detail:{state}}));
}
export function detachBookState(state){if(current!==state)return;detachDocument?.();detachDocument=null;current=null;}
export const currentBookState=()=>current;

/* Minimal SpreadView for engine tests; Side B's describeSpread() is the real text source. */
export function describeSpread(spread,{weeks=[],today=0}={}){
 const index=weeks.indexOf(spread),number=index+1;
 return {index,count:weeks.length,datedCount:weeks.length,kind:spread?.kind||'week',partial:false,pending:false,
  kicker:'WEEK',numeral:String(number).padStart(2,'0'),of:String(weeks.length),range:spread?.label||'',note:'Teaching week',
  relative:index===today?'THIS WEEK':'',days:[],entries:[],popups:[],more:0,aria:`Week ${number}`,live:`Week ${number} of ${weeks.length}`,
  signature:`${index}:${spread?.label||''}`};
}
