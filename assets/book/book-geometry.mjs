/* The sketchbook as an object (semester-book spec §5.1, §5.5). Procedural geometry only, in the book frame
   (x across from the spine, y from the tail to the head, z up from the inner board surface). Every builder
   returns plain Three objects plus a dispose(); the scene owns placement and theme values.

   Exports
     blockHeights(index, count, total)   {zL, zR} (§5.1, set on settle)
     createBoards(style, materials)      the two cover boards (rounded-rect extrusions, square at the spine)
     createBlock(style, material)        one half of the text block: fore-edge, head and tail walls whose
                                         top follows the page surface into the gutter valley
     createBlotter(style, material)      the felt pad the book lies on
     createContactShadow(style)          the baked radial quad under the book (every tier)
     createShadowCatcher()               ShadowMaterial plane beyond the pad (desk shadows; high tier)
     createRibbon(style, material)       ribbon strip; .layout({mode, z, tail}) rebuilds its path
     createBand(style, material)         elastic closure; .layout({open}) rebuilds both visible wraps
     createSpine(style, material)        rounded spine shell (visible during close and dock)
     createEdgeMaterial(theme)           the block edge shader (page lines, signature gaps, fwidth fade) */
import * as T from '../app/three.mjs?v=20261013-stage1';
import {gutterDip,dipDepth,GUTTER} from './page-bend.mjs?v=20261013-book1';

const clamp=(value,low,high)=>Math.min(high,Math.max(low,value));

/** §5.1: the left and right halves of the text block at spread `index`. */
export function blockHeights(index,count,total=.011){
 const span=Math.max(1,count-1),i=clamp(Number.isFinite(index)?index:0,0,span);
 const zL=Math.max(.0012,total*i/span),zR=Math.max(.0012,total-zL);
 return {zL,zR};
}

/* ---- rounded outlines ---- */
/** A rectangle with rounded corners only on the fore-edge side (sign +1: right board, −1: left). */
function boardShape(x0,x1,y0,y1,r,sign){
 const shape=new T.Shape();
 if(sign>0){
  shape.moveTo(x0,y0);shape.lineTo(x1-r,y0);shape.quadraticCurveTo(x1,y0,x1,y0+r);
  shape.lineTo(x1,y1-r);shape.quadraticCurveTo(x1,y1,x1-r,y1);shape.lineTo(x0,y1);shape.lineTo(x0,y0);
 }else{
  shape.moveTo(x1,y0);shape.lineTo(x1,y1);shape.lineTo(x0+r,y1);shape.quadraticCurveTo(x0,y1,x0,y1-r);
  shape.lineTo(x0,y0+r);shape.quadraticCurveTo(x0,y0,x0+r,y0);shape.lineTo(x1,y0);
 }
 return shape;
}
/* ExtrudeGeometry (non-indexed) puts both caps in group 0 and the sides in group 1. Split the caps so the
   inner face (z = zInner) and the outer cover can take different materials: group 0 = sides, 1 = inner cap,
   2 = outer cap. */
function splitCaps(geometry,zInner){
 const position=geometry.attributes.position,groups=geometry.groups;
 const caps=groups.find(g=>g.materialIndex===0),sides=groups.find(g=>g.materialIndex===1);
 if(!caps||!sides||geometry.index)return geometry;
 const inner=[],outer=[],side=[];
 for(let i=sides.start;i<sides.start+sides.count;i++)side.push(i);
 for(let i=caps.start;i<caps.start+caps.count;i+=3){
  const z=(position.getZ(i)+position.getZ(i+1)+position.getZ(i+2))/3;
  (Math.abs(z-zInner)<1e-5?inner:outer).push(i,i+1,i+2);
 }
 geometry.setIndex([...side,...inner,...outer]);
 geometry.clearGroups();
 geometry.addGroup(0,side.length,0);geometry.addGroup(side.length,inner.length,1);geometry.addGroup(side.length+inner.length,outer.length,2);
 return geometry;
}

/** The two boards. Right: x ∈ [gap, W + overhang]; left mirrored; y overhangs head and tail; z ∈ [−t, 0].
    The spine side is square and stops short of x = 0 so the boards never overlap. materials: [edge, inner, outer]. */
