import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Texture } from 'three';

const moduleURL = source => `data:text/javascript;base64,${Buffer.from(`${source}\n//# sourceURL=fluid-test-module.mjs`).toString('base64')}`;
const threeURL = import.meta.resolve('three');

// Resolve the existing Next aliases and shader import for Node. The production
// effect, Three values and React hooks remain real; no WebGL context is needed
// to observe the values the effect hands to the renderer.
const utils = (await readFile(new URL('../src/components/canvas/fluid/utils.js', import.meta.url), 'utf8'))
  .replace("'three'", JSON.stringify(threeURL));
const shader = await readFile(new URL('../src/components/canvas/fluid/glsl/post.frag', import.meta.url), 'utf8');
const effectSource = (await readFile(new URL('../src/components/canvas/fluid/effect/FluidEffect.jsx', import.meta.url), 'utf8'))
  .replace("'postprocessing'", JSON.stringify(import.meta.resolve('postprocessing')))
  .replace("'three'", JSON.stringify(threeURL))
  .replace("import fragmentShader from '@src/components/canvas/fluid/glsl/post.frag';", `const fragmentShader = ${JSON.stringify(shader)};`)
  .replace("'@src/components/canvas/fluid/utils'", JSON.stringify(moduleURL(utils)));
const effectURL = moduleURL(effectSource);
const { default: FluidEffect } = await import(effectURL);

// PR 79 restores upstream allocation behavior. Assert the rendered values,
// rather than the object-identity optimizations that restoration removed.
test('steady fluid frames keep the same shader colours', () => {
  const effect = new FluidEffect({ fluidColor: '#E4E4E7', backgroundColor: '#000000' });
  try {
    const dye = effect.uniforms.get('uColor').value.toArray();
    const background = effect.uniforms.get('uBackgroundColor').value.toArray();
    for (let frame = 0; frame < 120; frame += 1) effect.update();
    assert.deepEqual(effect.uniforms.get('uColor').value.toArray(), dye);
    assert.deepEqual(effect.uniforms.get('uBackgroundColor').value.toArray(), background);
  } finally {
    effect.dispose();
  }
});

test('changed fluid colours and zero intensity reach the shader and then stay stable', () => {
  const effect = new FluidEffect();
  try {
    effect.state.fluidColor = '#ff0000';
    effect.state.backgroundColor = '#0000ff';
    effect.state.intensity = 0;
    effect.update();
    const dye = effect.uniforms.get('uColor').value;
    const background = effect.uniforms.get('uBackgroundColor').value;
    assert.deepEqual(dye.toArray(), [1, 0, 0]);
    assert.deepEqual(background.toArray(), [0, 0, 1]);
    assert.equal(effect.uniforms.get('uIntensity').value, 0);
    effect.update();
    assert.deepEqual(effect.uniforms.get('uColor').value.toArray(), dye.toArray());
    assert.deepEqual(effect.uniforms.get('uBackgroundColor').value.toArray(), background.toArray());
  } finally {
    effect.dispose();
  }
});

test('the effect supplies the original texture to its shader', () => {
  const texture = new Texture();
  const effect = new FluidEffect({ tFluid: texture });
  try {
    effect.update();
    assert.equal(effect.uniforms.get('tFluid').value, texture);
  } finally {
    effect.dispose();
    texture.dispose();
  }
});
