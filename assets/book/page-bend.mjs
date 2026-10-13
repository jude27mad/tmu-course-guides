/* Turning sheets and the page material (semester-book spec §5.2, §5.4 composite, §5.5).

   Book frame = Codex's page frame: x across from the spine (recto +x, verso −x), y along the spine from the
   tail (0) to the head (H), z up from the inner board surface. A page is a zero-thickness sheet in flat
   coordinates x ∈ [0, W], y ∈ [0, H]; the vertex shader bends it with Codex's PAGE_BEND_GLSL, so a static
   right page is a sheet at turn 0 (front face up) and a static left page a sheet at turn 1 (back face up).
   Picking uses the same math on the CPU (bendHit with the mesh's x segments), so hit areas follow the paper.

   Exports
     bendPoint, bendBounds, bendHit, MIN_RADIUS_RATIO, PAGE_BEND_GLSL   re-exported from page-bend-math.mjs
     BEND_KEY                     program cache key shared by every bent material
     sheetRadius(t, v, W)         R(t, v) of §5.2
     gutterDip(x, depth)          the static gutter valley; dipWeight(t) its fade on a turning sheet
     applyBend(material, uniforms)   idempotent onBeforeCompile + customProgramCacheKey
     createPageUniforms(theme)    shared theme uniforms (one object per book, tweened on theme change)
     createPageMaterial(shared, {side, mirror, tier, toothMap})  → {material, uniforms}
     pagePlane(W, H, segX, segY, {gutter})                       → BufferGeometry in flat coordinates
     createSheet({W, H, shared, tier, toothMap})                 → Sheet
   Sheet = {group, front, back, set({turn, radius, stackZ, dip}), anchor(x, y), hingeDir(a, y), hit(ray),
            setFaces(front, back), setSegments(n), segments, params, visible, dispose()} */
import * as T from '../app/three.mjs?v=20261013-stage1';
import {bendPoint,bendBounds,bendHit,MIN_RADIUS_RATIO,PAGE_BEND_GLSL} from './page-bend-math.mjs';

export {bendPoint,bendBounds,bendHit,MIN_RADIUS_RATIO,PAGE_BEND_GLSL};
export const BEND_KEY='page-bend-1';
export const PAGE_KEY='page-ink-1';
export const SHEET_SEGMENTS=Object.freeze({high:96,mid:48});
export const SHEET_ROWS=Object.freeze({high:2,mid:1});
export const STATIC_SEGMENTS=Object.freeze({high:24,mid:1});
export const LIFT=.0002;      // a turning sheet rides this far above the stack it leaves or lands on
export const GUTTER=.018;     // width of the gutter valley and of the non-interactive gutter band (m)
export const DIP=.003;        // depth of the gutter valley (m)

const clamp=(value,low,high)=>Math.min(high,Math.max(low,value));
const smoothstep=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};

/** §5.2: tight while the sheet leaves and lands, a W/π hood mid-turn; faster gestures curl tighter. */
export function sheetRadius(t,v=0,W=.142){
 const turn=clamp(Number.isFinite(t)?t:0,0,1),speed=Number.isFinite(v)?Math.abs(v):0;
 const shape=Math.sin(Math.PI*turn)**.8;
 const r=(.14*W+(W/Math.PI-.14*W)*shape)*(1-Math.min(.3,.12*speed));
 return clamp(r,W*MIN_RADIUS_RATIO,W/Math.PI);
}
/** Depth of the gutter valley at flat x (static pages; the sheet multiplies it by dipWeight). The depth is
    capped by the half-block under it so the paper never sinks into the board. */
export const gutterDip=(x,depth=DIP)=>depth*(1-smoothstep(0,GUTTER,x));
export const dipWeight=turn=>1-smoothstep(0,.15,Math.min(turn,1-turn));
export const dipDepth=blockZ=>Math.min(DIP,.8*Math.max(0,blockZ));
/** Where flat x sits between the stack it leaves (0) and the one it lands on (1): 0 on the flat run before
    the fold, 1 once past it, the arc fraction inside it. The shader's pageStackMix. */
export function stackMix(x,turn,radius,W=.142){
 const t=clamp(Number.isFinite(turn)?turn:0,0,1);
 if(t<=0)return 0;if(t>=1)return 1;
 const r=clamp(Number.isFinite(radius)?radius:W/Math.PI,W*MIN_RADIUS_RATIO,W/Math.PI),arc=Math.PI*r,a=(1-t)*W-t*arc;
 return clamp((clamp(x,0,W)-a)/arc,0,1);
}

