import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import * as checks from './checks.mjs';

function fixture({browserName='chromium',gpu=false,registered=true,target}={}) {
  const observation={},calls=[],events=[];
  const element=target??{disabled:false,getClientRects:()=>[{}],click(){events.push('click');}};
  const page={url:()=> 'https://guide.test/mth140/',
    locator(selector){return {first(){calls.push({method:'first',selector});return {async evaluate(fn,arg,options){calls.push({method:'evaluate',selector,arg,options});events.push('native');fn(element);}};}};},
    setDefaultTimeout(){assert.fail('the page default must stay unchanged');},
    waitForSelector(){assert.fail('no separate readiness wait');},
    clock:{runFor(){assert.fail('no fake-clock advancement');},setSystemTime(){assert.fail('no fake-clock change');}}
  };
  if(registered) checks.registerClockedCompletionScope(page,{browser:{browserType:()=>({name:()=>browserName})},gpu,observation});
  return {page,observation,calls,events,element};
}

test('clocked native completion extends only explicit software Chromium',()=>{
  assert.equal(typeof checks.clockedCompletionTimeoutMs,'function');
  assert.equal(checks.clockedCompletionTimeoutMs({gpu:false,browserName:'chromium'}),30000);
  for(const options of [{gpu:true,browserName:'chromium'},{gpu:false,browserName:'webkit'},{gpu:false,browserName:'firefox'},{gpu:false},{browserName:'chromium'},{},undefined]) assert.equal(checks.clockedCompletionTimeoutMs(options),10000);
});

test('registration derives actual browser policy and unknown or throwing browsers retain ten seconds',()=>{
  assert.equal(typeof checks.registerClockedCompletionScope,'function');
  for(const [browser,expected] of [[{browserType:()=>({name:()=> 'chromium'})},30000],[{browserType:()=>({name:()=> 'webkit'})},10000],[{},10000],[null,10000],[{browserType(){throw Error('browser unavailable');}},10000]]) {
    const page={},observation={};
    const scope=checks.registerClockedCompletionScope(page,{browser,gpu:false,observation});
    assert.equal(scope.policy.timeoutMs,expected);
    assert.equal(Object.isFrozen(scope.policy),true);
    assert.deepEqual(observation.clockedCompletionActions,[]);
  }
});

test('Mark done and Undo retain first locator, undefined argument, strict native options and original guard',async()=>{
  assert.equal(typeof checks.activateClocked,'function');
  for(const [browserName,gpu,registered,timeout] of [['chromium',false,true,30000],['chromium',true,true,10000],['webkit',false,true,10000],[null,false,false,10000]]) {
    const f=fixture({browserName,gpu,registered});let time=10;
    for(const selector of ['[data-quick-complete]','#undo-complete']) {
      const trace=await checks.activateClocked(f.page,selector,{now:()=>time++,snapshot:async()=>{f.events.push('before');return {selector,count:1};}});
      assert.deepEqual(f.calls.slice(-2),[{method:'first',selector},{method:'evaluate',selector,arg:undefined,options:{timeout}}]);
      assert.deepEqual(f.events.slice(-3),['before','native','click']);
      assert.equal(trace.status,'activated');assert.equal(trace.timeoutMs,timeout);assert.equal(trace.elapsedMs,1);
      assert.deepEqual(trace.nativeCall,{method:'Locator.first().evaluate',argument:'undefined',options:{timeout}});
      assert.equal(trace.policy.browserName,registered?browserName:null);
      assert.equal(trace.policy.gpu,registered?gpu:null);
      assert.equal(trace.beforeSnapshot.count,1);
    }
    if(registered)assert.equal(f.observation.clockedCompletionActions.length,2);
  }
});

