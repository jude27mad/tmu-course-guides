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