/* ---- program patches ----
   A material carries an ordered list of named patches; one onBeforeCompile applies them and the cache key
   joins their names, so every bent page shares one program per variant however many sheets exist. */
function patch(material,key,apply,uniforms){
 const list=material.userData.patches??=[];
 if(list.some(entry=>entry.key===key)){Object.assign(material.userData.uniforms??={},uniforms);return material;}
 list.push({key,apply});
 Object.assign(material.userData.uniforms??={},uniforms);
 material.onBeforeCompile=shader=>{
  Object.assign(shader.uniforms,material.userData.uniforms);
  for(const entry of material.userData.patches)entry.apply(shader);
 };
 material.customProgramCacheKey=()=>material.userData.patches.map(entry=>entry.key).join('+');
 material.needsUpdate=true;
 return material;
}
const replace=(source,token,code)=>{if(!source.includes(token))throw new Error(`page shader: ${token} missing`);return source.replace(token,code);};

const BEND_VERTEX_HEAD=/* glsl */`
uniform float uTurn;
uniform float uRadius;
uniform float uWidth;
uniform vec2 uStackZ;
uniform float uDip;
varying vec2 vFlat;
${PAGE_BEND_GLSL}
float pageDipWeight(float t){return 1.0-smoothstep(0.0,0.15,min(t,1.0-t));}
float pageStackMix(float s,float turn,float radius,float width){
 float t=clamp(turn,0.0,1.0);
 if(t<=0.0)return 0.0;
 if(t>=1.0)return 1.0;
 float arc=PAGE_BEND_PI*pageBendRadius(radius,width),a=(1.0-t)*width-t*arc;
 return clamp((clamp(s,0.0,width)-a)/max(arc,1e-6),0.0,1.0);
}
`;
/** §5.2 shader injection: bendNormal/bendPosition replace the stock vertex chunks; the stack height, the
    lift and the gutter valley (faded on a turning sheet) are added along z. Shadows and lighting read the
    bent `transformed`, so they follow the paper. */
export function applyBend(material,uniforms){
 return patch(material,BEND_KEY,shader=>{
  shader.vertexShader=replace(shader.vertexShader,'#include <common>','#include <common>\n'+BEND_VERTEX_HEAD);
  shader.vertexShader=replace(shader.vertexShader,'#include <beginnormal_vertex>',/* glsl */`
   float pageS=clamp(position.x,0.0,uWidth);
   float pageU=clamp(pageS/0.018,0.0,1.0);
   float pageSlope=-uDip*pageDipWeight(uTurn)*6.0*pageU*(1.0-pageU)/0.018;
   vec3 objectNormal=bendNormal(position,uTurn,uRadius,uWidth);
   objectNormal=normalize(objectNormal+vec3(pageSlope*step(0.5,abs(objectNormal.z)),0.0,0.0));
   #ifdef USE_TANGENT
    vec3 objectTangent=vec3(tangent.xyz);
   #endif`);
  shader.vertexShader=replace(shader.vertexShader,'#include <begin_vertex>',/* glsl */`
   vec3 transformed=bendPosition(position,uTurn,uRadius,uWidth);
   // Stack height follows the paper: the flat run still on the recto stack keeps its height, the curl
   // carries it across, the run that has landed takes the verso's (pageStackMix, mirrored on the CPU).
   transformed.z+=mix(uStackZ.x,uStackZ.y,pageStackMix(pageS,uTurn,uRadius,uWidth))-uDip*(1.0-smoothstep(0.0,0.018,pageS))*pageDipWeight(uTurn);
   vFlat=position.xy;
   #ifdef USE_ALPHAHASH
    vPosition=vec3(position);
   #endif`);
 },uniforms);
}

