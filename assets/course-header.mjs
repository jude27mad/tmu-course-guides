import { calculusProject as CP, algebraProject as AP, secantState, shearState, path, point } from './header-geometry.mjs';

const NS = 'http://www.w3.org/2000/svg';
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const precisePointer = matchMedia('(hover: hover) and (pointer: fine)');
const forcedStill = new URLSearchParams(location.search).get('motion') === 'off';
if (forcedStill) document.documentElement.dataset.motion = 'off';
const still = () => forcedStill || reduced.matches;
const svg = content => `<svg viewBox="0 0 460 270" aria-hidden="true" focusable="false">${content}</svg>`;
const polygon = (points, cls, extra = '') => `<polygon class="${cls}" points="${points.map(point).join(' ')}" ${extra}/>`;
const line = (points, cls, extra = '') => `<path class="${cls}" d="${path(points)}" ${extra}/>`;
const circle = (p, r, cls, extra = '') => `<circle class="${cls}" cx="${p[0]}" cy="${p[1]}" r="${r}" ${extra}/>`;
const label = (p, text, cls = 'art-engraving') => `<text class="${cls}" x="${p[0]}" y="${p[1]}">${text}</text>`;
const defs = `<defs>
 <linearGradient id="art-surface" x1="0" y1="0" x2=".9" y2="1"><stop class="surface-light"/><stop offset="1" class="surface-shade"/></linearGradient>
 <linearGradient id="art-edge" x1="0" y1="0" x2="0" y2="1"><stop class="edge-light"/><stop offset="1" class="edge-shade"/></linearGradient>
 <linearGradient id="art-chip" x1="0" y1="0" x2="1" y2="1"><stop class="chip-light"/><stop offset=".5" class="chip-dark"/><stop offset="1" class="chip-light"/></linearGradient>
 <linearGradient id="art-fill" x1="0" y1="0" x2="1" y2="1"><stop class="field-light"/><stop offset="1" class="field-shade"/></linearGradient>
 <linearGradient id="art-shine"><stop stop-color="white" stop-opacity="0"/><stop offset=".5" stop-color="white" stop-opacity=".65"/><stop offset="1" stop-color="white" stop-opacity="0"/></linearGradient>
 <filter id="art-shadow" x="-30%" y="-80%" width="160%" height="260%"><feGaussianBlur stdDeviation="9"/></filter>
</defs>`;
function plate(project, bounds) {
  const [x0, y0, x1, y1] = bounds;
  const top = [[x0,y0],[x1,y0],[x1,y1],[x0,y1]].map(p => project(...p));
  const base = top.map(([x,y]) => [x,y+8]);
  return `<g class="art-floor">${polygon(top.map(([x,y])=>[x,y+20]), 'art-shadow', 'filter="url(#art-shadow)"')}${polygon([...base], 'art-edge')}${polygon([top[0],top[1],base[1],base[0]],'art-front-edge')}${polygon(top,'art-surface')}${line([top[3],top[2],top[1]],'art-rim')}</g>`;
}
function grid(project, bounds, step) {
  const [x0,y0,x1,y1] = bounds; let s = '';
  for(let x=Math.ceil(x0/step)*step;x<=x1;x+=step) s+=line([project(x,y0),project(x,y1)],'art-grid');
  for(let y=Math.ceil(y0/step)*step;y<=y1;y+=step) s+=line([project(x0,y),project(x1,y)],'art-grid');
  return s;
}
function arrow(a, b, cls, id='') {
  return line([a,b],cls,id ? `data-art="${id}"` : '') + arrowTip(a,b,cls,id);
}
function arrowTip(a,b,cls,id='') {
  const dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy),ux=dx/len,uy=dy/len;
  const pts=[[b[0]-ux*8-uy*3.5,b[1]-uy*8+ux*3.5],b,[b[0]-ux*8+uy*3.5,b[1]-uy*8-ux*3.5]];
  return line(pts,cls,id ? `data-art="${id}-tip"` : '');
}
function circuitArt() {
  const P=(x,y,z=0)=>[230+63*x+32*y,147+18*x-29*y-z];
  const routes=[
    [[-2,-.9],[-1.3,-.9],[-.95,-.55],[-.55,-.55]],
    [[-2,-.25],[-1.2,-.25],[-.9,.05],[-.55,.05]],
    [[-1.8,1.3],[-1.8,.85],[-1.2,.25],[-.55,.25]],
    [[-.85,1.45],[-.85,.95],[-.3,.4]],
    [[.5,1.45],[.5,1.05],[.25,.8],[.25,.4]],
    [[2,1.05],[1.45,1.05],[1.05,.65],[.55,.65],[.35,.4]],
    [[2,.3],[1.4,.3],[1.1,0],[.55,0]],
    [[2,-.65],[1.45,-.65],[1.1,-.3],[.55,-.3]],
    [[1.2,-1.45],[1.2,-.95],[.7,-.45],[.55,-.45]],
    [[-.05,-1.45],[-.05,-.45]],
    [[-1,-1.45],[-1,-1.05],[-.55,-.6]]
  ];
  function component(x,y,w,h,z,main=false){
    const top=[[x-w,y-h],[x+w,y-h],[x+w,y+h],[x-w,y+h]].map(p=>P(...p,z));
    const base=[[x-w,y-h],[x+w,y-h],[x+w,y+h],[x-w,y+h]].map(p=>P(...p,3));
    let pins='';
    if(main) for(let i=-3;i<=3;i++) for(const side of [-1,1]) {
      pins+=line([P(side*.57,i*.12,3),P(side*.75,i*.12,3)],'art-chip-pin');
      pins+=line([P(i*.14,side*.46,3),P(i*.14,side*.66,3)],'art-chip-pin');
    }
    return `<g class="${main?'art-core':'art-component'}">${pins}${polygon([top[0],top[1],base[1],base[0]],'art-chip-side')}${polygon([top[1],top[2],base[2],base[1]],'art-chip-side side-light')}${polygon(top,main?'art-chip':'art-cap')}${line([top[3],top[2],top[1]],'art-chip-rim')}${main?polygon([[-.32,-.26],[.32,-.26],[.32,.26],[-.32,.26]].map(p=>P(...p,z+.5)),'art-core-window')+label(P(-.23,-.05,z+1),'CEN','art-chip-label'):''}</g>`;
  }
  let paths='', pulses='', nodes='';
  routes.forEach((r,i)=>{const pts=r.map(p=>P(...p,1));paths+=line(pts,'art-trace');pulses+=line(pts,'art-pulse',`pathLength="100" style="--route:${i}"`);nodes+=circle(pts[0],2.6,'art-node');});
  return svg(defs+plate(P,[-2.18,-1.55,2.18,1.55])+`<g class="art-traces">${paths}${nodes}</g><g class="art-pulses">${pulses}</g>`+
    component(-1.36,.7,.27,.13,7)+component(1.3,-.85,.27,.12,7)+component(1.35,.85,.15,.13,9)+
    component(0,0,.55,.45,27,true)+
    label(P(-1.72,-1.22,1),'01 / ENGINEERING')+circle(P(1.83,1.23,1),4,'art-status-ring')+circle(P(1.83,1.23,1),1.7,'art-status-dot'));
}
function calculusArt() {
  const bounds=[-1.95,-.55,2.04,4.05];
  const curve=Array.from({length:85},(_,i)=>{const x=-1.7+3.5*i/84;return CP(x,x*x,2);});
  const state=secantState(1),p=CP(1,1,2);
  return svg(defs+plate(CP,bounds)+grid(CP,[-1.8,-.4,1.88,3.85],.5)+
    arrow(CP(-1.8,0,1),CP(1.92,0,1),'art-axis')+arrow(CP(0,-.35,1),CP(0,3.8,1),'art-axis')+
    line(curve,'art-curve')+
    line(state.line.map(p=>CP(...p,2)),'art-secant','data-art="secant"')+
    line([CP(1,0,2),p,CP(0,1,2)],'art-guide')+
    circle(p,10,'art-halo')+circle(p,4.4,'art-dot')+
    circle(p,3.7,'art-moving-dot','data-art="moving-point"')+
    label(CP(-1.7,3.33,3),'y = x²','art-equation')+label(CP(1.97,0,2),'x')+label(CP(0,3.87,2),'y')+
    `<g class="art-readout">${label([236,254],'f′(1) = 2','art-result')}</g>`);
}
function algebraArt() {
  const bounds=[-.67,-.35,2.55,1.96],s=shearState(1),o=AP(0,0,2);
  return svg(defs+plate(AP,bounds)+grid(AP,[-.53,-.21,2.42,1.81],.25)+
    arrow(AP(-.45,0,1),AP(2.36,0,1),'art-axis')+arrow(AP(0,-.2,1),AP(0,1.76,1),'art-axis')+
    polygon(shearState(0).square.map(p=>AP(...p,2)),'art-original')+
    polygon(s.square.map(p=>AP(...p,3)),'art-area','data-art="square"')+
    arrow(o,AP(...s.u,4),'art-vector-u','basis-u')+arrow(o,AP(...s.v,4),'art-vector-v','basis-v')+
    circle(o,3.7,'art-origin')+circle(AP(...s.v,4),4,'art-vector-point','data-art="vector-point"')+
    label(AP(.65,1.2,5),'v','art-vector-label')+label(AP(1.1,-.12,5),'u','art-vector-label')+
    label(AP(1.32,1.56,3),'A · v','art-equation')+
    `<g class="art-readout">${label([236,254],'det A = 1','art-result')}</g>`);
}

