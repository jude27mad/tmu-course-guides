import { deskSnapshot, nextDeadline } from '@src/lib';
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
    if (!now) return { ready: false, now: null, courses: [], next: undefined, progress };
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
    return { ready: true, now, courses, next, progress };
  }, [now, progress]);
}

// The snapshot entry for one course (or undefined before mount).
export const entryFor = (desk, courseId) => desk?.courses?.find((entry) => entry.course?.id === courseId);
