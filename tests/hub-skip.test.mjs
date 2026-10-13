import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';

const require=createRequire(new URL('../tools/ui-build/package.json',import.meta.url));
const {JSDOM}=require('jsdom');
const source=readFileSync(new URL('../assets/hub.js',import.meta.url),'utf8');
function environment(route,base) {
  const path=route==='desk'?'index.html':`${route}/index.html`;
  const documentURL=`https://guide.test${base}${route==='desk'?'':route+'/'}`;
  const dom=new JSDOM(readFileSync(new URL('../'+path,import.meta.url),'utf8'),{url:documentURL,runScripts:'outside-only'});
  Object.defineProperty(dom.window.document,'currentScript',{configurable:true,value:{src:`https://guide.test${base}assets/hub.js`}});
  dom.window.eval(source);
  return dom;
}
function firstTabStop(document) {
  return [...document.querySelectorAll('a[href],button,input,select,textarea,[tabindex]')]
    .find(node=>node.tabIndex>=0&&!node.disabled&&!node.closest('[hidden],[inert]'));
}

for (const route of ['mth140','mth141']) test(`direct ${route} keeps Skip before the shared hub at both deployment bases`,()=>{
  for (const base of ['/','/tmu-course-guides/']) {
    const dom=environment(route,base);
    try {
      const document=dom.window.document,skip=document.querySelector('body>.skip-link');
      assert.ok(skip);
      assert.equal(firstTabStop(document),skip,'Skip remains the first native tab stop after hub initialization');
      firstTabStop(document).focus();
      assert.equal(document.activeElement,skip,'the first focusable element is the Skip link');
      assert.equal(skip.nextElementSibling,document.querySelector('.hub-shell'));
      assert.equal(new URL(skip.href).hash,'#math-main');
      assert.ok(document.querySelector(new URL(skip.href).hash),'Skip has its native course-content destination');
    } finally {dom.window.close();}
  }
});

test('Desk Skip and shell identity survive repeat initialization and route refresh',()=>{
  for (const base of ['/','/tmu-course-guides/']) {
    const dom=environment('desk',base);
    try {
      const window=dom.window,document=window.document,skip=document.querySelector('body>.skip-link'),hub=document.querySelector('.hub-shell');
      assert.equal(firstTabStop(document),skip);
      assert.equal(skip.nextElementSibling,hub);
      window.eval(source);
      assert.equal(document.querySelectorAll('.hub-shell').length,1);
      delete document.body.dataset.page;document.body.dataset.course='mth140';
      window.document.dispatchEvent(new window.CustomEvent('route-changed',{detail:{route:'mth140',from:'desk'}}));
      assert.equal(document.querySelector('.hub-shell'),hub);
      assert.equal(firstTabStop(document),skip);
      assert.equal(hub.querySelector('[aria-current="page"]').dataset.courseLink,'mth140');
    } finally {dom.window.close();}
  }
});
