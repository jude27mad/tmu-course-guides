import { IDENTITY, OPERATIONS, compose, applyMatrix, matrixDet, compositionAt, sameMatrix, cameraScale } from './lab-composition-math.mjs?v=20261011-studio3';

let instance = 0;
const fmt = value => Number((Math.abs(value) < 1e-8 ? 0 : value).toFixed(2)).toString().replace('-', '−');
const coord = point => `(${point.map(fmt).join(', ')})`;
const matrixHTML = matrix => `<span class="cmp-matrix" role="img" aria-label="Matrix: row one ${fmt(matrix[0])}, ${fmt(matrix[1])}; row two ${fmt(matrix[2])}, ${fmt(matrix[3])}">${matrix.map(v=>`<span aria-hidden="true">${fmt(v)}</span>`).join('')}</span>`;

/** Mount an independent experiment. Cleanup cancels playback and event listeners. */
export function mountComposition(container) {
  const uid = `composition-${++instance}`;
  let first = 'rotate', second = 'stretch', selectedSlot = 0;
  let raf = 0, disposed = false, playing = false;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const host = document.createElement('section');
  host.className = 'cmp-lab';
  host.setAttribute('aria-labelledby', `${uid}-title`);
  host.innerHTML = `
    <div class="cmp-intro"><div><span class="cmp-eyebrow">Build · reverse · compare</span><h3 id="${uid}-title">Same moves. Switch the order.</h3><p>Choose two transformations. Compare what changes when you reverse them.</p></div><span class="cmp-badge">Matrix composition</span></div>
    <div class="cmp-builder">
      <div class="cmp-slots" role="group" aria-label="Choose which transformation to change">
        <button type="button" class="cmp-slot" data-slot="0" aria-pressed="true"><span class="cmp-slot-index">01</span><span><small>First · A</small><strong data-slot-name="0"></strong></span><span class="cmp-edit" aria-hidden="true">⌄</span></button>
        <span class="cmp-flow" aria-hidden="true">→</span>
        <button type="button" class="cmp-slot" data-slot="1" aria-pressed="false"><span class="cmp-slot-index">02</span><span><small>Then · B</small><strong data-slot-name="1"></strong></span><span class="cmp-edit" aria-hidden="true">⌄</span></button>
        <button type="button" class="cmp-reverse" data-action="reverse" aria-label="Reverse the order of the two transformations"><span aria-hidden="true">⇄</span> Reverse order</button>
      </div>
      <div class="cmp-palette" role="group" aria-label="Transformation for first step">
        ${Object.entries(OPERATIONS).map(([key,op])=>`<button type="button" data-operation="${key}" aria-pressed="false"><span class="cmp-op-symbol" aria-hidden="true">${op.symbol}</span><span><strong>${op.label}</strong><small>${op.detail}</small></span></button>`).join('')}
      </div>
    </div>
    <div class="cmp-stage-toolbar"><div class="cmp-step-status" aria-live="polite" aria-atomic="true"></div><div class="cmp-actions"><button type="button" class="cmp-play" data-action="play"><span aria-hidden="true">▶</span> Play steps</button><button type="button" data-action="reset">Reset</button></div></div>
    <div class="cmp-comparison">
      ${['chosen','reversed'].map((side,i)=>`<article class="cmp-card cmp-${side}"><div class="cmp-card-heading"><span class="cmp-card-label">${i?'Reversed order':'Your order'}</span><h4 data-order="${i}"></h4></div><svg class="cmp-svg" viewBox="0 0 440 330" role="img" aria-label="Transformation diagram"><title></title><defs><clipPath id="${uid}-clip-${i}"><rect x="14" y="14" width="412" height="300" rx="12"/></clipPath></defs><g class="cmp-base"></g><g class="cmp-moving" clip-path="url(#${uid}-clip-${i})"></g><g class="cmp-point-label"></g></svg><div class="cmp-card-result"><span class="cmp-point-equation"></span><span class="cmp-area"></span></div><div class="cmp-equation" aria-label="Matrix product"><span class="cmp-product-name">${i?'AB':'BA'}</span><span aria-hidden="true">=</span><span class="cmp-matrix-output"></span></div></article>`).join('')}
    </div>
    <div class="cmp-legend"><span><i class="cmp-legend-original"></i>Original unit square</span><span><i class="cmp-legend-result"></i>Transformed square</span><span><i class="cmp-legend-point"></i>Track the point (1, 1)</span></div>
    <div class="cmp-insight" aria-live="polite" aria-atomic="true"></div>
    <details class="cmp-algebra"><summary>See the matrices</summary><div class="cmp-factor-list"></div><p>Vectors are columns, so the rightmost matrix acts first. A then B is <strong>BA</strong>.</p></details>`;
  container.append(host);
  const cards = [...host.querySelectorAll('.cmp-card')];
  const status = host.querySelector('.cmp-step-status');
  let scale = 42;
  const x = v => 220 + v * scale;
  const y = v => 165 - v * scale;
  const points = ps => ps.map(p => `${x(p[0])},${y(p[1])}`).join(' ');
  const unit = [[0,0],[1,0],[1,1],[0,1]];
  const pathLine = (a,b,cls) => `<line class="${cls}" x1="${x(a[0])}" y1="${y(a[1])}" x2="${x(b[0])}" y2="${y(b[1])}"/>`;

  function stop() { if(raf) cancelAnimationFrame(raf); raf=0;playing=false;host.querySelector('[data-action="play"]').innerHTML='<span aria-hidden="true">▶</span> Play steps'; }
  function basePlot() {
    // Both panels share one fixed camera through playback and after swapping order.
    scale = cameraScale(first, second);
    const extentX = 205/scale, extentY=145/scale;
    let grid = '';
    for(let n=-Math.ceil(extentX);n<=extentX;n++) grid+=pathLine([n,-extentY],[n,extentY],n===0?'cmp-axis':'cmp-grid');
    for(let n=-Math.ceil(extentY);n<=extentY;n++) grid+=pathLine([-extentX,n],[extentX,n],n===0?'cmp-axis':'cmp-grid');
    grid+=`<polygon class="cmp-original" points="${points(unit)}"/><text class="cmp-axis-label" x="${x(1)}" y="${y(0)+15}">1</text><text class="cmp-axis-label" x="${x(0)-12}" y="${y(1)+4}">1</text><text class="cmp-axis-label" x="416" y="${y(0)-8}">x</text><text class="cmp-axis-label" x="${x(0)+9}" y="22">y</text>`;
    for(const card of cards) card.querySelector('.cmp-base').innerHTML=grid;
  }
  function plot(card, m, names, step) {
    const svg = card.querySelector('.cmp-svg');
    const p = applyMatrix(m,[1,1]);
    let grid='';
    for(let n=-5;n<=5;n++) { grid+=pathLine(applyMatrix(m,[n,-5]),applyMatrix(m,[n,5]),'cmp-warp-grid');grid+=pathLine(applyMatrix(m,[-5,n]),applyMatrix(m,[5,n]),'cmp-warp-grid'); }
    const u=applyMatrix(m,[1,0]),v=applyMatrix(m,[0,1]);
    svg.querySelector('.cmp-moving').innerHTML=`${grid}<polygon class="cmp-shape" points="${points(unit.map(q=>applyMatrix(m,q)))}"/>${pathLine([0,0],u,'cmp-basis-one')}${pathLine([0,0],v,'cmp-basis-two')}<circle class="cmp-origin" cx="${x(0)}" cy="${y(0)}" r="3"/><circle class="cmp-end-halo" cx="${x(p[0])}" cy="${y(p[1])}" r="12"/><circle class="cmp-end" cx="${x(p[0])}" cy="${y(p[1])}" r="5.5"/>`;
    const labelX=x(p[0])+(p[0]>2?-12:12), labelY=y(p[1])+(p[1]>2?24:-14);
    svg.querySelector('.cmp-point-label').innerHTML=`<text class="cmp-coordinate" x="${labelX}" y="${labelY}" text-anchor="${p[0]>2?'end':'start'}">${coord(p)}</text>`;
    card.querySelector('.cmp-point-equation').innerHTML=`<span>(1, 1)</span><span aria-hidden="true">→</span><strong>${coord(p)}</strong>`;
    const det=matrixDet(m);
    card.querySelector('.cmp-area').textContent=`det ${fmt(det)} · area ×${fmt(Math.abs(det))}`;
    card.querySelector('.cmp-matrix-output').innerHTML=matrixHTML(m);
    card.querySelector('.cmp-product-name').textContent=step===0?'I':step===1?(card===cards[0]?'A':'B'):(card===cards[0]?'BA':'AB');
    const label=`${OPERATIONS[names[0]].label}, then ${OPERATIONS[names[1]].label}. ${step<2?'Current':'Final'} point ${coord(p)}. Area scale ${fmt(Math.abs(det))}.`;
    svg.setAttribute('aria-label',label);svg.querySelector('title').textContent=label;
  }
  function draw(m1,m2,step=2) {plot(cards[0],m1,[first,second],step);plot(cards[1],m2,[second,first],step);}
  function finalInsight() {
    const a=compose(first,second),b=compose(second,first);
    const equal=sameMatrix(a,b),p=applyMatrix(a,[1,1]),q=applyMatrix(b,[1,1]);
    const det=matrixDet(a);
    const geometry=Math.abs(det)<1e-8?'Area becomes zero: the square collapses onto a line.':det<0?`Both scale area by ${fmt(Math.abs(det))} and reverse orientation.`:`Both scale area by ${fmt(Math.abs(det))} and preserve orientation.`;
    host.querySelector('.cmp-insight').innerHTML=`<span class="cmp-insight-mark" aria-hidden="true">${equal?'=':'≠'}</span><div><strong>${equal?'These two transformations commute.':'Order changes the transformation.'}</strong><p>${equal?'Both orders produce the same matrix.':`Your order sends (1, 1) to <b>${coord(p)}</b>; reversing it gives <b>${coord(q)}</b>.`} ${geometry}</p></div>`;
  }
  function statusText(step) {
    status.innerHTML=`<span class="cmp-step-dot${step===2?' cmp-complete':''}" aria-hidden="true"></span><span>${step===0?'Start with the unit square':step===1?'Step 1 of 2 · first transformation':'Two orders. Compare the result.'}</span>`;
  }
  function updatePalette() {
    host.querySelectorAll('[data-slot]').forEach(btn=>btn.setAttribute('aria-pressed',Number(btn.dataset.slot)===selectedSlot));
    host.querySelector('.cmp-palette').setAttribute('aria-label',`Transformation for ${selectedSlot===0?'first':'second'} step`);
    host.querySelectorAll('[data-operation]').forEach(btn=>btn.setAttribute('aria-pressed',btn.dataset.operation===(selectedSlot===0?first:second)));
  }
  function configure() {
    stop();basePlot();updatePalette();
    host.querySelector('[data-slot-name="0"]').textContent=OPERATIONS[first].label;
    host.querySelector('[data-slot-name="1"]').textContent=OPERATIONS[second].label;
    host.querySelector('[data-order="0"]').innerHTML=`${OPERATIONS[first].short}<span aria-hidden="true"> → </span>${OPERATIONS[second].short}`;
    host.querySelector('[data-order="1"]').innerHTML=`${OPERATIONS[second].short}<span aria-hidden="true"> → </span>${OPERATIONS[first].short}`;
    host.querySelector('.cmp-factor-list').innerHTML=`<div><span><b>A</b> · ${OPERATIONS[first].label}</span>${matrixHTML(OPERATIONS[first].matrix)}</div><div><span><b>B</b> · ${OPERATIONS[second].label}</span>${matrixHTML(OPERATIONS[second].matrix)}</div><div><span><b>BA</b> · Your order</span>${matrixHTML(compose(first,second))}</div><div><span><b>AB</b> · Reversed</span>${matrixHTML(compose(second,first))}</div>`;
    draw(compose(first,second),compose(second,first));statusText(2);finalInsight();
  }
  function play() {
    if(playing){configure();return;}
    if(reduceMotion.matches){configure();status.innerHTML='<span class="cmp-step-dot cmp-complete" aria-hidden="true"></span><span>Final result · reduced motion</span>';return;}
    stop();playing=true;host.querySelector('[data-action="play"]').innerHTML='<span aria-hidden="true">■</span> Finish';
    host.querySelector('.cmp-insight').innerHTML='<span class="cmp-insight-mark" aria-hidden="true">↗</span><div><strong>Follow the pink point.</strong><p>Each panel applies its first move, then its second. Both start from the same unit square.</p></div>';
    let start=null,lastPhase=-1;
    const tick=now=>{
      if(disposed||!playing)return;
      if(start===null)start=now;
      const elapsed=now-start;
      let step,t;
      if(elapsed<240){step=0;t=0;}else if(elapsed<1140){step=1;t=(elapsed-240)/900;}else if(elapsed<1500){step=1;t=1;}else{step=2;t=Math.min(1,(elapsed-1500)/900);}
      if(step!==lastPhase){lastPhase=step;statusText(step);if(step===2)status.innerHTML='<span class="cmp-step-dot" aria-hidden="true"></span><span>Step 2 of 2 · second transformation</span>';}
      const eased=t*t*(3-2*t);
      draw(step===0?IDENTITY:compositionAt(first,second,step,eased),step===0?IDENTITY:compositionAt(second,first,step,eased),step);
      if(elapsed>=2400){stop();draw(compose(first,second),compose(second,first));statusText(2);finalInsight();}else raf=requestAnimationFrame(tick);
    };
    raf=requestAnimationFrame(tick);
  }
  function onClick(event) {
    const btn=event.target.closest('button');if(!btn||!host.contains(btn))return;
    if(btn.dataset.slot!==undefined){selectedSlot=Number(btn.dataset.slot);updatePalette();return;}
    if(btn.dataset.operation){if(selectedSlot===0)first=btn.dataset.operation;else second=btn.dataset.operation;configure();return;}
    if(btn.dataset.action==='reverse'){[first,second]=[second,first];configure();}
    if(btn.dataset.action==='reset'){first='rotate';second='stretch';selectedSlot=0;configure();}
    if(btn.dataset.action==='play')play();
  }
  function motionChange(){if(reduceMotion.matches&&playing)configure();}
  host.addEventListener('click',onClick);
  reduceMotion.addEventListener('change',motionChange);
  configure();
  return function cleanup(){disposed=true;stop();host.removeEventListener('click',onClick);reduceMotion.removeEventListener('change',motionChange);host.remove();};
}
