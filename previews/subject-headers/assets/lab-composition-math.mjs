// Row-major 2 × 2 matrices. A then B is B·A for column vectors.
export const IDENTITY = Object.freeze([1, 0, 0, 1]);
export const OPERATIONS = Object.freeze({
  rotate: { label: 'Rotate 90°', short: 'Rotate', symbol: '↶', detail: 'Counterclockwise', matrix: [0, -1, 1, 0] },
  stretch: { label: 'Stretch ×2', short: 'Stretch', symbol: '↔', detail: 'Horizontal', matrix: [2, 0, 0, 1] },
  shear: { label: 'Shear', short: 'Shear', symbol: '▱', detail: 'x becomes x + y', matrix: [1, 1, 0, 1] },
  reflect: { label: 'Reflect', short: 'Reflect', symbol: '⇄', detail: 'Across the y-axis', matrix: [-1, 0, 0, 1] },
  collapse: { label: 'Collapse', short: 'Collapse', symbol: '↧', detail: 'Onto the x-axis', matrix: [1, 0, 0, 0] }
});
const clean = value => Math.abs(value) < 1e-12 ? 0 : value;
export function matrixMultiply(a, b) {
  return [a[0]*b[0]+a[1]*b[2], a[0]*b[1]+a[1]*b[3], a[2]*b[0]+a[3]*b[2], a[2]*b[1]+a[3]*b[3]].map(clean);
}
export function applyMatrix(m, p) { return [m[0]*p[0]+m[1]*p[1], m[2]*p[0]+m[3]*p[1]].map(clean); }
export function matrixDet(m) { return clean(m[0]*m[3]-m[1]*m[2]); }
export function compose(first, second) { return matrixMultiply(OPERATIONS[second].matrix, OPERATIONS[first].matrix); }
export function operationAt(key, progress) {
  const t = Math.max(0, Math.min(1, progress));
  if (t === 0) return [...IDENTITY];
  if (t === 1) return [...OPERATIONS[key].matrix];
  if (key === 'rotate') { const angle = t * Math.PI / 2; return [Math.cos(angle), -Math.sin(angle), Math.sin(angle), Math.cos(angle)].map(clean); }
  return OPERATIONS[key].matrix.map((v,i) => clean(IDENTITY[i] + (v - IDENTITY[i]) * t));
}
export function compositionAt(first, second, step, progress) {
  return step < 2 ? operationAt(first, progress) : matrixMultiply(operationAt(second, progress), OPERATIONS[first].matrix);
}
export function sameMatrix(a, b) { return a.every((v, i) => Math.abs(v-b[i]) < 1e-9); }

// One shared camera covers both operation orders and every playback stage.
export function cameraScale(first, second) {
  const corners = [[0,0],[1,0],[1,1],[0,1]];
  const candidates = [IDENTITY, OPERATIONS[first].matrix, OPERATIONS[second].matrix, compose(first,second), compose(second,first)];
  const radii = candidates.flatMap(m => corners.map(p => Math.hypot(...applyMatrix(m,p))));
  return 143 / (Math.max(2.65, ...radii) + .35);
}
