import {build} from 'esbuild';
import {copyFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
const dir=dirname(fileURLToPath(import.meta.url));
await build({entryPoints:[resolve(dir,'vendor-entry.mjs')],bundle:true,minify:true,format:'esm',target:'es2022',outfile:resolve(dir,'../../assets/vendor/three-0.186.1.mjs'),legalComments:'eof'});
await copyFile(resolve(dir,'node_modules/three/LICENSE'),resolve(dir,'../../assets/vendor/THREE-LICENSE.md'));
