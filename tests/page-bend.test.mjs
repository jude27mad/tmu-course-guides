import test from 'node:test';
import assert from 'node:assert/strict';
import * as bend from '../assets/book/page-bend-math.mjs';
const close = (actual, expected, tolerance = 1e-10) => {
  assert.ok(Math.abs(actual - expected) <= tolerance,
    `${actual} differs from ${expected} by more than ${tolerance}`);
};
const closeVector = (actual, expected, tolerance) => {
  actual.forEach((value, index) => close(value, expected[index], tolerance));
};
const lengths = [0.25, 1, 3];
const radiusRatios = [0, 1e-4, 0.001, 0.05, 0.2, 1 / Math.PI, 1];
const turns = [0, 1e-6, 0.1, 0.25, 0.5, 0.75, 0.9, 1 - 1e-6, 1];

test('the pure bend module exports the CPU and shader contract', () => {
  for (const name of ['bendPoint', 'bendBounds', 'bendHit']) {
    assert.equal(typeof bend[name], 'function', `${name} must be exported`);
  }
  assert.equal(typeof bend.PAGE_BEND_GLSL, 'string');
  assert.ok(bend.MIN_RADIUS_RATIO > 0 && bend.MIN_RADIUS_RATIO <= 1 / Math.PI);
  assert.ok(Number.isInteger(bend.DEFAULT_SEGMENTS) && bend.DEFAULT_SEGMENTS > 0);
  assert.ok(Number.isInteger(bend.MAX_SEGMENTS) && bend.MAX_SEGMENTS >= bend.DEFAULT_SEGMENTS);
});

test('1001 turns and both endpoint neighbourhoods stay finite and above the block', () => {
  const sweep = Array.from({length: 1001}, (_, index) => index / 1000);
  sweep.push(-1e-6, 1e-12, 1e-6, 1 - 1e-6, 1 - 1e-12, 1 + 1e-6);
  for (const width of lengths) {
    for (const radiusRatio of radiusRatios) {
      for (const turn of sweep) {
        for (const fraction of [0, 0.125, 0.5, 0.875, 1]) {
          const {position, normal} = bend.bendPoint(width * fraction, 0.37, {
            turn, radius: width * radiusRatio, width,
          });
          assert.ok(position.concat(normal).every(Number.isFinite));
          close(Math.hypot(...normal), 1);
          close(position[1], 0.37);
          assert.ok(position[2] >= -1e-12 * width);
          if (fraction === 0) closeVector(position, [0, 0.37, 0]);
        }
      }
    }
  }
});

test('the two endpoints are exactly flat and mirrored, with outward normals', () => {
  for (const width of lengths) {
    for (const radiusRatio of radiusRatios) {
      for (const fraction of [0, 0.1, 0.33, 0.7, 1]) {
        const x = width * fraction;
        const params = {radius: width * radiusRatio, width};
        const right = bend.bendPoint(x, -0.4, {...params, turn: 0});
        const left = bend.bendPoint(x, -0.4, {...params, turn: 1});
        closeVector(right.position, [x, -0.4, 0]);
        closeVector(left.position, [-x, -0.4, 0]);
        assert.deepEqual(right.normal, [0, 0, 1]);
        assert.deepEqual(left.normal, [0, 0, -1]);
      }
    }
  }
});

test('a moving cylindrical fold has circular curvature and parallel flat tails', () => {
  const width = 2;
  const radius = 0.15;
  const turn = 0.35;
  const start = (1 - turn) * width - turn * Math.PI * radius;
  for (const angle of [0.1, 0.4, Math.PI / 2, 2.4, 3]) {
    const x = start + angle * radius;
    const point = bend.bendPoint(x, 0.4, {turn, radius, width});
    closeVector(point.position, [start + radius * Math.sin(angle), 0.4,
      radius * (1 - Math.cos(angle))]);
    close(Math.hypot(point.position[0] - start, point.position[2] - radius), radius);
    closeVector(point.normal, [-Math.sin(angle), 0, Math.cos(angle)]);
  }
  closeVector(bend.bendPoint(start / 2, 0.4, {turn, radius, width}).normal, [0, 0, 1]);
  closeVector(bend.bendPoint(width, 0.4, {turn, radius, width}).normal, [0, 0, -1]);
});

