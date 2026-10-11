import test from 'node:test';
import assert from 'node:assert/strict';
import {challengeSets,evaluateChoice} from '../assets/lab-challenge-data.mjs';
import {transformed,multiply,determinant,transformPoint,secant,limitValue} from '../assets/lab-math.mjs';

test('each challenge accepts only its first incorrect step and lets other selections retry',()=>{
  for(const [course,challenges] of Object.entries(challengeSets)){
    assert.equal(new Set(challenges.map(c=>c.id)).size,4,course);
    for(const c of challenges){
      assert.ok(c.error>0&&c.error<c.lines.length);
      for(let i=0;i<c.lines.length;i++)assert.equal(evaluateChoice(c,i),i===c.error?'correct':i<c.error?'valid-step':'earlier-error',`${course}/${c.id}/${i}`);
      assert.equal(evaluateChoice(c,-1),'invalid');
      assert.equal(evaluateChoice(c,NaN),'invalid');
    }
  }
});

test('calculus correction examples and their plotted points agree',()=>{
  assert.equal(transformed('square',1,2,0,2),0);
  assert.equal(transformed('square',1,2,0,-2),16);
  assert.equal(secant(1,2),4);
  assert.equal(4*1-3,1);
  assert.equal(4*3-3,9);
  assert.equal(limitValue('hole',1),3);
  assert.ok(Math.abs(limitValue('hole',.999999)-2)<.00001);
  assert.ok(Math.abs(limitValue('hole',1.000001)-2)<.00001);
  for(const h of [-.5,.1,1,2])assert.ok(Math.abs((1+h)**2-(1+2*h+h*h))<1e-10);
});

test('linear algebra visual examples preserve their stated products and area',()=>{
  assert.deepEqual(multiply(1,1,0,1),[-1,1]);
  const row=[2,3,8].map((entry,i)=>entry-2*[1,1,3][i]);
  assert.deepEqual(row,[0,1,2]);
  assert.equal(determinant(1,2,3,4),-2);
  const corners=[[0,0],[1,0],[1,1],[0,1]].map(([x,y])=>transformPoint([1,2,3,4],x,y));
  assert.deepEqual(corners,[[0,0],[1,3],[3,7],[2,4]]);
  const signedArea=corners.reduce((sum,[x,y],i)=>{const [nx,ny]=corners[(i+1)%4];return sum+x*ny-y*nx;},0)/2;
  assert.equal(signedArea,-2);
  assert.deepEqual([2*2-(-1),2*1-2],[5,0]);
});
