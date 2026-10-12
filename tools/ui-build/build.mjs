import {build} from 'esbuild';

const shared={bundle:true,format:'esm',target:['es2020'],minify:true,legalComments:'eof'};
await build({...shared,entryPoints:['entry.mjs'],outfile:'../../assets/vendor/gsap-3.15.0.mjs'});
await build({...shared,entryPoints:['night-entry.mjs'],outfile:'../../assets/vendor/night-vendor.mjs',metafile:true}).then(r=>{
 for(const [file,{bytes}] of Object.entries(r.metafile.outputs))console.log(`${file}: ${(bytes/1024).toFixed(1)} KB`);
});
