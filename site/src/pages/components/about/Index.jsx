import { DESK_TEXT, STATUS, countdown, countdownStatus, courseCopy, getCourse } from '@src/lib';
import { useEffect, useMemo, useRef, useState } from 'react';

import AppearTitle from '@src/components/animationComponents/appearTitle/Index';
import ButtonLink from '@src/components/animationComponents/buttonLink/Index';
import CourseBadge from '@src/components/courseBadge/CourseBadge';
import Arrow from '@src/components/imageComponents/Arrow';
import Link from 'next/link';
import clsx from 'clsx';
import { entryFor } from '@src/pages/components/useDesk';
import styles from '@src/pages/components/about/styles/about.module.scss';
import { useNow } from '@src/lib/react';
import useStill from '@src/hooks/useStill';

// Copy of the old Desk's overall card (index.html, night/desk.mjs) and the
// guides' next cards ("Next up", "Mark done", "Undo", "For your own records").
const EMPTY_TITLE = 'No upcoming deadlines';
const EMPTY_TEXT = 'No course has a dated deadline left in your records.';
const NEXT_UP = 'Next up';
const pad = (n) => String(n).padStart(2, '0');

function copyFor(courseId) {
  try {
    return courseCopy(courseId) || {};
  } catch (error) {
    return {};
  }
}

// "2/6 completed in my records" (math) or "2/22 submission/completion records marked by you." (CEN).
function progressLine(courseId, progress) {
  if (!progress) return '';
  const copy = copyFor(courseId);
  if (copy.counts?.completed) return copy.counts.completed(progress.completed, progress.total);
  if (copy.completionCount) return copy.completionCount(progress.completed, progress.total);
  return '';
}

// The original loader-counter typography for the old countdown face: d/h/m/s
// digits for a confirmed time that is still ahead (seconds only while motion
// is on, as on the old course pages), otherwise the old honest wording.
// The number takes the status colour for the time left (lib/palette.mjs), with its badge below.
function StatusBadge({ status }) {
  if (!status) return null;
  return (
    <p className={clsx('p-x', styles.statusBadge)} data-status={status}>
      {STATUS[status].label}
    </p>
  );
}

function Countdown({ item, still }) {
  const now = useNow(still ? 60000 : 1000);
  if (!now || !item) return <div className={styles.countdown} />;
  const left = countdown(item, now);
  const status = countdownStatus({ ms: left.ms, done: item.done });
  if (left.days === undefined) {
    return (
      <>
        <div className={styles.countdown} data-status={status || undefined}>
          <p className={clsx('h3', styles.word)}>{item.target?.range || left.label}</p>
        </div>
        <StatusBadge status={status} />
      </>
    );
  }
  const units = [
    [left.days, 'days'],
    [left.hours, 'hrs'],
    [left.minutes, 'min'],
  ];
  if (!still) units.push([left.seconds, 'sec']);
  return (
    <>
      <div className={styles.countdown} aria-hidden="true" data-status={status || undefined}>
        {units.map(([value, unit]) => (
          <span key={unit} className={styles.unit}>
            <b className={clsx('h3', styles.digits)}>{pad(value)}</b>
            <i className="p-x">{unit}</i>
          </span>
        ))}
      </div>
      <StatusBadge status={status} />
    </>
  );
}

// Keep the date, cutoff and running clock together. Other deadline precisions
// retain the resolver's wording (including quiz windows and unconfirmed times).
function Deadline({ item, still }) {
  return (
    <div data-desk-deadline={item.id}>
      <div className={styles.deadlineHeading}>
        <p className="p-l">{item.target?.endOfDay ? <time dateTime={item.date}>{item.dateLabel}</time> : item.when}</p>
        <p className="p-x">
          {item.label}
          {item.target?.endOfDay && (
            <>
              {' · '}
              <span className={styles.cutoff}>11:59 PM Toronto</span>
            </>
          )}
        </p>
        {item.target?.note && <p className={clsx('p-x', styles.note)}>{item.target.note}</p>}
      </div>
      <Countdown item={item} still={still} />
    </div>
  );
}

