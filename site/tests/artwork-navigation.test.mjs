import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import gsapPackage from 'gsap';

const { gsap } = gsapPackage;
const require = createRequire(import.meta.url);

test('preparing the menu during a page transition preserves the navbar reveal', async () => {
  // Execute the production helper with real GSAP. Normalize only its bundler
  // default import for Node's CommonJS interop; targets need no browser CSS to
  // reproduce GSAP's eager overwrite of an unrelated, still-running timeline.
  const source = (await readFile(new URL('../src/components/dom/navbar/panelShell.js', import.meta.url), 'utf8'))
    .replace("import gsap from 'gsap';", `import { gsap } from '${pathToFileURL(require.resolve('gsap')).href}';`);
  const { buildShellTimeline } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  const header = { autoAlpha: 0, left: 0, top: 0, scale: 1, willChange: 'auto' };
  const main = { borderRadius: 0, border: 'none', scale: 1, pointerEvents: 'auto', left: 0, willChange: 'auto' };
  const layout = { opacity: 1, height: '100%' };
  const previousDocument = globalThis.document;
  globalThis.document = {
    getElementById: id => id === 'layout' ? layout : null,
    querySelector: selector => selector === 'header' ? header : main,
  };
  const route = gsap.timeline({ paused: true }).to(header, { autoAlpha: 1, duration: 0.4 });
  route.progress(0.25);
  let shell;
  try {
    shell = buildShellTimeline({ isMobile: false });
    assert.equal(route.getChildren().length, 1, 'a paused menu must not cancel the route reveal');
    route.progress(1);
    assert.equal(header.autoAlpha, 1, 'the navbar becomes visible after the route enters');
    shell.progress(1);
    assert.equal(header.autoAlpha, 0, 'opening the menu still hides the navbar');
    shell.progress(0);
    assert.equal(header.autoAlpha, 1, 'closing the menu restores the navbar');
  } finally {
    shell?.kill();
    route.kill();
    gsap.killTweensOf([header, main, layout]);
    gsap.ticker.sleep();
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  }
});
