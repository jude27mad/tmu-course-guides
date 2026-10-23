import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const file = name => readFileSync(new URL(name, import.meta.url), 'utf8');

test('Safari document background uses the Desk paper instead of exposed black', () => {
  const css = file('../src/styles/global.scss');
  assert.match(css, /html\\s*\\{[\\s\\S]*?background-color: var\\(--white\\)/);
  assert.match(css, /body\\s*\\{[\\s\\S]*?background-color: var\\(--white\\)/);
});

test('Full-screen shell and loader share dynamic viewport height', () => {
  const global = file('../src/styles/global.scss');
  const app = file('../src/pages/app.module.scss');
  const loader = file('../src/components/dom/styles/loader.module.scss');
  assert.match(global, /--app-viewport-height: 100dvh/);
  assert.match(app, /max-height: var\\(--app-viewport-height\\)/);
  assert.match(app, /height: var\\(--app-viewport-height\\) !important/);
  assert.match(app, /\\.background\\s*\\{[\\s\\S]*?height: var\\(--app-viewport-height\\)/);
  assert.match(loader, /height: var\\(--app-viewport-height\\)/);
});
