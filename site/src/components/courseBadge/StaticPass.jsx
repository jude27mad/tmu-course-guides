import { DRAWING, FONT_MARGIN, FOOTER_Y, PRINT_FONT, printLines, subjectArt } from './badgePrint.mjs';
import { CARD_HEIGHT, CARD_WIDTH } from './badgeRim.mjs';

// A vector print for the server export and browsers without WebGL. No canvas or font request is needed to show it.
export default function StaticPass({ look }) {
  const { accent, background, code, color, strap } = look;
  return (
    <svg viewBox={`0 0 ${CARD_WIDTH} ${CARD_HEIGHT}`} aria-hidden="true" focusable="false">
      <rect width={CARD_WIDTH} height={CARD_HEIGHT} fill={background} />
      <rect x="202" y="31" width="108" height="22" rx="11" fill={strap} />
      <rect x={FONT_MARGIN} y="132" width={CARD_WIDTH - 2 * FONT_MARGIN} height="2" fill={color} opacity="0.36" />
      <g transform={`translate(${DRAWING.x} ${DRAWING.y}) scale(${DRAWING.scale})`} strokeLinecap="round" strokeLinejoin="round">
        {subjectArt(code).map(({ path, fill, weight, opacity }) => (
          <path key={path} d={path} fill={fill ? accent : 'none'} stroke={fill ? 'none' : accent} strokeWidth={weight} opacity={opacity} />
        ))}
      </g>
      <rect y={FOOTER_Y} width={CARD_WIDTH} height={CARD_HEIGHT - FOOTER_Y} fill={accent} />
      {printLines(look).map(({ text, x, y, size, weight, ink, end, fitWidth }) => (
        <text key={y} x={x} y={y} fontFamily={PRINT_FONT} fontSize={size} fontWeight={weight} textLength={fitWidth} lengthAdjust="spacingAndGlyphs" textAnchor={end ? 'end' : 'start'} fill={ink}>
          {text}
        </text>
      ))}
    </svg>
  );
}
