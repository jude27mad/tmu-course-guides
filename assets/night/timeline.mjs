/* Semester timeline on Assignments, and the semester book's rail.
   Non-book courses: the flat timeline drawn from the guides' own schedule feed, each course in its own
   vocabulary (layout.css [data-ns-course]).
   Book courses (semester-book spec §6.3, §6.8): the rail under the stage is the book's real-text mirror (a
   caption for the selected spread plus the week controls), and the flat timeline becomes the fallback week
   view, built from the same BookState weeks, shown only when the book cannot render. */
import {scope} from '../route-lifecycle.mjs';
import {META,$,escape,TERM,today,dateLabel,dayLabel,addDays,scheduleRows,onSchedule,openItem,atLeast,onTier,motionAllowed} from './core.mjs?v=20261013-shift1';
import {currentBookState,currentBookHost} from '../book/book-state.mjs';
import {weekIndexFor} from '../book/weeks.mjs';
import {currentTarget,onTarget} from './deadline.mjs?v=20261013-shift1';

const ms=d=>Date.parse(d+'T12:00:00Z');
const span=ms(TERM.end)-ms(TERM.start);
const pos=d=>Math.max(0,Math.min(1,(ms(d)-ms(TERM.start))/span));
const pct=d=>(pos(d)*100).toFixed(3)+'%';
let root,popover,lastSignature='',life;

function weeks(){const out=[];for(let d=TERM.start;d<=TERM.end;d=addDays(d,7))out.push(d);return out;}
function months(){const out=[];for(const m of ['2026-09-01','2026-10-01','2026-11-01','2026-12-01']){const d=m<TERM.start?TERM.start:m;out.push([d,new Date(m+'T12:00:00Z').toLocaleDateString('en-CA',{month:'long',timeZone:'UTC'})]);}return out;}

/* Course motif drawn behind the rail: a flowing curve for Calculus, a basis grid for Linear Algebra,
   gear teeth for Engineering. Purely decorative. */
function motif(elapsed){
 if(META.motif==='flow'){
  let d='M0 34';for(let i=1;i<=80;i++){const x=i/80*1000,y=34-Math.sin(i/80*Math.PI*5)*14*Math.sin(i/80*Math.PI);d+=` L${x.toFixed(1)} ${y.toFixed(2)}`;}
  return `<svg class="ns-tl-motif" viewBox="0 0 1000 68" preserveAspectRatio="none" aria-hidden="true"><path class="ns-tl-flow" d="${d}" pathLength="1"/><path class="ns-tl-flow ns-tl-flow-done" d="${d}" pathLength="1" style="stroke-dasharray:${elapsed.toFixed(4)} 1"/></svg>`;
 }
 if(META.motif==='plane')return '<span class="ns-tl-motif ns-tl-grid" aria-hidden="true"></span>';
 return '<span class="ns-tl-motif ns-tl-teeth" aria-hidden="true"></span>';
}

