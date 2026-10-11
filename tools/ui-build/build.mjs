import {build} from 'esbuild';

await build({entryPoints:['entry.mjs'],bundle:true,format:'esm',target:['es2020'],minify:true,legalComments:'eof',outfile:'../../assets/vendor/gsap-3.15.0.mjs'});
// The npm package embeds the copyright/license notice in source; the adjacent
// license notice is checked in separately because upstream ships no LICENSE file.
