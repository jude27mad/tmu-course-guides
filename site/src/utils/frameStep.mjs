// Giats's motion constants were tuned per rendered frame at 60 Hz. A 120 Hz
// display renders twice as many frames, so each frame applies the constants
// for the time it actually covers. At exactly one 60 Hz frame every helper
// returns the original per-frame value unchanged.

// The number of 60 Hz frames a frame of `deltaSeconds` covers: 1 at 60 Hz,
// 0.5 at 120 Hz. A long frame (a stall, a tab switch) counts as at most `max`.
export function frameSteps(deltaSeconds, max = 3) {
  if (!(deltaSeconds > 0)) return 0;
  return Math.min(deltaSeconds * 60, max);
}

// `x += (target - x) * factor` applied once per 60 Hz frame, for `steps` frames.
export function easeFor(factor, steps) {
  return steps === 1 ? factor : 1 - (1 - factor) ** steps;
}

// `x *= factor` applied once per 60 Hz frame, for `steps` frames.
export function decayFor(factor, steps) {
  return steps === 1 ? factor : factor ** steps;
}
