const {JSDOM,requestInterceptor,VirtualConsole}=require('jsdom');
const esbuild=require('esbuild');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=require('node:path').resolve(__dirname,'../..');
const resources={interceptors:[requestInterceptor(async(request)=>{
 const u=new URL(request.url);if(u.hostname!=='guide.test')return new Response('');
 const file=path.join(root,u.pathname);if(!fs.existsSync(file))return new Response('',{status:404});
 if(file.endsWith('.mjs')){const r=await esbuild.build({entryPoints:[file],bundle:true,write:false,format:'iife',logLevel:'silent'});return new Response(r.outputFiles[0].text,{headers:{'Content-Type':'application/javascript'}})}
 return new Response(fs.readFileSync(file),{headers:{'Content-Type':file.endsWith('.css')?'text/css':'application/javascript'}});
})]};
async function check(route,course,motion='off'){
 const filename=path.join(root,route,'index.html');
 const html=fs.readFileSync(filename,'utf8').replaceAll('type="module"','defer');
 const errors=[];const log=new VirtualConsole();log.on('jsdomError',e=>{if(!e.message.includes('CSS'))errors.push(e.message)});
 const dom=new JSDOM(html,{url:'https://guide.test/'+route+'?motion='+motion,resources,runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:log,beforeParse(w){
   w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
   w.IntersectionObserver=class{observe(){} disconnect(){}};w.ResizeObserver=class{observe(){}disconnect(){}};
   w.HTMLCanvasElement.prototype.getContext=()=>null; // Exercise header fallback; jsdom provides no GPU.
   w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};
   w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'))};
   w.localStorage.setItem(course==='cen100'?'cen100-contact-choice-v1':course+'-section-v1',JSON.stringify(course==='cen100'?{section:29,group:9}:31));
   if(course!=='cen100')w.localStorage.setItem(course+'-progress-v1',JSON.stringify({checks:{},completed:{'quiz-1':true},notes:{'quiz-1':'Existing saved note'},topics:{},targets:{}}));
 }});
 const w=dom.window,d=w.document;
 await new Promise((resolve,reject)=>{w.addEventListener('load',resolve,{once:true});setTimeout(()=>reject(Error('Load timeout')),10000).unref()});
 await new Promise(r=>setTimeout(r,20));
 assert.deepEqual(errors,[],course+' runtime errors');
 assert(d.body.classList.contains('workspace'),course+' workspace mounted');
 assert(d.querySelector('.header-upgraded .header-art svg,.header-upgraded .header-art canvas'),course+' dimensional header mounted');
 if(motion==='off')assert.equal(d.querySelector('.header-art').dataset.motionState,'still');
 assert.equal(d.body.dataset.workspaceView,'assignments');
 const click=s=>{const el=d.querySelector(s);assert(el,course+' '+s+' exists');el.click()};
 const visible=s=>!d.querySelector(s).closest('[hidden]');
 const controlsBefore=[...d.querySelectorAll('input,select,textarea')].length;
 click('.workspace-nav [data-workspace-view="info"]');assert(visible('#'+(course==='cen100'?'guide-tools':'math-tools')),'tools reachable');
 assert(visible(course==='cen100'?'#contact-section':'#section-select'),'section reachable');
 click('.workspace-tools');assert(d.querySelector(course==='cen100'?'#guide-tools':'#math-tools').open,'toolbar tools open');
 assert.equal(d.querySelector('.workspace-tools').getAttribute('aria-expanded'),'true','tools button announces expanded state');
 click('.workspace-search');assert(visible('#guide-search'),'search reachable');
 const search=d.querySelector('#guide-search');search.value=course==='cen100'?'WHMIS':'quiz';search.dispatchEvent(new w.Event('input',{bubbles:true}));
 assert(d.querySelectorAll('#guide-search-results li').length>0,'search returns results');
 click('.workspace-search');assert.equal(search.value,'');
 click('.workspace-nav [data-workspace-view="assignments"]');
 if(course==='cen100'){
  assert(visible('#p-team')&&visible('#p-you'),'all categories visible');
  click('[data-cen-filter="you"]');assert(!visible('#p-team')&&visible('#p-you'),'category filter');
  click('[data-cen-filter="all"]');
  click('#guide-item-y4 .head');assert(d.querySelector('.detail-sheet').open,'CEN drawer opens');
  click('.sheet-close');if(motion!=='off')await new Promise(r=>setTimeout(r,750));assert(!d.querySelector('.detail-sheet').open,'drawer closes');
  click('#quick-contacts');assert.equal(d.body.dataset.workspaceView,'info','legacy contacts navigate');
 }else{
  assert.equal(d.querySelector('#section-select').value,'31','saved section restored');
  assert.equal(d.querySelector('[data-note="quiz-1"]').value,'Existing saved note','saved note retained');
  click('.workspace-nav [data-workspace-view="study"]');assert(visible('#math-lab')&&visible('#topic-grid'),'labs and topics reachable');
  const experiments=[...d.querySelectorAll('[data-lab]')];
  for(const experiment of experiments){experiment.click();assert(d.querySelector('#math-lab svg'),'plot exists for '+experiment.dataset.lab)}
  click('[data-mode="mistakes"]');assert(d.querySelector('.mistake-challenge'), 'challenge mode mounts');
  click('[data-mode="explore"]');
  click('.lab-expand');assert(d.querySelector('.lab-dialog').open,'lab expansion opens');
  click('.lab-expand');if(motion!=='off'){for(let i=0;i<30&&d.querySelector('.lab-dialog').open;i++)await new Promise(r=>setTimeout(r,100));}assert(!d.querySelector('.lab-dialog').open,'lab expansion closes: '+d.querySelector('.lab-dialog').getAttribute('style')+' / '+d.querySelector('.lab-dialog').dataset.closing+' / '+JSON.stringify(errors));
  click('.workspace-nav [data-workspace-view="assignments"]');
  click('#assessment-quiz-1 > summary');assert(d.querySelector('.detail-sheet').open,'math drawer opens');
  click('.sheet-close');if(motion!=='off')await new Promise(r=>setTimeout(r,750));assert(!d.querySelector('.detail-sheet').open,'math drawer closes');
  click('#quick-contacts');assert.equal(d.body.dataset.workspaceView,'info','legacy contacts navigate');
 }
 assert.equal(d.querySelectorAll('input,select,textarea').length>=controlsBefore-10,true,'guide controls retained');
 click('#quick-work');await new Promise(r=>setTimeout(r,1));assert.equal(d.body.dataset.workspaceView,'info','work tool navigates');
 assert(d.querySelector('#work-tools').open,'work tool opens');
 if(motion!=='off'){
  // A late tools disclosure must respect a newer section/history selection.
  const tools=d.querySelector(course==='cen100'?'#guide-tools':'#math-tools');
  w.GuideMotion.disclosure(tools,false);w.GuideMotion.cancel(tools);
  click('.workspace-nav [data-workspace-view="assignments"]');click('.workspace-tools');
  await new Promise(r=>setTimeout(r,60));click('.workspace-nav [data-workspace-view="assignments"]');
  await new Promise(r=>setTimeout(r,600));
  assert.equal(d.body.dataset.workspaceView,'assignments','tools completion cannot reverse newer navigation');
  assert.equal(w.location.hash,'#assignments','tools completion keeps visible view aligned with history');
  // Cover the same-turn race, before the opening mutation observer has run.
  w.GuideMotion.disclosure(tools,false);w.GuideMotion.cancel(tools);
  click('.workspace-tools');click('.workspace-nav [data-workspace-view="assignments"]');
  await new Promise(r=>setTimeout(r,600));assert.equal(d.body.dataset.workspaceView,'assignments','queued tools mutation cannot reverse navigation');
  // Verify completion emits once and interruption leaves the latest view readable.
  let completions=0;d.addEventListener('guide-completion',()=>completions++);
  const checkbox=d.querySelector(course==='cen100'?'input[data-k]':'input[data-completed]');
  checkbox.checked=!checkbox.checked;checkbox.dispatchEvent(new w.Event('change',{bubbles:true}));
  await new Promise(r=>setTimeout(r,10));assert.equal(completions,1,'single completion event');
  click('.workspace-nav [data-workspace-view="assignments"]');click('.workspace-nav [data-workspace-view="info"]');click('.workspace-nav [data-workspace-view="assignments"]');
  w.GuideMotion.cancel(d.querySelector('.math-wrap,.wrap'));
  assert.equal(d.body.dataset.workspaceView,'assignments');assert(visible('#workspace-assignments'),'latest destination is visible');
  assert(d.querySelector('#workspace-info').hidden,'interrupted outgoing panel is hidden');
  // Opening/closing during entrance keeps the exact original row and listeners.
  const source=d.querySelector(course==='cen100'?'#guide-item-y4':'#assessment-quiz-1').closest('li');
  w.CourseVisuals.open(source,source.querySelector('.head,summary'));w.CourseVisuals.close();w.CourseVisuals.open(source,source.querySelector('.head,summary'));
  assert.equal(d.querySelector('.sheet-content').firstElementChild,source,'rapid reopen keeps original node');
  d.querySelector('.detail-sheet').dispatchEvent(new w.Event('cancel',{cancelable:true}));
  w.GuideMotion.setPaused(true);assert(!d.querySelector('.detail-sheet').open,'pause settles Escape close');assert(source.isConnected,'source restored');
  w.GuideMotion.setPaused(false);
  // The saved quiz used above is past; expose it through the real control before testing return focus.
  const showPast=d.querySelector('#workspace-show-past');showPast.checked=true;showPast.dispatchEvent(new w.Event('change',{bubbles:true}));
  assert.notEqual(w.getComputedStyle(source).display,'none','focus restoration source is rendered');
  const trigger=source.querySelector('.head,summary');
  w.CourseVisuals.open(source,trigger);w.CourseVisuals.close(true);
  assert.equal(d.activeElement,trigger,'ordinary sheet close restores its visible trigger focus');
  // Public and history-driven section changes close a sheet and focus visible navigation.
  w.CourseVisuals.open(source,trigger);w.CourseWorkspace.show('info');
  assert(!d.querySelector('.detail-sheet').open,'public section change closes sheet');
  assert.equal(d.activeElement,d.querySelector('.workspace-nav [data-workspace-view="info"]'),'public section change focuses its visible destination');
  click('.workspace-nav [data-workspace-view="info"]');click('.workspace-nav [data-workspace-view="assignments"]');
  w.CourseVisuals.open(source,trigger);w.history.back();
  await new Promise(r=>setTimeout(r,100));
  assert.equal(d.body.dataset.workspaceView,'info','Back with a sheet restores the destination section');
  assert(!d.querySelector('.detail-sheet').open,'Back closes the moved sheet');
  assert.equal(d.activeElement,d.querySelector('.workspace-nav [data-workspace-view="info"]'),'Back sheet closure focuses visible destination');
  assert(!d.activeElement.closest('[hidden],[inert]'),'route closure keeps focus outside outgoing hidden/inert content');
  assert.equal(source.closest('.workspace-panel').id,'workspace-assignments','route closure restores original row to its source');
  click('.workspace-nav [data-workspace-view="assignments"]');click('.workspace-nav [data-workspace-view="info"]');
  w.history.back();await new Promise(r=>setTimeout(r,100));assert.equal(d.body.dataset.workspaceView,'assignments','Back restores section');
  w.history.forward();await new Promise(r=>setTimeout(r,100));assert.equal(d.body.dataset.workspaceView,'info','Forward restores section');
  if(course!=='cen100'){
   click('.workspace-nav [data-workspace-view="study"]');click('[data-mode="explore"]');click('[data-lab="'+(course==='mth140'?'transforms':'complex')+'"]');
   const param=d.querySelector('#math-lab [data-number]');param.value='2';param.dispatchEvent(new w.Event('change',{bubbles:true}));
   const value=param.value;click('.lab-expand');click('.lab-expand');w.GuideMotion.setPaused(true);
   assert.equal(d.querySelector('#math-lab [data-number]').value,value,'expanded lab retains parameter state');w.GuideMotion.setPaused(false);
  }
 }
 assert.deepEqual(errors,[],course+' final runtime errors');
 console.log(course+' ('+motion+'): navigation, search, drawers, tools, section and state checks passed');
 dom.window.close();
}
(async()=>{await check('','cen100');await check('mth140/','mth140');await check('mth141/','mth141');await check('','cen100','on');await check('mth140/','mth140','on');await check('mth141/','mth141','on')})().catch(e=>{console.error(e);process.exit(1)});
