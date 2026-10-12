import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const require=createRequire(new URL('../tools/ui-build/package.json',import.meta.url));
const {JSDOM}=require('jsdom');
const {build}=require('esbuild');
const bundled=await Promise.all(['math-guide','math-labs'].map(async name=>{
  const result=await build({entryPoints:[fileURLToPath(new URL(`../assets/${name}.mjs`,import.meta.url))],bundle:true,write:false,format:'iife',globalName:'window.routeModule',logLevel:'silent'});
  return result.outputFiles[0].text;
}));
const html=course=>fs.readFileSync(new URL(`../${course}/index.html`,import.meta.url),'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<link\b[^>]*>/gi,'');

function environment(course='mth140'){
  const dom=new JSDOM(html(course),{url:`https://guide.test/${course}/`,runScripts:'outside-only',pretendToBeVisual:true});
  const w=dom.window,d=w.document;
  const intervals=new Map(),timeouts=new Map(),frames=new Map(),observers=new Set(),media=[];
  const revoked=[];let nextId=0;
  w.setInterval=fn=>{const id=++nextId;intervals.set(id,fn);return id;};w.clearInterval=id=>intervals.delete(id);
  w.setTimeout=fn=>{const id=++nextId;timeouts.set(id,fn);return id;};w.clearTimeout=id=>timeouts.delete(id);
  w.requestAnimationFrame=fn=>{const id=++nextId;frames.set(id,fn);return id;};w.cancelAnimationFrame=id=>frames.delete(id);
  w.matchMedia=()=>{const target=new w.EventTarget();target.matches=false;media.push(target);return target;};
  w.MutationObserver=class {constructor(callback){this.callback=callback;}observe(){observers.add(this);}disconnect(){observers.delete(this);}};
  w.HTMLElement.prototype.scrollIntoView=()=>{};
  w.HTMLAnchorElement.prototype.click=()=>{};
  w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
  w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
  w.URL.createObjectURL=()=>`blob:guide-${++nextId}`;w.URL.revokeObjectURL=url=>revoked.push(url);
  let refreshes=0;
  w.CourseWorkspace={refresh(){refreshes++;}};
  w.GuideMotion={motionAllowed:()=>true,dialogOpen(){},dialogClose(dialog,done){done();},cancel(){}};
  const guide=()=>{w.eval(bundled[0]);return w.routeModule||{};};
  const labs=()=>{w.eval(bundled[1]);return w.routeModule||{};};
  const region=()=>d.querySelector('main');
  const context=(route=course)=>({root:region(),route,signal:new w.AbortController().signal,direct:true});
  const swap=route=>{const incoming=new w.DOMParser().parseFromString(html(route),'text/html').querySelector('main');region().replaceWith(d.importNode(incoming,true));w.history.replaceState(null,'',`/${route}/`);};
  const change=selector=>d.querySelector(selector).dispatchEvent(new w.Event('change',{bubbles:true}));
  return {dom,w,d,guide,labs,context,region,swap,change,intervals,timeouts,frames,observers,media,revoked,refreshes:()=>refreshes};
}
const seed=(w,course,section,note)=>{
  w.localStorage.setItem(`${course}-section-v1`,JSON.stringify(section));
  w.localStorage.setItem(`${course}-progress-v1`,JSON.stringify({checks:{'quiz-1-0':true},completed:{'quiz-1':true},notes:{'quiz-1':note},targets:{'quiz-1':'2026-10-18'},topics:{},unknown:true}));
};

test('math modules import without reading the DOM, saved state, or starting route resources',()=>{
  const e=environment();try{
    const before=e.region().innerHTML;
    let reads=0;const storage=Object.getPrototypeOf(e.w.localStorage),getItem=storage.getItem;storage.getItem=function(...args){reads++;return getItem.apply(this,args);};
    for(const get of [e.guide,e.labs]){
      const module=get();assert.equal(typeof module.mount,'function');assert.equal(typeof module.unmount,'function');
      assert.equal(e.region().innerHTML,before);assert.equal(e.d.querySelector('.lab-dialog'),null);
      assert.equal(e.intervals.size+e.timeouts.size+e.frames.size+e.observers.size,0);assert.equal(reads,0);
    }
  }finally{e.dom.window.close();}
});

test('one guide module restores separate course state and preserves release badges through math round trips',()=>{
  const e=environment();let module;try{
    module=e.guide();seed(e.w,'mth140',31,'Calculus note');seed(e.w,'mth141',28,'Algebra note');
    e.w.localStorage.setItem('mth140-last-seen-update-v1',JSON.stringify('2026-10-12-assessments2'));
    for(const route of ['mth140','mth141','mth140']){
      if(route!==e.w.location.pathname.split('/')[1])e.swap(route);
      // The body deliberately still says mth140: ctx.route is the route authority.
      module.mount(e.context(route));
      assert.equal(e.d.querySelector('#course-code').textContent,route.toUpperCase());
      assert.equal(e.d.querySelector('#section-select').value,route==='mth140'?'31':'28');
      assert.equal(e.d.querySelector('#note-quiz-1').value,route==='mth140'?'Calculus note':'Algebra note');
      assert.equal(e.d.querySelector('#target-quiz-1').value,'2026-10-18');
      assert(e.d.querySelector('[data-check="quiz-1-0"]').checked);assert(e.d.querySelector('[data-completed="quiz-1"]').checked);
      assert.equal(e.d.querySelector('#updates-badge').hidden,route==='mth140');
      assert.equal(e.intervals.size,1);
      module.unmount();assert.equal(e.intervals.size,0);
    }
  }finally{module?.unmount();e.dom.window.close();}
});

test('guide handlers act once on owned controls and stop on unmount even before the router aborts',()=>{
  const e=environment();let module;try{
    module=e.guide();module.mount(e.context());module.mount(e.context());
    const select=e.d.querySelector('#section-select');assert.equal(select.options.length,35);
    const before=e.refreshes();select.value='31';e.change('#section-select');assert.equal(e.refreshes()-before,1);
    const check=e.d.querySelector('[data-check="quiz-1-0"]');check.checked=true;e.change('[data-check="quiz-1-0"]');
    const saved=JSON.parse(e.w.localStorage.getItem('mth140-progress-v1'));assert.equal(saved.checks['quiz-1-0'],true);assert.deepEqual(saved.completed,{});
    // Matching data attributes outside this route must not edit its progress.
    const unrelated=e.d.createElement('input');unrelated.dataset.completed='midterm';unrelated.type='checkbox';unrelated.checked=true;e.d.body.append(unrelated);unrelated.dispatchEvent(new e.w.Event('change',{bubbles:true}));
    assert.deepEqual(JSON.parse(e.w.localStorage.getItem('mth140-progress-v1')).completed,{});
    module.unmount();const retired=e.refreshes();select.value='30';select.dispatchEvent(new e.w.Event('change',{bubbles:true}));e.d.dispatchEvent(new e.w.CustomEvent('course-open-item',{detail:'assessment-midterm'}));
    assert.equal(e.refreshes(),retired);assert.equal(e.intervals.size,0);assert.equal(e.d.querySelector('#assessment-midterm').open,false);
    module.mount(e.context());assert.equal(e.d.querySelector('#section-select').options.length,35);
    assert.equal(e.d.querySelector('#section-select').value,'31');
  }finally{module?.unmount();e.dom.window.close();}
});

test('guide preserves hash links and completion controls moved into an owned detail sheet',()=>{
  const e=environment();let module;try{
    e.w.history.replaceState(null,'','#assessment-quiz-1');module=e.guide();module.mount(e.context());
    assert(e.d.querySelector('#assessment-quiz-1').open);
    const row=e.d.querySelector('#assessment-quiz-1').closest('li'),sheet=e.d.createElement('dialog');e.d.body.append(sheet);sheet.append(row);
    const checkbox=row.querySelector('[data-completed]');checkbox.checked=true;checkbox.dispatchEvent(new e.w.Event('change',{bubbles:true}));
    assert.equal(JSON.parse(e.w.localStorage.getItem('mth140-progress-v1')).completed['quiz-1'],true);
    const note=row.querySelector('[data-note]');note.value='x'.repeat(2100);note.dispatchEvent(new e.w.Event('input',{bubbles:true}));
    assert.equal(JSON.parse(e.w.localStorage.getItem('mth140-progress-v1')).notes['quiz-1'].length,2000);
  }finally{module?.unmount();e.dom.window.close();}
});

test('unmount releases pending downloads and ignores backups completing for a retired route',async()=>{
  const e=environment();let module;try{
    module=e.guide();module.mount(e.context());e.d.querySelector('#backup-export').dispatchEvent(new e.w.MouseEvent('click',{bubbles:true}));
    assert.equal(e.timeouts.size,1);
    let finish;const text=new Promise(resolve=>finish=resolve),input=e.d.querySelector('#backup-import');
    Object.defineProperty(input,'files',{value:[{size:100,text:()=>text}]});e.change('#backup-import');module.unmount();
    assert.equal(e.timeouts.size,0);assert.equal(e.revoked.length,1);
    e.swap('mth141');module.mount(e.context('mth141'));
    finish(JSON.stringify({format:'tmu-math-guide',version:1,course:'mth140',progress:{completed:{midterm:true}}}));await Promise.resolve();await Promise.resolve();
    assert.equal(e.w.localStorage.getItem('mth141-progress-v1'),null);assert.equal(e.w.localStorage.getItem('mth140-progress-v1'),null);
    assert.equal(e.d.querySelector('#backup-status').textContent,'');
  }finally{module?.unmount();e.dom.window.close();}
});

test('labs remove expansion, topic observers, callbacks and animation frames across math mounts',()=>{
  const e=environment();let guide,labs;try{
    guide=e.guide();labs=e.labs();
    for(const route of ['mth140','mth141','mth140']){
      if(route!==e.w.location.pathname.split('/')[1])e.swap(route);
      guide.mount(e.context(route));labs.mount(e.context(route));
      const host=e.d.querySelector('#math-lab');assert(host);assert.equal(e.d.querySelectorAll('#math-lab').length,1);assert.equal(e.observers.size,1);
      assert.equal(host.querySelector('[data-lab]').dataset.lab,route==='mth140'?'transforms':'complex');
      host.querySelector(route==='mth140'?'[data-term-choice="2"]':'[data-preset="0"]').click();assert.equal(e.frames.size,1);
      host.querySelector('.lab-expand').click();assert(e.d.querySelector('.lab-dialog').open);assert(e.d.body.classList.contains('lab-open'));
      const retiredLink=e.d.querySelector('[data-open-lab]'),observer=[...e.observers][0];
      labs.unmount();assert.equal(e.frames.size,0);assert.equal(e.observers.size,0);assert.equal(e.d.querySelector('#math-lab,.lab-dialog,.topic-lab-link'),null);assert(!e.d.body.classList.contains('lab-open'));
      observer.callback();assert.equal(e.d.querySelector('.topic-lab-link'),null);
      e.d.body.append(retiredLink);retiredLink.click();assert.equal(e.d.querySelector('#math-lab'),null);retiredLink.remove();
      guide.unmount();
    }
  }finally{labs?.unmount();guide?.unmount();e.dom.window.close();}
});

test('composition playback and challenge state are released when the algebra lab unmounts',()=>{
  const e=environment('mth141');let guide,labs;try{
    guide=e.guide();labs=e.labs();guide.mount(e.context());labs.mount(e.context());
    e.d.querySelector('[data-lab="matrix"]').click();e.d.querySelector('[data-action="play"]').click();assert.equal(e.frames.size,1);
    labs.unmount();assert.equal(e.frames.size,0);
    // A media preference change must not call a disposed composition panel.
    for(const media of e.media){media.matches=true;media.dispatchEvent(new e.w.Event('change'));}
    labs.mount(e.context());e.d.querySelector('[data-mode="mistakes"]').click();e.d.querySelector('[data-challenge-line="1"]').click();
    assert(e.d.querySelector('.challenge-feedback').textContent.includes('Found it'));
    labs.unmount();labs.mount(e.context());e.d.querySelector('[data-mode="mistakes"]').click();
    assert(e.d.querySelector('.challenge-feedback').textContent.includes('Read it like a reviewer'));
  }finally{labs?.unmount();guide?.unmount();e.dom.window.close();}
});


test('aborting the route signal tears down guide and lab resources without a separate unmount call',()=>{
  const e=environment();let guide,labs;try{
    guide=e.guide();labs=e.labs();const controller=new e.w.AbortController(),ctx={...e.context(),signal:controller.signal};
    guide.mount(ctx);labs.mount(ctx);e.d.querySelector('[data-term-choice="2"]').click();e.d.querySelector('.lab-expand').click();
    controller.abort();assert.equal(e.intervals.size+e.frames.size+e.observers.size,0);assert.equal(e.d.querySelector('#math-lab,.lab-dialog'),null);
    const before=e.refreshes();e.d.querySelector('#section-select').dispatchEvent(new e.w.Event('change',{bubbles:true}));assert.equal(e.refreshes(),before);
    guide.mount(ctx);labs.mount(ctx);assert.equal(e.intervals.size,0);assert.equal(e.d.querySelector('#math-lab'),null);
  }finally{labs?.unmount();guide?.unmount();e.dom.window.close();}
});

test('invalid saved math state falls back without rewriting the stored values on mount',()=>{
  const e=environment();let guide;try{
    e.w.localStorage.setItem('mth140-section-v1','999');e.w.localStorage.setItem('mth140-progress-v1','invalid-json');
    guide=e.guide();guide.mount(e.context());assert.equal(e.d.querySelector('#section-select').value,'');assert(!e.d.querySelector('[data-completed="quiz-1"]').checked);
    assert.equal(e.w.localStorage.getItem('mth140-section-v1'),'999');assert.equal(e.w.localStorage.getItem('mth140-progress-v1'),'invalid-json');
  }finally{guide?.unmount();e.dom.window.close();}
});

test('remount resets transient search and quick-completion state while keeping saved progress',()=>{
  const e=environment();let guide;try{
    guide=e.guide();guide.mount(e.context());
    const search=e.d.querySelector('#guide-search');search.value='quiz';search.dispatchEvent(new e.w.Event('input',{bubbles:true}));assert(!e.d.querySelector('#guide-search-results').hidden);
    e.d.querySelector('[data-quick-complete]').click();assert(!e.d.querySelector('#quick-confirm').hidden);
    guide.unmount();guide.mount(e.context());
    assert.equal(search.value,'');assert(e.d.querySelector('#guide-search-results').hidden);assert.equal(e.d.querySelector('#search-status').textContent,'');assert(e.d.querySelector('#quick-confirm').hidden);
    assert(Object.keys(JSON.parse(e.w.localStorage.getItem('mth140-progress-v1')).completed).length>0);
  }finally{guide?.unmount();e.dom.window.close();}
});

test('a later visuals mount receives the current math schedule once and stops receiving it after unmount',()=>{
  const e=environment();let guide;try{
    guide=e.guide();guide.mount(e.context());const schedules=[];
    e.w.CourseVisuals={close(){},update(rows){schedules.push(rows);}};
    e.d.dispatchEvent(new e.w.Event('course-visuals-ready'));assert.equal(schedules.length,1);assert(schedules[0].some(row=>row.target==='assessment-midterm'));
    assert(schedules[0].every(row=>row.target.startsWith('assessment-')));
    guide.unmount();e.d.dispatchEvent(new e.w.Event('course-visuals-ready'));assert.equal(schedules.length,1);
  }finally{guide?.unmount();e.dom.window.close();}
});
