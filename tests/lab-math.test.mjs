import test from 'node:test';
import assert from 'node:assert/strict';
import {transformed,multiply,determinant,matrixAt,transformPoint,intersection,secant,limitValue,limitFacts} from '../assets/lab-math.mjs';
test('function shifts, reflections and square-root domain are respected',()=>{
 assert.equal(transformed('square',1,2,0,2),0);
 assert.equal(transformed('absolute',-2,1,3,-1),-1);
 assert.equal(transformed('sqrt',2,1,-1,5),3);
 assert.ok(Number.isNaN(transformed('sqrt',0,1,2,0)));
});
test('complex products rotate and scale, including zero multiplier',()=>{
 assert.deepEqual(multiply(1,1,0,1),[-1,1]);
 assert.deepEqual(multiply(2,-3,-1,0),[-2,3]);
 assert.deepEqual(multiply(1,1,0,0),[0,0]);
});
test('matrix interpolation reaches exact endpoints and tracks signed area',()=>{
 assert.deepEqual(matrixAt(0,-1,1,0,0),[1,0,0,1]);
 assert.deepEqual(matrixAt(0,-1,1,0,1),[0,-1,1,0]);
 assert.deepEqual(transformPoint([0,-1,1,0],2,3),[-3,2]);
 assert.equal(determinant(-1,0,0,1),-1);
 assert.equal(determinant(1,0,0,0),0);
 assert.equal(determinant(...matrixAt(1,0,0,0,.5)),.5);
});
test('systems distinguish unique, parallel and coincident lines',()=>{
 assert.deepEqual(intersection(1,0,-1,2),{kind:'one',x:1,y:1});
 assert.deepEqual(intersection(1,0,1,2),{kind:'none'});
 assert.deepEqual(intersection(1,2,1,2),{kind:'infinite'});
});
test('secants approach the derivative from both sides without dividing by zero',()=>{
 assert.equal(secant(1,.01),2.01);assert.equal(secant(1,-.01),1.99);assert.equal(secant(1,0),null);
});
test('limit examples distinguish function value, one-sided limits and poles',()=>{
 assert.equal(limitValue('hole',1),3);assert.equal(limitValue('hole',.999),1.999);
 assert.equal(limitFacts.hole.limit,'2');assert.equal(limitFacts.jump.limit,'Does not exist');
 assert.equal(limitValue('jump',.999),1);assert.equal(limitValue('jump',1),3);
 assert.ok(limitValue('pole',.99)<0);assert.ok(limitValue('pole',1.01)>0);assert.ok(Number.isNaN(limitValue('pole',1)));
});
