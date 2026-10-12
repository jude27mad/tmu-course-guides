import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
const require=createRequire(new URL('../tools/ui-build/package.json',import.meta.url));
const {JSDOM}=require('jsdom'),{build}=require('esbuild');
const root=new URL('..',import.meta.url).pathname;
test('header teardown releases a scene while shader compilation is still pending',async()=>{
 const shim=`export * from '${root}tools/scene-build/node_modules/three/build/three.module.js';
 import {Texture} from '${root}tools/scene-build/node_modules/three/build/three.module.js';
 export class WebGLRenderer{constructor(){this.debug={};this.info={render:{calls:0,triangles:0},reset(){}};}setPixelRatio(){}setSize(){}render(){}dispose(){window.rendererDisposals++;}compileAsync(){window.notifyCompile();return new Promise(r=>window.finishCompile=r);}}
 export class PMREMGenerator{fromScene(){return{texture:new Texture(),dispose(){window.environmentDisposals++;}}}dispose(){}}
 export {RoundedBoxGeometry} from '${root}tools/scene-build/node_modules/three/examples/jsm/geometries/RoundedBoxGeometry.js';
 export {mergeGeometries} from '${root}tools/scene-build/node_modules/three/examples/jsm/utils/BufferGeometryUtils.js';`;
 const plugin={name:'pending-shader',setup(b){b.onResolve({filter:/vendor\/three-0\.186\.1/},()=>({path:'renderer',namespace:'renderer'}));b.onLoad({filter:/.*/,namespace:'renderer'},()=>({contents:shim,resolveDir:root}));b.onLoad({filter:/\.mjs$/,namespace:'file'},async a=>({contents:(await readFile(a.path,'utf8')).replaceAll('import.meta.url',JSON.stringify('https://guide.test/assets/'+a.path.split('/assets/')[1])),loader:'js'}));}};
 const script=(await build({stdin:{contents:"import * as header from './assets/course-header.mjs';window.header=header;",resolveDir:root},bundle:true,format:'iife',write:false,logLevel:'silent',plugins:[plugin]})).outputFiles[0].text;
 const dom=new JSDOM('<body class="workspace" data-course="cen100"><main><header class="circuit-head"><div class="hero-copy"><p class="team">Fall 2026</p><h1>Engineering</h1></div></header></main></body>',{url:'https://guide.test/cen100/',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
 let observers=0;w.rendererDisposals=w.environmentDisposals=0;
 w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
 for(const name of ['MutationObserver','ResizeObserver','IntersectionObserver'])w[name]=class{observe(){observers++;this.active=true;}disconnect(){if(this.active){observers--;this.active=false;}}};
 w.HTMLCanvasElement.prototype.getContext=type=>type==='webgl2'?{}:null;
 const captured=new Set();w.HTMLElement.prototype.setPointerCapture=id=>captured.add(id);w.HTMLElement.prototype.hasPointerCapture=id=>captured.has(id);w.HTMLElement.prototype.releasePointerCapture=id=>captured.delete(id);
 try{
 w.eval(script);const started=new Promise(r=>w.notifyCompile=r),controller=new w.AbortController();const pending=w.header.mount({root:w.document.querySelector('main'),route:'cen100',signal:controller.signal,direct:false});await started;
 const art=w.document.querySelector('.header-art'),press=new w.Event('pointerdown');Object.assign(press,{pointerId:12,clientX:10,clientY:10,button:0});art.dispatchEvent(press);assert(captured.has(12));
 controller.abort();w.header.unmount();assert.equal(observers,0,'no scene observers survive pending compile');assert.equal(w.rendererDisposals,1);assert.equal(w.environmentDisposals,1);assert.equal(captured.size,0,'teardown releases pointer capture');
 w.finishCompile();await pending;assert.equal(w.rendererDisposals,1,'late completion does not dispose twice');
 }finally{dom.window.close();}
});
