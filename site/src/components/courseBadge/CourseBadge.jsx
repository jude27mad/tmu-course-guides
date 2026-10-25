/* eslint-disable import/extensions */
import { BADGE, getCourse } from '@src/lib';
import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import dynamic from 'next/dynamic';
import clsx from 'clsx';
import useStill from '@src/hooks/useStill';
import { useBadgeRegistry } from './BadgeProvider';
import styles from './badge.module.scss';

const BadgeView = dynamic(() => import('./BadgeScene').then((module) => module.BadgeView), { ssr: false });

export default function CourseBadge({ instanceId, courseId, next, ready = true, className }) {
  const registry = useBadgeRegistry();
  const state = useSyncExternalStore(registry.subscribe, registry.getState, registry.getState);
  const entry = state.entries.find((item) => item.id === instanceId);
  const root = useRef();
  const still = useStill();
  const course = getCourse(courseId);
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
    registry.register(instanceId, { element: root.current });
    return () => registry.unregister(instanceId);
  }, [registry, instanceId]);

  useEffect(() => registry.update(instanceId, { courseId }), [registry, instanceId, courseId]);

  useEffect(() => {
    let intersecting = false;
    let swing = false;
    const update = () => registry.update(instanceId, { visible: intersecting && !document.hidden, swing });
    const observer = new IntersectionObserver(
      ([item]) => {
        intersecting = item.isIntersecting;
        swing = item.intersectionRatio >= 0.7;
        update();
      },
      { threshold: [0, 0.7] },
    );
    observer.observe(root.current);
    document.addEventListener('visibilitychange', update);
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', update);
    };
  }, [registry, instanceId]);

  return (
    <div ref={root} className={clsx(styles.root, className)} data-course-badge={courseId} data-badge-instance={instanceId} aria-hidden="true">
      <div className={styles.fallback} data-badge-fallback>
        <strong>{course.code}</strong>
        <span>{course.name}</span>
      </div>
      {entry && <BadgeView entry={entry} look={look} rest={still} />}
    </div>
  );
}
