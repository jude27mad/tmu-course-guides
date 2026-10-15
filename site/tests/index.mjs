/* `node --test tests/` (the package "test" script) runs this file: Node 22 resolves a directory argument through
   this folder's package.json "main". It loads every *.test.mjs here, so all suites run in one process.
   `node --test tests/*.test.mjs` runs the same files one process each. */
import { readdirSync } from 'node:fs';

const files = readdirSync(new URL('.', import.meta.url))
  .filter((file) => file.endsWith('.test.mjs'))
  .sort();
for (const file of files) await import(new URL(file, import.meta.url));
