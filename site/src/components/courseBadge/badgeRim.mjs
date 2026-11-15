/* The sizes of the badge's printed faces, and the width of the light rim dark mode paints into them (BADGE_DARK in
   lib/palette.mjs). The rim should read as a soft hairline, about one screen pixel, however large the badge is shown,
   so its width in texels follows the size of the badge's element. Plain numbers, without three.js, so CourseBadge
   can work it out before the 3D layer loads. */
export const CARD_WIDTH = 512;
export const CARD_HEIGHT = 720; // 1.6 x 2.25, the card's own proportions
export const BAND_WIDTH = 1024;
export const BAND_HEIGHT = 256; // across the strap

/* How BadgeScene frames each badge: a camera 10 units away with a 25 degree vertical field of view fills the badge's
   element. The card is 1.6 units wide, so its width on screen is a share of the element's height. The strap is a
   MeshLine (lineWidth 1, resolution [1, 1]), a twentieth of the element's width across. */
const VIEW_HEIGHT = 2 * 10 * Math.tan((25 / 2) * (Math.PI / 180));
export const CARD_SHARE = 1.6 / VIEW_HEIGHT;
export const STRAP_SHARE = 1 / 20;

const RIM_PX = 1.25; // the rim's width on screen, in CSS pixels
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

/* The rim's width in texels on the card and on the strap, for a badge element `width` x `height` CSS pixels. */
export function rimTexels(width, height) {
  const card = clamp(Math.round((RIM_PX * CARD_WIDTH) / Math.max(1, CARD_SHARE * height)), 2, 8);
  const band = clamp(Math.round((RIM_PX * BAND_HEIGHT) / Math.max(1, STRAP_SHARE * width)), 4, 18);
  return { card, band };
}
