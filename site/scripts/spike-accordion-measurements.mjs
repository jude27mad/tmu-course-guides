// Disposable R4 measurements against the built export. No synthetic beforematch
// events are dispatched. Browser-UI Ctrl+F is measured by the separate headed
// spike-native-find-measurements.mjs; this script records window.find and native
// text-fragment navigation separately.
// PLAYWRIGHT_PATH=/tmp/r4-playwright/node_modules/playwright/index.mjs \
//   PLAYWRIGHT_BROWSERS_PATH=/tmp/r4-pw-browsers \
//   node site/scripts/spike-accordion-measurements.mjs http://127.0.0.1:PORT/tmu-course-guides/next/spike/
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const { chromium, webkit } = await import(pathToFileURL(process.env.PLAYWRIGHT_PATH || '/tmp/r4-playwright/node_modules/playwright/index.mjs').href);
const target = process.argv[2] || process.env.SPIKE_URL;
if (!target) throw new Error('Pass the URL of the exported /spike/ page.');
const output = process.argv[3] || resolve(dirname(fileURLToPath(import.meta.url)), '../../docs/codex/remove-repetition/reports/r4-evidence/accordion.json');
const modes = ['naive', 'until-found', 'no-js-safe'];
const panelIds = ['alpha', 'bravo', 'charlie'];
const term = 'R4PANELBRAVO';
const results = {
  measuredAt: new Date().toISOString(),
  target,
  method: 'Actual exported page, browser-native window.find and text fragments; no dispatched beforematch events.',
  browserUiFind: 'Measured separately by spike-native-find-measurements.mjs using a headed browser under Xvfb and native xdotool Ctrl+F input; see native-find.json. window.find below is a different API.',
  caveat: 'Playwright WebKit is not iPhone Safari. These measurements do not replace a real iPhone test.',
  browsers: {},
};

function urlFor(mode, hash = '') {
  const url = new URL(target);
  url.searchParams.set('accordion', mode);
  url.searchParams.set('motion', 'off');
  url.hash = hash;
  return url.href;
}

async function snapshot(page) {
  return page.evaluate(() => ({
    jsMarker: document.documentElement.classList.contains('js'),
    mode: document.querySelector('[data-spike-accordion]')?.getAttribute('data-mode'),
    beforematchSupported: 'onbeforematch' in document.documentElement,
    contentVisibilitySupported: CSS.supports('content-visibility', 'hidden'),
    beforematchCount: document.querySelector('[data-spike-beforematch-count]')?.textContent,
    trustedBeforematchCount: document.querySelector('[data-spike-trusted-beforematch-count]')?.textContent,
    nativeEvents: window.spikeNativeBeforematch || [],
    selection: window.getSelection()?.toString(),
    mainScrollTop: document.querySelector('main')?.scrollTop,
    documentScrollTop: document.scrollingElement?.scrollTop,
    panels: [...document.querySelectorAll('[data-spike-panel]')].map((panel) => ({
      id: panel.getAttribute('data-spike-panel'),
      text: panel.textContent,
      hiddenAttribute: panel.getAttribute('hidden'),
      hiddenProperty: panel.hidden,
      state: panel.getAttribute('data-state'),
      display: getComputedStyle(panel).display,
      contentVisibility: getComputedStyle(panel).contentVisibility,
      height: panel.getBoundingClientRect().height,
      top: panel.getBoundingClientRect().top,
      textHeight: panel.querySelector('p').getBoundingClientRect().height,
      expanded: document.querySelector(`[data-spike-trigger="${panel.getAttribute('data-spike-panel')}"]`)?.getAttribute('aria-expanded'),
    })),
  }));
}

async function jsPage(browser, mode) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  await context.addInitScript(() => {
    window.spikeNativeBeforematch = [];
    document.addEventListener('beforematch', (event) => {
      window.spikeNativeBeforematch.push({
        trusted: event.isTrusted,
        panel: event.target.getAttribute('data-spike-panel'),
        hidden: event.target.getAttribute('hidden'),
      });
    }, true);
  });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.setDefaultTimeout(15000);
  await page.goto(urlFor(mode), { waitUntil: 'networkidle' });
  await page.waitForFunction((expected) => document.querySelector('[data-spike-accordion]')?.getAttribute('data-mode') === expected, mode);
  await page.waitForTimeout(150);
  return { context, page, pageErrors };
}

