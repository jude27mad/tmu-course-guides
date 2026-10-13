/* Backdrop: the living field behind coursework.
   One fixed, aria-hidden layer under every in-flow block holds, back to front: a CSS aurora (the always-on static
   base and the low-tier fallback), a raw WebGL2 field (one full-screen triangle drawn from the shared gsap.ticker)
   and SVG film grain. Panels stay solid above it, so text never sits on moving pixels.
   The field is quiet on purpose: low contrast, calmer through the reading column, near-still while the visitor
   reads, and at rest while the hero leads, while a palette or sheet holds the page, when motion is paused or
   reduced and when the tab is hidden. At rest it keeps its last frame. Pointer and scroll only ever nudge it. */
import {META,finePointer,ambientAllowed,onAmbient,motionAllowed,held,tier,atLeast,onTier,vendor} from './core.mjs?v=20261013-shift1';

const MOTIF={mechanism:0,flow:1,plane:2}[META.motif]??0;
// Drawing-buffer caps in pixels. The canvas is CSS-scaled up, which a soft field never shows.
const BUDGET={high:6e5,mid:3e5};
// Reading = no input for 2.6 s: the drift slows to a fifth. The hero leads while 55% or more of it is on screen.
const IDLE=2600,CALM=.2,HERO=.55;
const VIEWS=['assignments','study','info'];
const UNIFORMS=['uRes','uPan','uTime','uScroll','uVel','uPulse','uScale','uPtr','uTint','uInk','uAmt'];

/* ---- Shaders. One triangle covers the screen; the course vocabulary is compiled in, so each page pays for its own. ---- */
const VERT=`#version 300 es
void main(){gl_Position=vec4(gl_VertexID==1?3.:-1.,gl_VertexID==2?3.:-1.,0.,1.);}`;

