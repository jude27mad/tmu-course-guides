import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
const require=createRequire(import.meta.url);
const {JSDOM}=require('../tools/ui-build/node_modules/jsdom');
let routerModule;
try{routerModule=await import('../assets/app/router.mjs');}catch(error){if(error.code!=='ERR_MODULE_NOT_FOUND')throw error;}
const need=()=>{assert.ok(routerModule,'The route router exists');return routerModule;};
const html=(route='desk',{modules=['first','second'],styles=['common.css'],inline='',region=true}={})=>`<!doctype html><html><head><title>${route} title</title><meta name="description" content="${route} description">${styles.map(href=>`<link rel="stylesheet" href="${href}">`).join('')}${inline?`<style>${inline}</style>`:''}${modules.map(name=>`<script type="module" data-route-module src="modules/${name}.mjs"></script>`).join('')}</head><body class="${route}-class" ${route==='desk'?'data-page="desk"':`data-course="${route}"`}><a class="skip-link" href="#${route}-main">Skip</a>${region?`<main data-route-region id="${route}-main"><h1>${route} heading</h1><a href="../mth140/">Course</a></main>`:''}${route==='desk'?'<footer data-route-content>Desk footer</footer>':''}</body></html>`;
const until=async(predicate,message,timeout=3000)=>{const start=Date.now();while(!predicate()){if(Date.now()-start>timeout)throw Error(message);await new Promise(resolve=>setTimeout(resolve,5));}};
function fixture({page,...options}={}){
 const dom=new JSDOM(page||html(),{url:'https://guide.test/tmu-course-guides/',pretendToBeVisual:true});
 const {window}=dom,events=[],calls=[],fallback=[];
 let x=0,y=0;
 Object.defineProperties(window,{scrollX:{get:()=>x},scrollY:{get:()=>y}});
 window.scrollTo=(a,b)=>{if(typeof a==='object'){x=a.left||0;y=a.top||0;}else{x=a;y=b;}calls.push(['scroll',x,y]);};
 const documents=new Map(['desk','cen100','mth140','mth141'].map(route=>[route,html(route)]));
 const imported=[];
 const importModule=async url=>{imported.push(url);const name=new URL(url).pathname.split('/').at(-1).replace('.mjs','');return {mount(ctx){calls.push(['mount',name,ctx.route,ctx.direct,ctx.signal,window.location.hash]);},unmount(){calls.push(['unmount',name]);}};};
 const fetch=async(url,init)=>{calls.push(['fetch',url,init.credentials]);const route=need().routeForURL(url,new URL('https://guide.test/tmu-course-guides/'));return {ok:true,url,text:async()=>documents.get(route)};};
 const router=need().createRouter({window,fetch,importModule,assign:url=>fallback.push(url),moduleURL:'https://guide.test/tmu-course-guides/assets/app/router.mjs',autoPrefetch:false,loadStylesheet:async link=>calls.push(['style',link.href]),...options});
 window.document.addEventListener('route-changed',event=>events.push(event.detail));
 return {dom,window,router,documents,calls,events,fallback,imported,close(){router.stop();window.close();}};
}

test('deriveBase and route roots work at origin and project bases',()=>{
 const {deriveBase,routeForURL}=need();
 for(const path of ['/', '/tmu-course-guides/']){
  const base=deriveBase(`https://guide.test${path}assets/app/router.mjs?v=1`);
  assert.equal(base.pathname,path);
  for(const [relative,route] of [['','desk'],['index.html','desk'],['cen100/','cen100'],['mth140/index.html','mth140'],['mth141','mth141']])assert.equal(routeForURL(new URL(relative,base),base),route);
  assert.equal(routeForURL(new URL('privacy.html',base),base),null);
  assert.equal(routeForURL(new URL('cen100/items/',base),base),null);
  assert.equal(routeForURL('https://other.test/cen100/',base),null);
 }
});

