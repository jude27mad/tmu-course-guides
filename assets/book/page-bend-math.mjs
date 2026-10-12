/**
 * A zero-thickness page extruded along the spine (the y axis).
 * Flat coordinates are x in [0, width]; y is unchanged by the bend. Bounds and
 * picking use y in [0, height], so a centred mesh must translate y accordingly.
 * All positions, bounds and rays are in the same local page coordinate system.
 *
 * A semicircular fold of length L = PI * radius moves from the outer edge to
 * beyond the spine: a = (1 - turn) * width - turn * L. The tangent at arclength
 * s is (cos(theta), 0, sin(theta)), theta = clamp((s - a) / radius, 0, PI).
 * Integrating and anchoring the spine preserves length exactly. Flat tails
 * join the circle with continuous normals. Since sin(theta) >= 0, z >= 0.
 * The normal is the front face: +z on the right, -z when fully turned left.
 */

// A width-relative minimum keeps the radius interval valid at every page size.
export const MIN_RADIUS_RATIO = 1e-4;
export const DEFAULT_WIDTH = 1;
export const DEFAULT_HEIGHT = 1;
export const DEFAULT_SEGMENTS = 64;
export const MAX_SEGMENTS = 4096;
export const HIT_EPSILON = 1e-10;

const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

function parameters({turn = 0, radius, width = DEFAULT_WIDTH} = {}) {
  if (!Number.isFinite(width) || width <= 0) {
    throw new RangeError('Page width must be finite and positive.');
  }
  const progress = clamp(Number.isNaN(turn) ? 0 : turn, 0, 1);
  const maximum = width / Math.PI;
  const r = radius === undefined || Number.isNaN(radius)
    ? maximum : clamp(radius, width * MIN_RADIUS_RATIO, maximum);
  const arc = Math.PI * r;
  return {turn: progress, radius: r, width, arc, start: (1 - progress) * width - progress * arc};
}

function pageHeight({height = DEFAULT_HEIGHT} = {}) {
  if (!Number.isFinite(height) || height < 0) {
    throw new RangeError('Page height must be finite and nonnegative.');
  }
  return height;
}

// Continuous primitives of the tangent, including both straight tails.
function curve(q, radius, arc) {
  if (q <= 0) return [q, 0];
  if (q >= arc) return [arc - q, 2 * radius];
  const angle = q / radius;
  return [radius * Math.sin(angle), radius * (1 - Math.cos(angle))];
}

function point(x, y, {turn, radius, width, arc, start}) {
  const s = clamp(x, 0, width);
  if (turn <= 0) return {position: [s, y, 0], normal: [0, 0, 1]};
  if (turn >= 1) return {position: [-s, y, 0], normal: [0, 0, -1]};
  const spine = curve(-start, radius, arc);
  const bent = curve(s - start, radius, arc);
  const q = s - start;
  let normal;
  if (q <= 0) normal = [0, 0, 1];
  else if (q >= arc) normal = [0, 0, -1];
  else normal = [-Math.sin(q / radius), 0, Math.cos(q / radius)];
  return {position: [bent[0] - spine[0], y, bent[1] - spine[1]], normal};
}

/** Bend a flat sheet point. Radius clamps to [width * MIN_RADIUS_RATIO, width / PI]. */
export function bendPoint(x, y, params = {}) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new RangeError('Page coordinates must be finite.');
  }
  return point(x, y, parameters(params));
}

/** Return the analytic AABB as {min:[x,y,z], max:[x,y,z]}. */
export function bendBounds(params = {}) {
  const config = parameters(params);
  const height = pageHeight(params);
  const end = point(config.width, 0, config).position;
  // X is concave in arclength: its minimum is an endpoint, and its maximum
  // is where theta = PI/2, or the nearer page edge if that point is outside.
  const peak = point(clamp(config.start + config.arc / 2, 0, config.width), 0, config).position;
  return {min: [Math.min(0, end[0]), 0, 0], max: [Math.max(0, end[0], peak[0]), height, end[2]]};
}

/**
 * Intersect a uniformly subdivided sheet, double-sided, and return the nearest
 * {x, y, distance} in flat coordinates. distance is physical local-space length
 * even for a nonunit rayDir. Use the renderer's x-subdivision count as segments;
 * interpolation is on its straight vertex chords, rather than the ideal arc.
 * Invalid/zero rays and coplanar rays return null. Segment counts clamp to
 * [1, MAX_SEGMENTS]; omitted or NaN counts use DEFAULT_SEGMENTS.
 */