async function mount() {
 const header=document.querySelector('.course-heading,.circuit-head');
 if(!header||!document.body.classList.contains('workspace')||header.classList.contains('header-upgraded'))return;
 const course=document.body.dataset.course,art=document.createElement('div');art.className='header-art';
 const description=course==='cen100'?'Circuit board with signals following the next deadline.':course==='mth140'?'The curve y equals x squared, with a secant approaching its tangent.':'A unit square shears and rotates while its area stays one.';
 art.setAttribute('role','img');art.setAttribute('aria-label',description);
 art.innerHTML=`<div class="art-aura"></div><div class="art-perspective"><div class="art-object">${course==='cen100'?circuitArt():course==='mth140'?calculusArt():algebraArt()}</div></div>`;
 header.append(art);header.classList.add('header-upgraded');
 const meta=document.createElement('div');meta.className='scene-meta';
 meta.innerHTML=`<span>${course==='cen100'?'ENGINEERING / LIVE CIRCUIT':course==='mth140'?'y = x² · SECANT → TANGENT':'SHEAR · ROTATE · AREA = 1'}</span><button class="scene-pause" type="button" aria-label="Pause animation" aria-pressed="false" title="Pause animation"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7 5v10M13 5v10"/></svg></button>`;
 header.append(meta);
 const {motionAllowed,setPaused,preference}=await import('./guide-motion.mjs');
 const button=meta.querySelector('button');
 function sync(){const on=motionAllowed();button.setAttribute('aria-pressed',String(!on));button.setAttribute('aria-label',on?'Pause animation':'Resume animation');button.title=on?'Pause animation':preference().reduced?'Motion follows your device setting':'Resume animation';button.disabled=preference().reduced||preference().forced;button.innerHTML=on?'<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7 5v10M13 5v10"/></svg>':'<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m7 4 8 6-8 6z"/></svg>';art.dataset.motionState=on?'ready':'still';}
 button.addEventListener('click',()=>setPaused(!preference().paused));document.addEventListener('guide-motion-change',sync);sync();
 // The first useful guide render never waits for the GPU bundle or shader compilation.
 const load=()=>import('./course-scene.mjs').then(m=>m.mountScene(art,course)).catch(()=>{art.dataset.renderer='unavailable';});
 if(!forcedStill){if('requestIdleCallback'in window)requestIdleCallback(load,{timeout:1600});else setTimeout(load,150);}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
