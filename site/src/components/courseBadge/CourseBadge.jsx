/* eslint-disable import/extensions */
import { BADGE, getCourse } from '@src/lib';
import { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import useWebGL from '@src/hooks/useWebGL';
import { useBadgeRegistry } from './BadgeProvider';
import styles from './badge.module.scss';

// Where the 3D badge can draw, its HTML card waits this long for it (ms) before
// fading in. The card used to show at once and then vanish when the badge drew,
// a pale box popping in each window of a page that had just arrived.
const DRAW_GRACE_MS = 2500;

export default function CourseBadge({ instanceId, courseId, motionGroup, next, ready = true, className }) {
  const registry = useBadgeRegistry();
  const root = useRef();
  const course = getCourse(courseId);
  // null during the server render and hydration: the card shows, as it must
  // without JavaScript. false (no WebGL, or the 3D layer failed): it shows at once.
  const webgl = useWebGL();
  // Worked out while rendering, so a badge that changes course (the Desk's next
  // deadline) waits again from the same commit that brings the new course.
  const [waitedFor, setWaitedFor] = useState(null);
  const waiting = waitedFor !== courseId;
  useEffect(() => {
    const timer = setTimeout(() => setWaitedFor(courseId), DRAW_GRACE_MS);
    return () => clearTimeout(timer);
  }, [courseId]);
  const look = useMemo(
    () => ({
      ...BADGE,
      index: course.index,
      code: course.code,
      name: course.name,
      term: course.term,
      nextLabel: 'Next',
      nextValue: ready ? next?.dateLabel || next?.when || 'No upcoming deadlines' : 'Open guide',
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
    <div ref={root} className={clsx(styles.root, className)} data-course-badge={courseId} data-badge-instance={instanceId} data-badge-pending={webgl && waiting ? '' : undefined} aria-hidden="true">
      <div className={styles.fallback} data-badge-fallback>
        <strong>{course.code}</strong>
        <span>{course.name}</span>
      </div>
    </div>
  );
}
