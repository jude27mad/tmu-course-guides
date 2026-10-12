import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const require=createRequire(new URL('../tools/ui-build/package.json',import.meta.url));
const {JSDOM}=require('jsdom'),esbuild=require('esbuild');
const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const guidePath=fileURLToPath(new URL('../assets/cen-guide.mjs',import.meta.url));
let bundle;
function moduleSource(){
  assert.ok(existsSync(guidePath),'CEN guide has an explicit route lifecycle module');
  return bundle??=esbuild.buildSync({entryPoints:[guidePath],bundle:true,write:false,format:'iife',globalName:'CENGuide',logLevel:'silent'}).outputFiles[0].text;
}
function fixture(){
  const html=read('cen100/index.html').replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,'').replace(/<style\b[^>]*>[\s\S]*?<\/style>/g,'').replace(/<link\b[^>]*>/g,'');
  const dom=new JSDOM(html,{url:'https://guide.test/cen100/?motion=off',runScripts:'outside-only',pretendToBeVisual:true});
  const w=dom.window,d=w.document;
  const DateImpl=w.Date;
  w.Date=class extends DateImpl{constructor(...args){super(...(args.length?args:['2026-10-12T16:00:00Z']))}static now(){return DateImpl.parse('2026-10-12T16:00:00Z')}};
  w.TextEncoder=TextEncoder;w.Blob=Blob;w.confirm=()=>true;w.HTMLElement.prototype.scrollIntoView=()=>{};
  const intervals=new Set(),timeouts=new Set(),observers=new Set(),urls=new Set(),downloads=[];
  w.setInterval=fn=>{const id={fn};intervals.add(id);return id};w.clearInterval=id=>intervals.delete(id);
  w.setTimeout=fn=>{const id={fn};timeouts.add(id);return id};w.clearTimeout=id=>timeouts.delete(id);
  w.IntersectionObserver=class{constructor(fn){this.fn=fn;observers.add(this)}observe(){}disconnect(){observers.delete(this)}};
  w.URL.createObjectURL=blob=>{const url='blob:test-'+downloads.length;urls.add(url);downloads.push(blob);return url};
  w.URL.revokeObjectURL=url=>urls.delete(url);w.HTMLAnchorElement.prototype.click=function(){};
  w.localStorage.setItem('cen100-g9-ticks',JSON.stringify({'y4-0-0':1}));
  w.localStorage.setItem('cen100-contact-choice-v1',JSON.stringify({section:29,group:9}));
  w.localStorage.setItem('cen100-personal-plan-v1',JSON.stringify({completed:{integrity:1},notes:{y4:'Existing note'},targets:{y4:'2026-10-13'}}));
  const root=d.querySelector('[data-route-region],.wrap');
  return {dom,w,d,root,intervals,timeouts,observers,urls,downloads};
}
function loadGuide(f){
  f.w.eval(moduleSource());
  const controller=new f.w.AbortController();
  f.w.CENGuide.mount({root:f.root,route:'cen100',signal:controller.signal,direct:true});
  return controller;
}
function change(f,selector,value){const el=f.d.querySelector(selector);if(typeof value==='boolean')el.checked=value;else el.value=value;el.dispatchEvent(new f.w.Event('change',{bubbles:true}));return el}

