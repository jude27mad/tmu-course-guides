import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import * as THREE from 'three';
import { decayFor, frameShare } from '../src/utils/frameStep.mjs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const fluidSource = read('../src/components/canvas/fluid/Fluid.jsx');
const hooks = '../src/components/canvas/fluid/hooks/';
const stripImports = source => source.replace(/^import .*;\r?\n/gm, '');

function hook(name, scope) {
  const source = read(hooks + name + '.jsx')
    .replace(/^import (\w+) from '@src\/components\/canvas\/fluid\/glsl\/([^']+)';$/gm,
      (_, variable, file) => 'const ' + variable + ' = ' + JSON.stringify(read('../src/components/canvas/fluid/glsl/' + file)) + ';');
  return new Function(...Object.keys(scope),
    stripImports(source).replace('export default ' + name + ';', 'return ' + name + ';'))(...Object.values(scope));
}

// Execute the production callbacks, materials and buffer swap. Only React's
// mounting lifecycle and the GPU draw boundary are replaced for this Node test.
function mount() {
  const targets = [];
  const size = { width: 400, height: 800 };
  const opts = { radius: 0.11, curl: 1, swirl: 3, pressure: 0,
    simRes: 16, dyeRes: 64, velocityDissipation: 0.93, densityDissipation: 0.96 };
  const useRef = current => ({ current });
  const scope = {
    ...THREE, THREE, useRef, useMemo: create => create(),
    useOpts: () => opts, useThree: select => select({ size }),
    useIsomorphicLayoutEffect: () => {},
    useFBO: () => {
      const target = new THREE.WebGLRenderTarget(4, 4);
      targets.push(target);
      return target;
    },
  };
  const doubleFBO = hook('useDoubleFBO', scope);
  const FBOs = {
    velocity: doubleFBO(4, 4, {}), density: doubleFBO(4, 4, {}),
    pressure: doubleFBO(4, 4, {}), curl: scope.useFBO(), divergence: scope.useFBO(),
  };
  const materials = hook('useMaterials', scope)();
  for (const [name, material] of Object.entries(materials)) material.name = name;
  const draws = [];
  const splatStack = { current: [] };
  let frame;
  let refs;
  const gl = {
    setRenderTarget() {}, clear() {},
    render() {
      const material = refs.meshRef.current.material;
      const uniforms = Object.fromEntries(Object.entries(material.uniforms).map(([name, uniform]) => [
        name, uniform.value?.isVector2 || uniform.value?.isVector3 ? uniform.value.toArray() : uniform.value,
      ]));
      draws.push({ material: material.name, uniforms });
    },
  };
  const wakes = { count: 0 };
  const componentScope = {
    ...scope, useThree: select => select({ size, gl, invalidate: () => { wakes.count += 1; } }), useCallback: callback => callback,
    useEffect: () => {}, useFrame: callback => { frame = callback; },
    useFBOs: () => FBOs, useMaterials: () => materials, usePointerEvents: () => splatStack,
    decayFor, frameShare,
  };
  // The module's own constants, then the component body up to its JSX.
  const constants = fluidSource.match(/^const [A-Z_]+ = [^;]+;$/gm).join('\n');
  const component = constants + '\n' + fluidSource.slice(fluidSource.indexOf('function Fluid('), fluidSource.indexOf('\n  return ('));
  refs = new Function(...Object.keys(componentScope),
    component + '\n  return { meshRef, postRef };\n}\nreturn Fluid({ mainRef: {} });')(...Object.values(componentScope));
  refs.meshRef.current = {};
  const shown = [];
  refs.postRef.current = { updateUniform: (name, value) => { if (name === 'tFluid') shown.push(value); } };
  return {
    FBOs, splatStack, draws, shown, wakes,
    frame(delta = 1 / 60) { draws.length = 0; frame({}, delta); },
    dispose() {
      targets.forEach(target => target.dispose());
      Object.values(materials).forEach(material => material.dispose());
    },
  };
}

for (const splatCount of [0, 1, 2]) {
  test('fluid retains the pre-vorticity velocity snapshot after ' + splatCount + ' splats', () => {
    const h = mount();
    try {
      for (let frame = 0; frame < 3; frame += 1) {
        const snapshot = (splatCount % 2 ? h.FBOs.velocity.write : h.FBOs.velocity.read).texture;
        const updatedVelocity = (splatCount % 2 ? h.FBOs.velocity.read : h.FBOs.velocity.write).texture;
        for (let i = 0; i < splatCount; i += 1) {
          h.splatStack.current.push({ mouseX: 0.2, mouseY: 0.4, velocityX: 3, velocityY: -2 });
        }
        h.frame();
        for (const name of ['curl', 'vorticity', 'divergence']) {
          assert.equal(h.draws.find(draw => draw.material === name).uniforms.uVelocity, snapshot,
            name + ' must use the velocity captured after splats and before vorticity swaps it');
        }
        assert.equal(h.draws.find(draw => draw.material === 'gradientSubstract').uniforms.uVelocity,
          updatedVelocity, 'later passes must still consume the updated velocity');
      }
    } finally { h.dispose(); }
  });
}