test('sampled arclength is preserved to 0.001 of the width throughout the turn', () => {
  const samples = 8192;
  for (const width of lengths) {
    for (const ratio of radiusRatios) {
      for (const turn of turns) {
        const params = {turn, radius: ratio * width, width};
        let previous = bend.bendPoint(0, 0, params).position;
        let length = 0;
        for (let index = 1; index <= samples; index++) {
          const point = bend.bendPoint(width * index / samples, 0, params).position;
          length += Math.hypot(point[0] - previous[0], point[2] - previous[2]);
          previous = point;
        }
        close(length, width, 1e-3 * width);
      }
    }
  }
});

test('positions and normals are continuous through turns and both fold joins', () => {
  const dt = 1e-7;
  for (const width of lengths) {
    for (const ratio of radiusRatios) {
      const radius = Math.min(width / Math.PI, Math.max(width * bend.MIN_RADIUS_RATIO, width * ratio));
      for (const turn of turns) {
        for (const fraction of [0, 0.13, 0.5, 0.8, 1]) {
          const a = bend.bendPoint(width * fraction, 0, {turn, radius, width});
          const b = bend.bendPoint(width * fraction, 0, {turn: Math.min(1, turn + dt), radius, width});
          closeVector(a.position, b.position, 4.1 * width * dt);
          closeVector(a.normal, b.normal, 2.1 * width / radius * dt);
        }
        const start = (1 - turn) * width - turn * Math.PI * radius;
        for (const join of [start, start + Math.PI * radius]) {
          if (join <= 0 || join >= width) continue;
          const dx = Math.min(radius * 1e-6, join / 2, (width - join) / 2);
          const a = bend.bendPoint(join - dx, 0, {turn, radius, width});
          const b = bend.bendPoint(join + dx, 0, {turn, radius, width});
          closeVector(a.position, b.position, 2.1 * dx);
          closeVector(a.normal, b.normal, 2.1 * dx / radius);
        }
      }
    }
  }
});

test('normals agree with the tangent of the deformed surface', () => {
  for (const turn of turns) {
    for (const ratio of [0.001, 0.08, 1 / Math.PI]) {
      const width = 2;
      const params = {turn, radius: ratio * width, width};
      const dx = width * 1e-7;
      for (const x of [0.13, 0.61, 1.3, 1.9]) {
        const left = bend.bendPoint(x - dx, 0, params).position;
        const right = bend.bendPoint(x + dx, 0, params).position;
        const tangent = [right[0] - left[0], 0, right[2] - left[2]];
        const magnitude = Math.hypot(...tangent);
        const normal = bend.bendPoint(x, 0, params).normal;
        closeVector(normal, [-tangent[2] / magnitude, 0, tangent[0] / magnitude], 1e-6);
      }
    }
  }
});

test('analytic bounds contain the entire page including interior curve extrema', () => {
  for (const width of lengths) {
    for (const radiusRatio of radiusRatios) {
      for (const turn of turns) {
        const params = {turn, radius: width * radiusRatio, width, height: 1.7};
        const {min, max} = bend.bendBounds(params);
        assert.ok(min.concat(max).every(Number.isFinite));
        close(min[1], 0);
        close(max[1], 1.7);
        close(min[2], 0);
        for (let index = 0; index <= 512; index++) {
          for (const y of [0, 0.61, 1.7]) {
            const point = bend.bendPoint(width * index / 512, y, params).position;
            point.forEach((value, axis) => {
              assert.ok(value >= min[axis] - 1e-10 && value <= max[axis] + 1e-10,
                `axis ${axis}: ${value} outside ${min[axis]}..${max[axis]}`);
            });
          }
        }
      }
    }
  }
  const width = 2, radius = 0.15, turn = 0.35;
  const start = (1 - turn) * width - turn * Math.PI * radius;
  close(bend.bendBounds({width, radius, turn, height: 1}).max[0], start + radius);
  assert.deepEqual(bend.bendBounds({width: 2, height: 3, turn: 0}), {min: [0, 0, 0], max: [2, 3, 0]});
  assert.deepEqual(bend.bendBounds({width: 2, height: 3, turn: 1}), {min: [-2, 0, 0], max: [0, 3, 0]});
});

