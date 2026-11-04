/* eslint-disable import/extensions */
import { BADGE, getCourse } from '@src/lib';
import { useEffect, useMemo, useRef } from 'react';
import clsx from 'clsx';
import { useBadgeRegistry } from './BadgeProvider';
import styles from './badge.module.scss';

// The bottom line of the card: the next date, or for an archived course (lib/terms.mjs) its status. An archived
// course has no deadlines, so its card reads the same before and after mount; the term above stays the course's.
function nextLine(course, date, ready) {
  if (course.archived) return { nextLabel: 'Status', nextValue: 'Archived' };
  return { nextLabel: 'Next', nextValue: ready ? date || 'No upcoming deadlines' : 'Open guide' };
}

export default function CourseBadge({ instanceId, courseId, motionGroup, next, ready = true, className }) {
  const registry = useBadgeRegistry();
  const root = useRef();
  const course = getCourse(courseId);
  const look = useMemo(
    () => ({
      ...BADGE,
      index: course.index,
      code: course.code,
      name: course.name,
      term: course.term,
      ...nextLine(course, next?.dateLabel || next?.when, ready),
    }),
    [course, next?.dateLabel, next?.when, ready],
  );

  useEffect(() => {
    registry.register(instanceId, { element: root.current, motionGroup });
    return () => registry.unregister(instanceId);
  }, [registry, instanceId, motionGroup]);

  useEffect(() => registry.update(instanceId, { courseId, look }), [registry, instanceId, motionGroup, courseId, look]);

  useEffect(() => {
    let intersecting = false;
    let swing = false;
    const update = () => registry.update(instanceId, { visible: intersecting && !document.hidden, swing });
    const observer = new IntersectionObserver(
      ([item]) => {
        intersecting = item.isIntersecting;
        swing = item.isIntersecting; // Giats uses isIntersecting, not a ratio cutoff.
        update();
      },
      { threshold: 0.7 },
    );
    observer.observe(root.current);
    document.addEventListener('visibilitychange', update);
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', update);
    };
  }, [registry, instanceId, motionGroup]);

  return (
    <div ref={root} className={clsx(styles.root, className)} data-course-badge={courseId} data-badge-instance={instanceId} aria-hidden="true">
      <div className={styles.fallback} data-badge-fallback>
        <strong>{course.code}</strong>
        <span>{course.name}</span>
      </div>
    </div>
  );
}
