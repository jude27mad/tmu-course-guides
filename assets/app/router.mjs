/* Native document routes inside one persistent shell. The documents remain the
   source of route markup, styles and ordered lifecycle modules. */
const ROUTES=['desk','cen100','mth140','mth141'];
const STATE_KEY='__tmuRouter';
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
 return !!route&&!(route===routeForURL(current,base)&&destination.search===current.search);
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

export async function mountRouteModules({document,root=document.querySelector('[data-route-region]'),route=routeFromDocument(document),signal,direct=false,url=document.URL,importModule=nativeImport,modules}){
 if(!root||!ROUTES.includes(route))throw Error('Missing route region or identity');
 modules??=await loadRouteModules({document,url,importModule});
 const attempted=[];
 try{
  for(const module of modules){attempted.push(module);await module.mount({root,route,signal,direct});}
  return modules;
 }catch(error){
  for(const module of attempted.reverse())try{await module.unmount();}catch{}
  throw error;
 }
}

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
 const listenerController=new window.AbortController();
 if(!document.documentElement.dataset.shellId)document.documentElement.dataset.shellId=window.crypto?.randomUUID?.()||`shell-${Date.now()}-${Math.random().toString(36).slice(2)}`;
 const oldRestoration=history.scrollRestoration;history.scrollRestoration='manual';
 const marker=()=>`${document.documentElement.dataset.shellId}:${++entryCounter}`;
 const scroll=()=>[window.scrollX||0,window.scrollY||0];
 function ensureEntry(state=history.state){
  if(!state?.[STATE_KEY]?.id){
   state={...(state&&typeof state==='object'?state:{}),[STATE_KEY]:{id:marker(),scroll:scroll()}};
   replaceState(state,'',window.location.href);
  }
  return state[STATE_KEY];
 }
 activeEntry=ensureEntry().id;positions.set(activeEntry,scroll());
 function saveScroll(replace=true){
  const position=scroll();positions.set(activeEntry,position);
  if(replace&&history.state?.[STATE_KEY]?.id===activeEntry)replaceState({...history.state,[STATE_KEY]:{id:activeEntry,scroll:position}},'',window.location.href);
 }
 const fallback=url=>{assign(url.href);return false;};
 const canonical=input=>{const url=new URL(input,window.location.href),name=routeForURL(url,base);if(!name)return null;const result=new URL(name==='desk'?'':name+'/',base);result.search=url.search;return result;};
 async function prefetch(input){
  const url=canonical(input);if(!url)return null;
  const key=url.href;
  if(cache.has(key)){const value=cache.get(key);cache.delete(key);cache.set(key,value);return value;}
  const request=Promise.resolve().then(async()=>{
   if(!fetch)throw Error('Document fetch unavailable');
   const response=await fetch(key,{credentials:'same-origin'});if(!response.ok)throw Error('Document fetch failed');
   const responseURL=response.url||key;
   if(routeForURL(responseURL,base)!==routeForURL(key,base))throw Error('Unexpected document redirect');
   const parsed=new window.DOMParser().parseFromString(await response.text(),'text/html');
   if(!parsed.querySelector('main[data-route-region]')||routeFromDocument(parsed)!==routeForURL(key,base))throw Error('Destination lacks its route region');
   return {document:parsed,url:responseURL};
  });
  cache.set(key,request);while(cache.size>4)cache.delete(cache.keys().next().value);
  request.catch(()=>{if(cache.get(key)===request)cache.delete(key);});
  return request;
 }
 async function prepareHead(incoming,url){
  const selector='link[rel~="stylesheet"],style',existing=[...document.head.querySelectorAll(selector)].filter(el=>!el.hasAttribute('data-shell-style'));
  const key=(el,baseURL)=>el.tagName==='STYLE'?`style:${el.media}:${el.textContent}`:`link:${new URL(el.getAttribute('href'),baseURL).href}:${el.media||''}`;
  const byKey=new Map(existing.map(el=>[key(el,currentURL),el])),desired=[],pending=[];
  for(const source of incoming.head.querySelectorAll(selector)){
   if(source.hasAttribute('data-shell-style'))continue;
   let node=byKey.get(key(source,url));
   if(!node){
    node=document.importNode(source,true);
    if(node.tagName==='LINK'){
     node.href=new URL(source.getAttribute('href'),url).href;
     // Register load/error before insertion; a cached sheet can finish immediately.
     const ready=loadStylesheet?Promise.resolve().then(()=>loadStylesheet(node)):stylesheetReady(node,window);
     document.head.append(node);pending.push(ready);
    }
   }
   desired.push(node);
  }
  await Promise.all(pending);
  return ()=>{
   for(const node of existing)if(!desired.includes(node))node.remove();
   // Moving loaded nodes reproduces the source cascade, including CEN's inline CSS.
   for(const node of desired)document.head.append(node);
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
 function restoreAndFocus(position,hash){
  const root=document.querySelector('main[data-route-region]'),skip=document.querySelector('body > .skip-link');
  let target;
  try{const id=skip&&new URL(skip.href).hash.slice(1);target=id&&document.getElementById(decodeURIComponent(id));}catch{}
  target=target&&root.contains(target)?target:root.querySelector('h1')||root;
  if(!target.hasAttribute('tabindex'))target.setAttribute('tabindex','-1');
  target.focus({preventScroll:true});
  if(position)window.scrollTo(position[0],position[1]);
  else{
   let destination;try{destination=hash&&document.getElementById(decodeURIComponent(hash.slice(1)));}catch{}
   if(destination&&!destination.closest('[hidden]'))destination.scrollIntoView?.();else window.scrollTo(0,0);
  }
  announce();
 }
 function hashChanged(oldURL,url){
  if(!url.hash&&!new URL(oldURL).hash)return;
  dispatchingHash=true;
  try{window.dispatchEvent(new window.HashChangeEvent('hashchange',{oldURL,newURL:url.href}));}finally{dispatchingHash=false;}
 }
 async function performNavigation(url,{history:mode='push',state}={}){
  const nextRoute=routeForURL(url,base);if(!nextRoute)return fallback(url);
  const oldURL=currentURL,oldRoute=route;
  // Existing view/item hash routers retain ownership within a mounted route.
  if(nextRoute===route&&new URL(currentURL).search===url.search){
   if(mode==='pop'){
    saveScroll(false);const entry=ensureEntry(state);activeEntry=entry.id;currentURL=url.href;
    hashChanged(oldURL,url);restoreAndFocus(positions.get(entry.id)||entry.scroll,url.hash);
   }else if(url.href!==window.location.href)window.location.assign(url.href);
   return true;
  }
  swapping=true;
  try{
   saveScroll(mode!=='pop');
   const destination=await prefetch(url),incoming=destination.document;
   const nextModules=await loadRouteModules({document:incoming,url:destination.url,importModule});
   if(modules.some(module=>module.reloadRequired===true))throw Error('Outgoing route requires reload');
   const waits=[];
   const event=new window.CustomEvent('route-will-change',{cancelable:true,detail:{route:nextRoute,from:route,url:url.href,waitUntil(promise){waits.push(Promise.resolve(promise));}}});
   if(!document.dispatchEvent(event))return false;
   await Promise.all(waits);
   const commitHead=await prepareHead(incoming,destination.url);
   await disposeRoute();
   const oldRoot=document.querySelector('main[data-route-region]');if(!oldRoot)throw Error('Outgoing route region missing');
   const newRoot=absoluteAttributes(document.importNode(incoming.querySelector('main[data-route-region]'),true),destination.url);
   oldRoot.replaceWith(newRoot);commitHead();syncOutsideRegion(incoming,destination.url);
   document.body.className=incoming.body.className;
   for(const key of ['course','page'])if(incoming.body.dataset[key])document.body.dataset[key]=incoming.body.dataset[key];else delete document.body.dataset[key];
   let entry;
   if(mode==='pop')entry=ensureEntry(state);
   else{entry={id:marker(),scroll:[0,0]};pushState({[STATE_KEY]:entry},'',url.href);}
   activeEntry=entry.id;currentURL=url.href;route=nextRoute;
   controller=new window.AbortController();
   // Keep partial mounts disposable if a later module fails.
   for(const module of nextModules){modules.push(module);await module.mount({root:newRoot,route,signal:controller.signal,direct:false});}
   hashChanged(oldURL,url);
   restoreAndFocus(mode==='pop'?(positions.get(entry.id)||entry.scroll):null,url.hash);
   document.dispatchEvent(new window.CustomEvent('route-changed',{detail:{route,from:oldRoute}}));
   return true;
  }catch(error){
   // A full document navigation is the recovery boundary for partial DOM/module work.
   try{await disposeRoute();}catch{}
   return fallback(url);
  }finally{swapping=false;}
 }
 function navigate(input,options){
  const url=new URL(input,window.location.href);
  const result=queue.then(()=>performNavigation(url,options));queue=result.catch(()=>{});return result;
 }
 const linkFromEvent=event=>event.target?.closest?.('a[href]');
 // Existing guides create view/item entries with null state. Give those entries
 // the same scroll bookkeeping as cross-course entries without changing their URLs.
 const guidePush=function(state,title,url){
  saveScroll();
  const entry={id:marker(),scroll:scroll()};
  pushState({...state,[STATE_KEY]:entry},title,url);
  activeEntry=entry.id;positions.set(activeEntry,entry.scroll);currentURL=window.location.href;
 };
 const guideReplace=function(state,title,url){
  const entry={id:activeEntry,scroll:scroll()};
  replaceState({...state,[STATE_KEY]:entry},title,url);
  positions.set(activeEntry,entry.scroll);currentURL=window.location.href;
 };
 function start(){
  if(started)return;started=true;
  history.pushState=guidePush;history.replaceState=guideReplace;
  const signal=listenerController.signal;
  window.addEventListener('click',event=>{const a=linkFromEvent(event);if(isRouteLink(event,a,{base,currentURL:window.location.href})){event.preventDefault();navigate(a.href);}}, {capture:true,signal});
  const warm=event=>{const a=linkFromEvent(event);if(isRouteLink({button:0},a,{base,currentURL:window.location.href}))prefetch(a.href).catch(()=>{});};
  window.addEventListener('pointerenter',warm,{capture:true,signal});window.addEventListener('focus',warm,{capture:true,signal});
  window.addEventListener('popstate',event=>{saveScroll(false);swapping=true;navigate(window.location.href,{history:'pop',state:event.state}).finally(()=>{swapping=false;});},{capture:true,signal});
  window.addEventListener('scroll',()=>{if(!swapping)saveScroll();},{passive:true,signal});
  window.addEventListener('hashchange',event=>{
   if(dispatchingHash)return;
   if(swapping){event.stopImmediatePropagation();return;}
   saveScroll(false);
   if(history.state?.[STATE_KEY]?.id===activeEntry&&currentURL!==window.location.href)replaceState({...history.state,[STATE_KEY]:{id:marker(),scroll:scroll()}},'',window.location.href);
   activeEntry=ensureEntry().id;currentURL=window.location.href;
  },{capture:true,signal});
  if(autoPrefetch){
   const warmRoutes=()=>{idle=null;for(const name of ROUTES)if(name!==route)prefetch(new URL(name==='desk'?'':name+'/',base)).catch(()=>{});};
   idle=window.requestIdleCallback?window.requestIdleCallback(warmRoutes,{timeout:1500}):window.setTimeout(warmRoutes,150);
  }
 }
 function stop(){listenerController.abort();if(history.pushState===guidePush)history.pushState=originalPush;if(history.replaceState===guideReplace)history.replaceState=originalReplace;if(idle!==null){if(window.cancelIdleCallback)window.cancelIdleCallback(idle);else window.clearTimeout(idle);}history.scrollRestoration=oldRestoration;}
 const publicRouter={navigate,prefetch,get route(){return route;}};
 window.TMURouter=publicRouter;
 return {...publicRouter,get route(){return route;},start,stop,adoptRoute({modules:initialModules,controller:initialController}){modules=initialModules;controller=initialController;}};
}