const FRAG=`#version 300 es
precision highp float;
#define MOTIF ${MOTIF}
uniform vec2 uRes,uPan;
uniform float uTime,uScroll,uVel,uPulse,uScale;
uniform vec3 uPtr,uTint,uInk;
uniform vec4 uAmt;
out vec4 outColor;
const float TAU=6.2831853,PI=3.1415927;
vec2 h22(vec2 p){vec3 q=fract(p.xyx*vec3(.1031,.1030,.0973));q+=dot(q,q.yzx+33.33);return fract((q.xx+q.yz)*q.zy)*2.-1.;}
float h12(vec2 p){vec3 q=fract(p.xyx*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
// Gradient noise with a quintic fade; each fbm octave is rotated so no grid direction shows through.
float gn(vec2 p){vec2 i=floor(p),f=fract(p),u=f*f*f*(f*(f*6.-15.)+10.);
 return mix(mix(dot(h22(i),f),dot(h22(i+vec2(1,0)),f-vec2(1,0)),u.x),mix(dot(h22(i+vec2(0,1)),f-vec2(0,1)),dot(h22(i+vec2(1,1)),f-vec2(1,1)),u.x),u.y);}
float fbm(vec2 p,int n){float s=0.,a=.5;for(int i=0;i<4;i++){if(i>=n)break;s+=a*gn(p);p=mat2(1.6,1.2,-1.2,1.6)*p+vec2(3.1,1.7);a*=.5;}return s;}
// Lines a set number of buffer pixels wide, anti-aliased by their own screen-space gradient.
float iso(float d,float w){return 1.-smoothstep(w*.5,w*.5+1.,abs(d)/max(fwidth(d),1e-6));}
// Rules at every integer of x; they fade before their spacing gets tight enough to alias.
float rules(float x,float w){float fw=max(fwidth(x),1e-6);return (1.-smoothstep(w*.5,w*.5+1.,abs(fract(x+.5)-.5)/fw))*(1.-smoothstep(.1,.3,fw));}
#if MOTIF==0
// CEN100, mechanisms: a meshing gear train drawn like an engineering sheet (tooth profile, chain-line pitch
// circle, hub, bore, lightening holes, centre mark) with concentric rings that interfere between neighbours.
float tooth(float a,float n,float th){float u=fract(n*(a-th)/TAU+.5)-.5;return clamp((1.-4.*abs(u))*1.8,-1.,1.);}
float gear(vec2 p,vec2 c,float R,float n,float th,float w){
 vec2 d=p-c;float r=length(d),a=atan(d.y,d.x+1e-7),h=TAU*R/n*.32;
 float m=iso(r-R-h*tooth(a,n,th),w);
 float nd=floor(R*TAU*9.+.5),arc=fract((a-th)/TAU*nd); // a whole number of dashes per turn: no seam
 m=max(m,iso(r-R,w*.7)*(step(arc,.58)+step(.7,arc)*step(arc,.76))*.7);
 m=max(m,max(iso(r-R*.3,w),iso(r-R*.12,w)*.8));
 float k=TAU/5.,s=mod(a-th+k*.5,k)-k*.5;
 m=max(m,iso(length(vec2(r*cos(s)-R*.58,r*sin(s)))-R*.13,w)*.8);
 m=max(m,max(iso(d.x,w)*step(abs(d.y),R*.07),iso(d.y,w)*step(abs(d.x),R*.07))*.9);
 return max(m,rules(r*22.,w*.8)*smoothstep(R+h*1.5,R+h*3.,r)*exp(-(r-R)*3.2)*.55);
}
float motif(vec2 p,float t,float w){
 const float NA=40.,NB=24.,NC=16.,RA=.5,RB=RA*NB/NA,RC=RA*NC/NA,F1=2.25,F2=2.9;
 vec2 cA=vec2(uRes.x/uRes.y*.5-.03,-.33),cB=cA+(RA+RB)*vec2(cos(F1),sin(F1)),cC=cB+(RB+RC)*vec2(cos(F2),sin(F2));
 // Time turns the train slowly; scrolling and view changes drive it like a crank. Each driven gear's phase keeps
 // tooth facing gap along the line of centres: th2 = n1/n2 (phi - th1) + phi + pi - pi/n2.
 float tA=t*.05+uScroll*.6+uPan.x*.8;
 float tB=NA/NB*(F1-tA)+F1+PI-PI/NB,tC=NB/NC*(F2-tB)+F2+PI-PI/NC;
 return max(gear(p,cA,RA,NA,tA,w),max(gear(p,cB,RB,NB,tB,w),gear(p,cC,RC,NC,tC,w)));
}
#elif MOTIF==1
// MTH140, flow and tangency: streamlines of a slow laminar drift. The pointer is an obstacle in a potential flow,
// so the lines part around it and stay tangent to it; soft light travels along each line.
float motif(vec2 p,float t,float w){
 vec2 P=p+vec2(0.,-uScroll*.26)+uPan*.5,d=p-uPtr.xy;
 float psi=P.y+.17*fbm(P*vec2(.8,1.25)+vec2(-t*.035,t*.01),3)+uVel*.1*p.x;
 float r2=.0085*uPtr.z;psi-=r2*d.y/(dot(d,d)+r2*.5+1e-5);
 float k=psi*15.,lane=floor(k+.5);
 float s=P.x*2.6-t*.16+h12(vec2(lane,3.7))*TAU;
 return rules(k,w)*(.38+.62*pow(.5+.5*sin(s),5.));
}
#else
// MTH141, planes and transforms: a lattice that shears as the page scrolls, basis vectors e1 and e2 at each
// major node (e2 leans with the shear), magnified under the pointer like a local change of basis.
float motif(vec2 p,float t,float w){
 vec2 d=p-uPtr.xy,P=p-d*exp(-dot(d,d)*18.)*uPtr.z*.22+vec2(0.,-uScroll*.2)+uPan*.4;
 float sh=.26*sin(uScroll*.85+t*.035)+uVel*.42,an=-.12+.04*sin(t*.027);
 vec2 g=mat2(cos(an),sin(an),-sin(an),cos(an))*P;g.x+=sh*g.y;g*=7.;
 float m=max(rules(g.x,w*.8),rules(g.y,w*.8))*.4;
 m=max(m,max(rules(g.x*.25,w),rules(g.y*.25,w))*.72);
 vec2 l=g-4.*floor(g*.25+.5);
 float px=max(length(fwidth(g)),1e-5)*.7071;
 float e=min(length(vec2(l.x-clamp(l.x,0.,1.),l.y)),length(vec2(l.x,l.y-clamp(l.y,0.,1.))))/px;
 m=max(m,1.-smoothstep(w*.9,w*.9+1.,e));
 return max(m,1.-smoothstep(w*1.7,w*1.7+1.,length(l)/px));
}
#endif
void main(){
 vec2 fc=gl_FragCoord.xy,uv=fc/uRes,p=(fc-.5*uRes)/uRes.y;
 float t=uTime,w=max(.75,1.2*uScale);
 // A fine pointer bends the field: a soft swirl and lens that trail the cursor.
 vec2 d=p-uPtr.xy;float lens=exp(-dot(d,d)*13.)*uPtr.z,a0=lens*.7,cs=cos(a0),sn=sin(a0);
 vec2 q=uPtr.xy+mat2(cs,sn,-sn,cs)*d*(1.-lens*.12);
 // Field space drifts at a fraction of the page's scroll for depth, stretches with scroll speed, pans per view.
 vec2 F=(q+vec2(0.,-uScroll*.18))*1.3+uPan;F.y*=1.+abs(uVel)*.16;
 float tt=t*.04;
 vec2 a=vec2(fbm(F+vec2(0.,tt),3),fbm(F+vec2(5.2,1.3)-vec2(tt*.7,0.),3));
 vec2 b=vec2(fbm(F+3.*a+vec2(1.7,9.2)+tt*.5,2),fbm(F+3.*a+vec2(8.3,2.8)-tt*.4,2));
 float n=fbm(F+(2.4+uPulse*.8+abs(uVel)*.6)*b,3);
 float v=clamp(.5+n*1.3,0.,1.);v=v*v*(3.-2.*v);v=min(1.,v+lens*.28);
 float fold=clamp(length(b)*1.4,0.,1.);
 // Readability: quieter through the middle where text is read, a vignette toward the corners.
 float quiet=smoothstep(.1,.62,length((uv-.5)*vec2(uRes.x/uRes.y,1.)));
 float vig=smoothstep(.7,1.45,length((uv-.5)*2.));
 float af=uAmt.x*(.15+.85*v)*mix(.6,1.,quiet)*(1.-vig*.55*(1.-uAmt.w))*(1.+uPulse*.35);
 vec3 cf=mix(uTint,uInk,fold*mix(.15,.35,uAmt.w));
 // The course motif surfaces where the field is bright and fades where it is dim.
 float al=uAmt.y*motif(p,t,w)*(.3+.7*smoothstep(.15,.75,v))*mix(.55,1.,quiet)*(1.-vig*.6);
 // Composite back to front in premultiplied alpha: vignette shade, field, lines.
 vec4 c=vec4(0.,0.,0.,uAmt.z*vig);
 c=vec4(cf*af,af)+c*(1.-af);
 c=vec4(uInk*al,al)+c*(1.-al);
 // Dither so long, low-contrast gradients never band.
 c+=(h12(fc+fract(t*7.31)*91.7)-.5)/255.;
 c=clamp(c,0.,1.);c.rgb=min(c.rgb,vec3(c.a));
 outColor=c;
}`;

