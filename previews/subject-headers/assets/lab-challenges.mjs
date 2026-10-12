import { challengeSets, evaluateChoice } from './lab-challenge-data.mjs';

const escape = text => String(text).replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
let instanceCount = 0;

function figure(challenge, uid) {
  if (challenge.numberCheck) return `<div class="challenge-number-check" role="img" aria-label="${escape(challenge.numberCheck.join(' '))}">${challenge.numberCheck.map((line, i) => `<span${i === 2 ? ' class="challenge-number-result"' : ''}>${escape(line)}</span>`).join('')}</div>`;
  const w = 440, h = 300;
  const range = {shift:[-2, 5, -1, 8], secant:[-1, 4, -1, 11], hole:[-1, 3, -1, 5], complex:[-2.3, 2.3, -1.1, 1.93], determinant:[-1, 4, -1, 8], vectors:[-1, 6, -1.5, 3.5]}[challenge.visual];
  const [xmin,xmax,ymin,ymax] = range;
  const X = x => 30 + (x - xmin) / (xmax - xmin) * (w - 60);
  const Y = y => h - 26 - (y - ymin) / (ymax - ymin) * (h - 50);
  const points = values => values.map(([x,y]) => `${X(x).toFixed(2)},${Y(y).toFixed(2)}`).join(' ');
  const line = (x1,y1,x2,y2,cls, extra='') => `<line x1="${X(x1)}" y1="${Y(y1)}" x2="${X(x2)}" y2="${Y(y2)}" class="${cls}" ${extra}/>`;
  const dot = (x,y,cls) => `<circle cx="${X(x)}" cy="${Y(y)}" r="5" class="${cls}"/>`;
  const label = (x,y,text,dx=9,dy=-9) => `<text x="${X(x)+dx}" y="${Y(y)+dy}">${escape(text)}</text>`;
  const arrow = (x1,y1,x2,y2,cls) => line(x1,y1,x2,y2,cls,`marker-end="url(#${uid}-${cls})"`);
  const curve = (fn,cls) => `<polyline points="${points(Array.from({length:160},(_,i)=>{const x=xmin+(xmax-xmin)*i/159;return [x,fn(x)];}))}" class="${cls}"/>`;
  let grid='';
  for(let x=Math.ceil(xmin);x<=xmax;x++)grid+=line(x,ymin,x,ymax,'challenge-grid');
  for(let y=Math.ceil(ymin);y<=ymax;y++)grid+=line(xmin,y,xmax,y,'challenge-grid');
  grid+=line(xmin,0,xmax,0,'challenge-axis')+line(0,ymin,0,ymax,'challenge-axis');
  let drawing='', annotations='';
  if(challenge.visual==='shift'){
    drawing=curve(x=>x*x,'challenge-original')+curve(x=>(x-2)**2,'challenge-result')+dot(0,0,'challenge-dot-original')+dot(2,0,'challenge-dot-result');
    annotations=label(0,0,'(0, 0)',-12,22)+label(2,0,'(2, 0)',-12,22);
  } else if(challenge.visual==='secant'){
    drawing=curve(x=>x*x,'challenge-original')+curve(x=>4*x-3,'challenge-result')+line(1,1,3,1,'challenge-guide')+line(3,1,3,9,'challenge-guide')+dot(1,1,'challenge-dot-result')+dot(3,9,'challenge-dot-result');
    annotations=label(1,1,'(1, 1)',-35,-12)+label(3,9,'(3, 9)')+label(2,1,'run 2',-16,20)+label(3,5,'rise 8');
  } else if(challenge.visual==='hole'){
    drawing=curve(x=>x+1,'challenge-original')+dot(1,2,'challenge-hole')+dot(1,3,'challenge-dot-result');
    annotations=label(1,2,'(1, 2)',12,16)+label(1,3,'(1, 3)');
  } else if(challenge.visual==='complex'){
    drawing=arrow(0,0,1,1,'challenge-original')+arrow(0,0,-1,1,'challenge-result')+dot(1,1,'challenge-dot-original')+dot(-1,1,'challenge-dot-result');
    annotations=label(1,1,'1 + i')+label(-1,1,'−1 + i',-52,-12)+label(0,0,'0',8,18)+`<text x="${w-50}" y="${Y(0)+21}">Re</text><text x="${X(0)+10}" y="32">Im</text>`;
  } else if(challenge.visual==='determinant'){
    drawing=`<polygon points="${points([[0,0],[1,0],[1,1],[0,1]])}" class="challenge-square-original"/><polygon points="${points([[0,0],[1,3],[3,7],[2,4]])}" class="challenge-square-result"/>`+arrow(0,0,1,3,'challenge-original')+arrow(0,0,2,4,'challenge-result');
    annotations=label(1,3,'(1, 3)',-51,0)+label(2,4,'(2, 4)')+label(3,7,'(3, 7)');
  } else if(challenge.visual==='vectors'){
    drawing=arrow(0,0,4,2,'challenge-original')+arrow(4,2,5,0,'challenge-result')+arrow(0,0,5,0,'challenge-result');
    annotations=label(4,2,'(4, 2)',-28,-12)+label(5,0,'(5, 0)',-10,24)+label(0,0,'0',-8,20);
  }
  return `<svg class="challenge-svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="${escape(challenge.visualCaption)}"><defs><clipPath id="${uid}-clip"><rect x="28" y="20" width="384" height="256"/></clipPath>${['challenge-original','challenge-result'].map(cls=>`<marker id="${uid}-${cls}" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" class="${cls}-fill"/></marker>`).join('')}</defs><g clip-path="url(#${uid}-clip)">${grid}${drawing}</g><g class="challenge-labels">${annotations}</g></svg>`;
}

export function mountChallenges(container, course, session = {}) {
  const challenges=challengeSets[course];
  if(!challenges)throw new Error(`No mistake challenges for ${course}`);
  const uid=`mistake-${++instanceCount}`;
  const states=session.states||(session.states=challenges.map(()=>({solved:false,attempt:null})));
  let index=session.index||0;
  container.classList.add('challenge-mount');
  function render(focusTitle=false){
    const c=challenges[index], state=states[index];
    container.innerHTML=`<section class="mistake-challenge" aria-labelledby="${uid}-title"><div class="challenge-heading"><div><span class="challenge-kicker">Find the mistake · ${escape(c.topic)}</span><h3 id="${uid}-title" tabindex="-1">${escape(c.title)}</h3></div><span class="challenge-count">${index+1} / ${challenges.length}</span></div><p class="challenge-prompt">${escape(c.prompt)}</p><p class="challenge-instruction">Tap the <strong>first incorrect line</strong> in this solution.</p><div class="challenge-stage"><ol class="challenge-lines">${c.lines.map((line,i)=>`<li><button type="button" data-challenge-line="${i}" ${state.solved?'disabled':''} class="${state.solved&&i===c.error?'is-found':''}${!state.solved&&state.attempt===i?' is-tried':''}" aria-label="Line ${i+1}: ${escape(line)}"><span class="challenge-line-number" aria-hidden="true">${String(i+1).padStart(2,'0')}</span><span>${escape(line)}</span>${state.solved&&i===c.error?'<span class="challenge-found-label">First error</span>':''}</button></li>`).join('')}</ol><aside class="challenge-insight ${state.solved?'is-revealed':''}" aria-label="Explanation"><div class="challenge-feedback" role="status" aria-live="polite" aria-atomic="true">${state.solved?`<span class="challenge-feedback-label">Found it · Line ${c.error+1}</span><div class="challenge-correction">${escape(c.correction)}</div><p>${escape(c.explanation)}</p>`:state.attempt!==null?`<span class="challenge-feedback-label">Take another look</span><p>${evaluateChoice(c,state.attempt)==='valid-step'?'That line is valid. Continue from there and find where the reasoning first breaks.':'There is an incorrect step earlier in the solution. Find that first error.'}</p>`:'<span class="challenge-feedback-label">Read it like a reviewer</span><p>Check one line at a time. The visual explanation appears when you find the first error.</p>'}</div>${state.solved?`<figure><figcaption>${escape(c.visualTitle)}</figcaption>${figure(c,uid)}${c.legend?`<div class="challenge-legend">${c.legend.map(label=>`<span>${escape(label)}</span>`).join('')}</div>`:''}<p class="challenge-visual-caption">${escape(c.visualCaption)}</p></figure>`:'<div class="challenge-review-symbol" aria-hidden="true"><span>01</span><i></i><span>02</span><i></i><span>?</span></div>'}</aside></div><nav class="challenge-navigation" aria-label="Mistake challenges"><button type="button" data-challenge-nav="-1" ${index===0?'disabled':''}>← Previous</button><span>No timer. Work at your pace.</span><button type="button" data-challenge-nav="1">${index===challenges.length-1?'Back to first ↺':'Next challenge →'}</button></nav></section>`;
    if(focusTitle)container.querySelector('h3').focus({preventScroll:true});
  }
  function onClick(event){
    const choice=event.target.closest('[data-challenge-line]');
    if(choice&&container.contains(choice)){
      const line=Number(choice.dataset.challengeLine), state=states[index];
      if(state.solved)return;
      state.attempt=line;
      state.solved=evaluateChoice(challenges[index],line)==='correct';
      // Keep the selected button in place so keyboard focus and live announcements survive.
      if(state.solved){
        const c=challenges[index];
        container.querySelectorAll('[data-challenge-line]').forEach(button=>{
          button.setAttribute('aria-disabled','true');
          button.classList.remove('is-tried');
          if(Number(button.dataset.challengeLine)===line){button.classList.add('is-found');button.insertAdjacentHTML('beforeend','<span class="challenge-found-label">First error</span>');}
        });
        const aside=container.querySelector('.challenge-insight');
        aside.classList.add('is-revealed');
        aside.querySelector('.challenge-feedback').innerHTML=`<span class="challenge-feedback-label">Found it · Line ${c.error+1}</span><div class="challenge-correction">${escape(c.correction)}</div><p>${escape(c.explanation)}</p>`;
        aside.querySelector('.challenge-review-symbol')?.remove();
        aside.insertAdjacentHTML('beforeend',`<figure><figcaption>${escape(c.visualTitle)}</figcaption>${figure(c,uid)}${c.legend?`<div class="challenge-legend">${c.legend.map(label=>`<span>${escape(label)}</span>`).join('')}</div>`:''}<p class="challenge-visual-caption">${escape(c.visualCaption)}</p></figure>`);
      }else{
        container.querySelectorAll('[data-challenge-line]').forEach(button=>button.classList.toggle('is-tried',Number(button.dataset.challengeLine)===line));
        const message=evaluateChoice(challenges[index],line)==='valid-step'?'That line is valid. Continue from there and find where the reasoning first breaks.':'There is an incorrect step earlier in the solution. Find that first error.';
        container.querySelector('.challenge-feedback').innerHTML=`<span class="challenge-feedback-label">Take another look</span><p>${message}</p>`;
      }
      return;
    }
    const next=event.target.closest('[data-challenge-nav]');
    if(next&&container.contains(next)){
      index=(index+Number(next.dataset.challengeNav)+challenges.length)%challenges.length;
      session.index=index;
      render(true);
    }
  }
  render();
  container.addEventListener('click',onClick);
  return ()=>{container.removeEventListener('click',onClick);container.classList.remove('challenge-mount');container.replaceChildren();};
}
