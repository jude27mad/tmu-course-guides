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
function fixture(options={}){
 const dom=new JSDOM(html(),{url:'https://guide.test/tmu-course-guides/',pretendToBeVisual:true});
 const {window}=dom,events=[],calls=[],fallback=[];
 let x=0,y=0;
 Object.defineProperties(window,{scrollX:{get:()=>x},scrollY:{get:()=>y}});
 window.scrollTo=(a,b)=>{if(typeof a==='object'){x=a.left||0;y=a.top||0;}else{x=a;y=b;}calls.push(['scroll',x,y]);};
 const documents=new Map(['desk','cen100','mth140','mth141'].map(route=>[route,html(route)]));
 const imported=[];
 const importModule=async url=>{imported.push(url);const name=new URL(url).pathname.split('/').at(-1).replace('.mjs','');return {mount(ctx){calls.push(['mount',name,ctx.route,ctx.direct,ctx.signal]);},unmount(){calls.push(['unmount',name]);}};};
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

test('back and forward restore each entry scroll and destination hashes fire after mounts',async()=>{
 const f=fixture(),hashes=[];f.router.start();f.window.addEventListener('hashchange',()=>hashes.push([f.router.route,f.window.location.hash]));
 f.window.scrollTo(0,180);await f.router.navigate('cen100/#course-info');f.window.scrollTo(0,420);await f.router.navigate('../mth140/#assessment-quiz-1');f.window.scrollTo(0,750);
 const waitChange=()=>new Promise(resolve=>f.window.document.addEventListener('route-changed',resolve,{once:true}));
 let done=waitChange();f.window.history.back();await done;assert.equal(f.router.route,'cen100');assert.equal(f.window.scrollY,420);
 done=waitChange();f.window.history.back();await done;assert.equal(f.router.route,'desk');assert.equal(f.window.scrollY,180);
 done=waitChange();f.window.history.forward();await done;assert.equal(f.router.route,'cen100');assert.equal(f.window.scrollY,420);
 assert.ok(hashes.some(([route,hash])=>route==='mth140'&&hash==='#assessment-quiz-1'));assert.equal(f.window.history.scrollRestoration,'manual');f.close();
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

test('a failed direct mount releases already mounted modules and their signal',async()=>{
 const {bootDocument}=await import('../assets/app/route-boot.mjs');
 const dom=new JSDOM(html(),{url:'https://guide.test/'}),{window}=dom,calls=[];let signal;
 await assert.rejects(bootDocument({window,moduleURL:'https://guide.test/assets/app/router.mjs',autoPrefetch:false,importModule:async url=>({mount(ctx){signal=ctx.signal;calls.push(['mount',url]);if(url.includes('second'))throw Error('broken');},unmount(){calls.push(['unmount',url]);}})}),/broken/);
 assert.deepEqual(calls.filter(c=>c[0]==='unmount').map(c=>c[1].split('/').at(-1)),['second.mjs','first.mjs']);
 assert.equal(signal.aborted,true);assert.equal(window.TMURouter,undefined);window.close();
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