test('eligible links preserve native modified, external, download, targets and same-route hashes',()=>{
 const {isRouteLink}=need();const dom=new JSDOM('<a href="cen100/">CEN</a>',{url:'https://guide.test/tmu-course-guides/'});
 const a=dom.window.document.querySelector('a'),base=new URL('https://guide.test/tmu-course-guides/'),currentURL=dom.window.location.href;
 const valid=(event={button:0},attrs={})=>{a.removeAttribute('target');a.removeAttribute('download');a.removeAttribute('rel');a.href='cen100/';for(const [key,value]of Object.entries(attrs))a.setAttribute(key,value);return isRouteLink(event,a,{base,currentURL});};
 assert.equal(valid(),true);
 for(const event of [{button:1},{button:2},{button:0,ctrlKey:true},{button:0,metaKey:true},{button:0,shiftKey:true},{button:0,altKey:true},{button:0,defaultPrevented:true}])assert.equal(valid(event),false);
 for(const attrs of [{target:'_blank'},{target:'named-frame'},{download:''},{rel:'noopener EXTERNAL'},{href:'https://outside.test/cen100/'},{href:'privacy.html'},{href:'./#courses'}])assert.equal(valid({button:0},attrs),false);
 assert.equal(valid({button:0},{target:'_self'}),true);
 assert.equal(valid({button:0},{href:'index.html#courses'}),true);assert.equal(valid({button:0},{href:'./'}),true);dom.window.close();
});

test('navigation disposes in reverse order, aborts old handlers and preserves the shell',async()=>{
 const f=fixture(),old=f.window.document.querySelector('main'),controller=new f.window.AbortController();
 f.router.adoptRoute({controller,modules:[{unmount(){f.calls.push(['dispose','one']);}},{unmount(){f.calls.push(['dispose','two']);}}]});
 const marker=f.window.document.documentElement.dataset.shellId;
 f.window.document.addEventListener('route-will-change',event=>event.detail.waitUntil(Promise.resolve().then(()=>f.calls.push(['transition']))));
 await f.router.navigate('cen100/#course-info');
 assert.deepEqual(f.calls.filter(call=>call[0]==='dispose'),[['dispose','two'],['dispose','one']]);
 assert.equal(controller.signal.aborted,true);assert.equal(old.isConnected,false);assert.equal(f.router.route,'cen100');
 assert.equal(f.window.document.documentElement.dataset.shellId,marker);assert.equal(f.window.TMURouter.route,'cen100');
 assert.deepEqual(f.calls.filter(call=>call[0]==='mount').map(call=>call.slice(1,4)),[['first','cen100',false],['second','cen100',false]]);
 assert.equal(f.window.document.title,'cen100 title');assert.equal(f.window.document.body.dataset.page,undefined);assert.equal(f.window.document.body.dataset.course,'cen100');
 assert.equal(f.window.document.body.className,'cen100-class');assert.equal(f.window.document.activeElement.id,'cen100-main');
 assert.equal(f.window.document.querySelector('[data-router-announcement]').textContent,'CEN100 guide');
 assert.deepEqual(f.events,[{route:'cen100',from:'desk'}]);assert.ok(f.calls.findIndex(c=>c[0]==='transition')<f.calls.findIndex(c=>c[0]==='dispose'));
 f.close();
});

test('head sync keeps outgoing styles until incoming sheets load and follows destination CSS order',async()=>{
 let resolveStyle;const loaded=new Promise(resolve=>{resolveStyle=resolve;});
 const f=fixture({loadStylesheet:()=>loaded});
 f.window.document.head.insertAdjacentHTML('beforeend','<link rel="stylesheet" href="desk-only.css"><style>.old{color:red}</style>');
 f.documents.set('cen100',html('cen100',{styles:['common.css','cen-only.css'],inline:'.cen{color:blue}'}));
 const navigation=f.router.navigate('cen100/');
 await new Promise(resolve=>setTimeout(resolve,0));
 assert.ok(f.window.document.querySelector('link[href="desk-only.css"]'));assert.match(f.window.document.head.textContent,/\.old/);
 resolveStyle();await navigation;
 assert.equal(f.window.document.querySelector('link[href="desk-only.css"]'),null);assert.doesNotMatch(f.window.document.head.textContent,/\.old/);
 const assets=[...f.window.document.head.querySelectorAll('link[rel="stylesheet"],style')];
 assert.deepEqual(assets.map(node=>node.tagName==='STYLE'?node.textContent:new URL(node.href).pathname.split('/').at(-1)),['common.css','cen-only.css','.cen{color:blue}']);
 assert.equal(f.window.document.querySelector('meta[name="description"]').content,'cen100 description');f.close();
});

