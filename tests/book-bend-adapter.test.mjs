/* The page-bend adapter (semester-book spec §5.2, §10.1): shader injection, the radius profile, sheets.
   Pure Node: the Three bundle is imported for real; shader sources come from Three's ShaderLib. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {ShaderLib} from '../tools/scene-build/node_modules/three/build/three.module.js';
import * as bend from '../assets/book/page-bend.mjs';
import * as math from '../assets/book/page-bend-math.mjs';

const W=.142,H=.206;
const compile=material=>{
 const shader={uniforms:{},vertexShader:ShaderLib.standard.vertexShader,fragmentShader:ShaderLib.standard.fragmentShader};
 material.onBeforeCompile(shader,null);
 return shader;
};
const shared=()=>bend.createPageUniforms({paper:'#efe6d2',pencil:'#5a5f61',ink:'#1f2624',accent:'#096450',gutter:{ao:.78,width:.12}},{W,H,corner:.005});

test('the patched shader replaces the stock vertex chunks with bendPosition and bendNormal, keyed by BEND_KEY',()=>{
 const {material,uniforms}=bend.createPageMaterial(shared(),{side:'front'});
 const shader=compile(material);
 assert.equal(bend.BEND_KEY,'page-bend-1');
 assert.ok(!shader.vertexShader.includes('#include <begin_vertex>'),'begin_vertex replaced');
 assert.ok(!shader.vertexShader.includes('#include <beginnormal_vertex>'),'beginnormal_vertex replaced');
 assert.match(shader.vertexShader,/vec3 transformed=bendPosition\(position,uTurn,uRadius,uWidth\);/);
 assert.match(shader.vertexShader,/vec3 objectNormal=bendNormal\(position,uTurn,uRadius,uWidth\);/);
 assert.ok(shader.vertexShader.includes(math.PAGE_BEND_GLSL.trim().split('\n')[0]),'Codex GLSL included once');
 assert.equal(shader.vertexShader.split('vec3 bendPosition(').length,2);
 assert.ok(material.customProgramCacheKey().split('+').includes(bend.BEND_KEY));
 // The page composite: masks in order paper → pencil → ink → accent, graphite roughness/metal.
 assert.ok(!shader.fragmentShader.includes('#include <map_fragment>'));
 const order=['pageColor=mix(pageColor,uPencil,pageMask.r)','pageColor=mix(pageColor,uInkColor,pageMask.g)','pageColor=mix(pageColor,uAccent,pageMask.b)'].map(s=>shader.fragmentShader.indexOf(s));
 assert.ok(order.every(i=>i>0)&&order[0]<order[1]&&order[1]<order[2],'composite order');
 assert.match(shader.fragmentShader,/roughnessFactor=mix\(roughnessFactor,\.42,pageGraphite\)/);
 for(const name of ['uTurn','uRadius','uWidth','uStackZ','uDip','uMask','uMaskB','uFade','uDevelop','uFoot','uFootK','uCurl'])assert.ok(shader.uniforms[name]===uniforms[name],name+' bound');
});

test('applyBend is idempotent and every bent material shares one program key per variant',()=>{
 const {material}=bend.createPageMaterial(shared(),{side:'front'});
 const before=material.customProgramCacheKey();
 bend.applyBend(material,{});bend.applyBend(material,{});
 assert.equal(material.customProgramCacheKey(),before);
 const shader=compile(material);
 assert.equal(shader.vertexShader.split('uniform float uTurn;').length,2,'patched once');
 const theme=shared(),a=bend.createPageMaterial(theme,{side:'front'}),b=bend.createPageMaterial(theme,{side:'back'});
 assert.equal(a.material.customProgramCacheKey(),b.material.customProgramCacheKey());
 assert.notEqual(a.uniforms.uTurn,b.uniforms.uTurn,'each material has its own bend uniforms');
 assert.equal(a.uniforms.uPaper,b.uniforms.uPaper,'theme uniforms are shared (one tween)');
});

test('R(t, v) stays within [W·MIN_RADIUS_RATIO, W/π], tight at the ends, the W/π hood mid-turn, tighter when fast',()=>{
 const lo=W*math.MIN_RADIUS_RATIO,hi=W/Math.PI;
 for(let i=0;i<=1000;i++){
  const t=i/1000;
  for(const v of [0,.5,2,8,-8,NaN,Infinity]){const r=bend.sheetRadius(t,v,W);assert.ok(Number.isFinite(r)&&r>=lo-1e-15&&r<=hi+1e-15,`t=${t} v=${v} r=${r}`);}
 }
 for(const t of [-1e-6,1+1e-6,NaN,-Infinity,Infinity])assert.ok(Number.isFinite(bend.sheetRadius(t,0,W)));
 assert.ok(Math.abs(bend.sheetRadius(.5,0,W)-hi)<1e-12,'hood at t = 0.5');
 assert.ok(Math.abs(bend.sheetRadius(0,0,W)-.14*W)<1e-12);
 assert.ok(bend.sheetRadius(.5,5,W)<bend.sheetRadius(.5,0,W),'fast gestures curl tighter');
 assert.ok(Math.abs(bend.sheetRadius(.5,99,W)-.7*hi)<1e-12,'the speed factor bottoms out at 0.7');
});

test('the segments used by Sheet.hit equal the mesh x segments per tier, and hits land on the drawn chords',()=>{
 for(const [tier,segX,segY] of [['high',96,2],['mid',48,1]]){
  const sheet=bend.createSheet({W,H,shared:shared(),tier});
  assert.equal(sheet.segments,segX);assert.equal(sheet.front.geometry.userData.segments,segX);
  const columns=new Set();const pos=sheet.front.geometry.attributes.position;for(let i=0;i<pos.count;i++)columns.add(pos.getX(i).toFixed(6));
  assert.equal(columns.size,segX+1,'uniform columns');assert.equal(pos.count,(segX+1)*(segY+1));
  sheet.set({turn:.37,radius:bend.sheetRadius(.37,0,W),stackZ:[.006,.005]});sheet.visible=true;
  // Rays arrive 1 cm off the paper along its normal, from either side: the hit is that point, on the drawn
  // chords (within half a segment), and the face is the side the ray came from.
  for(const x of [.01,.03,.06,.09,.11,.13])for(const y of [.02,.1,.19])for(const side of [1,-1]){
   const {position:p,normal:n}=sheet.anchor(x,y),origin=p.map((v,k)=>v+side*n[k]*.01),dir=n.map(v=>-side*v);
   const hit=sheet.hit({origin,direction:dir});
   assert.ok(hit,'hit');assert.ok(Math.abs(hit.x-x)<=W/segX/2+1e-9,`${tier} x ${hit.x} vs ${x}`);assert.ok(Math.abs(hit.y-y)<1e-6);
   assert.equal(hit.face,side>0?'front':'back');
  }
  sheet.setSegments(48,1);assert.equal(sheet.segments,48);
  sheet.dispose();
 }
});

test('a sheet is endpoint-safe: anchors, normals and bounds stay finite at turn 0 and 1 and every radius',()=>{
 const sheet=bend.createSheet({W,H,shared:shared(),tier:'mid'});
 for(const t of [0,1e-9,.001,.25,.5,.75,.999,1-1e-9,1]){
  for(const r of [W*math.MIN_RADIUS_RATIO,bend.sheetRadius(t,0,W),W/Math.PI]){
   sheet.set({turn:t,radius:r,stackZ:[.004,.007],dip:.003});
   for(const x of [0,.001,W/2,W])for(const y of [0,H]){const {position,normal}=sheet.anchor(x,y);assert.ok([...position,...normal].every(Number.isFinite));}
   const b=math.bendBounds(sheet.params);assert.ok([...b.min,...b.max].every(Number.isFinite));
   const g=sheet.hingeDir(.05,.1);assert.ok(Math.abs(Math.hypot(...g)-1)<1e-9);
  }
 }
 sheet.set({turn:0,stackZ:[.005,.004]});assert.ok(Math.abs(sheet.anchor(.1,.1).position[2]-(.005+bend.LIFT))<1e-12,'lift over the stack it leaves');
 sheet.set({turn:1,stackZ:[.005,.004]});const p=sheet.anchor(.1,.1).position;assert.ok(Math.abs(p[0]+.1)<1e-12&&Math.abs(p[2]-(.004+bend.LIFT))<1e-12,'lands mirrored on the other stack');
 sheet.dispose();
});

test('the gutter valley is capped by the half-block and fades out on a turning sheet',()=>{
 assert.equal(bend.dipDepth(.0012),.0012*.8);assert.equal(bend.dipDepth(.011),bend.DIP);
 assert.equal(bend.gutterDip(0),bend.DIP);assert.equal(bend.gutterDip(bend.GUTTER),0);
 assert.equal(bend.dipWeight(0),1);assert.equal(bend.dipWeight(1),1);assert.equal(bend.dipWeight(.5),0);
 const plane=bend.pagePlane(W,H,1,1,{gutter:true}),xs=new Set();const pos=plane.attributes.position;for(let i=0;i<pos.count;i++)xs.add(pos.getX(i));
 assert.ok([...xs].filter(x=>x>0&&x<bend.GUTTER).length>=6,'a coarse static page still bends into the valley');
});
