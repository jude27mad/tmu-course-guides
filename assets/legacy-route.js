/* Root compatibility. The site root used to be the CEN100 guide; it is now the Desk. A root URL carrying an
   old CEN100 hash forwards once to cen100/ with its entire query and hash. Classic script, loaded
   synchronously at the top of the Desk <head> so forwarding happens before first paint. */
(function(global){
 'use strict';
 // Hashes the old root guide read or generated (docs/qa/night-shift/inventory.md §2). Raw and case-sensitive.
 const HASHES=[/^#assignment-[a-z]\d+$/,/^#(assignments|course-info|guide-tools|guide-search|workspace-timeline)$/,/^#(nextsign|board|course-main)$/,/^#(t|p)-(team|you|rules)$/,/^#guide-item-[a-z]\d+$/];
 // The old guide read no query key of its own; generic flags (motion, tier, theme, v, utm_*) alone keep the Desk.
 const QUERY_KEYS=[];
 // The site base is the directory above assets/: / on the local preview, /tmu-course-guides/ on Pages.
 function siteBase(scriptSrc){return new URL('../',scriptSrc).href;}
 // Pure decision: the URL to replace the current one with, or null to stay.
 function decide(href,base){
  let url,root;try{url=new URL(href);root=new URL(base);}catch(e){return null;}
  // Only the Desk itself forwards, so cen100/ and every other page can never loop.
  if(url.origin!==root.origin||(url.pathname!==root.pathname&&url.pathname!==root.pathname+'index.html'))return null;
  const cen=HASHES.some(function(re){return re.test(url.hash);})||QUERY_KEYS.some(function(key){return url.searchParams.has(key);});
  if(!cen)return null;
  // Fixed destination; the query and hash are carried verbatim (raw tail of the href), never read as a target.
  const tail=/[?#]/.exec(href);
  return new URL('cen100/',root).href+(tail?href.slice(tail.index):'');
 }
 function run(doc,loc){
  const script=doc&&doc.currentScript;if(!script||!script.src||!loc)return null;
  const to=decide(loc.href,siteBase(script.src));if(to)loc.replace(to);
  return to;
 }
 global.TMULegacyRoute={HASHES:HASHES,QUERY_KEYS:QUERY_KEYS,siteBase:siteBase,decide:decide,run:run};
 // Runs once at load; never on hashchange, so in-page Desk navigation cannot trigger it.
 if(typeof document!=='undefined')try{run(document,global.location);}catch(e){}
})(typeof window!=='undefined'?window:globalThis);
