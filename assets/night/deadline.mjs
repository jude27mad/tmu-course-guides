/* One resolved deadline feeds the next card, the dock chip and the hero line.
   Resolution is targets.mjs (the same data-level rules the Desk uses); this file is the course-page adapter.
   A timer is shown only when the date and time are actually known. */
import {course,isMath,META,$,escape,asset,courseData,ambientAllowed,preference,toggleMotion} from './core.mjs?v=20261023-mth141';
import {scope} from '../route-lifecycle.mjs';
import {loadData,readSaved,resolveTarget,parts,compact,sentence,GRACE} from './targets.mjs?v=20261023-mth141';
import {currentBookState} from '../book/book-state.mjs?v=20261023-mth141';
export {parts,compact} from './targets.mjs?v=20261023-mth141';

let target=null,data$=null,tickTimer=0,lastMinute='',live=null;
let dock=null,dockLife=null;
const listeners=new Set();
export const currentTarget=()=>target;
export function onTarget(fn){listeners.add(fn);if(target)fn(target);return()=>listeners.delete(fn);}

/* The countdown sits inside the guide's own next card, so the card's item wins when it names one. The rules
   are identical (tests/targets.test.mjs); the two can differ only until the guide's next minute refresh. */
function shownId(){return isMath()?$('#next-assessment')?.dataset.nextId||'':($('#nextsign')?.dataset.schedule||'').split('|')[0].split(':')[0];}
/* The guide's live control reflects the section even when storage is blocked; storage is the fallback. */
function liveSection(saved){const control=$(isMath()?'#section-select':'#contact-section');return control?Number(control.value)||0:saved;}

/* ---- Countdown ring, drawn in each course's vocabulary ----
   Engineering: a toothed ratchet that advances in steps. Calculus: a smooth arc carrying its tangent.
   Linear Algebra: four basis segments that turn as time runs down. */
const R=44,C=2*Math.PI*R,TEETH=56;
const pad=n=>String(n).padStart(2,'0');
const ratchet=p=>Math.ceil(p*TEETH)/TEETH;
function ringGeometry(progress){
 const shown=META.motif==='mechanism'?ratchet(progress):progress;
 const a=shown*2*Math.PI,x=50+R*Math.cos(a),y=50+R*Math.sin(a),tx=-Math.sin(a)*13,ty=Math.cos(a)*13;
 return {offset:(C*(1-shown)).toFixed(2),tangent:[x-tx,y-ty,x+tx,y+ty].map(v=>v.toFixed(2)),turn:(shown*90).toFixed(2)};
}
function ring(progress){
 const g=ringGeometry(progress),motif=META.motif;
 const fillDash=motif==='plane'?`${(C/4-7).toFixed(2)} 7`:C.toFixed(2);
 const extra=motif==='flow'?`<line class="ns-ring-tangent" x1="${g.tangent[0]}" y1="${g.tangent[1]}" x2="${g.tangent[2]}" y2="${g.tangent[3]}"/>`
  :motif==='plane'?`<g class="ns-ring-basis" style="--turn:${g.turn}deg"><path d="M50 50h18"/><path d="M50 50v18"/></g>`:'';
 return `<svg class="ns-ring ns-ring-${motif}" viewBox="0 0 100 100" aria-hidden="true"><circle class="ns-ring-track" cx="50" cy="50" r="${R}"${motif==='mechanism'?` stroke-dasharray="${(C/TEETH/2).toFixed(3)} ${(C/TEETH/2).toFixed(3)}"`:''}/><circle class="ns-ring-fill" cx="50" cy="50" r="${R}" stroke-dasharray="${motif==='plane'?fillDash:C.toFixed(2)}" stroke-dashoffset="${motif==='plane'?'0':g.offset}"${motif==='plane'?` pathLength="${C.toFixed(2)}" style="clip-path:${planeClip(progress)}"`:''}/>${extra}</svg>`;
}
/* Basis segments stay whole; the remaining share is revealed with a conic-like polygon clip. */
function planeClip(progress){
 // Same start and direction as the other rings' stroke: 3 o'clock in SVG space, clockwise.
 const pts=['50% 50%'];const steps=24;
 for(let i=0;i<=steps;i++){const a=(i/steps)*progress*2*Math.PI;pts.push(`${(50+75*Math.cos(a)).toFixed(2)}% ${(50+75*Math.sin(a)).toFixed(2)}%`);}
 return `polygon(${pts.join(',')})`;
}
function paintRing(block,progress){
 const svg=block.querySelector('.ns-ring');if(!svg)return;
 const g=ringGeometry(progress),fill=svg.querySelector('.ns-ring-fill');
 if(META.motif==='plane'){fill.style.clipPath=planeClip(progress);svg.querySelector('.ns-ring-basis')?.style.setProperty('--turn',g.turn+'deg');return;}
 fill.setAttribute('stroke-dashoffset',g.offset);
 const line=svg.querySelector('.ns-ring-tangent');
 if(line){line.setAttribute('x1',g.tangent[0]);line.setAttribute('y1',g.tangent[1]);line.setAttribute('x2',g.tangent[2]);line.setAttribute('y2',g.tangent[3]);}
}

