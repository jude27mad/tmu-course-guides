/* Direct loads and router swaps use the same lifecycle and document order. */
import {createRouter,mountRouteModules,routeFromDocument} from './router.mjs';
export {mountRouteModules};
const boots=new WeakMap();
export function bootDocument(options={}){
 const window=options.window||globalThis.window;
 if(boots.has(window.document))return boots.get(window.document);
 const promise=(async()=>{
  const {document}=window;
  if(document.readyState==='loading')await new Promise(resolve=>document.addEventListener('DOMContentLoaded',resolve,{once:true}));
  const importModule=options.importModule||(url=>import(url));
  const router=createRouter({...options,window});
  const controller=new window.AbortController();
  let modules=[];
  try{
   for(const script of document.querySelectorAll('script[type="module"][data-shell-module][src]'))await importModule(new URL(script.getAttribute('src'),window.location.href).href);
   modules=await mountRouteModules({document,url:window.location.href,route:routeFromDocument(document),signal:controller.signal,direct:true,importModule});
   router.adoptRoute({modules,controller});router.start();
   document.dispatchEvent(new window.CustomEvent('route-changed',{detail:{route:router.route,from:null}}));
   return router;
  }catch(error){
   for(const module of [...modules].reverse())try{await module.unmount();}catch{}
   controller.abort();router.stop();delete window.TMURouter;
   throw error;
  }
 })();
 boots.set(window.document,promise);return promise;
}
if(typeof window!=='undefined'&&window.document){
 bootDocument({...window.TMU_BOOT_OPTIONS,window}).catch(error=>console.warn('Course route bootstrap unavailable',error));
}