test('bounds remain continuous when the fold crosses page edges and its extremum', () => {
  for (const width of lengths) {
    for (const ratio of radiusRatios) {
      const params = {width, height: 1.7, radius: width * ratio};
      for (const turn of turns) {
        const a = bend.bendBounds({...params, turn});
        const b = bend.bendBounds({...params, turn: Math.min(1, turn + 1e-7)});
        closeVector(a.min, b.min, 4.1e-7 * width);
        closeVector(a.max, b.max, 4.1e-7 * width);
      }
    }
  }
});

test('picking returns physical distance and flat coordinates from both endpoint faces', () => {
  for (const turn of [0, 1]) {
    const params = {turn, width: 2, height: 3, radius: 0.2};
    const worldX = turn === 0 ? 0.73 : -0.73;
    for (const side of [-1, 1]) {
      const hit = bend.bendHit([worldX, 1.2, side * 4], [0, 0, -side * 7], params, {segments: 16});
      assert.ok(hit);
      close(hit.x, 0.73);
      close(hit.y, 1.2);
      close(hit.distance, 4);
    }
  }
});

test('picking uses the sampled chord geometry for a curved page and a sloped ray', () => {
  const params = {turn: 0.35, width: 2, height: 3, radius: 0.15};
  const segments = 37;
  const segment = 21;
  const amount = 0.37;
  const flatX = params.width * (segment + amount) / segments;
  const left = bend.bendPoint(params.width * segment / segments, 0, params).position;
  const right = bend.bendPoint(params.width * (segment + 1) / segments, 0, params).position;
  const point = [left[0] + amount * (right[0] - left[0]), 1.4,
    left[2] + amount * (right[2] - left[2])];
  const origin = [point[0] + 2, point[1] + 0.3, point[2]];
  const hit = bend.bendHit(origin, [-8, -1.2, 0], params, {segments});
  assert.ok(hit);
  close(hit.x, flatX);
  close(hit.y, point[1]);
  close(hit.distance, Math.hypot(2, 0.3));
});

test('overlapping flat tails select the nearest visible fold from either side', () => {
  const params = {turn: 0.4, width: 1, height: 1, radius: 0.1};
  const start = (1 - params.turn) * params.width - params.turn * Math.PI * params.radius;
  const worldX = 0.35;
  const top = bend.bendHit([worldX, 0.6, 2], [0, 0, -3], params, {segments: 100});
  assert.ok(top);
  close(top.x, 2 * start + Math.PI * params.radius - worldX);
  close(top.y, 0.6);
  close(top.distance, 1.8);
  const bottom = bend.bendHit([worldX, 0.6, -2], [0, 0, 5], params, {segments: 100});
  assert.ok(bottom);
  close(bottom.x, worldX);
  close(bottom.distance, 2);
});

test('picking misses finite strip extensions, rays facing away, and invalid rays', () => {
  const params = {turn: 0.4, width: 1, height: 1, radius: 0.1};
  for (const [origin, direction] of [
    [[2, 0.5, 2], [0, 0, -1]],
    [[0.35, -0.01, 2], [0, 0, -1]],
    [[0.35, 1.01, 2], [0, 0, -1]],
    [[0.35, 0.5, 2], [0, 0, 1]],
    [[0.35, 0.5, 2], [0, 0, 0]],
    [[NaN, 0.5, 2], [0, 0, -1]],
    [[0.35, 0.5, 2], [0, Infinity, -1]],
  ]) assert.equal(bend.bendHit(origin, direction, params), null);
  assert.equal(bend.bendHit([0.5, 0.5, 0], [1, 0, 0], {turn: 0, width: 1, height: 1}), null);
});