test('CEN preserves saved ticks, personal records, profile and all assessment handles',()=>{
  const f=fixture();try{
    loadGuide(f);
    assert.equal(f.d.querySelectorAll('.tile').length,17);
    assert(f.d.querySelector('input[data-k="y4-0-0"]').checked);
    assert(f.d.querySelector('input[data-completion="integrity"]').checked);
    assert.equal(f.d.querySelector('#note-y4').value,'Existing note');
    assert.equal(f.d.querySelector('#target-y4').value,'2026-10-13');
    assert.equal(f.d.querySelector('#contact-section').value,'29');
    assert.equal(f.d.querySelector('#contact-group').value,'9');
    assert.match(f.d.title,/CEN100 Section 29, Group 9/);
    assert.equal(f.d.querySelectorAll('#contact-section option').length,40);
    assert.equal(f.w.CEN_SCHEDULE.find(e=>e.id==='integrity').time,'15:00');
    change(f,'input[data-k="y4-0-0"]',false);
    assert.deepEqual(JSON.parse(f.w.localStorage.getItem('cen100-g9-ticks')),{});
    assert.equal(JSON.parse(f.w.localStorage.getItem('cen100-personal-plan-v1')).completed.integrity,1,'checklist progress remains separate from completion');
    change(f,'input[data-completion="integrity"]',false);
    assert.deepEqual(JSON.parse(f.w.localStorage.getItem('cen100-personal-plan-v1')).completed,{});
  }finally{f.w.CENGuide?.unmount();f.dom.window.close()}
});

