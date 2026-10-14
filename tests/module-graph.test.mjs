import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';

import * as utility from '../tools/module-graph.mjs';

test('static requests use the JavaScript parser and leave lazy imports outside the graph',()=>{
 const source=`
 // import './comment.mjs';
 const text="import './string.mjs'";
 const re=/import\\s+['"]fake['"]/;
 import './side-effect.mjs?v=first';
 import {value} from './dependency.mjs?v=second';
 export {value as renamed} from './dependency.mjs?v=second';
 export * as names from './reexport.mjs';
 const lazy=()=>import('./lazy-vendor.mjs?v=third');
 const computed=()=>import('./optional/'+value+'.mjs');
 const meta=import.meta.url;
 `;
 assert.deepEqual(utility.extractModuleReferences(source).staticImports,[
  './side-effect.mjs?v=first','./dependency.mjs?v=second','./reexport.mjs'
 ]);
});

test('script roots preserve document-relative URL identity and route roles',()=>{
 const html=`<!-- <script type="module" src="ignored.mjs"></script> -->
 <script>const example='<script type="module" src="ignored.mjs">';</script>
 <script type="module" data-shell-module src='../assets/shell.mjs?v=1'></script>
 <script type=module data-route-module src=../assets/route.mjs?v=2></script>
 <script type="module" src="../assets/app/route-boot.mjs?v=3"></script>
 <script src="../assets/hub.js?v=4"></script>`;
 assert.deepEqual(utility.extractDocumentModuleScripts(html,'https://site.test/project/mth140/'),[
  {url:'https://site.test/project/assets/shell.mjs?v=1',kind:'shell'},
  {url:'https://site.test/project/assets/route.mjs?v=2',kind:'route'},
  {url:'https://site.test/project/assets/app/route-boot.mjs?v=3',kind:'entry'}
 ]);
});

test('queries are distinct native modules while graph depths remain cycle safe',async()=>{
 const rootDir=await mkdtemp(path.join(tmpdir(),'tmu-module-graph-'));
 try{
  await mkdir(path.join(rootDir,'assets'));
  await writeFile(path.join(rootDir,'assets','entry.mjs'),"import './dep.mjs?v=1'; import './dep.mjs?v=2'; import('./vendor.mjs');");
  await writeFile(path.join(rootDir,'assets','dep.mjs'),"export * from './leaf.mjs';");
  await writeFile(path.join(rootDir,'assets','leaf.mjs'),"import './dep.mjs?v=1';");
  const graph=await utility.collectModuleGraph({rootDir,baseURL:'https://site.test/project/',roots:['assets/entry.mjs?v=0']});
  assert.equal(graph.moduleCount,4);
  assert.equal(graph.edgeCount,5);
  assert.equal(graph.maxDepth,2);
  assert.equal(graph.longestChainDepth,3);
  assert.deepEqual(graph.aliases,[{path:'assets/dep.mjs',urls:[
   'https://site.test/project/assets/dep.mjs?v=1','https://site.test/project/assets/dep.mjs?v=2'
  ]}]);
  assert.ok(graph.nodes.every(node=>!node.path.endsWith('vendor.mjs')));
  assert.equal(graph.nodes.find(node=>node.path==='assets/entry.mjs').imports.length,2);
 }finally{await rm(rootDir,{recursive:true,force:true});}
});

test('an eager second root shortens dependency depth without changing the static graph',async()=>{
 const rootDir=await mkdtemp(path.join(tmpdir(),'tmu-module-depth-'));
 try{
  await writeFile(path.join(rootDir,'a.mjs'),"import './b.mjs';");
  await writeFile(path.join(rootDir,'b.mjs'),"import './c.mjs';");
  await writeFile(path.join(rootDir,'c.mjs'),'export const c=1;');
  const graph=await utility.collectModuleGraph({rootDir,roots:['a.mjs','b.mjs']});
  assert.equal(graph.moduleCount,3);
  assert.equal(graph.maxDepth,1);
  assert.equal(graph.longestChainDepth,2);
 }finally{await rm(rootDir,{recursive:true,force:true});}
});

test('unresolved external requests fail instead of claiming a complete local graph',async()=>{
 const rootDir=await mkdtemp(path.join(tmpdir(),'tmu-module-external-'));
 try{
  await writeFile(path.join(rootDir,'entry.mjs'),"import 'package-name';");
  await assert.rejects(utility.collectModuleGraph({rootDir,roots:['entry.mjs']}),/Unsupported module specifier/);
 }finally{await rm(rootDir,{recursive:true,force:true});}
});

test('literal dynamic references are compiler-verified code with exact decoded version URLs',()=>{
 const source=`
 const fake="await import('./fake.mjs?v=string')";
 // await import('./fake.mjs?v=comment');
 const re=/import('fake.mjs')/;
 const object={import(){}}; object.import('./fake.mjs?v=method');
 object. /* property trivia */ import('./fake.mjs?v=commented-method');
 const $import=()=>{},éimport=()=>{};$import('./fake.mjs?v=dollar');éimport('./fake.mjs?v=unicode');
 class Example{#import(){} mount(){this.#import('./fake.mjs?v=private');}}
 async function mount(){return await import /* trivia */ ('./desk.mjs?v=real');}
 const data=()=>import('../course-data.mjs?v=\\x32').then(m=>m.COURSES);
 const computed=()=>import('./'+fake+'.mjs');
 `;
 assert.deepEqual(utility.extractModuleReferences(source).dynamicImports.map(({specifier,awaited})=>({specifier,awaited})),[
  {specifier:'./desk.mjs?v=real',awaited:true},{specifier:'../course-data.mjs?v=2',awaited:false}
 ]);
});

test('Desk boot follows awaited directory and target data while leaving vendors lazy',async()=>{
 assert.equal(typeof utility.collectBootCriticalGraph,'function');
 const rootDir=path.resolve(import.meta.dirname,'..');
 const graph=await utility.collectBootCriticalGraph({rootDir,documentPath:'index.html'});
 assert.equal(graph.bootDynamicEdges.length,3);
 assert.deepEqual(graph.bootDynamicEdges.map(edge=>new URL(edge.to).pathname).sort(),[
  '/assets/cen-schedule.mjs','/assets/course-data.mjs','/assets/night/desk.mjs'
 ]);
 assert.equal(graph.moduleCount,17);
 assert.ok(graph.nodes.some(node=>node.path==='assets/book/book-state.mjs'));
 assert.ok(graph.nodes.some(node=>node.path==='assets/book/weeks.mjs'));
 assert.ok(!graph.nodes.some(node=>node.path==='assets/vendor/night-vendor.mjs'||node.path==='assets/vendor/three-0.186.1.mjs'));
 assert.equal(graph.maxDepth,2);
 assert.equal(graph.longestChainDepth,5);
});

test('await classification honors lexical code and direct parenthesized calls',()=>{
 const references=utility.extractModuleReferences(`
 // await
 import('./comment-await.mjs');
 const object={await:1}; object.await
 import('./property-await.mjs');
 async function mount(){return await (import('./real-await.mjs'));}
 async function comma(){return await (import('./comma.mjs'),42);}
 `).dynamicImports;
 assert.deepEqual(references.map(({specifier,awaited})=>({specifier,awaited})),[
  {specifier:'./comment-await.mjs',awaited:false},{specifier:'./property-await.mjs',awaited:false},
  {specifier:'./real-await.mjs',awaited:true},{specifier:'./comma.mjs',awaited:false}
 ]);
});