/* ---- next-card block ---- */
function blockHTML(t){
 const p=parts(t)||{};
 let face='';
 if(t.precision==='exact'&&p.ms)face=`<div class="ns-digits" aria-hidden="true">${[['d','days'],['h','hrs'],['m','min'],['s','sec']].map(([k,l])=>`<span class="ns-unit"><b data-unit="${k}">${pad(p[k])}</b><i>${l}</i></span>`).join('')}</div>`;
 else if(t.precision==='exact'||t.precision==='day')face=`<div class="ns-word" aria-hidden="true">${escape(compact(t))}</div>`;
 else face=`<div class="ns-word${t.range?'':' ns-word-quiet'}" aria-hidden="true">${escape(t.range||compact(t))}</div>`;
 const showRing=t.precision==='exact'&&p.ms||t.precision==='day'&&p.days>=0;
 return `<div class="ns-count-face">${showRing?ring(p.progress??0):''}${face}</div><div class="ns-count-meta"><p class="ns-count-label">${escape(t.label)}</p><p class="ns-count-when">${escape(t.when)}</p>${t.cta?`<button type="button" class="ns-cta" data-ns-section>${escape(t.cta)}</button>`:''}</div><p class="ns-sr" aria-live="polite"></p>`;
}
function mountBlock(){
 const card=isMath()?$('#next-assessment'):$('#nextsign .next');
 if(!card||!target)return;
 let block=card.querySelector('.ns-count');
 if(!block){
  // The guide's "nothing dated ahead" card has no slot for a countdown; it keeps its own layout.
  const slot=isMath()?card.querySelector('.next-bottom'):card.querySelector('.next-open');if(!slot)return;
  block=document.createElement('div');block.className='ns-count';slot.after(block);card.classList.add('ns-next');
 }
 block.dataset.precision=target.precision;block.dataset.key=target.id+target.precision+(target.at||target.date||'');
 block.innerHTML=blockHTML(target);
 block.querySelector('.ns-sr').textContent=sentence(target);
 paint();
}

/* ---- hero line + dock chip ---- */
function paint(){
 const t=target;if(!t)return;
 const p=parts(t),text=compact(t);
 document.documentElement.dataset.nsUrgency=p?.state||'';
 const block=$('.ns-count');
 if(block&&t.precision==='exact'&&p.ms){
  if(!block.querySelector('.ns-digits')){mountBlock();return;}
  for(const k of ['d','h','m','s']){const el=block.querySelector(`[data-unit="${k}"]`);if(el&&el.textContent!==pad(p[k])){el.textContent=pad(p[k]);el.dataset.tick=(Number(el.dataset.tick)||0)+1;}}
  paintRing(block,p.progress);
 }else if(block&&t.precision==='exact'&&block.querySelector('.ns-digits'))mountBlock();
 else if(block&&t.precision==='day')paintRing(block,p.progress??0);
 const minute=text+t.id;
 if(minute!==lastMinute){lastMinute=minute;const sr=block?.querySelector('.ns-sr');if(sr)sr.textContent=sentence(t);}
 for(const chip of document.querySelectorAll('[data-ns-chip]'))chip.textContent=text;
 for(const name of document.querySelectorAll('[data-ns-title]'))name.textContent=t.title;
 for(const when of document.querySelectorAll('[data-ns-when]'))when.textContent=t.when;
}

