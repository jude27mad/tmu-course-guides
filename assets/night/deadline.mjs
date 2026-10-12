/* One resolved deadline feeds the next card, the dock chip and the hero line.
   A timer is shown only when the date and time are actually known. */
import {course,isMath,META,$,escape,read,courseData,timestamp,clock,dateLabel,dayLabel,resolveAssessment,timing,ambientAllowed,preference,toggleMotion} from './core.mjs';

const WINDOW=14*86400000,GRACE=2*3600e3;
let target=null,course$=null,tickTimer=0,lastMinute='';
const listeners=new Set();
export const currentTarget=()=>target;
export function onTarget(fn){listeners.add(fn);if(target)fn(target);return()=>listeners.delete(fn);}

const short=d=>`${dayLabel(d).slice(0,3)} ${dateLabel(d)}`;
function sectionNumber(){const v=Number(isMath?($('#section-select')?.value||read(course+'-section-v1',0)):0);return Number.isFinite(v)?v:0;}

function resolveMath(data){
 const id=$('#next-assessment')?.dataset.nextId;const a=data.assessments.find(x=>x.id===id);
 if(!a)return null;
 const e=resolveAssessment(data,a,sectionNumber()),base={id:a.id,title:a.title,kind:a.kind,open:'assessment-'+a.id};
 if(e.holiday)return {...base,precision:'week',when:timing(e),label:'Quiz date needs confirmation'};
 if(a.kind==='quiz'&&e.date&&e.lab){
  const start=timestamp(e.date,e.lab.start),end=timestamp(e.date,e.lab.end);
  return {...base,precision:'exact',at:start,end,when:`${short(e.date)} · ${clock(e.lab.start)} · ${e.lab.room}`,label:'Your lab quiz starts'};
 }
 if(a.kind==='quiz')return {...base,precision:'week',range:`${dateLabel(e.week)}–${dateLabel(e.weekEnd).replace(/^[A-Za-z]+ /,'')}`,when:`${dateLabel(e.week)}–${dateLabel(e.weekEnd)} · during your assigned lab`,label:'Quiz week',cta:'Choose your section for your quiz time'};
 if(e.date&&e.time)return {...base,precision:'exact',at:timestamp(e.date,e.time),end:e.end?timestamp(e.date,e.end):null,when:`${short(e.date)} · ${clock(e.time)} Toronto`,label:a.kind==='midterm'?'Test starts':'Starts'};
 if(e.date)return {...base,precision:'day',date:e.date,when:short(e.date),label:'Time not posted'};
 return {...base,precision:'pending',when:'Date pending',label:'Awaiting the official schedule'};
}
function resolveCen(){
 const ns=$('#nextsign'),first=(ns?.dataset.schedule||'').split('|')[0].split(':')[0];
 const e=(window.CEN_SCHEDULE||[]).find(x=>x.id===first);if(!e)return null;
 const base={id:e.id,title:e.title.replace(/ due$/,''),kind:'assignment',open:e.item};
 if(e.time)return {...base,precision:'exact',at:timestamp(e.date,e.time),when:`${short(e.date)} · ${clock(e.time)} Toronto`,label:'Due'};
 return {...base,precision:'day',date:e.date,when:short(e.date),label:'Time not posted · check D2L'};
}

/* Pure formatting so every surface agrees. */
export function parts(t,now=Date.now()){
 if(!t)return null;
 if(t.precision==='exact'){
  const ms=t.at-now;
  if(ms<=0)return {state:t.end&&now<t.end?'live':'passed',ms:0};
  const s=Math.floor(ms/1000);
  return {state:ms<6*3600e3?'hot':ms<48*3600e3?'soon':'ahead',ms,d:Math.floor(s/86400),h:Math.floor(s%86400/3600),m:Math.floor(s%3600/60),s:s%60,progress:Math.max(0,Math.min(1,ms/WINDOW))};
 }
 if(t.precision==='day'){
  const todayUtc=Date.parse(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto'}).format(new Date(now))+'T12:00:00Z');
  const days=Math.round((Date.parse(t.date+'T12:00:00Z')-todayUtc)/86400000);
  return {state:days<0?'passed':days===0?'hot':days<=2?'soon':'ahead',days,progress:Math.max(0,Math.min(1,days*86400000/WINDOW))};
 }
 return {state:t.precision};
}
export function compact(t,now=Date.now()){
 const p=parts(t,now);if(!p)return '';
 if(t.precision==='exact'){if(p.state==='live')return 'Happening now';if(p.state==='passed')return 'Due time passed';return p.d?`${p.d}d ${p.h}h ${String(p.m).padStart(2,'0')}m`:`${p.h}h ${String(p.m).padStart(2,'0')}m`;}
 if(t.precision==='day')return p.days<0?'Date passed':p.days===0?'Today':p.days===1?'Tomorrow':`In ${p.days} days`;
 if(t.precision==='week')return 'Quiz week';
 return 'Date pending';
}
function sentence(t){
 const p=parts(t);if(!p)return '';
 if(t.precision==='exact'&&p.ms)return `${t.title}: ${p.d} days, ${p.h} hours and ${p.m} minutes left. ${t.when}.`;
 return `${t.title}: ${compact(t)}. ${t.when}.`;
}

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
 const card=isMath?$('#next-assessment'):$('#nextsign .next');
 if(!card||!target)return;
 let block=card.querySelector('.ns-count');
 if(!block){block=document.createElement('div');block.className='ns-count';(isMath?card.querySelector('.next-bottom'):card.querySelector('.next-open'))?.after(block);card.classList.add('ns-next');}
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
 course$??=await courseData();
 const next=isMath?resolveMath(course$):resolveCen();
 const changed=JSON.stringify(next)!==JSON.stringify(target);
 target=next;
 if(changed||!$('.ns-count'))mountBlock();
 hud();dockSync();
 for(const fn of listeners)fn(target);
 schedule();
}
/* Recompute from the wall clock each tick, never from accumulated counts. Seconds tick only while
   ambient motion is allowed; paused, the digits update once a minute. At zero the card says so, and the
   guide's own next-deadline logic moves on; a re-resolve 2 h later picks up whatever it chose. */