test('rays landing exactly on sampled vertices and page borders keep their hits', () => {
  for (const turn of [0.001, 0.11, 0.35, 0.5, 0.73, 0.999]) {
    for (const radius of [0.0001, 0.01, 0.1, 1 / Math.PI]) {
      for (const segments of [7, 37, 64]) {
        const params = {turn, radius, width: 1, height: 1};
        for (let index = 0; index <= segments; index++) {
          for (const y of [0, 1]) {
            const point = bend.bendPoint(index / segments, y, params).position;
            const direction = [0, y === 0 ? 0.13 : -0.13, -1];
            const origin = point.map((value, axis) => value - 2 * direction[axis]);
            const hit = bend.bendHit(origin, direction, params, {segments});
            assert.ok(hit, `missing vertex ${index}/${segments}, y=${y}, turn=${turn}, radius=${radius}`);
            assert.ok(hit.x >= 0 && hit.x <= params.width);
            assert.ok(hit.y >= 0 && hit.y <= params.height);
          }
        }
      }
    }
  }
  const sharedVertex = bend.bendHit(
    [0.9034269694676305, 0.5700000000000001, 0.01882349089984628],
    [-0.0005971420110200132, -0.07000000000000006, -0.0008021355363496616],
    {turn: 0.1, width: 1, height: 1, radius: 0.01}, {segments: 64});
  assert.ok(sharedVertex);
  close(sharedVertex.x, 59 / 64);
  close(sharedVertex.y, 0.5);
  const corner = bend.bendHit([0.3, 0.4, 0.7], [-0.3, -0.4, -0.7], {turn: 0});
  assert.ok(corner);
  close(corner.x, 0);
  close(corner.y, 0);
  close(corner.distance, Math.hypot(0.3, 0.4, 0.7));
});

test('radii and segment options clamp to the supported ranges', () => {
  const width = 2, turn = 0.37;
  for (const x of [0, 0.4, 1.1, width]) {
    const minimum = bend.bendPoint(x, 0, {turn, width, radius: bend.MIN_RADIUS_RATIO * width});
    const maximum = bend.bendPoint(x, 0, {turn, width, radius: width / Math.PI});
    for (const radius of [-Infinity, -1, 0]) {
      assert.deepEqual(bend.bendPoint(x, 0, {turn, width, radius}), minimum);
    }
    for (const radius of [Infinity, 100]) {
      assert.deepEqual(bend.bendPoint(x, 0, {turn, width, radius}), maximum);
    }
  }
  for (const segments of [-100, 0, NaN, Infinity, 1.7, bend.MAX_SEGMENTS + 1]) {
    const hit = bend.bendHit([0.4, 0.5, 2], [0, 0, -1], {turn: 0, width, height: 1}, {segments});
    assert.ok(hit);
    close(hit.x, 0.4);
    close(hit.distance, 2);
  }
});

// Execute a straight scalar/vector-constructor transliteration of the exported
// GLSL itself. No CPU bend helper or copied CPU formula participates in this port.
function portGLSL(source) {
  const js = source
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\b(?:float|vec2|vec3)\s+(\w+)\s*\(([^)]*)\)\s*\{/g,
      (_, name, args) => `function ${name}(${args.replace(/\b(?:float|vec2|vec3)\s+/g, '')}) {`)
    .replace(/\bconst\s+float\s+/g, 'const ')
    .replace(/\b(?:float|vec2|vec3)\s+(\w+)\s*=/g, 'let $1 =');
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const vec2 = (x, y) => ({x, y});
  const vec3 = (x, y, z) => ({x, y, z});
  return new Function('clamp', 'sin', 'cos', 'vec2', 'vec3',
    `${js}\nreturn {bendPosition, bendNormal};`)(clamp, Math.sin, Math.cos, vec2, vec3);
}

test('the exported GLSL positions and normals match CPU values across sampled turns', () => {
  assert.match(bend.PAGE_BEND_GLSL, /vec3 bendPosition\(vec3 p, float turn, float radius, float width\)/);
  assert.match(bend.PAGE_BEND_GLSL, /vec3 bendNormal\(vec3 p, float turn, float radius, float width\)/);
  const shader = portGLSL(bend.PAGE_BEND_GLSL);
  for (const width of lengths) {
    for (const ratio of radiusRatios) {
      for (const turn of [-1e-6, ...turns, 1 + 1e-6]) {
        for (const fraction of [0, 0.01, 0.17, 0.5, 0.83, 1]) {
          const x = fraction * width, radius = ratio * width;
          const cpu = bend.bendPoint(x, 0.7, {turn, radius, width});
          const p = {x, y: 0.7, z: 0};
          const position = shader.bendPosition(p, turn, radius, width);
          const normal = shader.bendNormal(p, turn, radius, width);
          closeVector([position.x, position.y, position.z], cpu.position, 1e-10 * width);
          closeVector([normal.x, normal.y, normal.z], cpu.normal);
        }
      }
    }
  }
});
