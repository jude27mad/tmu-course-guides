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

test('extracted records are byte-for-byte the original records',()=>{
  assert.equal(SCHEDULE.length,24);
  assert.equal(createHash('sha256').update(JSON.stringify(SCHEDULE)).digest('hex'),ORIGINAL_SHA256);
});

test('extracted records deep-equal the array in the pre-move root guide',t=>{
  let html;
  try{html=execFileSync('git',['show',BASELINE+':index.html'],{cwd:new URL('..',import.meta.url),encoding:'utf8',stdio:['ignore','pipe','ignore']});}
  catch{t.skip('baseline commit not in this checkout; the sha256 test still covers the records');return;}
  const literal=html.match(/\nconst SCHEDULE=(\[[\s\S]*?\n\]);\n/)[1];
  assert.deepEqual(plain(SCHEDULE),plain(vm.runInNewContext('('+literal+')')));
});

test('one copy: the classic script feeds both window.CEN_SCHEDULE and the module export',()=>{
  const context=vm.createContext({});context.window=context;
  vm.runInContext(read('assets/cen-schedule.js'),context);
  assert.deepEqual(plain(context.CEN_SCHEDULE),plain(SCHEDULE));
  // Already loaded by the CEN page: a second evaluation keeps the page's array instead of replacing it.
  const first=context.CEN_SCHEDULE;vm.runInContext(read('assets/cen-schedule.js'),context);assert.equal(context.CEN_SCHEDULE,first);
  assert.equal(globalThis.CEN_SCHEDULE,SCHEDULE);
  assert.doesNotMatch(read('assets/cen-schedule.js'),/^\s*(import|export)\s/m,'classic script');
  assert.equal((read('assets/cen-schedule.mjs').match(/\bdate:"\d{4}/g)||[]).length,0,'module holds no second copy');
});

test('the CEN page loads the shared schedule before its inline script and keeps no copy of its own',()=>{
  const html=read('cen100/index.html');
  const shared=html.search(/<script src="\.\.\/assets\/cen-schedule\.js\?v=[\w-]+"><\/script>/),inline=html.indexOf('const SCHEDULE=window.CEN_SCHEDULE');
  assert.ok(shared>0&&inline>shared,'classic schedule script precedes the inline guide script');
  assert.equal((html.match(/\{id:"integrity"/g)||[]).length,0,'no embedded schedule records');
  assert.match(html,/UID:cen100-f26-\$\{event\.id\}-jude27mad-github-io/,'calendar UIDs unchanged');
  assert.match(html,/URL:https:\/\/jude27mad\.github\.io\/tmu-course-guides\/cen100\//,'calendar URL points at /cen100/');
  assert.match(html,/<body[^>]*data-course="cen100"/,'storage keys stay course-derived');
});
