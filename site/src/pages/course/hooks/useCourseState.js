import { buckets, courseCopy, courseInfo, courseTerm, deadlines, deskSnapshot, getCourse, getGroup, nextDeadline, setGroup as saveGroup, weeklyChecklist } from '@src/lib';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useNow, useProgress, useSection } from '@src/lib/react';

import { ScrollTrigger } from 'gsap/dist/ScrollTrigger';
import { scrollToHash } from '@src/utils/scrollToHash';

// Everything a course page shows, from '@src/lib' only. Static data (course,
// info, copy) is there for the exported HTML; time and saved progress arrive
// right after mount (`live` is null until then), so the HTML never bakes a
// build-time "now" or anyone's progress. An archived course (term.archived,
// static) has no section, group or deadlines: its `live` is empty from the
// first render, so nothing waits to load and the HTML matches the first render.
export const CourseContext = createContext(null);
export const useCourse = () => useContext(CourseContext);

// The section picker's anchor (Course info); "CHANGE SECTION" and the
// "Choose section for quiz date" prompts glide to it.
export const PICKER_ID = 'section-picker';
export const openPicker = () => scrollToHash({ hash: PICKER_ID });

export function useCourseState(courseId) {
  const course = getCourse(courseId);
  const term = useMemo(() => courseTerm(courseId), [courseId]);
  const archived = !!term?.archived;
  const now = useNow(60000);
  const progress = useProgress();
  const [savedSection, setSection] = useSection(courseId);
  const section = archived ? null : savedSection;
  const ready = !!now && progress.ready;
  const { version } = progress;

  const group = useMemo(
    () => (ready && courseId === 'cen100' && !archived ? getGroup('cen100') : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ready, version, courseId, archived],
  );
  const info = useMemo(() => (archived ? courseInfo(courseId) : courseInfo(courseId, { section: section ?? undefined, group: group ?? undefined })), [courseId, archived, section, group]);
  const copy = useMemo(() => courseCopy(courseId), [courseId]);

  const live = useMemo(
    () => {
      if (archived) return { now, items: [], buckets: { thisWeek: [], nextWeek: [], later: [], earlier: [] }, next: null, week: [], progress: null };
      if (!ready) return null;
      const items = deadlines(courseId, { now });
      const open = items.filter((item) => !item.done);
      return {
        now,
        items,
        buckets: buckets(open, now),
        next: nextDeadline({ now, courseId }),
        week: weeklyChecklist(courseId, { now }),
        progress: deskSnapshot({ now }).find((entry) => entry.course.id === courseId)?.progress || null,
      };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ready, now, version, courseId, section, archived],
  );

  // Mark done / Undo, with the old confirmation line ("Marked done: … Saved on this device.").
  const [status, setStatus] = useState({ message: '', itemId: null });
  const markDone = useCallback(
    (itemId) => {
      const result = progress.markDone(courseId, itemId);
      if (result.message) setStatus({ message: result.message, itemId });
      return result;
    },
    [progress, courseId],
  );
  const undo = useCallback(() => {
    const result = progress.undo();
    setStatus({ message: '', itemId: null });
    return result;
  }, [progress]);
  const pending = progress.ready ? progress.pendingUndo() : null;
  const pendingHere = pending && pending.courseId === courseId ? pending.itemId : null;
  // Another tab (or a completion checkbox) cancelled the Undo: drop its message too.
  useEffect(() => {
    if (!pendingHere && status.message) setStatus({ message: '', itemId: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingHere]);

  const setGroup = useCallback((value) => saveGroup('cen100', value), []);

  return useMemo(
    () => ({ courseId, course, term, info, copy, live, now, progress, version, section, setSection, group, setGroup, markDone, undo, pendingUndo: pendingHere, status }),
    [courseId, course, term, info, copy, live, now, progress, version, section, setSection, group, setGroup, markDone, undo, pendingHere, status],
  );
}

// A fragment typed or pasted into the address bar on this page (a native
// hashchange; Next's own links go through the router and Layout) still opens
// and glides to its card.
export function useNativeHash() {
  useEffect(() => {
    const onHashChange = () => scrollToHash();
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);
}

// Keeps pinned columns and scroll animations in place when the page grows or
// shrinks (a card opens, data arrives, a section changes).
export function useScrollRefresh() {
  const last = useRef(0);
  useEffect(() => {
    const container = document.getElementById('mainContainer');
    if (!container || typeof ResizeObserver === 'undefined') return undefined;
    let timer = 0;
    const observer = new ResizeObserver(() => {
      const height = Math.round(container.getBoundingClientRect().height);
      if (Math.abs(height - last.current) < 2) return;
      last.current = height;
      clearTimeout(timer);
      timer = setTimeout(() => ScrollTrigger.refresh(), 250);
    });
    observer.observe(container);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, []);
}

// The CEN100 check-step list id for a deadline (`m2` for `outline`), or the math assessment id.
export const itemOf = (entry) => entry?.item || entry?.itemId || entry?.id;
