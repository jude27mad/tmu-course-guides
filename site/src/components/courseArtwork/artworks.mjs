// USGS / NASA Landsat 7, Earth as Art. Public domain; individual records,
// source URLs, image dates and crop details are in public/licenses/ARTWORK-CREDITS.md.
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
  cen100: artwork('cen100', 'namib-desert'),
  mth140: artwork('mth140', 'lambert-glacier'),
  mth141: artwork('mth141', 'lena-delta'),
});

// The glacier's broad spatial composition also fills the Desk before a course
// has resolved, or when no assessment remains. It asserts no course/date data.
export const FALLBACK_ARTWORK = ARTWORKS.mth140;
export function artworkFor(courseId) {
  return ARTWORKS[typeof courseId === 'string' ? courseId.toLowerCase() : ''] || FALLBACK_ARTWORK;
}
