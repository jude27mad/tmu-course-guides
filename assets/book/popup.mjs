/* MTH140 pop-up arcs (semester-book spec §5.3, decisions 4–8). Side A owns this module.

   Everything is in the Codex page frame (assets/book/page-bend-math.mjs): x across from the spine (recto +x,
   verso −x), y along the spine from the tail (0) to the head (H), z up from the inner board. The book scene
   adds `set.group` to its book group, so pop-ups bend, light and shadow with the pages for free.

   Two layers:

   1. Pure solver (no Three, no DOM), used by the tests and by the meshes:
        PAGE, ARCS                        page size and the MTH140 arc table (lengths in metres)
        popupSpec(entry)                  one entry → its arc (kind, strips, tag, rank-based height scale)
        layoutSpread(viewOrEntries)       ≤ 3 pieces, highest rank toward the head; slots, footprints, aMax
        surfacePoint(surface, side, s, y) a point s metres from the spine on a rigid page or a turning sheet
        solvePiece(piece, pose, state)    exact chord linkage → cross sections, apex, θ, raise r(θ), tag plate
        pieceVertices(piece, solution)    the 3D vertices the mesh will hold (tests sample them)

      A pose names the two surfaces a spread's feet stand on:
        { left: Surface, right: Surface }
        Surface = { z = 0, angle = 0, dip = 0 }                 rigid page hinged at the spine; angle lifts it
                | { sheet: { turn, radius, stackZ: [z0, z1] | z, dip = 0 } }
                                                                the turning sheet: bendPoint + the stack height,
                                                                either the shader's literal mix(z0, z1, turn) or
                                                                the offset the engine applies this frame (z)
        dip is the optional gutter valley depth (static: full; sheet: faded like the bend shader); feet sit
        beyond the 18 mm valley, so it only moves the tag's crease.
      Outgoing spread k during its turn: { left: {z: zL}, right: {sheet} }; incoming spread k+1:
      { left: {sheet}, right: {z: zR} }. At rest both are rigid: { left: {z: zL}, right: {z: zR} }.

   2. Meshes (Three via app/three.mjs): createPopupSet({ tier, labels, stamp }) → PopupSet, one per shown
      spread (the engine keeps two: outgoing and incoming). See PopupSet below for the per-frame contract.

   Rules kept here, not in the engine: exact linkage only at flat = 0 (completion flattens by h(1 − flat) at
   fixed feet), no time lag (a pose is a pure function of the surfaces), static urgency only (no pulse),
   completed tags fold back onto their own flattened arch (a plate falling back lands label side up, so the
   stamp prints over the label; the spec's "label and stamp face up"); hit targets are the visible
   geometry itself (positions rewritten in place, bounding spheres recomputed, raycast off when hidden). */
import {bendPoint} from './page-bend-math.mjs';
import * as T from '../app/three.mjs?v=20261013-stage1';

const W=.142,H=.206,DEG=Math.PI/180;
export const PAGE=Object.freeze({W,H});
export const RAISE=Object.freeze({from:40*DEG,to:170*DEG});
export const TAG=Object.freeze({lean:24*DEG,gap:.008,hoverLean:4*DEG,hoverScale:1.03});
export const SHEET_LIFT=.0002; // the bend shader's z offset over the stack (§5.2)
export const SEGMENTS=Object.freeze({high:24,mid:12});
const SLOTS=[[.5],[.6,.32],[.64,.42,.22]];
const PACK={gap:.004,min:.035*H,max:.97*H};

/* §5.3 table. a, crest and tag width are fractions of W; h and tag height of H; depth and offsets in metres.
   bow: [verso half, recto half]; positive bows outward. */
export const ARCS=Object.freeze({
 final:Object.freeze({mechanism:'double',strips:Object.freeze([
  Object.freeze({a:.34,h:.30,depth:.022,bow:[.22,.22],wash:.80,offset:0}),
  Object.freeze({a:.23,h:.21,depth:.018,bow:[.22,.22],wash:.55,offset:-.012})]),tag:Object.freeze([.40,.13]),band:[.28,.34]}),
 midterm:Object.freeze({mechanism:'arch',strips:Object.freeze([Object.freeze({a:.28,h:.25,depth:.020,bow:[.22,.22],wash:.65,offset:0})]),tag:Object.freeze([.38,.12]),band:[.20,.27]}),
 quiz:Object.freeze({mechanism:'wave',strips:Object.freeze([Object.freeze({a:.24,h:.15,depth:.016,bow:[.18,-.08],wash:.45,offset:0,crest:.15})]),tag:Object.freeze([.34,.10]),band:[.12,.19]}),
 minor:Object.freeze({mechanism:'low',strips:Object.freeze([Object.freeze({a:.13,h:.08,depth:.012,bow:[.30,.30],wash:0,offset:0})]),tag:Object.freeze([.30,.09]),band:[.06,.11]})
});
const KIND={final:'final',midterm:'midterm',quiz:'quiz',lab:'quiz',minor:'minor'};
export const arcKind=kind=>KIND[kind]||'minor';

const clamp=(v,lo,hi)=>Math.min(hi,Math.max(lo,v));
const lerp=(a,b,t)=>a+(b-a)*t;
export const smoothstep=(e0,e1,x)=>{const t=clamp((x-e0)/(e1-e0),0,1);return t*t*(3-2*t);};
const len=(x,z)=>Math.hypot(x,z);
const norm2=(x,z)=>{const l=Math.hypot(x,z);return l>1e-12?[x/l,z/l]:[0,1];};

/* Height scale from popupRank: the fractional part within a category is w/(w + 100); no weight keeps 1. */
export function heightScale(entry){
 const rank=Number(entry?.rank);
 if(!Number.isFinite(rank))return 1;
 const frac=rank-2*Math.floor(rank/2);
 return frac<=1e-9?1:clamp(.9+.4*frac,.9,1.1);
}

/* Bisection on [0.5 a_R, 1.5 a_R] for the wave's verso foot so that a_L + c_L = a_R + c_R (flat fold) with the
   crest at x = crest·a_R. Monotone in a_L, so 60 halvings reach double precision. */
export function solveWaveFoot(aR,h,crest){
 const xc=crest*aR,target=aR+len(aR-xc,h);
 const f=aL=>aL+len(aL+xc,h)-target;
 let lo=.5*aR,hi=1.5*aR;
 if(f(lo)>0||f(hi)<0)throw new RangeError('Wave foot outside its bracket');
 for(let i=0;i<60;i++){const mid=(lo+hi)/2;if(f(mid)>0)hi=mid;else lo=mid;}
 return (lo+hi)/2;
}

/* One entry (a describeSpread Entry, or anything with kind/rank/id) → its arc in metres. */
export function popupSpec(entry){
 const kind=arcKind(entry?.kind),arc=ARCS[kind],scale=heightScale(entry);
 const strips=arc.strips.map((s,i)=>{
  // Category bands keep final > midterm > quiz > minor whatever the weights (§10.1).
  const h=clamp(s.h*scale,i===0?arc.band[0]:0,i===0?arc.band[1]:1)*H,aR=s.a*W;
  const crest=s.crest||0,aL=crest?solveWaveFoot(aR,h,crest):aR,xc=crest*aR;
  return Object.freeze({index:i,aL,aR,h,xc,crest,cL:len(aL+xc,h),cR:len(aR-xc,h),depth:s.depth,offset:s.offset,bow:s.bow,wash:s.wash});
 });
 return Object.freeze({id:entry?.id??null,open:entry?.open??null,kind,mechanism:arc.mechanism,strips:Object.freeze(strips),
  tag:Object.freeze({w:arc.tag[0]*W,h:arc.tag[1]*H}),rank:Number(entry?.rank)||0,height:strips[0].h,aMax:Math.max(...strips.map(s=>Math.max(s.aL,s.aR)))});
}