test('prefetch deduplicates requests and bounds parsed document cache',async()=>{
 const f=fixture();await Promise.all([f.router.prefetch('cen100/#a'),f.router.prefetch('cen100/#b')]);
 assert.equal(f.calls.filter(c=>c[0]==='fetch').length,1);
 for(let i=0;i<6;i++)await f.router.prefetch(`mth140/?variant=${i}`);
 await f.router.prefetch('cen100/');assert.equal(f.calls.filter(c=>c[0]==='fetch').length,8);f.close();
});

test('fetch, region, reload-required, transition and mount errors fall back to full navigation',async()=>{
 for(const cause of ['fetch','region','reload','transition','mount']){
  const f=fixture(cause==='fetch'?{fetch:async()=>{throw Error('offline');}}:cause==='reload'?{importModule:async()=>({reloadRequired:true})}:cause==='mount'?{importModule:async()=>({mount(){throw Error('mount failed');},unmount(){}})}:{});
  if(cause==='region')f.documents.set('cen100',html('cen100',{region:false}));
  if(cause==='transition')f.window.document.addEventListener('route-will-change',event=>event.detail.waitUntil(Promise.reject(Error('transition failed'))));
  await f.router.navigate('cen100/');assert.deepEqual(f.fallback,['https://guide.test/tmu-course-guides/cen100/'],cause);f.close();
 }
});

test('back and forward restore each entry scroll and destination hashes are read at mount as on a direct load',async()=>{
 const f=fixture(),hashes=[];f.router.start();f.window.addEventListener('hashchange',()=>hashes.push([f.router.route,f.window.location.hash]));
 f.window.scrollTo(0,180);await f.router.navigate('cen100/#course-info');f.window.scrollTo(0,420);await f.router.navigate('../mth140/#assessment-quiz-1');f.window.scrollTo(0,750);
 const waitChange=()=>new Promise(resolve=>f.window.document.addEventListener('route-changed',resolve,{once:true}));
 let done=waitChange();f.window.history.back();await done;assert.equal(f.router.route,'cen100');assert.equal(f.window.scrollY,420);
 done=waitChange();f.window.history.back();await done;assert.equal(f.router.route,'desk');assert.equal(f.window.scrollY,180);
 done=waitChange();f.window.history.forward();await done;assert.equal(f.router.route,'cen100');assert.equal(f.window.scrollY,420);
 // A direct load dispatches no hashchange: the destination reads #assessment-quiz-1 while mounting, and neither
 // a swap nor the browser's own hashchange for a cross-route traversal makes it handle the hash a second time.
 assert.ok(f.calls.some(c=>c[0]==='mount'&&c[2]==='mth140'&&c[5]==='#assessment-quiz-1'),'destination hash is in place at mount');
 assert.deepEqual(hashes,[],'route swaps and cross-route Back/Forward deliver no extra hashchange');
 assert.equal(f.window.history.scrollRestoration,'manual');f.close();
});

test('capture interception prevents the old departure handler before document bubbling',async()=>{
 const f=fixture();f.router.start();let observed;
 f.window.document.addEventListener('click',event=>{observed=event.defaultPrevented;});
 const a=f.window.document.createElement('a');a.href='cen100/';f.window.document.body.append(a);
 const changed=new Promise(resolve=>f.window.document.addEventListener('route-changed',resolve,{once:true}));
 a.dispatchEvent(new f.window.MouseEvent('click',{bubbles:true,cancelable:true,button:0}));await changed;assert.equal(observed,true);assert.equal(f.router.route,'cen100');f.close();
});

test('all real documents opt into ordered route boot and same-origin connect policy',async()=>{
 for(const path of ['index.html','cen100/index.html','mth140/index.html','mth141/index.html']){
  const dom=new JSDOM(await readFile(new URL('../'+path,import.meta.url),'utf8'));
  assert.equal(dom.window.document.querySelectorAll('main[data-route-region]').length,1,path);
  assert.match(dom.window.document.querySelector('meta[http-equiv="Content-Security-Policy"]').content,/connect-src 'self'/,path);
  assert.ok(dom.window.document.querySelector('script[type="module"][src*="route-boot.mjs"]'),path);
  assert.ok(dom.window.document.querySelector('script[type="module"][data-route-module]'),path);dom.window.close();
 }
});

