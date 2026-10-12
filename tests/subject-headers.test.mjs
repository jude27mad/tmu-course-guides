import test from 'node:test';
import assert from 'node:assert/strict';
import * as math from '../assets/scenes/scene-math.mjs';
test('fixed-ring planetary gears maintain both no-slip ratios',()=>{
 assert.equal(typeof math.planetaryState,'function');
 for(let t=0;t<30;t+=.13){const s=math.planetaryState(t);assert.ok(Math.abs((s.sun-s.carrier)*24+(s.planet-s.carrier)*18)<1e-8);assert.ok(Math.abs((s.planet-s.carrier)*18+s.carrier*60)<1e-8);}
});
test('sphere transforms include identity and rank-two projection without moving the origin',()=>{
 assert.equal(typeof math.sphereTransform,'function');
 const identity=math.sphereTransform(0);assert.deepEqual(identity,[1,0,0,0,1,0,0,0,1]);
 for(let t=0;t<=24;t+=.1)assert.ok(math.sphereTransform(t).every(Number.isFinite));
 const flat=math.sphereTransform(18);assert.equal(flat[8],0);assert.deepEqual(math.sphereTransform(24),identity);
});
test('drag follows a finger continuously, releases with bounded inertia and cancels cleanly',async()=>{
 let mod;try{mod=await import('../assets/scenes/drag.mjs')}catch{}
 assert.equal(typeof mod?.createDragState,'function');
 const d=mod.createDragState();d.begin(100,100,0);d.move(180,130,40,400);assert.ok(d.yaw>.5);assert.ok(d.pitch>.1);const before=d.yaw;d.end(41);d.step(.016);assert.ok(d.yaw>before);
 for(let i=0;i<300;i++)d.step(1/60);assert.ok(Math.abs(d.velocityX)<.001);d.begin(0,0,6000);d.move(100,3000,6030,400);assert.ok(Math.abs(d.pitch)<=.9);d.cancel();assert.equal(d.velocityX,0);assert.equal(d.active,false);
});
test('animated art and basis tips remain visible at extreme drag rotations',async()=>{
 const framing=await import('../assets/scenes/framing.mjs');
 const {Matrix4,Vector3,Euler}=await import('../tools/scene-build/node_modules/three/build/three.module.js');
 for(const course of ['cen100','mth140','mth141'])for(const yaw of [0,1.5,3,5.4])for(const pitch of [-.9,0,.9])for(const time of [0,6,12,18,22]){
  const rotation=[pitch,yaw,-.2],d=framing.rotationFitDistance(course,770/418,rotation,time),r=new Matrix4().makeRotationFromEuler(new Euler(...rotation)),points=[];
  if(course==='cen100'){for(let i=0;i<64;i++)for(const z of [-.48,.48])points.push([2.43*Math.cos(i*Math.PI/32),2.43*Math.sin(i*Math.PI/32),z]);}
  if(course==='mth141'){const m=math.sphereTransform(time);for(let i=0;i<64;i++){const y=1-2*i/63,s=Math.sqrt(1-y*y),x=s*Math.cos(i*2.4),z=s*Math.sin(i*2.4);points.push([1.32*(m[0]*x+m[1]*y+m[2]*z),1.32*(m[3]*x+m[4]*y+m[5]*z),1.32*(m[6]*x+m[7]*y+m[8]*z)]);}for(let i=0;i<3;i++)points.push([m[i]*1.78,m[i+3]*1.78,m[i+6]*1.78]);}
  if(course==='mth140'){for(let i=0;i<=48;i++)for(let j=0;j<=24;j++){const x=-2.15+4.3*i/48,z=-1.4+2.8*j/24;points.push([x,1.55*Math.sin(1.18*x+1.5*z+time*.23)+.18*Math.sin(z*2.1+time*.28)+.08*x,z]);}}
  for(const point of points){const p=new Vector3(...point).applyMatrix4(r),v=Math.tan(33*Math.PI/360)*(d-p.z);assert.ok(Math.abs(p.y)<v,course+' vertical crop');assert.ok(Math.abs(p.x)<v*770/418,course+' horizontal crop');}
 }
});
test('the moving tangent endpoints fit in addition to the ribbon surface',async()=>{
 const {rotationFitDistance}=await import('../assets/scenes/framing.mjs'),{Matrix4,Vector3,Euler}=await import('../tools/scene-build/node_modules/three/build/three.module.js');const t=344.0327883,r=[.25539053,5.64158664,-.23],d=rotationFitDistance('mth140',770/418,r,t),x=1.6*Math.sin(t*.27),y=1.55*Math.sin(1.18*x+t*.23)+.18*Math.sin(t*.28)+.08*x+.045,s=1.55*1.18*Math.cos(1.18*x+t*.23)+.08,l=.55/Math.hypot(1,s),m=new Matrix4().makeRotationFromEuler(new Euler(...r));for(const sign of [-1,1]){const p=new Vector3(x+sign*l,y+sign*l*s,0).applyMatrix4(m);assert.ok(Math.abs(p.y)<Math.tan(33*Math.PI/360)*(d-p.z));}
});
