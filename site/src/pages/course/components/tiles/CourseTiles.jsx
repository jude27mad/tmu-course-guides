import { countdown, workList } from '@src/lib';
import { openPicker, useCourse } from '@src/pages/course/hooks/useCourseState';
import { useEffect, useMemo, useRef, useState } from 'react';

import ButtonLink from '@src/components/animationComponents/buttonLink/Index';
import Link from 'next/link';
import clsx from 'clsx';
import { gsap } from 'gsap';
import styles from '@src/pages/course/components/tiles/styles/courseTiles.module.scss';
import useInView from '@src/hooks/useInView';
import useStill from '@src/hooks/useStill';

// The original ProjectImages column (a window with framed media), filled with
// solid palette panels: the big tile is the next deadline, the two small ones
// this week and progress, the medium one "What should I work on?".

function NextTile() {
  const { courseId, copy, info, live, markDone, undo, pendingUndo, status } = useCourse();
  const markRef = useRef(null);
  const undoRef = useRef(null);
  const focusAfter = useRef(null);
  const next = live?.next || null;
  const time = next && live ? countdown(next, live.now) : null;
  const math = courseId !== 'cen100';
  const eyebrow = math ? `Next assessment${next ? ` · ${next.weightLabel}` : ''}` : info.page?.nextLabel || 'Next deadline';
  const empty = math ? copy.next?.emptyTitle : copy.headNoDeadlines;
  const emptyText = math ? copy.next?.emptyText : '';
  const canMark = !!(next && next.markable && !next.done);

  useEffect(() => {
    if (focusAfter.current === 'undo' && pendingUndo) undoRef.current?.focus({ preventScroll: true });
    if (focusAfter.current === 'mark' && !pendingUndo) markRef.current?.focus({ preventScroll: true });
    focusAfter.current = null;
  }, [pendingUndo]);

  return (
    <div className={clsx(styles.tile, styles.big)}>
      <p className={clsx('p-x', styles.eyebrow)}>{eyebrow}</p>
      {next ? (
        <>
          <h3 className={clsx('h3', styles.nextTitle)}>{next.title}</h3>
          <p className="h6">{[next.when || next.dateLabel, next.label].filter(Boolean).join(' · ')}</p>
          {time ? (
            <p className={clsx('h2', styles.countdown)}>
              <span className="sr-only">{time.sentence || time.label}</span>
              <span aria-hidden="true">{time.label}</span>
            </p>
          ) : null}
          {time?.status && time.status !== time.label ? <p className="p-l">{time.status}</p> : null}
          {next.requirement ? <p className={clsx('p-l', styles.requirement)}>{next.requirement}</p> : null}
        </>
      ) : (
        <>
          <h3 className={clsx('h3', styles.nextTitle)}>{live ? empty : ' '}</h3>
          {live && emptyText ? <p className="p-l">{emptyText}</p> : null}
        </>
      )}
      <div className={styles.actions}>
        {canMark && !pendingUndo ? (
          <ButtonLink
            ref={markRef}
            onClick={() => {
              focusAfter.current = 'undo';
              markDone(next.id);
            }}
            label="MARK DONE"
            ariaLabel={`Mark ${next.title} done`}
            primary
          />
        ) : null}
        {pendingUndo ? (
          <ButtonLink
            ref={undoRef}
            onClick={() => {
              focusAfter.current = 'mark';
              undo();
            }}
            label="UNDO"
          />
        ) : null}
        {next?.cta ? <ButtonLink onClick={openPicker} label={next.cta.toUpperCase()} /> : null}
        {next ? <ButtonLink href={`#${next.anchor}`} label="VIEW REQUIREMENTS" ariaLabel={`View requirements for ${next.title}`} /> : null}
      </div>
      <p className={clsx('p-l', styles.status)} role="status">
        {status.message}
      </p>
      {canMark || pendingUndo ? <p className={clsx('p-x', styles.note)}>{math ? '' : copy.forYourRecords}</p> : null}
    </div>
  );
}