test('direct boot waits for DOM readiness, initializes shell once and mounts route scripts in order',async()=>{
 let boot;try{boot=await import('../assets/app/route-boot.mjs');}catch(error){if(error.code!=='ERR_MODULE_NOT_FOUND')throw error;}
 assert.ok(boot,'The direct route bootstrap exists');
 const dom=new JSDOM(html('cen100'),{url:'https://guide.test/tmu-course-guides/cen100/'}),{window}=dom,calls=[];
 window.document.head.insertAdjacentHTML('beforeend','<script type="module" data-shell-module src="../assets/shell.mjs"></script>');
 Object.defineProperty(window.document,'readyState',{value:'loading',configurable:true});
 const options={window,moduleURL:'https://guide.test/tmu-course-guides/assets/app/router.mjs',autoPrefetch:false,assign:()=>{},importModule:async url=>{calls.push(['import',url]);return {mount(ctx){calls.push(['mount',ctx.route,ctx.direct,ctx.root.id]);},unmount(){}};}};
 const promise=boot.bootDocument(options);assert.equal(calls.length,0);
 window.document.dispatchEvent(new window.Event('DOMContentLoaded'));const router=await promise;
 assert.equal(calls.filter(c=>c[0]==='import').length,3);
 assert.deepEqual(calls.filter(c=>c[0]==='mount'),[['mount','cen100',true,'cen100-main'],['mount','cen100',true,'cen100-main']]);
 assert.equal(await boot.bootDocument(options),router);assert.equal(calls.filter(c=>c[0]==='import').length,3);
 router.stop();window.close();
});

test('canceling a route transition retains the outgoing module and document',async()=>{
 const f=fixture(),main=f.window.document.querySelector('main');let disposed=0;
 f.router.adoptRoute({controller:new f.window.AbortController(),modules:[{unmount(){disposed++;}}]});
 f.window.document.addEventListener('route-will-change',event=>event.preventDefault());
 assert.equal(await f.router.navigate('cen100/'),false);assert.equal(disposed,0);assert.equal(f.window.document.querySelector('main'),main);assert.deepEqual(f.fallback,[]);f.close();
});

test('a failed direct-load module is reported and skipped; the guide and the other modules stay mounted',async()=>{
 const {bootDocument}=await import('../assets/app/route-boot.mjs');
 const warnings=[],warn=console.warn;console.warn=(...args)=>warnings.push(args.map(String).join(' '));
 try{
  for(const failure of ['mount','import','contract']){
   const dom=new JSDOM(html('cen100',{modules:['first','second','third']}),{url:'https://guide.test/cen100/'}),{window}=dom,calls=[];let signal;
   const router=await bootDocument({window,moduleURL:'https://guide.test/assets/app/router.mjs',autoPrefetch:false,importModule:async url=>{
    if(url.includes('second')&&failure==='import')throw Error('broken import');
    if(url.includes('second')&&failure==='contract')return {};
    return {mount(ctx){signal=ctx.signal;calls.push(['mount',url.split('/').at(-1)]);if(url.includes('second'))throw Error('broken mount');},unmount(){calls.push(['unmount',url.split('/').at(-1)]);}};
   }});
   const expected=failure==='mount'?[['mount','first.mjs'],['mount','second.mjs'],['unmount','second.mjs'],['mount','third.mjs']]:[['mount','first.mjs'],['mount','third.mjs']];
   assert.deepEqual(calls,expected,failure);
   assert.equal(signal.aborted,false,failure+': surviving modules keep their signal');
   assert.equal(window.TMURouter.route,'cen100',failure+': the shell still starts');
   assert.ok(warnings.some(w=>w.includes('second.mjs')),failure+': the failure is reported');
   // Leaving the route unmounts only what is mounted, in reverse order.
   calls.length=0;await router.navigate('../');
   assert.deepEqual(calls.filter(c=>c[0]==='unmount').map(c=>c[1]),['third.mjs','first.mjs'],failure);
   router.stop();window.close();warnings.length=0;
  }
 }finally{console.warn=warn;}
});

