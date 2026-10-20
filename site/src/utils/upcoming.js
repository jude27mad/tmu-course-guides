import { COURSES, deadlines, nextDeadline } from '@src/lib';

import { hrefFor } from '@src/utils/routes';
import { safeStorage } from '@src/utils/storage';

const codeOf = (courseId) => COURSES.find((course) => course.id === courseId)?.code || String(courseId || '').toUpperCase();

const toLink = (item) => ({
  id: `${item.courseId}-${item.id}`,
  title: item.title,
  code: codeOf(item.courseId),
  when: [item.dateLabel, item.timeLabel].filter(Boolean).join(' · '),
  href: item.href || hrefFor(item.courseId, item.anchor),
});

// The next `count` open items across the three courses (menu "Coming up"), in
// the data layer's due order: not done, not passed, dated (exact, day or quiz week).
export function upcomingAcrossCourses({ now = new Date(), count = 3 } = {}) {
  const storage = safeStorage();
  try {
    return COURSES.flatMap((course) => deadlines(course.id, { now, storage }) || [])
      .filter((item) => item && !item.done && !item.passed && Number.isFinite(item.sortKey ?? (item.due ? +new Date(item.due) : NaN)))
      .sort((a, b) => (a.sortKey ?? +new Date(a.due)) - (b.sortKey ?? +new Date(b.due)))
      .slice(0, count)
      .map(toLink);
  } catch (error) {
    return [];
  }
}

// The next item overall, or for one course (footer "Next deadline:"), or null.
export function nextAcrossCourses({ now = new Date(), courseId } = {}) {
  try {
    const item = nextDeadline({ now, courseId, storage: safeStorage() });
    return item ? toLink(item) : null;
  } catch (error) {
    return null;
  }
}