function Counter({ value, suffix = '', className }) {
  const ref = useRef(null);
  const shown = useRef(0);
  const still = useStill();
  const inView = useInView(ref);

  useEffect(() => {
    const element = ref.current;
    if (!element || value == null) return undefined;
    if (still) {
      shown.current = value;
      element.textContent = `${value}${suffix}`;
      return undefined;
    }
    // count up when the tile comes into view
    if (!inView) return undefined;
    // The original loader counter: a snapped number tween.
    const counter = { value: shown.current };
    const tween = gsap.to(counter, {
      value,
      duration: 1,
      ease: 'power2.inOut',
      snap: { value: 1 },
      onUpdate: () => {
        shown.current = counter.value;
        element.textContent = `${Math.round(counter.value)}${suffix}`;
      },
    });
    return () => tween.kill();
  }, [value, suffix, still, inView]);

  return (
    <span ref={ref} className={className} aria-hidden="true">
      {value == null ? ' ' : `0${suffix}`}
    </span>
  );
}

function WeekTile() {
  const { live, info } = useCourse();
  const week = live?.week || null;
  const records = useMemo(() => (week ? week.flatMap((entry) => entry.records || []) : []), [week]);
  const done = records.filter((record) => record.done).length;
  const label = week?.week?.label || ' ';
  const work = info.page?.find?.work || "This week's work";

  return (
    <div className={clsx(styles.tile, styles.small, styles.loud)}>
      <p className={clsx('p-x', styles.eyebrow)}>{label}</p>
      <p className={clsx('h1', styles.counter)}>
        {live ? <span className="sr-only">{`${work}: ${done} of ${records.length}`}</span> : null}
        <span aria-hidden="true">{live ? `${done}/${records.length}` : ' '}</span>
      </p>
      <p className={clsx('p-l', styles.line)}>{work}</p>
    </div>
  );
}

function ProgressTile() {
  const { live, copy, courseId } = useCourse();
  const progress = live?.progress || null;
  let percent = null;
  if (progress) percent = progress.total ? Math.round((progress.completed / progress.total) * 100) : 0;
  let line = '';
  if (progress) line = courseId === 'cen100' ? copy.completionCount(progress.completed, progress.total) : copy.counts.completed(progress.completed, progress.total);
  // "submission/completion" is wider than the small phone tile: allow the line to
  // wrap after the slash (zero-width space) instead of mid-word.
  line = line.replace(/([A-Za-z])\/([A-Za-z])/g, '$1/​$2');

  return (
    <div className={clsx(styles.tile, styles.small, styles.soft)}>
      <p className={clsx('p-x', styles.eyebrow)}>Progress</p>
      <p className={clsx('h1', styles.counter)}>
        {percent != null ? <span className="sr-only">{`${percent}%`}</span> : null}
        <Counter value={percent} suffix="%" />
      </p>
      <p className={clsx('p-l', styles.line)}>{line}</p>
    </div>
  );
}

function WorkTile() {
  const { live, info, courseId, section } = useCourse();
  const [range, setRange] = useState('week');
  const work = info.tools?.work || info.page?.work || {};
  const list = useMemo(
    () => (live ? workList(courseId, { now: live.now, range, section: section ?? undefined }) : null),
    // live changes with every save, so the list follows completion records
    [live, courseId, range, section],
  );

  return (
    <div className={clsx(styles.tile, styles.medium)}>
      <h3 className={clsx('h4', styles.workTitle)}>{work.summary}</h3>
      <div className={styles.rangePills} role="group" aria-label={work.label}>
        {(work.options || []).map((option) => (
          <ButtonLink
            key={option.value}
            onClick={() => setRange(option.value)}
            ariaPressed={range === option.value}
            label={option.label.toUpperCase()}
            className={clsx(range === option.value && styles.pillActive)}
          />
        ))}
      </div>
      {list?.items?.length ? (
        <ul className={styles.workList}>
          {list.items.map((item) => (
            <li key={item.itemId} className={styles.workItem}>
              <Link scroll={false} href={`#${item.anchor}`} className={clsx('p-l', styles.workLink)}>
                {item.title}
              </Link>
              <span className={clsx('p-x', styles.workMeta)}>{[item.dates, item.progress, item.target].filter(Boolean).join(' · ')}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="p-l" role="status">
        {list ? list.status || list.empty || '' : ''}
      </p>
      {(work.notes || []).map((note) => (
        <p key={note} className={clsx('p-x', styles.note)}>
          {note}
        </p>
      ))}
    </div>
  );
}

function CourseTiles() {
  return (
    <section className={clsx(styles.root, 'layout-grid-inner')} aria-label="Course overview">
      <NextTile />
      <WeekTile />
      <ProgressTile />
      <WorkTile />
    </section>
  );
}

export default CourseTiles;