test('a reload or Back/Forward document load returns to the saved position; a new load reveals a mounted fragment',async()=>{
 const {bootDocument}=await import('../assets/app/route-boot.mjs');
 const setup=(url,type,state)=>{
  const dom=new JSDOM(html('cen100'),{url,pretendToBeVisual:true}),{window}=dom;let y=0;const scrolled=[];
  Object.defineProperty(window,'scrollY',{get:()=>y});window.scrollTo=(a,b)=>{y=typeof a==='object'?a.top:b;scrolled.push(y);};
  window.HTMLElement.prototype.scrollIntoView=function(){scrolled.push(this.id);};
  Object.defineProperty(window.performance,'getEntriesByType',{value:()=>[{type}],configurable:true});
  if(state)window.history.replaceState(state,'',url);
  const importModule=async url=>({mount(ctx){if(url.includes('first'))ctx.root.insertAdjacentHTML('beforeend','<details id="tools"><summary>Tools</summary><button id="late">Late</button></details>');},unmount(){}});
  return {window,scrolled,boot:()=>bootDocument({window,moduleURL:'https://guide.test/assets/app/router.mjs',autoPrefetch:false,assign:()=>{},importModule})};
 };
 for(const type of ['reload','back_forward']){
  const t=setup('https://guide.test/cen100/#late',type,{__tmuRouter:{id:'old:1',index:0,scroll:[0,640]}});
  const router=await t.boot();
  assert.equal(t.window.scrollY,640,type);assert.equal(t.window.document.getElementById('tools').open,false,type+': saved position wins over the fragment');
  router.stop();t.window.close();
 }
 const t=setup('https://guide.test/cen100/#late','navigate',null),router=await t.boot();
 assert.equal(t.window.document.getElementById('tools').open,true,'closed details around the target open');
 assert.deepEqual(t.scrolled,['late'],'the mounted target scrolls into view');
 assert.equal(t.window.document.activeElement.id,'late','a focusable target takes focus');
 router.stop();t.window.close();
});

test('twenty route round trips leave one shell and only current signal active',async()=>{
 const f=fixture(),signals=[];const marker=f.window.document.documentElement.dataset.shellId;
 f.router.start();
 for(let i=0;i<20;i++){
  await f.router.navigate('/tmu-course-guides/cen100/');signals.push(f.calls.filter(c=>c[0]==='mount').at(-1)[4]);
  await f.router.navigate('/tmu-course-guides/mth140/');signals.push(f.calls.filter(c=>c[0]==='mount').at(-1)[4]);
 }
 assert.equal(signals.filter(signal=>!signal.aborted).length,1);assert.equal(f.window.document.documentElement.dataset.shellId,marker);
 assert.equal(f.window.document.querySelectorAll('[data-router-announcement]').length,1);assert.equal(f.window.document.querySelectorAll('main[data-route-region]').length,1);f.close();
});

test('guide-created hash history entries keep distinct scroll positions',async()=>{
 const f=fixture();f.router.start();f.window.scrollTo(0,180);
 f.window.history.pushState(null,'','#course-info');f.window.scrollTo(0,420);
 await f.router.navigate('cen100/');
 let changed=new Promise(resolve=>f.window.document.addEventListener('route-changed',resolve,{once:true}));
 f.window.history.back();await changed;assert.equal(f.router.route,'desk');assert.equal(f.window.scrollY,420);
 const hash=new Promise(resolve=>f.window.addEventListener('hashchange',resolve,{once:true}));
 f.window.history.back();await hash;await new Promise(resolve=>setTimeout(resolve,0));assert.equal(f.window.scrollY,180);f.close();
});

test('canceling Back restores the outgoing history entry without adding or replacing an entry',{timeout:10000},async()=>{
 const f=fixture();f.router.start();await f.router.navigate('cen100/');await f.router.navigate('../mth140/');
 const main=f.window.document.querySelector('main'),state=f.window.history.state,href=f.window.location.href,length=f.window.history.length;
 f.window.document.addEventListener('route-will-change',event=>event.preventDefault(),{once:true});
 const restored=new Promise(resolve=>f.window.addEventListener('popstate',()=>{if(f.window.location.href===href)resolve();}));
 f.window.history.back();await restored;
 assert.equal(f.window.history.length,length);assert.deepEqual(f.window.history.state,state);assert.equal(f.window.location.href,href);
 assert.equal(f.router.route,'mth140');assert.equal(f.window.document.body.dataset.course,'mth140');assert.equal(f.window.document.title,'mth140 title');assert.equal(f.window.document.querySelector('main'),main);
 const changed=new Promise(resolve=>f.window.document.addEventListener('route-changed',resolve,{once:true}));f.window.history.back();await changed;
 assert.equal(f.router.route,'cen100');assert.equal(f.window.location.pathname,'/tmu-course-guides/cen100/');f.close();
});

