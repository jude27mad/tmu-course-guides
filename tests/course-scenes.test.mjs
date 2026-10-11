import test from 'node:test';
import assert from 'node:assert/strict';
import {calculusState,algebraState,routePoint} from '../assets/scenes/scene-math.mjs';
import {createCircuit} from '../assets/scenes/circuit.mjs';
import {createCalculus} from '../assets/scenes/calculus.mjs';
import {createAlgebra} from '../assets/scenes/algebra.mjs';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} ≠ ${b}`);
test('animated secants join two curve points and idle tangents have derivative 2x',()=>{
 for(let t=0;t<60;t+=.13){const s=calculusState(t);close(s.y,s.x*s.x);close(s.qy,s.qx*s.qx);if(s.secant)close(s.y+s.slope*(s.qx-s.x),s.qy);else close(s.slope,2*s.x);}
 assert.equal(calculusState(100,true).slope,2);
});
test('header shear and rotation preserve oriented unit area through entire loop',()=>{
 for(let t=0;t<44;t+=.07){const s=algebraState(t);close(s.u[0]*s.v[1]-s.u[1]*s.v[0],1);close(s.square[2][0],s.u[0]+s.v[0]);close(s.square[2][1],s.u[1]+s.v[1]);if(s.shear===0){close(Math.hypot(...s.u),1);close(Math.hypot(...s.v),1);}}
 const a=algebraState(22-1e-6),b=algebraState(22+1e-6);assert.ok(Math.hypot(a.v[0]-b.v[0],a.v[1]-b.v[1])<1e-5);
});
test('signals travel by distance and reach route endpoints',()=>{const p=[[0,0,0],[2,0,0],[2,1,0]];assert.deepEqual(routePoint(p,0),p[0]);assert.deepEqual(routePoint(p,1),p[2]);assert.deepEqual(routePoint(p,2/3),p[1]);});
for(const [name,create]of [['circuit',createCircuit],['calculus',createCalculus],['algebra',createAlgebra]])test(`${name} scene stays finite and within geometry budget`,()=>{
 const scene=create({surface:'#edc6b5',accent:'#edbba7',ink:'#954424',signal:'#e64d81',grid:'#954424'});let triangles=0,calls=0;
 for(const t of [0,1,4,8,13,17,21.999,22,60]){scene.update(t,.016,{still:false});scene.root.updateMatrixWorld(true);scene.root.traverse(o=>{assert.ok(o.matrixWorld.elements.every(Number.isFinite));if(o.geometry)assert.ok([...o.geometry.attributes.position.array].every(Number.isFinite));});}
 scene.root.traverse(o=>{if(o.geometry){calls++;triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3*(o.count||1);}});
 assert.ok(calls<50,`${calls} draw calls`);assert.ok(triangles<100000,`${triangles} triangles`);console.log(`${name}: ${calls} meshes, ${Math.round(triangles)} triangles`);scene.dispose();
});
