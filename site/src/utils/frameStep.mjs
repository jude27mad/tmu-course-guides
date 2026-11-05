// Giats's motion constants were tuned per rendered frame at 60 Hz. A 120 Hz
// display renders twice as many frames, so each frame applies the constants
// for the share of a 60 Hz frame it covers.

// The share of one 60 Hz frame that a frame of `deltaSeconds` covers: 0.5 at
// 120 Hz. Frames from about 70 Hz down, stalls and unknown deltas count as
// exactly one, so 60 Hz displays keep the original motion bit for bit,
// including their timing jitter and dropped frames.
export function frameShare(deltaSeconds) {
  const share = deltaSeconds * 60;
  return share > 0 && share < 0.85 ? share : 1;
}

// `x += (target - x) * factor` applied once per 60 Hz frame, for `share` of one.
export function easeFor(factor, share) {
  return share === 1 ? factor : 1 - (1 - factor) ** share;
}

// `x *= factor` applied once per 60 Hz frame, for `share` of one.
export function decayFor(factor, share) {
  return share === 1 ? factor : factor ** share;
}
