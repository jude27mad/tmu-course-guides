import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {bootDocument} from '../assets/app/route-boot.mjs';

const require=createRequire(new URL('../tools/ui-build/package.json',import.meta.url));
const {JSDOM}=require('jsdom'),{build}=require('esbuild');
const root=fileURLToPath(new URL('..',import.meta.url));
const base='https://guide.test/tmu-course-guides/';
const turn=()=>new Promise(resolve=>setImmediate(resolve));
function deferred(){
 let resolve,settled=false;
 const promise=new Promise(done=>{resolve=value=>{settled=true;done(value);};});
 return {promise,resolve,get settled(){return settled;}};
}
async function bounded(promise,message){
 let timer;
 try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(message)),1000);})]);}
 finally{clearTimeout(timer);}
}

// Only the GPU dependency is replaced. The header, its resource scope, direct
// bootstrap and navigation queue remain the production implementations.
let headerBundle;
async function bundledHeader(){
 headerBundle??=build({
  stdin:{contents:"import * as header from './assets/course-header.mjs';window.headerModule=header;",resolveDir:root},
  bundle:true,format:'iife',write:false,logLevel:'silent',
  plugins:[{name:'pending-route-scene',setup(builder){
   builder.onResolve({filter:/course-scene\.mjs(?:\?|$)/},()=>({path:'scene',namespace:'pending-scene'}));
   builder.onLoad({filter:/.*/,namespace:'pending-scene'},()=>({contents:`
    export async function mountScene(art,route,signal){
     const task=window.sceneTask(art,route,signal);
     const scene={dispose(){task.disposed=true;}};
     signal.addEventListener('abort',scene.dispose,{once:true});
     await task.ready.promise;
     return scene;
    }`}));
   builder.onLoad({filter:/\.mjs$/,namespace:'file'},async entry=>({
    contents:(await readFile(entry.path,'utf8')).replaceAll('import.meta.url',JSON.stringify(new URL(path.relative(root,entry.path).split(path.sep).join('/'),base).href)),
    loader:'js'
   }));
  }}]
 }).then(result=>result.outputFiles[0].text);
 return headerBundle;
}
function markup(route){
 const assets=route==='desk'?'assets/':'../assets/';
 return `<!doctype html><html><head><title>${route}</title>
  ${route==='desk'?'':`<script type="module" data-route-module src="${assets}course-header.mjs"></script>`}
  <script type="module" data-route-module src="${assets}after-header.mjs"></script>
  </head><body class="workspace" ${route==='desk'?'data-page="desk"':`data-course="${route}"`}>
  <main data-route-region><header class="course-heading"><div class="hero-copy"><p class="eyebrow">Fall 2026</p><h1>${route}</h1></div></header>
  <a href="${new URL('cen100/',base).href}">CEN100</a></main></body></html>`;
}
async function fixture(route){
 const script=await bundledHeader();
 const dom=new JSDOM(markup(route),{url:new URL(route==='desk'?'':route+'/',base).href+'?motion=off',runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window,calls=[],changes=[],fallbacks=[],pending=[];
 const scenes=new Map(['cen100','mth140','mth141'].map(name=>[name,{ready:deferred(),started:deferred(),signal:null,disposed:false}]));
 w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
 w.ResizeObserver=w.IntersectionObserver=class{observe(){}disconnect(){}};
 w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};
 w.sceneTask=(art,name,signal)=>{const scene=scenes.get(name);scene.art=art;scene.signal=signal;scene.started.resolve();return scene;};
 w.eval(script);
 w.document.addEventListener('route-changed',event=>changes.push(event.detail.route));
 let router;
 const boot=bootDocument({
  window:w,moduleURL:new URL('assets/app/router.mjs',base).href,autoPrefetch:false,loadStylesheet:async()=>{},
  assign:url=>fallbacks.push(url),
  importModule:async url=>url.includes('course-header.mjs')?w.headerModule:{mount(ctx){calls.push(ctx.route);},unmount(){}},
  fetch:async url=>{const name=new URL(url).pathname.slice(new URL(base).pathname.length).split('/')[0]||'desk';return {ok:true,url,text:async()=>markup(name)};}
 }).then(value=>{router=value;return value;});
 pending.push(boot);
 return {w,calls,changes,fallbacks,scenes,boot,track(promise){pending.push(promise);return promise;},async close(){
  for(const scene of scenes.values())scene.ready.resolve();
  await bounded(Promise.allSettled(pending),'route cleanup did not settle');
  router?.stop();w.headerModule.unmount();w.close();
 }};
}

// MTH141 still mounts course-scene.mjs; MTH140's book has its own readiness tests in book-lifecycle.cjs.
test('direct routes enable navigation before their header scene is ready',async()=>{
 const f=await fixture('mth141');
 try{
  const scene=f.scenes.get('mth141');
  await bounded(scene.started.promise,'direct header scene did not start');
  let ready=false;f.boot.then(()=>{ready=true;});await turn();
  assert.equal(ready,true,'direct boot must finish while scene initialization remains pending');
  assert.equal(scene.ready.settled,false);
  assert.deepEqual(f.calls,['mth141'],'the route module after the header must mount');
  assert.deepEqual(f.changes,['mth141']);
  const shell=f.w.document.documentElement.dataset.shellId;
  const changed=deferred();f.w.document.addEventListener('route-changed',()=>changed.resolve(),{once:true});
  let intercepted;
  f.w.document.addEventListener('click',event=>{intercepted=event.defaultPrevented;if(!intercepted)event.preventDefault();},{once:true});
  f.w.document.querySelector('a').dispatchEvent(new f.w.MouseEvent('click',{bubbles:true,cancelable:true,button:0}));
  assert.equal(intercepted,true,'router capture must handle course links before scene readiness');
  await bounded(changed.promise,'intercepted course navigation did not finish');
  assert.equal(f.w.TMURouter.route,'cen100');
  assert.equal(scene.signal.aborted,true);
  assert.equal(scene.disposed,true);
  assert.equal(f.w.document.documentElement.dataset.shellId,shell);
  assert.deepEqual(f.fallbacks,[]);
 }finally{await f.close();}
});

test('a pending course scene cannot block the next route in the navigation queue',async()=>{
 const f=await fixture('desk');
 try{
  const router=await bounded(f.boot,'Desk boot did not finish');
  const shell=f.w.document.documentElement.dataset.shellId,scene=f.scenes.get('cen100');
  const first=f.track(router.navigate(new URL('cen100/',base).href));
  await bounded(scene.started.promise,'swapped course scene did not start');
  const second=f.track(router.navigate(new URL('mth141/',base).href));
  let ready=false;second.then(()=>{ready=true;});await turn();await turn();
  assert.equal(ready,true,'the next route must commit while the previous shader scene is pending');
  assert.equal(await first,true);assert.equal(await second,true);
  assert.equal(scene.ready.settled,false);
  assert.equal(scene.signal.aborted,true,'the outgoing pending scene must receive abort');
  assert.equal(scene.disposed,true);
  assert.equal(router.route,'mth141');
  assert.equal(f.w.document.body.dataset.course,'mth141');
  assert.equal(f.w.location.pathname,'/tmu-course-guides/mth141/');
  assert.deepEqual(f.calls,['desk','cen100','mth141']);
  assert.deepEqual(f.changes,['desk','cen100','mth141']);
  assert.equal(f.w.document.documentElement.dataset.shellId,shell);
  assert.deepEqual(f.fallbacks,[]);
 }finally{await f.close();}
});
