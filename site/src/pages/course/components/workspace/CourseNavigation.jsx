import { useRef } from 'react';
import Link from 'next/link';
import useSelectionMotion from './useSelectionMotion';
import styles from './workspace.module.scss';

// This is decoration only. Links/history remain owned by useCourseNavigation.
export default function CourseNavigation({ courseId, views, selectedView, acknowledge }) {
  const navRef = useRef(null);
  const selectionRef = useRef(null);
  useSelectionMotion(navRef, selectionRef, selectedView, '[aria-current="page"]');

  return (
    <nav ref={navRef} className={styles.navigation} aria-label="Course views" data-glass="light">
      <span ref={selectionRef} className={styles.selection} aria-hidden="true" data-course-selection />
      {views.map(([view, label]) => (
        <Link
          key={view}
          href={`/${courseId}/#${view === 'info' ? 'course-info' : view}`}
          scroll={false}
          aria-current={selectedView === view ? 'page' : undefined}
          onClick={(event) => {
            if (!event.defaultPrevented && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
              acknowledge(view === 'info' ? 'course-info' : view);
            }
          }}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
