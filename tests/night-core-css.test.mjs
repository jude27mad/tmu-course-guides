import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../tools/ui-build/package.json',import.meta.url));
const {JSDOM,requestInterceptor}=require('jsdom'),{build}=require('esbuild');
const code=(await build({stdin:{contents:"import {loadCSS} from './assets/night/core.mjs';window.loadCSS=loadCSS;",resolveDir:new URL('..',import.meta.url).pathname},bundle:true,format:'iife',write:false,logLevel:'silent',plugins:[{name:'module-url',setup(build){build.onLoad({filter:/core\.mjs$/},args=>({contents:readFileSync(args.path,'utf8').replaceAll('import.meta.url',JSON.stringify('https://guide.test/assets/night/core.mjs')),loader:'js'}));}}]})).outputFiles[0].text;

test('loadCSS reactivates a retained feature sheet without loading it again',async()=>{
 const requests=[];
 const resources={interceptors:[requestInterceptor(request=>{requests.push(request.url);return new Response('body{color:blue}',{headers:{'Content-Type':'text/css'}});})]};
 const dom=new JSDOM('<!doctype html><body data-page="desk"></body>',{url:'https://guide.test/',runScripts:'outside-only',resources});
 const w=dom.window;w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});w.eval(code);
 try{
  const link=await w.loadCSS('hero');
  assert.ok(link.sheet,'the feature stylesheet finished loading');
  link.sheet.media.mediaText='not all';
  assert.equal(await w.loadCSS('hero'),link,'the loaded link keeps its identity and position');
  assert.equal(link.sheet.media.mediaText,'','a retained feature applies when its owner remounts');
  assert.equal(requests.length,1,'reactivation does not create an offline network request');
  assert.equal(w.document.querySelectorAll('link[data-night="hero"]').length,1);
 }finally{dom.window.close();}
});
