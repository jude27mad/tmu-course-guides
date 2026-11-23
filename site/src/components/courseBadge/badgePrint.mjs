// Line drawings in a 400 × 180 artboard. The HTML and WebGL passes use the same print.
const DIAGRAMS = {
  CEN100: {
    // Two Warren trusses, tied together by the deck and transverse top beams.
    tint: 'M20 129 53 68h264l33 61-24 15H8Z M53 68l25-16h265l-26 16Z',
    fine: 'M20 129l25-16h329l-24 16M45 113l33-61h265l31 61M78 52l33 61 33-61 33 61 33-61 33 61 33-61 33 61 34-61M53 68l25-16m41 16 25-16m41 16 25-16m41 16 25-16m41 16 26-16M86 129l25-16m41 16 25-16m41 16 25-16m41 16 25-16',
    main: 'M20 129 53 68h264l33 61H20ZM53 68l33 61 33-61 33 61 33-61 33 61 33-61 33 61 33-61',
    detail: 'M16 137h339m-331 4-5 8h10Zm320 0-5 8h10ZM13 154h21m299 0h22',
  },
  MTH140: {
    // A quadratic and its tangent at t = 0.6.
    tint: 'M31 148Q107.2 157.6 203.92 111.04V152H31Z',
    fine: 'M64 26v126m72-126v126m72-126v126m72-126v126m72-126v126M32 55h334M32 104h334',
    detail: 'M32 158V18m-6 8 6-8 6 8M23 152h348m-9-6 9 6-9 6 M91 165.4 313 58.5',
    main: 'M31 148Q158 164 342 24',
    solid: 'M210.92 111.04a7 7 0 1 1-14 0 7 7 0 0 1 14 0',
  },
  MTH141: {
    // A transformed unit square and its two basis vectors.
    tint: 'M94 144l156-25 59-80-156 25Z',
    fine: 'M23 42h346M23 93h346M23 144h346M49 20v137m67-137v137m67-137v137m67-137v137m67-137v137',
    detail: 'M123.5 104l156-25M146 135.7l59-80M198 127.3l59-80 M250 119l59-80-156 25',
    main: 'M94 144 250 119m-15-6 15 6-12 10 M94 144l59-80m-13 5 13-5-1 14',
    solid: 'M100 144a6 6 0 1 1-12 0 6 6 0 0 1 12 0',
  },
  CHY102: {
    // Methane: a solid wedge and a hashed wedge distinguish the out-of-plane bonds.
    tint: 'M67 106a26 26 0 1 1-52 0 26 26 0 0 1 52 0 M301 41a25 25 0 1 1-50 0 25 25 0 0 1 50 0 M369 121a26 26 0 1 1-52 0 26 26 0 0 1 52 0 M173 147a24 24 0 1 1-48 0 24 24 0 0 1 48 0',
    main: 'M72 101l80-16m60 3 100 26',
    solid: 'M201 73l48-29 5 12Z',
    detail: 'M171 99l5 2m-12 6 8 4m-16 6 12 6 M50 98v16m-10-16v16m0-8h10 M281 33v16m-10-16v16m0-8h10 M348 113v16m-10-16v16m0-8h10 M154 139v16m-10-16v16m0-8h10',
    atom: 'M191 73c-4-5-12-6-17-2-6 5-6 16 0 21 5 4 13 3 17-2',
  },
  PCS211: {
    // Ideal projectile path with tangential velocity vectors on ascent and descent.
    tint: 'M32 148Q188-74 344 148Z',
    fine: 'M32 152V22m-6 8 6-8 6 8M23 152h344m-8-6 8 6-8 6 M188 43v109',
    main: 'M32 148Q188-74 344 148',
    detail: 'M111 64l40-28-11 1m11-1-4 11 M266 64l40 28-4-11m4 11-12-1 M188 46v38m-6-7 6 7 6-7',
    solid: 'M117 64a6 6 0 1 1-12 0 6 6 0 0 1 12 0 M272 64a6 6 0 1 1-12 0 6 6 0 0 1 12 0',
  },
};

const STROKES = {
  tint: { fill: true, opacity: 0.13 },
  fine: { weight: 2, opacity: 0.28 },
  detail: { weight: 3.5 },
  main: { weight: 6 },
  solid: { fill: true },
  atom: { weight: 4.5 },
};

export const subjectArt = (code) => Object.entries(DIAGRAMS[code] || {}).map(([kind, path]) => ({
  ...STROKES[kind], path,
}));

export const PRINT_FONT = '"Inter Display", system-ui, sans-serif';
export const DRAWING = { x: 28, y: 322, scale: 1.14 };
export const FOOTER_Y = 566;
export const FONT_MARGIN = 36;
export const TEXT_WIDTH = 440;

// Layout uses logical print coordinates, independent of texture density.
export function printLines({ code, name, nextLabel, nextValue, color, onAccent }) {
  return [
    { text: 'GUIDES', x: FONT_MARGIN, y: 113, size: 27, weight: 750, ink: color },
    { text: 'COURSE PASS', x: 476, y: 112, size: 18, weight: 600, ink: color, end: true },
    { text: code, x: FONT_MARGIN - 3, y: 246, size: 116, weight: 750, ink: color, fitWidth: TEXT_WIDTH },
    { text: name, x: FONT_MARGIN, y: 293, size: 39, weight: 550, ink: color, fitWidth: name.length > 23 ? TEXT_WIDTH : undefined },
    { text: nextLabel, x: FONT_MARGIN, y: 613, size: 21, weight: 600, ink: onAccent },
    { text: nextValue, x: FONT_MARGIN, y: 680, size: nextValue.length > 18 ? 40 : 48, weight: 650, ink: onAccent, fitWidth: nextValue.length > 18 ? TEXT_WIDTH : undefined },
  ];
}
