import assert from 'node:assert/strict';
import test from 'node:test';
import {cases,comparePixels,parseCaptureOptions} from './compare-perf-visuals.mjs';

test('visual capture matrix covers four routes, two deployment bases, two viewports and two themes',()=>{
  const matrix=cases();
  assert.equal(matrix.length,32);
  assert.equal(new Set(matrix.map(entry=>entry.id)).size,32);
  for(const base of ['/','/tmu-course-guides/'])for(const route of ['desk','cen100','mth140','mth141'])for(const viewport of ['1440x900','390x844'])for(const theme of ['dark','light']) {
    assert.ok(matrix.some(entry=>entry.base===base&&entry.route===route&&`${entry.viewport.width}x${entry.viewport.height}`===viewport&&entry.theme===theme));
  }
});

test('raw comparison detects a one-channel difference without tolerance and gives its exact bounds',()=>{
  const before={width:2,height:2,data:Buffer.alloc(16,255)},after={...before,data:Buffer.from(before.data)};
  assert.equal(comparePixels(before,after).metrics.pixelIdentical,true);
  after.data[12]=254;
  const {metrics,diff}=comparePixels(before,after);
  assert.equal(metrics.pixelIdentical,false);
  assert.equal(metrics.changedPixels,1);
  assert.equal(metrics.changedPixelShare,.25);
  assert.equal(metrics.totalAbsoluteChannelDifference,1);
  assert.equal(metrics.maxChannelDifference,1);
  assert.deepEqual(metrics.differenceBounds,{left:1,top:1,right:1,bottom:1});
  assert.deepEqual([...diff.data.subarray(12,16)],[255,0,255,255]);
});

test('raw comparison reports unequal page heights even when added pixels are transparent black',()=>{
  const before={width:2,height:1,data:Buffer.alloc(8)},after={width:2,height:2,data:Buffer.alloc(16)};
  const {metrics}=comparePixels(before,after);
  assert.equal(metrics.equalDimensions,false);
  assert.equal(metrics.pixelIdentical,false);
  assert.equal(metrics.changedPixels,2);
  assert.deepEqual(metrics.differenceBounds,{left:0,top:1,right:1,bottom:1});
});

test('a missing --only value fails before any browser capture can start',()=>{
  assert.throws(()=>parseCaptureOptions(['--only']),/--only requires a case ID/);
  assert.throws(()=>parseCaptureOptions(['--only','--repeat-check']),/--only requires a case ID/);
  assert.deepEqual(parseCaptureOptions(['--only','root-mth140-1440x900-dark','--resume']),{only:'root-mth140-1440x900-dark',resume:true});
});