function About({ desk }) {
  const still = useStill();
  const markRef = useRef();
  const undoRef = useRef();
  const focusNext = useRef(null);
  const [message, setMessage] = useState('');

  const { ready, now, next, progress } = desk;
  const course = next ? getCourse(next.courseId) : null;
  const empty = ready && !next;
  const entry = next ? entryFor(desk, next.courseId) : null;
  const copy = useMemo(() => (next ? copyFor(next.courseId) : {}), [next]);
  const canUndo = ready && progress?.canUndo?.();

  // Focus follows the old flow: Mark done -> Undo -> Mark done.
  useEffect(() => {
    if (focusNext.current === 'undo' && undoRef.current) undoRef.current.focus();
    else if (focusNext.current === 'mark' && markRef.current) markRef.current.focus();
    focusNext.current = null;
  }, [progress?.version, message]);

  const onMarkDone = () => {
    if (!next) return;
    const result = progress.markDone(next.courseId, next.id);
    setMessage(result?.message || '');
    focusNext.current = 'undo';
  };

  const onUndo = () => {
    progress.undo();
    setMessage('');
    focusNext.current = 'mark';
  };

  // One polite sentence per minute for screen readers (the digits are hidden).
  const spoken = useMemo(() => {
    if (!ready) return '';
    if (!next) return `${EMPTY_TITLE}.`;
    try {
      return `${DESK_TEXT.nextHeading}, ${course?.code}. ${countdown(next, now).sentence || ''}`;
    } catch (error) {
      return '';
    }
  }, [ready, next, course, now]);

  let title = DESK_TEXT.nextHeading;
  if (ready) title = next ? next.title : EMPTY_TITLE;

  const markLabel = next && (copy.markDoneLabel || copy.next?.markDoneLabel);
  const forRecords = copy.forYourRecords;

  return (
    <section className={clsx(styles.root, empty && styles.empty)} aria-labelledby="desk-next-heading" data-next-course={course?.id || undefined}>
      <div className={clsx(styles.nameContainer, 'layout-block-inner')}>
        <AppearTitle isFooter key={ready ? 'ready' : 'static'}>
          <h2 id="desk-next-heading" className={clsx('h1', 'medium')}>
            {NEXT_UP}
          </h2>
          <p className={clsx('h1', 'medium', styles.itemTitle)}>{title}</p>
        </AppearTitle>
      </div>

      <div className={clsx(styles.container, 'layout-grid-inner')}>
        {!empty &&
          (ready && course ? (
            <Link className={styles.imageContainer} href={`/${course.id}/`} scroll={false} aria-label={`Open ${course.code} course guide`} data-desk-course-link>
              <CourseBadge instanceId="desk-next" courseId={course.id} next={next} />
              <Arrow className={styles.cardArrow} />
            </Link>
          ) : (
            <div className={styles.imageContainer} aria-hidden="true" />
          ))}
        <div className={clsx(styles.descWrapperBottom)}>
          {ready && next ? <Deadline item={next} still={still} /> : <p className="p-l">{empty ? EMPTY_TEXT : DESK_TEXT.nextStatic}</p>}
          {ready && next && (
            <AppearTitle isFooter key={`bottom-${next.courseId}-${next.id}`}>
              {next.requirement && <p className="h6">{next.requirement}</p>}
              {entry?.progress && <p className={clsx('h6', styles.progress)}>{progressLine(next.courseId, entry.progress)}</p>}
            </AppearTitle>
          )}
          <div className={clsx(styles.buttonContainer)}>
            {ready && next?.cta && <ButtonLink href={`/${next.courseId}/#course-info`} label={next.cta.toUpperCase()} />}
            {ready && next?.markable && !next.done && (
              <ButtonLink
                ref={markRef}
                primary
                onClick={onMarkDone}
                label={(copy.markDone || copy.next?.markDone || 'Mark done').toUpperCase()}
                ariaLabel={markLabel ? markLabel(next.title) : undefined}
              />
            )}
            {canUndo && <ButtonLink ref={undoRef} onClick={onUndo} label="UNDO" />}
            <ButtonLink href="/courses/" label="ALL COURSES" />
          </div>
          {ready && next?.markable && forRecords && <p className={clsx('p-x', styles.note)}>{forRecords}</p>}
          <p className={clsx('p-x', styles.note)} role="status">
            {message}
          </p>
          <p className="sr-only" aria-live="polite">
            {spoken}
          </p>
        </div>
      </div>
    </section>
  );
}

export default About;