/* Footprint along y of a piece whose outer strip is centred at yc: tag hinge (tail) to the arch back (head);
   the completed tag's back-fold lies on its own arch, so it never reaches past it. */
function footprint(spec,yc){
 const front=Math.min(...spec.strips.map(s=>yc+s.offset-s.depth/2));
 const back=Math.max(...spec.strips.map(s=>yc+s.offset+s.depth/2));
 const tagY=front-TAG.gap-spec.tag.h*Math.sin(TAG.lean);
 return {front,back,tagY,lo:tagY,hi:Math.max(back,tagY+spec.tag.h)};
}

/* layoutSpread(view | entries) → { pieces, more, aMax }. view.popups are ids by rank desc (≤ 3, describeSpread);
   an array is taken as entries and ranked here. Highest rank sits furthest back (toward the head). Slots are the
   §5.3 table; if footprints would overlap (a final + midterm + quiz spread), the pieces are packed head-down
   with a 4 mm gap, then shifted up if the last tag would leave the page. */
export function layoutSpread(input,{max=3}={}){
 let entries;
 if(Array.isArray(input))entries=[...input].sort((a,b)=>(b.rank||0)-(a.rank||0)).slice(0,max);
 else{
  const byId=new Map((input?.entries||[]).map(e=>[e.id,e]));
  entries=(input?.popups||[]).map(id=>byId.get(id)).filter(Boolean).slice(0,max);
 }
 const total=Array.isArray(input)?input.length:(input?.entries?.length??entries.length);
 const specs=entries.map(popupSpec);
 const ys=(SLOTS[specs.length-1]||[]).map(f=>f*H);
 // Pack: each piece's head side stays below the previous piece's tag by the gap.
 for(let i=1;i<specs.length;i++){
  const prev=footprint(specs[i-1],ys[i-1]),own=footprint(specs[i],ys[i]),limit=prev.lo-PACK.gap;
  if(own.hi>limit)ys[i]-=own.hi-limit;
 }
 if(specs.length){
  const last=footprint(specs.at(-1),ys.at(-1));
  if(last.lo<PACK.min){const shift=PACK.min-last.lo;for(let i=0;i<ys.length;i++)ys[i]+=shift;}
  const first=footprint(specs[0],ys[0]);
  if(first.hi>PACK.max)throw new RangeError('Pop-ups do not fit on one spread');
 }
 const pieces=specs.map((spec,i)=>Object.freeze({spec,entry:entries[i],id:spec.id,slot:i,y:ys[i],...footprint(spec,ys[i])}));
 return Object.freeze({pieces:Object.freeze(pieces),more:Math.max(0,total-pieces.length),aMax:pieces.length?Math.max(...pieces.map(p=>p.spec.aMax)):.24*W});
}

/* ---- surfaces ---- */
export const restPose=(zL=0,zR=0)=>({left:{z:zL},right:{z:zR}});
const sheetParams=sheet=>{
 const width=sheet.width??W,turn=clamp(Number(sheet.turn)||0,0,1),max=width/Math.PI;
 const r=sheet.radius==null||Number.isNaN(sheet.radius)?max:clamp(sheet.radius,width*1e-4,max);
 const [z0=0,z1=0]=sheet.stackZ||[];
 // z: the stack offset the engine applies this frame; stackZ: the shader's literal mix(z0, z1, turn).
 const z=(Number.isFinite(sheet.z)?sheet.z:lerp(z0,z1,turn))+SHEET_LIFT;
 return {width,turn,r,arc:Math.PI*r,a:(1-turn)*width-turn*Math.PI*r,z};
};
/* A point s ≥ 0 metres from the spine on one surface, as [x, y, z]. side −1 is the verso, +1 the recto (rigid
   pages only: a sheet's own bend decides where its flat point lies). */
export const GUTTER=.018;
const dipAt=(depth,s)=>depth>0?depth*(1-smoothstep(0,GUTTER,s)):0;
export function surfacePoint(surface,side,s,y){
 const sheet=surface?.sheet;
 if(sheet){
  const q=sheetParams(sheet),p=bendPoint(s,y,{turn:q.turn,radius:q.r,width:q.width}).position;
  // Optional gutter valley, faded on a turning sheet exactly as the bend shader fades it.
  const fade=1-smoothstep(0,.15,Math.min(q.turn,1-q.turn));
  return [p[0],y,p[2]+q.z-dipAt(Number(sheet.dip)||0,s)*fade];
 }
 const z=Number(surface?.z)||0,a=Number(surface?.angle)||0;
 return [side*s*Math.cos(a),y,z+s*Math.sin(a)-dipAt(Number(surface?.dip)||0,s)];
}

/* Signed distance in x–z from a point to a turning sheet, + on its front (the face whose normal bendPoint
   returns), with end = true when the nearest point is a free end of the sheet and the point lies beyond it
   (it cannot be on either side). Analytic over the three pieces of the bend: flat run, semicircle, flat tail. */
export function sheetSide(sheet,x,z){
 const q=sheetParams(sheet),{width,turn,r,arc,a}=q;
 if(turn<=0||turn>=1){
  const dir=turn<=0?1:-1,px=clamp(x*dir,0,width),dz=z-q.z;
  return {s:dir*dz,d:Math.hypot(x*dir-px,dz),end:x*dir<0||x*dir>width};
 }
 const C=t=>t<=0?[t,0]:t>=arc?[arc-t,2*r]:[r*Math.sin(t/r),r*(1-Math.cos(t/r))];
 const S=C(-a),X=x+S[0],Z=z-q.z+S[1],q0=-a,q1=width-a;
 let best=null;
 const take=(d,s,end)=>{if(!best||d<best.d)best={d,s,end};};
 if(q0<0){
  const hi=Math.min(0,q1),qc=clamp(X,q0,hi);
  take(Math.hypot(X-qc,Z),Z,(X<=q0+1e-12)||(hi===q1&&X>q1));
 }
 const qa=Math.max(0,q0),qb=Math.min(arc,q1);
 if(qb>qa){
  const p0=qa/r,p1=qb/r,dx=X,dz=Z-r,phi=Math.atan2(dx,-dz),rho=Math.hypot(dx,dz);
  if(phi>=p0&&phi<=p1)take(Math.abs(rho-r),r-rho,false);
  else for(const [p,isEnd] of [[p0,qa===q0],[p1,qb===q1]]){
   const px=r*Math.sin(p),pz=r*(1-Math.cos(p)),n=[-Math.sin(p),Math.cos(p)];
   take(Math.hypot(X-px,Z-pz),(X-px)*n[0]+(Z-pz)*n[1],isEnd);
  }
 }
 if(q1>arc){
  const lo=Math.max(arc,q0),xs=arc-lo,xe=arc-q1,xc=clamp(X,xe,xs);
  take(Math.hypot(X-xc,Z-2*r),2*r-Z,(X<xe)||(lo===q0&&X>xs));
 }
 return best;
}

/* Circles (P0, r0) and (P1, r1) in x–z → candidate points. Separated circles clamp to the segment at r0:(r0 + r1);
   nested circles give their internal tangent point (the wave folds there exactly at θ = 0). */