export function createBoards(style,materials){
 const {W,H,board}=style.dims,{thickness:t,radius:r,bevel:b,overhang:o}=board,gap=.0006;
 const build=sign=>{
  const x0=sign>0?gap:-W-o,x1=sign>0?W+o:-gap;
  const shape=boardShape(x0+b,x1-b,-o+b,H+o-b,Math.max(.0005,r-b),sign);
  const geometry=new T.ExtrudeGeometry(shape,{depth:t-2*b,bevelEnabled:true,bevelThickness:b,bevelSize:b,bevelOffset:0,bevelSegments:2,curveSegments:8});
  geometry.translate(0,0,-t+b);
  splitCaps(geometry,0);
  const mesh=new T.Mesh(geometry,materials);mesh.name=sign>0?'board-back':'board-front';mesh.receiveShadow=true;
  return mesh;
 };
 const right=build(1),left=build(-1),group=new T.Group();group.name='boards';group.add(left,right);
 // The hinge: spine cloth showing between the boards' bevels at the gutter.
 const hingeGeometry=new T.BoxGeometry(.004,H+2*o-.001,t-.0003);hingeGeometry.translate(0,H/2,-t/2-.00015);
 const hinge=new T.Mesh(hingeGeometry,Array.isArray(materials)?materials[0]:materials);hinge.name='hinge';hinge.receiveShadow=true;hinge.raycast=()=>{};
 return {group,left,right,hinge,dispose(){left.geometry.dispose();right.geometry.dispose();hingeGeometry.dispose();group.removeFromParent();hinge.removeFromParent();}};
}

/* ---- text block ---- */
/** One half of the block (sign +1 right, −1 left) with height z. Walls only: the top is the static page.
    The walls' top edge follows the page surface into the gutter valley so nothing pokes through. The
    attribute `edge` carries (height above the board, wall id) for the edge shader. */
function blockGeometry(W,H,z,corner,sign,{columns=28,cornerSteps=6}={}){
 const dip=dipDepth(z);
 const top=x=>z-gutterDip(x,dip);
 // Outline from the spine at the tail, round the fore edge, back to the spine at the head (flat coords).
 const outline=[];
 for(let i=0;i<=columns;i++){const x=(W-corner)*Math.pow(i/columns,1.35);outline.push([x,0,0,-1]);}
 for(let i=1;i<=cornerSteps;i++){const a=-Math.PI/2+Math.PI/2*i/cornerSteps;outline.push([W-corner+corner*Math.cos(a),corner+corner*Math.sin(a),Math.cos(a),Math.sin(a)]);}
 outline.push([W,H-corner,1,0]);
 for(let i=1;i<=cornerSteps;i++){const a=Math.PI/2*i/cornerSteps;outline.push([W-corner+corner*Math.cos(a),H-corner+corner*Math.sin(a),Math.cos(a),Math.sin(a)]);}
 for(let i=columns;i>=0;i--){const x=(W-corner)*Math.pow(i/columns,1.35);outline.push([x,H,0,1]);}
 const positions=[],normals=[],edge=[],index=[];
 outline.forEach(([x,y,nx,ny],i)=>{
  const h=top(x);
  positions.push(sign*x,y,0, sign*x,y,h);normals.push(sign*nx,ny,0, sign*nx,ny,0);edge.push(0,h, h,h);
  if(i>0){const a=2*(i-1),b2=a+1,c=a+2,d=a+3;if(sign>0)index.push(a,c,d,a,d,b2);else index.push(a,d,c,a,b2,d);}
 });
 // The spine-side wall closes the gutter between the halves.
 const base=positions.length/3,h0=top(0);
 positions.push(0,H,0, 0,H,h0, 0,0,0, 0,0,h0);normals.push(-sign,0,0,-sign,0,0,-sign,0,0,-sign,0,0);edge.push(0,h0,h0,h0,0,h0,h0,h0);
 if(sign>0)index.push(base,base+2,base+3,base,base+3,base+1);else index.push(base,base+3,base+2,base,base+1,base+3);
 const geometry=new T.BufferGeometry();
 geometry.setIndex(index);
 geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
 geometry.setAttribute('normal',new T.Float32BufferAttribute(normals,3));
 geometry.setAttribute('edge',new T.Float32BufferAttribute(edge,2));
 return geometry;
}
export function createBlock(style,material,sign){
 const {W,H,corner}=style.dims;
 const mesh=new T.Mesh(blockGeometry(W,H,.0055,corner,sign),material);
 mesh.name=sign>0?'block-right':'block-left';mesh.receiveShadow=true;
 let height=.0055;
 return {mesh,
  get height(){return height;},
  setHeight(z){if(Math.abs(z-height)<1e-7)return;height=z;const old=mesh.geometry;mesh.geometry=blockGeometry(W,H,z,corner,sign);old.dispose();},
  dispose(){mesh.geometry.dispose();mesh.removeFromParent();}};
}
/** Page edges seen from the side: a line per sheet, a darker gap every 16 sheets, both fading to their mean
    once they are finer than ~2 device px (fwidth), a soft darkening toward the board. */
