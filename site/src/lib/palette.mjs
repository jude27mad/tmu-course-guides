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

/* Dark mode follows the device setting (prefers-color-scheme: dark); there is no toggle. It has one black, the ink:
   the page, the menu and the footer, every panel, card and pill, and the floor of the moving artwork behind the page.
   Structure comes from hairlines and type, never from a second black. The windows are holes in the ink, as in light
   mode: the Desk's cells, the course badge windows, the Courses card and the footer show the artwork's slow light
   bands through them, and each has a hairline edge. Selection is TMU Blue, as in light mode, and the one filled shape
   is the primary action. styles/colors.scss mirrors these values in its dark block (tests/dark-mode.test.mjs). */
export const DARK = Object.freeze({
  page: '#18181B', // the one black (the ink): page, panels, cards, pills, theme-color
  pageUnderGrain: '#18181B', // the colour Safari paints past the page's ends: the same ink
  text: '#F4F4F5',
  muted: '#A1A1AA', // secondary text on the still ink
  mutedOnArtwork: '#B4B4BB', // secondary text over the moving artwork (Menu, Search, the footer)
  border: '#3F3F46', // dividers and cards
  borderStrong: '#52525B', // pills, the tab bar and the glass controls
  windowEdge: '#63636B', // the edge of every window onto the artwork, and of the page shrunk beside Menu
  fieldEdge: '#71717A', // text inputs and the calendar's controls
  accent: '#85C0FF', // TMU Blue's hue on the ink: links, selected tabs and filters
  accentTint: '#1C3754', // TMU Blue as a tint: the fill of a selected tab or filter
  accentFill: '#004C9B', // TMU Blue itself: the primary action's fill
  onAccentFill: '#FFFFFF', // the primary action's label
  onAccent: '#18181B', // a label on an accent-coloured fill
  onTrack: '#85C0FF',
  soon: '#FBBF24',
  urgent: '#FCA5A5',
  done: '#4ADE80',
  pageEdge: '#63636B', // the shrunk page's edge beside Menu and Search, and on a sliding page (the window edge)
});
/* The brightest band of the background artwork (components/canvas/background/Background.jsx, SWEEP.glow and its
   noise): text over the artwork (Menu, Search, the footer, the windows) must read over it as well as over the ink. */
export const ARTWORK_GLOW = '#444444';

export const DARK_QUERY = '(prefers-color-scheme: dark)';
/* Whether the device asks for dark mode now (false outside a browser). */
export const prefersDark = () => typeof matchMedia === 'function' && matchMedia(DARK_QUERY).matches;
/* The edge drawn round the page while Menu or Search shrinks it, or while a page change slides it. The dark page is
   the same ink as the artwork's floor, so it takes the windows' edge. Behind a panel on a phone the shrunk page dims
   to 5%, where only the paper's light edge still shows, so `dimmed` keeps that. */
export const pageEdgeColor = (dimmed = false) => (prefersDark() && !dimmed ? DARK.pageEdge : TOKENS.page);

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
/* The badge in dark mode: the same print, with a soft light rim round the card and along the strap, so the lit ink
   card stands apart from the ink behind it (the edge every other object has in dark mode). */
export const BADGE_DARK = Object.freeze({ ...BADGE, rim: TOKENS.mutedOnDark });

/* The Desk's signal field (components/artwork/signalField.mjs): its panel, its points and the points a pulse
   lights. In dark mode the panel is left clear, so the field's points sit on the moving artwork that shows through
   the Desk's windows, and they are drawn in white: on the ink they need more light than on light mode's panel. */
export const FIELD = Object.freeze({ background: TOKENS.ink, point: TOKENS.mutedOnDark, signal: TOKENS.onDark });
export const FIELD_DARK = Object.freeze({ background: null, point: '#FFFFFF', signal: '#FFFFFF' });

/* "r, g, b" for canvases and translucent CSS (rgba(var(--inkRgb), 0.2)). */
export function rgbOf(hex) {
  return [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16)).join(', ');
}

/* The artwork's floor in dark mode: its darkest output is clamped to the page's ink, so a window onto it adds light
   and never a second black. Light mode leaves it at black (no clamp). As 0 to 1 channels, for the shader. */
export const ARTWORK_FLOOR = Object.freeze({
  light: [0, 0, 0],
  dark: rgbOf(DARK.page)
    .split(', ')
    .map((value) => Number(value) / 255),
});

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
