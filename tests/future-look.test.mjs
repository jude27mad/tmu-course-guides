import test from 'node:test';
import assert from 'node:assert/strict';

const module=await import('../assets/scenes/future-look.mjs').catch(e=>{
 if(e.code==='ERR_MODULE_NOT_FOUND')return {};
 throw e;
});
const palette={accent:'#b9dfc9',signal:'#ff8aa9'};
test('future look releases its generated textures once after repeated updates and quality changes',()=>{
 assert.equal(typeof module.createFutureLook,'function','the shared look API must exist');
 const look=module.createFutureLook(palette),textures=new Set();
 for(const m of Object.values(look.materials))for(const value of Object.values(m))if(value?.isTexture)textures.add(value);
 assert.ok(textures.size>0,'the authored surface field is reused as a texture');
 const counts=new Map([...textures].map(t=>[t,0]));
 for(const texture of textures)texture.addEventListener('dispose',()=>counts.set(texture,counts.get(texture)+1));
 for(let i=0;i<120;i++){
  look.update(i/60,Math.sin(i)*.5+.5,false);look.setQuality(i%2?'balanced':'full');
  for(const m of Object.values(look.materials))for(const v of Object.values(m))if(v?.isTexture)assert.ok(textures.has(v),'updates must reuse owned textures');
 }
 look.disposeTextures();look.disposeTextures();
 assert.ok([...counts.values()].every(n=>n===1),'each texture is disposed once');
 for(const m of Object.values(look.materials))m.dispose();
});
test('balanced optics reduce cost while retaining the same material and surface identity',()=>{
 assert.equal(typeof module.createFutureLook,'function');
 const look=module.createFutureLook(palette),glass=look.materials.glass;
 look.setQuality('full');assert.ok(glass.transmission>0);assert.ok(glass.dispersion>0);
 look.setQuality('balanced');assert.equal(look.materials.glass,glass);assert.equal(glass.dispersion,0);assert.ok(glass.transmission>0);
 look.update(2,1,false);const shader={uniforms:{},vertexShader:'#include <common>\n#include <beginnormal_vertex>\n#include <begin_vertex>',fragmentShader:'#include <common>\n#include <roughnessmap_fragment>\n#include <emissivemap_fragment>'};
 look.materials.flow.onBeforeCompile(shader);
 for(const u of Object.values(shader.uniforms))if(typeof u.value==='number')assert.ok(Number.isFinite(u.value));
 assert.ok(shader.vertexShader.includes('objectNormal'),'deformation must update surface normals');
 look.disposeTextures();for(const m of Object.values(look.materials))m.dispose();
});