test('Back supersedes a pending push fetch so URL and mounted route finish on the traversed entry',async()=>{
 let release,fetchStarted;const gate=new Promise(resolve=>{release=resolve;}),started=new Promise(resolve=>{fetchStarted=resolve;});
 const f=fixture({fetch:async url=>{
  const route=need().routeForURL(url,new URL('https://guide.test/tmu-course-guides/'));
  if(route==='mth140'){fetchStarted();await gate;}
  return {ok:true,url,text:async()=>html(route)};
 }});
 f.router.start();await f.router.navigate('cen100/');
 const push=f.router.navigate('../mth140/');await started;
 const popped=new Promise(resolve=>f.window.addEventListener('popstate',resolve,{once:true}));
 f.window.history.back();await popped;
 const changed=new Promise(resolve=>f.window.document.addEventListener('route-changed',resolve,{once:true}));release();
 await push;await changed;
 assert.equal(f.window.location.pathname,'/tmu-course-guides/');assert.equal(f.router.route,'desk');assert.equal(f.window.document.body.dataset.page,'desk');assert.equal(f.window.document.body.dataset.course,undefined);assert.equal(f.window.document.title,'desk title');assert.deepEqual(f.fallback,[]);f.close();
});

test('same-route Back preserves focus chosen by the guide hash handler',async()=>{
 const f=fixture();f.router.start();const target=f.window.document.createElement('button');target.textContent='Course info';f.window.document.querySelector('main').append(target);
 f.window.history.pushState(null,'','#course-info');f.window.history.pushState(null,'','#study');
 f.window.addEventListener('hashchange',()=>target.focus());
 const hash=new Promise(resolve=>f.window.addEventListener('hashchange',resolve,{once:true}));f.window.history.back();await hash;
 assert.equal(f.window.document.activeElement,target);assert.equal(f.window.document.querySelector('[data-router-announcement]'),null);f.close();
});

test('canceling the latest of queued Back traversals restores the mounted entry', {timeout:10000},async()=>{
 let block=false,release,startedResolve;const gate=new Promise(resolve=>{release=resolve;}),started=new Promise(resolve=>{startedResolve=resolve;});
 const f=fixture({fetch:async url=>{
  const route=need().routeForURL(url,new URL('https://guide.test/tmu-course-guides/'));
  if(block&&route==='cen100'){startedResolve();await gate;}
  return {ok:true,url,text:async()=>html(route)};
 }});
 f.router.start();await f.router.navigate('cen100/');await f.router.navigate('../mth140/');
 for(let i=0;i<4;i++)await f.router.prefetch(`/tmu-course-guides/mth141/?variant=${i}`);
 const href=f.window.location.href,state=f.window.history.state,length=f.window.history.length,main=f.window.document.querySelector('main');
 block=true;f.window.document.addEventListener('route-will-change',event=>event.preventDefault(),{once:true});
 const restored=new Promise(resolve=>f.window.addEventListener('popstate',()=>{if(f.window.location.href===href)resolve();}));
 f.window.history.back();await started;f.window.history.back();await restored;release();
 assert.equal(f.window.history.length,length);assert.deepEqual(f.window.history.state,state);assert.equal(f.window.location.href,href);assert.equal(f.router.route,'mth140');assert.equal(f.window.document.title,'mth140 title');assert.equal(f.window.document.body.dataset.course,'mth140');assert.equal(f.window.document.querySelector('main'),main);assert.deepEqual(f.fallback,[]);f.close();
});

test('same-route aliases and course roots preserve the shell without remounting',async()=>{
 const f=fixture();f.router.start();await f.router.navigate('cen100/');const main=f.window.document.querySelector('main'),marker=f.window.document.documentElement.dataset.shellId,mountCount=f.calls.filter(c=>c[0]==='mount').length;
 const hashes=[];f.window.addEventListener('hashchange',()=>hashes.push(f.window.location.hash));
 await f.router.navigate('index.html#course-info');assert.equal(f.window.location.pathname,'/tmu-course-guides/cen100/index.html');assert.equal(f.window.location.hash,'#course-info');
 await f.router.navigate('./');assert.equal(f.window.location.pathname,'/tmu-course-guides/cen100/');assert.equal(f.window.location.hash,'');
 const length=f.window.history.length;await f.router.navigate('./');assert.equal(f.window.history.length,length);
 assert.equal(f.window.document.querySelector('main'),main);assert.equal(f.window.document.documentElement.dataset.shellId,marker);assert.equal(f.calls.filter(c=>c[0]==='mount').length,mountCount);assert.deepEqual(hashes,['#course-info','']);assert.deepEqual(f.fallback,[]);f.close();
});

