/* Semester timeline on Assignments. Data comes from the guides' own schedule feed.
   Each course draws the track in its own vocabulary (see layout.css [data-ns-course]). */
import {scope} from '../route-lifecycle.mjs';
import {META,$,escape,TERM,today,dateLabel,dayLabel,addDays,scheduleRows,onSchedule,openItem} from './core.mjs?v=20261013-shift2';

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
function centerToday(){const scroller=root.querySelector('.ns-tl-scroll'),t=root.querySelector('.ns-tl-today');if(!scroller||!t||scroller.scrollWidth<=scroller.clientWidth)return;scroller.scrollLeft=t.offsetLeft-scroller.clientWidth/2;}

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
