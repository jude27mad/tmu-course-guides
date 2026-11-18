/* Every course record the guides read: the vendored math records (unchanged, see vendor/) plus CHY102 and PCS211,
   which were written for this site (content/science-data.mjs). Library code reads DATA from here, never from the
   vendored file directly, so the old site's records stay byte for byte as they were. */
import { COURSES as VENDOR } from './vendor/course-data.mjs';
import { SCIENCE } from './content/science-data.mjs';

export const DATA = Object.freeze({ ...VENDOR, ...SCIENCE });
/** CHY102 and PCS211: math-style guides with their own dates, grading and copy, and no section picker. */
export const isScience = (courseId) => Object.hasOwn(SCIENCE, courseId);
