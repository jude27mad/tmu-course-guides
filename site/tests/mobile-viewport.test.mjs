import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const file = name => readFileSync(new URL(name, import.meta.url), 'utf8');

test('Safari document background uses the Desk paper instead of exposed black', () => {
  const css = file('../src/styles/global.scss');
  assert.ok(css.includes('background-color: var(--white)'));
  assert.ok(css.includes('min-height: var(--app-viewport-height)'));
});

test('the restored contained shell uses the stable small viewport', () => {
  const app = file('../src/pages/app.module.scss');
  const loader = file('../src/components/dom/styles/loader.module.scss');
  assert.ok(app.includes('max-height: 100svh'));
  assert.ok(app.includes('height: 100svh !important'));
  assert.ok(app.includes('height: 100svh'));
  assert.ok(loader.includes('height: var(--app-viewport-height)'));
});