function circles(P0,r0,P1,r1,fallback,toward=null){
 const dx=P1[0]-P0[0],dz=P1[1]-P0[1],d=Math.hypot(dx,dz);
 if(d<1e-12){
  // Coincident centres (a symmetric piece with the book shut): any point of the circle; take the one toward the
  // reference when there is one, else along the bisector.
  const dir=toward&&Math.hypot(toward[0]-P0[0],toward[1]-P0[1])>1e-12?norm2(toward[0]-P0[0],toward[1]-P0[1]):fallback;
  return [[P0[0]+dir[0]*r0,P0[1]+dir[1]*r0]];
 }
 const ux=dx/d,uz=dz/d;
 if(d>=r0+r1){const k=r0/(r0+r1);return [[P0[0]+dx*k,P0[1]+dz*k]];}
 if(d<=Math.abs(r0-r1))return r0>=r1?[[P0[0]+ux*r0,P0[1]+uz*r0]]:[[P1[0]-ux*r1,P1[1]-uz*r1]];
 const a=(r0*r0-r1*r1+d*d)/(2*d),h=Math.sqrt(Math.max(0,r0*r0-a*a)),bx=P0[0]+ux*a,bz=P0[1]+uz*a;
 return [[bx-uz*h,bz+ux*h],[bx+uz*h,bz-ux*h]];
}

/* The open-side normal of a surface at s from the spine: the side the pop-up stands on. A rigid page's front;
   a sheet's front when it carries the recto foot (outgoing), its back when it carries the verso foot. */
function openNormal(surface,side,s,y){
 const sheet=surface?.sheet;
 if(sheet){
  const q=sheetParams(sheet),n=bendPoint(s,y,{turn:q.turn,radius:q.r,width:q.width}).normal,k=side>0?1:-1;
  return [n[0]*k,n[2]*k];
 }
 const a=Number(surface?.angle)||0;
 return side<0?[Math.sin(a),Math.cos(a)]:[-Math.sin(a),Math.cos(a)];
}
/* Bisector of two page directions, pointing into the open side; θ is measured through the open side, so a
   stepped gutter (pages a little below flat) reads as a reflex angle rather than folding the piece over. */
function bisect(l,r,open){
 let b=[l[0]+r[0],l[1]+r[1]],reflex=false;
 if(Math.hypot(b[0],b[1])<1e-4)b=norm2(open[0],open[1]);
 else{b=norm2(b[0],b[1]);if(b[0]*open[0]+b[1]*open[1]<0){b=[-b[0],-b[1]];reflex=true;}}
 const inner=Math.acos(clamp(l[0]*r[0]+l[1]*r[1],-1,1));
 return {b,theta:reflex?2*Math.PI-inner:inner};
}

/* The hinge: foot directions from each page's own spine point (so unequal block heights still read as θ = π
   when the book lies open), their open-side bisector and r(θ). */
function hinge(pose,y,aL,aR){
 const GL=surfacePoint(pose.left,-1,0,y),GR=surfacePoint(pose.right,1,0,y);
 const L=surfacePoint(pose.left,-1,aL,y),R=surfacePoint(pose.right,1,aR,y);
 const l=norm2(L[0]-GL[0],L[2]-GL[2]),r=norm2(R[0]-GR[0],R[2]-GR[2]);
 const nL=openNormal(pose.left,-1,aL,y),nR=openNormal(pose.right,1,aR,y);
 const {b,theta}=bisect(l,r,[nL[0]+nR[0],nL[1]+nR[1]]);
 return {L:[L[0],L[2]],R:[R[0],R[2]],GL:[GL[0],GL[2]],GR:[GR[0],GR[2]],G:[(GL[0]+GR[0])/2,(GL[2]+GR[2])/2],l,r,b,theta,raise:smoothstep(RAISE.from,RAISE.to,theta)};
}

/* One strip's cross-section for the hinge state. flat ∈ [0, 1] (completion; arrival passes 1 − rise). */
function solveStrip(strip,hg,flat,segments,surf){
 const {G,b,L,R}=hg,dot=(P)=>(P[0]-G[0])*b[0]+(P[1]-G[1])*b[1];
 const exact=circles(L,strip.cL,R,strip.cR,b).reduce((best,P)=>!best||dot(P)>dot(best)?P:best,null);
 let M=exact,cL=strip.cL,cR=strip.cR;
 if(flat!==0){
  const k=1-flat,he=strip.h*k,xc=strip.xc*k;
  cL=len(strip.aL+xc,he);cR=len(strip.aR-xc,he);
  // Chords recomputed at fixed feet; of the two solutions keep the one nearest the scaled exact apex, so the
  // arch lowers continuously and lies on its pages (M = G) when flat = 1 at any θ.
  const ref=[G[0]+(exact[0]-G[0])*k,G[1]+(exact[1]-G[1])*k];
  M=circles(L,cL,R,cR,b,ref).reduce((best,P)=>!best||Math.hypot(P[0]-ref[0],P[1]-ref[1])<Math.hypot(best[0]-ref[0],best[1]-ref[1])?P:best,null);
 }
 const bowK=smoothstep(.6,1,hg.raise)*(1-clamp(flat,0,1));
 // Pressed flat, a strip lies on its own page, following a turning sheet's curl rather than its chord.
 const press=surf?smoothstep(.5,1,flat):0;
 const half=Math.max(1,Math.floor(segments/2)),points=[];
 const halfPoints=(F,c,k,from,reverse,side,a)=>{
  const vx=M[0]-F[0],vz=M[1]-F[1];
  let [nx,nz]=norm2(-vz,vx);
  const mx=(F[0]+M[0])/2-G[0],mz=(F[1]+M[1])/2-G[1];
  if(nx*mx+nz*mz<0){nx=-nx;nz=-nz;}
  const bow=k*c*bowK;
  for(let i=from;i<=half;i++){
   const u=reverse?1-i/half:i/half,lift=bow*4*u*(1-u);
   let x=F[0]+vx*u+nx*lift,z=F[1]+vz*u+nz*lift;
   if(press>0){const q=surf(side,a*(1-u));x=lerp(x,q[0],press);z=lerp(z,q[1],press);}
   points.push([x,z]);
  }
 };
 halfPoints(L,cL,strip.bow[0],0,false,-1,strip.aL);  // verso foot → apex
 halfPoints(R,cR,strip.bow[1],1,true,1,strip.aR);    // apex → recto foot (apex already pushed)
 return {points,M,cL,cR};
}

/* Tag plate halves: hinge line across the gutter at y_t; each half spans its page direction and the crease c.
   The crease foot sits at the higher page at rest, so the plate never enters a block. On a turning sheet a half lies along the sheet's chord (its front, the concave side) or along its
   spine tangent (its back, the convex side), so the flat plate never cuts the curl. */