function schedule(){
 clearTimeout(tickTimer);
 if(!target||document.hidden)return;
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
 const header=$('.header-upgraded');if(!header||$('.ns-dock'))return;
 const dock=document.createElement('div');dock.className='ns-dock';dock.setAttribute('role','region');dock.setAttribute('aria-label','Course quick bar');
 dock.innerHTML=`<div class="ns-dock-bar"><span class="ns-dock-progress" aria-hidden="true"></span><a class="ns-dock-id" href="#top" aria-label="Back to top of ${META.code}"><i aria-hidden="true"></i><b>${META.code}</b><span>${escape(META.name)}</span></a><div class="ns-dock-next"><span class="ns-dock-k">Next</span><span class="ns-dock-title" data-ns-title></span><span class="ns-dock-chip" data-ns-chip></span></div><div class="ns-dock-actions"><button type="button" class="ns-dock-section" data-ns-section></button><button type="button" class="ns-dock-motion" data-ns-motion aria-pressed="false"><i aria-hidden="true"></i><span>Pause motion</span></button><button type="button" class="ns-dock-search" data-ns-search aria-label="Search the guide"><span>Search</span><kbd>⌘K</kbd></button></div></div>`;
 document.body.append(dock); // outside .course-workspace: its perspective would capture position:fixed
 dock.querySelector('.ns-dock-id').addEventListener('click',e=>{e.preventDefault();window.scrollTo({top:0,behavior:'smooth'});});
 const sectionLabel=()=>{const b=$('.workspace-section');dock.querySelector('.ns-dock-section').textContent=b?.textContent||'Choose section';};
 sectionLabel();document.addEventListener('change',()=>queueMicrotask(sectionLabel));
 const motion=dock.querySelector('[data-ns-motion]');motionLabel(motion);
 document.addEventListener('guide-motion-change',()=>motionLabel(motion));
 const bar=header.querySelector('.workspace-actions')||header;let docked=null,queued=false;
 const main=header.closest('.wrap,.math-wrap'),fit=()=>{const r=main.getBoundingClientRect();dock.style.setProperty('--ns-dock-left',r.left+'px');dock.style.setProperty('--ns-dock-width',r.width+'px');};
 const check=()=>{queued=false;fit();const next=bar.getBoundingClientRect().bottom<56;if(next===docked)return;docked=next;document.documentElement.classList.toggle('ns-docked',next);dock.inert=!next;};
 addEventListener('scroll',()=>{if(!queued){queued=true;requestAnimationFrame(check);}},{passive:true});addEventListener('resize',check);document.addEventListener('workspace-changed',()=>requestAnimationFrame(check));check();
}

export function mountDeadline(){
 const card=isMath?$('#next-assessment'):$('#nextsign');if(!card)return;
 new MutationObserver(()=>{if(!card.querySelector('.ns-count')||card.dataset.nextId!==card._nsId){card._nsId=card.dataset.nextId;resolve();}}).observe(card,{childList:true,subtree:false,attributes:true,attributeFilter:['data-next-id','data-schedule']});
 card._nsId=card.dataset.nextId;
 document.addEventListener('click',e=>{
  if(e.target.closest('[data-ns-section]')){$('.workspace-section')?.click();}
  else if(e.target.closest('[data-ns-motion]'))toggleMotion();
 });
 for(const type of ['guide-completion','workspace-changed'])document.addEventListener(type,()=>queueMicrotask(resolve));
 document.addEventListener('change',e=>{if(e.target.matches('#section-select,#contact-section,#contact-group'))queueMicrotask(resolve);});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)resolve();else clearTimeout(tickTimer);});
 window.addEventListener('pageshow',()=>resolve());
 document.addEventListener('guide-motion-change',schedule);document.addEventListener('night-hold',schedule);
 mountDock();resolve();
}
