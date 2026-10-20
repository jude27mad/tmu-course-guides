// Route helpers shared by the shell (Layout, Loader, navbar, footer).

// The path a route transition is keyed on: asPath without #hash and ?query,
// so in-page anchors (#assignment-m2) never trigger the curtain, while
// /cen100/ -> /mth140/ (one dynamic route) still does.
export const pathKey = (asPath = '/') => {
  const path = String(asPath).split('#')[0].split('?')[0] || '/';
  return path.endsWith('/') ? path : `${path}/`;
};

// Course id for /cen100/, /mth140/, /mth141/ (null elsewhere).
export const COURSE_IDS = ['cen100', 'mth140', 'mth141'];
export const courseIdFromPath = (asPath) => {
  const first = pathKey(asPath).split('/')[1];
  return COURSE_IDS.includes(first) ? first : null;
};

// Item deep links look like '/cen100/#assignment-m2', 'cen100/#…', '#…' or a bare anchor id.
export const hrefFor = (courseId, anchor) => {
  const base = courseId ? `/${courseId}/` : '/';
  if (!anchor) return base;
  const hash = String(anchor).replace(/^#/, '');
  return `${base}#${hash}`;
};
