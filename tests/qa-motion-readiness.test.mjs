import test from 'node:test';
import assert from 'node:assert/strict';
import {sampleMotion} from '../tools/qa/checks.mjs';

async function withPage({delayed=false,loop=false,never=false,route='cen100',renderer='webgl2',posterWidth=600,opacity='1',missing=false}={},fn){
  const previous=Object.fromEntries(['document','window','getComputedStyle'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  let evaluations=0,draws=41;
  const poster={complete:true,naturalWidth:posterWidth,hidden:false,parentElement:null,getBoundingClientRect:()=>({width:300,height:400})};
  const art={dataset:{renderer,sceneReady:delayed||never?undefined:'true',sceneFrame:'0',motionState:'still'},className:'header-art',hidden:false,parentElement:null,querySelector:()=>poster,getBoundingClientRect:()=>({width:300,height:400})};
  poster.parentElement=art;
  const renderers=missing||route==='desk'?[]:[art],waits=[];
  globalThis.document={body:{dataset:route==='desk'?{page:'desk'}:{course:route}},documentElement:{dataset:{motion:'off'}},getAnimations:()=>[],querySelector:selector=>selector==='main[data-route-region]'?{innerText:'Readable coursework and assessment dates'}:{},querySelectorAll:selector=>['.header-art','[data-renderer]'].includes(selector)?renderers:[]};
  globalThis.window={GuideMotion:{preference:()=>({forced:true})},__qaMetrics:{snapshot:()=>({canvases:{drawCalls:draws}})}};
  globalThis.getComputedStyle=()=>({display:'block',visibility:'visible',opacity,transform:'none'});
  const page={
    async evaluate(callback){
      if(++evaluations===2&&delayed&&!never){art.dataset.sceneReady='true';art.dataset.sceneFrame='1';draws+=20;}
      return callback();
    },
    async waitForTimeout(ms){waits.push(ms);if(loop){draws+=20;art.dataset.sceneFrame=String(Number(art.dataset.sceneFrame)+1);}}
  };
  try{return await fn(page,{art,waits,evaluations:()=>evaluations});}
  finally{for(const [key,descriptor] of Object.entries(previous))if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}
}

test('motion sampling starts after a delayed first paint, retaining the 450 ms window',async()=>{
  await withPage({delayed:true},async(page,{waits})=>{
    const observation={};await sampleMotion(page,observation);
    assert.equal(observation.before.metrics.canvases.drawCalls,61);
    assert.equal(observation.after.metrics.canvases.drawCalls,61);
    assert.equal(observation.sceneReadiness.ready,true);
    assert.equal(observation.sceneReadiness.renderers[0].sceneReady,'true');
    assert.equal(observation.before.renderers[0].sceneFrame,'1');
    assert.equal(observation.before.renderers[0].motionState,'still');
    assert.deepEqual(waits,[450]);
  });
});

test('a scene-ready marker does not hide a continuing drawing loop',async()=>{
  await withPage({delayed:true,loop:true},async(page,{waits})=>{
    const observation={};await sampleMotion(page,observation);
    assert.equal(observation.before.metrics.canvases.drawCalls===observation.after.metrics.canvases.drawCalls,false);
    assert.equal(observation.after.metrics.canvases.drawCalls,81);
    assert.deepEqual(waits,[450]);
  });
});

test('a WebGL scene that never becomes ready fails instead of sampling or passing',async()=>{
  await withPage({never:true},async(page,{waits})=>{
    const observation={};await assert.rejects(sampleMotion(page,observation,{timeout:0}),/Timed out waiting for course header scene readiness/);
    assert.equal(observation.sceneReadiness.ready,false);
    assert.equal(observation.before,undefined);
    assert.deepEqual(waits,[]);
  });
});

test('fallback readiness requires a genuinely loaded and visible authored poster',async()=>{
  await withPage({renderer:'poster',never:true},async(page)=>{
    const observation={};await sampleMotion(page,observation,{timeout:0});
    assert.equal(observation.sceneReadiness.ready,true);
  });
  for(const options of [{posterWidth:0},{opacity:'0'}])await withPage({renderer:'poster',...options},async(page)=>{
    await assert.rejects(sampleMotion(page,{}, {timeout:0}),/scene readiness/);
  });
});

test('the Desk is exempt while a course missing its header scene fails',async()=>{
  await withPage({route:'desk'},async(page)=>{
    const observation={};await sampleMotion(page,observation,{timeout:0});
    assert.equal(observation.sceneReadiness.exempt,true);
  });
  await withPage({missing:true},async(page)=>{
    await assert.rejects(sampleMotion(page,{}, {timeout:0}),/scene readiness/);
  });
});
