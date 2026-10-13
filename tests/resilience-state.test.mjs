import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const require=createRequire(new URL('../tools/ui-build/package.json',import.meta.url));
const {JSDOM}=require('jsdom'),{buildSync}=require('esbuild');
const bundles=new Map();
function fixture(course){
 const file=course==='cen100'?'cen-guide':'math-guide';
 if(!bundles.has(file))bundles.set(file,buildSync({entryPoints:[fileURLToPath(new URL(`../assets/${file}.mjs`,import.meta.url))],bundle:true,write:false,format:'iife',globalName:'Guide',logLevel:'silent'}).outputFiles[0].text);
 const html=readFileSync(new URL(`../${course}/index.html`,import.meta.url),'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<link\b[^>]*>/gi,'');
 const dom=new JSDOM(html,{url:`https://guide.test/${course}/?motion=off`,runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window,d=w.document,NativeDate=w.Date;let now=NativeDate.parse('2026-10-13T16:00:00Z');
 w.Date=class extends NativeDate{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}};
 w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
 w.HTMLElement.prototype.scrollIntoView=()=>{};
 w.IntersectionObserver=class{observe(){}disconnect(){}};
 w.TextEncoder=TextEncoder;w.Blob=Blob;
 const intervals=new Map(),timeouts=new Map();let id=0;
 w.setInterval=fn=>{intervals.set(++id,fn);return id;};w.clearInterval=id=>intervals.delete(id);
 w.setTimeout=fn=>{timeouts.set(++id,fn);return id;};w.clearTimeout=id=>timeouts.delete(id);
 w.CourseWorkspace={refresh(){}};
 w.eval(bundles.get(file));
 const controller=new w.AbortController(),ctx={root:d.querySelector('main'),route:course,signal:controller.signal,direct:true};
 const storage=(key,value)=>{
  const previous=w.localStorage.getItem(key),raw=value===null?null:JSON.stringify(value);
  if(raw===null)w.localStorage.removeItem(key);else w.localStorage.setItem(key,raw);
  w.dispatchEvent(new w.StorageEvent('storage',{key,oldValue:previous,newValue:raw,storageArea:w.localStorage,url:`https://guide.test/${course}/`}));
 };
 return {w,d,ctx,storage,mount:()=>w.Guide.mount(ctx),unmount:()=>w.Guide.unmount(),setTime:value=>now=NativeDate.parse(value),close(){w.Guide.unmount();dom.window.close();}};
}

for(const course of ['mth140','mth141'])test(`${course} accepts another tab's completion, Undo and section without echoing storage writes`,()=>{
 const f=fixture(course);try{
  f.w.localStorage.setItem(`${course}-section-v1`,'31');f.mount();
  const select=f.d.querySelector('#section-select'),card=f.d.querySelector('#next-assessment'),before=card.dataset.nextId;
  assert(before,'there is an eligible assessment before the other tab completes it');
  let completionEvents=0,changes=0;f.d.addEventListener('guide-completion',()=>completionEvents++);select.addEventListener('change',()=>changes++);
  f.storage(`${course}-progress-v1`,{completed:{[before]:true},checks:{[before+'-0']:true},notes:{[before]:'Other tab'},targets:{[before]:'2026-10-14'},topics:{}});
  assert.notEqual(card.dataset.nextId,before,'another tab moves the live next card');
  assert.equal(f.d.querySelector(`[data-completed="${before}"]`).checked,true);
  assert.equal(f.d.querySelector(`[data-check="${before}-0"]`).checked,true);
  assert.equal(f.d.querySelector(`#note-${before}`).value,'Other tab');
  assert(completionEvents>0,'deadline and scene owners receive the new completion state');
  f.storage(`${course}-progress-v1`,{completed:{}});assert.equal(card.dataset.nextId,before,'Undo restores the eligible target');
  let writes=0;const storage=f.w.localStorage,prototype=Object.getPrototypeOf(storage),setItem=prototype.setItem;
  prototype.setItem=function(...args){writes++;return setItem.apply(this,args);};
  f.storage(`${course}-section-v1`,2);assert.equal(select.value,'2');assert.match(f.d.querySelector('#section-brief').textContent,/Section 2/);assert.equal(writes,1,'only the simulated source tab writes');assert.equal(changes,1,'section change reaches dock and workspace owners');
  f.unmount();const retired=select.value;f.storage(`${course}-section-v1`,31);assert.equal(select.value,retired,'retired route stops handling storage');
 }finally{f.close();}
});

test('CEN accepts another tab\'s completion, Undo and profile without echoing storage writes',()=>{
 const f=fixture('cen100');try{
  f.w.localStorage.setItem('cen100-contact-choice-v1',JSON.stringify({section:29,group:9}));f.mount();
  const card=f.d.querySelector('#nextsign'),before=card.dataset.schedule;assert.match(before,/^integrity:/);
  f.storage('cen100-personal-plan-v1',{completed:{integrity:1},notes:{y4:'Other tab'},targets:{y4:'2026-10-14'}});
  assert(!card.dataset.schedule.startsWith('integrity:'),'another tab moves the live next card');
  assert.equal(f.d.querySelector('[data-completion="integrity"]').checked,true);assert.equal(f.d.querySelector('#note-y4').value,'Other tab');
  f.storage('cen100-personal-plan-v1',{completed:{}});assert.equal(card.dataset.schedule,before,'Undo restores the eligible target');
  let writes=0;const prototype=Object.getPrototypeOf(f.w.localStorage),setItem=prototype.setItem;prototype.setItem=function(...args){writes++;return setItem.apply(this,args);};
  f.storage('cen100-contact-choice-v1',{section:30,group:13});
  assert.equal(f.d.querySelector('#contact-section').value,'30');assert.equal(f.d.querySelector('#contact-group').value,'13');assert.match(f.d.title,/Section 30, Group 13/);assert.equal(writes,1,'only the simulated source tab writes the profile');
 }finally{f.close();}
});

for(const course of ['cen100','mth140','mth141'])test(`${course} refreshes its card on persisted pageshow after the wall clock changes`,()=>{
 const f=fixture(course);try{
  if(course!=='cen100')f.w.localStorage.setItem(`${course}-section-v1`,'31');f.mount();
  const card=f.d.querySelector(course==='cen100'?'#nextsign':'#next-assessment'),before=course==='cen100'?card.dataset.schedule:card.dataset.nextId;
  f.setTime('2026-10-24T16:00:00Z');f.w.dispatchEvent(new f.w.PageTransitionEvent('pageshow',{persisted:true}));
  assert.notEqual(course==='cen100'?card.dataset.schedule:card.dataset.nextId,before,'restored document resolves the current deadline immediately');
  assert.equal(f.d.querySelectorAll(course==='cen100'?'#nextsign':'#next-assessment').length,1);
 }finally{f.close();}
});

test('Desk refreshes its visible deadline within one minute after a backwards clock jump at an exact minute',async()=>{
 const {createGuide,until}=require('./module-harness.cjs');
 let now=Date.parse('2026-10-14T18:30:00Z'),elapsed=0;
 const timers=new Map();
 const {dom,errors}=await createGuide({root:fileURLToPath(new URL('..',import.meta.url)),motion:'off',beforeParse(w){
  const NativeDate=w.Date,setTimeout=w.setTimeout.bind(w),clearTimeout=w.clearTimeout.bind(w);
  w.Date=class extends NativeDate{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}};
  w.setTimeout=(fn,delay,...args)=>{
   if(delay<60000)return setTimeout(fn,delay,...args);
   const handle={};timers.set(handle,{fn:()=>fn(...args),at:elapsed+delay});return handle;
  };
  w.clearTimeout=handle=>{if(!timers.delete(handle))clearTimeout(handle);};
 }});
 try{
  const chip=()=>dom.window.document.querySelector('[data-course-card="cen100"] .desk-chip')?.textContent;
  await until(()=>Boolean(chip()),'Desk did not paint its deadline');assert.deepEqual(errors,[]);assert.equal(chip(),'30m left');
  const scheduled=[...timers.values()].map(timer=>timer.at);
  now-=3600000;now+=60000;elapsed=60000;
  for(const [handle,timer] of [...timers])if(timer.at<=elapsed){timers.delete(handle);timer.fn();}
  assert.equal(chip(),'1h 29m left',`the semantic refresh must fire within 60000ms; scheduled delays: ${scheduled}`);
 }finally{dom.window.close();}
});
