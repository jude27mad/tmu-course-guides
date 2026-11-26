/* eslint-disable import/prefer-default-export, no-plusplus, no-continue */
/*
 * Adapted from React Bits' Silk, src/content/Backgrounds/Silk/Silk.jsx at
 * 37f53df7efb61238b0fea9ea8be74e3cce62b959. Copyright (c) 2026 David Haz. MIT + Commons Clause;
 * see public/licenses/React-Bits-Silk.txt.
 * The cloth, its lighting, pointer bend, ripples and unfolding are React Bits'; the colours are the site
 * palette's. The site's own changes: the cloth is screened over a deep blue that runs down the panel, so its
 * shadows are blue and never a second black; the folds turn slowly across the panel, so two windows rarely
 * show the same diagonal; the gloss is broader; a wide panel shows more cloth instead of the same cloth
 * stretched; the bloom pass, the light-background branch, the edge fade and the variation offset are left out.
 * This adapter replaces the React effect with a disposable controller driven by Giats's Tempus clock, the
 * Desk's visibility and the motion preference. It bounds the canvas resolution, rides out a lost GPU context,
 * and says when WebGL 2 cannot draw, so the Kairo field takes its place.
 */
import { SILK, rgbOf } from '../../lib/palette.mjs';

const VERTEX = `#version 300 es
in vec2 aPosition;
void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

const CLOTH = `
uniform vec2 uView;
uniform float uScale;
uniform float uRotation;
uniform float uTime;
uniform float uWave;
uniform float uRipple;
uniform float uFold;
uniform float uMeander;
uniform vec4 uPointer;
uniform vec2 uDrag;
uniform vec4 uWaves[4];

const float e = 2.71828182845904523536;

float noise(vec2 texCoord) {
  float G = e;
  vec2 r = (G * sin(G * texCoord));
  return fract(r.x * r.y * (1.0 + texCoord.x));
}

vec2 rotateUvs(vec2 uv, float angle) {
  float c = cos(angle);
  float s = sin(angle);
  mat2 rot = mat2(c, -s, s, c);
  return rot * uv;
}

vec2 bend(vec2 uv) {
  vec2 aspect = vec2(uView.x / uView.y, 1.0);
  vec2 offset = (uv - uPointer.xy) * aspect;
  float touch = uPointer.z * exp(-dot(offset, offset) / (uPointer.w * uPointer.w));
  uv -= uDrag * touch;
  for (int i = 0; i < 4; i++) {
    vec4 wave = uWaves[i];
    if (wave.w <= 0.0) continue;
    vec2 q = (uv - wave.xy) * aspect;
    float dist = length(q);
    float front = dist - wave.z;
    float ring = exp(-front * front * 60.0) * wave.w;
    uv += q / max(dist, 0.0001) / aspect * ring * 0.034 * sin(front * 34.0);
  }
  return uv;
}

float silk(vec2 vUv) {
  // The site's: a panel wider than it is tall (the desktop Desk) shows more cloth, not the same cloth stretched.
  vUv.x *= max(1.0, uView.x / uView.y);
  // The site's: the folds turn slowly across the panel, so two windows rarely show the same diagonal.
  float turn = uMeander * sin(2.3 * vUv.x - 1.7 * vUv.y + 0.8);
  vec2 uv = rotateUvs(vUv * uScale, uRotation + turn);
  vec2 tex = uv * uScale;
  float tOffset = uTime;
  tex.y += 0.03 * uWave * sin(8.0 * tex.x - tOffset);
  return 0.6 + 0.4 * uFold * sin(5.0 * (tex.x + tex.y + cos(3.0 * tex.x + 5.0 * tex.y) + 0.02 * tOffset) + uRipple * sin(20.0 * (tex.x + tex.y - 0.1 * tOffset)));
}
`;

const FRAGMENT = `#version 300 es
precision highp float;
${CLOTH}
uniform vec3 uColor;
uniform vec3 uSheenColor;
uniform vec3 uShade[3];
uniform float uNoiseIntensity;
uniform float uDepth;
uniform float uSheen;
uniform float uGloss;
uniform vec3 uLight;
uniform vec2 uStep;
uniform float uPresence;
out vec4 outColor;

