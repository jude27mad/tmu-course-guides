import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { Texture } from 'three';

const require = createRequire(import.meta.url);
const { transformSync } = require('next/dist/build/swc');
const moduleURL = source => `data:text/javascript;base64,${Buffer.from(`${source}\n//# sourceURL=fluid-test-module.mjs`).toString('base64')}`;
const threeURL = import.meta.resolve('three');
const reactURL = import.meta.resolve('react');

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
const hookSource = (await readFile(new URL('../src/hooks/useIsomorphicLayoutEffect.js', import.meta.url), 'utf8'))
  .replace("'react'", JSON.stringify(reactURL));
const wrapperSource = (await readFile(new URL('../src/components/canvas/fluid/effect/Fluid.jsx', import.meta.url), 'utf8'))
  .replace("'react'", JSON.stringify(reactURL))
  .replace("'@src/components/canvas/fluid/effect/FluidEffect'", JSON.stringify(effectURL))
  .replace("'@src/hooks/useIsomorphicLayoutEffect'", JSON.stringify(moduleURL(hookSource)));
const compiled = transformSync(wrapperSource, {
  jsc: { parser: { syntax: 'ecmascript', jsx: true }, transform: { react: { runtime: 'automatic' } } },
  module: { type: 'es6' },
}).code.replace('"react/jsx-runtime"', JSON.stringify(import.meta.resolve('react/jsx-runtime')));
const { default: Fluid } = await import(moduleURL(compiled));

test('steady fluid frames reuse the colour values already supplied to the shader', () => {
  const effect = new FluidEffect({ fluidColor: '#E4E4E7', backgroundColor: '#000000' });
  try {
    const dye = effect.uniforms.get('uColor').value;
    const background = effect.uniforms.get('uBackgroundColor').value;
    for (let frame = 0; frame < 120; frame += 1) effect.update();
    assert.equal(effect.uniforms.get('uColor').value, dye, 'unchanged dye must not allocate a replacement on each frame');
    assert.equal(effect.uniforms.get('uBackgroundColor').value, background, 'unchanged background must not allocate a replacement on each frame');
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
    assert.equal(effect.uniforms.get('uColor').value, dye);
    assert.equal(effect.uniforms.get('uBackgroundColor').value, background);
  } finally {
    effect.dispose();
  }
});

test('rendering a fluid texture never serializes its resource graph', () => {
  const texture = new Texture();
  texture.toJSON = () => { throw new Error('Texture resource graph was serialized'); };
  try {
    assert.doesNotThrow(() => ReactDOMServer.renderToStaticMarkup(React.createElement(Fluid, { tFluid: texture })));
  } finally {
    texture.dispose();
  }
});