async function measureBrowser(name, browserType, launchOptions) {
  const result = { modes: {} };
  results.browsers[name] = result;
  let browser;
  try {
    browser = await browserType.launch(launchOptions);
    result.version = browser.version();
    for (const mode of modes) {
      console.log(`Measuring ${name} accordion mode ${mode}`);
      const item = {};
      result.modes[mode] = item;
      try {
        const { context, page, pageErrors } = await jsPage(browser, mode);
        item.pageErrors = pageErrors;
        try {
          item.initial = await snapshot(page);
          item.windowFind = {
            returnValue: await page.evaluate((text) => (typeof window.find === 'function' ? window.find(text, false, false, true) : null), term),
          };
          await page.waitForTimeout(400);
          item.windowFind.after = await snapshot(page);
          await page.locator('[data-spike-expand-all]').click();
          item.expandAll = await snapshot(page);
          await page.locator('[data-spike-collapse-all]').click();
          item.collapseAll = await snapshot(page);
          await page.evaluate(() => window.getSelection()?.removeAllRanges());
          // Native link activation gives text fragments their normal user
          // activation. This tests actual browser reveal behavior, not a fake
          // beforematch event or merely calling the application's handler.
          const fragmentUrl = urlFor(mode, `:~:text=${term}`);
          await page.evaluate((href) => {
            const link = document.createElement('a');
            link.id = 'spike-native-text-fragment-link';
            link.href = href;
            link.textContent = 'Run native text-fragment probe';
            document.querySelector('[data-spike-accordion]').prepend(link);
          }, fragmentUrl);
          await page.locator('#spike-native-text-fragment-link').click();
          await page.waitForTimeout(700);
          item.textFragmentLink = await snapshot(page);
          item.textFragmentLink.location = page.url();
          item.textFragmentLink.trustedEventsAdded = Number(item.textFragmentLink.trustedBeforematchCount) - Number(item.collapseAll.trustedBeforematchCount);
        } finally {
          await context.close();
        }
      } catch (error) {
        item.error = error.stack;
      }
    }

    // The static export always starts in no-js-safe mode; URL query settings
    // are applied by the client effect only when JavaScript runs.
    const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1440, height: 1000 } });
    try {
      const page = await context.newPage();
      await page.goto(urlFor('no-js-safe'), { waitUntil: 'networkidle' });
      result.noJavaScript = await snapshot(page);
      result.noJavaScript.playwrightVisible = Object.fromEntries(await Promise.all(panelIds.map(async (id) => [id, await page.locator(`[data-spike-panel="${id}"] p`).isVisible()])));
    } finally {
      await context.close();
    }
  } catch (error) {
    result.error = error.stack;
  } finally {
    await browser?.close();
  }
}

const html = await (await fetch(urlFor('no-js-safe'))).text();
results.staticHtml = {
  allTermsPresent: panelIds.every((id) => html.includes(`R4PANEL${id.toUpperCase()}`)),
  panelCount: (html.match(/data-spike-panel="/g) || []).length,
  untilFoundAttributeCount: (html.match(/hidden="until-found"/g) || []).length,
  jsMarkerAddedByBootScript: html.includes("r.classList.add('js')"),
  sourceMode: 'no-js-safe (query settings are applied after hydration)',
};
await measureBrowser('chromium', chromium, { headless: true, executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
await measureBrowser('webkit', webkit, { headless: true });
await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(results, null, 2)}\n`);
console.log(JSON.stringify({ output, browsers: Object.fromEntries(Object.entries(results.browsers).map(([name, result]) => [name, { version: result.version, error: result.error, modes: Object.fromEntries(Object.entries(result.modes).map(([mode, item]) => [mode, { error: item.error, windowFind: item.windowFind?.returnValue, trustedMatches: item.windowFind?.after?.trustedBeforematchCount, textFragmentTrustedMatches: item.textFragmentLink?.trustedBeforematchCount }])) }])) }, null, 2));
