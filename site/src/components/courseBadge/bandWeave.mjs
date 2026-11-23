// Adapted from React Bits Lanyard's buildWeaveTexture, David Haz.
// See public/licenses/React-Bits-Lanyard.txt. The ribbon's MeshLine material
// takes a single colour map, so bake the weave's relief into its print.
const TILE = 32;
let tile;
const profile = (offset) => Math.sqrt(Math.max(0, 1 - 4 * offset * offset));

function threadHeight(x, y) {
  // One seamless over-under repeat, with two threads along each axis.
  const u = ((x + TILE) % TILE) / (TILE / 2);
  const v = ((y + TILE) % TILE) / (TILE / 2);
  const across = u % 1 - 0.5;
  const along = v % 1 - 0.5;
  const over = (Math.floor(u) + Math.floor(v)) % 2 === 0;
  const warp = profile(across) * (0.55 + 0.45 * Math.cos(along * Math.PI * (over ? 1 : 0.6)));
  const weft = profile(along) * (0.55 + 0.45 * Math.cos(across * Math.PI * (over ? 0.6 : 1)));
  return over ? Math.max(warp, weft * 0.7) : Math.max(weft, warp * 0.7);
}

function makeTile() {
  const canvas = document.createElement('canvas');
  canvas.width = TILE;
  canvas.height = TILE;
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(TILE, TILE);
  for (let y = 0; y < TILE; y += 1) {
    for (let x = 0; x < TILE; x += 1) {
      const dx = threadHeight(x - 1, y) - threadHeight(x + 1, y);
      const dy = threadHeight(x, y - 1) - threadHeight(x, y + 1);
      const light = dx * 0.8 + dy * 0.6;
      const channel = light > 0 ? 255 : 0;
      const i = (y * TILE + x) * 4;
      image.data[i] = channel;
      image.data[i + 1] = channel;
      image.data[i + 2] = channel;
      image.data[i + 3] = Math.min(Math.abs(light) * 200, 84);
    }
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

export function paintBandWeave(ctx, width, height) {
  tile ??= makeTile();
  ctx.save();
  ctx.fillStyle = ctx.createPattern(tile, 'repeat');
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}
