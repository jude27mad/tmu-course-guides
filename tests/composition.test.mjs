import test from 'node:test';
import assert from 'node:assert/strict';
import { IDENTITY,OPERATIONS,matrixMultiply,applyMatrix,matrixDet,compose,operationAt,compositionAt,sameMatrix } from '../assets/lab-composition-math.mjs';
const close=(actual,expected)=>actual.forEach((v,i)=>assert.ok(Math.abs(v-expected[i])<1e-10,`${v} differs from ${expected[i]}`));
test('column-vector composition applies the rightmost matrix first',()=>{
  assert.deepEqual(compose('rotate','stretch'),[0,-2,1,0]);
  assert.deepEqual(compose('stretch','rotate'),[0,-1,2,0]);
  assert.deepEqual(applyMatrix(compose('rotate','stretch'),[1,1]),[-2,1]);
  assert.deepEqual(applyMatrix(compose('stretch','rotate'),[1,1]),[-1,2]);
  assert.equal(sameMatrix(compose('rotate','stretch'),compose('stretch','rotate')),false);
});
test('every composition agrees with applying the operations in sequence',()=>{
  for(const [first,a] of Object.entries(OPERATIONS))for(const [second,b] of Object.entries(OPERATIONS))for(const p of [[1,1],[-2,3],[4,0]]){
    close(applyMatrix(compose(first,second),p),applyMatrix(b.matrix,applyMatrix(a.matrix,p)));
    assert.ok(Math.abs(matrixDet(compose(first,second))-matrixDet(a.matrix)*matrixDet(b.matrix))<1e-10);
  }
});
test('rotation playback preserves lengths and area rather than shrinking through a chord',()=>{
  for(const t of [.1,.25,.5,.75,.9]){
    const m=operationAt('rotate',t),p=applyMatrix(m,[1,1]);
    assert.ok(Math.abs(Math.hypot(...p)-Math.sqrt(2))<1e-10);
    assert.ok(Math.abs(matrixDet(m)-1)<1e-10);
  }
  close(operationAt('rotate',.5),[Math.SQRT1_2,-Math.SQRT1_2,Math.SQRT1_2,Math.SQRT1_2]);
});
test('playback stages meet continuously and end at the actual product',()=>{
  for(const first of Object.keys(OPERATIONS))for(const second of Object.keys(OPERATIONS)){
    assert.deepEqual(compositionAt(first,second,1,0),IDENTITY);
    close(compositionAt(first,second,1,1),compositionAt(first,second,2,0));
    close(compositionAt(first,second,2,1),compose(first,second));
  }
});
test('collapse makes zero area, reflection reverses orientation, and commuting pairs are recognized',()=>{
  assert.equal(matrixDet(compose('rotate','collapse')),0);
  assert.equal(matrixDet(compose('reflect','stretch')),-2);
  assert.equal(sameMatrix(compose('reflect','stretch'),compose('stretch','reflect')),true);
  assert.equal(sameMatrix(compose('shear','collapse'),compose('collapse','shear')),false);
  assert.deepEqual(matrixMultiply(OPERATIONS.collapse.matrix,OPERATIONS.collapse.matrix),OPERATIONS.collapse.matrix);
});
