// Browser-like singleton module graph for jsdom. Every route gets the same
// namespace objects; re-evaluating one bundle per script would hide lifecycle
// bugs and duplicate the shell controllers on a real route swap.
const fs=require('node:fs');
const path=require('node:path');
const esbuild=require('esbuild');
const {JSDOM,VirtualConsole,requestInterceptor}=require('jsdom');
const entries=[
 'assets/cen-guide.mjs','assets/math-guide.mjs','assets/math-labs.mjs',
 'assets/editorial.mjs','assets/workspace.mjs','assets/course-header.mjs',
 'assets/visuals.js','assets/guide-motion.mjs','assets/night/core.mjs',
 'assets/night/boot.mjs','assets/night/deadline.mjs','assets/night/timeline.mjs',
 'assets/night/desk.mjs','assets/night/hero.mjs','assets/night/scroll.mjs',
 'assets/course-data.mjs','assets/cen-schedule.mjs','assets/course-scene.mjs',
 'assets/vendor/gsap-3.15.0.mjs','assets/vendor/night-vendor.mjs',
 'assets/app/route-boot.mjs',
];
const bundleCache=new Map();
async function moduleBundle(root,base='https://guide.test/'){
 const key=root+'|'+base;if(bundleCache.has(key))return bundleCache.get(key);
 const imports=entries.map((file,index)=>`import * as m${index} from ${JSON.stringify('./'+file)};`).join('\n');
 const registry=entries.map((file,index)=>`${JSON.stringify(new URL(file,base).pathname)}:m${index}`).join(',');
 const source=imports+`\nconst namespaces={${registry}};\n`+
  `globalThis.__tmuImport=async url=>{const key=new URL(url,location.href).pathname;if(!namespaces[key])throw Error('Unregistered browser module '+url);return namespaces[key];};\n`+
  `globalThis.__tmuModules=namespaces;`;
 const result=await esbuild.build({stdin:{contents:source,resolveDir:root,sourcefile:'route-harness-entry.mjs'},bundle:true,write:false,format:'iife',logLevel:'silent',plugins:[{name:'browser-module-graph',setup(build){
  build.onResolve({filter:/\.(?:mjs|js)\?/},args=>({path:path.resolve(args.resolveDir,args.path.split('?')[0])}));
  build.onLoad({filter:/\.(?:mjs|js)$/},async args=>{
   if(!args.path.startsWith(path.join(root,'assets')+path.sep))return;
   const url=new URL(path.relative(root,args.path).split(path.sep).join('/'),base).href;
   const contents=fs.readFileSync(args.path,'utf8').replaceAll('import.meta.url',JSON.stringify(url))
    .replace(/\bimport\s*\(/g,`((src)=>globalThis.__tmuImport(new URL(src,${JSON.stringify(url)}).href))(`);
   return {contents,loader:'js'};
  });
 }}]});
 const code=result.outputFiles[0].text;bundleCache.set(key,code);return code;
}
function instrument(window){
 const records=new Set(),proto=window.EventTarget.prototype;
 const add=proto.addEventListener,remove=proto.removeEventListener;
 const capture=options=>typeof options==='boolean'?options:Boolean(options?.capture);
 proto.addEventListener=function(type,listener,options){
  if(!listener||options?.signal?.aborted)return add.call(this,type,listener,options);
  const cap=capture(options);
  if([...records].some(r=>r.target===this&&r.type===type&&r.listener===listener&&r.capture===cap))return add.call(this,type,listener,options);
  const row={target:this,type,listener,capture:cap};records.add(row);
  if(options?.signal)add.call(options.signal,'abort',()=>records.delete(row),{once:true});
  if(options?.once){const target=this;row.actual=function(event){records.delete(row);return typeof listener==='function'?listener.call(target,event):listener.handleEvent(event);};}
  return add.call(this,type,row.actual||listener,options);
 };
 proto.removeEventListener=function(type,listener,options){
  const row=[...records].find(r=>r.target===this&&r.type===type&&r.listener===listener&&r.capture===capture(options));
  if(row)records.delete(row);return remove.call(this,type,row?.actual||listener,options);
 };
 const observers=new Set(),NativeMO=window.MutationObserver;
 window.MutationObserver=class extends NativeMO{observe(...args){observers.add(this);return super.observe(...args)}disconnect(){observers.delete(this);return super.disconnect()}};
 for(const name of ['IntersectionObserver','ResizeObserver'])window[name]=class{observe(){observers.add(this)}unobserve(){}disconnect(){observers.delete(this)}};
 return {counts:()=>({listeners:[...records].filter(r=>r.target===window||r.target===window.document||r.target.nodeType===1&&r.target.isConnected).length,observers:observers.size})};
}
function browserDefaults(window){
 window.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
 window.HTMLCanvasElement.prototype.getContext=()=>null;
 window.scrollTo=()=>{};window.HTMLElement.prototype.scrollIntoView=()=>{};
 window.HTMLDialogElement.prototype.showModal=function(){this.open=true};
 window.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new window.Event('close'))};
}
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(predicate,message,timeout=15000){
 const start=Date.now();while(!predicate()){if(Date.now()-start>timeout)throw Error(message);await pause(20);}
}
async function createGuide({root=path.resolve(__dirname,'../..'),route='',motion='off',base='https://guide.test/',beforeParse,instrumentCounts=false}={}){
 const code=await moduleBundle(root,base),baseURL=new URL(base),errors=[],fallbacks=[];
 const fileFor=url=>{const u=new URL(url,base);if(u.origin!==baseURL.origin||!u.pathname.startsWith(baseURL.pathname))return null;const suffix=u.pathname.slice(baseURL.pathname.length);return path.join(root,suffix.endsWith('/')||!suffix?suffix+'index.html':suffix);};
 const fetch=async url=>{const file=fileFor(url);return file&&fs.existsSync(file)?new Response(fs.readFileSync(file,'utf8'),{headers:{'Content-Type':'text/html'}}):new Response('',{status:404})};
 const resources={interceptors:[requestInterceptor(async request=>{
  const file=fileFor(request.url);if(!file||!fs.existsSync(file))return new Response('',{status:404});
  if(file.endsWith('assets/app/route-boot.mjs'))return new Response(code,{headers:{'Content-Type':'application/javascript'}});
  return new Response(fs.readFileSync(file),{headers:{'Content-Type':file.endsWith('.css')?'text/css':'application/javascript'}});
 })]};
 const log=new VirtualConsole();log.on('jsdomError',error=>{if(!error.message.includes('CSS'))errors.push(error.message)});
 let counters;
 const html=fs.readFileSync(path.join(root,route,'index.html'),'utf8').replace(/type="module"(?=[^>]*route-boot\.mjs)/g,'defer');
 const dom=new JSDOM(html,{url:new URL(route+'?motion='+motion,base).href,resources,runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:log,beforeParse(window){
  browserDefaults(window);if(instrumentCounts)counters=instrument(window);
  window.TMU_BOOT_OPTIONS={fetch,assign:url=>fallbacks.push(url),loadStylesheet:async()=>{},autoPrefetch:false,importModule:url=>window.__tmuImport(url)};
  window.document.addEventListener('route-changed',event=>{if(event.detail.from===null)window.__tmuReady=true;});
  beforeParse?.(window);
 }});
 try{await until(()=>dom.window.__tmuReady||fallbacks.length||errors.length,'Guide boot timeout');}
 catch(error){dom.window.close();throw error;}
 return {dom,w:dom.window,d:dom.window.document,errors,fallbacks,counters};
}
module.exports={moduleBundle,createGuide,until,pause,instrument,browserDefaults};
