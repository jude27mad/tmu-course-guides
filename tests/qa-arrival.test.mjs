import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from '../tools/ui-build/node_modules/esbuild/lib/main.js';
import {JSDOM} from '../tools/ui-build/node_modules/jsdom/lib/api.js';

const root = new URL('..', import.meta.url).pathname;
const bundle = build({
  stdin: {contents: "import * as motion from './assets/guide-motion.mjs'; import {gsap} from './assets/vendor/gsap-3.15.0.mjs'; window.qaMotion=motion; window.qaGsap=gsap;", resolveDir: root},
  bundle: true, write: false, format: 'iife', logLevel: 'silent'
});
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function fixture() {
  const dom = new JSDOM('<!doctype html><main class="wrap">Readable coursework</main>', {url: 'https://guide.test/', pretendToBeVisual: true, runScripts: 'outside-only'});
  const w = dom.window;
  w.matchMedia = () => ({matches: false, addEventListener() {}, removeEventListener() {}});
  w.eval((await bundle).outputFiles[0].text);
  await wait(20);
  return {dom, motion: w.qaMotion, gsap: w.qaGsap, page: w.document.querySelector('main')};
}

test('the existing .35-second arrival settles even when the animation clock stalls', async () => {
  const f = await fixture();
  try {
    const arrival = f.motion.enterPage(f.page);
    assert.equal(arrival.duration(), .35, 'the authored animation duration is unchanged');
    arrival.progress(.1);
    f.gsap.ticker.sleep(); // Reproduce slow-frame clock lag without changing application preferences.
    assert.notEqual(f.page.style.transform, '');
    await wait(420);
    assert.equal(arrival.progress(), 1, 'the public timeline completes, rather than being left killed midway');
    assert.equal(f.page.style.transform, '');
    assert.equal(f.page.style.opacity, '');
    assert.equal(f.page.style.filter, '');
  } finally { f.motion.setPaused(true); f.dom.window.close(); }
});

test('an old arrival deadline cannot complete a newer exit on the same owner', async () => {
  const f = await fixture();
  try {
    f.motion.enterPage(f.page);
    await wait(80);
    let completed = 0;
    const exit = f.motion.leavePage(f.page, () => completed++);
    exit.progress(.2);
    f.gsap.ticker.sleep();
    await wait(400);
    assert.equal(completed, 0, 'replacing the arrival cancels its deadline');
    assert.equal(exit.progress(), .2, 'the departing page still belongs to the new timeline');
    assert.notEqual(f.page.style.transform, '');
    f.motion.setPaused(true);
    assert.equal(completed, 1, 'normal owner cancellation still settles the exit exactly once');
  } finally { f.motion.setPaused(true); f.dom.window.close(); }
});