function tagFrame(piece,pose,hg,state){
 const spec=piece.spec,s=smoothstep(.3,1,state.flat),w=spec.tag.w/2;
 const yT=piece.tagY,GL=surfacePoint(pose.left,-1,0,yT),GR=surfacePoint(pose.right,1,0,yT);
 // A turning sheet hinges at its own spine point; the static page's edge differs by at most the block step,
 // which the gutter dip hides.
 const high=Math.max(GL[2],GR[2]);
 // At rest the crease stands on the higher page: lower, the higher block in front of it would hide the
 // plate's foot from the camera; the half over the lower page spans its gutter valley instead.
 const G=pose.left?.sheet?[GL[0],yT,GL[2]]:pose.right?.sheet?[GR[0],yT,GR[2]]:[(GL[0]+GR[0])/2,yT,high];
 // Each half runs along its page: to the page point at w (on a sheet's front, its chord, so the half ends on
 // the paper), or along a sheet's spine tangent on its back.
 const along=(surface,side,front)=>{
  if(surface?.sheet&&!front){
   const p=surfacePoint(surface,side,1e-4,yT),q=surfacePoint(surface,side,0,yT);
   const [x,z]=norm2(p[0]-q[0],p[2]-q[2]);return {d:[x,0,z],w};
  }
  const p=surfacePoint(surface,side,w,yT),dx=p[0]-G[0],dz=p[2]-G[2];
  const [x,z]=norm2(dx,dz);return {d:[x,0,z],w:surface?.sheet?Math.min(w,Math.hypot(dx,dz)):w};
 };
 // Outgoing sets stand on the sheet's front (right foot), incoming on its back (left foot).
 const left=along(pose.left,-1,!pose.left?.sheet),right=along(pose.right,1,true),l=left.d,r=right.d;
 // The crease direction bisects the pages themselves (a rigid page's own direction; a sheet's chord or
 // tangent), not the plate's edges, so a stepped gutter tilts the plate's feet but never the sign.
 const pageDir=(surface,side,edge)=>surface?.sheet?[edge[0],edge[2]]:[side*Math.cos(Number(surface?.angle)||0),Math.sin(Number(surface?.angle)||0)];
 const nL=openNormal(pose.left,-1,w,yT),nR=openNormal(pose.right,1,w,yT);
 const {b}=bisect(pageDir(pose.left,-1,l),pageDir(pose.right,1,r),[nL[0]+nR[0],nL[1]+nR[1]]);
 const phi=TAG.lean*hg.raise*(1-s)+(Math.PI/2)*s-TAG.hoverLean*(state.hover||0);
 const c=[Math.cos(phi)*b[0],Math.sin(phi),Math.cos(phi)*b[1]];
 const scale=1+(TAG.hoverScale-1)*(state.hover||0);
 return {G,l,r,c,b,wl:left.w*scale,wr:right.w*scale,h:spec.tag.h*scale,phi};
}

function solveAt(piece,pose,flat,hover,segments){
 const spec=piece.spec,outer=spec.strips[0];
 const hg=hinge(pose,piece.y,outer.aL,outer.aR);
 const strips=spec.strips.map(strip=>{
  const own=strip.index===0?hg:hinge(pose,piece.y+strip.offset,strip.aL,strip.aR);
  const y=piece.y+strip.offset,surf=(side,d)=>{const p=surfacePoint(side<0?pose.left:pose.right,side,d,y);return [p[0],p[2]];};
  const solved=solveStrip(strip,own,flat,segments,surf);
  return {...solved,y0:piece.y+strip.offset-strip.depth/2,y1:piece.y+strip.offset+strip.depth/2,wash:strip.wash};
 });
 const tag=tagFrame(piece,pose,hg,{flat,hover});
 return {theta:hg.theta,raise:hg.raise,b:hg.b,G:hg.G,L:hg.L,R:hg.R,strips,tag,apex:strips[0].M,flat,squash:0};
}

/* Clearance against a turning sheet. Outgoing pieces must stay on the sheet's front, incoming on its back.
   Strip samples and the tag's outline (corners and edge midpoints) are tested with sheetSide(); the result is
   the deepest penetration (0 when clear). */
export const CLEARANCE=.0003;
function penetration(solution,sheet,front){
 let worst=0;
 const test=(x,z)=>{const r=sheetSide(sheet,x,z);if(!r.end)worst=Math.max(worst,front?-r.s:r.s);};
 for(const strip of solution.strips)for(const [x,z] of strip.points)test(x,z);
 const k=tagCorners(solution.tag);
 for(const [i,j] of [[0,1],[1,4],[4,5],[0,2],[2,3],[3,6],[6,7],[5,7],[1,3]])
  for(const u of [0,.5,1])test(k[i][0]+(k[j][0]-k[i][0])*u,k[i][2]+(k[j][2]-k[i][2])*u);
 return worst;
}

/* solvePiece(piece, pose, { flat = 0, hover = 0, segments = 24 }) → the whole piece for one pose.
   Rigid poses are the exact linkage (chords constant while flat = 0). With a turning sheet in the pose, the
   paper cannot pass through the curl: when the exact arch would, the piece is pressed flatter by the smallest
   extra flat that clears (bisection, 8 steps: 1/256 of the travel), as the page would press it. squash reports that extra. */
export function solvePiece(piece,pose,{flat=0,hover=0,segments=SEGMENTS.high,clearance=true}={}){
 const base=solveAt(piece,pose,flat,hover,segments);
 const sheet=pose?.left?.sheet||pose?.right?.sheet;
 if(!clearance||!sheet||flat>=1)return base;
 const front=!!pose.right?.sheet,deep=penetration(base,sheet,front);
 if(deep<=CLEARANCE)return base;
 const pressed=solveAt(piece,pose,1,hover,segments),pressedDeep=penetration(pressed,sheet,front);
 if(pressedDeep>CLEARANCE){const best=pressedDeep<deep?pressed:base;best.squash=best===pressed?1-flat:0;return best;}
 let lo=flat,hi=1,best=pressed;
 for(let i=0;i<8;i++){
  const mid=(lo+hi)/2,trial=solveAt(piece,pose,mid,hover,segments);
  if(penetration(trial,sheet,front)<=CLEARANCE){hi=mid;best=trial;}else lo=mid;
 }
 best.squash=hi-flat;
 return best;
}

/* Tag plate corners in the mesh's vertex order: BL, BC, TL, TC (verso half), BC, BR, TC, TR (recto half). */
export function tagCorners(tag){
 const {G,l,r,c,wl,wr,h}=tag,add=(...v)=>v.reduce((a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]]),mul=(v,k)=>[v[0]*k,v[1]*k,v[2]*k];
 const BL=add(G,mul(l,wl)),BR=add(G,mul(r,wr)),up=mul(c,h);
 return [BL,G,add(BL,up),add(G,up),G,BR,add(G,up),add(BR,up)];
}

/* All 3D vertices of a solved piece (strips extruded over their depth, then the tag), for tests and bounds. */
export function pieceVertices(solution){
 const out=[];
 for(const s of solution.strips)for(const [x,z] of s.points){out.push([x,s.y0,z]);out.push([x,s.y1,z]);}
 for(const v of tagCorners(solution.tag))out.push(v);
 return out;
}

/* Contact shadow rects for the page shader (§5.3 step 8), in flat page coordinates (distance from the spine,
   y from the tail): the region under each arch, darkest at k = (0.18 dark | 0.10 light) · r · (1 − flat). */
export function footRects(pieces,solutions,{dark=true,flats=[]}={}){
 const left=new Float32Array(12),right=new Float32Array(12),k=new Float32Array(3);
 pieces.slice(0,3).forEach((p,i)=>{
  const s=p.spec.strips[0],sol=solutions[i];
  left.set([0,p.front,s.aL,p.back],i*4);right.set([0,p.front,s.aR,p.back],i*4);
  k[i]=(dark?.18:.10)*(sol?.raise??1)*(1-clamp(flats[i]??0,0,1));
 });
 return {left,right,k};
}