function render(rows){
 if(!root)return;
 const now=today(),groups=new Map();
 for(const r of rows){if(!r.date||r.date<TERM.start||r.date>TERM.end)continue;if(!groups.has(r.date))groups.set(r.date,[]);groups.get(r.date).push(r);}
 const signature=now+JSON.stringify([...groups]);if(signature===lastSignature)return;lastSignature=signature;
 const elapsed=pos(now),dates=[...groups.keys()].sort();
 const upcoming=dates.find(d=>d>=now&&groups.get(d).some(r=>!r.completed));
 const total=rows.filter(r=>r.date>=TERM.start).length,done=rows.filter(r=>r.completed).length;
 root.querySelector('.ns-tl-stats').innerHTML=`<span><b>${Math.round(elapsed*100)}%</b> of term</span><span><b>${done}</b>/${total} recorded</span>`;
 const track=root.querySelector('.ns-tl-track');
 track.style.setProperty('--elapsed',(elapsed*100).toFixed(2)+'%');
 track.innerHTML=motif(elapsed)+`<div class="ns-tl-rail"><span class="ns-tl-fill"></span></div>`+
  weeks().map((w,i)=>`<span class="ns-tl-tick${i%2?'':' ns-tl-tick-major'}" style="left:${pct(w)}" aria-hidden="true"></span>`).join('')+
  months().map(([d,label])=>`<span class="ns-tl-month" style="left:${pct(d)}" aria-hidden="true">${label}</span>`).join('')+
  `<span class="ns-tl-today" style="left:${pct(now)}"><i aria-hidden="true"></i><span>Today</span></span>`+
  dates.map(d=>{const items=groups.get(d),complete=items.every(r=>r.completed),past=d<now;
   const name=items.length>1?`${items.length} deadlines`:items[0].title;
   return `<button type="button" class="ns-tl-node${complete?' is-done':''}${past?' is-past':''}${d===upcoming?' is-next':''}" style="left:${pct(d)}" data-date="${d}" aria-label="${escape(dateLabel(d)+': '+name+(complete?', recorded done':''))}"><i aria-hidden="true">${items.length>1?items.length:complete?'✓':''}</i><span class="ns-tl-tip" aria-hidden="true"><b>${escape(dateLabel(d))}</b>${escape(name)}</span></button>`;}).join('');
 root.dataset.groups=JSON.stringify([...groups]);
 centerToday();
 root.dispatchEvent(new CustomEvent('night-timeline-render',{bubbles:true}));
}
function centerToday(){const scroller=root?.querySelector('.ns-tl-scroll'),t=root?.querySelector('.ns-tl-today');if(!scroller||!t||scroller.scrollWidth<=scroller.clientWidth)return;scroller.scrollLeft=t.offsetLeft-scroller.clientWidth/2;}

function closePopover(){if(popover){popover.remove();popover=null;}}
function openGroup(node){
 const groups=new Map(JSON.parse(root.dataset.groups||'[]')),items=groups.get(node.dataset.date)||[];
 if(items.length===1){openItem(items[0].target);return;}
 closePopover();
 popover=document.createElement('div');popover.className='ns-tl-pop';popover.setAttribute('role','dialog');popover.setAttribute('aria-label',`Deadlines on ${dateLabel(node.dataset.date)}`);
 popover.innerHTML=`<p>${escape(dayLabel(node.dataset.date))}, ${escape(dateLabel(node.dataset.date))}</p><ul>${items.map((r,i)=>`<li><button type="button" data-i="${i}">${r.completed?'<span class="ns-tl-check" aria-label="Recorded done">✓</span>':''}<span>${escape(r.title)}</span><small>${escape(r.note||'')}</small></button></li>`).join('')}</ul>`;
 root.append(popover);
 const box=root.getBoundingClientRect(),n=node.getBoundingClientRect();
 popover.style.left=Math.max(8,Math.min(box.width-popover.offsetWidth-8,n.left-box.left+n.width/2-popover.offsetWidth/2))+'px';
 life.on(popover,'click',e=>{const b=e.target.closest('[data-i]');if(!b)return;const r=items[Number(b.dataset.i)];closePopover();openItem(r.target);});
 life.on(popover,'keydown',e=>{if(e.key==='Escape'){closePopover();node.focus();}});
 popover.querySelector('button')?.focus();
}

export function mount(ctx={}){
 unmount();life=scope(ctx);
 const panel=$('#workspace-assignments');if(!panel||$('.ns-timeline'))return;
 const book=currentBookState();
 if(book){mountWeekView(panel,book);return;}
 root=document.createElement('section');root.className='ns-timeline';root.setAttribute('aria-label','Semester timeline');
 root.innerHTML=`<header class="ns-tl-head"><p class="ns-kicker">Fall 2026 · Sep 8 – Dec 21</p><div class="ns-tl-stats"></div></header><div class="ns-tl-scroll"><div class="ns-tl-track"></div></div>`;
 const next=$('.next-layout,.cen-next-layout',panel);(next||panel.querySelector('.workspace-page-title')).after(root);
 life.on(root,'click',e=>{const node=e.target.closest('.ns-tl-node');if(node)openGroup(node);});
 life.on(document,'pointerdown',e=>{if(popover&&!popover.contains(e.target)&&!e.target.closest('.ns-tl-node'))closePopover();});
 life.own(onSchedule(render));render(scheduleRows());
 life.observer(new ResizeObserver(()=>centerToday()),root);
 life.interval(()=>render(scheduleRows()),60000);
}

