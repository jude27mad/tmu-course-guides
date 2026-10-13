const path=require('node:path');
const assert=require('node:assert/strict');
const {createGuide,until,pause}=require('./module-harness.cjs');
const root=path.resolve(__dirname,'../..');
// jsdom delays history traversal behind long synchronous work, so wait for popstate rather than a fixed delay.
const traversed=w=>new Promise(r=>{const t=setTimeout(r,3000);w.addEventListener('popstate',()=>{clearTimeout(t);setTimeout(r,50);},{once:true});});
async function check(route,course,motion='off'){
 const {dom,errors}=await createGuide({root,route,motion,beforeParse(w){
   w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
   w.IntersectionObserver=class{observe(){} disconnect(){}};w.ResizeObserver=class{observe(){}disconnect(){}};
   w.HTMLCanvasElement.prototype.getContext=()=>null; // Exercise header fallback; jsdom provides no GPU.
   w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};
   w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'))};
   w.localStorage.setItem(course==='cen100'?'cen100-contact-choice-v1':course+'-section-v1',JSON.stringify(course==='cen100'?{section:29,group:9}:31));
   // Saved CEN progress from before the move to cen100/: storage keys are course-derived, so it must still load.
   if(course==='cen100')w.localStorage.setItem('cen100-personal-plan-v1',JSON.stringify({completed:{integrity:1},notes:{y4:'Existing CEN note'},targets:{}}));
   if(course!=='cen100')w.localStorage.setItem(course+'-progress-v1',JSON.stringify({checks:{},completed:{'quiz-1':true},notes:{'quiz-1':'Existing saved note'},topics:{},targets:{}}));
 }});
 const w=dom.window,d=w.document;
 assert.deepEqual(errors,[],course+' runtime errors');
 assert(d.body.classList.contains('workspace'),course+' workspace mounted');
 assert(d.querySelector('.header-upgraded .header-art canvas,.header-upgraded .header-art .scene-poster'),course+' dimensional header or matching poster mounted');
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
  assert.equal(d.querySelector('#contact-section').value,'29','saved section restored at cen100/');
  assert(d.querySelector('input[data-completion="integrity"]').checked,'saved completion restored at cen100/');
  assert.equal(d.querySelector('#note-y4').value,'Existing CEN note','saved CEN note retained');
  assert.equal(JSON.parse(w.localStorage.getItem('cen100-personal-plan-v1')).completed.integrity,1,'saved completion not overwritten');
  assert.equal(d.querySelector('.course-link[aria-current]').dataset.courseLink,'cen100','CEN marked current');
  assert.equal(d.querySelector('.desk-link').href,'https://guide.test/','Desk link goes to the site base');
  assert(visible('#p-team')&&visible('#p-you'),'all categories visible');
  click('[data-cen-filter="you"]');assert(!visible('#p-team')&&visible('#p-you'),'category filter');
  click('[data-cen-filter="all"]');
  click('#guide-item-y4 .head');assert(d.querySelector('.detail-sheet').open,'CEN drawer opens');
  click('.sheet-close');if(motion!=='off')await until(()=>!d.querySelector('.detail-sheet').open,'CEN drawer close did not finish',5000);assert(!d.querySelector('.detail-sheet').open,'drawer closes');
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
  click('.sheet-close');if(motion!=='off')await until(()=>!d.querySelector('.detail-sheet').open,'Math drawer close did not finish',5000);assert(!d.querySelector('.detail-sheet').open,'math drawer closes');
  click('#quick-contacts');assert.equal(d.body.dataset.workspaceView,'info','legacy contacts navigate');
 }
 assert.equal(d.querySelectorAll('input,select,textarea').length>=controlsBefore-10,true,'guide controls retained');
 const dockDesk=d.querySelector('.ns-dock .ns-dock-id + .ns-dock-desk');
 assert(dockDesk,course+' dock has a Desk link right after the course id');assert.equal(dockDesk.href,'https://guide.test/','dock Desk link goes to the site base');
 assert(d.querySelector('.ns-dock [data-ns-title]').textContent.trim(),course+' deadline layer resolved a target from the shared resolver');
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
  w.CourseVisuals.open(source,trigger);const back=traversed(w);w.history.back();
  await back;
  assert.equal(d.body.dataset.workspaceView,'info','Back with a sheet restores the destination section');
  assert(!d.querySelector('.detail-sheet').open,'Back closes the moved sheet');
  assert.equal(d.activeElement,d.querySelector('.workspace-nav [data-workspace-view="info"]'),'Back sheet closure focuses visible destination');
  assert(!d.activeElement.closest('[hidden],[inert]'),'route closure keeps focus outside outgoing hidden/inert content');
  assert.equal(source.closest('.workspace-panel').id,'workspace-assignments','route closure restores original row to its source');
  click('.workspace-nav [data-workspace-view="assignments"]');click('.workspace-nav [data-workspace-view="info"]');
  {const p=traversed(w);w.history.back();await p;}assert.equal(d.body.dataset.workspaceView,'assignments','Back restores section');
  {const p=traversed(w);w.history.forward();await p;}assert.equal(d.body.dataset.workspaceView,'info','Forward restores section');
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
// The Desk (site root): course directory with no course identity. Desk mode resolves every course's next deadline
// from the shared data-level resolver against a frozen clock; it reads saved sections/completion and writes nothing.
const NOON_OCT12=Date.parse('2026-10-12T16:00:00Z'); // 12:00 PM Toronto
const SEEDS={
 completed:{'cen100-contact-choice-v1':JSON.stringify({section:29,group:9}),'cen100-personal-plan-v1':JSON.stringify({completed:{integrity:1},notes:{},targets:{}}),'mth140-section-v1':'31'},
 sections:{'cen100-contact-choice-v1':JSON.stringify({section:29,group:9}),'mth140-section-v1':'31'},
 fresh:{}
};
async function checkDesk(motion,seed='completed'){
 const saved=SEEDS[seed];
 const {dom,errors}=await createGuide({root,motion,beforeParse(w){
   w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});for(const [k,v] of Object.entries(saved))w.localStorage.setItem(k,v);
   const Native=w.Date;w.Date=class extends Native{constructor(...a){super(...(a.length?a:[NOON_OCT12]))}static now(){return NOON_OCT12}};
 }});
 const w=dom.window,d=w.document;
 for(let i=0;i<100&&d.querySelector('[data-desk-overall-body]').hidden;i++)await new Promise(r=>setTimeout(r,20));
 assert.deepEqual(errors,[],'desk runtime errors');
 assert.equal(d.body.dataset.course,undefined,'Desk has no course identity');
 assert.equal(d.documentElement.dataset.nsPage,'desk','boot runs in Desk mode');
 assert.equal(d.documentElement.dataset.nsFailed,undefined,'no Desk module failed');
 assert(!d.querySelector('.ns-dock,.workspace-panel,.header-upgraded'),'no course workspace, dock or header on the Desk');
 assert.equal(d.querySelector('.course-link[aria-current]').dataset.courseLink,'desk','Desk, not CEN, is current');
 assert.equal(d.querySelectorAll('.course-link[aria-current]').length,1,'only the Desk is current');
 assert.deepEqual([...d.querySelectorAll('.course-switch .course-link')].map(a=>a.href),['https://guide.test/','https://guide.test/cen100/','https://guide.test/mth140/','https://guide.test/mth141/'],'switcher routes');
 assert.deepEqual([...d.querySelectorAll('.desk-course')].map(a=>a.href),['https://guide.test/cen100/','https://guide.test/mth140/','https://guide.test/mth141/'],'directory links');
 assert.equal(d.querySelector('a[href],button,input,select,textarea').className,'skip-link','Skip link is the first focusable element');
 assert.equal(d.querySelector('[data-desk-stage]').childElementCount,0,'the Stage 5 mount point is empty');
 const next=course=>{const slot=d.querySelector(`[data-course-card="${course}"] [data-desk-next]`);assert(!slot.hidden,course+' deadline shown');return slot;};
 const text=(node,s)=>node.querySelector(s)?.textContent;
 const overall=d.querySelector('[data-desk-overall]');
 assert(d.querySelector('[data-desk-static]').hidden,'static intro replaced once deadlines resolve');
 assert.equal(d.querySelector('[data-desk-today]').textContent,'Monday, Oct 12 · Toronto');
 if(seed!=='fresh'){
  assert.equal(d.querySelector('[data-saved-course="cen100"]').textContent,'Section 29','Desk reads the saved CEN section');
  assert.equal(d.querySelector('[data-saved-course="mth140"]').textContent,'Section 31','Desk reads the saved MTH140 section');
  assert.equal(text(next('mth140'),'.desk-course-title'),'Lab Quiz 2');
  assert.equal(text(next('mth140'),'.desk-course-when'),'Thu Oct 15 · 4:00 PM · VIC106','saved section gives the exact lab slot');
  assert.match(text(next('mth140'),'.desk-course-note'),/lab timetable/,'timetable caveat kept');
  assert.equal(text(next('mth140'),'.desk-course-section'),'Section 31 · Thu 4:00 PM lab · VIC106');
  assert.equal(text(next('mth141'),'.desk-course-title'),'Midterm Test');
  assert.equal(text(next('mth141'),'.desk-chip'),'4d 6h left');
  assert.equal(text(next('mth141'),'.desk-course-section'),'No section saved');
 }
 if(seed==='completed'){
  // Integrity recorded done: CEN's next is the Section 29 lab reminder, a date without a time.
  assert.equal(text(next('cen100'),'.desk-course-title'),'Failure Analysis Part 1 in lab (Section 29)');
  assert.equal(text(next('cen100'),'.desk-chip'),'In 2 days');assert.equal(text(next('cen100'),'.desk-course-label'),'Time not posted · check D2L');
  assert.equal(overall.dataset.deskCourse,'cen100');assert.equal(overall.dataset.precision,'day');
  assert(!overall.querySelector('.desk-digits'),'no timer for a date without a time');
  assert.equal(text(overall,'.desk-word'),'In 2 days');
  assert.equal(overall.querySelector('.desk-action').href,'https://guide.test/cen100/#assignment-m3','overall links to the item in its guide');
 }else if(seed==='sections'){
  assert.equal(text(next('cen100'),'.desk-course-title'),'Academic Integrity Quiz');
  assert.equal(overall.dataset.deskCourse,'cen100');assert.equal(overall.dataset.precision,'exact');
  assert.deepEqual([...overall.querySelectorAll('.desk-unit b')].map(b=>b.textContent),['02','03','00'],'exact overall target counts down');
  assert.equal(text(overall,'.desk-count-when'),'Wed Oct 14 · 3:00 PM Toronto','actual date and Toronto time beside the timer');
  assert.equal(overall.querySelector('.desk-action').href,'https://guide.test/cen100/#assignment-y4');
 }else{
  // Nothing saved: MTH140's quiz week could fall on Monday, so it leads, with its section CTA and no timer.
  assert.equal(overall.dataset.deskCourse,'mth140');assert.equal(overall.dataset.precision,'week');
  assert(!overall.querySelector('.desk-digits'),'no timer for a quiz week');
  assert.equal(text(overall,'.desk-word'),'Oct 12–16');
  assert.equal(overall.querySelector('.desk-action-quiet').href,'https://guide.test/mth140/#course-info','section CTA opens the guide’s section picker');
  assert.equal(next('mth140').querySelector('.desk-cta').href,'https://guide.test/mth140/#course-info');
  assert.equal(text(next('cen100'),'.desk-chip'),'2d 3h left');
 }
 assert.match(d.querySelector('[data-desk-live]').textContent,/^Next across your courses/,'polite summary for assistive tech');
 assert.deepEqual(Object.fromEntries(Object.keys(saved).map(k=>[k,w.localStorage.getItem(k)])),saved,'Desk leaves saved course data untouched');
 assert.equal(w.localStorage.length,Object.keys(saved).length,'Desk writes no new storage');
 assert.equal(w.location.href,'https://guide.test/?motion='+motion,'generic query stays on the Desk');
 assert.equal(w.TMULegacyRoute.decide('https://guide.test/?motion='+motion+'#assignment-y4','https://guide.test/'),'https://guide.test/cen100/?motion='+motion+'#assignment-y4','old CEN link forwards');
 console.log('desk ('+motion+', '+seed+'): directory, deadlines, switcher, saved sections and root forwarding checks passed');
 dom.window.close();
}
async function checkRoutes(base='https://guide.test/'){
 const seeds={...SEEDS.completed,'mth141-section-v1':'31',
  'cen100-personal-plan-v1':JSON.stringify({completed:{integrity:1},notes:{y4:'Saved CEN'},targets:{}}),
  'mth140-progress-v1':JSON.stringify({completed:{'quiz-1':true},checks:{},notes:{'quiz-1':'Saved calculus'},targets:{},topics:{}}),
  'mth141-progress-v1':JSON.stringify({completed:{'quiz-1':true},checks:{},notes:{'quiz-1':'Saved algebra'},targets:{},topics:{}})};
 const {dom,w,d,errors,fallbacks,counters}=await createGuide({root,base,instrumentCounts:true,beforeParse(w){
  for(const [key,value] of Object.entries(seeds))w.localStorage.setItem(key,value);
  const Native=w.Date;w.Date=class extends Native{constructor(...a){super(...(a.length?a:[NOON_OCT12]))}static now(){return NOON_OCT12}};
 }});
 try{
  const marker=d.documentElement.dataset.shellId,router=w.TMURouter,hub=d.querySelector('.hub-shell'),motion=w.GuideMotion;
  assert(marker,'one shell marker exists');assert(hub&&motion,'the actual sidebar and motion controller exist');assert.equal(router.route,'desk');
  let completed=0;d.addEventListener('guide-completion',()=>completed++);
  const assertRoute=route=>{
   assert.equal(router.route,route);assert.equal(d.documentElement.dataset.shellId,marker,'document survives navigation');
   assert.equal(w.GuideMotion,motion,'motion controller survives');assert.equal(d.querySelector('.hub-shell'),hub,'sidebar survives');
   assert.equal(d.querySelector('.course-link[aria-current]').dataset.courseLink,route,'sidebar current course follows route');
   assert.equal(new URL(w.location.href).pathname,new URL(route==='desk'?'':route+'/',base).pathname,'URL matches the mounted route');
   assert.equal(d.querySelectorAll('main[data-route-region]').length,1,'one route region');
   if(route!=='desk'){
    assert.equal(d.body.dataset.course,route);assert.match(d.title,new RegExp(route,'i'));
    assert.equal(w.__tmuModules[new URL('assets/night/core.mjs',base).pathname].route(),route,'core reads the current identity');
    assert(d.querySelector('main[data-route-region]').contains(d.activeElement),'focus lands in the new route');
    assert.equal(d.querySelector('[data-router-announcement]').textContent,route.toUpperCase()+' guide');
   }else assert.equal(d.body.dataset.course,undefined);
   assert.deepEqual(fallbacks,[],'normal route navigation needs no reload');assert.deepEqual(errors,[],'route swap has no runtime errors');
  };
  const move=async(route,hash='')=>{assert.equal(await router.navigate(new URL((route==='desk'?'':route+'/')+hash,base).href),true);assertRoute(route);};
  // Exercise native click capture before programmatic navigation.
  d.querySelector('.desk-course').click();await until(()=>router.route==='cen100','Desk link did not navigate');assertRoute('cen100');
  const dock=d.querySelector('.ns-dock'),wrapper=d.querySelector('.course-workspace');
  assert(d.querySelector('input[data-completion="integrity"]').checked,'CEN saved completion survives navigation');
  assert.equal(d.querySelector('#note-y4').value,'Saved CEN','CEN note survives route entry');
  await move('mth140','#assessment-quiz-1');
  assert(d.querySelector('.detail-sheet').open,'destination hash opens its assessment');
  assert.equal(d.querySelector('[data-note="quiz-1"]').value,'Saved calculus','math note survives route entry');
  const checkbox=d.querySelector('input[data-completed="quiz-1"]');
  checkbox.checked=false;checkbox.dispatchEvent(new w.Event('change',{bubbles:true}));await pause(1);assert.equal(completed,1,'one action emits one completion');
  await move('mth141');assert.equal(d.querySelector('[data-note="quiz-1"]').value,'Saved algebra');
  const changed=route=>new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>{d.removeEventListener('route-changed',onChange);reject(Error('History did not mount '+route+'; current '+router.route+' at '+w.location.href));},15000);
   function onChange(event){if(event.detail.route===route){clearTimeout(timer);d.removeEventListener('route-changed',onChange);resolve();}}
   d.addEventListener('route-changed',onChange);
  });
  {const back=changed('mth140');w.history.back();await back;assertRoute('mth140');}
  {const forward=changed('mth141');w.history.forward();await forward;assertRoute('mth141');}
  await move('desk');assert.equal(d.querySelector('.ns-dock'),dock,'dock survives returning to Desk');assert(dock.hidden,'course dock is hidden on Desk');
  const counts=new Map(),rounds=new URL(base).pathname==='/'?20:1;
  for(let round=0;round<rounds;round++){
   for(const route of ['cen100','mth140','mth141','desk']){
    await move(route);await pause(180);assert.equal(d.querySelector('.course-workspace'),wrapper,'workspace shell remains');assert.equal(d.querySelector('.ns-dock'),dock,'dock remains');
    const current=counters.counts();
    if(round===0)counts.set(route,current);else assert.deepEqual(current,counts.get(route),route+' live listener/observer counts remain flat at round '+round);
    assert.equal(d.querySelectorAll('.detail-sheet').length,route==='desk'?0:1,'no duplicated detail sheets');
    assert.equal(d.querySelectorAll('.lab-dialog').length,route.startsWith('mth')?1:0,'no stale lab dialogs');
   }
  }
  assert.equal(JSON.parse(w.localStorage.getItem('cen100-personal-plan-v1')).completed.integrity,1);
  assert.equal(JSON.parse(w.localStorage.getItem('mth140-progress-v1')).completed['quiz-1'],undefined,'undoing completion survives later mounts');
  assert.equal(JSON.parse(w.localStorage.getItem('mth141-progress-v1')).completed['quiz-1'],true);
  d.querySelector('.hub-theme').click();assert.equal(d.documentElement.dataset.theme,'dark','one theme action uses one surviving controller');
  console.log('routes ('+new URL(base).pathname+'): one document, real modules, hashes, history, focus, saved state and '+rounds+' round trips passed');
 }finally{dom.window.close();}
}
(async()=>{await checkDesk('off','completed');await checkDesk('on','sections');await checkDesk('off','fresh');await check('cen100/','cen100');await check('mth140/','mth140');await check('mth141/','mth141');await check('cen100/','cen100','on');await check('mth140/','mth140','on');await check('mth141/','mth141','on');await checkRoutes();await checkRoutes('https://guide.test/tmu-course-guides/')})().catch(e=>{console.error(e);process.exit(1)});