const PAGE_FRAGMENT_HEAD=/* glsl */`
uniform sampler2D uMask;
uniform sampler2D uMaskB;
uniform float uFade;
uniform float uMirror;
uniform float uDevelop;
uniform float uSide;
uniform vec3 uPaper;
uniform vec3 uPencil;
uniform vec3 uInkColor;
uniform vec3 uAccent;
uniform vec3 uSize;
uniform vec2 uAO;
uniform vec4 uCurl;
uniform vec4 uFoot[3];
uniform float uFootK[3];
varying vec2 vFlat;
float pageHash(vec2 p){p=fract(p*vec2(.1031,.1030));p+=dot(p,p.yx+33.33);return fract((p.x+p.y)*p.x);}
float pageNoise(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.0-2.0*f);
 return mix(mix(pageHash(i),pageHash(i+vec2(1,0)),u.x),mix(pageHash(i+vec2(0,1)),pageHash(i+vec2(1,1)),u.x),u.y);}
float footShade(vec4 rect,float k){
 if(k<=0.0)return 1.0;
 vec2 c=.5*(rect.xy+rect.zw),h=.5*abs(rect.zw-rect.xy);
 vec2 d=abs(vFlat-c)-h;
 float outside=length(max(d,0.0))+min(max(d.x,d.y),0.0);
 return 1.0-k*(1.0-smoothstep(-.002,.007,outside));
}
`;
/** §5.4 composite on top of MeshStandardMaterial: paper·tooth·gutter AO, then pencil (R), printed ink (G)
    and accent ink (B) masks. Graphite is glossier and faintly metallic. Rounded fore-edge corners, the curl
    shadow band and the pop-up feet contact shadows are analytic; uFade crossfades two faces (reduced
    motion). uDevelop scales the printed and accent ink (0 for posters and the start of the arrival). */
export function applyPage(material,uniforms){
 return patch(material,PAGE_KEY,shader=>{
  shader.fragmentShader=replace(shader.fragmentShader,'#include <common>','#include <common>\n'+PAGE_FRAGMENT_HEAD);
  shader.fragmentShader=replace(shader.fragmentShader,'#include <map_fragment>',/* glsl */`
   vec2 pageUv=vFlat/uSize.xy;
   pageUv.x=mix(pageUv.x,1.0-pageUv.x,uMirror);
   {
    float r=uSize.z;
    vec2 corner=vec2(uSize.x-r,clamp(vFlat.y,r,uSize.y-r));
    if(vFlat.x>uSize.x-r&&length(vFlat-corner)>r)discard;
   }
   vec3 pageMask=texture2D(uMask,pageUv).rgb;
   if(uFade>0.0)pageMask=mix(pageMask,texture2D(uMaskB,pageUv).rgb,uFade);
   pageMask.gb*=uDevelop;
   float pageTooth=1.0+.02*(pageNoise(vFlat*vec2(38.0,31.0))-.5)*2.0+.008*(pageNoise(vFlat*vec2(420.0,410.0))-.5);
   float pageAO=mix(uAO.x,1.0,smoothstep(0.0,uAO.y,vFlat.x));
   vec3 pageColor=uPaper*pageTooth*pageAO;
   pageColor=mix(pageColor,uPencil,pageMask.r);
   pageColor=mix(pageColor,uInkColor,pageMask.g);
   pageColor=mix(pageColor,uAccent,pageMask.b);
   float bookX=vFlat.x*uSide;
   if(uCurl.z>0.0){
    float d=(bookX-uCurl.x)*sign(uCurl.w);
    float band=exp(-pow(d/max(uCurl.y,1e-4),2.0)*1.6)*mix(1.0,.55,step(0.0,d));
    pageColor*=1.0-uCurl.z*band;
   }
   pageColor*=footShade(uFoot[0],uFootK[0])*footShade(uFoot[1],uFootK[1])*footShade(uFoot[2],uFootK[2]);
   diffuseColor.rgb*=pageColor;
   float pageGraphite=pageMask.r;`);
  shader.fragmentShader=replace(shader.fragmentShader,'#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\n roughnessFactor=mix(roughnessFactor,.42,pageGraphite);');
  shader.fragmentShader=replace(shader.fragmentShader,'#include <metalnessmap_fragment>','#include <metalnessmap_fragment>\n metalnessFactor=max(metalnessFactor,.12*pageGraphite);');
 },uniforms);
}

const blank=(()=>{let texture=null;return()=>{if(!texture){texture=new T.DataTexture(new Uint8Array([0,0,0,255]),1,1);texture.colorSpace=T.NoColorSpace;texture.needsUpdate=true;}return texture;};})();
const linear=hex=>new T.Color(hex);