test('head sync never moves a loaded sheet, keeps incoming sheets inert until commit and survives a reload followed by Back/Forward',async()=>{
 // The document was loaded at cen100/ (a reload), with an earlier same-document entry for the Desk.
 const page=route=>html(route,{styles:route==='desk'?['assets/fonts.css','assets/hub.css','assets/desk.css']:['../assets/fonts.css','../assets/hub.css','../assets/cen.css']});
 const dom=new JSDOM(page('cen100'),{url:'https://guide.test/tmu-course-guides/cen100/',pretendToBeVisual:true}),{window}=dom;
 window.history.replaceState(null,'','/tmu-course-guides/');window.history.pushState(null,'','/tmu-course-guides/cen100/');
 let release;const gate=()=>new Promise(resolve=>{release=resolve;});let loading=gate();
 const router=need().createRouter({window,moduleURL:'https://guide.test/tmu-course-guides/assets/app/router.mjs',autoPrefetch:false,assign:url=>{throw Error('unexpected reload '+url);},
  importModule:async()=>({mount(){},unmount(){}}),loadStylesheet:()=>loading,
  fetch:async url=>({ok:true,url,text:async()=>page(need().routeForURL(url,new URL('https://guide.test/tmu-course-guides/')))})});
 router.start();
 const head=window.document.head,[fonts,hub]=head.querySelectorAll('link'),moved=[];
 new window.MutationObserver(records=>{for(const r of records)for(const node of [...r.removedNodes,...r.addedNodes])if(node===fonts||node===hub)moved.push(node);}).observe(head,{childList:true});
 const resolved=()=>[...head.querySelectorAll('link[rel="stylesheet"]')].map(link=>new URL(link.getAttribute('href'),link===fonts||link===hub?'https://guide.test/tmu-course-guides/cen100/':window.location.href).pathname);
 let changed=new Promise(resolve=>window.document.addEventListener('route-changed',resolve,{once:true}));
 window.history.back();await until(()=>head.querySelector('link[href$="desk.css"]'),'incoming sheet was not prepared');
 const incoming=head.querySelector('link[href$="desk.css"]');
 assert.equal(incoming.getAttribute('media'),'not all','incoming sheet loads without restyling the outgoing route');
 assert.equal(incoming.getAttribute('href'),'https://guide.test/tmu-course-guides/assets/desk.css','incoming href is absolute');
 assert.ok(head.querySelector('link[href="../assets/cen.css"]'),'outgoing sheet stays until incoming sheets load');
 release();await changed;
 assert.equal(router.route,'desk');assert.equal(incoming.hasAttribute('media'),false,'incoming sheet applies at commit');
 assert.deepEqual(resolved(),['/tmu-course-guides/assets/fonts.css','/tmu-course-guides/assets/hub.css','/tmu-course-guides/assets/desk.css']);
 loading=gate();changed=new Promise(resolve=>window.document.addEventListener('route-changed',resolve,{once:true}));
 window.history.forward();await until(()=>head.querySelector('link[href$="cen.css"]'),'incoming sheet was not prepared');release();await changed;
 assert.equal(router.route,'cen100');
 assert.deepEqual(resolved(),['/tmu-course-guides/assets/fonts.css','/tmu-course-guides/assets/hub.css','/tmu-course-guides/assets/cen.css']);
 assert.equal(fonts.isConnected&&hub.isConnected,true);assert.deepEqual(moved,[],'shared sheets were never removed or re-inserted');
 router.stop();window.close();
});

