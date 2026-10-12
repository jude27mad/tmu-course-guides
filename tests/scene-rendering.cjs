const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {JSDOM}=require('../tools/ui-build/node_modules/jsdom'),esbuild=require('../tools/ui-build/node_modules/esbuild');
const root=path.resolve(__dirname,'..');
async function fixture(gpu=true){
 const shim=`export * from '${root}/tools/scene-build/node_modules/three/build/three.module.js';
 import {Texture} from '${root}/tools/scene-build/node_modules/three/build/three.module.js';
 export class WebGLRenderer{constructor({canvas}){this.domElement=canvas;this.debug={checkShaderErrors:true,onShaderError:null};this.info={render:{calls:0,triangles:0},autoReset:true,reset:()=>{}};}setPixelRatio(){}setSize(){}render(){if(window.failShader)this.debug.onShaderError?.({},null,null,null);this.info.render.calls=10;this.info.render.triangles=1000;}dispose(){}async compileAsync(){}}
 export class PMREMGenerator{fromScene(){return{texture:new Texture(),dispose(){}}}dispose(){}}
 export {RoundedBoxGeometry} from '${root}/tools/scene-build/node_modules/three/examples/jsm/geometries/RoundedBoxGeometry.js';
 export {mergeGeometries} from '${root}/tools/scene-build/node_modules/three/examples/jsm/utils/BufferGeometryUtils.js';`;
 const plugin={name:'lifecycle-renderer-fixture',setup(build){build.onResolve({filter:/vendor\/three-0\.186\.1/},()=>({path:'renderer-fixture',namespace:'renderer-fixture'}));build.onLoad({filter:/.*/,namespace:'renderer-fixture'},()=>({contents:shim,resolveDir:root}));}};
 const script=(await esbuild.build({stdin:{contents:"import {mountScene} from './assets/course-scene.mjs';window.mountTestScene=mountScene;",resolveDir:root},plugins:[plugin],bundle:true,format:'iife',write:false,logLevel:'silent'})).outputFiles[0].text;
 const dom=new JSDOM('<header data-urgency="calm"><div class="header-art"><img class="scene-poster" data-wide="/wide.webp" data-tall="/tall.webp"></div></header>',{url:'https://guide.test/',pretendToBeVisual:true,runScripts:'outside-only'}),w=dom.window,callbacks=new Map(),intersections=[];
 let id=0,now=1000;w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});w.requestAnimationFrame=fn=>{callbacks.set(++id,fn);return id;};w.cancelAnimationFrame=id=>callbacks.delete(id);
 w.ResizeObserver=class{observe(){}disconnect(){}};w.IntersectionObserver=class{constructor(fn){intersections.push(fn)}observe(){}disconnect(){}};
 w.HTMLCanvasElement.prototype.getContext=type=>gpu&&type==='webgl2'?{}:null;
 const art=w.document.querySelector('.header-art');art.getBoundingClientRect=()=>({width:1000,height:460,top:0,left:0});w.eval(script);const scene=await w.mountTestScene(art,'cen100');
 return{w,dom,art,scene,callbacks,intersections,tick(elapsed=34){now+=elapsed;const pending=[...callbacks.values()];callbacks.clear();for(const fn of pending)fn(now);}};
}
test('context loss shows the authored poster and releases the scene frame loop',async()=>{
 const f=await fixture();f.tick();assert.equal(f.art.dataset.renderer,'webgl2');const canvas=f.art.querySelector('canvas');
 canvas.dispatchEvent(new f.w.Event('webglcontextlost',{cancelable:true}));f.tick();assert.equal(f.art.dataset.renderer,'poster');assert.equal(f.art.querySelector('canvas'),null);assert.ok(f.art.querySelector('img').src.endsWith('wide.webp'));const stopped=+f.art.dataset.sceneFrame;for(let i=0;i<10;i++)f.tick();assert.equal(+f.art.dataset.sceneFrame,stopped);
 f.scene.dispose();f.dom.window.close();
});
test('unsupported rendering uses an immediate poster without a busy animation loop',async()=>{
 const f=await fixture(false);f.tick();assert.equal(f.art.dataset.renderer,'poster');assert.equal(f.art.dataset.sceneReady,'true');const stopped=+f.art.dataset.sceneFrame;for(let i=0;i<10;i++)f.tick();assert.equal(+f.art.dataset.sceneFrame,stopped);
 f.intersections.at(-1)([{isIntersecting:false}]);assert.equal(f.art.dataset.awake,'false');f.scene.dispose();f.dom.window.close();
});
test('nonthrowing shader link failure returns to the poster and stops the GPU frame loop',async()=>{
 const f=await fixture();f.w.failShader=true;f.tick();assert.equal(f.art.dataset.renderer,'poster');assert.equal(f.art.querySelector('canvas'),null);
 const stopped=+f.art.dataset.sceneFrame;for(let i=0;i<10;i++)f.tick();assert.equal(+f.art.dataset.sceneFrame,stopped);f.scene.dispose();f.dom.window.close();
});
test('adaptive GPU frame scheduling keeps advancing after downgrade and sleeps while paused or offscreen',async()=>{
 const f=await fixture();f.tick();for(let i=0;i<200;i++)f.tick(40);assert.equal(f.art.dataset.quality,'balanced');assert.ok(+f.art.dataset.sceneFrame>181);
 f.w.GuideMotion.setPaused(true);f.tick();const paused=+f.art.dataset.sceneFrame;f.tick();assert.equal(+f.art.dataset.sceneFrame,paused);
 f.w.GuideMotion.setPaused(false);f.tick();assert.equal(+f.art.dataset.sceneFrame,paused+1);
 f.intersections.at(-1)([{isIntersecting:false}]);f.tick();assert.equal(+f.art.dataset.sceneFrame,paused+1);
 f.intersections.at(-1)([{isIntersecting:true}]);f.tick();assert.equal(+f.art.dataset.sceneFrame,paused+2);
 f.scene.dispose();const stopped=+f.art.dataset.sceneFrame;f.tick();assert.equal(+f.art.dataset.sceneFrame,stopped);f.dom.window.close();
});
test('touch drag rotates through movement, releases with inertia, and pointer cancellation clears it',async()=>{
 const f=await fixture();f.art.setPointerCapture=()=>{};f.tick();
 const pointer=(type,x,y,id=7)=>{const e=new f.w.Event(type);Object.assign(e,{pointerId:id,pointerType:'touch',clientX:x,clientY:y,button:0});f.art.dispatchEvent(e);};
 pointer('pointerdown',100,100);pointer('pointermove',230,120);f.tick();assert.equal(f.art.dataset.dragging,'true');const first=+f.art.dataset.rotation.split(',')[0];assert.ok(first>.3);
 pointer('pointerup',230,120);pointer('lostpointercapture',230,120);f.tick();assert.ok(+f.art.dataset.rotation.split(',')[0]>first,'normal capture release retains inertia');
 pointer('pointerdown',100,100);pointer('pointermove',200,100);pointer('pointercancel',200,100);f.tick();const stopped=f.art.dataset.rotation;f.tick();assert.equal(f.art.dataset.rotation,stopped);
 f.scene.dispose();f.dom.window.close();
});
test('pausing mid-drag releases the gesture so a later touch can start',async()=>{
 const f=await fixture();f.art.setPointerCapture=()=>{};f.tick();const down=id=>{const e=new f.w.Event('pointerdown');Object.assign(e,{pointerId:id,pointerType:'touch',clientX:10,clientY:10,button:0});f.art.dispatchEvent(e);};down(1);f.w.GuideMotion.setPaused(true);f.tick();f.w.GuideMotion.setPaused(false);f.tick();down(2);assert.equal(f.art.dataset.dragging,'true');f.scene.dispose();f.dom.window.close();
});
