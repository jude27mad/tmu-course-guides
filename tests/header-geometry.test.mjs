import test from 'node:test';
import assert from 'node:assert/strict';
import {secantState,shearState,calculusProject,algebraProject} from '../assets/header-geometry.mjs';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
test('header secant goes through both points on the actual parabola',()=>{
 for(const t of [0,.15,.5,.9,.999]){
  const s=secantState(t);close(s.y,s.x*s.x);close(s.slope,(s.y-1)/(s.x-1));
  for(const [x,y] of s.line)close(y-1,s.slope*(x-1));
 }
});
test('header secant has a finite tangent limit with slope 2 at x=1',()=>{
 const s=secantState(1);assert.equal(s.x,1);assert.equal(s.y,1);assert.equal(s.slope,2);
 for(const [x,y] of s.line)close(y,2*x-1);
});
test('header shear preserves area and the parallelogram follows the basis vectors',()=>{
 for(const t of [0,.2,.5,.8,1]){
  const {u,v,square}=shearState(t);close(u[0]*v[1]-u[1]*v[0],1);
  assert.deepEqual(square[1],u);assert.deepEqual(square[3],v);assert.deepEqual(square[2],[u[0]+v[0],u[1]+v[1]]);
 }
});
test('illustration projections preserve straight lines and finite coordinates',()=>{
 for(const P of [calculusProject,algebraProject]){
  const a=P(-1,2),b=P(2,-1),m=P(.5,.5);close(m[0],(a[0]+b[0])/2);close(m[1],(a[1]+b[1])/2);
  assert.ok([...a,...b,...m].every(Number.isFinite));
 }
});