let started=false,root=null,canvas=null,gl=null,prog=null,U={},ro=null,heroIO=null,heroEl=null,kit=null,offAmbient=null,offTier=null;
let running=false,lost=false,calm=false,heroDominant=false,fps=60,cw=1,ch=1;
let time=0,speed=0,speedGoal=0,settleBy=0,last=0,acc=0,lastActive=0;
let sy=0,scroll=0,vel=0,velN=0,pulse=0,pres=0,presGoal=0;
const ptr=[0,0],ptrGoal=[0,0],pan=[0,0],panGoal=[0,0];
let colors={tint:[.73,.87,.79],ink:[.8,.9,.85],amt:[.16,.095,.26,1]};

/* Read-only snapshot for verification; nothing is written to the DOM per frame. */
export const state=()=>({field:root?.dataset.field||'none',running,fps,buffer:canvas?[canvas.width,canvas.height]:null,hero:heroDominant,calm});

export async function mount(){
 if(started)return;started=true;
 try{
  root=document.createElement('div');root.className='ns-bd';root.setAttribute('aria-hidden','true');root.dataset.field='off';
  root.innerHTML='<div class="ns-bd-aurora"><i></i><i></i><i></i></div><div class="ns-bd-grain"></div>';
  document.body.append(root); // outside .course-workspace: its perspective would capture position:fixed
  lastActive=performance.now();
  // Each day opens on its own composition; reloads within a day match.
  time=17+Math.floor(Date.now()/864e5)%41*2.9;
  if(atLeast('mid'))await field();
 }catch(error){console.warn('Night Shift backdrop:',error);teardown();}
}