export function createEdgeMaterial(theme){
 const uniforms={uEdgeBase:{value:new T.Color(theme.edge.base)},uEdgeLine:{value:new T.Color(theme.edge.line)},uEdgeGap:{value:new T.Color(theme.edge.gap)}};
 const material=new T.MeshStandardMaterial({color:0xffffff,roughness:.92,metalness:0});
 material.name='block-edge';
 material.onBeforeCompile=shader=>{
  Object.assign(shader.uniforms,uniforms);
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute vec2 edge;\nvarying vec2 vEdge;')
   .replace('#include <begin_vertex>','#include <begin_vertex>\nvEdge=edge;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
uniform vec3 uEdgeBase;uniform vec3 uEdgeLine;uniform vec3 uEdgeGap;varying vec2 vEdge;
float edgeLines(float coord,float width){float w=fwidth(coord);float d=abs(fract(coord)-.5);
 float line=1.0-smoothstep(.5-width-w,.5-width+w,d);return mix(line,width*2.0,smoothstep(.35,.7,w));}`)
   .replace('#include <map_fragment>',`
   float sheets=vEdge.x/.00011;
   float lines=edgeLines(sheets,.18);
   float gaps=edgeLines(sheets/16.0,.035);
   vec3 edgeColor=mix(uEdgeBase,uEdgeLine,lines*.75);
   edgeColor=mix(edgeColor,uEdgeGap,gaps);
   float topShade=smoothstep(0.0,.0015,vEdge.y-vEdge.x);
   edgeColor*=mix(1.0,.9,1.0-smoothstep(0.0,.004,vEdge.x))*mix(.94,1.0,topShade);
   diffuseColor.rgb*=edgeColor;`);
 };
 material.customProgramCacheKey=()=>'block-edge-1';
 return {material,uniforms};
}

/* ---- the pad, its shadows and the desk ---- */
function roundedRectGeometry(w,h,r,depth){
 const s=new T.Shape(),x=-w/2,y=-h/2;
 s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);s.lineTo(x+w,y+h-r);s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
 s.lineTo(x+r,y+h);s.quadraticCurveTo(x,y+h,x,y+h-r);s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);
 return new T.ExtrudeGeometry(s,{depth,bevelEnabled:true,bevelThickness:.0005,bevelSize:.0005,bevelSegments:2,curveSegments:10});
}
/** Felt pad 0.50 × 0.34 m under the book, its top at the boards' underside. */
export function createBlotter(style,material){
 const {W,H,board}=style.dims,depth=.0028;
 const geometry=roundedRectGeometry(.5-.001,.34-.001,.012,depth);
 geometry.translate(0,H/2,-board.thickness-depth-.0005);
 const mesh=new T.Mesh(geometry,material);mesh.name='blotter';mesh.receiveShadow=true;
 return {mesh,top:-board.thickness,dispose(){geometry.dispose();mesh.removeFromParent();}};
}
/** Soft grounding under the book: a radial falloff from the footprint, baked once (64² alpha). */
export function createContactShadow(style){
 const {W,H,board}=style.dims,size=64,data=new Uint8Array(size*size*4);
 const fw=2*(W+board.overhang),fh=H+2*board.overhang,qw=fw*1.25,qh=fh*1.25;
 for(let j=0;j<size;j++)for(let i=0;i<size;i++){
  const x=((i+.5)/size-.5)*qw,y=((j+.5)/size-.5)*qh;
  const dx=Math.max(0,Math.abs(x)-fw/2+.012),dy=Math.max(0,Math.abs(y)-fh/2+.012);
  const d=Math.hypot(dx,dy),core=Math.exp(-(d*d)/(2*.0105*.0105));
  const k=(j*size+i)*4,a=Math.round(255*clamp(core,0,1));data[k]=data[k+1]=data[k+2]=a;data[k+3]=255;
 }
 const texture=new T.DataTexture(data,size,size);texture.colorSpace=T.NoColorSpace;texture.magFilter=texture.minFilter=1006;texture.needsUpdate=true;
 const material=new T.MeshBasicMaterial({color:0x000000,transparent:true,opacity:.55,alphaMap:texture,depthWrite:false,toneMapped:false});
 material.name='contact-shadow';
 const geometry=new T.PlaneGeometry(qw,qh);geometry.translate(0,H/2,-board.thickness+.00015);
 const mesh=new T.Mesh(geometry,material);mesh.name='contact-shadow';mesh.renderOrder=1;mesh.raycast=()=>{};
 return {mesh,material,dispose(){geometry.dispose();material.dispose();texture.dispose();mesh.removeFromParent();}};
}
/** Catches the key light's shadows on the CSS desk around the pad (ShadowMaterial, transparent). */
export function createShadowCatcher(style){
 const {H,board}=style.dims,material=new T.ShadowMaterial({opacity:.35,depthWrite:false});
 const geometry=new T.PlaneGeometry(1.8,1.3);geometry.translate(0,H/2,-board.thickness-.0042);
 const mesh=new T.Mesh(geometry,material);mesh.name='desk-shadow';mesh.receiveShadow=true;mesh.raycast=()=>{};
 return {mesh,material,dispose(){geometry.dispose();material.dispose();mesh.removeFromParent();}};
}

/* ---- strips: ribbon and elastic ---- */
/** A flat band of `width` (across `side`) and `thickness` swept along a polyline of points [x, y, z] with
    per-point unit `up` (the band's face normal). Rounded nowhere; 4 faces per segment. */
function stripGeometry(points,ups,width,thickness,sideFor,{last=-1,tip=null,notch=0}={}){
 const positions=[],normals=[],uvs=[],index=[];let length=0;
 const v=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
 const corners=[[-.5,.5],[.5,.5],[.5,-.5],[-.5,-.5]];
 for(let i=0;i<points.length;i++){
  const p=points[i],up=ups[i],side=sideFor(i);
  if(i>0){const d=v(p,points[i-1]);length+=Math.hypot(...d);}
  for(const [s,u] of corners){
   const cut=i===last&&tip?notch*(Math.abs(s)*2):0;
   positions.push(p[0]+side[0]*s*width+up[0]*u*thickness+(tip?tip[0]*cut:0),p[1]+side[1]*s*width+up[1]*u*thickness+(tip?tip[1]*cut:0),p[2]+side[2]*s*width+up[2]*u*thickness);
   const n=u>0?up:[-up[0],-up[1],-up[2]];normals.push(...n);uvs.push(s+.5,length);
  }
 }
 for(let i=0;i<points.length-1;i++){
  const a=i*4,b=a+4;
  // top (0-1), bottom (2-3), and the two thin sides
  index.push(a,a+1,b+1,a,b+1,b, a+3,b+2,a+2,a+3,b+3,b+2, a+1,a+2,b+2,a+1,b+2,b+1, a,b,b+3,a,b+3,a+3);
 }
 const geometry=new T.BufferGeometry();
 geometry.setIndex(index);
 geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
 geometry.setAttribute('normal',new T.Float32BufferAttribute(normals,3));
 geometry.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));
 geometry.computeVertexNormals();
 return geometry;
}
const normalize=v=>{const l=Math.hypot(...v)||1;return [v[0]/l,v[1]/l,v[2]/l];};
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];

/** Ribbon marker. layout({mode:'gutter', zL, zR}) lies in today's gutter valley, drifting out at the style
    angle, and hangs over the tail edge onto the pad; layout({mode:'block', side, z, tail}) emerges from
    between the pages of the half that holds today, its tail longer the farther today is. */
export function createRibbon(style,material){
 const {H,board}=style.dims,{width,thickness,angle,tail}=style.ribbon,o=board.overhang;
 const mesh=new T.Mesh(new T.BufferGeometry(),material);mesh.name='ribbon';mesh.castShadow=false;mesh.receiveShadow=true;mesh.raycast=()=>{};
 const pad=-board.thickness+thickness/2+.00008;
 let key='';
 const bezier=(p0,p1,p2,p3,t)=>{const u=1-t;return p0.map((_,k)=>u*u*u*p0[k]+3*u*u*t*p1[k]+3*u*t*t*p2[k]+t*t*t*p3[k]);};
 function layout({mode='gutter',zL=.0055,zR=.0055,side=1,z=.0055,tail:out=tail}={}){
  const next=[mode,zL,zR,side,z,out].map(n=>typeof n==='number'?n.toFixed(5):n).join('|');
  if(next===key)return;key=next;
  const drift=Math.tan(angle*Math.PI/180)*H,points=[],ups=[];
  const halfZ=x=>x>=0?zR:zL;
  const surface=x=>halfZ(x)-gutterDip(Math.abs(x),dipDepth(halfZ(x)));
  const slope=x=>{const e=.0004;return (surface(x+e)-surface(x-e))/(2*e);};
  let start;
  if(mode==='gutter'){
   // From under the head of the gutter, lying in the valley, easing out toward the recto.
   for(let i=0;i<=28;i++){
    const u=i/28,y=H+.002-(H+.002)*u,x=.0016+drift*(u*u*(3-2*u))*.85+.0012*Math.sin(u*Math.PI*1.3);
    const lift=i===0?-.0004:0;
    points.push([x,y,surface(x)+thickness/2+.00012+lift]);
    const n=normalize([-slope(x),0,1]);ups.push(n);
   }
   start=points[points.length-1];
  }else{
   const x=side*(.008+drift*.55);
   points.push([x,.006,z]);ups.push([0,0,1]);start=[x,0,z];points.push(start);ups.push([0,0,1]);
  }
  // Over the tail edge and the board's overhang, onto the pad.
  const [xs,,zs]=start,landing=-o-.0075;
  for(let i=1;i<=14;i++){
   const t=i/14,p=bezier([xs,0,zs],[xs,-.0045,zs+.0004],[xs+.001*Math.sign(xs||1),-o-.0005,pad+.003],[xs+.0016*Math.sign(xs||1),landing,pad],t);
   const floor=p[1]>=-.0002?zs-.0008*(p[1]<0?1:0):p[1]>=-o-.0004?.0001+thickness/2:pad;
   p[2]=Math.max(p[2],floor);points.push(p);ups.push([0,0,1]);
  }
  const end=-o-Math.max(.006,out);
  for(let i=1;i<=8;i++){const t=i/8,x=xs+Math.sign(xs||1)*(.0016+.004*t*t);points.push([x,landing+(end-landing)*t,pad]);ups.push([0,0,1]);}
  // Frames: width across the path, faces along the surface normal where the ribbon lies on paper.
  for(let i=0;i<points.length;i++){
   const a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)],t=normalize([b[0]-a[0],b[1]-a[1],b[2]-a[2]]);
   const across=normalize(cross(t,ups[i]));let up=normalize(cross(across,t));if(up[2]<0)up=up.map(n=>-n);ups[i]=up;
  }
  const sides=points.map((_,i)=>{const a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)];return normalize(cross(normalize([b[0]-a[0],b[1]-a[1],b[2]-a[2]]),ups[i]));});
  // A dovetail cut at the end.
  const last=points.length-1,tip=normalize([points[last][0]-points[last-1][0],points[last][1]-points[last-1][1],0]);
  const old=mesh.geometry;
  mesh.geometry=stripGeometry(points,ups,width,thickness,i=>sides[i],{last,tip,notch:width*.55});
  old.dispose();
 }
 return {mesh,layout,dispose(){mesh.geometry.dispose();mesh.removeFromParent();}};
}

/** Elastic closure around the back board at x = band.x·W. Open (closed = 0): two short wraps over the board's
    head and tail edges that tuck under the block. layout({closed: k, top}) with k > 0 draws the loop round the
    shut book instead (top = height of the front board's outer face), lifted (1 − k)·20 mm above the cover
    while it snaps down (the engine eases k with elastic.out). */
export function createBand(style,material){
 const {H,board}=style.dims,{width,thickness,x:fraction}=style.band,x=fraction*style.dims.W,o=board.overhang,t=board.thickness;
 const group=new T.Group();group.name='band';
 const meshes=[0,1,2].map(()=>{const m=new T.Mesh(new T.BufferGeometry(),material);m.receiveShadow=true;m.raycast=()=>{};group.add(m);return m;});
 const frames=points=>{
  const ups=[];
  for(let i=0;i<points.length;i++){
   const a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)],tan=normalize([b[0]-a[0],b[1]-a[1],b[2]-a[2]]);
   ups.push(normalize(cross([1,0,0],tan)));
  }
  return ups;
 };
 function wrap(head){
  const s=head?1:-1,edge=head?H+o:-o,r=t/2+thickness/2,cz=-t/2,points=[];
  points.push([x,edge-s*.006,-t-thickness/2]);
  for(let i=0;i<=10;i++){const a=-Math.PI/2+Math.PI*i/10;points.push([x,edge+s*Math.cos(a)*r,cz+Math.sin(a)*r]);}
  points.push([x,edge-s*.0026,thickness/2]);points.push([x,edge-s*.0045,thickness/2-.0002]);
  const ups=frames(points).map((u,i)=>{const out=[0,points[i][1]-edge,points[i][2]-cz];return u[1]*out[1]+u[2]*out[2]<0?u.map(n=>-n):u;});
  return stripGeometry(points,ups,width,thickness,()=>[1,0,0]);
 }
 function loop(k,top){
  const lift=Math.max(0,1-k)*.02,z1=top+thickness/2+lift,z0=-t-thickness/2,y0=-o-thickness/2,y1=H+o+thickness/2,r=Math.min(.003,(z1-z0)/2);
  const pts=[],arc=(cy,cz,a0)=>{for(let i=0;i<=6;i++){const a=a0+Math.PI/2*i/6;pts.push([x,cy+Math.cos(a)*r,cz+Math.sin(a)*r]);}};
  arc(y1-r,z1-r,0);arc(y0+r,z1-r,Math.PI/2);arc(y0+r,z0+r,Math.PI);arc(y1-r,z0+r,1.5*Math.PI);pts.push(pts[0]);
  const cy=(y0+y1)/2,cz=(z0+z1)/2;
  const ups=frames(pts).map((u,i)=>{const out=[0,pts[i][1]-cy,pts[i][2]-cz];return u[1]*out[1]+u[2]*out[2]<0?u.map(n=>-n):u;});
  return stripGeometry(pts,ups,width,thickness,()=>[1,0,0]);
 }
 let key='';
 function layout({closed=0,top=.0134}={}){
  const next=closed>0?`c${closed.toFixed(4)}|${top.toFixed(5)}`:'open';
  if(next===key)return;key=next;
  const geometries=closed>0?[new T.BufferGeometry(),new T.BufferGeometry(),loop(closed,top)]:[wrap(true),wrap(false),new T.BufferGeometry()];
  meshes.forEach((mesh,i)=>{const old=mesh.geometry;mesh.geometry=geometries[i];old.dispose();});
 }
 layout();
 return {group,layout,dispose(){for(const m of meshes)m.geometry.dispose();group.removeFromParent();}};
}

/** The spine: a half-round shell under the gutter, 16 mm closed. Visible from the head and tail only while
    the book closes and docks; hidden at rest. */
export function createSpine(style,material){
 const {H,board,spine}=style.dims,r=spine/2;
 const geometry=new T.CylinderGeometry(r,r,H+2*board.overhang,20,1,true,Math.PI/2,Math.PI);
 geometry.rotateX(Math.PI/2);geometry.rotateZ(Math.PI);geometry.translate(0,H/2,-board.thickness+r*.15);
 const mesh=new T.Mesh(geometry,material);mesh.name='spine';mesh.visible=false;mesh.raycast=()=>{};
 return {mesh,dispose(){geometry.dispose();mesh.removeFromParent();}};
}

/* ---------------------------------------------------------------- framing (§5.7) ------------------------- */

const DEG=Math.PI/180;
/* Open-hero framing by viewport breakpoint: field of view, camera elevation and azimuth, the spread centre
   and the safe rectangle, normalised to the stage (x right, y down). */
export const OPEN_HERO=Object.freeze([
 Object.freeze({min:1001,fov:24,elevation:46,azimuth:6,centre:[.64,.46],safe:[.345,.07,.935,.93]}),
 Object.freeze({min:761,fov:26,elevation:52,azimuth:4,centre:[.5,.6],safe:[.05,.3,.95,.95]}),
 Object.freeze({min:0,fov:30,elevation:60,azimuth:0,centre:[.5,.53],safe:[.02,.05,.98,.96]})
]);
export const FIT_PADDING=.03;
const SPREAD={width:.296,page:.142,depth:.212};
export const framingFor=viewportWidth=>OPEN_HERO.find(pose=>viewportWidth>=pose.min)||OPEN_HERO[OPEN_HERO.length-1];

/** Where the open spread sits in a stage of width × height CSS px without a camera (the poster path and
    metrics before the first frame): the largest rect of the projected spread's aspect inside the safe
    rectangle around the book centre, less the fit padding. */
export function spreadLayout(width,height,viewportWidth=width){
 const pose=framingFor(viewportWidth),[cx,cy]=pose.centre,[x0,y0,x1,y1]=pose.safe;
 const aspect=SPREAD.width/(SPREAD.depth*Math.sin(pose.elevation*DEG));
 const halfW=Math.max(0,Math.min(cx-x0,x1-cx))*width,halfH=Math.max(0,Math.min(cy-y0,y1-cy))*height;
 const spreadWidth=Math.min(2*halfW,2*halfH*aspect)*(1-FIT_PADDING),spreadHeight=spreadWidth/aspect;
 return {pose,left:cx*width-spreadWidth/2,top:cy*height-spreadHeight/2,width:spreadWidth,height:spreadHeight,pageWidth:spreadWidth*SPREAD.page/SPREAD.width};
}

/** Book frame → world: the book group turns the frame so z is up and the tail faces the viewer, with the
    spread centre (0, H/2) at the origin (rotation.x = −π/2, position.z = H/2). */
export const bookToWorld=(p,H=.206)=>[p[0],p[2],H/2-p[1]];
export const worldToBook=(p,H=.206)=>[p[0],H/2-p[2],p[1]];

/** The open-hero camera for a stage (§5.7): elevation and azimuth from the breakpoint, the distance that
    keeps every book-frame point in `points` inside the safe rectangle (padding 3%), and a lens shift
    (setViewOffset) that puts the spread centre at the breakpoint's book centre. yaw/pitch (degrees) and
    dolly (a distance factor) are drift and arrival offsets applied after the fit. */
export function fitCamera(camera,width,height,viewportWidth,points,{H=.206,dolly=1,yaw=0,pitch=0,target=[0,.004,0],distance:fixed=null}={}){
 const pose=framingFor(viewportWidth),[cx,cy]=pose.centre,[x0,y0,x1,y1]=pose.safe,pad=FIT_PADDING/2;
 camera.fov=pose.fov;camera.aspect=width/Math.max(1,height);camera.clearViewOffset();camera.updateProjectionMatrix();
 const centre=new T.Vector3(...target),v=new T.Vector3();
 const place=(d,el,az)=>{const dir=[Math.sin(az)*Math.cos(el),Math.sin(el),Math.cos(az)*Math.cos(el)];camera.position.set(centre.x+dir[0]*d,centre.y+dir[1]*d,centre.z+dir[2]*d);camera.up.set(0,1,0);camera.lookAt(centre);camera.updateMatrixWorld(true);};
 const limits=[(cx-x0-pad)*width,(x1-cx-pad)*width,(cy-y0-pad)*height,(y1-cy-pad)*height];
 const el0=pose.elevation*DEG,az0=pose.azimuth*DEG;
 let distance=fixed??.9,limit='';
 if(fixed==null){
  const world=points.map(p=>new T.Vector3(...bookToWorld(p,H)));
  for(let i=0;i<8;i++){
   place(distance,el0,az0);
   const o=v.copy(centre).project(camera),ox=o.x,oy=o.y;let e=[0,0,0,0];
   for(const p of world){v.copy(p).project(camera);e=[Math.max(e[0],(ox-v.x)/2*width),Math.max(e[1],(v.x-ox)/2*width),Math.max(e[2],(v.y-oy)/2*height),Math.max(e[3],(oy-v.y)/2*height)];}
   const ratios=e.map((x,k)=>x/limits[k]),ratio=Math.max(...ratios);limit=['left','right','top','bottom'][ratios.indexOf(ratio)];
   if(!Number.isFinite(ratio)||ratio<=0)break;
   const next=distance*Math.pow(ratio,.9);if(Math.abs(next-distance)<1e-6){distance=next;break;}distance=next;
  }
 }
 const d=distance*dolly;place(d,el0+pitch*DEG,az0+yaw*DEG);
 camera.near=Math.max(.01,d*.08);camera.far=d*8;
 camera.setViewOffset(width,height,(.5-cx)*width,(.5-cy)*height,width,height);
 camera.updateProjectionMatrix();
 return {pose,distance,limit};
}
/** How much farther the fitted camera must be (a distance factor ≥ 1) so every book-frame point stays inside
    the stage less `inset` (normalised) on each side, measured from the lens-shifted spread centre. For the
    curl of a sheet in the air: the camera breathes out rather than letting the page leave the frame. */
export function containFactor(camera,width,height,viewportWidth,points,{H=.206,inset=.015,target=[0,.004,0]}={}){
 const pose=framingFor(viewportWidth),[cx,cy]=pose.centre,v=new T.Vector3();
 const o=v.set(...target).project(camera),ox=o.x,oy=o.y;
 const room=[(cx-inset)*width,(1-inset-cx)*width,(cy-inset)*height,(1-inset-cy)*height];
 let k=1;
 for(const p of points){
  v.set(...bookToWorld(p,H)).project(camera);
  const dx=(v.x-ox)/2*width,dy=(v.y-oy)/2*height;
  k=Math.max(k,dx<0?-dx/room[0]:dx/room[1],dy>0?dy/room[2]:-dy/room[3]);
 }
 return k;
}
/** Project book-frame points through a fitted camera into stage CSS px: their bounding rect. */
export function projectRect(camera,width,height,points,H=.206){
 const v=new T.Vector3();let l=Infinity,r=-Infinity,t=Infinity,b=-Infinity;
 for(const p of points){v.set(...bookToWorld(p,H)).project(camera);const x=(v.x+1)/2*width,y=(1-v.y)/2*height;l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);}
 return {left:l,top:t,width:r-l,height:b-t,right:r,bottom:b};
}

/* ---------------------------------------------------------------- picking (§5.10) ------------------------ */
/** The paper under a book-frame ray: live sheets (Sheet.hit, bendHit on the drawn chords) and the static
    pages (analytic planes at their stack height; the gutter valley is ignored). The nearest hit wins, so a
    static page under a sheet never wins. → {kind: 'sheet' | 'page', distance, x, y, face, side} | null
    sheets: [{sheet, front, back}] (face ids); statics: {left: {z, face}, right: {z, face}}. */
export function pickPaper(ray,{sheets=[],statics={},W=.142,H=.206}={}){
 const hits=[],{origin:o,direction:d}=ray,len=Math.hypot(d[0],d[1],d[2])||1;
 for(const live of sheets){
  const h=live.sheet.hit(ray);if(!h)continue;
  hits.push({kind:'sheet',distance:h.distance,x:h.x,y:h.y,top:h.face,face:h.face==='front'?live.front:live.back,side:h.face==='front'?'right':'left'});
 }
 for(const side of ['left','right']){
  const page=statics[side];if(!page||Math.abs(d[2])<1e-12)continue;
  const t=(page.z-o[2])/d[2];if(t<0)continue;
  const px=o[0]+d[0]*t,py=o[1]+d[1]*t,fx=side==='right'?px:-px;
  if(fx<0||fx>W||py<0||py>H)continue;
  hits.push({kind:'page',distance:t*len,x:fx,y:py,face:page.face,side,top:side==='right'?'front':'back'});
 }
 hits.sort((a,b)=>a.distance-b.distance);
 return hits[0]??null;
}
/** Face texture coordinates of a paper hit: L faces (and the back of a sheet) are painted mirrored. */
export const faceUV=(hit,W=.142,H=.206)=>({u:hit.top==='back'?1-hit.x/W:hit.x/W,v:hit.y/H});
/** Outer 12% corners turn pages; the rest of the outer 40% starts a drag too (§5.10). */
export const isCorner=(hit,W=.142,H=.206)=>hit.x>.88*W&&(hit.y<.12*H||hit.y>.88*H);
export const canDrag=(hit,W=.142,H=.206)=>!!hit&&(isCorner(hit,W,H)||hit.x>.6*W);
