import test from 'node:test';
import assert from 'node:assert/strict';
import {CHECKS,compactExact,countGrowth,summarizeFrames,until} from './checks.mjs';
import * as checks from './checks.mjs';

test('only the explicit SwiftShader launch receives a longer physical-click budget',()=>{
  const {clickTimeoutMs}=checks;
  assert.equal(typeof clickTimeoutMs,'function');
  assert.equal(clickTimeoutMs({gpu:false,browserName:'chromium'}),30000);
  for(const options of [{gpu:true,browserName:'chromium'},{gpu:false,browserName:'webkit'},{gpu:false,browserName:'firefox'},{gpu:false},{gpu:undefined,browserName:'chromium'},{}])assert.equal(clickTimeoutMs(options),10000);
});

test('a reduced-motion renderer marker cannot stand in for its first static frame',()=>{
  assert.equal(typeof checks.initialStaticSceneReady,'function');
  const initializing={renderer:'webgl2',onScreen:true,sceneReady:null,sceneFrame:0,motionState:'still'};
  assert.equal(checks.initialStaticSceneReady(initializing),false);
  assert.equal(checks.initialStaticSceneReady({...initializing,sceneReady:'true'}),false);
  assert.equal(checks.initialStaticSceneReady({...initializing,sceneReady:'true',sceneFrame:1}),true);
  assert.equal(checks.initialStaticSceneReady({...initializing,sceneReady:'true',sceneFrame:1,motionState:'running'}),false);
});

test('static-scene readiness respects offscreen demand rendering and authored poster fallback',()=>{
  assert.equal(typeof checks.initialStaticSceneReady,'function');
  assert.equal(checks.initialStaticSceneReady(null),false);
  assert.equal(checks.initialStaticSceneReady({onScreen:false}),false);
  assert.equal(checks.initialStaticSceneReady({renderer:'webgl2',onScreen:false,sceneReady:null,sceneFrame:0}),true);
  assert.equal(checks.initialStaticSceneReady({renderer:'poster',onScreen:true,sceneReady:'true',motionState:'still',sceneFrame:0}),true);
});

test('initial scene wait observes a real first frame and rejects a renderer that never initializes',async()=>{
  assert.equal(typeof checks.waitForInitialStaticScene,'function');
  const initializing={renderer:'webgl2',onScreen:true,sceneReady:null,sceneFrame:0,motionState:'still'};
  const ready={...initializing,sceneReady:'true',sceneFrame:1};let calls=0;
  const page={evaluate:async()=>++calls===1?initializing:ready};
  assert.deepEqual(await checks.waitForInitialStaticScene(page,'mth141',1000),ready);
  assert.equal(calls,2);
  await assert.rejects(checks.waitForInitialStaticScene({evaluate:async()=>initializing},'mth141',0),/initial static scene/);
});

test('all six required checks are independently runnable',()=>{
  assert.deepEqual(Object.keys(CHECKS),['routes','stability','frames','deadlines','modes','layout']);
  for(const check of Object.values(CHECKS)) assert.equal(typeof check,'function');
});

test('frame pacing reports thresholds without turning SwiftShader timing into a smoothness gate',()=>{
  const report=summarizeFrames([16.6,16.7,16.8,33,33.1,100],[{duration:50},{duration:50.1}]);
  assert.equal(report.over16_7ms.count,4);
  assert.equal(report.over33ms.count,2);
  assert.equal(report.over33ms.share,2/6);
  assert.equal(report.p95ms,100);
  assert.deepEqual(report.longTasksOver50ms,[{duration:50.1}]);
  assert.equal(summarizeFrames([],[]).over33ms.share,null);
});

test('stability detects listener and WebGL growth while allowing resource release',()=>{
  const before={listeners:{live:12,retained:13},observers:{total:3,intersection:{instances:1,active:1,targets:1},mutation:{instances:1,active:1,targets:1},resize:{instances:1,active:1,targets:1}},raf:{pending:1,recurring:1},canvases:{connected:1},webgl:{active:1},gsap:{available:true,tickerCallbacks:4,scrollTriggers:2}};
  const after=structuredClone(before);after.listeners.live++;after.webgl.active++;after.observers.total--;
  const growth=countGrowth(before,after);
  assert.deepEqual(growth.filter(x=>x.delta>0).map(x=>x.metric),['listeners.live','webgl.active']);
  assert.equal(growth.find(x=>x.metric==='observers.total').delta,-1);
  assert.equal(growth.find(x=>x.metric==='gsap.tickerCallbacks').delta,0);
});

test('stability catches retained disconnected observer instances after GC even with no active targets',()=>{
  const state={listeners:{live:0,retained:0},observers:{total:0,intersection:{instances:0,active:0,targets:0},mutation:{instances:1,active:0,targets:0},resize:{instances:0,active:0,targets:0}},raf:{pending:0,recurring:0},canvases:{connected:0},webgl:{active:0},gsap:{available:false}};
  const end=structuredClone(state);end.observers.mutation.instances=21;
  const growing=countGrowth(state,end).filter(row=>row.delta>0);
  assert.deepEqual(growing,[{metric:'observers.mutation.instances',baseline:1,end:21,delta:20}]);
});

test('deadline countdown fixtures use absolute Toronto instants and recompute after a clock jump',()=>{
  // Oct 14 3 PM and Oct 23 6:30 PM Toronto are still EDT (UTC-4).
  // Format from docs/copy/interface-copy.md ("Countdown format").
  assert.equal(compactExact('2026-10-14T19:00:00.000Z','2026-10-13T16:00:00.000Z'),'1d 3h');
  assert.equal(compactExact('2026-10-14T19:00:00.000Z','2026-10-13T17:00:00.000Z'),'1d 2h');
  assert.equal(compactExact('2026-10-23T22:30:00.000Z','2026-10-20T16:00:00.000Z'),'3d 6h');
  assert.equal(compactExact('2026-10-14T19:00:00.000Z','2026-10-12T07:00:00.000Z'),'2d 12h');
  assert.equal(compactExact('2026-10-14T19:00:00.000Z','2026-10-14T13:53:00.000Z'),'5h 07m');
  assert.equal(compactExact('2026-10-14T19:00:00.000Z','2026-10-14T18:31:00.000Z'),'29m');
  assert.equal(compactExact('2026-10-14T19:00:00.000Z','2026-10-14T19:00:00.000Z'),'Happening now');
  assert.equal(compactExact('2026-10-14T19:00:00.000Z','2026-10-14T20:00:00.000Z'),'Due time passed');
});

test('an already-ready condition is sampled even at the polling deadline', async()=>{
  let calls=0;
  await until(()=>{calls++;return true;},'ready wrapper',0);
  assert.equal(calls,1);
});

test('an unsettled condition still fails after its final deadline sample', async()=>{
  let calls=0;
  await assert.rejects(until(()=>{calls++;return false;},'stuck wrapper',0),/Timed out waiting for stuck wrapper/);
  assert.equal(calls,1);
});

test('a late false reply is followed by a fresh deadline sample, not assumed current', async()=>{
  let calls=0;
  await until(async()=>{
    if(++calls===1){await new Promise(resolve=>setTimeout(resolve,30));return false;}
    return true;
  },'settled wrapper after slow reply',10);
  assert.equal(calls,2);
});


test('a late false reply still fails when the fresh sample is also false', async()=>{
  let calls=0;
  await assert.rejects(until(async()=>{
    if(++calls===1)await new Promise(resolve=>setTimeout(resolve,30));
    return false;
  },'persistent transform after slow reply',10),/Timed out waiting for persistent transform/);
  assert.equal(calls,2);
});
