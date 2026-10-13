import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';

import * as generator from '../tools/generate-modulepreloads.mjs';
const withoutGenerated=html=>html.replace(/<!-- BEGIN GENERATED BOOT PRELOADS: tools\/generate-modulepreloads\.mjs -->[\s\S]*?<!-- END GENERATED BOOT PRELOADS -->\n?/g,'');

for(const documentPath of ['index.html','cen100/index.html','mth140/index.html','mth141/index.html']){
 test(`checked-in boot preloads agree with ${documentPath}`,async()=>{
  const rootDir=path.resolve(import.meta.dirname,'..'),html=await readFile(path.join(rootDir,documentPath),'utf8');
  const expected=await generator.generateRoutePreloads({rootDir,documentPath,html});
  assert.equal(html,expected.html,'Boot preload URLs differ from the native graph; run node tools/generate-modulepreloads.mjs --write');
 });
}

test('real route blocks preload their exact critical URLs and only the Latin font',async()=>{
 const rootDir=path.resolve(import.meta.dirname,'..');
 for(const documentPath of ['index.html','cen100/index.html','mth140/index.html','mth141/index.html']){
  const original=withoutGenerated(await readFile(path.join(rootDir,documentPath),'utf8'));
  const result=await generator.generateRoutePreloads({rootDir,documentPath,html:original});
  assert.equal((result.block.match(/rel="modulepreload"/g)||[]).length,result.graph.moduleCount);
  assert.match(result.block,/archivo-latin\.woff2" as="font" type="font\/woff2" crossorigin/);
  assert.doesNotMatch(result.block,/archivo-(?:vietnamese|latin-ext)|night-vendor|three-0\.186|course-scene/);
  assert.deepEqual(result.graph.aliases,[]);
  assert.ok(result.block.includes('gsap-3.15.0.mjs'));
  const entryScript=result.html.match(/<script\b[^>]*\bsrc="[^"]*app\/route-boot\.mjs[^"]*"[^>]*>/)?.index;
  assert.ok(entryScript>=result.html.indexOf(result.block)+result.block.length);
  assert.ok(result.html.indexOf(result.block)>result.html.indexOf('<script type="module" data-route-module'));
  assert.ok(entryScript<result.html.indexOf('</head>'));
  assert.equal((await generator.generateRoutePreloads({rootDir,documentPath,html:result.html})).html,result.html);
  assert.equal(result.html.slice(result.html.indexOf('</head>')),original.slice(original.indexOf('</head>')));
 }
});

test('a changed import version disagrees with the generated preload list',async()=>{
 const rootDir=await mkdtemp(path.join(tmpdir(),'tmu-preload-drift-'));
 try{
  await mkdir(path.join(rootDir,'assets','fonts'),{recursive:true});
  await mkdir(path.join(rootDir,'assets','app'));
  await mkdir(path.join(rootDir,'cen100'));
  await writeFile(path.join(rootDir,'assets','fonts','archivo.css'),"@font-face {src:url('./archivo-latin.woff2'); unicode-range:U+0000-00FF;}");
  await writeFile(path.join(rootDir,'assets','fonts','archivo-latin.woff2'),'fixture');
  await writeFile(path.join(rootDir,'assets','entry.mjs'),"import './dependency.mjs?v=before'; import('./vendor.mjs?v=lazy');");
  await writeFile(path.join(rootDir,'assets','dependency.mjs'),'export const value=1;');
  await writeFile(path.join(rootDir,'assets','app','route-boot.mjs'),'export const boot=true;');
  const html='<head>\n<link rel="stylesheet" href="../assets/fonts/archivo.css?v=font">\n<script type="module" data-route-module src="../assets/entry.mjs?v=entry"></script>\n<script type="module" src="../assets/app/route-boot.mjs?v=boot"></script>\n</head><body data-course="cen100">unchanged</body>';
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
 const original=withoutGenerated(await readFile(path.join(rootDir,documentPath),'utf8')).replace('</head>','</HEAD>');
 const entryTag=original.match(/<script\b[^>]*\bsrc="[^"]*app\/route-boot\.mjs[^"]*"[^>]*>/)[0];
 const html=original.replace('<head>','<head>\n<!-- <script type="module" src="../assets/app/route-boot.mjs?v=commented"></script> -->');
 const result=await generator.generateRoutePreloads({rootDir,documentPath,html});
 assert.ok(result.html.indexOf(result.block)>result.html.indexOf('v=commented'));
 assert.ok(result.html.indexOf(result.block)<result.html.indexOf(entryTag));
});
