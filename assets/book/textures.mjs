/* Semester book textures (semester-book spec §5.4, plan §6). Side A owns this module.

   Everything printed on the book is a runtime CanvasTexture painted from describeSpread() views, never baked
   copy. Page faces and tag labels are ink MASKS, not colours: each canvas is black, painted additively
   ('lighter') in pure channels — R pencil, G printed ink, B accent ink — with NoColorSpace, mipmaps and
   anisotropy. The page shader composites paper → pencil → ink → accent from uniforms, so a theme change is a
   uniform tween and repaints nothing.

   Repaint signature: faceId | style.id | bucket (+ compact) | fontsGen | poster | view.signature. Theme is
   not part of it. Data, section, completion, target, minute and midnight changes reach the faces only through
   the view's signature (book-state setWeeks → engine refresh()).

   Pure painters (exported for tests and the capture page): paintVerso, paintRecto, paintRiffle, paintLabel,
   paintStamp, plus the height-map builders paperTooth, linenWeave and heightToNormal. The manager,
   createBookTextures(), owns caches, the canvas pool, scheduling and picking regions.

   Face ids: 'L<i>' is the verso of spread i (the back of sheet i − 1; 'L0' is printed on the endpaper and
   'endpaper' is accepted as its alias), 'R<i>' the recto of spread i (the front of sheet i), 'riffle' the shared
   generic face of intermediate riffle sheets. Canvas y = 0 is the head (flipY true); a verso canvas has the
   gutter on its right, a recto on its left (the engine mirrors u on sheet backs). */
import {layoutSpread,PAGE} from './popup.mjs';
import * as T from '../app/three.mjs?v=20261013-stage1';

/* ------------------------------------------------------------------ constants ------------------------- */

export const PAGE_ASPECT=1.451;
export const BUCKETS=Object.freeze([512,768,1024]);
export const PAGE_SIZES=Object.freeze({512:[512,743],768:[768,1114],1024:[1024,1486]});
export const TIER=Object.freeze({
 high:Object.freeze({maxBucket:1024,lru:6,anisotropy:8,atlas:[1280,960],tooth:256,linen:512,cover:1024}),
 mid:Object.freeze({maxBucket:768,lru:4,anisotropy:4,atlas:[768,576],tooth:256,linen:256,cover:512})
});
export const COMPACT_CSS_PX=260;
export const POOL=4;
export const ATLAS_SLOTS=Object.freeze({cols:2,rows:4});
/* Grid at 1024 px wide (§5.4); everything scales with the canvas. */
export const GRID=Object.freeze({w:1024,h:1486,outer:88,head:96,tail:112,gutter:136});
export const MIN_INFO_PX=28;

/* MTH140 sketchbook style (Stage 2). Stage 4 courses add their own; the id is part of every signature. */
export const MTH140_STYLE=Object.freeze({
 id:'sketchbook-1',course:'mth140',runningHead:'MTH140 · Calculus I · Fall 2026',coverLine:'MTH140 · Calculus I · Fall 2026',spineLine:'MTH140',
 topics:Object.freeze(['Functions & graphs','Limits & continuity','Derivatives I','Integration I','Derivatives II','Integration II','Applications of derivatives','Applications of integrals'])
});

const CHIP_TEXT=Object.freeze({NEXT:'Next',SOON:'Soon',NOW:'Now',DONE:'Completed',PASSED:null});
const clamp=(v,lo,hi)=>Math.min(hi,Math.max(lo,v));
const lerp=(a,b,t)=>a+(b-a)*t;