export async function resolve(){
 const state=live;if(!state)return;
 const loaded=data$||await (isMath()?courseData():loadData('cen100'));
 if(live!==state||state.life.signal.aborted||!loaded)return;data$=loaded;
 const saved=readSaved(course,data$);
 const next=resolveTarget({course,data:data$,section:liveSection(saved.section),completed:saved.completed,now:Date.now(),id:shownId()||null});
 const changed=JSON.stringify(next)!==JSON.stringify(target);
 target=next;
 if(changed||!$('.ns-count'))mountBlock();
 hud();dockSync();
 for(const fn of listeners)fn(target);
 // The book's chips and the rail's Next control follow the target (semester-book spec §6.7, §6.10).
 if(changed){const book=currentBookState();book?.setWeeks(book.weeks,{reason:'target'});}
 schedule();
}
/* Recompute from the wall clock each tick, never from accumulated counts. Seconds tick only while
   ambient motion is allowed; paused, the digits update once a minute. At zero the card says so, and the
   guide's own next-deadline logic moves on; a re-resolve 2 h later picks up whatever it chose. */
function schedule(){
 clearTimeout(tickTimer);
 if(!live||!target||document.hidden)return;
 const p=parts(target),everySecond=target.precision==='exact'&&p.ms&&ambientAllowed();
 let wait=everySecond?1000-Date.now()%1000:60000-Date.now()%60000;
 if(target.precision==='exact'&&!p.ms)wait=Math.max(60000,Math.min(wait,target.at+GRACE-Date.now()));
 tickTimer=setTimeout(()=>{const before=p.ms;paint();const after=parts(target);if(before&&!after.ms||target.precision==='exact'&&!after.ms&&Date.now()>target.at+GRACE)resolve();else schedule();},wait);
}

function hud(){
 const copy=$('.header-upgraded .hero-copy');if(!copy||!target)return;
 let line=copy.querySelector('.ns-hud');
 if(!line){line=document.createElement('p');line.className='ns-hud';line.innerHTML='<span class="ns-hud-k">Next</span><span data-ns-title></span><span class="ns-hud-sep" aria-hidden="true">·</span><span data-ns-chip></span>';copy.append(line);}
 paint();
}

