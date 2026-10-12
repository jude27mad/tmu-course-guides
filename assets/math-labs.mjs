import {transformed,multiply,intersection,secant,limitValue,limitFacts} from './lab-math.mjs';
import {mountComposition} from './lab-composition.mjs?v=20261011-studio3';
import {mountChallenges} from './lab-challenges.mjs';
let activeCleanup=null;
export function unmount(){const cleanup=activeCleanup;activeCleanup=null;cleanup?.();}
export function mount(ctx={}){
unmount();
const root=ctx.root||((ctx.direct!==false)?document.querySelector('main'):null);
const course=ctx.route||((ctx.direct!==false)?document.body.dataset.course:null);
if(!root||!['mth140','mth141'].includes(course)||ctx.signal?.aborted)return;
const controller=new AbortController(),signal=controller.signal;
let disposed=false,topicObserver=null;
const topicButtons=new Set();
function listen(target,type,handler){target.addEventListener(type,handler,{signal});}
function cleanup(){
  if(disposed)return;disposed=true;
  ctx.signal?.removeEventListener('abort',onAbort);controller.abort();
  topicObserver?.disconnect();topicObserver=null;
  window.GuideMotion?.cancel(modal);
  dispose();
  if(modal.open)modal.close();
  placeholder?.replaceWith(host);placeholder=null;expanded=false;focusBefore=null;
  document.body.classList.remove('lab-open');
  for(const button of topicButtons)button.remove();topicButtons.clear();
  host.remove();modal.remove();
}
function onAbort(){if(activeCleanup===cleanup)activeCleanup=null;cleanup();}

const $=(s,parent=root)=>parent.querySelector(s),fmt=n=>Math.abs(n)<1e-9?'0':Number(n.toFixed(3)).toString(),signed=n=>n<0?'− '+fmt(-n):'+ '+fmt(n),complex=(x,y)=>`${fmt(x)} ${signed(y)}i`;
const defs={
 transforms:{name:'Transformations',title:'Shape the function',equation:'y = a·f(x − h) + k',description:'Tap part of the equation. See exactly what it changes.',defaults:{base:'square',a:1,h:0,k:0},controls:[['a','Vertical scale a',-3,3,.1],['h','Horizontal shift h',-3,3,.1],['k','Vertical shift k',-3,3,.1]],select:['base','Parent function',[['square','Quadratic · x²'],['absolute','Absolute value · |x|'],['sqrt','Square root · √x'],['sine','Sine · sin x']]],presets:[['Shift right',{h:2}],['Reflect',{a:-1}],['Stretch',{a:2}],['Start over',{a:1,h:0,k:0}]],legend:['Original function','Transformed function']},
 limits:{name:'Limits',title:'Approach the missing point',equation:'x → 1',description:'Move closer from both sides. Does the approaching height match the value at the point?',defaults:{kind:'hole',gap:.5},controls:[['gap','Distance from 1',.001,1,.001]],select:['kind','Example',[['hole','Removable discontinuity'],['smooth','Continuous curve'],['jump','Jump discontinuity'],['pole','Vertical asymptote']]],presets:[['Move closer',{gap:.01}],['Show a jump',{kind:'jump',gap:.1}],['Show an asymptote',{kind:'pole',gap:.1}]],legend:['Function','Approaching points']},
 derivative:{name:'Secant → tangent',title:'Build a derivative',equation:'f(x) = x²',description:'Bring two points together and watch their slope approach the tangent slope.',defaults:{x:1,h:1},controls:[['x','Point P position',-2,2,.05],['h','Separation h',-2,2,.01]],presets:[['Bring points close',{h:.05}],['Approach from left',{h:-.05}],['Show the limit',{h:0}]],legend:['Curve and tangent','Secant PQ']},
 complex:{name:'Complex numbers',title:'Rotate and scale a number',equation:'w = z × m',description:'Choose a multiplier. Watch a number rotate or change its distance from the origin.',defaults:{x:1,y:1,u:1,v:0},controls:[['x','Real part of z',-3,3,.1],['y','Imaginary part of z',-3,3,.1],['u','Real part of multiplier',-2,2,.1],['v','Imaginary part of multiplier',-2,2,.1]],presets:[['Multiply by i',{u:0,v:1}],['Double',{u:2,v:0}],['Half turn',{u:-1,v:0}],['Identity',{u:1,v:0}]],legend:['Input z','Product w']},
 matrix:{name:'Matrix composition',defaults:{}},
 systems:{name:'Linear systems',title:'Find where two lines meet',equation:'y = m₁x + b₁; y = m₂x + b₂',description:'Compare intersecting, parallel and identical lines. Each picture tells you how many solutions exist.',defaults:{m1:1,b1:0,m2:-1,b2:2},controls:[['m1','First line slope',-3,3,.1],['b1','First line intercept',-3,3,.1],['m2','Second line slope',-3,3,.1],['b2','Second line intercept',-3,3,.1]],presets:[['One solution',{m1:1,b1:0,m2:-1,b2:2}],['Parallel',{m1:1,b1:0,m2:1,b2:2}],['Same line',{m1:1,b1:0,m2:1,b2:0}]],legend:['First equation','Second equation']},
 vectors:{name:'Vectors',title:'Build a linear combination',equation:'w = a·u + b·v',description:'Add or subtract two vectors. Follow their head-to-tail route to the result.',defaults:{a:1,b:1},controls:[['a','Coefficient a',-2,2,.05],['b','Coefficient b',-2,2,.05]],presets:[['Only u',{a:1,b:0}],['Only v',{a:0,b:1}],['Subtract v',{a:1,b:-1}]],legend:['Basis vectors','Result w']}
};
const ids=course==='mth140'?['transforms','limits','derivative']:['complex','matrix','systems','vectors'];
let id=ids[0],s=null,zoom=1,raf=0,dragging=null,expanded=false,placeholder=null,focusBefore=null;
let mode='explore',disposePanel=null,eqTerm='h',animationTarget=null;
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
listen(document,'guide-motion-change',()=>{if(window.GuideMotion?.motionAllowed()===false&&animationTarget){stopAnimation();sync();draw();}});
const memories={},challengeSession={};
const host=document.createElement('section');host.id='math-lab';host.className='math-workbench math-lab';host.setAttribute('aria-label','Interactive math lab');
const rail=$('.semester-rail');(rail||$('.quick-find')).after(host);
host.innerHTML=`<div class="workbench-title"><div><span class="workbench-kicker">${course==='mth140'?'Calculus':'Linear algebra'} / visual studio</span><h2>Math, made visible.</h2><p class="lab-subtitle">Explore an idea. Make a connection.</p></div><button class="lab-expand" type="button" aria-label="Expand math studio">Expand ↗</button></div><div class="lab-mode-switch" role="group" aria-label="Studio mode"><button type="button" data-mode="explore" aria-pressed="true">Explore concepts</button><button type="button" data-mode="mistakes" aria-pressed="false">Find the mistake</button></div><div class="lab-tabs" role="group" aria-label="Choose an experiment">${ids.map(key=>`<button type="button" data-lab="${key}" aria-pressed="false">${defs[key].name}</button>`).join('')}</div><div class="lab-content"></div><div class="lab-announcement" role="status" aria-live="polite"></div>`;
const modal=document.createElement('dialog');modal.className='lab-dialog';modal.setAttribute('aria-label','Expanded math lab');document.body.append(modal);
function restoreExpanded(){if(disposed||!expanded)return;expanded=false;if(modal.open)modal.close();placeholder.replaceWith(host);placeholder=null;document.body.classList.remove('lab-open');$('.lab-expand',host).textContent='Expand ↗';$('.lab-expand',host).setAttribute('aria-label','Expand math studio');focusBefore?.focus({preventScroll:true});}
function closeExpanded(){if(!expanded||modal.dataset.closing==='true')return;const to=placeholder?.getBoundingClientRect();if(window.GuideMotion)window.GuideMotion.dialogClose(modal,restoreExpanded,to);else restoreExpanded();}
listen(modal,'close',()=>{if(!modal.open)restoreExpanded();});
listen(modal,'cancel',e=>{e.preventDefault();closeExpanded();});
function toggleExpanded(){if(expanded){closeExpanded();return;}const from=host.getBoundingClientRect();focusBefore=document.activeElement;placeholder=document.createElement('div');placeholder.style.height=host.offsetHeight+'px';host.before(placeholder);modal.append(host);expanded=true;document.body.classList.add('lab-open');$('.lab-expand',host).textContent='Close ✕';$('.lab-expand',host).setAttribute('aria-label','Close expanded math studio');modal.showModal();window.GuideMotion?.dialogOpen(modal,from);$('.lab-expand',host).focus();}
// Exact inputs remain available on demand; the primary experience requires no dragging.
const exactInput=([key,label,min,max,step])=>`<label class="lab-exact">${label}<input type="number" aria-label="${label} exact value" data-number="${key}" min="${min}" max="${max}" step="${step}" value="${s[key]}"></label>`;
function stopAnimation(){cancelAnimationFrame(raf);raf=0;if(animationTarget){Object.assign(s,animationTarget);animationTarget=null;}}
function dispose(){stopAnimation();$('.lab-announcement',host).textContent='';disposePanel?.();disposePanel=null;dragging=null;}
function showMode(next){if(next===mode)return;dispose();mode=next;for(const b of host.querySelectorAll('[data-mode]'))b.setAttribute('aria-pressed',String(b.dataset.mode===mode));$('.lab-tabs',host).hidden=mode!=='explore';if(mode==='mistakes'){disposePanel=mountChallenges($('.lab-content',host),course,challengeSession,{signal});}else select(id);}
function select(key){if(!ids.includes(key))return;dispose();if(s&&id)memories[id]={...s};id=key;s={...(memories[id]||defs[id].defaults)};zoom=1;eqTerm='h';const d=defs[id];
 for(const tab of host.querySelectorAll('[data-lab]'))tab.setAttribute('aria-pressed',String(tab.dataset.lab===id));
 if(id==='matrix'){$('.lab-content',host).replaceChildren();disposePanel=mountComposition($('.lab-content',host),{signal});return;}
 const isEquation=id==='transforms';
 $('.lab-content',host).innerHTML=`<div class="lab-intro"><h3>${d.title}</h3><p>${d.description}</p></div><div class="workbench-layout"><div class="workbench-plot"><div class="lab-plot-tools"><span>${id==='complex'?'Complex plane':'Coordinate plane'}</span><div><button type="button" data-zoom="out" aria-label="Zoom out">−</button><button type="button" data-zoom="in" aria-label="Zoom in">+</button></div></div><svg class="workbench-svg" viewBox="0 0 480 360" role="img" aria-label="Interactive math plot"></svg><div class="workbench-legend"><span>${d.legend[0]}</span><span>${d.legend[1]}</span></div></div><div class="workbench-controls">${isEquation?`<span class="lab-eyebrow">The equation is your control</span><div class="lab-equation-touch" aria-label="Tap an equation term"><span>y = </span><button type="button" data-term="a" aria-label="Explore vertical scale a" aria-pressed="false"><span data-term-value="a">1</span><small>scale</small></button><span>· f(x</span><button type="button" data-term="h" aria-label="Explore horizontal shift h" aria-pressed="true"><span data-term-value="h">− 0</span><small>horizontal</small></button><span>)</span><button type="button" data-term="k" aria-label="Explore vertical shift k" aria-pressed="false"><span data-term-value="k">+ 0</span><small>vertical</small></button></div><div class="lab-term-explanation" role="status"></div><div class="lab-term-actions" role="group" aria-label="Change selected term"></div>`:''}<p class="workbench-equation" ${isEquation?'aria-label="Current equation"':''}>${d.equation}</p>${d.select?`<label class="lab-select">${d.select[1]}<select data-select="${d.select[0]}">${d.select[2].map(([v,n])=>`<option value="${v}" ${s[d.select[0]]===v?'selected':''}>${n}</option>`).join('')}</select></label>`:''}${isEquation?'':`<div class="lab-presets" role="group" aria-label="Choose an example">${d.presets.map(([label],i)=>`<button type="button" data-preset="${i}">${label}</button>`).join('')}${id==='limits'?'<button type="button" data-closer>Closer again →</button>':''}</div>`}<div class="lab-readout" role="status" aria-live="off"></div><div class="lab-footer"><details class="lab-customize"><summary>Use your own values</summary><div class="lab-exact-grid">${d.controls.map(exactInput).join('')}</div></details><button class="workbench-reset" type="button">Reset</button></div></div></div>`;
 if(isEquation)renderTerm();draw();
}
const termInfo={
 a:{title:'Change the vertical scale',text:'This multiplies every output. A negative value also reflects the graph across the x-axis.',options:[['Reflect',-1],['Half height',.5],['Original',1],['Double height',2]]},
 h:{title:'Move the graph horizontally',text:'The input is x − h. A positive h moves the graph to the right.',options:[['Left 2',-2],['Centre',0],['Right 2',2]]},
 k:{title:'Move the graph vertically',text:'This adds the same amount to every output. Positive values move the graph up.',options:[['Down 2',-2],['Centre',0],['Up 2',2]]}
};
function renderTerm(){const info=termInfo[eqTerm];for(const b of host.querySelectorAll('[data-term]'))b.setAttribute('aria-pressed',String(b.dataset.term===eqTerm));$('.lab-term-explanation',host).innerHTML=`<b>${info.title}</b><p>${info.text}</p>`;$('.lab-term-actions',host).innerHTML=info.options.map(([label,value])=>`<button type="button" data-term-choice="${value}">${label}</button>`).join('');}
function animateTo(values){stopAnimation();const from={...s};animationTarget={...values};for(const [key,value]of Object.entries(values))if(typeof value!=='number')s[key]=value;const start=performance.now();const frame=now=>{if(disposed)return;const p=(reducedMotion.matches||window.GuideMotion?.motionAllowed()===false)?1:Math.min(1,(now-start)/520),ease=1-(1-p)**3;for(const [key,value]of Object.entries(values))if(typeof value==='number')s[key]=from[key]+(value-from[key])*ease;sync();draw();if(p<1)raf=requestAnimationFrame(frame);else{Object.assign(s,values);animationTarget=null;sync();draw();announce();}};raf=requestAnimationFrame(frame);}

function sync(){for(const input of host.querySelectorAll('[data-param],[data-number],[data-select]')){if(input===document.activeElement&&input.dataset.number)continue;const value=s[input.dataset.param||input.dataset.number||input.dataset.select];input.value=typeof value==='number'?Number(value.toFixed(4)):value;}}
function announce(){const readout=$('.lab-readout',host);if(readout)$('.lab-announcement',host).textContent=readout.textContent;}
function set(values){stopAnimation();Object.assign(s,values);sync();draw();announce();}

function scene(){const scale=(id==='vectors'?23:32)*zoom,cx=id==='limits'?1:0,cy=id==='limits'&&s.kind!=='pole'?2:0;const X=x=>240+(x-cx)*scale,Y=y=>180-(y-cy)*scale;return {scale,cx,cy,X,Y,xmin:cx-220/scale,xmax:cx+220/scale,ymin:cy-160/scale,ymax:cy+160/scale};}
function draw(){const svg=$('svg',host),r=$('.lab-readout',host),{X,Y,scale,xmin,xmax,ymin,ymax}=scene();
 const line=(x1,y1,x2,y2,cls,extra='')=>`<path class="${cls}" d="M${X(x1)} ${Y(y1)}L${X(x2)} ${Y(y2)}" ${extra}/>`;
 const point=(x,y,drag='',open=false,cls='')=>`<circle class="${cls} ${open?'lab-hole':''}" cx="${X(x)}" cy="${Y(y)}" r="${open?6:7}" />`;
 const curve=(fn,cls,from=xmin,to=xmax)=>{let path='',pen=false,oldY=0;for(let i=0;i<=240;i++){const x=from+(to-from)*i/240,y=fn(x);if(!Number.isFinite(y)||Math.abs(y)>1e5){pen=false;continue;}const nextY=Y(y);if(pen&&Math.abs(nextY-oldY)>1000)pen=false;path+=`${pen?'L':'M'}${X(x).toFixed(2)} ${nextY.toFixed(2)}`;oldY=nextY;pen=true;}return `<path class="${cls}" d="${path}"/>`;};
 let grid='',labels='',axes='';const tick=zoom<.75?2:1;
 for(let n=Math.ceil(xmin/tick)*tick;n<=xmax;n+=tick){grid+=`M${X(n)} 20V340`;if(n!==0)labels+=`<text x="${X(n)}" y="${Math.min(331,Math.max(35,Y(0)+16))}" text-anchor="middle">${n}</text>`;}
 for(let n=Math.ceil(ymin/tick)*tick;n<=ymax;n+=tick){grid+=`M20 ${Y(n)}H460`;if(n!==0)labels+=`<text x="${Math.min(440,Math.max(34,X(0)-9))}" y="${Y(n)+4}" text-anchor="end">${n}</text>`;}
 if(Y(0)>=20&&Y(0)<=340)axes+=`M20 ${Y(0)}H460`;if(X(0)>=20&&X(0)<=460)axes+=`M${X(0)} 20V340`;
 let picture=`<defs><clipPath id="lab-clip"><rect x="20" y="20" width="440" height="320" rx="3"/></clipPath><marker id="lab-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L10 5L0 10Z" fill="context-stroke"/></marker></defs><path class="grid" d="${grid}"/><path class="axis" d="${axes}"/><g class="plot-labels">${labels}<text x="452" y="${Math.max(16,Math.min(330,Y(0)-8))}">${id==='complex'?'Re':'x'}</text><text x="${Math.max(25,Math.min(440,X(0)+8))}" y="16">${id==='complex'?'Im':'y'}</text></g><g clip-path="url(#lab-clip)">`;
 let readout='',description='';
 if(id==='transforms'){
  picture+=curve(x=>transformed(s.base,1,0,0,x),'curve lab-original')+curve(x=>transformed(s.base,s.a,s.h,s.k,x),'tangent')+point(s.h,s.k,'shift');
  const inner=Math.abs(s.h)<1e-9?'x':`x ${signed(-s.h)}`,baseNames={square:`(${inner})²`,absolute:`|${inner}|`,sqrt:`√(${inner})`,sine:`sin(${inner})`};
  $('.workbench-equation',host).textContent=`y = ${s.a===1?'':s.a===-1?'−':fmt(s.a)+'·'}${baseNames[s.base]}${Math.abs(s.k)<1e-9?'':' '+signed(s.k)}`;
  for(const term of ['a','h','k'])$(`[data-term-value="${term}"]`,host).textContent=term==='a'?fmt(s.a):signed(term==='h'?-s.h:s.k);
  for(const button of host.querySelectorAll('[data-term-choice]'))button.setAttribute('aria-pressed',String(Math.abs(+button.dataset.termChoice-s[eqTerm])<1e-6));
  readout=`<b>a = ${fmt(s.a)} &nbsp; h = ${fmt(s.h)} &nbsp; k = ${fmt(s.k)}</b><span>${s.a===0?'Vertical scale is zero; the output is k wherever the parent function is defined.':s.a<0?'Reflected across the x-axis before shifting.':'Positive vertical scale.'} ${s.base==='sqrt'?`Domain: x ≥ ${fmt(s.h)}.`:''}</span>`;description=`Transformed ${s.base} function; scale ${s.a}, horizontal shift ${s.h}, vertical shift ${s.k}.`;
 }else if(id==='limits'){
  const {kind,gap}=s,l=1-gap,rr=1+gap,lv=limitValue(kind,l),rv=limitValue(kind,rr),facts=limitFacts[kind];
  if(kind==='hole')picture+=curve(x=>x+1,'curve')+point(1,2,'',true)+point(1,3);
  else if(kind==='jump')picture+=curve(()=>1,'curve',xmin,Math.min(1,xmax))+curve(()=>3,'curve',Math.max(1,xmin),xmax)+point(1,1,'',true)+point(1,3);
  else if(kind==='pole')picture+=curve(x=>1/(x-1),'curve',xmin,Math.min(.995,xmax))+curve(x=>1/(x-1),'curve',Math.max(1.005,xmin),xmax)+line(1,ymin,1,ymax,'lab-asymptote');
  else picture+=curve(x=>x*x,'curve');
  picture+=line(l,0,l,lv,'lab-guide')+line(rr,0,rr,rv,'lab-guide')+point(l,lv)+point(rr,rv);
  const equations={hole:'f(x) = x + 1 (x ≠ 1); f(1) = 3',smooth:'f(x) = x²',jump:'f(x) = 1 (x < 1); 3 (x ≥ 1)',pole:'f(x) = 1 / (x − 1)'};$('.workbench-equation',host).textContent=equations[kind];
  readout=`<b>Left sample: (${fmt(l)}, ${fmt(lv)})<br>Right sample: (${fmt(rr)}, ${fmt(rv)})</b><span>As x → 1: left → ${facts.left}; right → ${facts.right}<br>Limit: ${facts.limit} · f(1): ${facts.value}</span>`;description=`Limit at 1: ${facts.limit}. Left approaches ${facts.left}; right approaches ${facts.right}.`;
 }else if(id==='derivative'){
  const {x,h}=s,m=secant(x,h),y=x*x,q=x+h;
  picture+=curve(v=>v*v,'curve')+curve(v=>2*x*(v-x)+y,'curve lab-original');
  if(m!==null)picture+=curve(v=>m*(v-x)+y,'tangent')+point(q,q*q,'q');
  picture+=point(x,y,'p');
  readout=`<b>${m===null?'Secant quotient: undefined at h = 0':`Secant slope = 2x + h = ${fmt(m)}`}<br>Tangent slope = 2x = ${fmt(2*x)}</b><span>P = (${fmt(x)}, ${fmt(y)}) · Q = (${fmt(q)}, ${fmt(q*q)})<br>${m===null?'The tangent is the limit as h → 0, not a quotient with zero denominator.':'Bring the points closer to compare average and instantaneous rates of change.'}</span>`;description=`Tangent slope ${fmt(2*x)}; secant slope ${m===null?'undefined':fmt(m)}.`;
 }else if(id==='complex'){
  const {x,y,u,v}=s,[wx,wy]=multiply(x,y,u,v),radius=Math.hypot(x,y),mod=Math.hypot(u,v),angle=Math.atan2(v,u)*180/Math.PI;
  picture+=`<circle class="lab-orbit" cx="${X(0)}" cy="${Y(0)}" r="${radius*scale}"/>`+line(0,0,x,y,'curve','marker-end="url(#lab-arrow)"')+line(0,0,wx,wy,'tangent','marker-end="url(#lab-arrow)"')+point(x,y,'z',false,'lab-input-point')+point(wx,wy);
  readout=`<b>z = ${complex(x,y)}<br>m = ${complex(u,v)}<br>w = ${complex(wx,wy)}</b><span>Scale factor: ${fmt(mod)} · ${mod===0?'Rotation undefined for zero multiplier':`Rotation: ${fmt(angle)}°`}<br>${radius===0?'z = 0 has no direction; its product stays at the origin.':'Positive angles turn counterclockwise.'} ${wx<xmin||wx>xmax||wy<ymin||wy>ymax?'Product is outside this view. Zoom out to see it.':''}</span>`;description=`${complex(x,y)} times ${complex(u,v)} equals ${complex(wx,wy)}.`;
 }else if(id==='systems'){
  const {m1,b1,m2,b2}=s,sol=intersection(m1,b1,m2,b2);
  picture+=curve(x=>m1*x+b1,'curve')+curve(x=>m2*x+b2,'tangent');if(sol.kind==='one')picture+=point(sol.x,sol.y);
  const solution=sol.kind==='one'?`One solution: (${fmt(sol.x)}, ${fmt(sol.y)})`:sol.kind==='none'?'No solution':'Infinitely many solutions';
  $('.workbench-equation',host).innerHTML=`y = ${fmt(m1)}x ${signed(b1)}<br>y = ${fmt(m2)}x ${signed(b2)}`;
  readout=`<b>${solution}</b><span>${sol.kind==='one'?(sol.x<xmin||sol.x>xmax||sol.y<ymin||sol.y>ymax?'Intersection is outside the visible window; its coordinates are shown above.':'Both equations hold at the highlighted intersection.'):sol.kind==='none'?'Equal slopes, different intercepts: parallel lines.':'The equations describe the same line.'}</span>`;description=solution;
 }else{
  const {a,b}=s,ux=2*a,uy=a,wx=ux-b,wy=uy+2*b;
  picture+=line(0,0,2,1,'curve','marker-end="url(#lab-arrow)"')+line(0,0,-1,2,'curve','marker-end="url(#lab-arrow)"')+line(0,0,ux,uy,'vector-path')+line(ux,uy,wx,wy,'vector-path')+line(0,0,wx,wy,'tangent','marker-end="url(#lab-arrow)"')+point(wx,wy);
  readout=`<b>w = ${fmt(a)}u ${signed(b)}v = (${fmt(wx)}, ${fmt(wy)})</b><span>a·u = (${fmt(ux)}, ${fmt(uy)})<br>b·v = (${fmt(-b)}, ${fmt(2*b)})</span>`;description=`Result vector (${fmt(wx)}, ${fmt(wy)}).`;
 }
 svg.innerHTML=picture+'</g>';svg.setAttribute('aria-label',description);r.innerHTML=readout;
}
listen(host,'click',e=>{
 const modeButton=e.target.closest('[data-mode]');if(modeButton){showMode(modeButton.dataset.mode);return;}
 if(e.target.closest('.lab-expand')){toggleExpanded();return;}
 const tab=e.target.closest('[data-lab]');if(tab){if(tab.dataset.lab!==id)select(tab.dataset.lab);return;}
 if(mode!=='explore'||id==='matrix')return;
 const term=e.target.closest('[data-term]');if(term){eqTerm=term.dataset.term;renderTerm();draw();return;}
 const choice=e.target.closest('[data-term-choice]');if(choice){animateTo({[eqTerm]:+choice.dataset.termChoice});return;}
 const preset=e.target.closest('[data-preset]');if(preset){const values=defs[id].presets[+preset.dataset.preset][1];if(id==='complex')animateComplex(values);else animateTo(values);return;}
 if(e.target.closest('[data-closer]')){stopAnimation();animateTo({gap:Math.max(.001,s.gap/10)});return;}
 const z=e.target.closest('[data-zoom]');if(z){zoom=Math.max(.3,Math.min(3,zoom*(z.dataset.zoom==='in'?1.3:1/1.3)));draw();return;}
 if(e.target.closest('.workbench-reset')){zoom=1;set({...defs[id].defaults});return;}
});
// Multiplication by i follows an arc, so the motion shows rotation rather than shrinking through the plane.
function animateComplex(values){stopAnimation();const from={r:Math.hypot(s.u,s.v),angle:Math.atan2(s.v,s.u)},to={r:Math.hypot(values.u,values.v),angle:Math.atan2(values.v,values.u)};let delta=to.angle-from.angle;if(delta>Math.PI)delta-=2*Math.PI;if(delta<-Math.PI)delta+=2*Math.PI;animationTarget={...values};const start=performance.now();function frame(now){if(disposed)return;const p=(reducedMotion.matches||window.GuideMotion?.motionAllowed()===false)?1:Math.min(1,(now-start)/650),t=1-(1-p)**3,r=from.r+(to.r-from.r)*t,a=from.angle+delta*t;s.u=r*Math.cos(a);s.v=r*Math.sin(a);sync();draw();if(p<1)raf=requestAnimationFrame(frame);else{Object.assign(s,values);animationTarget=null;sync();draw();announce();}}raf=requestAnimationFrame(frame);}

function updateInput(input){const key=input.dataset.param||input.dataset.number,config=defs[id].controls.find(c=>c[0]===key);if(!config)return;const value=Number(input.value);if(input.value.trim()===''||!Number.isFinite(value)){input.value=s[key];return;}const normalized=Math.max(config[2],Math.min(config[3],Math.round(value/config[4])*config[4]));set({[key]:normalized});input.value=Number(normalized.toFixed(6));}
listen(host,'keydown',e=>{if(e.key==='Enter'&&e.target.matches('[data-number]')){updateInput(e.target);e.target.blur();}});
listen(host,'change',e=>{if(e.target.matches('[data-number]'))updateInput(e.target);if(e.target.matches('[data-select]'))set({[e.target.dataset.select]:e.target.value});});
const topicMap=course==='mth140'?{functions:'transforms',limits:'limits','derivatives-1':'derivative'}:{complex:'complex',systems:'systems',matrices:'matrix',determinants:'matrix',rn:'vectors',transformations:'matrix'};
function attachTopics(){if(disposed)return;for(const [topic,lab]of Object.entries(topicMap)){const body=$(`#topic-${topic} .topic-body`);if(!body||$('[data-open-lab]',body))continue;const b=document.createElement('button');b.type='button';b.className='button topic-lab-link';b.dataset.openLab=lab;b.textContent=`Open ${defs[lab].name.toLowerCase()} lab ↗`;body.prepend(b);topicButtons.add(b);}}
const topics=$('#topic-grid');if(topics){topicObserver=new MutationObserver(attachTopics);topicObserver.observe(topics,{childList:true});}attachTopics();
listen(document,'click',e=>{const b=e.target.closest('[data-open-lab]');if(!b||!topicButtons.has(b))return;if(mode!=='explore')showMode('explore');select(b.dataset.openLab);host.scrollIntoView({block:'start',behavior:'instant'});$(`[data-lab="${id}"]`,host).focus({preventScroll:true});});
// A stable anchor lets students return directly to the lab.
select(id);
activeCleanup=cleanup;ctx.signal?.addEventListener('abort',onAbort,{once:true});
}
