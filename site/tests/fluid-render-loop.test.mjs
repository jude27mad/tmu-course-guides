import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import * as THREE from 'three';

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
  const componentScope = {
    ...scope, useThree: select => select({ size, gl }), useCallback: callback => callback,
    useEffect: () => {}, useFrame: callback => { frame = callback; },
    useFBOs: () => FBOs, useMaterials: () => materials, usePointerEvents: () => splatStack,
  };
  const component = fluidSource.slice(fluidSource.indexOf('function Fluid('), fluidSource.indexOf('\n  return ('));
  refs = new Function(...Object.keys(componentScope),
    component + '\n  return { meshRef, postRef };\n}\nreturn Fluid({ mainRef: {} });')(...Object.values(componentScope));
  refs.meshRef.current = {};
  refs.postRef.current = {};
  return {
    FBOs, splatStack, draws,
    frame() { draws.length = 0; frame(); },
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
