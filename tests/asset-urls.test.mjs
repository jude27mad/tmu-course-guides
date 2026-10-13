import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import path from 'node:path';

// Asset URLs are cache keys. GitHub Pages lets browsers reuse a response for ten minutes, and the route
// documents now share one long-lived module map, so two rules keep a deploy from mixing old and new code:
// 1. inside the shared document, every file is loaded through exactly one URL (one module instance);
// 2. a file whose bytes differ from the deployed site is served under a URL the deployed site never used.
const ROOT=path.resolve(new URL('..',import.meta.url).pathname);
const ROUTE_DOCUMENTS=['index.html','cen100/index.html','mth140/index.html','mth141/index.html'];
const PAGES=[...ROUTE_DOCUMENTS,'privacy.html','colour-preview.html'];
const DEPLOYED=process.env.DEPLOYED_REF||'origin/main';
const HTML_REF=/<(?:script|link)\b[^>]*?\b(?:src|href)\s*=\s*"([^"]+)"/gi;
const JS_REF=/(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(['"])([^'"]+)\1/g;

const work=file=>{const full=path.join(ROOT,file);return existsSync(full)?readFileSync(full):null;};
let gitOK=true;
const deployed=file=>{try{return execFileSync('git',['-C',ROOT,'show',`${DEPLOYED}:${file}`],{stdio:['ignore','pipe','ignore'],maxBuffer:64<<20});}catch{return null;}};
try{execFileSync('git',['-C',ROOT,'rev-parse','--verify',DEPLOYED],{stdio:'ignore'});}catch{gitOK=false;}

function references(file,text){
 const specs=[];
 if(file.endsWith('.html'))for(const m of text.matchAll(HTML_REF))specs.push(m[1]);
 for(const m of text.matchAll(JS_REF))specs.push(m[2]);
 return specs.filter(spec=>!/^(?:[a-z]+:|\/\/|#)/i.test(spec)&&!spec.includes('${')&&/\.(?:mjs|js|css)(?:\?|$)/.test(spec)).map(spec=>{
  const [p,q='']=spec.split('?');
  return {from:file,file:path.posix.normalize(path.posix.join(path.posix.dirname(file),p)),query:q?'?'+q:''};
 });
}
// Feature modules and sheets that Night Shift loads by name with its VERSION token.
function versioned(read){
 const core=read('assets/night/core.mjs')?.toString()||'',boot=read('assets/night/boot.mjs')?.toString()||'';
 const version=core.match(/export const VERSION='([^']+)'/)?.[1];if(!version)return [];
 const names=JSON.parse((boot.match(/const FEATURES=(\[[^\]]*\])/)?.[1]||'[]').replace(/'/g,'"'));
 const query='?v='+version,from='assets/night/core.mjs';
 return [{from,file:'assets/vendor/night-vendor.mjs',query},...names.flatMap(name=>[{from,file:`assets/night/${name}.mjs`,query},{from,file:`assets/night/${name}.css`,query}])];
}
function graph(read,pages){
 const seen=new Set(),refs=[],queue=[...pages];
 while(queue.length){
  const file=queue.shift();if(seen.has(file))continue;seen.add(file);
  const bytes=read(file);if(!bytes)continue;
  for(const ref of references(file,bytes.toString())){refs.push(ref);if(/\.(?:mjs|js)$/.test(ref.file)&&!ref.file.startsWith('assets/vendor/'))queue.push(ref.file);}
  if(file==='assets/night/core.mjs')for(const ref of versioned(read)){refs.push(ref);if(ref.file.endsWith('.mjs'))queue.push(ref.file);}
 }
 return refs;
}

test('inside the shared route document every asset has exactly one URL',()=>{
 const urls=new Map();
 for(const ref of graph(work,ROUTE_DOCUMENTS)){if(!urls.has(ref.file))urls.set(ref.file,new Map());const set=urls.get(ref.file);if(!set.has(ref.query))set.set(ref.query,[]);set.get(ref.query).push(ref.from);}
 const duplicates=[...urls].filter(([,queries])=>queries.size>1).map(([file,queries])=>`${file}: ${[...queries].map(([q,from])=>`${q||'(no query)'} from ${[...new Set(from)].join(', ')}`).join(' | ')}`);
 assert.deepEqual(duplicates,[],'one module instance and one stylesheet per file');
 for(const ref of graph(work,ROUTE_DOCUMENTS))assert.ok(existsSync(path.join(ROOT,ref.file)),`${ref.from} references missing ${ref.file}`);
});

test('the four route documents name the same shell scripts',()=>{
 const shell=file=>{const text=readFileSync(path.join(ROOT,file),'utf8'),dir=path.posix.dirname(file);
  return [...text.matchAll(/<script\b[^>]*>/g)].map(m=>m[0]).filter(tag=>/data-shell-module|app\/route-boot\.mjs/.test(tag)).map(tag=>{const src=tag.match(/src="([^"]+)"/)[1];return path.posix.normalize(path.posix.join(dir,src));}).sort();};
 const desk=shell('index.html');
 assert.ok(desk.some(src=>src.startsWith('assets/app/route-boot.mjs'))&&desk.some(src=>src.startsWith('assets/hub.js')));
 for(const file of ROUTE_DOCUMENTS)assert.deepEqual(shell(file),desk,file);
});

test('changed assets never reuse a URL the deployed site served',{skip:!gitOK&&`${DEPLOYED} is not available`},()=>{
 const served=new Set(graph(deployed,PAGES).map(ref=>ref.file+ref.query));
 const stale=[];
 for(const ref of graph(work,PAGES)){
  const now=work(ref.file),then=deployed(ref.file);
  if(now&&then&&!now.equals(then)&&served.has(ref.file+ref.query))stale.push(`${ref.from} -> ${ref.file}${ref.query}`);
 }
 assert.deepEqual([...new Set(stale)],[],`changed since ${DEPLOYED} but still requested under a deployed URL; bump its ?v= token everywhere it is referenced`);
});
