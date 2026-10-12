import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {normalizeBase,mapPath,createPreview} from '../tools/preview-server.mjs';

/* The preview server can reproduce the Pages project base (/tmu-course-guides/) as well as the plain root. */
const root=fileURLToPath(new URL('..',import.meta.url));

test('base normalization',()=>{
  for(const value of [undefined,'','/','//'])assert.equal(normalizeBase(value),'/');
  for(const value of ['tmu-course-guides','/tmu-course-guides','/tmu-course-guides/','tmu-course-guides/'])assert.equal(normalizeBase(value),'/tmu-course-guides/');
});

test('paths map inside the base only',()=>{
  assert.equal(mapPath('/','/'),'');
  assert.equal(mapPath('/cen100/','/'),'cen100/');
  assert.equal(mapPath('/assets/hub.js','/'),'assets/hub.js');
  const base='/tmu-course-guides/';
  assert.equal(mapPath('/tmu-course-guides/',base),'');
  assert.equal(mapPath('/tmu-course-guides/cen100/',base),'cen100/');
  assert.equal(mapPath('/tmu-course-guides/assets/hub.js',base),'assets/hub.js');
  for(const outside of ['/','/cen100/','/assets/hub.js','/tmu-course-guides-x/','/other/tmu-course-guides/'])assert.equal(mapPath(outside,base),null,outside);
});

test('a project-base server 404s outside the base, serves the Desk at its root and redirects bare directories',async t=>{
  const server=createPreview({root,base:'/tmu-course-guides/'});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>server.close());
  const at=path=>fetch(`http://127.0.0.1:${server.address().port}${path}`,{redirect:'manual'});
  const desk=await at('/tmu-course-guides/');assert.equal(desk.status,200);assert.match(await desk.text(),/data-page="desk"/);
  const cen=await at('/tmu-course-guides/cen100/?motion=off');assert.equal(cen.status,200);assert.match(await cen.text(),/data-course="cen100"/);
  for(const path of ['/','/cen100/','/index.html','/assets/hub.js','/tmu-course-guides/../package.json','/tmu-course-guides/%2e%2e/package.json'])assert.equal((await at(path)).status,404,path);
  for(const [path,location] of [['/tmu-course-guides','/tmu-course-guides/'],['/tmu-course-guides/cen100?x=1','/tmu-course-guides/cen100/?x=1']]){
    const r=await at(path);assert.equal(r.status,301,path);assert.equal(r.headers.get('location'),location);
  }
});

test('the default root server still serves the site at /',async t=>{
  const server=createPreview({root});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>server.close());
  const at=path=>fetch(`http://127.0.0.1:${server.address().port}${path}`,{redirect:'manual'});
  assert.equal((await at('/')).status,200);assert.equal((await at('/mth140/')).status,200);
  assert.equal((await at('/assets/legacy-route.js')).headers.get('content-type'),'text/javascript');
  assert.equal((await at('/tmu-course-guides/')).status,404);
});
