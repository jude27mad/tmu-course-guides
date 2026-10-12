/* Small route-owned resource scope. Imports are inert; each mount gets its own signal. */
export function scope(ctx={}) {
 const controller=new AbortController(),cleanups=new Set();
 const signal=controller.signal;
 const dispose=()=>{if(signal.aborted)return;controller.abort();const pending=[...cleanups].reverse();cleanups.clear();for(const fn of pending)fn();};
 if(ctx.signal?.aborted)controller.abort();
 else ctx.signal?.addEventListener('abort',dispose,{once:true,signal});
 return {signal,dispose,own(fn){cleanups.add(fn);return fn;},
  on(target,type,fn,options={}){target?.addEventListener?.(type,fn,{...(typeof options==='boolean'?{capture:options}:options),signal});return fn;},
  observer(observer,target,options){observer.observe(target,options);cleanups.add(()=>observer.disconnect());return observer;},
  frame(fn){const cancel=()=>cancelAnimationFrame(id),id=requestAnimationFrame(()=>{cleanups.delete(cancel);if(!signal.aborted)fn();});cleanups.add(cancel);return id;},
  timeout(fn,delay){const cancel=()=>clearTimeout(id),id=setTimeout(()=>{cleanups.delete(cancel);if(!signal.aborted)fn();},delay);cleanups.add(cancel);return id;},
  interval(fn,delay){const id=setInterval(()=>{if(!signal.aborted)fn();},delay);cleanups.add(()=>clearInterval(id));return id;}
 };
}

/* Restore placement/attributes using the original nodes, preserving guide listeners and form state. */
export function rememberDOM(root) {
 const records=[];
 const visit=node=>{records.push({node,children:[...node.childNodes],attributes:node.nodeType===1?[...node.attributes].map(a=>[a.name,a.value]):null});for(const child of node.childNodes)visit(child);};
 visit(root);
 return ()=>{for(const {node,children,attributes} of records){if(attributes){for(const a of [...node.attributes])node.removeAttribute(a.name);for(const [name,value] of attributes)node.setAttribute(name,value);}if(children.length||node.childNodes.length)node.replaceChildren(...children);}};
}