test('disabled and empty-rectangle buttons still reject before clicking',async()=>{
  assert.equal(typeof checks.activateClocked,'function');
  for(const [disabled,rects] of [[true,[{}]],[false,[]]]) {
    let clicks=0;const f=fixture({target:{disabled,getClientRects:()=>rects,click(){clicks++;}}});
    await assert.rejects(checks.activateClocked(f.page,'[data-quick-complete]',{snapshot:async()=>({count:1})}),/Deadline action unavailable/);
    assert.equal(clicks,0);assert.equal(f.observation.clockedCompletionActions[0].status,'error');
    assert.equal(f.calls.filter(c=>c.method==='evaluate').length,1);
  }
});

test('a native timeout remains the original failure and is recorded before passive failure diagnostics',async()=>{
  assert.equal(typeof checks.activateClocked,'function');
  const f=fixture(),error=Error('locator.evaluate: Timeout 30000ms exceeded');let time=0,snapshots=0;
  f.page.locator=selector=>({first:()=>({evaluate:async(_fn,_arg,options)=>{f.calls.push({selector,options});time+=options.timeout;throw error;}})});
  await assert.rejects(checks.activateClocked(f.page,'[data-quick-complete]',{now:()=>time,snapshot:async()=>{
    if(++snapshots===2){const trace=f.observation.clockedCompletionActions[0];assert.equal(trace.status,'error');assert.equal(trace.elapsedMs,30000);assert.equal(trace.error,error.message);return {count:0};}
    return {count:1};
  }}),candidate=>candidate===error);
  const trace=f.observation.clockedCompletionActions[0];assert.equal(trace.elapsedMs,30000);assert.equal(trace.failureSnapshot.count,0);assert.equal(snapshots,2);assert.equal(f.calls.length,1);
});

test('all passive diagnostic exceptions preserve the original native failure',async()=>{
  assert.equal(typeof checks.activateClocked,'function');
  for(const diagnosticError of [Error('snapshot unavailable'),null,undefined])for(const timerThrows of [false,true]) {
    const f=fixture(),error=Error('native failure');let attempts=0;
    f.page.locator=()=>({first:()=>({evaluate:async()=>{attempts++;throw error;}})});
    await assert.rejects(checks.activateClocked(f.page,'#undo-complete',{
      snapshot:async()=>{throw diagnosticError;},...(timerThrows?{setTimer(){throw Error('timer setup failed');},clearTimer(){}}:{})
    }),candidate=>candidate===error);
    const trace=f.observation.clockedCompletionActions[0];assert.equal(trace.status,'error');assert.equal(attempts,1);
    assert.equal(trace.beforeSnapshotError,timerThrows?'timer setup failed':diagnosticError?.message??String(diagnosticError));
    assert.equal(trace.failureSnapshotError,timerThrows?'timer setup failed':diagnosticError?.message??String(diagnosticError));
  }
});

test('a failed pre-action snapshot never prevents or repeats successful native activation',async()=>{
  assert.equal(typeof checks.activateClocked,'function');
  const f=fixture();let snapshots=0;
  const trace=await checks.activateClocked(f.page,'#undo-complete',{snapshot:async()=>{snapshots++;throw Error('before snapshot unavailable');}});
  assert.equal(trace.status,'activated');assert.equal(trace.beforeSnapshotError,'before snapshot unavailable');assert.equal(snapshots,1);
  assert.equal(f.calls.filter(c=>c.method==='evaluate').length,1);assert.equal(f.events.filter(e=>e==='click').length,1);
});

test('null and undefined native rejections retain identity even when timer cleanup fails',async()=>{
  assert.equal(typeof checks.activateClocked,'function');
  for(const original of [null,undefined]) {
    const f=fixture();let rejected=false;
    f.page.locator=()=>({first:()=>({evaluate:async()=>{throw original;}})});
    try {await checks.activateClocked(f.page,'#undo-complete',{snapshot:async()=>({count:1}),setTimer:()=>17,clearTimer(){throw Error('cleanup unavailable');}});}
    catch(error){rejected=true;assert.equal(error,original);}
    assert.equal(rejected,true);
    const trace=f.observation.clockedCompletionActions[0];assert.equal(trace.status,'error');assert.equal(trace.error,String(original));assert.equal(trace.beforeSnapshotError,'cleanup unavailable');assert.equal(trace.failureSnapshotError,'cleanup unavailable');
  }
});