test('CEN search, deep links, filters, calendar identifiers and Mark done/Undo retain their behavior',async()=>{
  const f=fixture();try{
    loadGuide(f);
    const search=f.d.querySelector('#guide-search');search.value='integrity';search.dispatchEvent(new f.w.Event('input',{bubbles:true}));
    assert(f.d.querySelectorAll('#guide-search-results li').length>0);
    change(f,'#hide-completed',true);assert(f.d.querySelector('#guide-item-y4').hidden);
    f.d.dispatchEvent(new f.w.CustomEvent('course-open-item',{detail:'y4'}));
    assert(!f.d.querySelector('#guide-item-y4').hidden);assert(!f.d.querySelector('#b-y4').hidden);
    assert.equal(f.d.activeElement,f.d.querySelector('#guide-item-y4 .head'));
    f.w.history.replaceState(null,'','#assignment-m3');f.w.dispatchEvent(new f.w.Event('hashchange'));
    assert(!f.d.querySelector('#b-m3').hidden);
    change(f,'#contact-section','31');
    const mark=f.d.querySelector('[data-quick-complete]'),id=mark.dataset.quickComplete;mark.click();
    assert.equal(JSON.parse(f.w.localStorage.getItem('cen100-personal-plan-v1')).completed[id],1);
    assert(!f.d.querySelector('#quick-confirm').hidden);
    f.d.querySelector('#undo-complete').click();
    assert(!JSON.parse(f.w.localStorage.getItem('cen100-personal-plan-v1')).completed[id]);
    change(f,'#calendar-item','y4');change(f,'#calendar-upcoming',false);f.d.querySelector('#calendar-download').click();
    const text=await f.downloads.at(-1).text();
    assert.match(text,/UID:cen100-f26-integrity-jude27mad-github-io/);
    assert.match(text,/DTSTART:20261014T190000Z/);
    assert.match(text,/URL:https:\/\/jude27mad\.github\.io\/tmu-course-guides\/cen100\//);
  }finally{f.w.CENGuide?.unmount();f.dom.window.close()}
});

test('importing the guide is inert until mount',()=>{
  const f=fixture();try{
    const html=f.root.innerHTML,title=f.d.title;
    f.w.eval(moduleSource());
    assert.equal(f.root.innerHTML,html);assert.equal(f.d.title,title);
    assert.equal(f.w.CEN_SCHEDULE,undefined);
    for(const name of ['renderTop','counts','setupContactLookup','torontoToday'])assert.equal(f.w[name],undefined,'guide helpers do not become window globals');
    assert.equal(f.intervals.size,0);assert.equal(f.timeouts.size,0);assert.equal(f.observers.size,0);
    assert.equal(typeof f.w.CENGuide.mount,'function');assert.equal(typeof f.w.CENGuide.unmount,'function');
  }finally{f.dom.window.close()}
});

test('repeated CEN mount/unmount disposes every route owner and avoids duplicate action handlers',()=>{
  const f=fixture();try{
    f.w.eval(moduleSource());
    const original=f.root.innerHTML;
    for(let i=0;i<3;i++){
      const controller=new f.w.AbortController();
      f.w.CENGuide.mount({root:f.root,route:'cen100',signal:controller.signal,direct:i===0});
      assert.equal(f.intervals.size,1);assert.equal(f.observers.size,1);
      assert.equal(f.d.querySelectorAll('#teamlist-empty').length,1);assert.equal(f.d.querySelectorAll('#personal-y4').length,1);
      assert.equal(f.d.querySelectorAll('#contact-section option').length,40);
      change(f,'#contact-section','31');
      const mark=f.d.querySelector('[data-quick-complete]'),id=mark.dataset.quickComplete;
      let writes=0;const originalSet=f.w.Storage.prototype.setItem;
      f.w.Storage.prototype.setItem=function(key,value){if(key==='cen100-personal-plan-v1')writes++;return originalSet.call(this,key,value)};
      mark.click();assert.equal(writes,1,'one Mark done action writes one completion');
      f.d.querySelector('#undo-complete').click();assert.equal(writes,2);
      f.w.Storage.prototype.setItem=originalSet;
      f.d.querySelector('#backup-export').click();assert.equal(f.timeouts.size,1);assert.equal(f.urls.size,1);
      const timers=[...f.intervals,...f.timeouts],observers=[...f.observers];
      const checkbox=f.d.querySelector('input[data-k]'),saved=f.w.localStorage.getItem('cen100-g9-ticks');
      i===1?controller.abort():f.w.CENGuide.unmount();
      assert.equal(f.intervals.size,0);assert.equal(f.timeouts.size,0);assert.equal(f.observers.size,0);assert.equal(f.urls.size,0);
      assert.equal(f.w.CEN_SCHEDULE,undefined);assert.equal(f.root.innerHTML,original);
      checkbox.checked=!checkbox.checked;checkbox.dispatchEvent(new f.w.Event('change',{bubbles:true}));
      f.d.dispatchEvent(new f.w.CustomEvent('course-open-item',{detail:'y4'}));f.w.dispatchEvent(new f.w.Event('focus'));
      for(const timer of timers)timer.fn();for(const observer of observers)observer.fn([{isIntersecting:false}]);
      assert.equal(f.w.localStorage.getItem('cen100-g9-ticks'),saved,'detached outgoing controls cannot mutate progress');
      assert.equal(f.root.innerHTML,original,'outgoing global listeners do not rerender the disposed route');
      f.w.CENGuide.unmount();
    }
  }finally{f.w.CENGuide?.unmount();f.dom.window.close()}
});

test('CEN owns its assessment controls when visuals moves a row outside the route region',()=>{
  const f=fixture();try{
    loadGuide(f);
    const row=f.d.querySelector('#guide-item-y4');
    const foreign=f.d.createElement('button');foreign.className='head';foreign.setAttribute('aria-controls','b-y4');foreign.setAttribute('aria-expanded','false');f.d.body.append(foreign);
    foreign.click();assert.equal(foreign.getAttribute('aria-expanded'),'false','unrelated route controls are ignored');
    f.d.body.append(row);
    let updates=0,closed=0;
    f.w.CourseVisuals={update(events){updates++;assert(events.some(event=>event.target==='y4'))},close(){closed++;f.d.querySelector('#youlist').append(row)}};
    change(f,'#guide-item-y4 input[data-k="y4-0-0"]',false);
    assert.deepEqual(JSON.parse(f.w.localStorage.getItem('cen100-g9-ticks')),{});
    change(f,'#guide-item-y4 input[data-completion="integrity"]',false);
    assert(!JSON.parse(f.w.localStorage.getItem('cen100-personal-plan-v1')).completed.integrity);
    assert(updates>0,'completion still updates the route visual schedule');
    f.w.CENGuide.unmount();assert.equal(closed,1,'the moved row is closed and restored during cleanup');
    assert(!row.isConnected,'restored static route DOM contains no stale generated row');
  }finally{f.w.CENGuide?.unmount();f.dom.window.close()}
});

test('an unfinished backup read cannot alter a remounted CEN route',async()=>{
  const f=fixture();try{
    loadGuide(f);
    let finish;
    const input=f.d.querySelector('#backup-import'),pending=new Promise(resolve=>{finish=resolve});
    Object.defineProperty(input,'files',{value:[{size:100,text:()=>pending}]});
    input.dispatchEvent(new f.w.Event('change',{bubbles:true}));
    const ticks=f.w.localStorage.getItem('cen100-g9-ticks'),plan=f.w.localStorage.getItem('cen100-personal-plan-v1');
    f.w.CENGuide.unmount();
    f.w.CENGuide.mount({root:f.root,route:'cen100',signal:new f.w.AbortController().signal,direct:false});
    finish(JSON.stringify({format:'cen100-guide-backup',version:2,ticks:{'m1-0-0':1},personal:{completed:{whmis:1},notes:{y4:'Late backup'},targets:{}}}));
    await pending;await Promise.resolve();
    assert.equal(f.w.localStorage.getItem('cen100-g9-ticks'),ticks);
    assert.equal(f.w.localStorage.getItem('cen100-personal-plan-v1'),plan);
    assert.equal(f.d.querySelector('#note-y4').value,'Existing note');
    assert.equal(f.d.querySelector('#backup-status').textContent,'');
  }finally{f.w.CENGuide?.unmount();f.dom.window.close()}
});

test('CEN remains usable when access to local storage itself is denied',()=>{
  const f=fixture();try{
    Object.defineProperty(f.w,'localStorage',{get(){throw new f.w.DOMException('Denied','SecurityError')}});
    loadGuide(f);
    assert.equal(f.d.querySelectorAll('.tile').length,17);
    assert.equal(f.d.querySelector('#contact-section').value,'');
    change(f,'input[data-k="y4-0-0"]',true);
    assert(f.d.querySelector('input[data-k="y4-0-0"]').checked);
    assert(!f.d.querySelector('input[data-completion="integrity"]').checked);
  }finally{f.w.CENGuide?.unmount();f.dom.window.close()}
});

test('the colour preview initializes its guide before applying preview controls',()=>{
  const source=read('colour-preview.html');
  const html=source.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,'').replace(/<style\b[^>]*>[\s\S]*?<\/style>/g,'').replace(/<link\b[^>]*>/g,'');
  const dom=new JSDOM(html,{url:'https://guide.test/colour-preview.html?accent=mint&background=light',runScripts:'outside-only'});
  const w=dom.window;w.HTMLElement.prototype.scrollIntoView=()=>{};
  w.setInterval=()=>0;w.IntersectionObserver=class{observe(){}disconnect(){}};
  try{
    const scripts=[...source.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)];
    // Classic scripts run during parsing; ordinary modules run afterward in document order.
    for(const [,attrs,script] of scripts)if(!attrs.includes('type="module"'))w.eval(script);
    for(const [,attrs,script] of scripts)if(attrs.includes('type="module"')){
      const text=esbuild.buildSync({stdin:{contents:script,resolveDir:fileURLToPath(new URL('..',import.meta.url))},bundle:true,write:false,format:'iife',logLevel:'silent'}).outputFiles[0].text;
      w.eval(text);
    }
    assert.equal(w.document.querySelectorAll('.tile').length,17);
    assert.equal(w.document.querySelector('#profile-picker').open,false,'preview starts with its picker closed');
    assert.equal(w.document.documentElement.dataset.theme,'light');
    assert.match(w.document.querySelector('#palette-selection').textContent,/Mint/);
    assert.equal(w.CEN_SCHEDULE,undefined,'preview data import creates no route global');
  }finally{w.close()}
});
