// Only this game's ballistic motion slows down. The fixed physics step stays 1/60.
export const GAME_SPEED = 0.85;
export const GAME_GRAVITY = -15 * GAME_SPEED ** 2;
export const GAME_MAX_AGE = 7 / GAME_SPEED;

// Start just below the stage and choose an on-screen apex. Setting velocity
// avoids collider mass changing the flight; Rapier supplies all downward motion.
export function createDiscFlight({ viewportHeight, isMobile, random = Math.random }) {
  const radius = isMobile ? 0.4 : 0.5;
  const startY = -viewportHeight / 2 - radius - 0.1;
  const apexY = viewportHeight * (0.1 + random() * 0.18);
  return {
    startY,
    radius,
    velocityY: Math.sqrt(2 * -GAME_GRAVITY * (apexY - startY)),
    spin: (random() < 0.5 ? -1 : 1) * (1 + random()) * GAME_SPEED,
  };
}

// Session-only game feedback, entirely separate from saved course progress.
export function scoreAfterEvent(state, event) {
  if (event === 'slice') return { started: true, score: state.score + 1 };
  if (event === 'miss' && state.score) return { ...state, score: 0 };
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