test('passive snapshots have a virtual five-second bound and clear their timer on every outcome',async()=>{
  assert.equal(typeof checks.boundedClockedCompletionDiagnostic,'function');
  let fire,limit,cleared=0;
  const options={setTimer(fn,ms){fire=fn;limit=ms;return 17;},clearTimer(timer){assert.equal(timer,17);cleared++;}};
  assert.equal(await checks.boundedClockedCompletionDiagnostic(async()=> 'snapshot',options),'snapshot');assert.equal(limit,5000);assert.equal(cleared,1);
  const error=Error('snapshot rejected');await assert.rejects(checks.boundedClockedCompletionDiagnostic(()=>Promise.reject(error),options),candidate=>candidate===error);assert.equal(cleared,2);
  const pending=checks.boundedClockedCompletionDiagnostic(()=>new Promise(()=>{}),options);fire();
  await assert.rejects(pending,/snapshot exceeded 5000 ms/);assert.equal(cleared,3);
});

test('failure diagnostic timeout is separate from the original action elapsed time',async()=>{
  assert.equal(typeof checks.activateClocked,'function');
  const f=fixture(),error=Error('native deadline action failed');let time=0,snapshots=0,cleared=0;
  f.page.locator=()=>({first:()=>({evaluate:async(_fn,_arg,{timeout})=>{time+=timeout;throw error;}})});
  await assert.rejects(checks.activateClocked(f.page,'#undo-complete',{
    now:()=>time,snapshot:()=>++snapshots===1?Promise.resolve({count:1}):new Promise(()=>{}),
    setTimer(fn,ms){assert.equal(ms,5000);const timer={cancelled:false};queueMicrotask(()=>queueMicrotask(()=>queueMicrotask(()=>{if(!timer.cancelled){time+=ms;fn();}})));return timer;},clearTimer(timer){timer.cancelled=true;cleared++;}
  }),candidate=>candidate===error);
  const trace=f.observation.clockedCompletionActions[0];assert.equal(trace.elapsedMs,30000);assert.equal(trace.failureDiagnosticElapsedMs,5000);assert.match(trace.failureSnapshotError,/5000 ms/);assert.equal(cleared,2);
});

test('main-world snapshot reads selector count and target identity, attachment, disabled state and rect count',async()=>{
  assert.equal(typeof checks.clockedCompletionSnapshot,'function');
  const selector='[data-quick-complete]',target={tagName:'BUTTON',id:'',dataset:{quickComplete:'midterm'},isConnected:true,disabled:false,getClientRects:()=>[{},{}]};let reads=0;
  const page={evaluate:async(fn,argument)=>{assert.equal(argument,selector);return vm.runInNewContext('('+fn.toString()+')(selector)',{
    selector,document:{querySelectorAll(value){assert.equal(value,selector);reads++;return [target];}},location:{href:'https://guide.test/mth140/'},window:{TMURouter:{route:'mth140'},__qaRouteCompleted:'mth140'}
  });}};
  const state=await checks.clockedCompletionSnapshot(page,selector);
  assert.deepEqual(JSON.parse(JSON.stringify(state)),{url:'https://guide.test/mth140/',route:'mth140',completedRoute:'mth140',selector,count:1,first:{tag:'BUTTON',id:'',completion:'midterm',isConnected:true,disabled:false,rectCount:2}});
  assert.equal(reads,1);
  const missingPage={evaluate:async(fn,argument)=>vm.runInNewContext('('+fn.toString()+')(selector)',{
    selector:argument,document:{querySelectorAll:()=>[]},location:{href:'https://guide.test/mth140/'},window:{TMURouter:{route:'mth140'},__qaRouteCompleted:'mth140'}
  })};
  const missing=await checks.clockedCompletionSnapshot(missingPage,selector);assert.equal(missing.count,0);assert.equal(missing.first,null);
});
