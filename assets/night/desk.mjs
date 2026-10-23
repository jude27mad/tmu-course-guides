/* The Desk: the site's course directory (index.html, body[data-page=desk]).
   The static page is complete without JavaScript: plain links to each guide. This module adds each course's
   next deadline and the overall next one from the shared data-level resolver, without loading a course page,
   its DOM or a course workspace. It reads saved sections and completion records and writes nothing.
   Calm by design: no entrance animation, and the clock repaints once a minute (no seconds ticker).
   Route module (plan §12 contract): no import-time side effects; mount(ctx)/unmount() own every timer and
   listener, and all state lives in the current mount so a later router swap rebinds cleanly. */
import {COURSE_META,$,escape,today,dayLabel,dateLabel,clock} from './core.mjs?v=20261023-mth141';
import {COURSE_IDS,keys,loadData,readSaved,resolveTarget,overall,parts,compact,sentence} from './targets.mjs?v=20261023-mth141';
import {DAY_NAMES} from '../schedule.mjs';

const base=new URL('../../',import.meta.url); // the site root, under any deployment base
const guide=(course,hash='')=>new URL(course+'/'+hash,base).href;
// Item links use each guide's own deep links: #assignment-<item> (CEN) and #assessment-<id> (math).
const itemHref=t=>guide(t.course,t.course==='cen100'?'#assignment-'+t.open:'#'+t.open);
const sectionHref=course=>guide(course,'#course-info'); // the guide's info view holds its section picker
let live=null; // {root,data,timer,spoken,controller} for the current mount only

/* Course accents come from COURSE_META; desk.css only mirrors them for the first paint and no-JS. */
function tone(node,course){const meta=COURSE_META[course];if(!node||!meta)return;node.style.setProperty('--course',meta.accent);node.style.setProperty('--course-strong',meta.strong);}

function sectionText(course,records,section){
 if(!section)return '';
 if(course==='cen100')return `Section ${section}`;
 const lab=records.labs.find(l=>l.section===section);
 return lab?`Section ${section} · ${DAY_NAMES[lab.day].slice(0,3)} ${clock(lab.start)} lab · ${lab.room}`:`Section ${section}`;
}

function paintCourse(entry,t,section,now){
 const slot=entry.querySelector('[data-desk-next]');if(!slot)return;
 const p=parts(t,now),chip=compact(t,now);
 slot.dataset.precision=t.precision;slot.dataset.state=p.state;
 slot.innerHTML=`<p class="desk-k">Next</p><p class="desk-course-title">${escape(t.title)}</p><p class="desk-course-when">${escape(t.when)}</p>`+
  `<p class="desk-course-state"><span class="desk-chip">${escape(t.precision==='exact'&&p.ms>0?chip+' left':chip)}</span>${t.label!==chip?`<span class="desk-course-label">${escape(t.label)}</span>`:''}</p>`+
  (t.note?`<p class="desk-course-note">${escape(t.note)}</p>`:'')+
  (t.cta?`<a class="desk-cta" href="${sectionHref(t.course)}">${escape(t.cta)}</a>`:`<p class="desk-course-section">${escape(section||'No section saved')}</p>`);
 slot.hidden=false;
}