/* ---- Field setup: no WebGL2, a software-only context or a failed compile all leave the aurora in charge. ---- */
async function field(){
 canvas=document.createElement('canvas');canvas.className='ns-bd-field';
 try{gl=canvas.getContext('webgl2',{alpha:true,premultipliedAlpha:true,antialias:false,depth:false,stencil:false,preserveDrawingBuffer:false,powerPreference:'low-power',failIfMajorPerformanceCaveat:true});}catch{gl=null;}
 if(!gl){canvas=null;return;}
 canvas.addEventListener('webglcontextlost',onLost,false);canvas.addEventListener('webglcontextrestored',onRestored,false);
 root.insertBefore(canvas,root.lastElementChild);
 // Watchdog downgrades apply live: high to mid lowers rate and resolution, mid to low removes the canvas.
 offTier=onTier(next=>{try{if(next==='low'){teardown();return;}fps=next==='high'?60:30;root.dataset.fps=fps;fit();}catch{}});
 fps=atLeast('high')?60:30;root.dataset.fps=fps;
 if(!await build()){if(!lost)teardown();return;} // a context lost mid-compile resumes from onRestored
 await wire();
}
/* Everything after the first good compile, once: first frame, observers, inputs, then the shared ticker. */
let wired=false;
async function wire(){
 if(wired)return;wired=true;
 recolor(false);measure();
 root.dataset.field='still';
 ro=new ResizeObserver(([entry])=>{try{const box=entry.contentRect;if(!box.width||!box.height)return;cw=box.width;ch=box.height;fit();}catch{}});ro.observe(canvas);
 listen();watchHero();
 try{kit=await vendor();}catch{return;} // without the shared ticker the field stays a still frame
 if(gl)offAmbient=onAmbient(decide);
}

async function build(){
 const g=gl;if(!g)return false;
 const shader=(type,src)=>{const s=g.createShader(type);g.shaderSource(s,src);g.compileShader(s);return s;};
 const vs=shader(g.VERTEX_SHADER,VERT),fs=shader(g.FRAGMENT_SHADER,FRAG),p=g.createProgram();
 g.attachShader(p,vs);g.attachShader(p,fs);g.linkProgram(p);
 // Some drivers take tens of ms to compile; where the extension exists, wait for it off the main thread.
 const ext=g.getExtension('KHR_parallel_shader_compile');
 for(const until=performance.now()+5000;ext&&!g.isContextLost()&&!g.getProgramParameter(p,ext.COMPLETION_STATUS_KHR)&&performance.now()<until;)await new Promise(r=>setTimeout(r,50));
 if(g!==gl||g.isContextLost())return false;
 if(!g.getProgramParameter(p,g.LINK_STATUS)){console.warn('Night Shift backdrop shader:',g.getShaderInfoLog(fs)||g.getProgramInfoLog(p));g.deleteProgram(p);g.deleteShader(vs);g.deleteShader(fs);return false;}
 g.detachShader(p,vs);g.detachShader(p,fs);g.deleteShader(vs);g.deleteShader(fs);
 U={};for(const name of UNIFORMS)U[name]=g.getUniformLocation(p,name);
 g.useProgram(p);g.bindVertexArray(g.createVertexArray());g.disable(g.BLEND);g.disable(g.DEPTH_TEST);
 prog=p;return true;
}

/* ---- Size: about 0.6 MP at most on high (never above 1 buffer px per CSS px), half DPR within 0.3 MP on mid.
   Resizing clears the buffer, so a new size always repaints at once, running or not. ---- */
function measure(){cw=Math.max(1,canvas.clientWidth||innerWidth);ch=Math.max(1,canvas.clientHeight||innerHeight);sy=scrollY;scroll=sy/ch;fit(true);}
function fit(force){
 if(!gl||!canvas||!wired)return; // sizes are only known once wired
 const dpr=devicePixelRatio||1,area=cw*ch;
 const s=tier()==='high'?Math.min(dpr,1,Math.sqrt(BUDGET.high/area)):Math.min(dpr*.5,Math.sqrt(BUDGET.mid/area));
 const w=Math.max(2,Math.round(cw*s)),h=Math.max(2,Math.round(ch*s));
 if(w!==canvas.width||h!==canvas.height){canvas.width=w;canvas.height=h;root.dataset.buffer=w+'x'+h;force=true;}
 if(force)draw();
}

function draw(){
 if(!gl||!prog||lost)return;
 const g=gl,w=canvas.width,h=canvas.height;
 g.viewport(0,0,w,h);
 g.uniform2f(U.uRes,w,h);g.uniform2f(U.uPan,pan[0],pan[1]);
 g.uniform1f(U.uTime,time);g.uniform1f(U.uScroll,scroll);g.uniform1f(U.uVel,velN);g.uniform1f(U.uPulse,pulse);g.uniform1f(U.uScale,w/cw);
 g.uniform3f(U.uPtr,ptr[0],ptr[1],pres);g.uniform3fv(U.uTint,colors.tint);g.uniform3fv(U.uInk,colors.ink);g.uniform4fv(U.uAmt,colors.amt);
 g.drawArrays(g.TRIANGLES,0,3);
}

