// Subject-specific photographs: engineering structures, integration and linear
// systems. Individual permissions/creators: public/licenses/ARTWORK-CREDITS.md.
const artwork = (id, name) =>
  Object.freeze({
    id,
    src: `/images/courses/${name}.webp`,
    smallSrc: `/images/courses/${name}-800.webp`,
    width: 1600,
    height: 1600,
    position: '50% 50%',
  });

const ARTWORKS = Object.freeze({
  cen100: artwork('cen100', 'engineering-bridge'),
  mth140: artwork('mth140', 'calculus-integral'),
  mth141: artwork('mth141', 'linear-equations'),
});

// The engineering structure also fills the Desk before a course has resolved,
// or when no assessment remains. It asserts no course/date data.
export const FALLBACK_ARTWORK = ARTWORKS.cen100;
export function artworkFor(courseId) {
  return ARTWORKS[typeof courseId === 'string' ? courseId.toLowerCase() : ''] || FALLBACK_ARTWORK;
}
