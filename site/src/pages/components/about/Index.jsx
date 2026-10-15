import { DESK_TEXT, countdown, courseCopy, getCourse } from '@src/lib';
import { useEffect, useMemo, useRef, useState } from 'react';

import AppearTitle from '@src/components/animationComponents/appearTitle/Index';
import ButtonLink from '@src/components/animationComponents/buttonLink/Index';
import CourseArtwork from '@src/components/courseArtwork/CourseArtwork';
import clsx from 'clsx';
import { entryFor } from '@src/pages/components/useDesk';
import { gsap } from 'gsap';
import styles from '@src/pages/components/about/styles/about.module.scss';
import useIsMobile from '@src/hooks/useIsMobile';
import { useIsomorphicLayoutEffect } from '@src/hooks/useIsomorphicLayoutEffect';
import { useNow } from '@src/lib/react';
import useStill from '@src/hooks/useStill';

// Copy of the old Desk's overall card (index.html, night/desk.mjs) and the
// guides' next cards ("Next up", "Mark done", "Undo", "For your own records").
const EMPTY_TITLE = 'No upcoming deadlines';
const EMPTY_TEXT = 'No course has a dated deadline left in your records.';
const NO_SECTION = 'No section saved';
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
function Countdown({ item, still }) {
  const now = useNow(still ? 60000 : 1000);
  if (!now || !item) return <div className={styles.countdown} />;
  const left = countdown(item, now);
  if (left.days === undefined) {
    return (
      <div className={styles.countdown}>
        <p className={clsx('h3', styles.word)}>{item.target?.range || left.label}</p>
      </div>
    );
  }
  const units = [
    [left.days, 'days'],
    [left.hours, 'hrs'],
    [left.minutes, 'min'],
  ];
  if (!still) units.push([left.seconds, 'sec']);
  return (
    <div className={styles.countdown} aria-hidden="true">
      {units.map(([value, unit]) => (
        <span key={unit} className={styles.unit}>
          <b className={clsx('h3', styles.digits)}>{pad(value)}</b>
          <i className="p-x">{unit}</i>
        </span>
      ))}
    </div>
  );
}

function About({ desk }) {
  const isMobile = useIsMobile();
  const still = useStill();
  const rootRef = useRef();
  const animatedImageRef = useRef();
  const markRef = useRef();
  const undoRef = useRef();
  const focusNext = useRef(null);
  const [message, setMessage] = useState('');

  const { ready, now, next, progress } = desk;
  const course = next ? getCourse(next.courseId) : null;
  const entry = next ? entryFor(desk, next.courseId) : null;
  const copy = useMemo(() => (next ? copyFor(next.courseId) : {}), [next]);
  const canUndo = ready && progress?.canUndo?.();

  const setupScrollAnimation = () => {
    const ctx = gsap.context(() => {
      gsap.set(animatedImageRef.current, { top: !isMobile ? '-20vw' : '0' });
      if (!isMobile && !still) {
        gsap.to(animatedImageRef.current, {
          top: '20vw',
          ease: 'none',
          scrollTrigger: {
            trigger: rootRef.current,
            start: 'top bottom',
            end: 'bottom top',
            scrub: true,
            scroller: document?.querySelector('main'),
            invalidateOnRefresh: true,
          },
        });
      }
    });

    return ctx;
  };

  useIsomorphicLayoutEffect(() => {
    const ctx = setupScrollAnimation();
    return () => ctx.kill();
  }, [isMobile, still]);

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

  let lines = [DESK_TEXT.nextStatic];
  if (ready && !next) lines = [EMPTY_TEXT];
  if (ready && next) {
    lines = [[course?.code, course?.name].filter(Boolean).join(' · '), next.when, [next.label, next.target?.note].filter(Boolean).join(' · ')];
    if (!next.cta) lines.push(entry?.section || NO_SECTION);
  }

  const markLabel = next && (copy.markDoneLabel || copy.next?.markDoneLabel);
  const forRecords = copy.forYourRecords;

  const renderImageContainer = () => (
    <div className={styles.imageContainer} aria-hidden="true">
      <CourseArtwork courseId={ready ? course?.id : undefined} />
    </div>
  );

  return (
    <section ref={rootRef} className={styles.root} aria-labelledby="desk-next-heading">
      <div className={clsx(styles.nameContainer, 'layout-block-inner')}>
        <AppearTitle isFooter key={ready ? 'ready' : 'static'}>
          <h2 id="desk-next-heading" className={clsx('h1', 'medium')}>
            {NEXT_UP}
          </h2>
          <p className={clsx('h1', 'medium', styles.itemTitle)}>{title}</p>
        </AppearTitle>
      </div>

      <div className={clsx(styles.container, 'layout-grid-inner')}>
        {isMobile ? renderImageContainer() : null}
        <div className={clsx(styles.descWrapper)} ref={animatedImageRef}>
          <AppearTitle isFooter key={ready ? `lines-${next?.courseId}-${next?.id}` : 'lines-static'}>
            {lines.map((line, index) => (
              // eslint-disable-next-line react/no-array-index-key
              <p key={`${index}-${line}`} className="p-l">
                {line}
              </p>
            ))}
          </AppearTitle>
        </div>
        {!isMobile ? renderImageContainer() : null}
        <div className={clsx(styles.descWrapperBottom)}>
          {ready && next && <Countdown item={next} still={still} />}
          {ready && next && (
            <AppearTitle isFooter key={`bottom-${next.courseId}-${next.id}`}>
              {next.requirement && <p className="h6">{next.requirement}</p>}
              {entry?.progress && <p className={clsx('h6', styles.progress)}>{progressLine(next.courseId, entry.progress)}</p>}
            </AppearTitle>
          )}
          <div className={clsx(styles.buttonContainer)}>
            {ready && next && <ButtonLink href={next.href} label={course ? `VIEW IN ${course.code}` : 'VIEW ASSESSMENT'} />}
            {ready && next?.cta && <ButtonLink href={`/${next.courseId}/#course-info`} label={next.cta.toUpperCase()} />}
            {ready && next?.markable && !next.done && (
              <ButtonLink ref={markRef} onClick={onMarkDone} label={(copy.markDone || copy.next?.markDone || 'Mark done').toUpperCase()} ariaLabel={markLabel ? markLabel(next.title) : undefined} />
            )}
            {canUndo && <ButtonLink ref={undoRef} onClick={onUndo} label="UNDO" />}
            {!ready && <ButtonLink href="/courses/" label={DESK_TEXT.openGuide.toUpperCase()} />}
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