/* ---- eases (GSAP formulas, so the engine may pass gsap.parseEase instead) ---- */
export const EASES=Object.freeze({
 linear:t=>t,
 'power2.in':t=>t*t*t,
 'power2.out':t=>1-(1-t)**3,
 'power3.out':t=>1-(1-t)**4,
 'back.out(1.1)':t=>{const s=1.1,u=t-1;return 1+(s+1)*u*u*u+s*u*u;},
 'back.out(1.15)':t=>{const s=1.15,u=t-1;return 1+(s+1)*u*u*u+s*u*u;}
});

/* Deterministic stamp angle in [−10°, −4°] per id (FNV-1a). */
export function stampAngle(id){
 let h=0x811c9dc5;const text=String(id??'');
 for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,0x01000193)>>>0;}
 return (-10+6*(h/0xffffffff))*DEG;
}

/* ---- meshes ---- */

/* Colours are sRGB hex here, converted by Three's colour management. The engine tweens theme changes by calling
   set.setPalette() with interpolated values (or a mix factor); nothing repaints. */
export const PALETTES=Object.freeze({
 dark:Object.freeze({paper:'#efe6d2',ink:'#1f2624',accent:'#096450',urgent:'#a8391d',pencil:'#5a5f61',wash:'#b9dfc9',glow:'#ff7a59',dark:1}),
 light:Object.freeze({paper:'#fbfaf6',ink:'#1f2624',accent:'#096450',urgent:'#a8391d',pencil:'#5a5f61',wash:'#b9dfc9',glow:'#ff7a59',dark:0})
});

const STATE_LOOK={
 // frame: 0 pencil hairline, 1 accent frame; urgent swaps the accent for urgent ink; glow is the dark emissive.
 none:{frame:0,urgent:0,glow:0,halo:0,wash:0},
 next:{frame:1,urgent:0,glow:0,halo:0,wash:.10},
 soon:{frame:1,urgent:1,glow:1.15,halo:.18,wash:.10},
 hot:{frame:1,urgent:1,glow:1.6,halo:.30,wash:.10}
};
export function lookFor(entry){
 if(!entry||entry.completed)return STATE_LOOK.none;
 if(entry.urgency==='hot')return STATE_LOOK.hot;
 if(entry.urgency==='soon')return STATE_LOOK.soon;
 return entry.chip?STATE_LOOK.next:STATE_LOOK.none;
}

const STRIP_FRAGMENT=/* glsl */`
 vec3 popBase=diffuseColor.rgb;
 if(!gl_FrontFacing)popBase=mix(popBase,uWash,uWashK);
 float popEdge=min(vUv.y,1.-vUv.y);
 float popLine=1.-smoothstep(0.,fwidth(vUv.y)*1.5,popEdge);
 popBase=mix(popBase,uPencil,popLine*.8);
 float popLuma=dot(popBase,vec3(.2126,.7152,.0722));
 diffuseColor.rgb=mix(vec3(popLuma),popBase,uSat)+uLift;`;

const TAG_FRAGMENT=/* glsl */`
 vec2 tagUv=gl_FrontFacing?vUv:vec2(1.-vUv.x,vUv.y);
 vec4 tagMask=texture2D(uAtlas,mix(uRect.xy,uRect.zw,tagUv));
 vec3 tagC=diffuseColor.rgb;
 tagC=mix(tagC,uInk,tagMask.g);
 tagC=mix(tagC,uAccent,tagMask.b);
 vec2 tagD=min(vUv,1.-vUv)/uFrameW;
 float tagIn=min(tagD.x,tagD.y);
 float tagAA=fwidth(tagIn);
 float tagFrame=1.-smoothstep(1.-tagAA,1.+tagAA,tagIn);
 float tagHair=(1.-smoothstep(0.,tagAA*1.2,tagIn*4.))*.6;
 vec3 tagFrameColor=mix(uAccent,uInk,uHoverInk*.5);
 tagC=mix(tagC,uPencil,tagHair*(1.-uFrameOn));
 tagC=mix(tagC,tagFrameColor,tagFrame*uFrameOn);
 float tagLuma=dot(tagC,vec3(.2126,.7152,.0722));
 tagC=mix(vec3(tagLuma),tagC,uSat)+uLift;
 // The stamp is inked after the card is desaturated, so it keeps the course accent; it sits right of centre
 // like a hand stamp, clear of most of the title.
 if(uStampK>0.){
  vec2 sp=(tagUv-vec2(.61,.47))*vec2(uAspect,1.)/uStampScale;
  sp=vec2(cos(uStampRot)*sp.x-sin(uStampRot)*sp.y,sin(uStampRot)*sp.x+cos(uStampRot)*sp.y)+.5;
  float st=texture2D(uStamp,clamp(sp,0.,1.)).r*step(0.,sp.x)*step(sp.x,1.)*step(0.,sp.y)*step(sp.y,1.);
  tagC=mix(tagC,tagC*uStampColor,st*uStampK);
 }
 diffuseColor.rgb=tagC;
 popGlow=tagFrame*uFrameOn;`;

const HALO_VERTEX=/* glsl */`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
function patch(material,uniforms,fragment,key,{glow=false}={}){
 material.defines={...material.defines,USE_UV:''};
 material.onBeforeCompile=shader=>{
  Object.assign(shader.uniforms,uniforms);
  const decl=Object.keys(uniforms).map(name=>{
   const v=uniforms[name].value;
   const type=v?.isTexture?'sampler2D':v?.isColor||v?.isVector3?'vec3':v?.isVector4?'vec4':v?.isVector2?'vec2':'float';
   return `uniform ${type} ${name};`;
  }).join('\n');
  shader.fragmentShader=shader.fragmentShader
   .replace('#include <common>',`#include <common>\n${decl}\nfloat popGlow=0.;`)
   .replace('#include <color_fragment>',`#include <color_fragment>\n${fragment}`);
  if(glow)shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\n totalEmissiveRadiance+=uGlow*popGlow;');
 };
 material.customProgramCacheKey=()=>key;
 return material;
}

const noRaycast=()=>{};
const RAYCAST=T.Mesh.prototype.raycast;

/* createPopupSet({ tier, labels, stamp, palette, castShadow, ease, paperNormal, normalScale }) → PopupSet
     labels(entry) → { texture, rect: [u0, v0, u1, v1], aspect } | null   label atlas slot for this entry
                                                                           (textures.labelSlot); null = blank
     stamp: Texture | null                                                  the shared 256² stamp mask (.r)
     paperNormal: Texture | null                                            optional tooth normal (textures.paper())
   PopupSet = {
     group,                                    add to the book group (page frame)
     show(view | entries, { animate=false })   lay out ≤ 3 pieces; completion changes on the same ids animate
                                                when animate is true (Mark done / Undo), otherwise cut
     pose(pose)                                the surfaces the feet stand on (see the header); re-solves
                                                only when θ moves > 0.002 rad, or flat/hover/spec change
     update(dt, { motion }) → busy             advances done/undo, arrival and hover; motion false = cut
     arrive({ delay = 0, stagger = .14, duration = .82 })   rise 0 → 1, largest first (back.out(1.15))
     setRise(v)                                cut the rise (paused frame and poster use 1 or hide the set)
     setFocus(id | null)                       caption hover/focus → lean −4°, scale 1.03, ink frame
     setInteractive(on)                        shown spread, settled, handoff 0 (engine-owned conditions)
     setCamera(vector3InPageFrame)             for the facing test; picking is off for tags facing away
     setPalette(palette | (a, b, t))           uniform values only; theme changes never repaint
     setTier(tier)                             segment count (24 high, 12 mid) and halo vs bloom
     setVisible(on)
     meshes()                                  pickable meshes; userData.popup = { id, open, kind }
     footShadows()                             { left, right: Float32Array(12) rects, k: Float32Array(3) }
     emitting()                                true when a dark-theme glow is visible (bloom gate)
     stats(), dispose()
   } */