/* ---- Colour comes from the live tokens. Graphite: the accent glows, lines are a lifted accent, corners shade.
   Paper: the pastel accent tints, lines take the course's readable ink, no shading. ---- */
let swatch=null;
function rgb(value){
 const m=/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/.exec(value||'');
 if(m)return [m[1]/255,m[2]/255,m[3]/255];
 try{ // color(), oklab() and friends: a 1 px 2D canvas resolves them to sRGB bytes
  if(!swatch){const c=document.createElement('canvas');c.width=c.height=1;swatch=c.getContext('2d',{willReadFrequently:true});}
  swatch.clearRect(0,0,1,1);swatch.fillStyle='#000';swatch.fillStyle=value;swatch.fillRect(0,0,1,1);
  const d=swatch.getImageData(0,0,1,1).data;return [d[0]/255,d[1]/255,d[2]/255];
 }catch{return null;}
}
function recolor(paint=true){
 if(!root)return;
 const probe=document.createElement('i');probe.style.cssText='position:absolute;visibility:hidden';root.append(probe);
 const read=(name,fallback)=>{probe.style.color=fallback;probe.style.color=`var(${name},${fallback})`;return rgb(getComputedStyle(probe).color)||rgb(fallback)||[.5,.5,.5];};
 const bg=read('--hub-bg','#0f1619'),accent=read('--accent',META.accent),strong=read('--strong',META.strong),ink=read('--hub-ink','#eef0ea');
 probe.remove();
 const dark=.2126*bg[0]+.7152*bg[1]+.0722*bg[2]<.4;
 colors={tint:accent,ink:dark?accent.map((c,i)=>c+(ink[i]-c)*.3):strong,amt:dark?[.16,.095,.26,1]:[.22,.075,0,0]};
 if(paint)draw(); // a still field repaints in the same frame as the theme switch
}

/* ---- Inputs only set targets; the frame eases toward them. Any input marks the visitor active. ---- */
function listen(){
 const opt={passive:true},wake=()=>{lastActive=performance.now();};
 addEventListener('pointermove',e=>{try{
  wake();if(e.pointerType==='touch'||!finePointer.matches)return;
  ptrGoal[0]=(e.clientX-cw/2)/ch;ptrGoal[1]=(ch/2-e.clientY)/ch;
  if(pres<.02){ptr[0]=ptrGoal[0];ptr[1]=ptrGoal[1];} // appear where the pointer is, never sweep in from the last spot
  presGoal=1;
 }catch{}},opt);
 document.addEventListener('pointerout',e=>{if(!e.relatedTarget)presGoal=0;},opt);
 addEventListener('blur',()=>{presGoal=0;});
 for(const type of ['scroll','wheel','keydown','touchstart'])addEventListener(type,wake,opt);
 // Feedback, not ambience: a completion swells the field once; a view change pans across it (and turns the gears).
 document.addEventListener('guide-completion',()=>{if(running)pulse=1;});
 document.addEventListener('workspace-changed',e=>{try{
  const i=Math.max(0,VIEWS.indexOf(e.detail));panGoal[0]=i*.9;panGoal[1]=-i*.3;
  if(running)pulse=Math.max(pulse,.45);
  if(heroEl&&!heroEl.isConnected)watchHero();
 }catch{}});
 const theme=()=>{try{recolor();}catch{}};
 new MutationObserver(theme).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
 try{matchMedia('(prefers-color-scheme: dark)').addEventListener('change',theme);}catch{}
}

/* The hero carries the motion while it fills most of the screen; the field rests until coursework takes over. */
function watchHero(){
 heroIO?.disconnect();heroIO=null;heroDominant=false;
 heroEl=document.querySelector('.header-upgraded');if(!heroEl||!gl)return;
 const r=heroEl.getBoundingClientRect(),seen=Math.max(0,Math.min(r.bottom,innerHeight)-Math.max(r.top,0));
 heroDominant=r.height>0&&seen/r.height>=HERO;
 heroIO=new IntersectionObserver(entries=>{try{const e=entries[entries.length-1];heroDominant=e.isIntersecting&&e.intersectionRatio>=HERO;decide();}catch{}},{threshold:[0,.25,HERO,.8,1]});
 heroIO.observe(heroEl);
}