function dockSync(){const dock=$('.ns-dock');if(dock&&target)paint();}
function motionLabel(button){
 const pref=preference(),locked=!!(pref.reduced||pref.forced||pref.paused);
 const paused=locked||!!pref.scenePaused;
 button.setAttribute('aria-pressed',String(paused));
 button.querySelector('span').textContent=paused?'Play motion':'Pause motion';
 button.disabled=locked;button.title=locked?'Motion follows your device setting':paused?'Resume motion':'Pause all motion';
}
export function mountDock(){
 const header=$('.header-upgraded');if(!header||!live)return;
 if(!dock){
 dock=document.createElement('div');dock.className='ns-dock';dock.setAttribute('role','region');dock.setAttribute('aria-label','Course quick bar');
 dock.innerHTML=`<div class="ns-dock-bar"><span class="ns-dock-progress" aria-hidden="true"></span><a class="ns-dock-id" href="#top"><i aria-hidden="true"></i><b></b><span></span></a><a class="ns-dock-desk" href="${asset('../../')}" aria-label="Go to Course Desk">Desk</a><div class="ns-dock-next"><span class="ns-dock-k">Next</span><span class="ns-dock-title" data-ns-title></span><span class="ns-dock-chip" data-ns-chip></span></div><div class="ns-dock-actions"><button type="button" class="ns-dock-section" data-ns-section></button><button type="button" class="ns-dock-motion" data-ns-motion aria-pressed="false"><i aria-hidden="true"></i><span>Pause motion</span></button><button type="button" class="ns-dock-search" data-ns-search aria-label="Search the guide. Shortcut: Command K"><span>Search</span><kbd>⌘K</kbd></button></div></div>`;
 document.body.append(dock);
 dockLife=scope();
 dockLife.on(dock.querySelector('.ns-dock-id'),'click',e=>{e.preventDefault();window.scrollTo({top:0,behavior:'smooth'});});
 dockLife.on(document,'click',e=>{if(e.target.closest('[data-ns-section]'))$('.workspace-section')?.click();else if(e.target.closest('[data-ns-motion]'))toggleMotion();});
 const motion=dock.querySelector('[data-ns-motion]');motionLabel(motion);
 dockLife.on(document,'guide-motion-change',()=>motionLabel(motion));
 dockLife.on(document,'route-changed',e=>{if(e.detail?.route==='desk'){dock.hidden=true;dock.inert=true;document.documentElement.classList.remove('ns-docked');}});
 }
 dock.hidden=false;
 const id=dock.querySelector('.ns-dock-id');id.setAttribute('aria-label','Back to top of '+META.code);id.querySelector('b').textContent=META.code;id.querySelector('span').textContent=META.name;
 const {life}=live;
 const sectionLabel=()=>{const b=$('.workspace-section');dock.querySelector('.ns-dock-section').textContent=b?.textContent||'Choose section';};
 sectionLabel();life.on(document,'change',()=>queueMicrotask(()=>{if(!life.signal.aborted)sectionLabel();}));
 const bar=header.querySelector('.workspace-actions')||header;let docked=null,open=null,queued=false;
 const main=header.closest('.wrap,.math-wrap'),fit=()=>{if(!main)return;const r=main.getBoundingClientRect();dock.style.setProperty('--ns-dock-left',r.left+'px');dock.style.setProperty('--ns-dock-width',r.width+'px');};
 // On a book route the dock stays actionable from arrival (semester-book spec §6.7): never inert, it waits
 // just above the viewport and comes down when one of its controls takes focus (layout.css). Elsewhere it
 // arrives once the action bar scrolls away.
 const always=()=>!!document.documentElement.dataset.book;
 const check=()=>{queued=false;fit();const next=bar.getBoundingClientRect().bottom<56,usable=next||always();
  if(next!==docked){docked=next;document.documentElement.classList.toggle('ns-docked',next);}
  if(usable!==open){open=usable;dock.inert=!usable;}};
 life.on(window,'scroll',()=>{if(!queued){queued=true;life.frame(check);}},{passive:true});life.on(window,'resize',check);life.on(document,'workspace-changed',()=>life.frame(check));
 life.on(document,'book-state',()=>life.frame(check));check();
 /* The book's hand-off (scroll.mjs): the dock comes down as the cover closes, and the closed book lands in
    the course dot with a static 400 ms glow. */
 let received=0,last=0;const root=document.documentElement;
 life.on(document,'night-handoff',event=>{
  const p=Number(event.detail)||0;
  root.classList.toggle('ns-dock-show',p>=.3);
  if(p>=1&&last<1&&ambientAllowed()){root.classList.add('ns-dock-received');clearTimeout(received);received=setTimeout(()=>root.classList.remove('ns-dock-received'),400);}
  last=p;
 });
 life.own(()=>{clearTimeout(received);root.classList.remove('ns-dock-received','ns-dock-show');});
}

export function mount(ctx={}){
 unmount();const life=scope(ctx);live={life};
 const card=isMath()?$('#next-assessment'):$('#nextsign');if(!card){unmount();return;}
 life.observer(new MutationObserver(()=>{if(!card.querySelector('.ns-count')||card.dataset.nextId!==card._nsId){card._nsId=card.dataset.nextId;resolve();}}),card,{childList:true,subtree:false,attributes:true,attributeFilter:['data-next-id','data-schedule']});
 life.own(()=>delete card._nsId);
 card._nsId=card.dataset.nextId;
 for(const type of ['guide-completion','workspace-changed'])life.on(document,type,()=>queueMicrotask(()=>{if(!life.signal.aborted)resolve();}));
 life.on(document,'change',e=>{if(e.target.matches('#section-select,#contact-section,#contact-group'))queueMicrotask(()=>{if(!life.signal.aborted)resolve();});});
 life.on(document,'visibilitychange',()=>{if(!document.hidden)resolve();else clearTimeout(tickTimer);});
 life.on(window,'pageshow',()=>resolve());
 life.on(document,'guide-motion-change',schedule);life.on(document,'night-hold',schedule);
 mountDock();return resolve();
}

export const mountDeadline=mount;
export function unmount(){if(!live)return;const state=live;live=null;state.life.dispose();clearTimeout(tickTimer);tickTimer=0;target=data$=null;lastMinute='';document.querySelectorAll('.ns-count,.ns-hud').forEach(el=>el.remove());document.querySelectorAll('.ns-next').forEach(el=>el.classList.remove('ns-next'));delete document.documentElement.dataset.nsUrgency;if(dock){dock.hidden=true;dock.inert=true;}document.documentElement.classList.remove('ns-docked');}
