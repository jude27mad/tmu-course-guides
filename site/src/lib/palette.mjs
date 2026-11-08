/* The site's one palette: neutral zinc with a single TMU Blue accent, used by every page, card, badge and
   generated texture. styles/colors.scss mirrors these values as CSS variables; tests/palette.test.mjs keeps the
   two in step. Proportions: page 60%, ink panels 30%, accent 10% (small, meaningful elements only). */
export const TOKENS = Object.freeze({
  page: '#F4F4F5', // page background
  pageUnderGrain: '#F1F1F1', // the page as seen through its film grain (an iPhone shows #F4F4F5 under it as this)
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
  fluid: '#D7D7D4', // Giats's original pointer-fluid dye, kept separate from the neutral UI
  onTrack: '#004C9B', // countdown: more than 72 hours left
  soon: '#B45309', // countdown: 72 hours or less
  urgent: '#B91C1C', // countdown: 24 hours or less
  done: '#15803D', // countdown: completed
  text: '#18181B', // text on the page and on light cards (the ink's colour, not its panels)
  panelText: '#F4F4F5', // text and icons on the dark panels (menu, search, footer, course cards)
  onAccent: '#FFFFFF', // a label on an accent fill
});

/* Dark mode follows the device setting (prefers-color-scheme: dark); there is no toggle. Only the page, and
   what sits on it, changes: the dark panels, the artwork behind the page, the badges and the signal field
   keep their colours. styles/colors.scss mirrors these values in its dark block (tests/dark-mode.test.mjs). */
export const DARK = Object.freeze({
  page: '#262629', // graphite paper: lighter than the artwork, so the windows onto it still read as recesses
  pageUnderGrain: '#27272A', // the page as seen through the dark film grain (public/other/grain-dark.png)
  text: '#F4F4F5',
  card: '#2F2F33', // cards, pills and light glass, raised above the page
  muted: '#A1A1AA',
  border: '#3F3F46',
  accent: '#66B0FF', // TMU Blue's hue, lifted for a dark page
  accentTint: '#1C3754',
  onAccent: '#18181B',
  onTrack: '#66B0FF',
  soon: '#FBBF24',
  urgent: '#F87171',
  done: '#4ADE80',
  pageEdge: '#71717A', // the shrunk page's edge beside Menu and Search (the paper's own colour would vanish)
});

export const DARK_QUERY = '(prefers-color-scheme: dark)';
/* Whether the device asks for dark mode now (false outside a browser). */
export const prefersDark = () => typeof matchMedia === 'function' && matchMedia(DARK_QUERY).matches;
/* The edge drawn round the page while Menu or Search shrinks it. */
export const pageEdgeColor = () => (prefersDark() ? DARK.pageEdge : TOKENS.page);

/* The printed colours of the lanyard ID badge (card, clip slot, strap, metal clip).
   Identical for every course; only the text differs. The game uses original emoji artwork. */
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
