/* Stand-in for assets/book/book-scene.mjs mountBook() (docs/book/semester-book-spec.md §3.3, §3.6).
 *
 * Side B's DOM, scroll and workflow tests mount this instead of the engine. It honours the engine side of the
 * contract that B can observe, and nothing else:
 *   - `ready` resolves to 'webgl2' or 'poster' (option `renderer`); a poster also calls onFallback(reason)
 *     and fires `book-fallback` on the slot.
 *   - It subscribes to the state with {continuous:true} and registers an animator that lands after
 *     `duration` ms on the timer functions in force when animate() runs, so node:test mock.timers drive it.
 *   - setHandoff, setFocus and close calls are recorded, metrics() returns fixed numbers, and on a `weeks`
 *     change it re-asks getView(i) for the live faces and "repaints" (calls.paint) only those whose
 *     signature changed, like the engine does.
 *   - It writes the slot dataset the engine owns (renderer, rendererReason, sceneReady, week, turn) when the
 *     slot has one, so DOM tests can read the same hooks.
 * No Three, no canvas and no DOM beyond the slot it is given; fakeSlot() makes one for plain Node.
 */

const DEFAULT_METRICS=Object.freeze({
 pageWidthPx:410,
 spreadRect:Object.freeze({x:530,y:96,left:530,top:96,width:820,height:595,right:1350,bottom:691}),
 stageRect:Object.freeze({x:0,y:64,left:0,top:64,width:1440,height:640,right:1440,bottom:704})
});
/* Engine choreography durations (§5.8), only so a stubbed full turn takes a realistic time. */
function choreography(mode,distance){
 if(mode==='fade')return 150;
 if(mode==='cut'||!distance)return 0;
 if(distance<=1)return 720;
 if(distance<=4)return 460+110*(Math.ceil(distance)-1);
 return 900;
}

/** A slot for plain Node: an EventTarget with a dataset. */
export function fakeSlot(){
 const slot=new EventTarget();
 slot.dataset={};
 return slot;
}

export async function mountBook(slot,{
 course=null,state,getView=null,signal=null,arrival={start:0},onOpen=null,onFallback=null,dockTarget=null,
 renderer='webgl2',reason='stub',metrics=DEFAULT_METRICS,timers=null
}={}){
 if(!state||typeof state.subscribe!=='function')throw new TypeError('mountBook stub needs a BookState');
 const clock=()=>timers||{setTimeout:globalThis.setTimeout,clearTimeout:globalThis.clearTimeout};
 const calls={setHandoff:[],setFocus:[],close:[],requestFrame:0,dispose:0,animate:[],cancel:0,getView:[],paint:[],changes:[]};
 const live=new Map();
 const dataset=slot&&typeof slot==='object'?slot.dataset:null;
 const fire=(type,detail)=>{if(typeof slot?.dispatchEvent==='function'&&typeof globalThis.CustomEvent==='function')slot.dispatchEvent(new CustomEvent(type,{detail}));};
 const write=snap=>{if(dataset){dataset.week=String(snap.index);dataset.turn=snap.turn.toFixed(2);}};
 /* Paint a face when it first goes live, or again only when its view signature changed (§3.3). */
 const paint=index=>{
  if(typeof getView!=='function')return;
  calls.getView.push(index);
  let value=null;try{value=getView(index);}catch{value=null;}
  if(!value||live.get(index)===value.signature)return;
  live.set(index,value.signature);calls.paint.push(index);
 };
 const faces=snap=>{const out=[snap.index];if(!snap.settled&&Math.ceil(snap.turn)!==snap.index)out.push(Math.ceil(snap.turn));if(!snap.settled&&Math.floor(snap.turn)!==snap.index)out.push(Math.floor(snap.turn));return [...new Set(out)];};

 let pending=null,disposed=false;
 const finishPending=()=>{if(!pending)return;const {timer,resolve}=pending;pending=null;clock().clearTimeout?.(timer);resolve();};
 const animator={
  animate(from,to,options={}){
   finishPending();
   calls.animate.push({from,to,...options});
   const duration=options.duration??choreography(options.mode,options.distance??Math.abs(to-from));
   return new Promise(resolve=>{
    const timer=clock().setTimeout(()=>{
     if(pending?.timer!==timer)return;
     pending=null;
     state.scrub(to,'animation');
     resolve();
    },duration);
    pending={timer,resolve};
   });
  },
  cancel(){calls.cancel++;finishPending();}
 };

 const unsubscribe=state.subscribe((snap,change)=>{
  calls.changes.push(change.kind);
  write(snap);
  for(const index of faces(snap))if(change.kind==='weeks'||!live.has(index))paint(index);
 },{continuous:true});
 state.setAnimator(animator);

 const poster=renderer==='poster';
 if(dataset){dataset.renderer=poster?'poster':'webgl2';if(poster)dataset.rendererReason=reason;}
 for(const index of faces(state.snapshot()))paint(index);
 write(state.snapshot());

 const ready=Promise.resolve().then(()=>{
  if(disposed)return poster?'poster':'webgl2';
  if(poster){onFallback?.(reason);fire('book-fallback',{reason});}
  else{if(dataset)dataset.sceneReady='true';fire('book-ready',{renderer:null});}
  return poster?'poster':'webgl2';
 });

 const controller={
  ready,calls,animator,course,arrival,onOpen,dockTarget,
  metrics(){return metrics;},
  setHandoff(p){calls.setHandoff.push(p);},
  setFocus(id){calls.setFocus.push(id??null);},
  close({ms=350}={}){
   calls.close.push(ms);
   if(state.snapshot().mode!=='full')return Promise.resolve();
   return new Promise(resolve=>clock().setTimeout(resolve,Math.min(ms,350)));
  },
  requestFrame(){calls.requestFrame++;},
  stats(){return {renderer:poster?'poster':'webgl2',frames:0,drawCalls:0,triangles:0,liveFaces:live.size};},
  dispose(){
   if(disposed)return;
   disposed=true;calls.dispose++;
   finishPending();unsubscribe();state.setAnimator(null);live.clear();
   if(dataset){delete dataset.sceneReady;delete dataset.week;delete dataset.turn;}
  }
 };
 signal?.addEventListener?.('abort',()=>controller.dispose(),{once:true});
 return controller;
}