export const mountTimeline=mount;
export function unmount(){life?.dispose();life=null;closePopover();root?.remove();root=null;lastSignature='';}

/* ======================================================================= the semester book ============== */

const KIND_ORDER={final:4,midterm:3,quiz:2,lab:2,reading:1,minor:1};
const STATUS={NOW:'Happening now',DONE:'Completed'};
const SPOKEN_MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
const longDate=date=>`${dayLabel(date)}, ${SPOKEN_MONTHS[Number(date.slice(5,7))-1]} ${Number(date.slice(8,10))}`;
const shortDay=date=>`${dayLabel(date).slice(0,3)} ${dateLabel(date)}`;
const timeTag=date=>`<time datetime="${date}">${escape(shortDay(date))}</time>`;
let railSeq=0;

/** The spread's tallest landmark, the way its pop-ups rank: final > midterm > quiz or lab > minor. */
function landmark(view){
 const top=view?.entries?.find(entry=>entry.id===view.popups?.[0]);
 return top?.kind||null;
}
const allDone=view=>!!view?.entries?.length&&view.entries.every(entry=>entry.completed);

/** The pending spread's index, or -1. */
const pendingIndex=list=>list.findIndex(spread=>spread?.pending||!spread?.start);

/** Which spread holds the dock's target: its date or week, the pending spread for an undated final. */
export function targetWeek(target,list){
 if(!target||!Array.isArray(list)||!list.length||target.precision==='empty')return -1;
 const date=target.date||target.week||null;
 if(!date||target.precision==='pending'){const pending=pendingIndex(list);return pending>=0?pending:list.length-1;}
 return weekIndexFor(date,list);
}

/**
 * The rail under the stage (§6.3): a real-text caption for the selected spread and the week controls.
 * Renders BookState.index (never per frame). Returns {element, dispose}.
 * options: {signal, setFocus(id|null) → the engine's static tag highlight, slot → the art slot (book-hover)}
 */