/** Theme uniforms shared by every page material of one book; the engine tweens their values. */
export function createPageUniforms(theme,{W=.142,H=.206,corner=.005}={}){
 return {
  uPaper:{value:linear(theme.paper)},uPencil:{value:linear(theme.pencil)},uInkColor:{value:linear(theme.ink)},uAccent:{value:linear(theme.accent)},
  uAO:{value:new T.Vector2(theme.gutter.ao,theme.gutter.width*W)},
  uSize:{value:new T.Vector3(W,H,corner)},uDevelop:{value:1}
 };
}

/** One page material: its own bend and face uniforms, the book's shared theme uniforms.
    side 'front' renders FrontSide with u as painted; 'back' renders BackSide with u mirrored. */
export function createPageMaterial(shared,{side='front',tier='high',toothMap=null,normalScale}={}){
 const back=side==='back';
 const material=new T.MeshStandardMaterial({color:0xffffff,roughness:.9,metalness:0,side:back?T.BackSide:T.FrontSide});
 material.name=back?'page-back':'page-front';
 if(toothMap){material.normalMap=toothMap;const s=normalScale??(tier==='high'?.25:.15);material.normalScale=new T.Vector2(s,s);}
 const uniforms={
  uTurn:{value:back?1:0},uRadius:{value:shared.uSize.value.x/Math.PI},uWidth:{value:shared.uSize.value.x},
  uStackZ:{value:new T.Vector2(0,0)},uDip:{value:0},
  uMask:{value:blank()},uMaskB:{value:blank()},uFade:{value:0},uMirror:{value:back?1:0},uSide:{value:back?-1:1},
  uCurl:{value:new T.Vector4(0,.01,0,1)},
  uFoot:{value:[new T.Vector4(),new T.Vector4(),new T.Vector4()]},uFootK:{value:[0,0,0]},
  ...shared
 };
 applyBend(material,uniforms);
 applyPage(material,uniforms);
 return {material,uniforms};
}

/** A sheet in flat coordinates, x ∈ [0, W], y ∈ [0, H]. `gutter` adds columns inside the valley so a coarse
    static page still bends into it. Uniform columns are kept for turning sheets: bendHit assumes them. */
export function pagePlane(W,H,segX,segY=1,{gutter=false}={}){
 const xs=[];
 for(let i=0;i<=segX;i++)xs.push(W*i/segX);
 if(gutter){for(const x of [.0015,.003,.0045,.006,.008,.0105,.0135,GUTTER])if(x<W)xs.push(x);}
 const columns=[...new Set(xs.map(x=>+x.toFixed(7)))].sort((a,b)=>a-b);
 const positions=[],uvs=[],normals=[],index=[];
 for(let j=0;j<=segY;j++)for(const x of columns){const y=H*j/segY;positions.push(x,y,0);normals.push(0,0,1);uvs.push(x/W,y/H);}
 const n=columns.length;
 for(let j=0;j<segY;j++)for(let i=0;i<n-1;i++){const a=j*n+i,b=a+1,c=a+n,d=c+1;index.push(a,b,d,a,d,c);}
 const geometry=new T.BufferGeometry();
 geometry.setIndex(index);
 geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
 geometry.setAttribute('normal',new T.Float32BufferAttribute(normals,3));
 geometry.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));
 geometry.userData.segments=segX;
 return geometry;
}

/** A turning sheet: front (R(k)) and back (L(k+1)) meshes over one geometry, each with its own material
    instances so their uniforms are independent while the program is shared (BEND_KEY). */
