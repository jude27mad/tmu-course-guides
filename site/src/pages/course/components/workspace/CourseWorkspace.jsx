import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { assignmentList, countdown, countdownStatus, groups, sections } from '@src/lib';
import CourseBadge from '@src/components/courseBadge/CourseBadge';
import GuideTools from '@src/pages/course/components/tools/GuideTools';
// eslint-disable-next-line import/extensions
import { openGuideTools } from '@src/pages/course/components/tools/dialog.mjs';
import { useCourse } from '@src/pages/course/hooks/useCourseState';
import useCourseNavigation from './useCourseNavigation';
import CourseNavigation from './CourseNavigation';
import Work from './Work';
import AssignmentDetail from './AssignmentDetail';
import Study from './Study';
import CourseInformation from './CourseInformation';
import Schedule from './Schedule';
import styles from './workspace.module.scss';

// Time left, in the Desk's countdown wording and status colours: "23h 47m left" for a
// confirmed time, "Today" / "Tomorrow" / "In 3 days" for a date without one. Nothing
// for quiz weeks, pending dates or passed times, which the date line already words.
function timeLeft(next, now) {
  if (!next || !now) return null;
  const left = countdown(next, now);
  const status = countdownStatus({ ms: left.ms, done: next.done });
  if (status && status !== 'done') return { label: `${left.label} left`, status };
  if (/^(Today|Tomorrow|In \d+ days)$/.test(left.label)) return { label: left.label, status: null };
  return null;
}

export default function CourseWorkspace() {
  const { courseId, course, info, live, section, setSection, group, setGroup, progress } = useCourse();
  const navigation = useCourseNavigation(courseId, info);
  const [schedule, setSchedule] = useState({
    choice: null,
    range: 'upcoming',
    day: null,
    selectedDate: null,
  });
  const assignments = useMemo(() => (live ? assignmentList(courseId, { now: live.now, items: live.items }) : null), [live, courseId]);
  const views = [['work', 'Work'], ['schedule', 'Schedule'], ...(courseId === 'cen100' ? [] : [['study', 'Study']]), ['info', 'Course info']];
  const next = live?.next;
  const left = timeLeft(next, live?.now);
  const completed = live?.progress?.completed || 0;
  const total = live?.progress?.total || 0;
  return (
    <div className={styles.root}>
      <div className={styles.courseHeader}>
        <div className={styles.headingCopy}>
          <p className={styles.eyebrow}>
            {course.code} <span> / {course.term}</span>
          </p>
          <h1>{course.name}</h1>
          <p className={styles.headerNote}>Your course, at a glance.</p>
        </div>
        <div className={styles.artwork}>
          <CourseBadge instanceId={`header-${courseId}`} courseId={courseId} next={next} ready={!!live} />
        </div>
      </div>
      <div className={styles.body}>
        <CourseNavigation courseId={courseId} views={views} selectedView={navigation.selectedView} acknowledge={navigation.acknowledge} />
        {navigation.opening &&
          createPortal(
            <p className={styles.viewStatus} role="status" data-view-status>
              {`Opening ${navigation.opening.item?.title || views.find(([view]) => view === navigation.opening.view)?.[1] || 'details'}…`}
            </p>,
            document.body,
          )}
        <div className={styles.utilities}>
          <div className={styles.sectionControls}>
            <label className={styles.selectLabel} htmlFor="course-section">
              Section
              <select id="course-section" aria-label="Course section" value={section || ''} disabled={!progress.ready} onChange={(e) => setSection(e.target.value)}>
                <option value="">Choose section</option>
                {sections(courseId).map((row) => (
                  <option value={row.value} key={row.value}>
                    {row.label}
                  </option>
                ))}
              </select>
            </label>
            {courseId === 'cen100' && section ? (
              <label className={styles.selectLabel} htmlFor="course-group">
                Group
                <select id="course-group" aria-label="Innovation Challenge group" value={group || ''} onChange={(e) => setGroup(e.target.value)}>
                  <option value="">Choose group</option>
                  {groups(section).map((row) => (
                    <option key={row.value} value={row.value}>
                      {row.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
          <div className={styles.actions}>
            <a href="https://courses.torontomu.ca/" target="_blank" rel="noopener noreferrer">
              D2L ↗
            </a>
            <button type="button" className={styles.toolsButton} data-glass="light" onClick={() => openGuideTools()} aria-haspopup="dialog" aria-controls="guide-tools">
              Guide tools ↗
            </button>
          </div>
        </div>
        <div className={styles.summary}>
          <div className={styles.next}>
            <span className={styles.nextHeading}>
              <span className={styles.eyebrow}>Next deadline</span>
              {next && left ? (
                <span className={styles.timeLeft} data-status={left.status || undefined} data-course-time-left>
                  {left.label}
                </span>
              ) : null}
            </span>
            {next ? (
              <Link href={`/${courseId}/#${next.anchor}`} scroll={false}>
                <strong>{next.title} ↗</strong>
                <span>{[next.dateLabel, next.timeLabel || next.cta].filter(Boolean).join(' · ')}</span>
              </Link>
            ) : (
              <span>{live ? 'No upcoming deadlines' : 'Loading deadlines…'}</span>
            )}
          </div>
          <div className={styles.progress}>
            <span>
              {completed}/{total || '—'} records done
            </span>
            <progress value={completed} max={total || 1} aria-label="Submission records marked done" />
          </div>
        </div>
        <div id="course-content" className={styles.content} tabIndex={-1}>
          {navigation.item ? <AssignmentDetail item={navigation.item} kind={navigation.kind} assignments={assignments} back={navigation.back} returnView={navigation.returnView} /> : null}
          {!navigation.item && navigation.view === 'work' ? <Work assignments={assignments} filter={navigation.filter} navigate={navigation.navigate} /> : null}
          {!navigation.item && navigation.view === 'schedule' ? <Schedule navigate={navigation.navigate} state={schedule} setState={setSchedule} /> : null}
          {!navigation.item && navigation.view === 'study' ? <Study /> : null}
          <div className={navigation.item || navigation.view !== 'info' ? styles.infoInactive : undefined}>
            <CourseInformation panel={navigation.panel} back={navigation.back} returnView={navigation.returnView} />
          </div>
        </div>
        <GuideTools />
      </div>
    </div>
  );
}