test('scrolling keeps positions in memory and writes history only after scrolling settles or when the page is hidden',async()=>{
 const dom=new JSDOM(html(),{url:'https://guide.test/tmu-course-guides/',pretendToBeVisual:true}),{window}=dom;let y=0,writes=0;
 Object.defineProperty(window,'scrollY',{get:()=>y});window.scrollTo=(a,b)=>{y=b;};
 const replace=window.history.replaceState;window.history.replaceState=function(...args){writes++;return replace.apply(this,args);};
 const router=need().createRouter({window,moduleURL:'https://guide.test/tmu-course-guides/assets/app/router.mjs',autoPrefetch:false,assign:()=>{},fetch:async()=>{throw Error('offline');}});
 router.start();writes=0;
 for(let i=1;i<=300;i++){y=i*10;window.dispatchEvent(new window.Event('scroll'));}
 assert.equal(writes,0,'no history write per scroll event');
 await new Promise(resolve=>setTimeout(resolve,500));
 assert.equal(writes,1,'one write once scrolling settles');assert.deepEqual(window.history.state.__tmuRouter.scroll,[0,3000]);
 y=1234;window.dispatchEvent(new window.Event('scroll'));window.dispatchEvent(new window.Event('pagehide'));
 assert.equal(writes,2);assert.deepEqual(window.history.state.__tmuRouter.scroll,[0,1234],'pagehide stores the position for a reload or a later Back');
 await new Promise(resolve=>setTimeout(resolve,500));assert.equal(writes,2,'the pending timer was replaced, not repeated');
 router.stop();window.close();
});

test('Back/Forward restore waits for the destination layout to grow instead of clamping',async()=>{
 const f=fixture();let max=10000;
 f.window.scrollTo=(a,b)=>{f.calls.push(['scroll',0,b]);setY(Math.min(b,max));};
 let y=0;const setY=v=>{y=v;};Object.defineProperty(f.window,'scrollY',{get:()=>y,configurable:true});
 f.router.start();await f.router.navigate('cen100/');setY(900);f.window.dispatchEvent(new f.window.Event('scroll'));
 await f.router.navigate('../mth140/');
 max=300;const changed=new Promise(resolve=>f.window.document.addEventListener('route-changed',resolve,{once:true}));
 f.window.history.back();await changed;assert.equal(f.window.scrollY,300,'first attempt is clamped by the short layout');
 f.window.dispatchEvent(new f.window.Event('scroll'));
 max=10000;await new Promise(resolve=>setTimeout(resolve,100));
 assert.equal(f.window.scrollY,900,'the saved position is re-applied once the layout fits');f.close();
});

test('same-route Back reaches the guide once; a cross-route Back leaves the outgoing guide alone',async()=>{
 const f=fixture();f.router.start();const seen=[];
 f.window.addEventListener('popstate',()=>seen.push(['popstate',f.window.TMURouter.routeFor(f.window.location.href),f.window.location.hash]));
 f.window.addEventListener('hashchange',()=>seen.push(['hashchange',f.router.route,f.window.location.hash]));
 await f.router.navigate('cen100/');
 f.window.history.pushState(null,'','#course-info');f.window.history.pushState(null,'','#assignments');
 f.window.history.back();await until(()=>seen.length>=2,'Back did not reach the guide');await new Promise(resolve=>setTimeout(resolve,50));
 assert.deepEqual(seen,[['popstate','cen100','#course-info'],['hashchange','cen100','#course-info']],'one popstate and one hashchange');
 seen.length=0;await f.router.navigate('../mth140/#study');
 const changed=new Promise(resolve=>f.window.document.addEventListener('route-changed',resolve,{once:true}));
 f.window.history.back();await changed;
 assert.deepEqual(seen,[['popstate','cen100','#course-info']],'popstate still bubbles, routeFor names the destination, and no hashchange follows the swap');
 assert.equal(f.window.TMURouter.routeFor('https://guide.test/tmu-course-guides/mth141/'),'mth141');f.close();
});

test('the public navigate() only moves between the four routes',async()=>{
 const f=fixture();
 for(const url of ['https://example.com/','javascript:alert(1)','data:text/html,x','../privacy.html','https://guide.test/tmu-course-guides/cen100/items/'])assert.equal(await f.router.navigate(url),false,url);
 assert.deepEqual(f.fallback,[]);assert.equal(f.calls.filter(c=>c[0]==='fetch').length,0);f.close();
});

test('a destination from another deploy (different shell modules) gets a real document load',async()=>{
 const shell=(route,version)=>html(route).replace('</head>',`<script type="module" data-shell-module src="${route==='desk'?'':'../'}assets/core.mjs?v=${version}"></script></head>`);
 const f=fixture({page:shell('desk',1)});f.documents.set('cen100',shell('cen100',2));
 assert.equal(await f.router.navigate('cen100/'),false);assert.deepEqual(f.fallback,['https://guide.test/tmu-course-guides/cen100/']);f.close();
 const g=fixture({page:shell('desk',1)});g.documents.set('cen100',shell('cen100',1));
 assert.equal(await g.router.navigate('cen100/'),true,'the same shell swaps in place');g.close();
});
