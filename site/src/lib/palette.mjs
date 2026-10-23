/* The site's one palette: neutral zinc with a single TMU Blue accent, used by every page, card, badge and
   generated texture. styles/colors.scss mirrors these values as CSS variables; tests/palette.test.mjs keeps the
   two in step. Proportions: page 60%, ink panels 30%, accent 10% (small, meaningful elements only). */
export const TOKENS = Object.freeze({
  page: '#F4F4F5', // page background
  ink: '#18181B', // dark panels and primary text
  raised: '#27272A', // a raised tile on a dark panel
  sheen: '#3F3F46', // the brightest point of a dark panel's sheen
  card: '#FFFFFF', // cards on dark panels, light pills
  onDark: '#FAFAFA', // text on dark
  muted: '#71717A', // muted text on light
  mutedOnDark: '#A1A1AA', // muted text on dark
  border: '#E4E4E7', // borders on light
  borderOnDark: '#3F3F46', // borders on dark
  accent: '#004C9B', // TMU Blue
  accentTint: '#E6EEF7', // badge background for the accent
  fluid: '#E4E4E7', // the pointer fluid's dye
  onTrack: '#004C9B', // countdown: more than 72 hours left
  soon: '#B45309', // countdown: 72 hours or less
  urgent: '#B91C1C', // countdown: 24 hours or less
  done: '#15803D', // countdown: completed
});

/* The printed colours of the generated 3D artwork: the lanyard ID badge (card, clip slot, strap, metal clip)
   and the prefooter's course discs. Identical for every course; only the text differs. */
export const BADGE = Object.freeze({
  background: TOKENS.ink, // the badge card and its edge
  color: TOKENS.onDark, // course code and next date
  secondary: TOKENS.mutedOnDark, // index, term, name, "Next"
  divider: TOKENS.borderOnDark, // the hairline above the next date
  slot: TOKENS.raised, // the clip slot
  strap: TOKENS.raised, // the lanyard band
  strapColor: TOKENS.mutedOnDark, // the course code printed on the band
  clip: TOKENS.mutedOnDark, // the metal clip
});
export const DISC = Object.freeze({ background: TOKENS.ink, color: TOKENS.onDark, ring: TOKENS.borderOnDark });

/* "r, g, b" for canvases and translucent CSS (rgba(var(--inkRgb), 0.2)). */
export function rgbOf(hex) {
  return [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16)).join(', ');
}

/* The countdown's status from the time left (ms) or completion; null when nothing is counting down. */
export const STATUS = Object.freeze({
  onTrack: { color: TOKENS.onTrack, label: 'On track' },
  soon: { color: TOKENS.soon, label: 'Due soon' },
  urgent: { color: TOKENS.urgent, label: 'Due within 24 hours' },
  done: { color: TOKENS.done, label: 'Done' },
});
const HOUR = 3600000;
export function countdownStatus({ ms, done = false } = {}) {
  if (done) return 'done';
  if (!Number.isFinite(ms) || ms <= 0) return null;
  if (ms <= 24 * HOUR) return 'urgent';
  if (ms <= 72 * HOUR) return 'soon';
  return 'onTrack';
}
