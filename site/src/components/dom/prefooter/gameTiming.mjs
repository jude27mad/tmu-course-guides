// Only this game's ballistic motion slows down. The fixed physics step stays 1/60.
export const GAME_SPEED = 0.85;
export const GAME_GRAVITY = -15 * GAME_SPEED ** 2;
export const GAME_MAX_AGE = 7 / GAME_SPEED;

// The current streak drives the challenge; a miss starts gently again. The
// smooth curve keeps increasing without unplayable speeds or bursts at high scores.
export function gameDifficulty({ score, isMobile }) {
  const streak = Number.isFinite(score) ? Math.max(0, score) : 0;
  const progress = streak / (streak + 30);
  const initialInterval = isMobile ? 5000 : 3000;
  const shortestInterval = isMobile ? 1400 : 900;
  return { interval: initialInterval - (initialInterval - shortestInterval) * progress, speed: 1 + 0.65 * progress };
}

// Spread the former 1-6-target waves into individual throws at the same average
// rate. Higher difficulty widens the timing variation as the average gap shrinks.
export function gameSpawnDelay({ interval, speed }, random = Math.random) {
  const variation = 0.25 + (speed - 1) * 0.5;
  return (interval / 3.5) * (1 - variation + random() * variation * 2);
}

// Start just below the stage and choose an on-screen apex. Setting velocity
// avoids collider mass changing the flight; Rapier supplies all downward motion.
export function createDiscFlight({ viewportHeight, isMobile, ceilingY = viewportHeight / 2, speed = 1, random = Math.random }) {
  const radius = (isMobile ? 0.4 : 0.5) * 1.05;
  const startY = -viewportHeight / 2 - radius - 0.1;
  const apexY = Math.min(viewportHeight * (0.1 + random() * 0.18), ceilingY - radius);
  return {
    startY,
    radius,
    // Scaling gravity with speed squared shortens the flight without raising its apex.
    velocityY: Math.sqrt(2 * -GAME_GRAVITY * Math.max(0, apexY - startY)) * speed,
    gravityScale: speed ** 2,
    spin: (random() < 0.5 ? -1 : 1) * (1 + random()) * GAME_SPEED,
  };
}

// DOM y grows down, while the game world's y grows up. Reserve a small gap
// below the entire score pill, including while it is hidden before first play.
// The paper's lower edge masks the game without changing its launch point.
export function scoreBoundary({ scoreBottom, canvasTop, canvasHeight, viewportHeight, stageBottom = Infinity }) {
  const inset = Math.max(0, Math.min(canvasHeight, scoreBottom + 8 - canvasTop));
  const bottomInset = Math.max(0, Math.min(canvasHeight - inset, canvasTop + canvasHeight - stageBottom));
  return { inset, bottomInset, ceilingY: viewportHeight * (0.5 - inset / canvasHeight), floorY: viewportHeight * (bottomInset / canvasHeight - 0.5) };
}

// Current streak resets on a miss; the browser's best survives it.
export function scoreAfterEvent(state, event) {
  if (event === 'slice') return { started: true, score: state.score + 1, best: Math.max(state.best || 0, state.score + 1) };
  if (event === 'miss' && state.score) return { ...state, score: 0 };
  if (event?.type === 'restore') return { ...state, best: Math.max(state.best || 0, event.best) };
  return state;
}

// Count visible, ready time, never wall-clock time spent offscreen or in a menu.
export function createSpawnSchedule({ spawn, interval, now = () => performance.now(), schedule = setTimeout, cancel = clearTimeout }) {
  let active = false;
  let timer = null;
  let remaining = 750;
  let started = 0;
  const arm = () => {
    started = now();
    timer = schedule(() => {
      timer = null;
      if (!active) return;
      spawn();
      remaining = interval();
      arm();
    }, remaining);
  };
  const setActive = (value) => {
    if (value === active) return;
    active = value;
    if (active) arm();
    else if (timer !== null) {
      remaining = Math.max(0, remaining - (now() - started));
      cancel(timer);
      timer = null;
    }
  };
  return { setActive, dispose: () => setActive(false) };
}
