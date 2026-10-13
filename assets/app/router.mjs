/* Native document routes inside one persistent shell. The documents remain the
   source of route markup, styles and ordered lifecycle modules. */
import {getTransitionController,transitionOrigin} from './transition.mjs';
const ROUTES=['desk','cen100','mth140','mth141'];
const STATE_KEY='__tmuRouter';
const CANCELED=Symbol('canceled navigation');
const nativeImport=url=>import(url);
export const deriveBase=(moduleURL=import.meta.url)=>new URL('../../',moduleURL);
export const routeFromDocument=doc=>doc.body.dataset.page==='desk'?'desk':doc.body.dataset.course;

export function routeForURL(input,base=deriveBase()){
 const url=new URL(input,base);
 if(url.origin!==base.origin)return null;
 for(const route of ROUTES){
  const root=new URL(route==='desk'?'':route+'/',base).pathname;
  if(url.pathname===root||url.pathname===root+'index.html'||(route!=='desk'&&url.pathname===root.slice(0,-1)))return route;
 }
 return null;
}

export function isRouteLink(event,anchor,{base=deriveBase(),currentURL=globalThis.location?.href}={}){
 if(!anchor?.hasAttribute('href')||event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return false;
 if(anchor.hasAttribute('download')||anchor.rel?.split(/\s+/).some(token=>token.toLowerCase()==='external'))return false;
 const target=anchor.getAttribute('target');if(target&&target.toLowerCase()!=='_self')return false;
 const destination=new URL(anchor.getAttribute('href'),currentURL),current=new URL(currentURL);
 const route=routeForURL(destination,base);
 return !!route&&!(route===routeForURL(current,base)&&destination.pathname===current.pathname&&destination.search===current.search&&destination.hash);
}

export async function loadRouteModules({document,url=document.URL,importModule=nativeImport}){
 const modules=[];
 for(const script of document.querySelectorAll('script[type="module"][data-route-module][src]')){
  const module=await importModule(new URL(script.getAttribute('src'),url).href);
  if(module.reloadRequired===true)throw Error('Route requires a document load');
  if(typeof module.mount!=='function'||typeof module.unmount!=='function')throw Error('Route module lacks mount/unmount');
  modules.push(module);
 }
 return modules;
}

export async function mountRouteModules({document,root=document.querySelector('[data-route-region]'),route=routeFromDocument(document),signal,direct=false,url=document.URL,importModule=nativeImport,modules,transition={continuing:false}}){
 if(!root||!ROUTES.includes(route))throw Error('Missing route region or identity');
 modules??=await loadRouteModules({document,url,importModule});
 const attempted=[];
 try{
  for(const module of modules){attempted.push(module);await module.mount({root,route,signal,direct,transition:direct?{continuing:false}:transition});}
  return modules;
 }catch(error){
  for(const module of attempted.reverse())try{await module.unmount();}catch{}
  throw error;
 }
}

// Fragment navigation as the browser does it after parsing: open closed <details> ancestors (their
// observers run first), then scroll, and focus a focusable target. Content mounted after the browser's own
// fragment scroll (direct loads) and swapped routes both use this.
export async function revealFragment(document,hash,{focus=false}={}){
 let target;try{const id=decodeURIComponent(String(hash||'').slice(1));target=id&&(document.getElementById(id)||document.getElementsByName(id)[0]);}catch{}
 if(!target||document.querySelector('dialog[open]'))return false;
 let opened=false;
 for(let details=target.parentElement?.closest('details:not([open])');details;details=details.parentElement?.closest('details:not([open])')){details.open=true;opened=true;}
 if(opened)await Promise.resolve();
 if(target.closest('[hidden]'))return false;
 target.scrollIntoView?.();
 // Late layout above the target (header art, docking, fonts) must not carry it away: keep it where the
 // browser put it for about a second, unless the reader scrolls first.
 const window=document.defaultView;
 if(window?.requestAnimationFrame&&target.getBoundingClientRect){
  const inputs=['wheel','touchstart','keydown','pointerdown'],started=Date.now();let top=target.getBoundingClientRect().top,frame=0;
  const stop=()=>{window.cancelAnimationFrame(frame);for(const type of inputs)window.removeEventListener(type,stop,true);};
  const step=()=>{if(!target.isConnected||target.closest('[hidden]')||Date.now()-started>1000){stop();return;}const now=target.getBoundingClientRect().top;if(Math.abs(now-top)>2){target.scrollIntoView();top=target.getBoundingClientRect().top;}frame=window.requestAnimationFrame(step);};
  for(const type of inputs)window.addEventListener(type,stop,{capture:true,passive:true});frame=window.requestAnimationFrame(step);
 }
 if(focus&&target.matches('a[href],area[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),summary,[tabindex],[contenteditable]:not([contenteditable="false"])'))target.focus({preventScroll:true});
 return true;
}
// Shell modules load once per document. A route document that names different shell URLs belongs to
// another deploy, so it gets a real document load instead of new route modules on an old shell.
const SHELL_SCRIPTS='script[data-shell-module][src],script[src*="app/route-boot.mjs"]';
export const shellSignature=(doc,url)=>[...doc.querySelectorAll(SHELL_SCRIPTS)].map(script=>new URL(script.getAttribute('src'),url).href).sort().join('\n');

function stylesheetReady(link,window){
 return new Promise((resolve,reject)=>{
  const timer=window.setTimeout(()=>finish(Error('Stylesheet timed out')),10000);
  const finish=error=>{window.clearTimeout(timer);link.onload=link.onerror=null;error?reject(error):resolve(link);};
  link.onload=()=>finish();link.onerror=()=>finish(Error('Stylesheet unavailable'));
 });
}
function absoluteAttributes(node,url){
 for(const el of [node,...node.querySelectorAll('[src],[href],[poster],[action]')]){
  for(const attr of ['src','href','poster','action'])if(el.hasAttribute(attr))el.setAttribute(attr,new URL(el.getAttribute(attr),url).href);
 }
 return node;
}

export function createRouter({window=globalThis.window,moduleURL=import.meta.url,fetch=window.fetch?.bind(window),importModule=nativeImport,assign=url=>window.location.assign(url),loadStylesheet,autoPrefetch=true}={}){
 const {document,history}=window,base=deriveBase(moduleURL),cache=new Map(),positions=new Map();
 const originalPush=history.pushState,originalReplace=history.replaceState;
 const pushState=(...args)=>originalPush.apply(history,args),replaceState=(...args)=>originalReplace.apply(history,args);
 let route=routeFromDocument(document),modules=[],controller=new window.AbortController(),started=false,entryCounter=0,activeEntry,currentURL=window.location.href,queue=Promise.resolve(),idle=null,swapping=false,dispatchingHash=false;
 let activeIndex=0,browserEntry,latestRequest,restoring=null,pendingPops=0,persistTimer=null,lastPersist=0,settle=null,popHash=null,suppressHash=null;
 // Relative head URLs in the original markup resolve against the URL this document was loaded from,
 // not against later history entries.
 const documentURL=window.location.href,shell=shellSignature(document,documentURL),authoredMedia=new WeakMap();
 const listenerController=new window.AbortController(),transitions=getTransitionController(window);
 if(!document.documentElement.dataset.shellId)document.documentElement.dataset.shellId=window.crypto?.randomUUID?.()||`shell-${Date.now()}-${Math.random().toString(36).slice(2)}`;
 const oldRestoration=history.scrollRestoration;history.scrollRestoration='manual';
 const marker=()=>`${document.documentElement.dataset.shellId}:${++entryCounter}`;
 const scroll=()=>[window.scrollX||0,window.scrollY||0];
 function ensureEntry(state=history.state){
  if(!state?.[STATE_KEY]?.id){
   state={...(state&&typeof state==='object'?state:{}),[STATE_KEY]:{id:marker(),index:activeIndex,scroll:scroll()}};
   replaceState(state,'',window.location.href);
  }
  return state[STATE_KEY];
 }
 browserEntry=ensureEntry();activeEntry=browserEntry.id;activeIndex=browserEntry.index||0;
 // A reload or a Back/Forward document load lands on an entry that already carries its saved position.
 const initialScroll=Array.isArray(browserEntry.scroll)?browserEntry.scroll:null;
 positions.set(activeEntry,scroll());
 // Scrolling only updates memory. History is written before navigations, at most once a second while
 // scrolling (a reload keeps that), and when the page is hidden: browsers throttle (Chromium, 200 per 10 s) or
 // reject (WebKit, 100 per 30 s) frequent pushState/replaceState calls, which would strand later navigations.
 function persistScroll(){
  window.clearTimeout(persistTimer);persistTimer=null;lastPersist=Date.now();
  const position=positions.get(activeEntry)||scroll();
  if(history.state?.[STATE_KEY]?.id===activeEntry)replaceState({...history.state,[STATE_KEY]:{id:activeEntry,index:activeIndex,scroll:position}},'',window.location.href);
 }
 function saveScroll(replace=true){
  if(!settle)positions.set(activeEntry,scroll());
  if(replace)persistScroll();
 }
 // Layout keeps growing after a mount (fonts, async renders). Re-apply a saved position until it fits, the
 // reader takes over, or about a second passes; the restore itself never overwrites the saved position.
 function applyScroll(position){
  settle?.();if(!position)return;
  const [x,y]=position,reached=()=>Math.abs((window.scrollX||0)-x)<2&&Math.abs((window.scrollY||0)-y)<2;
  window.scrollTo(x,y);if(reached()||!window.requestAnimationFrame)return;
  const inputs=['wheel','touchstart','keydown','pointerdown'],started=Date.now();let frame=0;
  const stop=()=>{if(settle!==stop)return;settle=null;window.cancelAnimationFrame(frame);for(const type of inputs)window.removeEventListener(type,stop,true);};
  const step=()=>{window.scrollTo(x,y);if(reached()||Date.now()-started>1200)stop();else frame=window.requestAnimationFrame(step);};
  settle=stop;for(const type of inputs)window.addEventListener(type,stop,{capture:true,passive:true});
  frame=window.requestAnimationFrame(step);
 }
 const sameOrigin=url=>url.origin===base.origin&&/^https?:$/.test(url.protocol);
 const fallback=url=>{if(sameOrigin(url))assign(url.href);return false;};
 const canonical=input=>{const url=new URL(input,window.location.href),name=routeForURL(url,base);if(!name)return null;const result=new URL(name==='desk'?'':name+'/',base);result.search=url.search;return result;};
 async function prefetch(input){
  const url=canonical(input);if(!url)return null;
  const key=url.href;
  if(cache.has(key)){const value=cache.get(key);cache.delete(key);cache.set(key,value);return value;}
  const request=Promise.resolve().then(async()=>{
   const control=new window.AbortController();let timer;
   // Bound the whole document read, including a response whose body stalls. Race as well as
   // abort: a service worker or fetch adapter may ignore the signal and finish much later.
   const timeout=new Promise((resolve,reject)=>{timer=window.setTimeout(()=>{control.abort();reject(Error('Document fetch timed out'));},10000);});
   try{
    const loaded=(async()=>{
     if(!fetch)throw Error('Document fetch unavailable');
     const response=await fetch(key,{credentials:'same-origin',signal:control.signal});if(!response.ok)throw Error('Document fetch failed');
     const responseURL=response.url||key;
     if(routeForURL(responseURL,base)!==routeForURL(key,base))throw Error('Unexpected document redirect');
     const parsed=new window.DOMParser().parseFromString(await response.text(),'text/html');
     if(!parsed.querySelector('main[data-route-region]')||routeFromDocument(parsed)!==routeForURL(key,base))throw Error('Destination lacks its route region');
     if(shellSignature(parsed,responseURL)!==shell)throw Error('Destination expects a different shell');
     return {document:parsed,url:responseURL};
    })();
    return await Promise.race([loaded,timeout]);
   }finally{window.clearTimeout(timer);}
  });
  cache.set(key,request);while(cache.size>4)cache.delete(cache.keys().next().value);
  request.catch(()=>{if(cache.get(key)===request)cache.delete(key);});
  return request;
 }
 // Loaded sheets are never moved or re-inserted: a moved <link> reloads (unstyled frames) and re-resolves a
 // relative href against the current history URL. Incoming sheets load inert at their final position and
 // apply at commit. Keep outgoing links inert there, so warmed routes also work offline.
 async function prepareHead(incoming,url,request){
  const selector='link[rel~="stylesheet"],style',existing=[...document.head.querySelectorAll(selector)].filter(el=>!el.hasAttribute('data-shell-style'));
  const media=el=>authoredMedia.has(el)?authoredMedia.get(el):el.getAttribute('media')||'';
  const key=(el,baseURL)=>el.tagName==='STYLE'?`style:${media(el)}:${el.textContent}`:`link:${new URL(el.getAttribute('href'),baseURL).href}:${media(el)}`;
  const byKey=new Map(),desired=[],pending=[];
  for(const node of existing){const id=key(node,documentURL);if(!byKey.has(id))byKey.set(id,[]);byKey.get(id).push(node);authoredMedia.set(node,media(node));}
  const setMedia=(node,value)=>{if(node.sheet)node.sheet.media.mediaText=value;else if(value)node.setAttribute('media',value);else node.removeAttribute('media');};
  let previous=null;
  for(const source of incoming.head.querySelectorAll(selector)){
   if(source.hasAttribute('data-shell-style'))continue;
   // A kept node must already follow the previous desired node; otherwise load a fresh copy in order.
   let node=byKey.get(key(source,url))?.find(node=>!desired.includes(node)&&(!previous||previous.compareDocumentPosition(node)&4));
   if(!node){
    node=document.importNode(source,true);
    if(node.tagName==='LINK')node.setAttribute('href',new URL(source.getAttribute('href'),url).href);
    authoredMedia.set(node,source.getAttribute('media')||'');node.setAttribute('media','not all');
    // Register load/error before insertion; a cached sheet can finish immediately.
    const ready=node.tagName!=='LINK'?null:loadStylesheet?Promise.resolve().then(()=>loadStylesheet(node)):stylesheetReady(node,window);
    if(previous)previous.after(node);else if(existing[0])existing[0].before(node);else document.head.append(node);
    request.headAdditions.push(node);if(ready)pending.push(ready);
   }
   desired.push(node);previous=node;
  }
  await Promise.all(pending);
  return ()=>{
   const desiredKeys=new Set(desired.map(node=>key(node,documentURL)));
   for(const node of existing)if(!desired.includes(node)){
    // Retire an old copy when authored ordering required a new one. The cache stays bounded
    // by the route asset union instead of accumulating a duplicate on every round trip.
    if(node.tagName==='LINK'&&!desiredKeys.has(key(node,documentURL)))setMedia(node,'not all');else node.remove();
   }
   // Activate through the CSSOM: changing the media attribute makes Chromium re-process the link and drop
   // the sheet for a frame. The attribute keeps saying "not all"; the authored media is remembered.
   for(const node of desired)setMedia(node,authoredMedia.get(node));
   document.title=incoming.title;
   const description=incoming.querySelector('meta[name="description"]'),old=document.querySelector('meta[name="description"]');
   if(description){const target=old||document.head.appendChild(document.createElement('meta'));target.name='description';target.content=description.content;}else old?.remove();
   for(const script of document.querySelectorAll('script[data-route-module]'))script.remove();
   for(const script of incoming.querySelectorAll('script[type="module"][data-route-module][src]')){
    const node=document.importNode(script,true);node.src=new URL(script.getAttribute('src'),url).href;document.head.append(node);
   }
  };
 }
 function syncOutsideRegion(incoming,url){
  for(const node of document.body.querySelectorAll(':scope > .skip-link,:scope > [data-route-content]'))node.remove();
  const nodes=[...incoming.body.children].filter(node=>node.matches('.skip-link,[data-route-content]'));
  for(const source of nodes){const node=absoluteAttributes(document.importNode(source,true),url);if(source.matches('.skip-link'))document.body.prepend(node);else document.body.append(node);}
 }
 async function disposeRoute(){
  let error;
  for(const module of [...modules].reverse())try{await module.unmount();}catch(cause){error??=cause;}
  controller.abort();modules=[];
  if(error)throw error;
 }
 function announce(){
  let live=document.querySelector('[data-router-announcement]');
  if(!live){live=document.createElement('div');live.dataset.routerAnnouncement='';live.setAttribute('aria-live','polite');live.setAttribute('aria-atomic','true');live.style.cssText='position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0';document.body.append(live);}
  live.textContent=route==='desk'?'TMU Course Guides':`${route.toUpperCase()} guide`;
 }
 function restoreAndFocus(position){
  const root=document.querySelector('main[data-route-region]'),skip=document.querySelector('body > .skip-link');
  let target;
  try{const id=skip&&new URL(skip.href).hash.slice(1);target=id&&document.getElementById(decodeURIComponent(id));}catch{}
  target=target&&root.contains(target)?target:root.querySelector('h1')||root;
  if(!target.hasAttribute('tabindex'))target.setAttribute('tabindex','-1');
  target.focus({preventScroll:true});
  announce();
  if(position)applyScroll(position);
 }
 function hashChanged(oldURL,url){
  if(!url.hash&&!new URL(oldURL).hash)return;
  dispatchingHash=true;
  try{window.dispatchEvent(new window.HashChangeEvent('hashchange',{oldURL,newURL:url.href}));}finally{dispatchingHash=false;}
 }
 async function awaitCurrent(promise,request){
  const result=await Promise.race([promise,request.canceled]);
  if(result===CANCELED||request!==latestRequest)throw CANCELED;
  return result;
 }
 async function restoreCanceledPop(){
  const delta=activeIndex-browserEntry?.index;
  if(!Number.isFinite(delta)||!delta){if(window.location.href!==currentURL)assign(currentURL);return;}
  await new Promise(resolve=>{restoring={id:activeEntry,index:activeIndex,resolve};history.go(delta);});
 }
 async function performNavigation(url,{history:mode='push',state,request,nativeHash=true,origin}={}){
  if(request!==latestRequest)return false;
  const nextRoute=routeForURL(url,base);if(!nextRoute)return fallback(url);
  const oldURL=currentURL,oldRoute=route;
  // Existing view/item hash routers retain ownership within a mounted route.
  if(nextRoute===route&&new URL(currentURL).search===url.search){
   if(mode==='pop'){
    saveScroll(false);const entry=ensureEntry(state);activeEntry=entry.id;activeIndex=entry.index??activeIndex;browserEntry=entry;currentURL=url.href;
    // The browser fires its own hashchange for this traversal unless it was held back for a route swap.
    if(!nativeHash)hashChanged(oldURL,url);
    // Same layout, so one restore; a guide's own hash scroll may follow it.
    settle?.();const position=positions.get(entry.id)||entry.scroll;if(position)window.scrollTo(position[0],position[1]);
   }else if(url.href!==window.location.href){
    saveScroll();const entry={id:marker(),index:activeIndex+1,scroll:scroll()};
    pushState({[STATE_KEY]:entry},'',url.href);
    activeEntry=entry.id;activeIndex=entry.index;browserEntry=entry;currentURL=url.href;positions.set(activeEntry,entry.scroll);
    hashChanged(oldURL,url);
   }
   return true;
  }
  swapping=true;
  try{
   saveScroll(mode!=='pop');
   const waits=[];
   const event=new window.CustomEvent('route-will-change',{cancelable:true,detail:{route:nextRoute,from:route,url:url.href,fromURL:oldURL,history:mode,origin:transitionOrigin(window,origin),signal:request.controller.signal,waitUntil(promise){waits.push(Promise.resolve(promise));}}});
   if(!document.dispatchEvent(event)){
    request.cancel();Promise.all(waits).catch(()=>{});
    if(mode==='pop')await restoreCanceledPop();
    return false;
   }
   // Scene work and destination preparation overlap. Only the scene's wait is
   // capped by the transition controller; existing navigation guards keep their contract.
   const preparing=(async()=>{
    const destination=await awaitCurrent(prefetch(url),request),incoming=destination.document;
    const nextModules=await awaitCurrent(loadRouteModules({document:incoming,url:destination.url,importModule}),request);
    if(modules.some(module=>module.reloadRequired===true))throw Error('Outgoing route requires reload');
    const commitHead=await awaitCurrent(prepareHead(incoming,destination.url,request),request);
    return {destination,incoming,nextModules,commitHead};
   })();
   const [{destination,incoming,nextModules,commitHead}]=await awaitCurrent(Promise.all([preparing,Promise.all(waits)]),request);
   request.phase='commit';
   await disposeRoute();
   if(request!==latestRequest){for(const node of request.headAdditions)node.remove();return fallback(new URL(window.location.href));}
   const oldRoot=document.querySelector('main[data-route-region]');if(!oldRoot)throw Error('Outgoing route region missing');
   const newRoot=absoluteAttributes(document.importNode(incoming.querySelector('main[data-route-region]'),true),destination.url);
   settle?.();oldRoot.replaceWith(newRoot);commitHead();request.headAdditions=[];syncOutsideRegion(incoming,destination.url);
   document.body.className=incoming.body.className;
   for(const key of ['course','page'])if(incoming.body.dataset[key])document.body.dataset[key]=incoming.body.dataset[key];else delete document.body.dataset[key];
   let entry;
   if(mode==='pop')entry=ensureEntry(state);
   else{entry={id:marker(),index:activeIndex+1,scroll:[0,0]};pushState({[STATE_KEY]:entry},'',url.href);}
   activeEntry=entry.id;activeIndex=entry.index??activeIndex;browserEntry=entry;currentURL=url.href;route=nextRoute;
   controller=new window.AbortController();
   // A new page starts at the top, as on a direct load; Back/Forward restore after mounting.
   if(mode!=='pop')window.scrollTo(0,0);
   // Keep partial mounts disposable if a later module fails. Modules read the destination hash at mount,
   // as on a direct load, so no hashchange follows a route swap.
   const transition=transitions.consumeArrival({url:url.href,signal:request.controller.signal});
   for(const module of nextModules){modules.push(module);await module.mount({root:newRoot,route,signal:controller.signal,direct:false,transition});}
   restoreAndFocus(mode==='pop'?(positions.get(entry.id)||entry.scroll):null);
   document.dispatchEvent(new window.CustomEvent('route-changed',{detail:{route,from:oldRoute,transition}}));
   // As on a direct load: the page started at the top before mounting, a module may have scrolled to its
   // own item, and a fragment the modules rendered is revealed last.
   if(mode!=='pop'&&url.hash)await revealFragment(document,url.hash).catch(()=>false);
   return true;
  }catch(error){
   request.cancel();
   for(const node of request.headAdditions)node.remove();
   if(error===CANCELED)return false;
   // A full document navigation is the recovery boundary for partial DOM/module work.
   try{await disposeRoute();}catch{}
   return fallback(url);
  }finally{swapping=false;}
 }
 function navigate(input,options={}){
  let url;try{url=new URL(input,window.location.href);}catch{return Promise.resolve(false);}
  // The public API only moves between the four routes; any other URL is left to the caller.
  if(options.history!=='pop'&&!routeForURL(url,base))return Promise.resolve(false);
  if(latestRequest?.phase==='prepare')latestRequest.cancel();else latestRequest?.controller.abort();
  const navigationController=new window.AbortController();
  let cancel;const canceled=new Promise(resolve=>{cancel=()=>{navigationController.abort();resolve(CANCELED);};});
  const request={canceled,cancel,controller:navigationController,phase:'prepare',headAdditions:[]};latestRequest=request;
  const result=queue.then(()=>performNavigation(url,{...options,request}));queue=result.catch(()=>{});return result;
 }
 const linkFromEvent=event=>event.target?.closest?.('a[href]');
 // Existing guides create view/item entries with null state. Give those entries
 // the same scroll bookkeeping as cross-course entries without changing their URLs.
 const guidePush=function(state,title,url){
  saveScroll();
  const entry={id:marker(),index:activeIndex+1,scroll:scroll()};
  pushState({...state,[STATE_KEY]:entry},title,url);
  activeEntry=entry.id;activeIndex=entry.index;browserEntry=entry;positions.set(activeEntry,entry.scroll);currentURL=window.location.href;
 };
 const guideReplace=function(state,title,url){
  window.clearTimeout(persistTimer);persistTimer=null;lastPersist=Date.now();
  const entry={id:activeEntry,index:activeIndex,scroll:scroll()};
  replaceState({...state,[STATE_KEY]:entry},title,url);
  positions.set(activeEntry,entry.scroll);currentURL=window.location.href;
 };
 function start(){
  if(started)return;started=true;
  history.pushState=guidePush;history.replaceState=guideReplace;
  const signal=listenerController.signal;
  window.addEventListener('click',event=>{const a=linkFromEvent(event);if(isRouteLink(event,a,{base,currentURL:window.location.href})){event.preventDefault();navigate(a.href,{origin:transitionOrigin(window,event.detail>0?a:null)});}}, {capture:true,signal});
  const warm=event=>{const a=linkFromEvent(event);if(isRouteLink({button:0},a,{base,currentURL:window.location.href}))prefetch(a.href).catch(()=>{});};
  window.addEventListener('pointerenter',warm,{capture:true,signal});window.addEventListener('focus',warm,{capture:true,signal});
  window.addEventListener('popstate',event=>{
   browserEntry=event.state?.[STATE_KEY];
   if(restoring){
    if(browserEntry?.id===restoring.id){const done=restoring.resolve;restoring=null;done();}
    else{event.stopImmediatePropagation();const delta=restoring.index-browserEntry?.index;if(Number.isFinite(delta)&&delta)history.go(delta);else assign(currentURL);}
    return;
   }
   const href=window.location.href,next=new URL(href),hashMoves=next.hash!==new URL(currentURL).hash;
   const sameRoute=!pendingPops&&!swapping&&routeForURL(next,base)===route&&next.search===new URL(currentURL).search;
   saveScroll(false);popHash=suppressHash=null;pendingPops++;
   if(sameRoute){
    // The mounted guide owns this traversal: its popstate and the browser's hashchange reach it once.
    if(hashMoves)popHash=href;
   }else{
    // The incoming route reads the destination hash at mount; the browser's hashchange is held back.
    swapping=true;if(hashMoves)suppressHash=href;
   }
   navigate(href,{history:'pop',state:event.state,nativeHash:sameRoute}).finally(()=>{if(!--pendingPops)swapping=false;});
  },{capture:true,signal});
  window.addEventListener('scroll',()=>{
   if(swapping||settle)return;
   positions.set(activeEntry,scroll());
   persistTimer??=window.setTimeout(persistScroll,Math.max(250,1000-(Date.now()-lastPersist)));
  },{passive:true,signal});
  const hide=()=>{if(!swapping&&!settle)positions.set(activeEntry,scroll());persistScroll();};
  window.addEventListener('pagehide',()=>{latestRequest?.cancel();hide();},{signal});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')hide();},{signal});
  window.addEventListener('hashchange',event=>{
   if(dispatchingHash)return;
   if(suppressHash!==null&&event.newURL===suppressHash){suppressHash=null;event.stopImmediatePropagation();return;}
   if(swapping){event.stopImmediatePropagation();return;}
   // Bookkeeping for a traversal belongs to its popstate; the guides still receive this event.
   if(popHash!==null&&event.newURL===popHash){popHash=null;return;}
   saveScroll(false);
   if(history.state?.[STATE_KEY]?.id===activeEntry&&currentURL!==window.location.href)replaceState({...history.state,[STATE_KEY]:{id:marker(),index:activeIndex+1,scroll:scroll()}},'',window.location.href);
   browserEntry=ensureEntry();activeEntry=browserEntry.id;activeIndex=browserEntry.index??activeIndex;currentURL=window.location.href;
  },{capture:true,signal});
  if(autoPrefetch){
   const warmRoutes=()=>{idle=null;for(const name of ROUTES)if(name!==route)prefetch(new URL(name==='desk'?'':name+'/',base)).catch(()=>{});};
   idle=window.requestIdleCallback?window.requestIdleCallback(warmRoutes,{timeout:1500}):window.setTimeout(warmRoutes,150);
  }
 }
 // Direct loads: a reload or cross-document Back/Forward returns to the saved position; otherwise a
 // fragment rendered by the route modules is revealed as the browser would have.
 async function restoreDirect(){
  const type=window.performance?.getEntriesByType?.('navigation')?.[0]?.type;
  if((type==='reload'||type==='back_forward')&&initialScroll){positions.set(activeEntry,initialScroll);applyScroll(initialScroll);return;}
  if(window.location.hash)await revealFragment(document,window.location.hash,{focus:true});
 }
 function stop(){latestRequest?.cancel();transitions.dispose();settle?.();window.clearTimeout(persistTimer);listenerController.abort();if(history.pushState===guidePush)history.pushState=originalPush;if(history.replaceState===guideReplace)history.replaceState=originalReplace;if(idle!==null){if(window.cancelIdleCallback)window.cancelIdleCallback(idle);else window.clearTimeout(idle);}history.scrollRestoration=oldRestoration;}
 // routeFor lets a mounted guide tell its own history entries from another route's during Back/Forward.
 const publicRouter={navigate,prefetch,routeFor:input=>{try{return routeForURL(new URL(input,window.location.href),base);}catch{return null;}},get route(){return route;}};
 window.TMURouter=publicRouter;
 return {...publicRouter,get route(){return route;},start,stop,restoreDirect,adoptRoute({modules:initialModules,controller:initialController}){modules=initialModules;controller=initialController;}};
}
