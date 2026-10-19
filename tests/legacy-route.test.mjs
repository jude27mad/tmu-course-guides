import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

/* Root compatibility: the old root CEN100 links must reach cen100/ exactly once, under either deployment base. */
const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const source=read('assets/legacy-route.js');
// A bare vm context has no DOM: loading only defines the pure functions.
const load=(globals={})=>{const context=vm.createContext({URL,...globals});vm.runInContext(source,context);return context;};
const {decide,siteBase,HASHES,QUERY_KEYS}=load().TMULegacyRoute;
const BASES=['http://127.0.0.1:4320/','https://jude27mad.github.io/tmu-course-guides/'];
const CEN_HASHES=['#assignment-y4','#assignment-m1','#assignment-y9','#assignment-z12','#assignments','#course-info','#guide-tools','#guide-search','#workspace-timeline','#nextsign','#board','#course-main','#t-team','#t-you','#t-rules','#p-team','#p-you','#p-rules','#guide-item-y4','#guide-item-m8'];
const DESK_HASHES=['','#','#top','#study','#math-lab','#math-tools','#math-main','#topic-limits','#assessment-quiz-1','#assessment-midterm','#Assignments','#assignment-','#assignment-y4x','#assignment-Y4','#assignments-old','#course-info/x','#guide-item-','#t-team2','#desk-main'];
const QUERIES=['','?','?motion=off','?motion=full&tier=low&v=3','?theme=dark&utm_source=mail%20list&q=a%2Fb','?to=https://evil.example/&redirect=//evil.example/cen100/'];

test('script source is a classic script with no module syntax',()=>{
  assert.doesNotMatch(source,/^\s*(import|export)\s/m);
  assert.doesNotThrow(()=>new vm.Script(source));
});

test('site base is the directory above assets/, for both the preview and Pages bases',()=>{
  assert.equal(siteBase('http://127.0.0.1:4320/assets/legacy-route.js?v=20261020-desk1'),'http://127.0.0.1:4320/');
  assert.equal(siteBase('https://jude27mad.github.io/tmu-course-guides/assets/legacy-route.js?v=20261020-desk1'),'https://jude27mad.github.io/tmu-course-guides/');
});

test('each allowlisted CEN hash forwards to <base>cen100/ with the entire query and hash',()=>{
  for(const base of BASES)for(const page of ['','index.html'])for(const query of QUERIES)for(const hash of CEN_HASHES){
    const to=decide(base+page+query+hash,base);
    assert.equal(to,base+'cen100/'+query+hash,`${base}${page}${query}${hash}`);
  }
});

test('Desk hashes and generic query flags alone stay on the Desk',()=>{
  assert.deepEqual([...QUERY_KEYS],[],'no CEN-specific query key exists (inventory §2)');
  for(const base of BASES)for(const page of ['','index.html'])for(const query of [...QUERIES,'?tier=low','?theme=dark','?motion=off','?course=cen100','?assignment=y4'])for(const hash of DESK_HASHES){
    assert.equal(decide(base+page+query+hash,base),null,`${base}${page}${query}${hash}`);
  }
});

test('forwarded URLs and every other route never forward again (no loop)',()=>{
  for(const base of BASES){
    for(const query of QUERIES)for(const hash of CEN_HASHES){const to=decide(base+query+hash,base);assert.ok(to);assert.equal(decide(to,base),null,to);}
    for(const page of ['cen100/','cen100/index.html','cen100','mth140/','mth141/','privacy.html','colour-preview.html','assets/'])assert.equal(decide(base+page+'#assignment-y4',base),null,page);
  }
});

test('the destination is always the fixed same-origin cen100/ under the base, never origin-root or query-supplied',()=>{
  const pages='https://jude27mad.github.io/tmu-course-guides/';
  // Origin root is outside the project base, so it is not the Desk and never forwards.
  assert.equal(decide('https://jude27mad.github.io/#assignment-y4',pages),null);
  assert.equal(decide('https://jude27mad.github.io/tmu-course-guides#assignment-y4',pages),null);
  assert.equal(decide('https://evil.example/tmu-course-guides/#assignment-y4',pages),null,'cross-origin');
  for(const query of ['?to=https://evil.example/','?next=//evil.example/x','?url=javascript:alert(1)','?cen100=https://evil.example/'])for(const base of BASES){
    const to=new URL(decide(base+query+'#assignment-y4',base));
    assert.equal(to.origin,new URL(base).origin);assert.equal(to.pathname,new URL(base).pathname+'cen100/');
  }
  assert.equal(decide('not a url','http://127.0.0.1:4320/'),null);
  assert.equal(decide('http://127.0.0.1:4320/#assignments','not a base'),null);
});

test('hash patterns match the inventory allowlist',()=>{
  assert.deepEqual([...HASHES].map(String),['/^#assignment-[a-z]\\d+$/','/^#(assignments|course-info|guide-tools|guide-search|workspace-timeline)$/','/^#(nextsign|board|course-main)$/','/^#(t|p)-(team|you|rules)$/','/^#guide-item-[a-z]\\d+$/']);
});

test('loaded on the Desk it replaces the location once; elsewhere it does nothing',()=>{
  for(const base of BASES){
    const calls=[],location={href:base+'?motion=off#assignment-y4',replace:href=>calls.push(href)};
    load({window:{location},document:{currentScript:{src:base+'assets/legacy-route.js?v=20261020-desk1'}}});
    assert.deepEqual(calls,[base+'cen100/?motion=off#assignment-y4']);
    const stay=[],desk={href:base+'?motion=off',replace:href=>stay.push(href)};
    load({window:{location:desk},document:{currentScript:{src:base+'assets/legacy-route.js'}}});
    const looped=[],cen={href:base+'cen100/?motion=off#assignment-y4',replace:href=>looped.push(href)};
    load({window:{location:cen},document:{currentScript:{src:base+'assets/legacy-route.js'}}});
    assert.deepEqual([...stay,...looped],[]);
  }
  const none=[];load({window:{location:{href:'http://127.0.0.1:4320/#assignments',replace:h=>none.push(h)}},document:{currentScript:null}});
  assert.deepEqual(none,[],'without its own script URL it cannot know the base, so it stays');
});

test('the Desk loads the forwarder synchronously first in <head>; CEN100 never loads it',()=>{
  const desk=read('index.html'),cen=read('cen100/index.html');
  const head=desk.slice(0,desk.indexOf('</head>'));
  const tag=head.match(/<script src="assets\/legacy-route\.js\?v=[\w-]+"><\/script>/);
  assert.ok(tag,'synchronous classic script');
  assert.equal(head.search(/<link rel="stylesheet"|<script/),head.indexOf(tag[0]),'before any stylesheet or other script');
  assert.doesNotMatch(cen,/legacy-route/);
  for(const page of ['mth140/index.html','mth141/index.html','privacy.html','colour-preview.html'])assert.doesNotMatch(read(page),/legacy-route/,page);
});

test('the Desk keeps plain links to all three guides and reuses no allowlisted id',()=>{
  const desk=read('index.html');
  assert.match(desk,/<body[^>]*data-page="desk"/);
  assert.doesNotMatch(desk,/<body[^>]*data-course=/,'no course identity on the Desk');
  for(const href of ['cen100/','mth140/','mth141/','privacy.html'])assert.match(desk,new RegExp(`href="${href}"`),href);
  assert.doesNotMatch(desk,/<noscript/i,'links do not depend on noscript');
  for(const [,id] of desk.matchAll(/\sid="([^"]+)"/g))assert.ok(!HASHES.some(re=>re.test('#'+id)),'Desk reuses allowlisted id '+id);
});
