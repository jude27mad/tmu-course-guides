/* Run after npm ci --prefix tools/ui-build. No GPU claims: tests lifecycle on Canvas2D. */
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {JSDOM}=require('../tools/ui-build/node_modules/jsdom');const esbuild=require('../tools/ui-build/node_modules/esbuild');
test('scene fallback animates, pauses, sleeps offscreen, resumes, and disposes',async()=>{
 const root=path.resolve(__dirname,'..');const script=(await esbuild.build({stdin:{contents:"import {mountScene} from './assets/course-scene.mjs'; window.mountTestScene=mountScene;",resolveDir:root},bundle:true,format:'iife',write:false,logLevel:'silent'})).outputFiles[0].text;
 for(const course of ['cen100','mth140','mth141']){
  const callbacks=new Map(),intersections=[];let id=0,draws=0;
  const dom=new JSDOM('<header data-urgency="calm"><div class="header-art"></div></header>',{url:'https://guide.test/',pretendToBeVisual:true,runScripts:'outside-only'}),w=dom.window;
  w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
  w.requestAnimationFrame=fn=>{callbacks.set(++id,fn);return id;};w.cancelAnimationFrame=i=>callbacks.delete(i);
  w.ResizeObserver=class{observe(){}disconnect(){}};w.IntersectionObserver=class{constructor(fn){intersections.push(fn)}observe(){}disconnect(){}};
  const ctx=new Proxy({createLinearGradient(){return{addColorStop(){}}},stroke(){draws++}},{get(target,key){return target[key]||(()=>{})},set(target,key,v){target[key]=v;return true}});
  w.HTMLCanvasElement.prototype.getContext=function(type){return type==='2d'?ctx:null};
  const art=w.document.querySelector('.header-art');art.getBoundingClientRect=()=>({width:1000,height:460,top:0,left:0});
  w.eval(script);const scene=await w.mountTestScene(art,course);let now=1000;
  const tick=(elapsed=34)=>{now+=elapsed;const pending=[...callbacks.values()];callbacks.clear();for(const fn of pending)fn(now);};
  tick();assert.equal(art.dataset.renderer,'canvas2d');assert.equal(art.dataset.sceneReady,'true');assert.ok(draws>0);
  const first=+art.dataset.sceneFrame;tick();assert.equal(+art.dataset.sceneFrame,first+1,'exactly one scene frame per tick');
  for(let i=0;i<200;i++)tick(40);assert.equal(art.dataset.quality,'balanced');assert.ok(+art.dataset.sceneFrame>181,'adaptive resolution must keep rendering after its resize');
  w.GuideMotion.setPaused(true);tick();const paused=+art.dataset.sceneFrame;tick();assert.equal(+art.dataset.sceneFrame,paused,'paused scene sleeps');
  w.GuideMotion.setPaused(false);tick();assert.equal(+art.dataset.sceneFrame,paused+1);
  intersections.at(-1)([{isIntersecting:false}]);const sleeping=+art.dataset.sceneFrame;tick();assert.equal(+art.dataset.sceneFrame,sleeping);
  intersections.at(-1)([{isIntersecting:true}]);tick();assert.equal(+art.dataset.sceneFrame,sleeping+1);
  scene.dispose();const disposed=+art.dataset.sceneFrame;w.document.dispatchEvent(new w.Event('guide-completion'));tick();assert.equal(+art.dataset.sceneFrame,disposed);dom.window.close();
 }
});
