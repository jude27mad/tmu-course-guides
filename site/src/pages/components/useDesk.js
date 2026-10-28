import { COURSE_IDS, deadlines, deskSnapshot, nextDeadline } from '@src/lib';
import { useNow, useProgress } from '@src/lib/react';

import { useMemo } from 'react';

// The Desk's live data (old index.html + night/desk.mjs): each course's next
// deadline, saved section and completion counts, plus the overall next item.
// Recomputed on each wall-clock minute, on tab return, and after any saved
// change here or in another tab (Mark done, Undo, a section chosen on a course
// page). Before mount (and in the exported HTML) `ready` is false: the static
// text shows and nothing bakes in a build-time "now" or anyone's progress.
export default function useDesk() {
  const now = useNow(60000);
  const progress = useProgress();

  return useMemo(() => {
    if (!now) return { ready: false, now: null, courses: [], next: undefined, alsoDue: [], progress };
    let courses = [];
    let next = null;
    try {
      courses = deskSnapshot({ now }) || [];
    } catch (error) {
      courses = [];
    }
    try {
      next = nextDeadline({ now });
    } catch (error) {
      next = null;
    }
    // Other open records due at the very same instant as the next one (FMEA and Personal Reflection 1
    // both at 11:59 PM): the Desk names them under it rather than hiding them until the first is done.
    let alsoDue = [];
    try {
      if (next?.target?.precision === 'exact') {
        alsoDue = COURSE_IDS.flatMap((id) => deadlines(id, { now })).filter(
          (item) => item.markable && !item.done && item.target?.at === next.target.at && !(item.courseId === next.courseId && item.id === next.id),
        );
      }
    } catch (error) {
      alsoDue = [];
    }
    return { ready: true, now, courses, next, alsoDue, progress };
  }, [now, progress]);
}

// The snapshot entry for one course (or undefined before mount).
export const entryFor = (desk, courseId) => desk?.courses?.find((entry) => entry.course?.id === courseId);