export function mountRail(header,state,{signal,setFocus=()=>{},slot=null}={}){
 if(!header||!state)return null;
 const own=scope({signal}),uid=++railSeq,id=s=>`ns-spread-${s}-${uid}`;
 const section=document.createElement('section');section.className='ns-spread';section.setAttribute('aria-labelledby',id('h'));
 section.innerHTML=`<h2 id="${id('h')}" class="ns-sr">Semester book</h2><p class="ns-sr" aria-live="polite" data-ns-spread-live></p>`+
  `<div class="ns-spread-caption"><div class="ns-spread-head"><p class="ns-spread-kicker"></p><p class="ns-spread-dates"></p></div><div class="ns-spread-body"></div></div>`+
  `<div class="ns-spread-jump" role="group" aria-label="Week shortcuts">`+
   `<button type="button" class="ns-week-today" aria-describedby="${id('today')}"><i aria-hidden="true"></i><span>Go to today</span></button><span class="ns-sr" id="${id('today')}">Go to the week containing today</span>`+
   `<button type="button" class="ns-week-next" hidden><span class="ns-week-next-k">Next assessment</span><span class="ns-week-next-t"></span><b aria-hidden="true">→</b></button></div>`+
  `<nav class="ns-weeks" aria-label="Semester weeks"><button type="button" class="ns-week-step" data-step="-1"><b aria-hidden="true">‹</b><span>Previous week</span></button>`+
   `<div class="ns-week-scroll"><div class="ns-week-ticks" role="radiogroup" aria-label="Week"></div></div>`+
   `<button type="button" class="ns-week-step" data-step="1"><span>Next week</span><b aria-hidden="true">›</b></button><span class="ns-sr" id="${id('now')}"></span></nav>`;
 const actions=header.querySelector(':scope > .workspace-actions');
 if(actions)actions.before(section);else header.append(section);
 const q=s=>section.querySelector(s);
 const live=q('[data-ns-spread-live]'),kicker=q('.ns-spread-kicker'),dates=q('.ns-spread-dates'),body=q('.ns-spread-body');
 const todayButton=q('.ns-week-today'),nextButton=q('.ns-week-next'),ticks=q('.ns-week-ticks'),scroller=q('.ns-week-scroll');
 const [prev,next]=[...section.querySelectorAll('.ns-week-step')],todayNote=q('.ns-weeks > .ns-sr');

 /* ---- ticks: one radio per spread, roving tabindex, stable accessible names ---- */
 let tickCount=-1;
 function buildTicks(){
  const list=state.weeks;
  if(tickCount!==list.length){
   tickCount=list.length;
   ticks.innerHTML=list.map((spread,i)=>{const pending=spread.pending||!spread.start;return `<button type="button" role="radio" class="ns-tick${pending?' ns-tick-pending':''}" data-index="${i}" aria-checked="false" tabindex="-1"><i class="ns-tick-bar" aria-hidden="true"></i><span class="ns-tick-n" aria-hidden="true">${pending?'Ex':i+1}</span></button>`;}).join('');
  }
  const s=state.snapshot();
  [...ticks.children].forEach((tick,i)=>{
   const view=state.view(i);
   if(view&&tick.getAttribute('aria-label')!==view.aria)tick.setAttribute('aria-label',view.aria);
   tick.dataset.kind=landmark(view)||'none';
   tick.toggleAttribute('data-done',allDone(view));
   tick.toggleAttribute('data-past',i<s.today);
   const isToday=i===s.today;
   if(isToday){tick.setAttribute('aria-current','date');tick.setAttribute('aria-describedby',todayNote.id);}
   else{tick.removeAttribute('aria-current');tick.removeAttribute('aria-describedby');}
   tick.toggleAttribute('data-today',isToday);
  });
  const spread=list[s.today];
  todayNote.textContent=spread?.start?`Today, ${longDate(today())}. Semester week ${s.today+1}`:'';
  // The ruler's elapsed line runs to the middle of today's week.
  ticks.style.setProperty('--elapsed',((s.today+.5)/Math.max(1,list.length)*100).toFixed(3)+'%');
  select(s.index);
 }
 function select(index){
  for(const tick of ticks.children){const on=Number(tick.dataset.index)===index;tick.setAttribute('aria-checked',String(on));tick.tabIndex=on?0:-1;}
  centreTick(index);
 }
 /* Centre the selected tick inside its own scroller: scrollLeft only, so the page and focus never move. */
 function centreTick(index){
  const tick=ticks.children[index];if(!tick||scroller.scrollWidth<=scroller.clientWidth+1)return;
  const left=tick.offsetLeft-(scroller.clientWidth-tick.offsetWidth)/2;
  scroller.scrollLeft=Math.max(0,Math.min(scroller.scrollWidth-scroller.clientWidth,left));
 }

 /* ---- caption ---- */
 function caption(){
  const s=state.snapshot(),view=state.view(s.index),spread=state.weeks[s.index];
  section.dataset.index=String(s.index);
  if(!view){kicker.textContent='';dates.textContent='';body.innerHTML='';return;}
  kicker.innerHTML=`${escape(view.caption.week)} · <b>${escape(view.caption.relative)}</b>`;
  const range=spread?.start?(spread.start===spread.end?timeTag(spread.start):`${timeTag(spread.start)}<span class="ns-dash" aria-hidden="true"> – </span><span class="ns-sr"> to </span>${timeTag(spread.end)}`):'<span>Date pending</span>';
  const partial=view.partial&&view.note?`<span class="ns-spread-note">${escape(view.note)}</span>`:'';
  dates.innerHTML=range+partial;
  if(!view.entries.length){
   body.innerHTML=`<p class="ns-spread-empty"><span aria-hidden="true">Nothing scheduled</span><span class="ns-sr">No assessments scheduled for this week</span></p>`;
   return;
  }
  const item=entry=>{
   const status=entry.completed?STATUS.DONE:entry.passed?entry.status:STATUS[entry.chip]||'';
   const describe=entry.cta?` aria-describedby="${id('cta')}"`:'';
   return `<li class="ns-spread-item" data-id="${escape(entry.id)}" data-urgency="${entry.urgency}"${entry.chip?` data-chip="${entry.chip}"`:''}${entry.completed?' data-done':''}${entry.passed?' data-passed':''}>`+
    `<button type="button" class="ns-spread-open" data-open="${escape(entry.open||'')}"><span class="ns-item-line"><span class="ns-item-kind">${escape(entry.kindLabel)}</span><span class="ns-item-title">${escape(entry.title)}</span>`+
    `${status?`<span class="ns-item-status">${escape(status)}</span>`:''}</span><span class="ns-item-when">${escape(entry.when||'')}</span></button>`+
    (entry.cta&&!entry.completed?`<button type="button" class="ns-cta ns-spread-cta" data-ns-section${describe}>${escape(entry.cta)}</button>`:'')+`</li>`;
  };
  const shown=view.entries.slice(0,3),rest=view.entries.slice(3);
  body.innerHTML=`<ul class="ns-spread-items">${shown.map(item).join('')}</ul>`+
   (rest.length?`<details class="ns-spread-more"><summary>+${rest.length} more</summary><ul class="ns-spread-items">${rest.map(item).join('')}</ul></details>`:'')+
   (view.entries.some(entry=>entry.cta)?`<span class="ns-sr" id="${id('cta')}">Select your lab section to see the quiz date</span>`:'');
 }

 /* ---- Today and Next assessment ---- */
 function jump(){
  const s=state.snapshot(),here=s.index===s.today;
  todayButton.setAttribute('aria-disabled',String(here));
  if(here)todayButton.title='You’re on this week';else todayButton.removeAttribute('title');
  const target=currentTarget(),week=targetWeek(target,state.weeks);
  nextButton.hidden=week<0;
  if(week<0)return;
  const open=week===s.index,spread=state.weeks[week];
  nextButton.dataset.week=String(week);nextButton.dataset.mode=open?'open':'week';
  nextButton.querySelector('.ns-week-next-k').textContent=open?'Open':'Next assessment';
  nextButton.querySelector('.ns-week-next-t').textContent=open?target.title:`${target.title} · ${spread?.start?'Week '+(week+1):'Exams'}`;
 }

 /* ---- the live region: once per settle, 400 ms later, never per frame ---- */
 let announced=state.view(state.snapshot().index)?.live||'',liveTimer=0;
 function announce(){
  clearTimeout(liveTimer);
  liveTimer=setTimeout(()=>{if(own.signal.aborted)return;const text=state.view(state.snapshot().index)?.live||'';if(text&&text!==announced){announced=text;live.textContent=text;}},400);
 }
 own.own(()=>clearTimeout(liveTimer));

 function render(){caption();buildTicks();jump();}
 render();

 own.own(state.subscribe((snap,change)=>{
  if(change.kind==='weeks'){render();return;}
  if(change.kind==='select'){caption();select(snap.index);jump();
   if(change.source==='palette')revealFromPalette();
   return;}
  if(change.kind==='settle')announce();
 }));
 own.own(onTarget(()=>jump()));

 /* After a palette pick, show the caption it changed and put focus on the chosen week. */
 function revealFromPalette(){
  requestAnimationFrame(()=>{
   if(own.signal.aborted)return;
   const r=section.getBoundingClientRect();
   // The header opens the page, so its caption is in view at the top.
   if(r.bottom<0||r.top>innerHeight){
    if(window.NightScroll)window.NightScroll.scrollTo(0,{immediate:!motionAllowed()});else window.scrollTo({top:0,behavior:'instant'});
   }
   ticks.querySelector('[aria-checked="true"]')?.focus({preventScroll:true});
  });
 }

 /* ---- input ---- */
 own.on(prev,'click',()=>state.step(-1,{source:'control'}));
 own.on(next,'click',()=>state.step(1,{source:'control'}));
 const ends=()=>{const s=state.snapshot();prev.setAttribute('aria-disabled',String(s.index<=0));next.setAttribute('aria-disabled',String(s.index>=s.count-1));};
 own.own(state.subscribe(ends));ends();
 own.on(todayButton,'click',()=>{if(todayButton.getAttribute('aria-disabled')==='true')return;state.openWeek(state.today,{source:'today'});});
 own.on(nextButton,'click',()=>{
  const week=Number(nextButton.dataset.week),target=currentTarget();
  if(nextButton.dataset.mode==='open'&&target?.open){openItem(target.open);return;}
  if(Number.isInteger(week)&&week>=0)state.openWeek(week,{source:'next'});
 });
 own.on(ticks,'click',event=>{const tick=event.target.closest('.ns-tick');if(tick)state.openWeek(Number(tick.dataset.index),{source:'control'});});
 own.on(ticks,'keydown',event=>{
  const s=state.snapshot(),last=s.count-1;
  const to={ArrowLeft:s.index-1,ArrowUp:s.index-1,ArrowRight:s.index+1,ArrowDown:s.index+1,Home:0,End:last,PageUp:s.index-4,PageDown:s.index+4}[event.key];
  if(to===undefined)return;
  event.preventDefault();
  const index=Math.max(0,Math.min(last,to));
  // Selection follows focus (APG radio group); repeated keys retarget the turn already in flight.
  state.openWeek(index,{source:'key'});
  ticks.children[index]?.focus({preventScroll:true});
 });
 own.on(body,'click',event=>{const button=event.target.closest('.ns-spread-open');if(button?.dataset.open)openItem(button.dataset.open);});
 // Caption focus or hover marks the matching pop-up in the scene; the scene's hover marks the caption.
 const focusId=event=>event.target.closest?.('.ns-spread-item')?.dataset.id??null;
 own.on(body,'pointerover',event=>{const value=focusId(event);if(value)setFocus(value);});
 own.on(body,'pointerleave',()=>setFocus(document.activeElement?.closest?.('.ns-spread-item')?.dataset.id??null));
 own.on(body,'focusin',event=>setFocus(focusId(event)));
 own.on(body,'focusout',event=>{if(!body.contains(event.relatedTarget))setFocus(null);});
 if(slot)own.on(slot,'book-hover',event=>{
  const hovered=event.detail?.id??null;
  for(const row of body.querySelectorAll('.ns-spread-item'))row.toggleAttribute('data-hover',row.dataset.id===hovered);
 });
 if('ResizeObserver' in window)own.observer(new ResizeObserver(()=>centreTick(state.snapshot().index)),scroller);

 const dispose=()=>{own.dispose();section.remove();};
 return {element:section,dispose,render};
}

