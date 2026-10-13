import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';

import * as generator from '../tools/generate-modulepreloads.mjs';

test('real route blocks preload their exact critical URLs and only the Latin font',async()=>{
 const rootDir=path.resolve(import.meta.dirname,'..');
 for(const documentPath of ['index.html','cen100/index.html','mth140/index.html','mth141/index.html']){
  const original=await readFile(path.join(rootDir,documentPath),'utf8');
  const result=await generator.generateRoutePreloads({rootDir,documentPath,html:original});
  assert.equal((result.block.match(/rel="modulepreload"/g)||[]).length,result.graph.moduleCount);
  assert.match(result.block,/archivo-latin\.woff2" as="font" type="font\/woff2" crossorigin/);
  assert.doesNotMatch(result.block,/archivo-(?:vietnamese|latin-ext)|night-vendor|three-0\.186|course-scene/);
  assert.deepEqual(result.graph.aliases,[]);
  assert.ok(result.block.includes('gsap-3.15.0.mjs'));
  const firstScript=result.html.indexOf('<script type="module" data-route-module');
  assert.ok(firstScript>result.html.indexOf(result.block));
  assert.equal((await generator.generateRoutePreloads({rootDir,documentPath,html:result.html})).html,result.html);
  assert.equal(result.html.slice(result.html.indexOf('</head>')),original.slice(original.indexOf('</head>')));
 }
});

test('a changed import version disagrees with the generated preload list',async()=>{
 const rootDir=await mkdtemp(path.join(tmpdir(),'tmu-preload-drift-'));
 try{
  await mkdir(path.join(rootDir,'assets','fonts'),{recursive:true});
  await mkdir(path.join(rootDir,'cen100'));
  await writeFile(path.join(rootDir,'assets','fonts','archivo.css'),"@font-face {src:url('./archivo-latin.woff2'); unicode-range:U+0000-00FF;}");
  await writeFile(path.join(rootDir,'assets','fonts','archivo-latin.woff2'),'fixture');
  await writeFile(path.join(rootDir,'assets','entry.mjs'),"import './dependency.mjs?v=before'; import('./vendor.mjs?v=lazy');");
  await writeFile(path.join(rootDir,'assets','dependency.mjs'),'export const value=1;');
  const html='<head>\n<link rel="stylesheet" href="../assets/fonts/archivo.css?v=font">\n<script type="module" data-route-module src="../assets/entry.mjs?v=entry"></script>\n</head><body data-course="cen100">unchanged</body>';
  const initial=await generator.generateRoutePreloads({rootDir,documentPath:'cen100/index.html',html});
  assert.match(initial.block,/dependency\.mjs\?v=before/);
  await writeFile(path.join(rootDir,'assets','entry.mjs'),"import './dependency.mjs?v=after'; import('./vendor.mjs?v=lazy');");
  const updated=await generator.generateRoutePreloads({rootDir,documentPath:'cen100/index.html',html:initial.html});
  assert.notEqual(updated.html,initial.html);
  assert.match(updated.block,/dependency\.mjs\?v=after/);
  assert.doesNotMatch(updated.block,/v=before|vendor\.mjs/);
  assert.equal((await generator.generateRoutePreloads({rootDir,documentPath:'cen100/index.html',html:updated.html})).html,updated.html);
 }finally{await rm(rootDir,{recursive:true,force:true});}
});

test('root and project-subpath documents produce identical relative preload blocks',async()=>{
 const rootDir=path.resolve(import.meta.dirname,'..'),documentPath='mth140/index.html';
 const atRoot=await generator.generateRoutePreloads({rootDir,documentPath,baseURL:'https://site.test/'});
 const underProject=await generator.generateRoutePreloads({rootDir,documentPath,baseURL:'https://site.test/tmu-course-guides/'});
 assert.equal(atRoot.block,underProject.block);
});

test('insertion ignores commented module tags and accepts HTML head casing',async()=>{
 const rootDir=path.resolve(import.meta.dirname,'..'),documentPath='mth140/index.html';
 const original=(await readFile(path.join(rootDir,documentPath),'utf8')).replace('</head>','</HEAD>');
 const html=original.replace('<head>','<head>\n<!-- <script type="module" data-route-module src="../assets/commented.mjs"></script> -->');
 const result=await generator.generateRoutePreloads({rootDir,documentPath,html});
 assert.ok(result.html.indexOf(result.block)>result.html.indexOf('commented.mjs'));
 assert.ok(result.html.indexOf(result.block)<result.html.indexOf('<script type="module" data-route-module src="../assets/visuals.js'));
});
