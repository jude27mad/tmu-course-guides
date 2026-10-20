// R4 throwaway probe: browser UI find via actual X11 keyboard input.
// Requires a headed Chromium, DISPLAY, xdotool, and a running spike export server.
// PLAYWRIGHT_PATH=/path/to/playwright XDOTOOL_PATH=/path/to/xdotool node scripts/spike-native-find-measurements.mjs
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const xdotool = process.env.XDOTOOL_PATH || 'xdotool';
const url = process.env.SPIKE_URL || 'http://127.0.0.1:4174/tmu-course-guides/next/spike/?motion=off&width=1000&accordion=no-js-safe';
const output = resolve(process.env.NATIVE_FIND_REPORT || '../docs/codex/remove-repetition/reports/r4-evidence/native-find.json');
const results = {
  method: 'Headed Chromium native browser Ctrl+F, typed with xdotool X11 input; no synthetic beforematch dispatch or window.find.',
  url,
  display: process.env.DISPLAY,
  query: 'R4PANELBRAVO',
};
let browser;

async function panelState(page) {
  return page.evaluate(() => {
    const panel = document.querySelector('[data-spike-panel="bravo"]');
    const trigger = document.querySelector('[data-spike-trigger="bravo"]');
    return {
      hidden: panel.getAttribute('hidden'),
      state: panel.getAttribute('data-state'),
      display: getComputedStyle(panel).display,
      contentVisibility: getComputedStyle(panel).contentVisibility,
      expanded: trigger.getAttribute('aria-expanded'),
      beforematchCount: Number(document.querySelector('[data-spike-beforematch-count]').textContent),
      trustedBeforematchCount: Number(document.querySelector('[data-spike-trusted-beforematch-count]').textContent),
      nativeEvents: window.r4NativeBeforematch,
    };
  });
}

async function nativeFind(page) {
  const windowIds = execFileSync(xdotool, ['search', '--onlyvisible', '--class', 'chromium'], { encoding: 'utf8' }).trim().split(/\s+/);
  execFileSync(xdotool, ['windowfocus', '--sync', windowIds[0]]);
  execFileSync(xdotool, ['key', '--clearmodifiers', 'ctrl+f']);
  execFileSync(xdotool, ['key', '--clearmodifiers', 'ctrl+a']);
  execFileSync(xdotool, ['type', '--clearmodifiers', '--delay', '40', results.query]);
  execFileSync(xdotool, ['key', 'Return']);
  await page.waitForTimeout(1500);
  const after = await panelState(page);
  execFileSync(xdotool, ['key', 'Escape']);
  return { windowIds, after };
}

async function isolatedControl(page, control) {
  await page.goto('about:blank');
  const hidden = control.parsedToken ? 'hidden="until-found"' : '';
  await page.setContent(`<html><head><style>${control.css}</style></head><body>
    <div data-spike-panel="bravo" data-state="closed" ${hidden}>R4PANELBRAVO isolated hidden text</div>
    <button data-spike-trigger="bravo" aria-expanded="false">Panel</button>
    <output data-spike-beforematch-count>0</output><output data-spike-trusted-beforematch-count>0</output>
    </body></html>`);
  const setup = await page.evaluate(({ dynamicToken, temporaryVisibleReset }) => {
    const panel = document.querySelector('[data-spike-panel]');
    window.r4NativeBeforematch = [];
    const initialContentVisibility = getComputedStyle(panel).contentVisibility;
    if (dynamicToken) {
      if (temporaryVisibleReset) {
        panel.style.contentVisibility = 'visible';
        // This read intentionally forces a visible style before adding the token.
        getComputedStyle(panel).contentVisibility;
      }
      panel.setAttribute('hidden', 'until-found');
      if (temporaryVisibleReset) panel.style.contentVisibility = '';
    }
    document.addEventListener('beforematch', (event) => {
      if (event.target !== panel) return;
      window.r4NativeBeforematch.push({ isTrusted: event.isTrusted, panel: event.target.getAttribute('data-spike-panel') });
      document.querySelector('[data-spike-trigger]').setAttribute('aria-expanded', 'true');
      document.querySelector('[data-spike-beforematch-count]').textContent = '1';
      document.querySelector('[data-spike-trusted-beforematch-count]').textContent = event.isTrusted ? '1' : '0';
      panel.setAttribute('data-state', 'open');
    });
    return { initialContentVisibility, afterTokenContentVisibility: getComputedStyle(panel).contentVisibility };
  }, control);
  const before = await panelState(page);
  const { after } = await nativeFind(page);
  return { ...control, setup, before, after, revealedByNativeFind: after.expanded === 'true' && after.trustedBeforematchCount > before.trustedBeforematchCount };
}

try {
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
    headless: false,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--window-size=1440,1000'],
  });
  results.browser = browser.version();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    window.r4NativeBeforematch = [];
    document.addEventListener('beforematch', (event) => {
      window.r4NativeBeforematch.push({
        isTrusted: event.isTrusted,
        panel: event.target.getAttribute('data-spike-panel'),
      });
    }, true);
  });
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.querySelector('[data-spike-panel="bravo"]')?.getAttribute('hidden') === 'until-found');
  await page.waitForFunction(() => getComputedStyle(document.querySelector('main')).opacity === '1');
  results.before = await panelState(page);
  Object.assign(results, await nativeFind(page));
  results.revealedByNativeFind = results.after.expanded === 'true' && results.after.trustedBeforematchCount > results.before.trustedBeforematchCount;
  const reset = '*{all:unset;display:revert}';
  const stateHidden = '[data-state=closed]{content-visibility:hidden;display:block}';
  const tokenHidden = '[data-state=closed]:not([hidden]),[hidden=until-found]{content-visibility:hidden;display:block}';
  results.controls = [];
  for (const control of [
    { name: 'parsed-token-with-reset-and-state-css', parsedToken: true, css: reset + stateHidden },
    { name: 'parsed-token-with-reset-and-token-css', parsedToken: true, css: reset + tokenHidden },
    { name: 'dynamic-token-after-computing-hidden-state-css', dynamicToken: true, css: reset + stateHidden },
    { name: 'dynamic-token-after-computing-hidden-token-css', dynamicToken: true, css: reset + tokenHidden },
    { name: 'dynamic-token-from-visible-control', dynamicToken: true, css: '' },
    { name: 'dynamic-token-with-temporary-visible-style-reset', dynamicToken: true, temporaryVisibleReset: true, css: reset + tokenHidden },
  ]) {
    results.controls.push(await isolatedControl(page, control));
  }
  results.controlLimitation = 'Isolated DOM controls diagnose the observed style/token sequence. The temporary visible-style reset was not integrated into Radix or proposed as a proven production fix.';
} catch (error) {
  results.error = error.stack;
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(results, null, 2)}\n`);
  console.log(JSON.stringify(results, null, 2));
}