/* ---- §6.8 the fallback week view: the complete flat timeline, from state.weeks. Shown when the renderer
   is the poster or the tier is low; hidden while the book runs (the rail stays). ---- */
function mountWeekView(panel,state){
 root=document.createElement('section');root.className='ns-timeline ns-weekview';root.dataset.nsCourse=META?.motif||'';
 root.setAttribute('aria-labelledby','ns-weekview-h');root.hidden=true;
 root.innerHTML=`<header class="ns-tl-head"><h2 class="ns-kicker" id="ns-weekview-h"><span aria-hidden="true">Week view</span><span class="ns-sr">Static semester week view</span></h2><div class="ns-tl-stats"></div></header><div class="ns-tl-scroll"><div class="ns-tl-track ns-wv-track"></div></div>`;
 const next=$('.next-layout,.cen-next-layout',panel);(next||panel.querySelector('.workspace-page-title')).after(root);
 const track=root.querySelector('.ns-wv-track');
 let signature='';
 function paint(force=false){
  const list=state.weeks,count=list.length;if(!count)return;
  const s=state.snapshot(),now=today(),views=list.map((_,i)=>state.view(i));
  const sig=JSON.stringify([now,s.today,views.map(v=>v?.signature)]);
  if(sig!==signature||force){
   signature=sig;
   const dated=list.filter(w=>w.start),first=dated[0]?.start;
   const anchor=first?addDays(first,-((new Date(first+'T12:00:00Z').getUTCDay()+6)%7)):now;
   const slot=100/count;
   // Each spread owns an equal slot; a date sits at its weekday inside its week's slot.
   const x=date=>{const days=Math.round((ms(date)-ms(anchor))/86400000);return Math.max(0,Math.min(count-1,Math.floor(days/7)))*slot+(days%7+.5)/7*slot;};
   const todayX=list[s.today]?.start&&now>=list[0].start?x(now):list[s.today]?.start?0:(s.today+.5)*slot;
   const records=list.flatMap((spread,i)=>(spread.records||[]).map(record=>({record,i,view:views[i]})));
   const done=records.filter(r=>r.record.completed).length;
   root.querySelector('.ns-tl-stats').innerHTML=`<span><b>${s.today+1}</b> of ${dated.length} weeks</span><span><b>${done}</b>/${records.length} recorded</span>`;
   track.style.setProperty('--elapsed',todayX.toFixed(2)+'%');track.style.setProperty('--slot',slot.toFixed(4)+'%');
   track.style.minWidth=Math.max(720,count*52)+'px';
   const monthMarks=[];let last='';
   list.forEach((spread,i)=>{
    if(!spread.start){monthMarks.push([(i+.08)*slot,'Exams']);return;}
    for(let d=spread.start;d<=spread.end;d=addDays(d,1)){const m=d.slice(0,7);if(m!==last){last=m;monthMarks.push([d===spread.start&&i===0?0:x(d),new Date(d+'T12:00:00Z').toLocaleDateString('en-CA',{month:'long',timeZone:'UTC'})]);}}
   });
   const nodes=records.map(({record,i,view})=>{
    const entry=view?.entries?.find(e=>e.id===record.id),day=entry?.day||record.date;
    const left=day?x(day):(i+.5)*slot;
    const label=`${entry?.title||record.title}: ${entry?.when||'Date pending'}${record.completed?'. Completed':''}`;
    return `<button type="button" class="ns-tl-node${record.completed?' is-done':''}${i<s.today?' is-past':''}${entry?.chip&&!record.completed&&entry.chip!=='PASSED'?' is-next':''}${day?'':' is-week'}" style="left:${left.toFixed(3)}%" data-open="${escape(record.open||'')}" aria-label="${escape(label)}"><i aria-hidden="true">${record.completed?'✓':''}</i><span class="ns-tl-tip" aria-hidden="true"><b>${escape(entry?.when||'Date pending')}</b>${escape(entry?.title||record.title)}</span></button>`;
   }).join('');
   track.innerHTML=`<div class="ns-tl-rail"><span class="ns-tl-fill"></span></div><span class="ns-wv-band" aria-hidden="true"></span>`+
    list.map((spread,i)=>`<button type="button" class="ns-wv-week${spread.start?'':' is-pending'}${i===s.today?' is-today':''}" style="left:${(i*slot).toFixed(3)}%;width:${slot.toFixed(3)}%" data-index="${i}" aria-label="${escape(views[i]?.aria||'')}"${i===s.today?' aria-current="date"':''}><span aria-hidden="true">${spread.start?i+1:'Ex'}</span></button>`).join('')+
    monthMarks.map(([left,label])=>`<span class="ns-tl-month" style="left:${left.toFixed(3)}%" aria-hidden="true">${escape(label)}</span>`).join('')+
    (list[s.today]?.start?`<span class="ns-tl-today" style="left:${todayX.toFixed(3)}%"><i aria-hidden="true"></i><span>Today</span></span>`:'')+nodes;
  }
  track.style.setProperty('--selected',(s.index*100/count).toFixed(4)+'%');
  for(const week of track.querySelectorAll('.ns-wv-week'))week.toggleAttribute('data-selected',Number(week.dataset.index)===s.index);
 }
 const centre=()=>{
  const scroller=root.querySelector('.ns-tl-scroll'),mark=root.querySelector('.ns-tl-today')||track.querySelector('[data-selected]');
  if(!scroller||!mark||scroller.scrollWidth<=scroller.clientWidth)return;
  scroller.scrollLeft=mark.offsetLeft-scroller.clientWidth/2;
 };
 const sync=()=>{
  const host=currentBookHost(),wanted=!atLeast('mid')||host?.renderer==='poster';
  if(root.hidden===!wanted)return;
  root.hidden=!wanted;
  if(wanted){paint(true);centre();root.dispatchEvent(new CustomEvent('night-timeline-render',{bubbles:true}));}
 };
 life.on(track,'click',event=>{
  const week=event.target.closest('.ns-wv-week');if(week){state.openWeek(Number(week.dataset.index),{source:'control'});return;}
  const node=event.target.closest('.ns-tl-node');if(node?.dataset.open)openItem(node.dataset.open);
 });
 life.own(state.subscribe((snap,change)=>{if(root.hidden)return;paint(change.kind==='weeks');}));
 life.on(document,'book-host',sync);
 life.own(onTier(sync));
 if('ResizeObserver' in window)life.observer(new ResizeObserver(()=>{if(!root.hidden)centre();}),root);
 paint(true);sync();
}