test('reused splat vectors preserve each input and celebration radius at draw time', () => {
  const h = mount();
  try {
    h.splatStack.current.push(
      { mouseX: 0.2, mouseY: 0.4, velocityX: 3, velocityY: -2 },
      { mouseX: 0.8, mouseY: 0.6, velocityX: -5, velocityY: 7, radiusScale: 4 },
    );
    h.frame();
    const splats = h.draws.filter(draw => draw.material === 'splat').map(({ uniforms: u }) => ({
      pointer: u.uPointer, color: u.uColor, radius: u.uRadius,
    }));
    assert.deepEqual(splats, [
      { pointer: [0.8, 0.6], color: [-5, 7, 10], radius: 0.0044 },
      { pointer: [0.8, 0.6], color: [-5, 7, 10], radius: 0.0044 },
      { pointer: [0.2, 0.4], color: [3, -2, 10], radius: 0.0011 },
      { pointer: [0.2, 0.4], color: [3, -2, 10], radius: 0.0011 },
    ]);
  } finally { h.dispose(); }
});

// The simulation was tuned per 60 Hz frame. Two 120 Hz frames must advance it
// as far as one 60 Hz frame: the same total time step and the same total
// dissipation, with a pointer stroke's dye spread across both frames.
const stepUniforms = (h, material) => h.draws.filter(draw => draw.material === material).map(draw => draw.uniforms);

test('one 60 Hz frame keeps the original step, dissipation and dye', () => {
  const h = mount();
  try {
    h.splatStack.current.push({ mouseX: 0.2, mouseY: 0.4, velocityX: 3, velocityY: -2 });
    h.frame(1 / 60);
    const [velocity, density] = stepUniforms(h, 'advection');
    assert.deepEqual([velocity.dt, velocity.uDissipation, density.uDissipation], [0.016, 0.93, 0.96]);
    assert.equal(stepUniforms(h, 'vorticity')[0].dt, 0.016);
    assert.deepEqual(stepUniforms(h, 'splat')[0].uColor, [3, -2, 10]);
  } finally { h.dispose(); }
});

test('two 120 Hz frames advance and fade the fluid as much as one 60 Hz frame', () => {
  const h = mount();
  try {
    let dt = 0; let vorticity = 0; let velocityFade = 1; let densityFade = 1; let dye = 0;
    for (let frame = 0; frame < 2; frame += 1) {
      h.splatStack.current.push({ mouseX: 0.2, mouseY: 0.4, velocityX: 1.5, velocityY: -1 });
      h.frame(1 / 120);
      const [velocity, density] = stepUniforms(h, 'advection');
      dt += velocity.dt;
      vorticity += stepUniforms(h, 'vorticity')[0].dt;
      velocityFade *= velocity.uDissipation;
      densityFade *= density.uDissipation;
      dye += stepUniforms(h, 'splat')[0].uColor[2];
    }
    assert.ok(Math.abs(dt - 0.016) < 1e-12);
    assert.ok(Math.abs(vorticity - 0.016) < 1e-12);
    assert.ok(Math.abs(velocityFade - 0.93) < 1e-12);
    assert.ok(Math.abs(densityFade - 0.96) < 1e-12);
    assert.ok(Math.abs(dye - 10) < 1e-12);
  } finally { h.dispose(); }
});

test('a burst keeps its full dye at any frame rate', () => {
  const h = mount();
  try {
    h.splatStack.current.push({ mouseX: 0.5, mouseY: 0.5, velocityX: 90, velocityY: 0, radiusScale: 36, burst: true });
    h.frame(1 / 120);
    assert.deepEqual(stepUniforms(h, 'splat')[0].uColor, [90, 0, 10]);
  } finally { h.dispose(); }
});

// Each pass swaps the density buffers; the effect must show the one holding
// this frame's dye, whether the frame had no splat, one or two.
test('the effect shows the density each frame produced', () => {
  const h = mount();
  try {
    for (const splats of [0, 1, 2, 0, 0]) {
      for (let i = 0; i < splats; i += 1) h.splatStack.current.push({ mouseX: 0.2, mouseY: 0.4, velocityX: 1, velocityY: 1 });
      h.shown.length = 0;
      h.frame(1 / 120);
      assert.deepEqual(h.shown, [h.FBOs.density.read.texture]);
    }
  } finally { h.dispose(); }
});

// The canvas draws on demand. A splat keeps frames coming until its trail has
// faded for good, at any frame rate, and then the canvas rests.
test('frames keep coming for ten seconds after the last splat, then stop', () => {
  for (const rate of [60, 120]) {
    const h = mount();
    try {
      h.splatStack.current.push({ mouseX: 0.2, mouseY: 0.4, velocityX: 1, velocityY: 1 });
      let frames = 0;
      let before = -1;
      while (h.wakes.count > before || frames === 0) {
        before = h.wakes.count;
        h.frame(1 / rate);
        frames += 1;
        assert.ok(frames < rate * 20, 'the canvas never rests');
      }
      assert.ok(Math.abs(frames / rate - 10) < 0.05, `${rate} Hz rested after ${frames / rate} s`);
    } finally { h.dispose(); }
  }
});
