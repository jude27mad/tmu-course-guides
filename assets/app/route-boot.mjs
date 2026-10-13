/* Direct loads and router swaps use the same lifecycle and document order. */
import {createRouter,mountRouteModules,routeFromDocument} from './router.mjs?v=20261013-perf2';
export {mountRouteModules};
const boots=new WeakMap();
const ROUTES=['desk','cen100','mth140','mth141'];
export function bootDocument(options={}){
 const window=options.window||globalThis.window;
 if(boots.has(window.document))return boots.get(window.document);
 const promise=(async()=>{
  const {document}=window;
  if(document.readyState==='loading')await new Promise(resolve=>document.addEventListener('DOMContentLoaded',resolve,{once:true}));
  const importModule=options.importModule||(url=>import(url));
  const root=document.querySelector('[data-route-region]'),route=routeFromDocument(document);
  if(!root||!ROUTES.includes(route))throw Error('Missing route region or identity');
  const router=createRouter({...options,window});
  const controller=new window.AbortController(),modules=[];
  // A direct load keeps every module independent, as the separate page scripts were: one that fails to
  // load or mount is reported and skipped, and never takes the guide or the other modules down with it.
  for(const script of document.querySelectorAll('script[type="module"][data-shell-module][src]')){
   try{await importModule(new URL(script.getAttribute('src'),window.location.href).href);}
   catch(error){console.warn('Shell module unavailable',script.getAttribute('src'),error);}
  }
  for(const script of document.querySelectorAll('script[type="module"][data-route-module][src]')){
   let module;
   try{
    module=await importModule(new URL(script.getAttribute('src'),window.location.href).href);
    if(typeof module.mount!=='function'||typeof module.unmount!=='function')throw Error('Route module lacks mount/unmount');
   }catch(error){console.warn('Route module unavailable',script.getAttribute('src'),error);continue;}
   try{await module.mount({root,route,signal:controller.signal,direct:true,transition:{continuing:false}});modules.push(module);}
   catch(error){console.warn('Route module failed to mount',script.getAttribute('src'),error);try{await module.unmount();}catch{}}
  }
  router.adoptRoute({modules,controller});router.start();
  document.dispatchEvent(new window.CustomEvent('route-changed',{detail:{route:router.route,from:null,transition:{continuing:false}}}));
  await router.restoreDirect();
  return router;
 })();
 boots.set(window.document,promise);return promise;
}
if(typeof window!=='undefined'&&window.document){
 bootDocument({...window.TMU_BOOT_OPTIONS,window}).catch(error=>console.warn('Course route bootstrap unavailable',error));
}