/* Pure-channel fills. Coverage ∈ [0, 1] → one channel; nothing else ever touches a mask. */
export const CHANNELS=Object.freeze({R:0,G:1,B:2});
export function channel(name,coverage=1){
 const v=Math.round(clamp(coverage,0,1)*255),rgb=[0,0,0];rgb[CHANNELS[name]]=v;
 return `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
}

/* ------------------------------------------------------------------ randomness ------------------------ */

export function seeded(seed){
 let a=(Number(seed)>>>0)||0x9e3779b9;
 return ()=>{a=a+0x6d2b79f5>>>0;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};
}
function hashString(text){let h=0x811c9dc5;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,0x01000193)>>>0;}return h;}
/* Smooth 1D value noise in [−1, 1] from an integer hash: no tables, no allocation per stroke. */
function lattice(i,seed){let h=Math.imul(i^Math.imul(seed,0x9e3779b1),0x85ebca6b);h^=h>>>13;h=Math.imul(h,0xc2b2ae35);h^=h>>>16;return (h>>>0)/2147483648-1;}
function noise1(seed){
 const s=seed|0;
 return x=>{const i=Math.floor(x),f=x-i,u=f*f*(3-2*f),a=lattice(i,s),b=lattice(i+1,s);return a+(b-a)*u;};
}

/* ------------------------------------------------------------------ type ------------------------------ */

const FAMILY='Archivo';
/* Condensed support is decided once per context by measurement (§5.4): the condensed face must be < 0.92 × the
   normal width, otherwise normal width at 0.86 × size stands in. */
const condensedCache=new WeakMap();
function condensedWorks(ctx){
 if(condensedCache.has(ctx))return condensedCache.get(ctx);
 let ok=false;
 try{
  ctx.save();
  setFont(ctx,{size:96,weight:600,condensed:false,probe:true});
  const normal=ctx.measureText('0123456789 Midterm').width;
  setFont(ctx,{size:96,weight:600,condensed:true,probe:true});
  const narrow=ctx.measureText('0123456789 Midterm').width;
  ok=normal>0&&narrow<.92*normal;
  ctx.restore();
 }catch{ok=false;}
 condensedCache.set(ctx,ok);
 return ok;
}
function setFont(ctx,{size,weight=600,condensed=false,probe=false}){
 let px=size,stretch=condensed;
 if(condensed&&!probe&&!condensedWorks(ctx)){stretch=false;px=size*.86;}
 ctx.font=`${stretch?'condensed ':''}${weight} ${px.toFixed(2)}px ${FAMILY}, "Archivo", system-ui, sans-serif`;
 if('fontStretch' in ctx)try{ctx.fontStretch=stretch?'condensed':'normal';}catch{}
 return px;
}
const hasSpacing=ctx=>'letterSpacing' in ctx;
/* Measure with tracking (em). Manual advance when the context lacks letterSpacing. */
function textWidth(ctx,text,px,tracking){
 if(!tracking)return ctx.measureText(text).width;
 if(hasSpacing(ctx)){ctx.letterSpacing=`${(tracking*px).toFixed(2)}px`;const w=ctx.measureText(text).width;ctx.letterSpacing='0px';return w-tracking*px;}
 let w=0;for(const ch of text)w+=ctx.measureText(ch).width+tracking*px;return w-tracking*px;
}

/* One text run. y is the baseline. Records what was printed (role, size, channel, box) for picking and tests.
   roles: 'info' (informational, ≥ 28 px), 'label' (caps labels and chips), 'folio' (decorative). */
function text(ctx,rec,str,x,y,o){
 const value=o.caps?String(str).toUpperCase():String(str);
 if(!value)return 0;
 const px=setFont(ctx,o),tracking=o.tracking||0,w=textWidth(ctx,value,px,tracking);
 const left=o.align==='right'?x-w:o.align==='center'?x-w/2:x;
 ctx.fillStyle=channel(o.channel||'G',o.coverage??1);
 ctx.textAlign='left';ctx.textBaseline='alphabetic';
 if(!tracking)ctx.fillText(value,left,y);
 else if(hasSpacing(ctx)){ctx.letterSpacing=`${(tracking*px).toFixed(2)}px`;ctx.fillText(value,left,y);ctx.letterSpacing='0px';}
 else{let cx=left;for(const ch of value){ctx.fillText(ch,cx,y);cx+=ctx.measureText(ch).width+tracking*px;}}
 rec?.texts.push({text:value,size:px,role:o.role||'info',channel:o.channel||'G',x0:left,x1:left+w,y0:y-px*.74,y1:y+px*.22});
 return w;
}
const measure=(ctx,str,o)=>{const px=setFont(ctx,o);return textWidth(ctx,o.caps?String(str).toUpperCase():String(str),px,o.tracking||0);};
/* Largest size in [min, size] that fits maxWidth (step 2 px). */
function fitSize(ctx,str,o,maxWidth,min){
 for(let s=o.size;s>=min;s-=2)if(measure(ctx,str,{...o,size:s})<=maxWidth)return s;
 return min;
}
/* Wrap on spaces. Two lines are balanced (the break that minimises the longer line, preferring a break right
   after a " · " separator), so a resolver phrase never leaves an orphan; longer text falls back to greedy. */
function wrap(ctx,str,o,maxWidth,maxLines=2){
 const words=String(str).split(' ');
 if(words.length<2)return [String(str)];
 if(maxLines===2){
  const full=measure(ctx,str,o);let best=null;
  for(let i=1;i<words.length;i++){
   const a=words.slice(0,i).join(' '),b=words.slice(i).join(' '),wa=measure(ctx,a,o),wb=measure(ctx,b,o);
   if(wa>maxWidth||wb>maxWidth)continue;
   const score=Math.max(wa,wb)-(words[i-1]==='·'?.18*full:0)+(words[i]==='·'?.5*full:0);
   if(!best||score<best.score)best={score,lines:[a,b]};
  }
  if(best)return best.lines;
 }
 const lines=[];let line='';
 for(const word of words){
  const next=line?`${line} ${word}`:word;
  if(!line||measure(ctx,next,o)<=maxWidth)line=next;
  else{lines.push(line);line=word;}
 }
 if(line)lines.push(line);
 if(lines.length<=maxLines)return lines;
 const kept=lines.slice(0,maxLines);kept[maxLines-1]=lines.slice(maxLines-1).join(' ');
 return kept;
}
/* Fit one informational line: shrink to min, then wrap to two lines at the smallest size that fits. */
function fitLines(ctx,str,o,maxWidth,min=MIN_INFO_PX){
 const size=fitSize(ctx,str,o,maxWidth,min);
 if(measure(ctx,str,{...o,size})<=maxWidth)return {size,lines:[str]};
 for(let s=Math.max(min,Math.min(o.size,size+6));s>=min;s-=2){const lines=wrap(ctx,str,{...o,size:s},maxWidth);if(lines.every(l=>measure(ctx,l,{...o,size:s})<=maxWidth))return {size:s,lines};}
 return {size:min,lines:wrap(ctx,str,{...o,size:min},maxWidth)};
}

/* ------------------------------------------------------------------ pencil ---------------------------- */

/* A graphite stroke: resampled every 3 px, a low-frequency jitter of 0.6 px per 40 px along the normal, a
   12 px pressure taper at both ends, drawn twice 0.4 px apart (each pass at 55% so the overlap reads as the
   stroke's coverage and the edges stay soft). Filled as one outline polygon per pass. */
export function pencil(ctx,points,{seed=1,width=2.5,coverage=.85,taper=12,jitter=.6,period=40,passes=2,ch='R'}={}){
 if(points.length<2)return;
 const pts=resample(points,3);if(pts.length<2)return;
 const total=pts[pts.length-1][2];
 for(let pass=0;pass<passes;pass++){
  const n=noise1(seed*7+pass*131),offset=pass?.4:0,left=[],right=[];
  for(let i=0;i<pts.length;i++){
   const [x,y,s]=pts[i],a=pts[Math.max(0,i-1)],b=pts[Math.min(pts.length-1,i+1)];
   let tx=b[0]-a[0],ty=b[1]-a[1];const l=Math.hypot(tx,ty)||1;tx/=l;ty/=l;
   const nx=-ty,ny=tx,j=jitter*n(s/period)+offset;
   const press=Math.pow(clamp(Math.min(s,total-s)/Math.max(1e-6,taper),0,1),.7);
   const hw=Math.max(.15,width*.5*(.35+.65*press));
   const cx=x+nx*j,cy=y+ny*j;
   left.push([cx+nx*hw,cy+ny*hw]);right.push([cx-nx*hw,cy-ny*hw]);
  }
  ctx.fillStyle=channel(ch,coverage*(passes>1?.55:1));
  ctx.beginPath();ctx.moveTo(left[0][0],left[0][1]);
  for(let i=1;i<left.length;i++)ctx.lineTo(left[i][0],left[i][1]);
  for(let i=right.length-1;i>=0;i--)ctx.lineTo(right[i][0],right[i][1]);
  ctx.closePath();ctx.fill();
 }
}
function resample(points,step){
 const out=[[points[0][0],points[0][1],0]];let s=0,carry=0;
 for(let i=1;i<points.length;i++){
  const [x0,y0]=points[i-1],[x1,y1]=points[i],d=Math.hypot(x1-x0,y1-y0);if(d<1e-9)continue;
  let t=step-carry;
  while(t<=d){out.push([x0+(x1-x0)*t/d,y0+(y1-y0)*t/d,s+t]);t+=step;}
  carry=d-(t-step);s+=d;
 }
 const last=points[points.length-1];
 if(Math.hypot(last[0]-out[out.length-1][0],last[1]-out[out.length-1][1])>.5)out.push([last[0],last[1],s]);
 return out;
}
const line=(x0,y0,x1,y1,n=2)=>Array.from({length:n},(_,i)=>[x0+(x1-x0)*i/(n-1),y0+(y1-y0)*i/(n-1)]);
const curve=(f,x0,x1,n=80)=>Array.from({length:n+1},(_,i)=>{const x=x0+(x1-x0)*i/n;return [x,f(x)];});
/* Dashed pencil: short strokes along a polyline. */
function dashed(ctx,points,o,dash=14,gap=10){
 const pts=resample(points,2);let run=[],on=true,acc=0;
 for(let i=0;i<pts.length;i++){
  const d=i?Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]):0;acc+=d;
  if(on)run.push(pts[i]);
  if(on&&acc>=dash){if(run.length>1)pencil(ctx,run,{...o,taper:3,passes:1,seed:(o.seed||1)+i});run=[];on=false;acc=0;}
  else if(!on&&acc>=gap){on=true;acc=0;run=[pts[i]];}
 }
 if(on&&run.length>1)pencil(ctx,run,{...o,taper:3,passes:1});
}
/* Parallel hatching clipped to spans(y) → [[x0, x1], …], across the box {x0, y0, x1, y1}. One stroked path per
   call (lighter compositing never double-counts inside one path), lines slightly wavering like a hand. */
function hatch(ctx,spans,{x0=0,x1=GRID.w,y0,y1,spacing=9,angle=-.9,coverage=.25,seed=3,width=1.1}){
 const n=noise1(seed*13+5),dx=Math.cos(angle),dy=Math.sin(angle),nx=-dy,ny=dx,memo=new Map();
 const at=y=>{const key=Math.round(y);let v=memo.get(key);if(!v){v=spans(key);memo.set(key,v);}return v;};
 const cx=(x0+x1)/2,cy=(y0+y1)/2,reach=Math.hypot(x1-x0,y1-y0)/2+spacing;
 ctx.strokeStyle=channel('R',coverage);ctx.lineWidth=width;ctx.lineCap='round';
 ctx.beginPath();
 for(let k=-reach,line=0;k<=reach;k+=spacing,line++){
  let down=false,lo=-reach,hi=reach;
  // Clip the line to the box (slabs) so only its visible stretch is sampled.
  const ox=cx+nx*k,oy=cy+ny*k;
  for(const [o,d,a,b] of [[ox,dx,x0,x1],[oy,dy,y0,y1]]){
   if(Math.abs(d)<1e-9){if(o<a||o>b){lo=1;hi=0;}continue;}
   const t0=(a-o)/d,t1=(b-o)/d;lo=Math.max(lo,Math.min(t0,t1));hi=Math.min(hi,Math.max(t0,t1));
  }
  for(let t=lo;t<=hi;t+=3.5){
   const wob=.5*n(line*3.1+t/50),x=cx+nx*k+dx*t+nx*wob,y=cy+ny*k+dy*t+ny*wob;
   const inside=y>=y0&&y<=y1&&at(y).some(([a,b])=>x>=a&&x<=b);
   if(inside){if(down)ctx.lineTo(x,y);else{ctx.moveTo(x,y);down=true;}}
   else down=false;
  }
 }
 ctx.stroke();
}
/* Wobbly ellipse in two passes (today's ring). */
function ring(ctx,cx,cy,rx,ry,{seed=5,width=2.5,coverage=.9,ch='B'}={}){
 const rand=seeded(seed);
 for(let pass=0;pass<2;pass++){
  const start=rand()*Math.PI*2,turn=Math.PI*2*(1.06+.04*pass),pts=[];
  for(let i=0;i<=72;i++){const a=start+turn*i/72,w=1+.035*Math.sin(a*3+pass*2+rand()*.2);pts.push([cx+Math.cos(a)*rx*w,cy+Math.sin(a)*ry*w]);}
  pencil(ctx,pts,{seed:seed+pass,width,coverage:coverage*.75,ch,passes:1,taper:10});
 }
}

/* ------------------------------------------------------------------ motifs ---------------------------- */
/* Each motif is drawn into the box {x, y, w, h} (canvas units, y down), seeded by spread index, never labelled. */
const MAIN={width:3.2,coverage:.9},CONSTRUCT={width:1.6,coverage:.4},FAINT={width:1.3,coverage:.28};
function axes(ctx,b,seed,{ox=.1,oy=.86}={}){
 const x0=b.x+b.w*ox,y0=b.y+b.h*oy;
 pencil(ctx,line(b.x+b.w*.04,y0,b.x+b.w*.97,y0+2,6),{...CONSTRUCT,seed});
 pencil(ctx,line(x0,b.y+b.h*.97,x0-1,b.y+b.h*.05,6),{...CONSTRUCT,seed:seed+1});
 return {x0,y0};
}
const motifs={
 // Graph with asymptote
 0(ctx,b,s){const {y0}=axes(ctx,b,s),ax=b.x+b.w*.58,ay=b.y+b.h*.34;
  dashed(ctx,line(ax,b.y+b.h*.04,ax,b.y+b.h*.96,8),{...CONSTRUCT,seed:s+2});
  dashed(ctx,line(b.x+b.w*.06,ay,b.x+b.w*.96,ay,8),{...CONSTRUCT,seed:s+3});
  const k=b.w*b.h*.012;
  pencil(ctx,curve(x=>ay+k/(x-ax),b.x+b.w*.08,ax-b.w*.035),{...MAIN,seed:s+4});
  pencil(ctx,curve(x=>ay+k/(x-ax),ax+b.w*.03,b.x+b.w*.95),{...MAIN,seed:s+5});
  void y0;},
 // Secant fan converging to a tangent
 1(ctx,b,s){axes(ctx,b,s);const f=x=>b.y+b.h*.82-b.h*.62*Math.sin((x-b.x)/b.w*Math.PI*.9)**1.4;
  pencil(ctx,curve(f,b.x+b.w*.08,b.x+b.w*.94),{...MAIN,seed:s+2});
  const px=b.x+b.w*.36,py=f(px),slope=(f(px+.5)-f(px-.5));
  for(const [i,q] of [.88,.74,.62,.52].entries()){const qx=b.x+b.w*q,qy=f(qx),m=(qy-py)/(qx-px);
   pencil(ctx,line(px-b.w*.2,py-m*b.w*.2,qx+b.w*.05,qy+m*b.w*.05,4),{...CONSTRUCT,coverage:.28+.05*i,seed:s+3+i});
   pencil(ctx,[[qx-3,qy],[qx+3,qy]],{...FAINT,seed:s+9+i});}
  pencil(ctx,line(px-b.w*.26,py-slope*b.w*.26,px+b.w*.42,py+slope*b.w*.42,4),{...MAIN,width:2.4,seed:s+14});
  ring(ctx,px,py,7,7,{seed:s+15,ch:'R',width:2,coverage:.8});},
 // Curve, tangent and right triangle
 2(ctx,b,s){axes(ctx,b,s);const f=x=>{const u=(x-b.x)/b.w;return b.y+b.h*(.86-.7*(u*u*(1.6-u)));};
  pencil(ctx,curve(f,b.x+b.w*.08,b.x+b.w*.95),{...MAIN,seed:s+2});
  const px=b.x+b.w*.48,py=f(px),m=(f(px+.5)-f(px-.5)),run=b.w*.24;
  pencil(ctx,line(px-b.w*.32,py-m*b.w*.32,px+b.w*.36,py+m*b.w*.36,4),{...MAIN,width:2.2,seed:s+3});
  pencil(ctx,line(px,py,px+run,py,3),{...CONSTRUCT,coverage:.55,seed:s+4});
  pencil(ctx,line(px+run,py,px+run,py+m*run,3),{...CONSTRUCT,coverage:.55,seed:s+5});
  pencil(ctx,[[px+run-12,py],[px+run-12,py-12],[px+run,py-12]],{...FAINT,seed:s+6});
  ring(ctx,px,py,6,6,{seed:s+7,ch:'R',width:2,coverage:.8});},
 // Hatched Riemann rectangles
 3(ctx,b,s){const {y0}=axes(ctx,b,s);const f=x=>{const u=(x-b.x)/b.w;return b.y+b.h*(.72-.42*Math.sin(u*Math.PI*1.1+.2));};
  const n=7,a=b.x+b.w*.16,c=b.x+b.w*.88,dw=(c-a)/n;
  for(let i=0;i<n;i++){const x0=a+i*dw,x1=x0+dw,top=f(x0+dw/2);
   pencil(ctx,[[x0,y0],[x0,top],[x1,top],[x1,y0]],{...CONSTRUCT,coverage:.5,seed:s+10+i,taper:4});
   hatch(ctx,()=>[[x0+2,x1-2]],{x0,x1,y0:top+2,y1:y0-1,spacing:11,coverage:.22,seed:s+20+i});}
  pencil(ctx,curve(f,b.x+b.w*.08,b.x+b.w*.95),{...MAIN,seed:s+2});},
 // Composed curves with an arrow
 4(ctx,b,s){axes(ctx,b,s);
  const g=x=>{const u=(x-b.x)/b.w;return b.y+b.h*(.78-.3*u);},f=x=>{const u=(x-b.x)/b.w;return b.y+b.h*(.5-.28*Math.sin(u*Math.PI*2.2));};
  pencil(ctx,curve(g,b.x+b.w*.08,b.x+b.w*.92),{...CONSTRUCT,coverage:.55,width:2,seed:s+2});
  pencil(ctx,curve(f,b.x+b.w*.08,b.x+b.w*.94),{...MAIN,seed:s+3});
  const sx=b.x+b.w*.3,sy=g(sx)-8,ex=b.x+b.w*.52,ey=f(ex)+10,arc=[];
  for(let i=0;i<=24;i++){const t=i/24;arc.push([lerp(sx,ex,t),lerp(sy,ey,t)-Math.sin(t*Math.PI)*b.h*.12]);}
  pencil(ctx,arc,{...MAIN,width:2,coverage:.7,seed:s+4});
  const dx=ex-arc[22][0],dy=ey-arc[22][1],l=Math.hypot(dx,dy)||1,ux=dx/l,uy=dy/l;
  pencil(ctx,[[ex-ux*16-uy*8,ey-uy*16+ux*8],[ex,ey],[ex-ux*16+uy*8,ey-uy*16-ux*8]],{...MAIN,width:2,coverage:.7,seed:s+5,taper:5});},
 // Shaded area between curves
 5(ctx,b,s){axes(ctx,b,s);const top=x=>{const u=(x-b.x)/b.w;return b.y+b.h*(.62-.42*Math.sin(u*Math.PI));},bot=x=>{const u=(x-b.x)/b.w;return b.y+b.h*(.76-.2*u*u);};
  const a=b.x+b.w*.16,c=b.x+b.w*.86;
  hatch(ctx,y=>{const out=[];let inside=false,start=0;for(let x=a;x<=c;x+=3){const ok=y>=top(x)&&y<=bot(x);if(ok&&!inside){inside=true;start=x;}if(!ok&&inside){inside=false;out.push([start,x]);}}if(inside)out.push([start,c]);return out;},{x0:a,x1:c,y0:b.y,y1:b.y+b.h,spacing:10,coverage:.24,seed:s+9});
  pencil(ctx,curve(top,b.x+b.w*.06,b.x+b.w*.95),{...MAIN,seed:s+2});
  pencil(ctx,curve(bot,b.x+b.w*.06,b.x+b.w*.95),{...MAIN,width:2.2,coverage:.7,seed:s+3});
  dashed(ctx,line(a,top(a),a,bot(a),3),{...CONSTRUCT,seed:s+4});dashed(ctx,line(c,top(c),c,bot(c),3),{...CONSTRUCT,seed:s+5});},
 // Max/min with horizontal tangent dashes
 6(ctx,b,s){axes(ctx,b,s);const f=x=>{const u=(x-b.x)/b.w;return b.y+b.h*(.5-.3*Math.sin(u*Math.PI*1.8-.4));};
  pencil(ctx,curve(f,b.x+b.w*.06,b.x+b.w*.95),{...MAIN,seed:s+2});
  for(const [i,u] of [((.5+.4/Math.PI)/1.8),((1.5+.4/Math.PI)/1.8)].entries()){const x=b.x+b.w*u,y=f(x);
   dashed(ctx,line(x-b.w*.13,y,x+b.w*.13,y,4),{...MAIN,width:2,coverage:.6,seed:s+3+i},12,8);
   ring(ctx,x,y,6,6,{seed:s+7+i,ch:'R',width:2,coverage:.8});
   dashed(ctx,line(x,y+10,x,b.y+b.h*.86,4),{...FAINT,seed:s+9+i});}},
 // Solid of revolution
 7(ctx,b,s){const ay=b.y+b.h*.55;pencil(ctx,line(b.x+b.w*.04,ay,b.x+b.w*.97,ay,6),{...CONSTRUCT,seed:s});
  const r=x=>{const u=(x-b.x)/b.w;return b.h*(.08+.3*Math.sqrt(Math.max(0,u-.08)));};
  const a=b.x+b.w*.12,c=b.x+b.w*.86;
  pencil(ctx,curve(x=>ay-r(x),a,c),{...MAIN,seed:s+2});
  dashed(ctx,curve(x=>ay+r(x),a,c,40),{...CONSTRUCT,coverage:.45,seed:s+3});
  for(const [i,u] of [.3,.55,.8].entries()){const x=lerp(a,c,u),ry=r(x),rx=ry*.28,pts=[];
   for(let k=0;k<=48;k++){const t=k/48*Math.PI*2;pts.push([x+Math.cos(t)*rx,ay+Math.sin(t)*ry]);}
   pencil(ctx,pts,{...CONSTRUCT,coverage:.4,seed:s+4+i,taper:6});}
  const end=[];for(let k=0;k<=48;k++){const t=k/48*Math.PI*2;end.push([c+Math.cos(t)*r(c)*.28,ay+Math.sin(t)*r(c)]);}
  pencil(ctx,end,{...MAIN,width:2.2,coverage:.7,seed:s+9,taper:6});},
 // Hero: tangent on a crest (pending spread and posters)
 hero(ctx,b,s){const {y0}=axes(ctx,b,s,{ox:.06,oy:.9});const f=x=>{const u=(x-b.x)/b.w;return b.y+b.h*(.6-.36*Math.sin(u*Math.PI*1.25+.25)+.06*Math.sin(u*9));};
  pencil(ctx,curve(f,b.x+b.w*.06,b.x+b.w*.96,120),{...MAIN,width:3,seed:s+2});
  let cx=b.x,cy=Infinity;for(let x=b.x+b.w*.1;x<b.x+b.w*.9;x+=1){const y=f(x);if(y<cy){cy=y;cx=x;}}
  pencil(ctx,line(cx-b.w*.24,cy,cx+b.w*.24,cy+1,4),{...MAIN,width:2.2,coverage:.7,seed:s+3});
  dashed(ctx,line(cx,cy+12,cx,y0,6),{...CONSTRUCT,seed:s+4});
  ring(ctx,cx,cy,7,7,{seed:s+5,ch:'R',width:2.2,coverage:.85});
  hatch(ctx,y=>{const out=[];let inside=false,start=0;const a=cx-b.w*.18,c=cx+b.w*.18;for(let x=a;x<=c;x+=3){const ok=y>=f(x)+6&&y<=y0-2;if(ok&&!inside){inside=true;start=x;}if(!ok&&inside){inside=false;out.push([start,x]);}}if(inside)out.push([start,c]);return out;},{x0:cx-b.w*.18,x1:cx+b.w*.18,y0:cy,y1:y0,spacing:12,coverage:.16,seed:s+6});}
};
export const motifFor=(index,{pending=false,poster=false,topics=MTH140_STYLE.topics}={})=>pending||poster?'hero':Math.min(7,Math.floor(index/2))%Math.max(1,Math.min(8,topics.length));

/* ------------------------------------------------------------------ page faces ------------------------ */

const newRecord=()=>({texts:[],regions:[]});
function begin(ctx,width,height){
 ctx.setTransform(1,0,0,1,0,0);
 ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;
 ctx.fillStyle='rgb(0,0,0)';ctx.fillRect(0,0,width,height);
 const k=width/GRID.w;
 ctx.setTransform(k,0,0,k,0,0);
 ctx.globalCompositeOperation='lighter';
 ctx.lineCap='round';ctx.lineJoin='round';
 return {k,h:height/k};
}
function region(rec,kind,x0,y0,x1,y1,extra={},w=GRID.w,h=GRID.h){
 rec.regions.push({kind,x0:x0/w,y0:y0/h,x1:x1/w,y1:y1/h,...extra});
}
/* Keep-out (§5.4): text stays clear of the pop-up feet. Limits in 1024-wide units. */
export function keepOut(view){
 const aMax=view?layoutSpread(view).aMax:.24*PAGE.W;
 return {aMax,versoRight:GRID.w*(1-aMax/PAGE.W-.02),rectoLeft:GRID.w*(aMax/PAGE.W+.02)};
}
function rule(ctx,x0,x1,y,seed,coverage=.4){pencil(ctx,line(x0,y,x1,y+.5,6),{width:1.5,coverage,seed,passes:1,taper:18});}

const verso=(view,o)=>({
 left:GRID.outer,right:Math.min(GRID.w-GRID.gutter,o.keep.versoRight),seed:(view?.index??0)*97+11
});

/* Verso: "the week" — kicker, numeral, range, note, the 7-day ledger, folio. */
export function paintVerso(ctx,view,{width=1024,height=1486,compact=false,poster=false,style=MTH140_STYLE}={}){
 const rec=newRecord(),{h}=begin(ctx,width,height),keep=keepOut(poster?null:view),g=verso(view,{keep});
 const tail=h-GRID.tail;
 if(poster){
  // Ink 0: the week's skeleton in pencil only — ledger rules, the date column, a guide where the numeral and
  // range sit — and no words or numbers, so a poster never goes stale.
  for(let i=0;i<=7;i++)rule(ctx,g.left,g.right,560+106*i,g.seed+i,.46);
  pencil(ctx,line(ROW.dateRight+14,548,ROW.dateRight+15,1314,6),{...CONSTRUCT,coverage:.3,seed:g.seed+39});
  pencil(ctx,line(g.left,376,g.left+300,377,4),{...CONSTRUCT,coverage:.4,seed:g.seed+40});
  pencil(ctx,line(g.left,452,g.left+330,452,4),{...CONSTRUCT,coverage:.3,seed:g.seed+41});
  pencil(ctx,line(g.left,500,g.left+200,500,4),{...FAINT,seed:g.seed+42});
  return rec;
 }
 if(compact)return paintVersoCompact(ctx,view,rec,g,h);
 text(ctx,rec,view.kicker,g.left,96+19,{size:26,weight:600,caps:true,tracking:.22,channel:'B',role:'label'});
 if(view.pending){
  const fit=fitSize(ctx,view.range,{size:120,weight:600,condensed:true},g.right-g.left,60);
  text(ctx,rec,view.range,g.left,330,{size:fit,weight:600,condensed:true,tracking:-.02,channel:'G'});
  if(view.note)text(ctx,rec,view.note,g.left,400,{size:30,weight:500,channel:'G',coverage:.7});
  pendingList(ctx,rec,view,g);
 }else{
  const nw=text(ctx,rec,view.numeral,g.left-6,360,{size:300,weight:600,condensed:true,tracking:-.04,channel:'G'});
  text(ctx,rec,`/ ${view.of}`,g.left+nw+14,360,{size:72,weight:500,condensed:true,channel:'G',coverage:.45});
  const rangeSize=fitSize(ctx,view.range,{size:44,weight:600},g.right-g.left,32);
  text(ctx,rec,view.range,g.left,430+31,{size:rangeSize,weight:600,channel:'G'});
  if(view.note)text(ctx,rec,view.note,g.left,482+21,{size:30,weight:500,channel:'G',coverage:.7});
  ledger(ctx,rec,view,g);
 }
 text(ctx,rec,view.folio?.verso??'',g.left,tail+56,{size:22,weight:600,caps:true,tracking:.16,channel:'G',coverage:.45,role:'folio'});
 corners(rec,'verso',h);
 return rec;
}
function paintVersoCompact(ctx,view,rec,g,h){
 text(ctx,rec,view.kicker,g.left,130,{size:48,weight:600,caps:true,tracking:.18,channel:'B',role:'label'});
 if(view.pending){
  text(ctx,rec,'Date',g.left,420,{size:150,weight:600,condensed:true,channel:'G'});
  text(ctx,rec,'pending',g.left,560,{size:150,weight:600,condensed:true,channel:'G'});
 }else{
  const size=fitSize(ctx,view.numeral,{size:520,weight:600,condensed:true,tracking:-.04},g.right-g.left+10,300);
  text(ctx,rec,view.numeral,g.left-8,620,{size,weight:600,condensed:true,tracking:-.04,channel:'G'});
  const [a,b]=String(view.range).split(' – ');
  const o={size:72,weight:600,channel:'G'},fit=fitSize(ctx,a.length>(b||'').length?a:b||a,o,g.right-g.left,48);
  text(ctx,rec,b?`${a} –`:a,g.left,780,{...o,size:fit});
  if(b)text(ctx,rec,b,g.left,780+fit*1.2,{...o,size:fit});
 }
 corners(rec,'verso',h);
 return rec;
}
const ROW={top:560,h:106,dateRight:184,entry:212};
function ledger(ctx,rec,view,g){
 const rows=view.days||[];
 rule(ctx,g.left,g.right,ROW.top,g.seed);
 const byDay=new Map(),braced=(view.entries||[]).some(e=>e.bracket);
 for(const e of view.entries||[])if(e.day&&!e.bracket){if(!byDay.has(e.day))byDay.set(e.day,[]);byDay.get(e.day).push(e);}
 rows.forEach((day,i)=>{
  const top=ROW.top+ROW.h*i,bottom=top+ROW.h,dim=day.outside?.5:1;
  text(ctx,rec,day.dow,g.left,top+33,{size:24,weight:600,caps:true,tracking:.16,channel:'G',coverage:.6*dim,role:'label'});
  text(ctx,rec,day.dom,ROW.dateRight,top+90,{size:64,weight:600,condensed:true,channel:'G',coverage:dim,align:'right'});
  if(day.today){
   ring(ctx,ROW.dateRight-30,top+67,50,31,{seed:g.seed+i*3,width:2.5});
   text(ctx,rec,'Today',g.right,top+30,{size:20,weight:600,caps:true,tracking:.18,channel:'B',align:'right',role:'label'});
  }
  if(day.outside){
   hatch(ctx,()=>[[g.left-4,g.right]],{x0:g.left-4,x1:g.right,y0:top+6,y1:bottom-6,spacing:12,coverage:.25,seed:g.seed+50+i});
   if(day.mark)text(ctx,rec,day.mark,ROW.entry,top+66,{size:28,weight:500,channel:'G',coverage:.5});
  }
  const own=byDay.get(day.date)||[];
  if(own.length)entryRow(ctx,rec,own,top,g,i);
  // Inside a quiz-week bracket the weekday rules stop at the bracket, which groups Mon–Fri as one span.
  rule(ctx,g.left,braced&&i<4&&!byDay.has(day.date)?ROW.entry-14:g.right,bottom,g.seed+i+1);
 });
 const bracket=(view.entries||[]).filter(e=>e.bracket);
 if(bracket.length)bracketEntries(ctx,rec,bracket,rows,byDay,g);
}
function entryRow(ctx,rec,entries,top,g,i){
 const e=entries[0],max=g.right-ROW.entry,titleText=entries.map(x=>x.title).join(' · ');
 const titleSize=fitSize(ctx,titleText,{size:32,weight:600},max,MIN_INFO_PX);
 const tw=text(ctx,rec,titleText,ROW.entry,top+48,{size:titleSize,weight:600,channel:'G'});
 if(e.completed)strike(ctx,ROW.entry,ROW.entry+Math.min(tw,max),top+38,g.seed+i);
 if(e.chip&&e.chip!=='DONE'&&e.chip!=='PASSED')dot(ctx,ROW.entry-16,top+37,6.5,'B');
 const second=secondary(e);
 if(second){const f=fitLines(ctx,second,{size:28,weight:500},max);text(ctx,rec,f.lines.join(' '),ROW.entry,top+84,{size:f.size,weight:500,channel:'G',coverage:.75});}
 for(const x of entries)region(rec,'item',ROW.entry-24,top+4,g.right,top+ROW.h-4,{id:x.id,open:x.open});
}
/* rowWhen as the resolver gave it; a date without a time adds the resolver's own label ("Time not posted"). */
function secondary(e){
 if(e.passed&&!e.completed&&e.status)return [e.rowWhen,e.status].filter(Boolean).join(' · ');
 if(e.precision==='day'&&e.label&&e.rowWhen!==e.label)return [e.rowWhen,e.label].filter(Boolean).join(' · ');
 return e.rowWhen||null;
}
function bracketEntries(ctx,rec,entries,rows,byDay,g){
 // A pencil bracket over Mon–Fri in accent ink, with the title and `when` in the first free weekday rows.
 const first=0,last=Math.min(4,rows.length-1),top=ROW.top+ROW.h*first+14,bottom=ROW.top+ROW.h*(last+1)-14,x=ROW.entry-6;
 pencil(ctx,[[x+12,top],[x+1,top+7],[x,(top+bottom)/2],[x+1,bottom-7],[x+12,bottom]],{width:2.4,coverage:.85,ch:'B',seed:g.seed+77,taper:6});
 const free=rows.slice(first,last+1).map((d,i)=>byDay.has(d.date)?-1:i).filter(i=>i>=0);
 let slot=free.length?free[0]:0;
 for(const e of entries){
  const rowTop=ROW.top+ROW.h*slot,tx=ROW.entry+40,max=g.right-tx;
  const title=fitSize(ctx,e.title,{size:32,weight:600},max,MIN_INFO_PX);
  const tw=text(ctx,rec,e.title,tx,rowTop+48,{size:title,weight:600,channel:'G'});
  if(e.completed)strike(ctx,tx,tx+tw,rowTop+38,g.seed+slot);
  if(e.chip&&e.chip!=='DONE'&&e.chip!=='PASSED')dot(ctx,tx-17,rowTop+37,6.5,'B');
  const f=fitLines(ctx,e.passed&&e.status?e.status:e.when,{size:28,weight:500},max);
  f.lines.forEach((l,k)=>text(ctx,rec,l,tx,rowTop+84+k*(f.size+6),{size:f.size,weight:500,channel:'G',coverage:.75}));
  region(rec,'item',ROW.entry-24,top-8,g.right,bottom+8,{id:e.id,open:e.open});
  slot=Math.min(last,slot+1+(f.lines.length>1?1:0));
 }
}
function pendingList(ctx,rec,view,g){
 let y=ROW.top;
 rule(ctx,g.left,g.right,y,g.seed);
 for(const [i,e] of (view.entries||[]).entries()){
  text(ctx,rec,e.kindLabel,g.left,y+40,{size:22,weight:600,caps:true,tracking:.2,channel:'B',role:'label'});
  const max=g.right-g.left,ts=fitSize(ctx,e.title,{size:48,weight:600,condensed:true},max,32);
  text(ctx,rec,e.title,g.left,y+96,{size:ts,weight:600,condensed:true,channel:'G'});
  const f=fitLines(ctx,[e.when,e.label].filter(Boolean).join(' · '),{size:30,weight:500},max);
  f.lines.forEach((l,k)=>text(ctx,rec,l,g.left,y+140+k*(f.size+8),{size:f.size,weight:500,channel:'G',coverage:.75}));
  const bottom=y+170+(f.lines.length-1)*(f.size+8);
  region(rec,'item',g.left,y+8,g.right,bottom,{id:e.id,open:e.open});
  y=bottom+12;rule(ctx,g.left,g.right,y,g.seed+i+1);
 }
}
const strike=(ctx,x0,x1,y,seed)=>pencil(ctx,line(x0-6,y+2,x1+6,y-3,5),{width:2.6,coverage:.8,seed,taper:8});
function dot(ctx,x,y,r,ch){ctx.fillStyle=channel(ch,1);ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();}
function check(ctx,x,y,s,seed){pencil(ctx,[[x,y],[x+s*.35,y+s*.38],[x+s,y-s*.5]],{width:3,coverage:.9,ch:'B',seed,taper:6});}
function corners(rec,side,h){
 const cw=GRID.w*.12,ch=h*.12,x0=side==='verso'?0:GRID.w-cw;
 region(rec,'corner',x0,0,x0+cw,ch,{},GRID.w,h);
 region(rec,'corner',x0,h-ch,x0+cw,h,{},GRID.w,h);
}

/* Recto: "the sketch and the work" — running head, pencil motif, ON THESE PAGES, entries, folio. */
export function paintRecto(ctx,view,{width=1024,height=1486,compact=false,poster=false,style=MTH140_STYLE}={}){
 const rec=newRecord(),{h}=begin(ctx,width,height),keep=keepOut(poster?null:view);
 const right=GRID.w-GRID.outer,left=Math.max(GRID.gutter,keep.rectoLeft),seed=(view?.index??0)*131+7,tail=h-GRID.tail;
 const motif=motifFor(view?.index??0,{pending:view?.pending,poster,topics:style.topics});
 if(poster){
  motifs.hero(ctx,{x:GRID.gutter,y:200,w:800,h:640},seed);
  for(let i=0;i<4;i++)rule(ctx,left,right,960+132*i,seed+60+i,.3);
  return rec;
 }
 if(compact){
  motifs[motif](ctx,{x:GRID.gutter,y:150,w:800,h:760},seed);
  const ids=new Set(view.popups||[]);let y=1040;
  for(const e of (view.entries||[]).filter(x=>ids.has(x.id))){
   const s=fitSize(ctx,e.kindLabel,{size:88,weight:600,caps:true,tracking:.06},right-left,56);
   const w=text(ctx,rec,e.kindLabel,left,y,{size:s,weight:600,caps:true,tracking:.06,channel:e.chip&&!e.completed?'B':'G',role:'info'});
   if(e.completed)strike(ctx,left,left+w,y-s*.36,seed);
   region(rec,'item',left,y-s,right,y+16,{id:e.id,open:e.open});
   y+=s*1.18;
  }
  corners(rec,'recto',h);
  return rec;
 }
 text(ctx,rec,style.runningHead,right,96+16,{size:fitSize(ctx,style.runningHead,{size:22,weight:600,caps:true,tracking:.2},right-left,18),weight:600,caps:true,tracking:.2,channel:'G',coverage:.55,align:'right',role:'folio'});
 // Lay the entries out first, bottom-up if they need more room, then give the sketch what is left.
 const blocks=(view.entries||[]).slice(0,3).map(e=>entryBlock(ctx,e,right-left));
 const extra=view.moreLabel?44:0,empty=!blocks.length;
 const need=blocks.reduce((n,b)=>n+b.height,0)+extra;
 let headY=860;
 const floor=tail-24;
 if(headY+40+need>floor)headY=Math.max(640,floor-need-40);
 const sketchBottom=empty?headY+120:headY-80;
 motifs[motif](ctx,{x:GRID.gutter,y:150,w:800,h:sketchBottom-150},seed);
 if(empty){
  text(ctx,rec,view.empty||'Nothing scheduled',left,headY+140,{size:32,weight:500,channel:'G',coverage:.6});
 }else{
  text(ctx,rec,'On these pages',left,headY+17,{size:24,weight:600,caps:true,tracking:.2,channel:'B',role:'label'});
  let y=headY+40;
  for(const [i,b] of blocks.entries()){drawEntry(ctx,rec,b,left,right,y,seed+i);y+=b.height;}
  if(view.moreLabel)text(ctx,rec,view.moreLabel,left,y+30,{size:28,weight:500,channel:'G',coverage:.6});
 }
 text(ctx,rec,view.folio?.recto??'',right,tail+56,{size:22,weight:600,caps:true,tracking:.16,channel:'G',coverage:.45,align:'right',role:'folio'});
 corners(rec,'recto',h);
 return rec;
}
function entryBlock(ctx,e,max){
 const titleSize=fitSize(ctx,e.title,{size:40,weight:600,condensed:true},max,32);
 const second=e.passed&&!e.completed&&e.status?[e.when,e.status]:[e.when,e.label];
 const meta=fitLines(ctx,second.filter(Boolean).join(' · '),{size:30,weight:500},max);
 const cta=!e.completed&&e.cta?fitLines(ctx,e.cta,{size:28,weight:600},max):null;
 const height=110+(meta.lines.length-1)*(meta.size+6)+(cta?cta.lines.length*(cta.size+8)+4:0)+22;
 return {e,titleSize,meta,cta,height};
}
function drawEntry(ctx,rec,b,left,right,y,seed){
 const {e}=b;
 text(ctx,rec,e.kindLabel,left,y+16,{size:22,weight:600,caps:true,tracking:.2,channel:'B',role:'label'});
 const chip=CHIP_TEXT[e.chip];
 if(chip&&e.chip!=='DONE')text(ctx,rec,chip,right,y+16,{size:22,weight:600,caps:true,tracking:.18,channel:'B',align:'right',role:'label'});
 if(e.completed){
  const w=text(ctx,rec,chip||'Completed',right,y+16,{size:22,weight:600,caps:true,tracking:.18,channel:'B',align:'right',role:'label'});
  check(ctx,right-w-34,y+12,22,seed);
 }
 const tw=text(ctx,rec,e.title,left,y+62,{size:b.titleSize,weight:600,condensed:true,channel:'G'});
 if(e.completed)strike(ctx,left,left+tw,y+48,seed);
 let ly=y+100;
 for(const l of b.meta.lines){text(ctx,rec,l,left,ly,{size:b.meta.size,weight:500,channel:'G',coverage:.75});ly+=b.meta.size+6;}
 if(b.cta)for(const l of b.cta.lines){ly+=4;text(ctx,rec,l,left,ly+2,{size:b.cta.size,weight:600,channel:'B'});ly+=b.cta.size+4;}
 region(rec,'item',left-12,y-8,right,y+b.height-12,{id:e.id,open:e.open});
 rule(ctx,left,right,y+b.height-10,seed+30,.22);
}

/* The riffle face: paper and generic pencil only (intermediate sheets of a long jump). */
export function paintRiffle(ctx,{width=1024,height=1486}={}){
 const rec=newRecord(),{h}=begin(ctx,width,height),seed=4242;
 for(let i=0;i<=7;i++)rule(ctx,GRID.outer,GRID.w-GRID.gutter,560+106*i,seed+i,.28);
 pencil(ctx,curve(x=>420+120*Math.sin((x-140)/150),160,880,60),{...CONSTRUCT,coverage:.3,seed:seed+20});
 void h;return rec;
}

/* ------------------------------------------------------------------ labels and stamp ------------------ */

/* One tag label inside its atlas slot (§5.4 "Label slot"), in a sub-rect of the tag's aspect so type is never
   stretched on the plate. rect = {x, y, w, h} in canvas px; scale s = rect.h / 240. Returns the record. */
export function paintLabel(ctx,entry,rect,{aspect=2.5}={}){
 const rec=newRecord(),s=rect.h/240,inner=Math.min(rect.w,Math.round(rect.h*aspect)),x0=rect.x+(rect.w-inner)/2;
 ctx.setTransform(1,0,0,1,0,0);ctx.globalCompositeOperation='source-over';
 ctx.fillStyle='rgb(0,0,0)';ctx.fillRect(rect.x,rect.y,rect.w,rect.h);
 ctx.globalCompositeOperation='lighter';
 ctx.setTransform(s,0,0,s,x0,rect.y);
 const W=inner/s,pad=30,max=W-pad*2;
 const chip=CHIP_TEXT[entry.chip];
 let chipW=0;
 if(chip)chipW=text(ctx,rec,chip,W-pad,54,{size:22,weight:600,caps:true,tracking:.18,channel:'B',align:'right',role:'label'});
 const titleSize=fitSize(ctx,entry.title,{size:60,weight:600,condensed:true},max-(chip?0:0),44);
 text(ctx,rec,entry.title,pad,chip?118:104,{size:titleSize,weight:600,condensed:true,channel:'G'});
 const second=entry.passed&&!entry.completed&&entry.status?entry.status:entry.when;
 if(second){
  const f=fitLines(ctx,second,{size:40,weight:500},max,MIN_INFO_PX);
  const y=f.lines.length>1?(chip?162:152):(chip?178:168);
  f.lines.forEach((l,k)=>text(ctx,rec,l,pad,y+k*(f.size+8),{size:f.size,weight:500,channel:'G',coverage:.75}));
 }
 ctx.setTransform(1,0,0,1,0,0);
 void chipW;
 return rec;
}
/* The DONE stamp: a double ring and a check, inked unevenly; coverage in R. */
export function paintStamp(ctx,size=256){
 ctx.setTransform(1,0,0,1,0,0);ctx.globalCompositeOperation='source-over';
 ctx.fillStyle='rgb(0,0,0)';ctx.fillRect(0,0,size,size);
 ctx.globalCompositeOperation='lighter';
 const k=size/256;ctx.setTransform(k,0,0,k,0,0);
 const rand=seeded(9001);
 for(const [r,w] of [[112,7],[96,3]]){
  const pts=[];for(let i=0;i<=120;i++){const a=i/120*Math.PI*2.04;pts.push([128+Math.cos(a)*r*(1+(rand()-.5)*.012),128+Math.sin(a)*r*(1+(rand()-.5)*.012)]);}
  pencil(ctx,pts,{width:w,coverage:1,seed:r,passes:2,taper:2,jitter:.8});
 }
 pencil(ctx,[[78,132],[113,168],[182,90]],{width:15,coverage:1,seed:77,passes:2,taper:10,jitter:1});
 // Uneven ink: knock out specks.
 ctx.globalCompositeOperation='destination-out';ctx.fillStyle='rgb(0,0,0)';
 for(let i=0;i<260;i++){const x=rand()*256,y=rand()*256,r=.6+rand()*1.6;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();}
 ctx.globalCompositeOperation='source-over';ctx.setTransform(1,0,0,1,0,0);
}

/* ------------------------------------------------------------------ height and normal maps ------------ */

/* Height → tangent-space normal map (RGBA8, NoColorSpace), central differences, optional wrap. Rows are in GL
   order (row 0 = v 0, the bottom), as DataTexture uploads them; +x is u, +y is v (OpenGL green). */
export function heightToNormal(height,w,h,{strength=1,wrap=true}={}){
 const out=new Uint8Array(w*h*4),at=(x,y)=>{
  if(wrap){x=(x+w)%w;y=(y+h)%h;}else{x=clamp(x,0,w-1);y=clamp(y,0,h-1);}
  return height[y*w+x];
 };
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const dx=(at(x+1,y)-at(x-1,y))*strength,dy=(at(x,y+1)-at(x,y-1))*strength;
  let nx=-dx,ny=-dy,nz=1;const l=Math.hypot(nx,ny,nz);nx/=l;ny/=l;nz/=l;
  const i=(y*w+x)*4;out[i]=Math.round((nx*.5+.5)*255);out[i+1]=Math.round((ny*.5+.5)*255);out[i+2]=Math.round((nz*.5+.5)*255);out[i+3]=255;
 }
 return out;
}
/* Paper tooth: seeded tileable value noise in three octaves (±2% low-frequency variation lives in the shader). */
export function paperTooth(size=256,seed=1){
 const h=new Float32Array(size*size),rand=seeded(seed);
 for(const [cells,amp] of [[8,.45],[32,.35],[96,.2]]){
  const grid=Array.from({length:cells*cells},()=>rand());
  const g=(i,j)=>grid[((j+cells)%cells)*cells+((i+cells)%cells)];
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
   const fx=x/size*cells,fy=y/size*cells,i=Math.floor(fx),j=Math.floor(fy),u=fx-i,v=fy-j,su=u*u*(3-2*u),sv=v*v*(3-2*v);
   h[y*size+x]+=amp*lerp(lerp(g(i,j),g(i+1,j),su),lerp(g(i,j+1),g(i+1,j+1),su),sv);
  }
 }
 return {height:h,normal:heightToNormal(h,size,size,{strength:2.2})};
}
/* Linen: plain weave, `threads` warp and weft threads per tile, per-thread slub thickness, fibre noise.
   Returns the normal map and a roughness map (G channel, mean 0.92, ±0.067 → material.roughness 0.89 gives
   the spec's 0.82 ± 0.06). */
export function linenWeave(size=512,threads=32,seed=2){
 const h=new Float32Array(size*size),rough=new Uint8Array(size*size*4),rand=seeded(seed),pitch=size/threads;
 const warp=Array.from({length:threads},()=>.8+rand()*.4),weft=Array.from({length:threads},()=>.8+rand()*.4);
 const fibre=Array.from({length:size*size},()=>rand());
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const i=Math.floor(x/pitch),j=Math.floor(y/pitch),u=(x%pitch)/pitch,v=(y%pitch)/pitch;
  const over=(i+j)%2===0;
  const across=over?Math.sin(u*Math.PI):Math.sin(v*Math.PI),along=over?Math.sin(v*Math.PI):Math.sin(u*Math.PI);
  const thick=over?warp[i]:weft[j];
  const value=thick*(Math.pow(across,.6)*(.65+.35*along))*(over?1:.92)+(fibre[y*size+x]-.5)*.06;
  h[y*size+x]=value;
  const r=Math.round(clamp(.92+(value-.6)*.11,.85,.99)*255),k=(y*size+x)*4;rough[k]=r;rough[k+1]=r;rough[k+2]=r;rough[k+3]=255;
 }
 return {height:h,normal:heightToNormal(h,size,size,{strength:3}),roughness:rough};
}
const LOGO_PATH='M8 15 17 10v21l-9 5zm12-1 12-6v21l-12 6zm-9-6 9-5 4 4-9 5z'; // assets/guide-mark.svg, 40 × 40
/* Blind deboss height canvas (white = surface, darker = pressed). kind 'cover' (148 × 212 mm board) or
   'spine' (16 × 212 mm). Needs a real 2D context with getImageData; returns null otherwise. */
export function paintDeboss(ctx,kind,width,height,style=MTH140_STYLE){
 if(typeof ctx.getImageData!=='function'||typeof Path2D!=='function')return null;
 const mm=kind==='spine'?width/16:width/148;
 ctx.setTransform(1,0,0,1,0,0);ctx.globalCompositeOperation='source-over';
 ctx.fillStyle='#fff';ctx.fillRect(0,0,width,height);
 ctx.fillStyle='#000';
 const logo=new Path2D(LOGO_PATH);
 if(kind==='cover'){
  const size=18*mm,x=width-12*mm-size,y=height-12*mm-size;
  ctx.save();ctx.translate(x,y);ctx.scale(size/40,size/40);ctx.fill(logo);ctx.restore();
  const px=setFont(ctx,{size:4*mm/.72,weight:600,condensed:true});
  const line=style.coverLine.toUpperCase();
  if('letterSpacing' in ctx)ctx.letterSpacing=`${(px*.12).toFixed(1)}px`;
  ctx.textBaseline='alphabetic';ctx.fillText(line,20*mm,height-12*mm-size*.18);
  if('letterSpacing' in ctx)ctx.letterSpacing='0px';
 }else{
  const size=10*mm;
  ctx.save();ctx.translate((width-size)/2,height-14*mm-size);ctx.scale(size/40,size/40);ctx.fill(logo);ctx.restore();
  ctx.save();ctx.translate(width/2,height-32*mm);ctx.rotate(-Math.PI/2);
  const px=setFont(ctx,{size:7*mm/.72,weight:600,condensed:true});void px;
  if('letterSpacing' in ctx)ctx.letterSpacing=`${(7*mm*.2).toFixed(1)}px`;
  ctx.textBaseline='middle';ctx.textAlign='left';ctx.fillText(style.spineLine.toUpperCase(),0,0);
  if('letterSpacing' in ctx)ctx.letterSpacing='0px';ctx.restore();
 }
 // Soft shoulders: a small blur when the context supports filters.
 const data=ctx.getImageData(0,0,width,height).data,hgt=new Float32Array(width*height);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++)hgt[(height-1-y)*width+x]=data[(y*width+x)*4]/255;
 const blurred=boxBlur(boxBlur(hgt,width,height,Math.max(1,Math.round(mm*.25))),width,height,Math.max(1,Math.round(mm*.25)));
 const rough=new Uint8Array(width*height*4);
 for(let i=0;i<width*height;i++){const v=Math.round((.84+.16*blurred[i])*255),k=i*4;rough[k]=v;rough[k+1]=v;rough[k+2]=v;rough[k+3]=255;}
 return {normal:heightToNormal(blurred,width,height,{strength:mm*.35,wrap:false}),roughness:rough};
}
function boxBlur(src,w,h,r){
 const out=new Float32Array(w*h),tmp=new Float32Array(w*h),n=2*r+1;
 for(let y=0;y<h;y++){let s=0;for(let x=-r;x<=r;x++)s+=src[y*w+clamp(x,0,w-1)];for(let x=0;x<w;x++){tmp[y*w+x]=s/n;s+=src[y*w+clamp(x+r+1,0,w-1)]-src[y*w+clamp(x-r,0,w-1)];}}
 for(let x=0;x<w;x++){let s=0;for(let y=-r;y<=r;y++)s+=tmp[clamp(y,0,h-1)*w+x];for(let y=0;y<h;y++){out[y*w+x]=s/n;s+=tmp[clamp(y+r+1,0,h-1)*w+x]-tmp[clamp(y-r,0,h-1)*w+x];}}
 return out;
}

/* ------------------------------------------------------------------ manager --------------------------- */

const FACE_ID=/^(L|R):?(\d+)$/;
export function parseFace(id){
 if(id==='riffle')return {id:'riffle',side:'riffle',index:-1};
 if(id==='endpaper')return {id:'L0',side:'L',index:0};
 const m=FACE_ID.exec(String(id));if(!m)throw new RangeError(`Unknown face id ${id}`);
 return {id:`${m[1]}${Number(m[2])}`,side:m[1],index:Number(m[2])};
}
/* Flat page coordinates → canvas uv for a face side: x is the distance from the spine (≥ 0, metres), y from the
   tail. u runs left → right on the canvas, v is GL-style (0 = tail). */
export function faceUV(side,x,y){
 const u=clamp(Math.abs(x)/PAGE.W,0,1),v=clamp(y/PAGE.H,0,1);
 return {u:side==='L'?1-u:u,v};
}
export function bucketFor(pageCssPx,dpr=1,tier='high'){
 const want=clamp((Number(pageCssPx)||0)*(Number(dpr)||1)*1.25,BUCKETS[0],BUCKETS[BUCKETS.length-1]);
 const cap=(TIER[tier]||TIER.mid).maxBucket;
 return Math.min(cap,BUCKETS.find(b=>b>=want)??cap);
}

const defaultCanvas=(w,h)=>{
 if(typeof OffscreenCanvas==='function'&&typeof document==='undefined')return new OffscreenCanvas(w,h);
 const c=document.createElement('canvas');c.width=w;c.height=h;return c;
};
const defaultIdle=(fn,timeout=300)=>{
 if(typeof requestIdleCallback==='function'){const id=requestIdleCallback(fn,{timeout});return()=>cancelIdleCallback(id);}
 const id=setTimeout(()=>fn({didTimeout:true,timeRemaining:()=>0}),16);return()=>clearTimeout(id);
};

/* createBookTextures(options) → BookTextures

   options: {
     getView(index) → SpreadView         B's describeSpread bound to live context (the engine's getView)
     tier = 'high' | 'mid'               sizes, LRU cap, anisotropy (setTier() later)
     renderer = null                     WebGLRenderer: anisotropy cap and initTexture() uploads in idle
     poster = false                      ink 0 faces, no words or numbers, hero motif (§5.11)
     style = MTH140_STYLE
     onChange = () => {}                 a face, label or map changed: the engine requests a frame
     createCanvas, idle, fonts           injectable for tests (defaults: DOM canvas, requestIdleCallback,
                                         document.fonts)
   }
   BookTextures = {
     ready: Promise                      fonts loaded (§5.4); paint after it for the first frame
     face(id) → CanvasTexture            stable texture for a face at the current bucket (painted if needed)
     paint(id) → CanvasTexture           paint now if its signature changed (first frame, cut mode)
     want(ids, { prefetch })             the live set: queue changed faces; prefetch ones go to idle time
     pump() → boolean                    call once per busy frame: paints at most one queued face
     refresh(indexes?)                   data changed: re-read views; repaint only changed signatures
     setScreen(pageCssPx, dpr)           picks the bucket and the compact variant; repaints lazily
     setTier(tier)
     labelSlot(entry, { aspect }) → { texture, rect: [u0, v0, u1, v1], aspect }   tag label (atlas)
     stamp() → CanvasTexture             the DONE stamp mask (R)
     paper() → { normal }                tooth normal map, RepeatWrapping (6 tiles per page)
     linen() → { normal, roughness }     RepeatWrapping tile (32 threads, 0.45 mm pitch → 14.4 mm tile)
     cover() / spine() → { normal, roughness } | null   blind deboss maps (browser only)
     hit(id, u, v) → { kind: 'item' | 'corner' | 'page', id?, open?, corner }       u canvas-left → right,
                                         v GL-style; regions recorded while painting
     hitFlat(id, x, y)                   same from flat page coordinates (metres from spine, from tail)
     signature(id), regions(id), stats(), dispose()
   } */
export function createBookTextures({getView,tier='high',renderer=null,poster=false,style=MTH140_STYLE,onChange=()=>{},
 createCanvas=defaultCanvas,idle=defaultIdle,fonts=(typeof document!=='undefined'?document.fonts:null)}={}){
 let level=TIER[tier]?tier:'mid',bucket=Math.min(1024,TIER[level].maxBucket),compact=false,fontsGen=0,disposed=false;
 const faces=new Map(),pool=[],queue={urgent:new Set(),idle:new Set()},labels=new Map(),uploads=new Set();
 const maps={};
 let atlas=null,stampTex=null,live=new Set(),cancelIdle=null,paints=0,labelPaints=0,clock=0;

 const maxAniso=()=>{try{return renderer?.capabilities?.getMaxAnisotropy?.()||1;}catch{return 1;}};
 const anisotropy=()=>Math.max(1,Math.min(TIER[level].anisotropy,maxAniso()));
 const size=()=>PAGE_SIZES[bucket];

 const ready=(async()=>{
  if(!fonts?.load)return;
  try{await Promise.all(['condensed 600 96px Archivo','600 40px Archivo','500 40px Archivo'].map(f=>fonts.load(f)));}catch{}
 })();
 const onFonts=()=>{fontsGen++;for(const f of faces.values())if(live.has(f.id))queue.idle.add(f.id);for(const l of labels.values())l.signature='';schedule();onChange();};
 fonts?.addEventListener?.('loadingdone',onFonts);

 function takeCanvas(w,h){
  const i=pool.findIndex(c=>c.width===w&&c.height===h);
  const c=i>=0?pool.splice(i,1)[0]:pool.length>=POOL?Object.assign(pool.shift(),{width:w,height:h}):createCanvas(w,h);
  return c;
 }
 function giveCanvas(c){if(!c||disposed){if(c){c.width=0;c.height=0;}return;}pool.push(c);while(pool.length>POOL){const x=pool.shift();x.width=0;x.height=0;}}
 function maskTexture(canvas){
  const t=new T.CanvasTexture(canvas);
  t.colorSpace=T.NoColorSpace;t.generateMipmaps=true;t.anisotropy=anisotropy();t.flipY=true;
  return t;
 }
 function viewFor(f){
  if(f.side==='riffle')return null;
  try{return getView?.(f.index)??null;}catch(error){console.warn('Book view unavailable',error);return null;}
 }
 function signatureOf(f,view){
  return [f.id,style.id,bucket,compact?'c':'',fontsGen,poster?'p':'',f.side==='riffle'?'riffle':view?.signature??'none'].join('|');
 }
 function record(id){
  const parsed=parseFace(id);
  let f=faces.get(parsed.id);
  if(!f){
   const [w,h]=size(),canvas=takeCanvas(w,h),ctx=canvas.getContext('2d',{alpha:false});
   ctx.setTransform(1,0,0,1,0,0);ctx.globalCompositeOperation='source-over';ctx.fillStyle='rgb(0,0,0)';ctx.fillRect(0,0,w,h);
   f={...parsed,bucket,canvas,ctx,texture:null,signature:'',regions:[],texts:[],used:++clock};
   f.texture=newFaceTexture(f,canvas);
   faces.set(f.id,f);
  }
  f.used=++clock;
  return f;
 }
 function newFaceTexture(f,canvas){
  const t=maskTexture(canvas);t.name=`book-face-${f.id}`;t.onUpdate=()=>releaseAfterUpload(f,t);return t;
 }
 function releaseAfterUpload(f,t){
  // The GPU copy is all the face needs until its next repaint; return the canvas to the pool.
  if(!renderer||disposed||f.texture!==t||!f.canvas||t.image!==f.canvas)return;
  const c=f.canvas;f.canvas=null;f.ctx=null;
  t.image={width:c.width,height:c.height};
  giveCanvas(c);
 }
 function paintFace(f,view){
  const [w,h]=size();
  if(f.bucket!==bucket){
   // A new size needs a new texture (immutable storage). The old one stays bound until this one is painted.
   if(f.canvas){giveCanvas(f.canvas);f.canvas=null;f.ctx=null;}
   const canvas=takeCanvas(w,h),old=f.texture;
   f.canvas=canvas;f.ctx=canvas.getContext('2d',{alpha:false});f.bucket=bucket;f.texture=newFaceTexture(f,canvas);
   old.dispose();
  }
  if(!f.canvas){f.canvas=takeCanvas(w,h);f.ctx=f.canvas.getContext('2d',{alpha:false});f.texture.image=f.canvas;}
  const o={width:w,height:h,compact,poster,style};
  let rec;
  if(f.side==='riffle')rec=paintRiffle(f.ctx,o);
  else if(!view){f.ctx.setTransform(1,0,0,1,0,0);f.ctx.globalCompositeOperation='source-over';f.ctx.fillStyle='rgb(0,0,0)';f.ctx.fillRect(0,0,w,h);rec=newRecord();}
  else rec=f.side==='L'?paintVerso(f.ctx,view,o):paintRecto(f.ctx,view,o);
  f.ctx.setTransform(1,0,0,1,0,0);f.ctx.globalCompositeOperation='source-over';
  f.regions=rec.regions;f.texts=rec.texts;f.signature=signatureOf(f,view);
  f.texture.needsUpdate=true;paints++;
  if(renderer?.initTexture){uploads.add(f.id);schedule();}
 }
 const stale=(f,view)=>signatureOf(f,view)!==f.signature||f.bucket!==bucket;
 function ensure(id,{now=false}={}){
  const f=record(id),view=viewFor(f);
  if(stale(f,view)){
   if(now){paintFace(f,view);queue.urgent.delete(f.id);queue.idle.delete(f.id);onChange();}
   else{queue.urgent.add(f.id);}
  }
  return f;
 }
 function evict(){
  const cap=TIER[level].lru;
  if(faces.size<=cap)return;
  const spare=[...faces.values()].filter(f=>!live.has(f.id)).sort((a,b)=>a.used-b.used);
  while(faces.size>cap&&spare.length)disposeFace(spare.shift());
 }
 function disposeFace(f){
  faces.delete(f.id);queue.urgent.delete(f.id);queue.idle.delete(f.id);
  f.texture.dispose();
  if(f.canvas)giveCanvas(f.canvas);
  f.canvas=null;f.ctx=null;
 }
 function schedule(){
  if(cancelIdle||disposed||!(queue.idle.size||uploads.size))return;
  cancelIdle=idle(()=>{
   cancelIdle=null;
   // One item per idle slice: an upload (renderer.initTexture, so no frame pays for it), else a prefetch paint.
   const up=uploads.values().next().value;
   if(up){uploads.delete(up);const f=faces.get(up);if(f&&f.canvas&&f.texture.image===f.canvas){try{renderer.initTexture(f.texture);}catch{}}}
   else{
    const next=queue.idle.values().next().value;
    if(next){queue.idle.delete(next);const f=faces.get(next)||record(next),view=viewFor(f);if(stale(f,view)){paintFace(f,view);onChange();}}
    evict();
   }
   schedule();
  },300);
 }

 /* ---- atlas ---- */
 function ensureAtlas(){
  const [w,h]=TIER[level].atlas;
  if(atlas&&atlas.canvas.width===w&&atlas.canvas.height===h)return atlas;
  if(atlas){atlas.texture.dispose();atlas.canvas.width=0;atlas.canvas.height=0;labels.clear();}
  const canvas=createCanvas(w,h),ctx=canvas.getContext('2d',{alpha:false});
  ctx.fillStyle='rgb(0,0,0)';ctx.fillRect(0,0,w,h);
  atlas={canvas,ctx,texture:maskTexture(canvas),slotW:w/ATLAS_SLOTS.cols,slotH:h/ATLAS_SLOTS.rows,free:[...Array(ATLAS_SLOTS.cols*ATLAS_SLOTS.rows).keys()]};
  atlas.texture.name='book-labels';
  return atlas;
 }
 function labelSignature(entry,aspect){
  return [entry.title,entry.passed&&!entry.completed?entry.status:entry.when,entry.chip,aspect.toFixed(3),fontsGen,level].join('|');
 }
 function labelSlot(entry,{aspect=2.5}={}){
  if(!entry||disposed)return null;
  const a=ensureAtlas(),id=String(entry.id),sig=labelSignature(entry,aspect);
  let slot=labels.get(id);
  if(!slot){
   if(!a.free.length){
    // Reuse the least recently used slot.
    const oldest=[...labels.values()].sort((x,y)=>x.used-y.used)[0];labels.delete(oldest.id);a.free.push(oldest.index);
   }
   slot={id,index:a.free.shift(),signature:'',used:0};labels.set(id,slot);
  }
  slot.used=++clock;
  const col=slot.index%ATLAS_SLOTS.cols,row=Math.floor(slot.index/ATLAS_SLOTS.cols);
  const rect={x:col*a.slotW,y:row*a.slotH,w:a.slotW,h:a.slotH},pad=Math.round(a.slotH*.04);
  const inner={x:rect.x+pad,y:rect.y+pad,w:rect.w-pad*2,h:rect.h-pad*2};
  const iw=Math.min(inner.w,Math.round(inner.h*aspect)),ix=inner.x+(inner.w-iw)/2;
  if(slot.signature!==sig){
   paintLabel(a.ctx,entry,inner,{aspect});
   a.ctx.setTransform(1,0,0,1,0,0);a.ctx.globalCompositeOperation='source-over';
   slot.signature=sig;a.texture.needsUpdate=true;labelPaints++;onChange();
  }
  const W=a.canvas.width,H=a.canvas.height;
  return {texture:a.texture,rect:[ix/W,1-(inner.y+inner.h)/H,(ix+iw)/W,1-inner.y/H],aspect};
 }

 /* ---- normal and detail maps ---- */
 function dataTexture(data,w,h,repeat){
  const t=new T.DataTexture(data,w,h);
  const ref=new T.CanvasTexture(null);t.minFilter=ref.minFilter;t.magFilter=ref.magFilter;ref.dispose();
  t.generateMipmaps=true;t.colorSpace=T.NoColorSpace;t.anisotropy=anisotropy();
  if(repeat){t.wrapS=t.wrapT=T.RepeatWrapping;}
  t.needsUpdate=true;return t;
 }
 const api={
  ready,
  face(id){const f=ensure(id);return f.texture;},
  paint(id){return ensure(id,{now:true}).texture;},
  want(ids,{prefetch=false}={}){
   if(!prefetch)live=new Set(ids.map(x=>parseFace(x).id));
   for(const id of ids){
    const f=record(id),view=viewFor(f);
    if(stale(f,view)){(prefetch?queue.idle:queue.urgent).add(f.id);}
   }
   evict();schedule();
  },
  pump(){
   const next=queue.urgent.values().next().value;
   if(!next)return false;
   queue.urgent.delete(next);
   const f=faces.get(next);if(!f)return false;
   const view=viewFor(f);
   if(stale(f,view)){paintFace(f,view);onChange();return true;}
   return false;
  },
  refresh(indexes){
   const only=indexes?new Set(indexes):null;
   for(const f of faces.values()){
    if(f.side==='riffle'||(only&&!only.has(f.index)))continue;
    const view=viewFor(f);
    if(stale(f,view))(live.has(f.id)?queue.urgent:queue.idle).add(f.id);
   }
   schedule();
  },
  setScreen(pageCssPx,dpr=1){
   const next=bucketFor(pageCssPx,dpr,level),nextCompact=Number(pageCssPx)>0&&Number(pageCssPx)<COMPACT_CSS_PX;
   if(next===bucket&&nextCompact===compact)return false;
   bucket=next;compact=nextCompact;
   for(const id of live)queue.urgent.add(id);
   return true;
  },
  setTier(next){
   if(!TIER[next]||next===level)return;
   level=next;bucket=Math.min(bucket,TIER[level].maxBucket);
   for(const f of faces.values())f.texture.anisotropy=anisotropy();
   for(const id of live)queue.urgent.add(id);
   if(atlas){atlas.texture.dispose();atlas.canvas.width=0;atlas.canvas.height=0;atlas=null;labels.clear();}
   for(const key of Object.keys(maps)){for(const t of Object.values(maps[key]||{}))t?.dispose?.();delete maps[key];}
   evict();onChange();
  },
  labelSlot,
  stamp(){
   if(!stampTex){const c=createCanvas(256,256),ctx=c.getContext('2d',{alpha:false});paintStamp(ctx,256);stampTex=maskTexture(c);stampTex.name='book-stamp';}
   return stampTex;
  },
  paper(){
   if(!maps.paper){const n=TIER[level].tooth,{normal}=paperTooth(n,17);maps.paper={normal:dataTexture(normal,n,n,true)};maps.paper.normal.name='book-paper-tooth';}
   return maps.paper;
  },
  linen(){
   if(!maps.linen){const n=TIER[level].linen,{normal,roughness}=linenWeave(n,32,23);maps.linen={normal:dataTexture(normal,n,n,true),roughness:dataTexture(roughness,n,n,true)};}
   return maps.linen;
  },
  cover(){return deboss('cover');},
  spine(){return deboss('spine');},
  hit(id,u,v){
   let f;try{f=faces.get(parseFace(id).id);}catch{return {kind:'page',corner:false};}
   const x=clamp(u,0,1),y=clamp(1-v,0,1);
   let corner=false,item=null;
   for(const r of f?.regions||[]){
    if(x<r.x0||x>r.x1||y<r.y0||y>r.y1)continue;
    if(r.kind==='corner')corner=true;else if(r.kind==='item'&&!item)item=r;
   }
   if(item)return {kind:'item',id:item.id,open:item.open,corner};
   return {kind:corner?'corner':'page',corner};
  },
  hitFlat(id,x,y){const side=parseFace(id).side==='L'?'L':'R',{u,v}=faceUV(side,x,y);return api.hit(id,u,v);},
  signature(id){return faces.get(parseFace(id).id)?.signature??null;},
  regions(id){return faces.get(parseFace(id).id)?.regions??[];},
  texts(id){return faces.get(parseFace(id).id)?.texts??[];},
  stats(){
   let bytes=0;for(const f of faces.values()){const [w,h]=PAGE_SIZES[f.bucket];bytes+=w*h*4*4/3;}
   if(atlas)bytes+=atlas.canvas.width*atlas.canvas.height*4*4/3;
   return {paints,labelPaints,faces:faces.size,live:live.size,queued:queue.urgent.size+queue.idle.size,pool:pool.length,bucket,compact,fontsGen,tier:level,
    labels:labels.size,bytes:Math.round(bytes)};
  },
  dispose(){
   if(disposed)return;disposed=true;
   cancelIdle?.();cancelIdle=null;
   fonts?.removeEventListener?.('loadingdone',onFonts);
   for(const f of [...faces.values()]){f.texture.dispose();if(f.canvas){f.canvas.width=0;f.canvas.height=0;}}
   faces.clear();
   for(const c of pool){c.width=0;c.height=0;}pool.length=0;
   if(atlas){atlas.texture.dispose();atlas.canvas.width=0;atlas.canvas.height=0;atlas=null;}
   stampTex?.dispose();stampTex=null;
   for(const m of Object.values(maps))for(const t of Object.values(m||{}))t?.dispose?.();
   labels.clear();queue.urgent.clear();queue.idle.clear();uploads.clear();
  }
 };
 function deboss(kind){
  if(maps[kind]!==undefined)return maps[kind];
  const base=TIER[level].cover,w=kind==='spine'?Math.round(base/8):base,h=kind==='spine'?Math.round(base*212/16/8):Math.round(base*212/148);
  let result=null;
  try{
   const c=createCanvas(w,h),ctx=c.getContext('2d',{willReadFrequently:true});
   const out=paintDeboss(ctx,kind,w,h,style);
   if(out)result={normal:dataTexture(out.normal,w,h,false),roughness:dataTexture(out.roughness,w,h,false)};
   c.width=0;c.height=0;
  }catch(error){console.warn('Deboss map unavailable',error);}
  maps[kind]=result;
  return result;
 }
 return api;
}