vec3 softClip(vec3 c) {
  vec3 over = max(c - 0.75, 0.0);
  return min(c, 0.75) + 0.25 * (1.0 - exp(-over * 4.0));
}

void main() {
  vec2 vUv = gl_FragCoord.xy / uView;
  vec2 coord = bend(vUv);
  float pattern = silk(coord);
  float rnd = noise(gl_FragCoord.xy);
  float n = clamp((pattern - 0.2) / 0.8, 0.0, 1.0);

  float gx = silk(coord + vec2(uStep.x, 0.0)) - pattern;
  float gy = silk(coord + vec2(0.0, uStep.y)) - pattern;
  vec3 normal = normalize(vec3(-gx * 26.0, -gy * 26.0, 1.0));
  vec3 toLight = normalize(vec3(uLight.xy, 0.85));
  float relief = 1.0 + (dot(normal, toLight) - toLight.z) * 1.8 * uDepth;
  vec3 halfway = normalize(toLight + vec3(0.0, 0.0, 1.0));
  float gloss = pow(max(dot(normal, halfway), 0.0), uGloss) * smoothstep(0.25, 0.85, n);
  float crest = pow(n, 5.0);
  float shine = (gloss * 0.85 + crest * 0.4) * uSheen * (1.0 + uLight.z * 0.6);

  float grain = rnd / 15.0 * uNoiseIntensity;
  float floorValue = mix(0.2, 0.03, uDepth);
  float curve = uDepth > 0.0 ? pow(n, 1.0 + 1.4 * uDepth) : n;
  float shade = uDepth > 0.0 ? floorValue + (1.0 - floorValue) * curve : pattern;
  vec3 tone = mix(uColor, pow(uColor, vec3(1.45)), (1.0 - n) * uDepth);
  vec3 lit = tone * shade * relief - vec3(grain);
  vec3 tint = mix(uColor, uSheenColor, 0.8);
  float blend = clamp(uSheen * 4.0, 0.0, 1.0);
  vec3 cloth = mix(clamp(lit, 0.0, 1.0), clamp(softClip(lit + tint * shine), 0.0, 1.0), blend);

  // The site's: the cloth is screened over a deep blue that runs down the panel as a 155deg CSS gradient
  // would (stops at 0, 45 and 100%), so a fold's shadow is that blue.
  vec2 fromCentre = vec2(vUv.x - 0.5, 0.5 - vUv.y) * uView;
  vec2 down = vec2(0.42262, 0.90631);
  float t = clamp(dot(fromCentre, down) / (uView.x * down.x + uView.y * down.y) + 0.5, 0.0, 1.0);
  vec3 under = t < 0.45 ? mix(uShade[0], uShade[1], t / 0.45) : mix(uShade[1], uShade[2], (t - 0.45) / 0.55);
  vec3 result = under + cloth - under * cloth;

  outColor = vec4(result * uPresence, uPresence);
}`;

const UNIFORMS = ['uView', 'uScale', 'uRotation', 'uMeander', 'uTime', 'uWave', 'uRipple', 'uFold', 'uPointer', 'uDrag', 'uWaves', 'uColor', 'uSheenColor', 'uShade', 'uNoiseIntensity', 'uDepth', 'uSheen', 'uGloss', 'uLight', 'uStep', 'uPresence'];

// React Bits' timings and resting light.
const INTRO_SECONDS = 2.2;
const INTRO_RUSH = 1.6;
const WAVE_LIFE = 1.6;
const DEFAULT_LIGHT = [-0.55, 0.7];
const LIGHT_TILT = Math.hypot(DEFAULT_LIGHT[0], DEFAULT_LIGHT[1]);
const POINTER_REACH = 0.32;

// How the cloth is cut for the Desk: broad folds and a soft gloss, so each small window holds a lit face and an
// edge and never a row of thin streaks. React Bits' own gloss exponent is 48, and it has no meander.
export const SILK_CUT = Object.freeze({ speed: 5, scale: 1, rotation: 1.3, meander: 0.25, noise: 0.6, sheen: 0.7, gloss: 24, depth: 0.4, ripple: 1, wave: 1 });

// The frame held while motion is off, and the frame a paused visit starts from.
const STILL_FLOW = 1.4;
// Phones report up to 3 device pixels per CSS pixel; the cloth is soft, so it never needs them all.
const MAX_DPR = 1.5;
const MAX_PIXELS = 1_200_000;
const CONTEXT = { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' };
const noop = () => {};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const ease = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const channels = (hex) =>
  rgbOf(hex)
    .split(', ')
    .map((value) => Number(value) / 255);
// The cloth's colour, its sheen and the three blues it is screened over (SILK, or SILK_DARK), as 0 to 1 channels.
const paintFor = (colors) => ({ color: channels(colors.color), sheen: channels(colors.sheen), shade: new Float32Array(colors.shade.flatMap(channels)) });

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
  gl.deleteShader(shader);
  return null;
}

// Everything the cloth holds on the GPU; null when its shader will not build.
function build(gl) {
  const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT);
  const program = gl.createProgram();
  if (vertex && fragment && program) {
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.bindAttribLocation(program, 0, 'aPosition');
    gl.linkProgram(program);
  }
  if (vertex) gl.deleteShader(vertex);
  if (fragment) gl.deleteShader(fragment);
  if (!vertex || !fragment || !program || !gl.getProgramParameter(program, gl.LINK_STATUS)) {
    if (program) gl.deleteProgram(program);
    return null;
  }
  const uniforms = {};
  for (const name of UNIFORMS) uniforms[name] = gl.getUniformLocation(program, name);
  // One triangle that covers the canvas.
  const buffer = gl.createBuffer();
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  return { program, uniforms, buffer, vao };
}

function release(gl, kit) {
  gl.deleteProgram(kit.program);
  gl.deleteBuffer(kit.buffer);
  gl.deleteVertexArray(kit.vao);
}

// Returns null where WebGL 2 or the cloth's shaders are not available: the caller shows the Kairo field instead.
export function mountSilkField(canvas, { subscribe, host = canvas.parentElement, visible = false, still = false, colors = SILK, onFail = noop } = {}) {
  let gl = null;
  try {
    gl = canvas.getContext('webgl2', CONTEXT);
  } catch {
    /* no WebGL 2 here */
  }
  if (!gl) return null;
  let kit = build(gl);
  if (!kit) {
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return null;
  }

  const doc = canvas.ownerDocument;
  const win = doc.defaultView;
  const view = { width: 1, height: 1, ratio: 1 };
  const pointer = { x: 0, y: 0, inside: false };
  const waves = [];
  const waveData = new Float32Array(16);
  // A visit that starts with motion off shows the cloth already open, at its held frame.
  const state = { flow: still ? STILL_FLOW : 0, intro: still ? 1 : 0, touch: 0, x: 0, y: 0, dragX: 0, dragY: 0, lightX: DEFAULT_LIGHT[0], lightY: DEFAULT_LIGHT[1] };
  let paint = paintFor(colors);
  let inView = visible;
  let paused = still;
  let lost = false;
  let disposed = false;
  let unsubscribe = null;
  let last = null;

  const render = () => {
    if (disposed || lost || !kit) return;
    const unfold = ease(state.intro);
    const u = kit.uniforms;
    waveData.fill(0);
    waves.forEach((wave, index) => {
      waveData.set([wave.x, wave.y, wave.age * 0.6, Math.exp(-wave.age / (WAVE_LIFE * 0.45))], index * 4);
    });

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(kit.program);
    gl.bindVertexArray(kit.vao);
    gl.uniform2f(u.uView, canvas.width, canvas.height);
    gl.uniform1f(u.uScale, SILK_CUT.scale);
    gl.uniform1f(u.uRotation, SILK_CUT.rotation);
    gl.uniform1f(u.uMeander, SILK_CUT.meander);
    gl.uniform1f(u.uTime, state.flow - INTRO_RUSH * (1 - unfold));
    gl.uniform1f(u.uWave, SILK_CUT.wave);
    gl.uniform1f(u.uRipple, SILK_CUT.ripple);
    gl.uniform1f(u.uFold, 0.25 + 0.75 * unfold);
    gl.uniform4f(u.uPointer, state.x / view.width, 1 - state.y / view.height, state.touch, POINTER_REACH);
    gl.uniform2f(u.uDrag, state.dragX, state.dragY);
    gl.uniform4fv(u.uWaves, waveData);
    gl.uniform3fv(u.uColor, paint.color);
    gl.uniform3fv(u.uSheenColor, paint.sheen);
    gl.uniform3fv(u.uShade, paint.shade);
    gl.uniform1f(u.uNoiseIntensity, SILK_CUT.noise);
    gl.uniform1f(u.uDepth, SILK_CUT.depth);
    gl.uniform1f(u.uSheen, SILK_CUT.sheen);
    gl.uniform1f(u.uGloss, SILK_CUT.gloss);
    gl.uniform3f(u.uLight, state.lightX, state.lightY, state.touch);
    gl.uniform2f(u.uStep, view.ratio / canvas.width, view.ratio / canvas.height);
    gl.uniform1f(u.uPresence, 1 - (1 - state.intro) ** 3);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  // One step of the cloth, the pointer's pull on it and its ripples. All of it is per second, so a 120 Hz
  // screen moves the cloth exactly as a 60 Hz one does.
  const advance = (dt) => {
    state.flow += dt * 0.1 * SILK_CUT.speed;
    if (state.intro < 1) state.intro = Math.min(1, state.intro + dt / INTRO_SECONDS);

    const engaged = pointer.inside;
    if (engaged && state.touch < 0.01) {
      state.x = pointer.x;
      state.y = pointer.y;
    }
    const follow = 1 - Math.exp(-dt * 10);
    const prevX = state.x;
    const prevY = state.y;
    state.x += (pointer.x - state.x) * follow;
    state.y += (pointer.y - state.y) * follow;
    const velX = (state.x - prevX) / Math.max(dt, 0.001) / view.height;
    const velY = (state.y - prevY) / Math.max(dt, 0.001) / view.height;
    const dragBlend = 1 - Math.exp(-dt * 4);
    state.dragX += (clamp(velX * 0.03, -0.06, 0.06) - state.dragX) * dragBlend;
    state.dragY += (clamp(-velY * 0.03, -0.06, 0.06) - state.dragY) * dragBlend;
    state.touch += ((engaged ? 1 : 0) - state.touch) * (1 - Math.exp(-dt * (engaged ? 3.5 : 1.4)));

    let lightGoalX = DEFAULT_LIGHT[0];
    let lightGoalY = DEFAULT_LIGHT[1];
    if (engaged) {
      const aimX = (pointer.x / view.width - 0.5) * (view.width / view.height);
      const aimY = 0.5 - pointer.y / view.height;
      const reach = Math.hypot(aimX, aimY);
      if (reach > 0.04) {
        lightGoalX = (aimX / reach) * LIGHT_TILT;
        lightGoalY = (aimY / reach) * LIGHT_TILT;
      } else {
        lightGoalX = state.lightX;
        lightGoalY = state.lightY;
      }
    }
    const lightFollow = 1 - Math.exp(-dt * 3);
    state.lightX += (lightGoalX - state.lightX) * lightFollow;
    state.lightY += (lightGoalY - state.lightY) * lightFollow;

    for (let i = waves.length - 1; i >= 0; i--) {
      waves[i].age += dt;
      if (waves[i].age > WAVE_LIFE * 2.5) waves.splice(i, 1);
    }
  };

  // The cloth at rest: open, with nothing pulling on it. It keeps the place it had reached.
  const settle = () => {
    state.intro = 1;
    state.touch = 0;
    state.dragX = 0;
    state.dragY = 0;
    [state.lightX, state.lightY] = DEFAULT_LIGHT;
    pointer.inside = false;
    waves.length = 0;
  };

  const stop = () => {
    unsubscribe?.();
    unsubscribe = null;
    last = null;
  };

  const loop = (now) => {
    if (disposed || paused || lost || !inView || doc.hidden) return;
    const dt = last === null ? 1 / 60 : Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    advance(dt);
    render();
  };

  const sync = () => {
    if (disposed) return;
    if (paused || lost || !inView || doc.hidden) stop();
    else if (!unsubscribe) unsubscribe = subscribe(loop);
  };

  const resize = () => {
    if (disposed || lost) return;
    const width = Math.max(1, canvas.clientWidth);
    const height = Math.max(1, canvas.clientHeight);
    const ratio = Math.min(win.devicePixelRatio || 1, MAX_DPR, Math.sqrt(MAX_PIXELS / (width * height)));
    view.width = width;
    view.height = height;
    view.ratio = ratio;
    canvas.width = Math.max(1, Math.round(width * ratio));
    canvas.height = Math.max(1, Math.round(height * ratio));
    render();
  };

  const pointFor = (event) => {
    const box = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - box.left) * view.width) / (box.width || 1),
      y: ((event.clientY - box.top) * view.height) / (box.height || 1),
    };
  };
  const ignores = (event) => paused || lost || !inView || doc.hidden || event.target?.closest?.('a, button, input, select, textarea, [role="button"]');
  // A mouse or pen pulls the cloth and turns its light. A finger is scrolling the page, so it only ripples.
  const onMove = (event) => {
    if (ignores(event) || event.pointerType === 'touch') return;
    const point = pointFor(event);
    pointer.x = point.x;
    pointer.y = point.y;
    pointer.inside = true;
  };
  const onLeave = () => {
    pointer.inside = false;
  };
  const onDown = (event) => {
    if (ignores(event)) return;
    const point = pointFor(event);
    waves.push({ x: point.x / view.width, y: 1 - point.y / view.height, age: 0 });
    if (waves.length > 4) waves.shift();
  };
  const onVisibility = () => {
    pointer.inside = false;
    sync();
  };
  // A lost context takes every program and texture with it. The browser may hand a new one back: the cloth
  // is rebuilt on it and carries on from where it was.
  const onLost = (event) => {
    event.preventDefault();
    lost = true;
    kit = null;
    stop();
  };
  const onRestored = () => {
    if (disposed) return;
    kit = build(gl);
    if (!kit) {
      onFail();
      return;
    }
    lost = false;
    resize();
    sync();
  };

  resize();
  const observer = win.ResizeObserver ? new win.ResizeObserver(resize) : null;
  observer?.observe(canvas);
  doc.addEventListener('visibilitychange', onVisibility);
  canvas.addEventListener('webglcontextlost', onLost);
  canvas.addEventListener('webglcontextrestored', onRestored);
  host.addEventListener('pointermove', onMove, { passive: true });
  host.addEventListener('pointerleave', onLeave, { passive: true });
  host.addEventListener('pointerdown', onDown, { passive: true });
  sync();

  return {
    update(next) {
      if (disposed) return;
      const wasPaused = paused;
      if ('visible' in next) inView = next.visible;
      if ('still' in next) paused = next.still;
      if (next.colors) paint = paintFor(next.colors);
      if (paused && !wasPaused) settle();
      sync();
      // A cloth that is not drawing frames (paused, off screen) shows its held frame as it now is.
      if ((paused && !wasPaused) || (next.colors && !unsubscribe)) render();
    },
    destroy() {
      if (disposed) return;
      disposed = true;
      stop();
      observer?.disconnect();
      doc.removeEventListener('visibilitychange', onVisibility);
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
      host.removeEventListener('pointermove', onMove);
      host.removeEventListener('pointerleave', onLeave);
      host.removeEventListener('pointerdown', onDown);
      waves.length = 0;
      if (kit) release(gl, kit);
      kit = null;
      // Browsers keep only a handful of contexts alive: give this one back now, not at the next collection.
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    },
  };
}
