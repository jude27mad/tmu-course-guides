import {transformed,multiply,determinant,matrixAt,transformPoint,intersection,secant,limitValue,limitFacts} from './lab-math.mjs';
const course=document.body.dataset.course;
if(course==='mth140'||course==='mth141')init();
function init(){
const $=(s,root=document)=>root.querySelector(s),fmt=n=>Math.abs(n)<1e-9?'0':Number(n.toFixed(3)).toString(),signed=n=>n<0?'− '+fmt(-n):'+ '+fmt(n),complex=(x,y)=>`${fmt(x)} ${signed(y)}i`;
const defs={
 transforms:{name:'Transformations',title:'Shape the function',equation:'y = a·f(x − h) + k',description:'Shift, stretch or reflect a graph. The dashed curve is the original. Drag the highlighted point to move h and k.',defaults:{base:'square',a:1,h:0,k:0},controls:[['a','Vertical scale a',-3,3,.1],['h','Horizontal shift h',-3,3,.1],['k','Vertical shift k',-3,3,.1]],select:['base','Parent function',[['square','Quadratic · x²'],['absolute','Absolute value · |x|'],['sqrt','Square root · √x'],['sine','Sine · sin x']]],presets:[['Shift right',{h:2}],['Reflect',{a:-1}],['Stretch',{a:2}],['Start over',{a:1,h:0,k:0}]],legend:['Original function','Transformed function'],question:'Starting with y = x², what will changing h from 0 to 2 do?',answers:['Move right 2','Move left 2','Move up 2'],correct:0,after:{h:2},explain:'The graph moves right 2. Its vertex is now (2, 0), because the input is x − 2.'},
 limits:{name:'Limits',title:'Approach the missing point',equation:'x → 1',description:'Bring the two sample points toward x = 1. Compare the approaching heights with the actual value at the point.',defaults:{kind:'hole',gap:.5},controls:[['gap','Distance from 1',.001,1,.001]],select:['kind','Example',[['hole','Removable discontinuity'],['smooth','Continuous curve'],['jump','Jump discontinuity'],['pole','Vertical asymptote']]],presets:[['Move closer',{gap:.01}],['Show a jump',{kind:'jump',gap:.1}],['Show an asymptote',{kind:'pole',gap:.1}]],legend:['Function','Approaching points'],question:'Here f(1) = 3, but nearby points lie on y = x + 1. What is the limit as x → 1?',answers:['2','3','Does not exist'],correct:0,after:{gap:.01},explain:'The limit is 2: both sides approach height 2. The filled point at height 3 gives f(1), which is different.'},
 derivative:{name:'Secant → tangent',title:'Build a derivative',equation:'f(x) = x²',description:'Move Q toward P. The secant uses two points; the tangent shows the limiting slope at P.',defaults:{x:1,h:1},controls:[['x','Point P position',-2,2,.05],['h','Separation h',-2,2,.01]],presets:[['Bring points close',{h:.05}],['Approach from left',{h:-.05}],['Show the limit',{h:0}]],legend:['Curve and tangent','Secant PQ'],question:'At P = (1, 1), what does the secant slope approach as h → 0?',answers:['1','2','0'],correct:1,after:{h:0},explain:'The secant slope is 2 + h. As h approaches 0, it approaches 2. At h = 0, the quotient itself is undefined; the derivative is its limit.'},
 complex:{name:'Complex numbers',title:'Rotate and scale a number',equation:'w = z × m',description:'Drag z on the complex plane or enter its coordinates. Multiplying by m rotates and scales it.',defaults:{x:1,y:1,u:1,v:0},controls:[['x','Real part of z',-3,3,.1],['y','Imaginary part of z',-3,3,.1],['u','Real part of multiplier',-2,2,.1],['v','Imaginary part of multiplier',-2,2,.1]],presets:[['Multiply by i',{u:0,v:1}],['Double',{u:2,v:0}],['Half turn',{u:-1,v:0}],['Identity',{u:1,v:0}]],legend:['Input z','Product w'],question:'If z = 1 + i, where does multiplying by i send it?',answers:['−1 + i','1 − i','−1 − i'],correct:0,after:{u:0,v:1},explain:'i(1 + i) = −1 + i. Multiplying by i rotates a nonzero point 90° counterclockwise without changing its distance from the origin.'},
 matrix:{name:'Matrices',title:'Transform the whole plane',equation:'A = [a b; c d]',description:'Change the matrix, then play the transformation. The unit square shows area and orientation; a singular matrix collapses it.',defaults:{a:1,b:.8,c:0,d:1,t:1},controls:[['a','Matrix a',-2,2,.1],['b','Matrix b',-2,2,.1],['c','Matrix c',-2,2,.1],['d','Matrix d',-2,2,.1],['t','Transformation progress',0,1,.01]],presets:[['Shear',{a:1,b:1,c:0,d:1}],['Rotate 90°',{a:0,b:-1,c:1,d:0}],['Reflect',{a:-1,b:0,c:0,d:1}],['Collapse to a line',{a:1,b:0,c:0,d:0}]],legend:['Original grid','Transformed grid'],question:'If A sends (x, y) to (x, 0), what area does the unit square become?',answers:['1','0','2'],correct:1,after:{a:1,b:0,c:0,d:0,t:1},explain:'Its area becomes 0. The square collapses onto the x-axis, and the determinant is 0.'},
 systems:{name:'Linear systems',title:'Find where two lines meet',equation:'y = m₁x + b₁; y = m₂x + b₂',description:'Adjust slopes and intercepts. Watch the system switch between one, no or infinitely many solutions.',defaults:{m1:1,b1:0,m2:-1,b2:2},controls:[['m1','First line slope',-3,3,.1],['b1','First line intercept',-3,3,.1],['m2','Second line slope',-3,3,.1],['b2','Second line intercept',-3,3,.1]],presets:[['One solution',{m1:1,b1:0,m2:-1,b2:2}],['Parallel',{m1:1,b1:0,m2:1,b2:2}],['Same line',{m1:1,b1:0,m2:1,b2:0}]],legend:['First equation','Second equation'],question:'What happens when the lines have the same slope but different intercepts?',answers:['One solution','No solution','Infinitely many'],correct:1,after:{m1:1,b1:0,m2:1,b2:2},explain:'They are parallel and distinct, so they never meet. The system has no solution.'},
 vectors:{name:'Vectors',title:'Build a linear combination',equation:'w = a·u + b·v',description:'Combine u = (2, 1) and v = (−1, 2). The dashed route adds the scaled vectors head to tail.',defaults:{a:1,b:1},controls:[['a','Coefficient a',-2,2,.05],['b','Coefficient b',-2,2,.05]],presets:[['Only u',{a:1,b:0}],['Only v',{a:0,b:1}],['Subtract v',{a:1,b:-1}]],legend:['Basis vectors','Result w'],question:'With u = (2, 1) and v = (−1, 2), what is 2u − v?',answers:['(3, 4)','(5, 0)','(0, 5)'],correct:1,after:{a:2,b:-1},explain:'2(2, 1) − (−1, 2) = (4 + 1, 2 − 2) = (5, 0).'}
};
const ids=course==='mth140'?['transforms','limits','derivative']:['complex','matrix','systems','vectors'];
let id=ids[0],s=null,zoom=1,raf=0,dragging=null,expanded=false,placeholder=null,focusBefore=null;
const memories={};
const host=document.createElement('section');host.id='math-lab';host.className='math-workbench math-lab';host.setAttribute('aria-label','Interactive math lab');
const rail=$('.semester-rail');(rail||$('.quick-find')).after(host);
host.innerHTML=`<div class="workbench-title"><div><span class="workbench-kicker">${course==='mth140'?'Calculus':'Linear algebra'} / interactive lab</span><h2>Make the math move.</h2></div><button class="lab-expand" type="button">Expand ↗</button></div><div class="lab-tabs" role="group" aria-label="Choose an experiment">${ids.map(key=>`<button type="button" data-lab="${key}" aria-pressed="false">${defs[key].name}</button>`).join('')}</div><div class="lab-content"></div>`;
const modal=document.createElement('dialog');modal.className='lab-dialog';modal.setAttribute('aria-label','Expanded math lab');document.body.append(modal);
function closeExpanded(){if(!expanded)return;expanded=false;modal.close();placeholder.replaceWith(host);placeholder=null;document.body.classList.remove('lab-open');$('.lab-expand',host).textContent='Expand ↗';focusBefore?.focus({preventScroll:true});}
modal.addEventListener('close',closeExpanded);
function toggleExpanded(){if(expanded){closeExpanded();return;}focusBefore=document.activeElement;placeholder=document.createElement('div');placeholder.style.height=host.offsetHeight+'px';host.before(placeholder);modal.append(host);expanded=true;document.body.classList.add('lab-open');$('.lab-expand',host).textContent='Close expanded view ✕';modal.showModal();$('.lab-expand',host).focus();}
const range=([key,label,min,max,step])=>`<div class="lab-control"><div class="lab-control-label"><label for="lab-${key}">${label}</label><input type="number" aria-label="${label} exact value" data-number="${key}" min="${min}" max="${max}" step="${step}" value="${s[key]}"></div><input id="lab-${key}" aria-label="${label}" type="range" data-param="${key}" min="${min}" max="${max}" step="${step}" value="${s[key]}"></div>`;
function select(key){if(!ids.includes(key))return;cancelAnimationFrame(raf);if(s&&id)memories[id]={...s};id=key;s={...(memories[id]||defs[id].defaults)};zoom=1;dragging=null;const d=defs[id];
 for(const tab of host.querySelectorAll('[data-lab]'))tab.setAttribute('aria-pressed',String(tab.dataset.lab===id));
 $('.lab-content',host).innerHTML=`<div class="lab-intro"><h3>${d.title}</h3><p>${d.description}</p></div><div class="workbench-layout"><div class="workbench-plot"><div class="lab-plot-tools"><span>${id==='complex'?'Complex plane':'Coordinate plane'}</span><div><button type="button" data-zoom="out" aria-label="Zoom out">−</button><button type="button" data-zoom="in" aria-label="Zoom in">+</button></div></div><svg class="workbench-svg" viewBox="0 0 480 360" role="img" aria-label="Interactive math plot"></svg><div class="workbench-legend"><span>${d.legend[0]}</span><span>${d.legend[1]}</span></div><div class="lab-readout" role="status" aria-live="off"></div></div><div class="workbench-controls"><p class="workbench-equation">${d.equation}</p>${d.select?`<label class="lab-select">${d.select[1]}<select data-select="${d.select[0]}">${d.select[2].map(([v,n])=>`<option value="${v}" ${s[d.select[0]]===v?'selected':''}>${n}</option>`).join('')}</select></label>`:''}<div class="lab-presets" role="group" aria-label="Example presets">${d.presets.map(([label],i)=>`<button type="button" data-preset="${i}">${label}</button>`).join('')}</div><div class="lab-controls ${d.controls.length>3?'lab-controls-many':''}">${d.controls.map(range).join('')}</div><div class="workbench-footer"><span>${id==='matrix'?'Play interpolates from the identity to A.':'Sliders and exact values stay in sync.'}</span><div>${id==='matrix'?'<button class="lab-play" type="button">Play transformation</button>':''}<button class="workbench-reset" type="button">Reset</button></div></div></div></div><div class="lab-challenge"><div><span class="workbench-kicker">Predict → try → check</span><p>Test your intuition with one quick question.</p></div><button class="lab-start" type="button">Try a prediction</button><div class="lab-question" hidden></div></div>`;draw();
}
function sync(){for(const input of host.querySelectorAll('[data-param],[data-number],[data-select]'))input.value=s[input.dataset.param||input.dataset.number||input.dataset.select];}
function set(values){cancelAnimationFrame(raf);Object.assign(s,values);sync();draw();}
function play(){cancelAnimationFrame(raf);if(matchMedia('(prefers-reduced-motion: reduce)').matches){set({t:1});return;}s.t=0;const start=performance.now();function frame(now){s.t=Math.min(1,(now-start)/1200);sync();draw();if(s.t<1)raf=requestAnimationFrame(frame);}raf=requestAnimationFrame(frame);}
function scene(){const scale=(id==='vectors'?23:32)*zoom,cx=id==='limits'?1:0,cy=id==='limits'&&s.kind!=='pole'?2:0;const X=x=>240+(x-cx)*scale,Y=y=>180-(y-cy)*scale;return {scale,cx,cy,X,Y,xmin:cx-220/scale,xmax:cx+220/scale,ymin:cy-160/scale,ymax:cy+160/scale};}
function draw(){const svg=$('svg',host),r=$('.lab-readout',host),{X,Y,scale,xmin,xmax,ymin,ymax}=scene();
 const line=(x1,y1,x2,y2,cls,extra='')=>`<path class="${cls}" d="M${X(x1)} ${Y(y1)}L${X(x2)} ${Y(y2)}" ${extra}/>`;
 const point=(x,y,drag='',open=false,cls='')=>`<circle class="${cls} ${open?'lab-hole':''}" cx="${X(x)}" cy="${Y(y)}" r="${open?6:7}" ${drag?`data-drag="${drag}"`:''}/>`;
 const curve=(fn,cls,from=xmin,to=xmax)=>{let path='',pen=false,oldY=0;for(let i=0;i<=240;i++){const x=from+(to-from)*i/240,y=fn(x);if(!Number.isFinite(y)||Math.abs(y)>1e5){pen=false;continue;}const nextY=Y(y);if(pen&&Math.abs(nextY-oldY)>1000)pen=false;path+=`${pen?'L':'M'}${X(x).toFixed(2)} ${nextY.toFixed(2)}`;oldY=nextY;pen=true;}return `<path class="${cls}" d="${path}"/>`;};
 let grid='',labels='',axes='';const tick=zoom<.75?2:1;
 for(let n=Math.ceil(xmin/tick)*tick;n<=xmax;n+=tick){grid+=`M${X(n)} 20V340`;if(n!==0)labels+=`<text x="${X(n)}" y="${Math.min(331,Math.max(35,Y(0)+16))}" text-anchor="middle">${n}</text>`;}
 for(let n=Math.ceil(ymin/tick)*tick;n<=ymax;n+=tick){grid+=`M20 ${Y(n)}H460`;if(n!==0)labels+=`<text x="${Math.min(440,Math.max(34,X(0)-9))}" y="${Y(n)+4}" text-anchor="end">${n}</text>`;}
 if(Y(0)>=20&&Y(0)<=340)axes+=`M20 ${Y(0)}H460`;if(X(0)>=20&&X(0)<=460)axes+=`M${X(0)} 20V340`;
 let picture=`<defs><clipPath id="lab-clip"><rect x="20" y="20" width="440" height="320" rx="3"/></clipPath><marker id="lab-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L10 5L0 10Z" fill="context-stroke"/></marker></defs><path class="grid" d="${grid}"/><path class="axis" d="${axes}"/><g class="plot-labels">${labels}<text x="452" y="${Math.max(16,Math.min(330,Y(0)-8))}">${id==='complex'?'Re':'x'}</text><text x="${Math.max(25,Math.min(440,X(0)+8))}" y="16">${id==='complex'?'Im':'y'}</text></g><g clip-path="url(#lab-clip)">`;
 let readout='',description='';
 if(id==='transforms'){
  picture+=curve(x=>transformed(s.base,1,0,0,x),'curve lab-original')+curve(x=>transformed(s.base,s.a,s.h,s.k,x),'tangent')+point(s.h,s.k,'shift');
  const inner=`x ${signed(-s.h)}`,baseNames={square:`(${inner})²`,absolute:`|${inner}|`,sqrt:`√(${inner})`,sine:`sin(${inner})`};
  $('.workbench-equation',host).textContent=`y = ${fmt(s.a)}·${baseNames[s.base]} ${signed(s.k)}`;
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
  readout=`<b>${m===null?'Secant quotient: undefined at h = 0':`Secant slope = 2x + h = ${fmt(m)}`}<br>Tangent slope = 2x = ${fmt(2*x)}</b><span>P = (${fmt(x)}, ${fmt(y)}) · Q = (${fmt(q)}, ${fmt(q*q)})<br>${m===null?'The tangent is the limit as h → 0, not a quotient with zero denominator.':'Drag P or Q, or make h smaller using its exact value.'}</span>`;description=`Tangent slope ${fmt(2*x)}; secant slope ${m===null?'undefined':fmt(m)}.`;
 }else if(id==='complex'){
  const {x,y,u,v}=s,[wx,wy]=multiply(x,y,u,v),radius=Math.hypot(x,y),mod=Math.hypot(u,v),angle=Math.atan2(v,u)*180/Math.PI;
  picture+=`<circle class="lab-orbit" cx="${X(0)}" cy="${Y(0)}" r="${radius*scale}"/>`+line(0,0,x,y,'curve','marker-end="url(#lab-arrow)"')+line(0,0,wx,wy,'tangent','marker-end="url(#lab-arrow)"')+point(x,y,'z',false,'lab-input-point')+point(wx,wy);
  readout=`<b>z = ${complex(x,y)}<br>m = ${complex(u,v)}<br>w = ${complex(wx,wy)}</b><span>Scale factor: ${fmt(mod)} · ${mod===0?'Rotation undefined for zero multiplier':`Rotation: ${fmt(angle)}°`}<br>${radius===0?'z = 0 has no direction; its product stays at the origin.':'Positive angles turn counterclockwise.'} ${wx<xmin||wx>xmax||wy<ymin||wy>ymax?'Product is outside this view. Zoom out to see it.':''}</span>`;description=`${complex(x,y)} times ${complex(u,v)} equals ${complex(wx,wy)}.`;
 }else if(id==='matrix'){
  const m=matrixAt(s.a,s.b,s.c,s.d,s.t),det=determinant(...m),apply=(x,y)=>transformPoint(m,x,y);
  for(let n=-10;n<=10;n++)picture+=line(...apply(n,-10),...apply(n,10),'lab-transformed-grid')+line(...apply(-10,n),...apply(10,n),'lab-transformed-grid');
  const coords=[[0,0],[1,0],[1,1],[0,1]].map(([x,y])=>apply(x,y));
  picture+=`<polygon class="lab-unit-original" points="${[[0,0],[1,0],[1,1],[0,1]].map(([x,y])=>`${X(x)},${Y(y)}`).join(' ')}"/><polygon class="lab-unit" points="${coords.map(([x,y])=>`${X(x)},${Y(y)}`).join(' ')}"/>`+line(0,0,...apply(1,0),'tangent','marker-end="url(#lab-arrow)"')+line(0,0,...apply(0,1),'tangent','marker-end="url(#lab-arrow)"');
  $('.workbench-equation',host).innerHTML=`<span>A = </span><span class="lab-matrix"><span>${fmt(s.a)}</span><span>${fmt(s.b)}</span><span>${fmt(s.c)}</span><span>${fmt(s.d)}</span></span>`;
  const rankZero=m.every(v=>Math.abs(v)<1e-9);
  readout=`<b>Current determinant: ${fmt(det)}<br>Unit-square area: ${fmt(Math.abs(det))}</b><span>${Math.abs(det)<1e-9?(rankZero?'Collapsed to a point.':'Collapsed to a line.'):det<0?'Orientation reversed.':'Orientation preserved.'}<br>Progress: ${Math.round(s.t*100)}% · Target det(A): ${fmt(determinant(s.a,s.b,s.c,s.d))}</span>`;description=`Current determinant ${fmt(det)}, unit-square area ${fmt(Math.abs(det))}.`;
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
host.addEventListener('click',e=>{
 const tab=e.target.closest('[data-lab]');if(tab){select(tab.dataset.lab);return;}
 if(e.target.closest('.lab-expand')){toggleExpanded();return;}
 const preset=e.target.closest('[data-preset]');if(preset){set(defs[id].presets[+preset.dataset.preset][1]);return;}
 const z=e.target.closest('[data-zoom]');if(z){zoom=Math.max(.3,Math.min(3,zoom*(z.dataset.zoom==='in'?1.3:1/1.3)));draw();return;}
 if(e.target.closest('.workbench-reset')){zoom=1;set({...defs[id].defaults});$('.lab-question',host).hidden=true;$('.lab-readout',host).hidden=false;return;}
 if(e.target.closest('.lab-play')){play();return;}
 if(e.target.closest('.lab-start')){
  set({...defs[id].defaults});zoom=1;draw();const d=defs[id],q=$('.lab-question',host);q.hidden=false;$('.lab-readout',host).hidden=true;q.innerHTML=`<p><strong>${d.question}</strong></p><div class="lab-answers">${d.answers.map((a,i)=>`<button type="button" data-answer="${i}">${a}</button>`).join('')}</div><p class="lab-feedback" role="status"></p>`;return;
 }
 const answer=e.target.closest('[data-answer]');if(answer){const d=defs[id],correct=+answer.dataset.answer===d.correct;set(d.after);$('.lab-readout',host).hidden=false;const f=$('.lab-feedback',host);f.textContent=(correct?'Correct. ':'Not quite. ')+d.explain;for(const b of host.querySelectorAll('[data-answer]')){b.disabled=true;b.classList.toggle('lab-correct',+b.dataset.answer===d.correct);}return;}
});
function updateInput(input){const key=input.dataset.param||input.dataset.number,config=defs[id].controls.find(c=>c[0]===key);if(!config)return;const value=Number(input.value);if(input.value.trim()===''||!Number.isFinite(value)){sync();return;}set({[key]:Math.max(config[2],Math.min(config[3],Math.round(value/config[4])*config[4]))});}
host.addEventListener('input',e=>{if(e.target.matches('[data-param]'))updateInput(e.target)});
host.addEventListener('change',e=>{if(e.target.matches('[data-number]'))updateInput(e.target);if(e.target.matches('[data-select]'))set({[e.target.dataset.select]:e.target.value});});
host.addEventListener('pointerdown',e=>{const p=e.target.closest('[data-drag]');if(!p)return;dragging=p.dataset.drag;$('svg',host).setPointerCapture(e.pointerId);e.preventDefault();});
host.addEventListener('pointermove',e=>{if(!dragging)return;const svg=$('svg',host),matrix=svg.getScreenCTM();if(!matrix)return;const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(matrix.inverse()),v=scene(),x=(p.x-240)/v.scale+v.cx,y=(180-p.y)/v.scale+v.cy,round=n=>Math.round(n*20)/20,clamp=(n,min,max)=>Math.min(max,Math.max(min,n));
 if(dragging==='shift')set({h:Math.round(clamp(x,-3,3)*10)/10,k:Math.round(clamp(y,-3,3)*10)/10});
 if(dragging==='z')set({x:Math.round(clamp(x,-3,3)*10)/10,y:Math.round(clamp(y,-3,3)*10)/10});
 if(dragging==='p')set({x:round(clamp(x,-2,2))});
 if(dragging==='q')set({h:round(clamp(x-s.x,-2,2))});
});
host.addEventListener('pointerup',()=>dragging=null);host.addEventListener('pointercancel',()=>dragging=null);
const topicMap=course==='mth140'?{functions:'transforms',limits:'limits','derivatives-1':'derivative'}:{complex:'complex',systems:'systems',matrices:'matrix',determinants:'matrix',rn:'vectors',transformations:'matrix'};
function attachTopics(){for(const [topic,lab]of Object.entries(topicMap)){const body=$(`#topic-${topic} .topic-body`);if(!body||$('[data-open-lab]',body))continue;const b=document.createElement('button');b.type='button';b.className='button topic-lab-link';b.dataset.openLab=lab;b.textContent=`Open ${defs[lab].name.toLowerCase()} lab ↗`;body.prepend(b);}}
const topics=$('#topic-grid');if(topics)new MutationObserver(attachTopics).observe(topics,{childList:true});attachTopics();
document.addEventListener('click',e=>{const b=e.target.closest('[data-open-lab]');if(!b)return;select(b.dataset.openLab);host.scrollIntoView({block:'start',behavior:'instant'});$(`[data-lab="${id}"]`,host).focus({preventScroll:true});});
// A stable anchor lets students return directly to the lab.
select(id);
}
