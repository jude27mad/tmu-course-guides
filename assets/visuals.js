(() => {
'use strict';
const $=s=>document.querySelector(s), esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=d=>new Date(d+'T12:00:00Z'), add=(d,n)=>{const x=date(d);x.setUTCDate(x.getUTCDate()+n);return x.toISOString().slice(0,10)}, label=d=>date(d).toLocaleDateString('en-CA',{month:'short',day:'numeric',timeZone:'UTC'});
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
let moved=null,placeholder=null,returnFocus=null,oldScroll=0;
const sheet=document.createElement('dialog');sheet.className='detail-sheet';sheet.setAttribute('aria-labelledby','sheet-heading');sheet.innerHTML='<div class="sheet-toolbar"><h2 id="sheet-heading">Assignment details</h2><button class="sheet-close" type="button">Close ✕</button></div><div class="sheet-content"></div>';document.body.append(sheet);
function close(){if(sheet.open)sheet.close();if(moved)restore();}
function restore(){if(moved&&placeholder?.isConnected){placeholder.replaceWith(moved);const h=moved.querySelector('.head');if(h){h.setAttribute('aria-expanded','false');moved.querySelector('.body').hidden=true;}const d=moved.querySelector('details.assessment');if(d)d.open=false;}document.body.classList.remove('sheet-open');window.scrollTo(0,oldScroll);const target=returnFocus?.isConnected?returnFocus:moved?.querySelector('.head,summary');moved=null;placeholder=null;target?.focus({preventScroll:true});}
sheet.addEventListener('close',()=>{if(!sheet.open&&moved)restore()});sheet.querySelector('.sheet-close').addEventListener('click',close);sheet.addEventListener('click',e=>{if(e.target===sheet)close()});
function open(node,trigger){if(!node||!sheet.showModal)return false;if(moved===node&&sheet.open)return true;close();oldScroll=window.scrollY;returnFocus=trigger||document.activeElement;placeholder=document.createElement('li');placeholder.hidden=true;node.before(placeholder);moved=node;node.hidden=false;const h=node.querySelector('.head');if(h){h.setAttribute('aria-expanded','true');node.querySelector('.body').hidden=false;}const d=node.querySelector('details.assessment');if(d)d.open=true;sheet.querySelector('.sheet-content').append(node);sheet.querySelector('h2').textContent=document.body.dataset.course==='cen100'?'Assignment details':'Assessment details';document.body.classList.add('sheet-open');sheet.showModal();sheet.scrollTop=0;sheet.querySelector('.sheet-close').focus();return true;}
document.addEventListener('click',e=>{const h=e.target.closest('.head,details.assessment>summary');if(!h)return;if(sheet.contains(h)){e.preventDefault();e.stopImmediatePropagation();return;}if(open(h.closest('li'),h)){e.preventDefault();e.stopImmediatePropagation();}},true);
document.addEventListener('change',()=>{queueMicrotask(()=>{if(moved?.hidden)close()})});
const rail=document.createElement('section');rail.className='semester-rail';rail.setAttribute('aria-label','Semester timeline');rail.innerHTML='<div class="rail-heading"><div><h2>Semester at a glance</h2><p>Tap a week. Open a deadline without losing your place.</p></div></div><div class="rail-track"></div><div class="rail-summary"></div><div class="rail-events"></div>';
(document.querySelector('.cen-next-layout')||document.getElementById('board')||document.getElementById('quick-confirm')||document.querySelector('.quick-find')).after(rail);
let events=[],selected='',signature='';const start='2026-09-07',weeks=Array.from({length:14},(_,i)=>add(start,i*7));
function currentWeek(){const t=today();return [...weeks].reverse().find(w=>w<=t)||start;}
function render(){const t=today(),now=currentWeek();if(!selected)selected=weeks.includes(now)?now:weeks[weeks.length-1];const sig=JSON.stringify([events,selected,t]);if(sig===signature)return;signature=sig;
rail.querySelector('.rail-track').innerHTML=weeks.map((w,i)=>{const rows=events.filter(e=>e.date>=w&&e.date<add(w,7));return `<button type="button" class="rail-week ${w===now?'today-week':''}" data-week="${w}" aria-pressed="${w===selected}" aria-label="Week of ${label(w)}, ${rows.length} deadlines"><span>${date(w).toLocaleDateString('en-CA',{month:'short',timeZone:'UTC'})}</span><b>${date(w).getUTCDate()}</b><div class="rail-dots">${rows.slice(0,5).map(e=>`<i class="rail-dot ${e.completed?'recorded':''}"></i>`).join('')}</div></button>`}).join('');
const rows=events.filter(e=>e.date>=selected&&e.date<add(selected,7));rail.querySelector('.rail-summary').innerHTML=`<span>${esc(label(selected))}–${esc(label(add(selected,6)))}</span><span>${rows.filter(e=>!e.completed).length} unrecorded · ${rows.filter(e=>e.completed).length} done</span>`;
rail.querySelector('.rail-events').innerHTML=rows.map(e=>`<button type="button" class="rail-event" data-open="${esc(e.target)}"><time>${esc(label(e.date))}</time><span>${esc(e.title)}<small>${esc(e.note||'')}</small></span><span class="rail-status">${e.completed?'✓ Done':e.date<t?'Date passed':'↗'}</span></button>`).join('')||'<p class="rail-empty">No published deadlines in this week. Check D2L for updates.</p>';
}
rail.addEventListener('click',e=>{const w=e.target.closest('[data-week]');if(w){selected=w.dataset.week;const scroll=rail.querySelector('.rail-track').scrollLeft;render();rail.querySelector('.rail-track').scrollLeft=scroll;rail.querySelector(`[data-week="${selected}"]`).focus({preventScroll:true});}const b=e.target.closest('[data-open]');if(b)document.dispatchEvent(new CustomEvent('course-open-item',{detail:b.dataset.open}));});
window.CourseVisuals={open,close,update(rows){events=rows.slice().sort((a,b)=>a.date.localeCompare(b.date));render();if(!rail.dataset.initialized){rail.dataset.initialized='true';const selectedButton=rail.querySelector('[aria-pressed="true"]'),track=rail.querySelector('.rail-track');if(selectedButton)track.scrollLeft=selectedButton.offsetLeft-track.offsetLeft-track.clientWidth/2+selectedButton.clientWidth/2;}}};
document.dispatchEvent(new Event('course-visuals-ready'));
const course=document.body.dataset.course;
if(course==='mth140'||course==='mth141'){
const bench=document.createElement('section');bench.className='math-workbench';bench.setAttribute('aria-label','Interactive math workbench');const calculus=course==='mth140';
bench.innerHTML=`<div class="workbench-title"><div><span class="workbench-kicker">${calculus?'01 / Calculus lab':'02 / Vector lab'}</span><h2>${calculus?'Explore a tangent':'Build a linear combination'}</h2></div><span class="workbench-live">Interactive</span></div><div class="workbench-layout"><div class="workbench-plot"><svg class="workbench-svg" viewBox="0 0 400 300" role="img" aria-label="Interactive math plot"></svg><div class="workbench-legend"><span>${calculus?'Curve y = x²':'Basis vectors u and v'}</span><span>${calculus?'Tangent at the point':'Result w'}</span></div></div><div class="workbench-controls"><p class="workbench-equation">${calculus?'y = x²':'w = a·u + b·v'}</p><p>${calculus?'Move the point. See how the tangent changes as you travel along the curve.':'Combine two independent vectors. The dashed path shows how each contribution builds the result.'}</p>${calculus?'':'<p class="workbench-basis">u = (2, 1) &nbsp; v = (−1, 2)</p>'}<label>${calculus?'Point position x':'Coefficient a'}<input type="range" min="-2" max="2" step="0.05" value="1" data-control="a"></label>${calculus?'':'<label>Coefficient b<input type="range" min="-2" max="2" step="0.05" value="1" data-control="b"></label>'}<output aria-live="polite"></output><div class="workbench-footer"><span>${calculus?'Drag the point or use the slider.':'Adjust the sliders to explore the plane.'}</span><button type="button" class="workbench-reset">Reset</button></div></div></div>`;
rail.after(bench);
const svg=bench.querySelector('svg'),output=bench.querySelector('output'),a=bench.querySelector('[data-control=a]'),b=bench.querySelector('[data-control=b]');
const f=n=>Number(n).toFixed(2).replace(/\.00$/,'');
const scale=calculus?52:20,originY=calculus?238:150,X=x=>200+x*scale,Y=y=>originY-y*scale;
function draw(){
  const av=+a.value,bv=b?+b.value:0;
  let grid='',ticks='';
  const extent=calculus?3:8;
  for(let n=-extent;n<=extent;n++){
    if(X(n)>=20&&X(n)<=380)grid+=`M${X(n)} 20V280`;
    if(Y(n)>=20&&Y(n)<=280)grid+=`M20 ${Y(n)}H380`;
    if(n!==0&&(calculus||n%2===0)){
      if(X(n)>25&&X(n)<375)ticks+=`<text x="${X(n)}" y="${originY+17}" text-anchor="middle">${n}</text>`;
      if(Y(n)>28&&Y(n)<270)ticks+=`<text x="190" y="${Y(n)+4}" text-anchor="end">${n}</text>`;
    }
  }
  let picture=`<defs><clipPath id="workbench-clip"><rect x="20" y="20" width="360" height="260" rx="4"/></clipPath><marker id="vector-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10Z" fill="context-stroke"/></marker></defs><path class="grid" d="${grid}"/><path class="axis" d="M20 ${originY}H380M200 20V280"/><g class="plot-labels">${ticks}<text x="382" y="${originY-8}">x</text><text x="209" y="19">y</text><text x="188" y="${originY+17}">0</text></g><g clip-path="url(#workbench-clip)">`;
  if(calculus){
    const points=Array.from({length:121},(_,i)=>{const x=-3.5+i*7/120;return `${X(x)},${Y(x*x)}`}).join(' ');
    picture+=`<polyline class="curve" points="${points}"/><path class="tangent" d="M${X(-3.5)} ${Y(2*av*(-3.5)-av*av)}L${X(3.5)} ${Y(2*av*3.5-av*av)}"/><circle class="point-halo" cx="${X(av)}" cy="${Y(av*av)}" r="13"/><circle data-point="true" cx="${X(av)}" cy="${Y(av*av)}" r="7"/>`;
    output.textContent=`x = ${f(av)} · y = ${f(av*av)} · slope = ${f(2*av)}`;
  }else{
    const ux=2*av,uy=av,wx=ux-bv,wy=uy+2*bv;
    picture+=`<path class="curve basis-vector" marker-end="url(#vector-arrow)" d="M200 150L${X(2)} ${Y(1)}"/><path class="curve basis-vector" marker-end="url(#vector-arrow)" d="M200 150L${X(-1)} ${Y(2)}"/><path class="vector-path" d="M200 150L${X(ux)} ${Y(uy)}L${X(wx)} ${Y(wy)}"/><path class="tangent" marker-end="url(#vector-arrow)" d="M200 150L${X(wx)} ${Y(wy)}"/><circle class="point-halo" cx="${X(wx)}" cy="${Y(wy)}" r="11"/><circle cx="${X(wx)}" cy="${Y(wy)}" r="4"/>`;
    output.textContent=`w = ${f(av)}u ${bv<0?'−':'+'} ${f(Math.abs(bv))}v = (${f(wx)}, ${f(wy)})`;
  }
  svg.innerHTML=picture+'</g>';svg.setAttribute('aria-label',output.textContent);
}
a.addEventListener('input',draw);b?.addEventListener('input',draw);
bench.querySelector('.workbench-reset').addEventListener('click',()=>{a.value='1';if(b)b.value='1';draw()});
let dragging=false;
svg.addEventListener('pointerdown',e=>{if(!calculus||!e.target.matches('[data-point],.point-halo'))return;dragging=true;svg.setPointerCapture(e.pointerId)});
svg.addEventListener('pointermove',e=>{if(!dragging)return;const matrix=svg.getScreenCTM();if(!matrix)return;const point=new DOMPoint(e.clientX,e.clientY).matrixTransform(matrix.inverse());a.value=Math.max(-2,Math.min(2,(point.x-200)/scale));draw()});
svg.addEventListener('pointerup',()=>dragging=false);svg.addEventListener('pointercancel',()=>dragging=false);draw();
}
})();
