// Only this game's ballistic motion slows down. The fixed physics step stays 1/60.
export const GAME_SPEED = 0.85;
export const GAME_GRAVITY = -15 * GAME_SPEED ** 2;
export const GAME_MAX_AGE = 7 / GAME_SPEED;

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