export function createSheet({W=.142,H=.206,shared,tier='high',toothMap=null}={}){
 const group=new T.Group();group.name='sheet';group.visible=false;
 const front=createPageMaterial(shared,{side:'front',tier,toothMap}),back=createPageMaterial(shared,{side:'back',tier,toothMap});
 let segments=SHEET_SEGMENTS[tier]??SHEET_SEGMENTS.mid,rows=SHEET_ROWS[tier]??SHEET_ROWS.mid;
 let geometry=pagePlane(W,H,segments,rows);
 const frontMesh=new T.Mesh(geometry,front.material),backMesh=new T.Mesh(geometry,back.material);
 for(const mesh of [frontMesh,backMesh]){mesh.frustumCulled=false;mesh.receiveShadow=true;mesh.raycast=()=>{};group.add(mesh);}
 frontMesh.renderOrder=backMesh.renderOrder=2;
 const params={turn:0,radius:W/Math.PI,width:W,height:H};
 let stack=[0,0],dip=0;
 const sheet={
  group,front:frontMesh,back:backMesh,materials:{front,back},
  get segments(){return segments;},
  get params(){return params;},
  get visible(){return group.visible;},set visible(v){group.visible=!!v;},
  /** turn ∈ [0, 1]; radius from sheetRadius(); stackZ [z at turn 0, z at turn 1] (the lift is added);
      dip = gutter valley depth (faded by dipWeight). */
  set({turn=params.turn,radius=params.radius,stackZ=stack,dip:depth=dip}={}){
   params.turn=clamp(turn,0,1);params.radius=clamp(radius,W*MIN_RADIUS_RATIO,W/Math.PI);stack=[stackZ[0]+LIFT,stackZ[1]+LIFT];dip=depth;
   for(const {uniforms} of [front,back]){uniforms.uTurn.value=params.turn;uniforms.uRadius.value=params.radius;uniforms.uStackZ.value.set(stack[0],stack[1]);uniforms.uDip.value=dip;}
   return sheet;
  },
  /** The bent point of flat (x, y) in the book frame, as the shader places it. */
  anchor(x,y){
   const {position,normal}=bendPoint(x,y,params);
   const z=position[2]+sheet.stackAt(x)-gutterDip(clamp(x,0,W),dip)*dipWeight(params.turn);
   return {position:[position[0],position[1],z],normal};
  },
  /** Stack height (lift included) of flat x this frame. */
  stackAt(x){return stack[0]+(stack[1]-stack[0])*stackMix(x,params.turn,params.radius,W);},
  /** Unit direction from the spine point to flat x = a at height y: the pop-up hinge direction (§5.3). */
  hingeDir(a,y){
   const g=sheet.anchor(0,y).position,p=sheet.anchor(a,y).position,d=[p[0]-g[0],0,p[2]-g[2]],l=Math.hypot(d[0],d[2])||1;
   return [d[0]/l,0,d[2]/l];
  },
  /** ray: {origin:[x,y,z], direction:[x,y,z]} in the book frame. → {x, y, distance, face} | null.
      The same chords the mesh draws (its x segments, bendPoint plus the per-column stack height), so a hit
      lands on the visible paper; the gutter valley is ignored (≤ 3 mm, inside the 18 mm non-interactive band).
      face: 'front' when the ray meets the side bendPoint's normal points to. */
  hit(ray){
   if(!group.visible||!ray)return null;
   const o=ray.origin,d=ray.direction,m=Math.hypot(d[0],d[1],d[2]);
   if(!(m>0)||![...o,...d].every(Number.isFinite))return null;
   const dir=[d[0]/m,d[1]/m,d[2]/m],tol=1e-10*Math.max(W,H);
   const column=i=>{const x=W*i/segments,p=bendPoint(x,0,params).position;return [p[0],p[2]+sheet.stackAt(x)];};
   let best=null,left=column(0);
   for(let i=0;i<segments;i++){
    const right=column(i+1),vx=right[0]-left[0],vz=right[1]-left[1],den=dir[0]*vz-dir[2]*vx;
    if(den!==0){
     const ax=left[0]-o[0],az=left[1]-o[2],dist=(ax*vz-az*vx)/den,frac=(ax*dir[2]-az*dir[0])/den,y=o[1]+dist*dir[1];
     if(dist>=-tol&&frac>=-1e-10&&frac<=1+1e-10&&y>=-tol&&y<=H+tol&&(!best||dist<best.distance))
      best={x:W*(i+clamp(frac,0,1))/segments,y:clamp(y,0,H),distance:Math.max(0,dist)};
    }
    left=right;
   }
   if(!best)return null;
   const {normal}=bendPoint(best.x,best.y,params),dot=dir[0]*normal[0]+dir[1]*normal[1]+dir[2]*normal[2];
   return {...best,face:dot<0?'front':'back'};
  },
  setFaces(frontTexture,backTexture){
   front.uniforms.uMask.value=frontTexture||blank();back.uniforms.uMask.value=backTexture||blank();
  },
  setSegments(next,nextRows=rows){
   if(next===segments&&nextRows===rows)return;
   segments=next;rows=nextRows;const old=geometry;geometry=pagePlane(W,H,segments,rows);
   frontMesh.geometry=backMesh.geometry=geometry;old.dispose();
  },
  dispose(){geometry.dispose();front.material.dispose();back.material.dispose();group.removeFromParent();}
 };
 return sheet.set({turn:0,radius:W/Math.PI,stackZ:[0,0]});
}
