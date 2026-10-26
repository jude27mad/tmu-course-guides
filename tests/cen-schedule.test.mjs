import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {SCHEDULE} from '../assets/cen-schedule.mjs';

/* The CEN100 schedule was extracted unchanged from the old root guide (commit 406c4a4, index.html:708–733). */
const BASELINE='406c4a4e8bb2e625328d2764a9cf8b5945644401';
// sha256 of JSON.stringify(original array), verified once against `git show 406c4a4:index.html`.
const ORIGINAL_SHA256='cfde80dad03cbe04e62e652cea0363ee91cb4c63cc725fbfa3f7c407e3751614';
const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const plain=value=>JSON.parse(JSON.stringify(value));

// Explicit course updates are projected back only for the historical extraction check.
// Everything outside these amended records and the new Part 2 record must stay unchanged.
function originalRecords() {
  return SCHEDULE.filter(row => row.id !== 'failure-2').map(row => {
    const copy = {...row};
    if (['intro', 'email', 'matlab-1'].includes(copy.id)) delete copy.time;
    if (copy.id === 'failure') {
      copy.title = 'Failure Analysis Labs: both parts due';
      delete copy.who; delete copy.weight; delete copy.note;
    }
    if (copy.id === 'prototype') return {id:'prototype',item:'m5',date:'2026-11-25',time:'15:00',title:'Low-Fidelity Prototype due'};
    if (copy.id === 'presentation-1') { copy.title = 'First Final Presentation'; copy.note = 'Confirm your assigned presentation time on D2L.'; }
    if (copy.id === 'presentation-2') { copy.title = 'Final Presentation and Innovation Showcase'; copy.note = 'Confirm your assigned presentation time on D2L.'; }
    return copy;
  });
}

test('the source review preserves every unrelated historical schedule record',()=>{
  assert.equal(SCHEDULE.length,25);
  assert.equal(createHash('sha256').update(JSON.stringify(originalRecords())).digest('hex'),ORIGINAL_SHA256);
});

test('unamended records deep-equal the pre-move root guide',t=>{
  let html;
  try{html=execFileSync('git',['show',BASELINE+':index.html'],{cwd:new URL('..',import.meta.url),encoding:'utf8',stdio:['ignore','pipe','ignore']});}
  catch{t.skip('baseline commit not in this checkout; the sha256 test still covers the records');return;}
  const literal=html.match(/\nconst SCHEDULE=(\[[\s\S]*?\n\]);\n/)[1];
  assert.deepEqual(plain(originalRecords()),plain(vm.runInNewContext('('+literal+')')));
});

test('October 13 update separates the 2% review and 4% FMEA without inventing times',()=>{
  const first=SCHEDULE.find(row=>row.id==='failure');
  const second=SCHEDULE.find(row=>row.id==='failure-2');
  assert.equal(first.item,'m3'); assert.equal(second.item,'m3');
  assert.equal(first.date,'2026-10-21'); assert.equal(second.date,'2026-10-28');
  assert.equal(first.weight,2); assert.equal(second.weight,4);
  assert.equal(first.who,'sub');
  assert.equal(first.time,undefined); assert.equal(second.time,undefined);
  for(const id of ['intro','email','matlab-1']) assert.equal(SCHEDULE.find(row=>row.id===id).time,'15:00');
});

test('one copy: pure module records also feed the asynchronous classic compatibility script',async()=>{
  assert.equal(globalThis.CEN_SCHEDULE,undefined,'importing data does not create a route global');
  const context=vm.createContext({moduleSchedule:SCHEDULE});context.window=context;
  // The legacy classic shim imports the canonical module asynchronously.
  const classic=read('assets/cen-schedule.js').replace(/import\(['"][^'"]+['"]\)/g,'Promise.resolve({SCHEDULE:moduleSchedule})');
  await vm.runInContext(classic,context);
  assert.deepEqual(plain(context.CEN_SCHEDULE),plain(SCHEDULE));
  // Already loaded by the CEN page: a second evaluation keeps the page's array instead of replacing it.
  const first=context.CEN_SCHEDULE;await vm.runInContext(classic,context);assert.equal(context.CEN_SCHEDULE,first);
  assert.doesNotMatch(read('assets/cen-schedule.js'),/^\s*(import|export)\s/m,'classic script');
  assert.equal((read('assets/cen-schedule.js').match(/\bdate:"\d{4}/g)||[]).length,0,'classic shim holds no second copy');
});

test('the CEN page mounts its guide first and keeps schedule/calendar code in the route module',()=>{
  const html=read('cen100/index.html');
  const scripts=[...html.matchAll(/<script\b[^>]*data-route-module[^>]*src="([^"]+)"[^>]*>/g)].map(match=>match[1]);
  assert.match(scripts[0]||'',/\/cen-guide\.mjs/,'CEN guide mounts before its enhancements');
  assert.doesNotMatch(html,/const SCHEDULE=window\.CEN_SCHEDULE|<script[^>]*src="[^\"]*cen-schedule\.js/,'no classic route script');
  assert.equal((html.match(/\{id:"integrity"/g)||[]).length,0,'no embedded schedule records');
  const guide=read('assets/cen-guide.mjs');
  assert.match(guide,/UID:cen100-f26-\$\{event\.id\}-jude27mad-github-io/,'calendar UIDs unchanged');
  assert.match(guide,/URL:https:\/\/jude27mad\.github\.io\/tmu-course-guides\/cen100\//,'calendar URL points at /cen100/');
  assert.match(html,/<body[^>]*data-course="cen100"/,'storage keys stay course-derived');
});