const pad=n=>String(n).padStart(2,'0');
function paintOverall(t,now){
 const card=$('[data-desk-overall]',live.root);if(!card)return;
 const body=card.querySelector('[data-desk-overall-body]');
 card.querySelector('[data-desk-static]').hidden=true;body.hidden=false;
 if(!t){
  card.dataset.precision='empty';card.style.removeProperty('--course');card.style.removeProperty('--course-strong');
  body.innerHTML='<p class="desk-next-title">No upcoming deadlines</p><p class="desk-count-when">No course has a dated deadline left in your records.</p>';
  return say('No upcoming deadlines to show.');
 }
 const meta=COURSE_META[t.course],p=parts(t,now);
 tone(card,t.course);card.dataset.precision=t.precision;card.dataset.state=p.state;card.dataset.deskCourse=t.course;
 // A timer only for a confirmed date and time that is still ahead; every other state keeps its own words.
 const face=t.precision==='exact'&&p.ms>0
  ?`<div class="desk-digits">${[['d','days'],['h','hrs'],['m','min']].map(([k,l])=>`<span class="desk-unit"><b>${pad(p[k])}</b><i>${l}</i></span>`).join('')}</div>`
  :`<p class="desk-word">${escape(t.range||compact(t,now))}</p>`;
 body.innerHTML=`<p class="desk-next-course"><i aria-hidden="true"></i><b>${meta.code}</b><span>${escape(meta.name)}</span></p>`+
  `<p class="desk-next-title">${escape(t.title)}</p>`+
  `<div class="desk-count"><div class="desk-face" aria-hidden="true">${face}</div><div class="desk-count-meta"><p class="desk-count-label">${escape(t.label)}</p><p class="desk-count-when">${escape(t.when)}</p>${t.note?`<p class="desk-count-note">${escape(t.note)}</p>`:''}</div></div>`+
  `<p class="desk-actions"><a class="desk-action" href="${itemHref(t)}">View in ${meta.code}<span aria-hidden="true">→</span></a>${t.cta?`<a class="desk-action desk-action-quiet" href="${sectionHref(t.course)}">${escape(t.cta)}</a>`:''}</p>`;
 say(`Next across your courses, ${meta.code}. ${sentence(t,now)}`);
}
/* Polite live region: changes at most once a minute, because render() runs at most once a minute. */
function say(text){const region=$('[data-desk-live]',live.root);if(region&&text!==live.spoken){live.spoken=text;region.textContent=text;}}

function render(){
 if(!live)return;
 clearTimeout(live.timer);
 const {root,data}=live,now=Date.now(),targets=[];
 for(const course of COURSE_IDS){
  const records=data[course];if(!records)continue; // records unavailable: that card keeps its plain link
  const saved=readSaved(course,records),t=resolveTarget({course,data:records,section:saved.section,completed:saved.completed,now});
  targets.push(t);paintCourse($(`[data-course-card="${course}"]`,root),t,sectionText(course,records,saved.section),now);
 }
 if(targets.length)paintOverall(overall(targets,now),now);
 const day=$('[data-desk-today]',root),date=today(new Date(now));
 if(day){day.textContent=`${dayLabel(date)}, ${dateLabel(date)} · Toronto`;day.hidden=false;}
 // Wall-clock minute boundaries, never accumulated ticks; nothing runs while the tab is hidden.
 if(!document.hidden)live.timer=setTimeout(render,Math.min(60000,60000-now%60000+50));
}

/* ctx: {root, route, signal, direct}. root defaults to the Desk's <main>; an aborted ctx.signal unmounts. */
export async function mount(ctx={}){
 unmount();
 const root=ctx.root||document.getElementById('desk-main')||document,controller=new AbortController(),signal=controller.signal;
 const state=live={root,data:{},timer:0,spoken:'',controller};
 ctx.signal?.addEventListener('abort',()=>{if(live===state)unmount();},{once:true,signal});
 for(const course of COURSE_IDS){tone($(`[data-course-card="${course}"]`,root),course);tone($(`[data-book="${course}"]`,root),course);}
 const loaded=await Promise.allSettled(COURSE_IDS.map(loadData));
 if(live!==state)return; // unmounted while the records loaded
 loaded.forEach((r,i)=>{if(r.status==='fulfilled'&&r.value)state.data[COURSE_IDS[i]]=r.value;else console.warn('Desk: '+COURSE_IDS[i]+' records unavailable',r.reason);});
 render();
 document.addEventListener('visibilitychange',()=>{if(document.hidden)clearTimeout(state.timer);else render();},{signal});
 addEventListener('pageshow',e=>{if(e.persisted)render();},{signal});
 addEventListener('focus',render,{signal});
 // Another tab may record work or change a section: re-resolve from storage.
 const watched=new Set(COURSE_IDS.flatMap(course=>Object.values(keys(course))));
 addEventListener('storage',e=>{if(e.key===null||watched.has(e.key))render();},{signal});
}
/* Stops the minute clock and every listener. The painted directory stays readable; the router replaces it. */
export function unmount(){
 if(!live)return;
 clearTimeout(live.timer);live.controller.abort();live=null;
}