/* ---- Run or rest. A hidden tab, reduced motion or a hold (a palette or sheet opening over the page) stop at once;
   the saved pause and the hero let the field glide to rest first (under a second). Either way it leaves the ticker
   and keeps its last frame. ---- */
function decide(){
 if(!gl||!prog||lost||!kit)return;
 if(ambientAllowed()&&!heroDominant){
  speedGoal=1;settleBy=0;
  if(!running){running=true;last=0;acc=1e3/fps;sy=scrollY;kit.gsap.ticker.add(frame);root.dataset.field='live';}
  return;
 }
 if(!running)return;
 if(document.hidden||!motionAllowed()||held())halt();
 else if(speedGoal){speedGoal=0;settleBy=performance.now()+900;}
}
function halt(){
 if(running){kit?.gsap.ticker.remove(frame);running=false;}
 speedGoal=0;if(root&&gl&&!lost)root.dataset.field='still';
}

/* One clock: the shared ticker. The frame cap lives here (60 on high, 30 on mid), never on the ticker itself.
   While the visitor reads, the near-still drift renders at half that rate; any input restores it. */
function frame(){
 try{
  const now=performance.now(),interval=1e3/(calm?fps/2:fps);
  if(last)acc+=now-last;last=now;
  if(acc+1.5<interval)return;
  const dt=Math.min(.1,acc/1e3);acc=Math.min(Math.max(0,acc-interval),interval);
  step(dt,now);draw();
  if(!speedGoal&&(speed<.006||now>settleBy))halt();
 }catch(error){console.warn('Night Shift backdrop:',error);teardown();}
}

/* Frame-rate independent exponential easing (an expo-out approach to every target). */
function step(dt,now){
 const ease=k=>1-Math.exp(-dt*k);
 const idle=now-lastActive>IDLE;
 if(idle!==calm){calm=idle;root.toggleAttribute('data-calm',calm);}
 if(speedGoal)speedGoal=calm?CALM:1;
 // Wakes over about 1.5 s, settles in about 0.6 s.
 speed+=(speedGoal-speed)*ease(speedGoal>speed?1.5:4);
 // Scroll: the position glides (parallax depth); velocity in viewports per second, soft-clipped to +-1.
 const y=scrollY;vel+=((y-sy)/ch/Math.max(dt,.004)-vel)*ease(6);sy=y;
 const v=vel*.7;velN=v/(1+Math.abs(v));
 scroll+=(y/ch-scroll)*ease(8);
 time+=dt*speed*(1+Math.min(1.5,Math.abs(vel))*.6);
 // The pointer lens trails the cursor and dims while the visitor reads.
 const goal=calm?presGoal*.35:presGoal;pres+=(goal-pres)*ease(goal>pres?2.4:1.4);
 const k=ease(4.5);ptr[0]+=(ptrGoal[0]-ptr[0])*k;ptr[1]+=(ptrGoal[1]-ptr[1])*k;
 const kp=ease(1.7);pan[0]+=(panGoal[0]-pan[0])*kp;pan[1]+=(panGoal[1]-pan[1])*kp;
 pulse*=Math.exp(-dt*1.8);
}

/* ---- Context loss keeps the aurora in view; a restore rebuilds and repaints. ---- */
function onLost(e){
 e.preventDefault();lost=true;prog=null;
 if(running){kit?.gsap.ticker.remove(frame);running=false;}
 if(root)root.dataset.field='lost';
}
async function onRestored(){
 try{
  lost=false;if(!await build()){if(!lost)teardown();return;}
  if(!wired){await wire();return;}
  fit(true);root.dataset.field='still';decide();
 }catch{teardown();}
}

/* Removes the field for good (low tier, failure): fade to the aurora, then free the GPU context. */
function teardown(){
 if(running){kit?.gsap.ticker.remove(frame);running=false;}
 offAmbient?.();offAmbient=null;offTier?.();offTier=null;ro?.disconnect();ro=null;heroIO?.disconnect();heroIO=null;
 const c=canvas,g=gl;canvas=gl=prog=null;lost=false;
 if(root)root.dataset.field='off';
 if(!c)return;
 c.removeEventListener('webglcontextlost',onLost);c.removeEventListener('webglcontextrestored',onRestored);
 setTimeout(()=>{try{g?.getExtension('WEBGL_lose_context')?.loseContext();}catch{}c.remove();},motionAllowed()?900:0);
}
