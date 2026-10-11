/* Pure geometry shared by the animated illustrations and their correctness tests. */
export const lerp = (a, b, t) => a + (b - a) * t;
export const point = ([x, y]) => `${x.toFixed(3)},${y.toFixed(3)}`;
export const path = points => 'M' + points.map(point).join('L');
export const calculusProject = (x, y, z = 0) => [230 + 65 * x + 8 * y, 205 - 5 * x - 38 * y - z];
export const algebraProject = (x, y, z = 0) => [125 + 94 * x + 23 * y, 199 - 11 * x - 78 * y - z];
export function secantState(t) {
  const x = lerp(1.85, 1, t);
  const slope = x + 1; // (x² - 1) / (x - 1), including its continuous limit at x = 1.
  return { x, y: x * x, slope, line: [.28, 1.95].map(v => [v, slope * (v - 1) + 1]) };
}
export function shearState(t) {
  const shear = .65 * t;
  return { shear, u: [1, 0], v: [shear, 1], square: [[0, 0], [1, 0], [1 + shear, 1], [shear, 1]] };
}
