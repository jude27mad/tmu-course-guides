// Copies the static export (out/) to where GitHub Pages serves it.
// Usage: node scripts/copy-export.mjs [target=../next]
// The target is replaced wholesale, so it must be a folder this script made
// before (it carries .site-export) or not exist yet.
import { cpSync, existsSync, rmSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const site = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(site, 'out');
const target = resolve(site, process.argv[2] || '../next');
const marker = resolve(target, '.site-export');

if (!existsSync(out)) throw new Error('No out/ folder: run `next build` first.');
if (existsSync(target) && readdirSync(target).length && !existsSync(marker)) {
  throw new Error(`${target} exists and was not made by this script; refusing to replace it.`);
}
rmSync(target, { recursive: true, force: true });
cpSync(out, target, { recursive: true });
writeFileSync(marker, 'Static export of site/ (Next.js). Rebuild with `npm run export:preview` in site/.\n');
console.log(`copied ${out} -> ${target}`);