export function createPopupSet({tier='high',labels=null,stamp=null,palette=PALETTES.dark,castShadow=true,ease=name=>EASES[name]||EASES.linear,
 paperNormal=null,normalScale=.18}={}){
 const group=new T.Group();group.name='popups';
 const colors={};for(const key of ['paper','ink','accent','urgent','pencil','wash','glow'])colors[key]=new T.Color();
 let dark=1,segments=SEGMENTS[tier]||SEGMENTS.mid,haloMode=tier!=='high',interactive=false,visible=true;
 let pose=restPose(),poseKey='',camera=null,focusId=null,dirty=true,disposed=false;
 const surfaceKey=x=>x?.sheet?`s${(+x.sheet.turn||0).toFixed(4)},${(+x.sheet.radius||0).toFixed(6)},${x.sheet.z??(x.sheet.stackZ||[]).join(':')},${x.sheet.dip||0}`
  :`r${(+x?.z||0).toFixed(6)},${x?.dip||0}`;
 const keyOf=q=>`${surfaceKey(q?.left)}|${surfaceKey(q?.right)}`;
 const blank=new T.DataTexture(new Uint8Array(4),1,1);blank.needsUpdate=true;
 // Paper tooth on the pop-up stock (textures.paper().normal), when the engine shares it.
 const stock=()=>paperNormal?{normalMap:paperNormal,normalScale:new T.Vector2(normalScale,normalScale)}:{};
 const pieces=[];
 setPalette(palette);

 function makePiece(){
  const strips=[0,1].map(()=>{
   const uniforms={uWash:{value:new T.Color()},uWashK:{value:0},uPencil:{value:colors.pencil},uSat:{value:1},uLift:{value:0}};
   const material=patch(new T.MeshStandardMaterial({color:colors.paper,roughness:.9,metalness:0,side:T.DoubleSide,...stock()}),uniforms,STRIP_FRAGMENT,'book-popup-strip-1');
   const geometry=new T.BufferGeometry();
   const mesh=new T.Mesh(geometry,material);mesh.name='popup-strip';mesh.castShadow=castShadow;mesh.receiveShadow=true;mesh.frustumCulled=false;
   return {mesh,geometry,material,uniforms,capacity:0};
  });
  const tagUniforms={uAtlas:{value:blank},uRect:{value:new T.Vector4(0,0,1,1)},uInk:{value:colors.ink},uAccent:{value:new T.Color()},
   uPencil:{value:colors.pencil},uFrameW:{value:new T.Vector2(.04,.04)},uFrameOn:{value:0},uHoverInk:{value:0},
   uStamp:{value:stamp||blank},uStampK:{value:0},uStampRot:{value:0},uStampScale:{value:.9},uStampColor:{value:new T.Color()},uAspect:{value:2},
   uSat:{value:1},uLift:{value:0},uGlow:{value:new T.Color(0,0,0)}};
  const tagMaterial=patch(new T.MeshStandardMaterial({color:colors.paper,roughness:.86,metalness:0,side:T.DoubleSide,...stock()}),tagUniforms,TAG_FRAGMENT,'book-popup-tag-1',{glow:true});
  const tagGeometry=new T.BufferGeometry();
  tagGeometry.setAttribute('position',new T.Float32BufferAttribute(new Float32Array(24),3).setUsage(T.DynamicDrawUsage));
  tagGeometry.setAttribute('normal',new T.Float32BufferAttribute(new Float32Array(24),3).setUsage(T.DynamicDrawUsage));
  tagGeometry.setAttribute('uv',new T.Float32BufferAttribute([0,0,.5,0,0,1,.5,1,.5,0,1,0,.5,1,1,1],2));
  tagGeometry.setIndex([0,1,2,1,3,2,4,5,6,5,7,6]);
  // A completed tag lies on its own flattened arch: bias it toward the camera so the two never z-fight.
  tagMaterial.polygonOffset=true;tagMaterial.polygonOffsetFactor=-1;tagMaterial.polygonOffsetUnits=-2;
  const tag=new T.Mesh(tagGeometry,tagMaterial);tag.name='popup-tag';tag.castShadow=castShadow;tag.receiveShadow=true;tag.frustumCulled=false;
  const haloMaterial=new T.ShaderMaterial({uniforms:{uColor:{value:colors.glow},uOpacity:{value:0}},vertexShader:HALO_VERTEX,
   fragmentShader:/* glsl */`uniform vec3 uColor;uniform float uOpacity;varying vec2 vUv;
    void main(){vec2 p=abs(vUv-.5)*2.;vec2 q=max(p-vec2(.66,.5),0.)/vec2(.34,.5);float a=1.-smoothstep(0.,1.,length(q));gl_FragColor=vec4(uColor*uOpacity*a,1.);}`,
   transparent:true,blending:T.AdditiveBlending,depthWrite:false,side:T.DoubleSide,toneMapped:false});
  const haloGeometry=new T.BufferGeometry();
  haloGeometry.setAttribute('position',new T.Float32BufferAttribute(new Float32Array(12),3).setUsage(T.DynamicDrawUsage));
  haloGeometry.setAttribute('uv',new T.Float32BufferAttribute([0,0,1,0,0,1,1,1],2));
  haloGeometry.setIndex([0,1,2,1,3,2]);
  const halo=new T.Mesh(haloGeometry,haloMaterial);halo.name='popup-halo';halo.frustumCulled=false;halo.visible=false;halo.renderOrder=2;
  const root=new T.Group();root.add(strips[0].mesh,strips[1].mesh,tag,halo);root.visible=false;group.add(root);
  for(const m of [strips[0].mesh,strips[1].mesh,tag])m.raycast=noRaycast;
  return {root,strips,tag,tagGeometry,tagMaterial,tagUniforms,halo,haloGeometry,haloMaterial,
   layout:null,entry:null,look:STATE_LOOK.none,solution:null,lastTheta:null,
   flat:0,sat:1,lift:0,stampK:0,stampScale:1,rise:1,hover:0,timeline:null,riseRun:null,label:null};
 }
 for(let i=0;i<3;i++)pieces.push(makePiece());

 function ensureStrip(strip,count){
  // (count) cross-section samples × 2 edges; buffers sized for the high tier and reused.
  const need=Math.max(count,SEGMENTS.high+2);
  if(strip.capacity>=need)return;
  strip.capacity=need;
  const g=strip.geometry;
  g.setAttribute('position',new T.Float32BufferAttribute(new Float32Array(need*6),3).setUsage(T.DynamicDrawUsage));
  g.setAttribute('normal',new T.Float32BufferAttribute(new Float32Array(need*6),3).setUsage(T.DynamicDrawUsage));
  g.setAttribute('uv',new T.Float32BufferAttribute(new Float32Array(need*4),2).setUsage(T.DynamicDrawUsage));
  const index=[];
  for(let i=0;i<need-1;i++){const a=i*2,b=a+1,c=a+2,d=a+3;index.push(a,c,b,c,d,b);}
  g.setIndex(index);
 }

 function writeStrip(strip,solved){
  const pts=solved.points,n=pts.length;ensureStrip(strip,n);
  const g=strip.geometry,pos=g.attributes.position.array,nor=g.attributes.normal.array,uv=g.attributes.uv.array;
  let total=0;const acc=[0];
  for(let i=1;i<n;i++){total+=Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]);acc.push(total);}
  for(let i=0;i<n;i++){
   const a=pts[Math.max(0,i-1)],b=pts[Math.min(n-1,i+1)];
   const [tx,tz]=norm2(b[0]-a[0],b[1]-a[1]),nx=-tz,nz=tx;
   const [x,z]=pts[i],u=total>0?acc[i]/total:0;
   pos.set([x,solved.y0,z,x,solved.y1,z],i*6);
   nor.set([nx,0,nz,nx,0,nz],i*6);
   uv.set([u,0,u,1],i*4);
  }
  g.setDrawRange(0,(n-1)*6);
  g.attributes.position.needsUpdate=g.attributes.normal.needsUpdate=g.attributes.uv.needsUpdate=true;
  g.computeBoundingSphere();
 }

 function writeTag(p,tag){
  const corners=tagCorners(tag),g=p.tagGeometry,pos=g.attributes.position.array,nor=g.attributes.normal.array;
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const unit=v=>{const l=Math.hypot(...v)||1;return v.map(x=>x/l);};
  const nl=unit(cross(tag.c,tag.l)),nr=unit(cross(tag.r,tag.c));
  corners.forEach((v,i)=>{pos.set(v,i*3);nor.set(i<4?nl:nr,i*3);});
  g.attributes.position.needsUpdate=g.attributes.normal.needsUpdate=true;g.computeBoundingSphere();
  // Halo: a quad 1.5× the tag around its centre, in the tag's plane (mid tier, dark theme, urgent only).
  const centre=[0,1,2].map(k=>tag.G[k]+tag.c[k]*tag.h/2),ex=(tag.wl+tag.wr)*.75,ey=tag.h*.75;
  const ax=unit([tag.r[0]-tag.l[0],tag.r[1]-tag.l[1],tag.r[2]-tag.l[2]]);
  const hp=p.haloGeometry.attributes.position.array;
  [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([sx,sy],i)=>hp.set([0,1,2].map(k=>centre[k]+ax[k]*ex*sx+tag.c[k]*ey*sy-(nl[k]+nr[k])*.0004),i*3));
  p.haloGeometry.attributes.position.needsUpdate=true;p.haloGeometry.computeBoundingSphere();
  return unit([nl[0]+nr[0],nl[1]+nr[1],nl[2]+nr[2]]);
 }

 function solve(p,force){
  if(!p.layout)return false;
  const effective=1-(1-p.flat)*p.rise;
  const hg=hinge(pose,p.layout.y,p.layout.spec.strips[0].aL,p.layout.spec.strips[0].aR);
  // θ moving less than 0.002 rad does not re-solve (§5.3 step 7); surface heights, a turning sheet's shape
  // (which presses the piece) and flat/hover/segments always do.
  const key=`${effective.toFixed(5)}|${p.hover.toFixed(4)}|${segments}|${poseKey}`;
  if(!force&&p.lastTheta!==null&&Math.abs(hg.theta-p.lastTheta)<=.002&&p.lastKey===key&&!dirty)return false;
  p.lastTheta=hg.theta;p.lastKey=key;
  p.solution=solvePiece(p.layout,pose,{flat:effective,hover:p.hover,segments});
  p.layout.spec.strips.forEach((s,i)=>writeStrip(p.strips[i],p.solution.strips[i]));
  p.strips[1].mesh.visible=p.layout.spec.strips.length>1;
  p.tagNormal=writeTag(p,p.solution.tag);
  return true;
 }

 function applyLook(p){
  const look=p.look,u=p.tagUniforms,spec=p.layout?.spec;
  if(!spec)return;
  p.layout.spec.strips.forEach((s,i)=>{
   const su=p.strips[i].uniforms;su.uWash.value.copy(colors.wash);su.uWashK.value=Math.min(1,s.wash+look.wash);
   su.uSat.value=p.sat;su.uLift.value=p.lift;
  });
  u.uAccent.value.copy(look.urgent?colors.urgent:colors.accent);
  u.uFrameOn.value=look.frame;u.uHoverInk.value=p.hover;
  u.uSat.value=p.sat;u.uLift.value=p.lift;u.uStampK.value=p.stampK;u.uStampScale.value=.82*p.stampScale;
  u.uStampColor.value.copy(colors.accent);
  // Light theme: nothing above 0.9 emits, so nothing blooms; urgency is the frame colour (§5.3).
  const glow=dark&&!haloMode?look.glow:0;
  u.uGlow.value.copy(colors.glow).multiplyScalar(glow);
  p.halo.visible=!!(dark&&haloMode&&look.halo&&visible&&p.root.visible);
  p.haloMaterial.uniforms.uOpacity.value=look.halo;
  const aspect=spec.tag.w/spec.tag.h;u.uAspect.value=aspect;
  u.uFrameW.value.set(.045/aspect,.045);
 }

 function label(p){
  const slot=p.entry&&labels?labels(p.entry):null;
  p.label=slot;
  p.tagUniforms.uAtlas.value=slot?.texture||blank;
  if(slot?.rect)p.tagUniforms.uRect.value.set(...slot.rect);else p.tagUniforms.uRect.value.set(0,0,1,1);
 }

 function show(input,{animate=false}={}){
  if(disposed)return;
  const layout=layoutSpread(input);
  const previous=new Map(pieces.filter(p=>p.layout).map(p=>[p.layout.id,p]));
  const states=new Map([...previous].map(([id,p])=>[id,{flat:p.flat,sat:p.sat,lift:p.lift,stampK:p.stampK,stampScale:p.stampScale,rise:p.rise,hover:p.hover,completed:!!p.entry?.completed}]));
  pieces.forEach((p,i)=>{
   const piece=layout.pieces[i];
   p.timeline=null;
   if(!piece){p.layout=null;p.entry=null;p.root.visible=false;for(const m of [...p.strips.map(s=>s.mesh),p.tag])m.raycast=noRaycast;return;}
   const before=states.get(piece.id),done=!!piece.entry.completed;
   p.layout=piece;p.entry=piece.entry;p.look=lookFor(piece.entry);p.lastTheta=null;
   const userData={popup:{id:piece.id,open:piece.entry.open??null,kind:piece.spec.kind}};
   for(const m of [...p.strips.map(s=>s.mesh),p.tag])m.userData=userData;
   p.tagUniforms.uStampRot.value=stampAngle(piece.id);
   if(before){Object.assign(p,{flat:before.flat,sat:before.sat,lift:before.lift,stampK:before.stampK,stampScale:before.stampScale,rise:before.rise,hover:before.hover});}
   else Object.assign(p,{rise:1,hover:0});
   const end=done?{flat:1,sat:.15,lift:.06,stampK:.85,stampScale:1}:{flat:0,sat:piece.entry.passed?.6:1,lift:0,stampK:0,stampScale:1};
   if(before&&animate&&before.completed!==done)p.timeline=done?doneTimeline(p,end):undoTimeline(p,end);
   else Object.assign(p,end);
   p.root.visible=visible;
   label(p);applyLook(p);
  });
  dirty=true;solveAll(true);
 }

 /* Mark done: flatten 480 ms power2.in → desaturate 260 ms → stamp 180 ms (scale 1.15 → 1, opacity 0 → .85).
    Undo: stamp out 140 ms → resaturate 220 ms → re-raise 620 ms back.out(1.1). */
 function doneTimeline(p,end){
  const from={flat:p.flat,sat:p.sat,lift:p.lift};
  return [
   {d:.48,e:ease('power2.in'),f:k=>{p.flat=lerp(from.flat,1,k);}},
   {d:.26,e:ease('power2.out'),f:k=>{p.sat=lerp(from.sat,end.sat,k);p.lift=lerp(from.lift,end.lift,k);}},
   {d:.18,e:ease('power3.out'),f:k=>{p.stampK=.85*k;p.stampScale=lerp(1.15,1,k);}}
  ].map(s=>({...s,t:0}));
 }
 function undoTimeline(p,end){
  const from={stampK:p.stampK,sat:p.sat,lift:p.lift,flat:p.flat};
  return [
   {d:.14,e:ease('power2.out'),f:k=>{p.stampK=lerp(from.stampK,0,k);}},
   {d:.22,e:ease('power2.out'),f:k=>{p.sat=lerp(from.sat,end.sat,k);p.lift=lerp(from.lift,0,k);}},
   {d:.62,e:ease('back.out(1.1)'),f:k=>{p.flat=from.flat*(1-k);}}
  ].map(s=>({...s,t:0}));
 }
 function finish(p){
  if(!p.timeline)return;
  for(const step of p.timeline)step.f(1);
  p.timeline=null;
 }

 function solveAll(force){
  let changed=false;
  for(const p of pieces)if(p.layout&&solve(p,force)){changed=true;}
  dirty=false;
  refreshPicking();
  return changed;
 }

 function refreshPicking(){
  for(const p of pieces){
   if(!p.layout)continue;
   const sol=p.solution,done=!!p.entry.completed;
   let facing=true;
   if(camera&&sol&&!done&&p.tagNormal){
    const t=sol.tag,cx=t.G[0]+t.c[0]*t.h/2,cy=t.G[1]+t.c[1]*t.h/2,cz=t.G[2]+t.c[2]*t.h/2;
    facing=(camera.x-cx)*p.tagNormal[0]+(camera.y-cy)*p.tagNormal[1]+(camera.z-cz)*p.tagNormal[2]>0;
   }
   const on=interactive&&visible&&p.root.visible&&p.rise>=.99&&(done||(sol?.raise??0)>=.2)&&facing&&!p.timeline;
   for(const m of [...p.strips.slice(0,p.layout.spec.strips.length).map(s=>s.mesh),p.tag])m.raycast=on?RAYCAST:noRaycast;
  }
 }

 function setPalette(a,b,t){
  const mixKey=(key)=>{
   if(b===undefined){colors[key].set(a[key]);return;}
   const c0=new T.Color(a[key]),c1=new T.Color(b[key]);colors[key].copy(c0).lerp(c1,t);
  };
  for(const key of Object.keys(colors))mixKey(key);
  dark=b===undefined?(a.dark??1):lerp(a.dark??1,b.dark??1,t);
  for(const p of pieces){p.tag?.material?.color.copy(colors.paper);for(const s of p.strips||[])s.material.color.copy(colors.paper);if(p.layout)applyLook(p);}
 }

 const set={
  group,show,
  pose(next){pose=next||restPose();poseKey=keyOf(pose);solveAll(false);},
  update(dt,{motion=true}={}){
   let busy=false;
   for(const p of pieces){
    if(!p.layout)continue;
    let changed=false;
    if(p.timeline){
     if(!motion)finish(p);
     else{
      let left=dt;
      while(p.timeline&&left>0){
       const step=p.timeline[0],take=Math.min(left,step.d-step.t);step.t+=take;left-=take;
       step.f(step.e(Math.min(1,step.t/step.d)));
       if(step.t>=step.d-1e-9){p.timeline.shift();if(!p.timeline.length)p.timeline=null;}
      }
     }
     changed=true;
    }
    if(p.riseRun){
     const r=p.riseRun;
     if(!motion){p.rise=1;p.riseRun=null;}
     else{r.t+=dt;const k=clamp((r.t-r.delay)/r.duration,0,1);p.rise=k<=0?0:ease('back.out(1.15)')(k);if(k>=1){p.rise=1;p.riseRun=null;}}
     changed=true;
    }
    const target=focusId!=null&&p.layout.id===focusId?1:0;
    if(p.hover!==target){
     p.hover=motion?(Math.abs(target-p.hover)<.01?target:lerp(p.hover,target,1-Math.exp(-dt/.08))):target;
     changed=true;
    }
    if(changed){applyLook(p);solve(p,false);}
    busy||=!!(p.timeline||p.riseRun||p.hover!==target);
   }
   refreshPicking();
   return busy;
  },
  arrive({delay=0,stagger=.14,duration=.82}={}){
   const order=pieces.filter(p=>p.layout).sort((a,b)=>b.layout.spec.height-a.layout.spec.height);
   order.forEach((p,i)=>{p.rise=0;p.riseRun={t:0,delay:delay+i*stagger,duration};solve(p,true);});
   refreshPicking();
  },
  setRise(v){for(const p of pieces){p.riseRun=null;p.rise=clamp(Number(v)||0,0,1.2);if(p.layout)solve(p,true);}refreshPicking();},
  setFocus(id){focusId=id==null?null:String(id);},
  setInteractive(on){interactive=!!on;refreshPicking();},
  setCamera(v){camera=v?{x:v.x,y:v.y,z:v.z}:null;refreshPicking();},
  setPalette(a,b,t){setPalette(a,b,t);},
  setTier(next){
   const n=SEGMENTS[next]||SEGMENTS.mid;haloMode=next!=='high';
   if(n!==segments){segments=n;dirty=true;solveAll(true);}
   for(const p of pieces)if(p.layout)applyLook(p);
  },
  setVisible(on){visible=!!on;group.visible=visible;for(const p of pieces)if(p.layout)applyLook(p);refreshPicking();},
  meshes(){return pieces.filter(p=>p.layout).flatMap(p=>[p.tag,...p.strips.slice(0,p.layout.spec.strips.length).map(s=>s.mesh)]);},
  pieces(){return pieces.filter(p=>p.layout).map(p=>({id:p.layout.id,layout:p.layout,solution:p.solution,flat:p.flat,rise:p.rise,hover:p.hover,label:p.label}));},
  footShadows(){
   const live=pieces.filter(p=>p.layout);
   return footRects(live.map(p=>p.layout),live.map(p=>p.solution),{dark:dark>=.5,flats:live.map(p=>1-(1-p.flat)*p.rise)});
  },
  emitting(){return !!(dark>=.5&&!haloMode&&visible&&pieces.some(p=>p.layout&&p.root.visible&&p.look.glow>0&&(p.solution?.raise??0)>.05));},
  refreshLabels(){for(const p of pieces)if(p.layout)label(p);},
  stats(){return {pieces:pieces.filter(p=>p.layout).length,segments,halo:haloMode,interactive,
   pickable:pieces.reduce((n,p)=>n+[...p.strips.map(s=>s.mesh),p.tag].filter(m=>m.raycast!==noRaycast).length,0)};},
  dispose(){
   if(disposed)return;disposed=true;
   for(const p of pieces){
    for(const s of p.strips){s.geometry.dispose();s.material.dispose();}
    p.tagGeometry.dispose();p.tagMaterial.dispose();p.haloGeometry.dispose();p.haloMaterial.dispose();
   }
   blank.dispose();group.removeFromParent();group.clear();pieces.length=0;
  }
 };
 return set;
}