export function bendHit(rayOrigin, rayDir, params = {}, {segments = DEFAULT_SEGMENTS} = {}) {
  const config = parameters(params);
  const height = pageHeight(params);
  if (!rayOrigin || !rayDir || rayOrigin.length !== 3 || rayDir.length !== 3
    || !Array.from(rayOrigin).every(Number.isFinite) || !Array.from(rayDir).every(Number.isFinite)) return null;
  const magnitude = Math.hypot(...rayDir);
  if (!Number.isFinite(magnitude) || magnitude === 0) return null;
  const direction = Array.from(rayDir, value => value / magnitude);
  const count = clamp(Number.isNaN(segments) ? DEFAULT_SEGMENTS : Math.trunc(segments), 1, MAX_SEGMENTS);
  const tolerance = HIT_EPSILON * Math.max(config.width, height);
  let nearest = null;
  let left = point(0, 0, config).position;
  for (let index = 0; index < count; index++) {
    const right = point(config.width * (index + 1) / count, 0, config).position;
    const vx = right[0] - left[0], vz = right[2] - left[2];
    const denominator = direction[0] * vz - direction[2] * vx;
    // Each chord extruded along y is a finite rectangle. Solve its intersection
    // in the x/z plane, then check the along-chord fraction and y extent.
    if (denominator !== 0) {
      const ax = left[0] - rayOrigin[0], az = left[2] - rayOrigin[2];
      const distance = (ax * vz - az * vx) / denominator;
      const fraction = (ax * direction[2] - az * direction[0]) / denominator;
      const y = rayOrigin[1] + distance * direction[1];
      // Shared vertices and outer borders can round just outside their limits.
      // Admit only a tiny tolerance, then keep returned coordinates on the page.
      if (distance >= -tolerance && fraction >= -HIT_EPSILON && fraction <= 1 + HIT_EPSILON
        && y >= -tolerance && y <= height + tolerance
        && Number.isFinite(distance) && (!nearest || distance < nearest.distance)) {
        nearest = {x: config.width * (index + clamp(fraction, 0, 1)) / count,
          y: clamp(y, 0, height), distance: Math.max(0, distance)};
      }
    }
    left = right;
  }
  return nearest;
}

/** GLSL ES 3.00 include; p is a sheet vertex with p.z = 0. */
export const PAGE_BEND_GLSL = `
const float PAGE_BEND_PI = 3.141592653589793;
const float PAGE_BEND_MIN_RADIUS_RATIO = 0.0001;

float pageBendRadius(float radius, float width) {
  return clamp(radius, width * PAGE_BEND_MIN_RADIUS_RATIO, width / PAGE_BEND_PI);
}

vec2 pageBendCurve(float q, float r) {
  float arc = PAGE_BEND_PI * r;
  if (q <= 0.0) return vec2(q, 0.0);
  if (q >= arc) return vec2(arc - q, 2.0 * r);
  float angle = q / r;
  return vec2(r * sin(angle), r * (1.0 - cos(angle)));
}

vec3 bendPosition(vec3 p, float turn, float radius, float width) {
  float t = clamp(turn, 0.0, 1.0);
  float s = clamp(p.x, 0.0, width);
  if (t <= 0.0) return vec3(s, p.y, 0.0);
  if (t >= 1.0) return vec3(-s, p.y, 0.0);
  float r = pageBendRadius(radius, width);
  float arc = PAGE_BEND_PI * r;
  float a = (1.0 - t) * width - t * arc;
  vec2 spine = pageBendCurve(-a, r);
  vec2 bent = pageBendCurve(s - a, r);
  return vec3(bent.x - spine.x, p.y, bent.y - spine.y);
}

vec3 bendNormal(vec3 p, float turn, float radius, float width) {
  float t = clamp(turn, 0.0, 1.0);
  if (t <= 0.0) return vec3(0.0, 0.0, 1.0);
  if (t >= 1.0) return vec3(0.0, 0.0, -1.0);
  float r = pageBendRadius(radius, width);
  float arc = PAGE_BEND_PI * r;
  float a = (1.0 - t) * width - t * arc;
  float q = clamp(p.x, 0.0, width) - a;
  if (q <= 0.0) return vec3(0.0, 0.0, 1.0);
  if (q >= arc) return vec3(0.0, 0.0, -1.0);
  float angle = q / r;
  return vec3(-sin(angle), 0.0, cos(angle));
}
`;
