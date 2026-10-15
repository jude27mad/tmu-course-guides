import Badge, { createBadgeRig } from '@src/pages/components/clients/components/Badge';
import { COURSES, DESK_TEXT, countdown } from '@src/lib';
import { Fragment, useMemo, useRef } from 'react';

import AppearByWords from '@src/components/animationComponents/appearByWords/Index';
import AppearTitle from '@src/components/animationComponents/appearTitle/Index';
import ButtonLink from '@src/components/animationComponents/buttonLink/Index';
import Link from 'next/link';
import clsx from 'clsx';
import { entryFor } from '@src/pages/components/useDesk';
import { gsap } from 'gsap';
import styles from '@src/pages/components/clients/styles/clients.module.scss';
import useInView from '@src/hooks/useInView';
import useIsMobile from '@src/hooks/useIsMobile';
import { useIsomorphicLayoutEffect } from '@src/hooks/useIsomorphicLayoutEffect';
import useStill from '@src/hooks/useStill';
import { useWindowSize } from '@darkroom.engineering/hamo';

// The original Clients section as the old Desk's course directory: three badge
// windows (one per course) with the directory text beside them: index, code
// and name, the old one-line description, and the old Desk card's "Next"
// slot (title, when, countdown chip, status, section or the section CTA).
const NO_SECTION = 'No section saved';
const NO_DEADLINES = 'No upcoming deadlines';

// The old Desk card's "Next" lines (night/desk.mjs paintCourse).
function nextLines(entry, now) {
  const next = entry?.next;
  if (!next) return [{ text: NO_DEADLINES }];
  let chip = next.label;
  try {
    const left = countdown(next, now);
    chip = next.precision === 'exact' && left.ms > 0 ? `${left.label} left` : left.label;
  } catch (error) {
    // keep the status label
  }
  const lines = [{ text: 'Next', kicker: true }, { text: next.title, strong: true }, { text: next.when }, { text: [chip, next.label !== chip ? next.label : null].filter(Boolean).join(' · ') }];
  if (next.target?.note) lines.push({ text: next.target.note });
  if (next.cta) lines.push({ text: next.cta, href: `/${next.courseId}/#course-info` });
  else lines.push({ text: entry.section || NO_SECTION });
  return lines;
}

// What the badge card prints.
function badgeLook(course, entry) {
  const next = entry?.next;
  let nextValue = 'Open guide';
  if (entry) nextValue = next ? next.dateLabel || next.when : NO_DEADLINES;
  return {
    index: course.index,
    code: course.code,
    name: course.name,
    term: course.term,
    nextLabel: 'Next',
    nextValue,
    background: course.palette.menuColor,
    color: course.palette.menuFontColor,
  };
}

function CourseText({ course, entry, now, ready, showIndex = true }) {
  const lines = ready ? nextLines(entry, now) : [];
  return (
    <>
      {showIndex && (
        <AppearTitle>
          <h6 className="h6">{course.index}</h6>
        </AppearTitle>
      )}
      <AppearTitle>
        <h3 className={clsx('h4', 'bold', styles.title)}>
          {course.code} · {course.name}
        </h3>
      </AppearTitle>
      <AppearTitle>
        <p className="p-l">{course.summary}</p>
      </AppearTitle>
      {ready && (
        <AppearTitle isFooter key={`${entry?.next?.id || 'none'}-${lines.length}`}>
          {lines.map((line, index) => {
            const key = `${index}-${line.text}`;
            if (line.href) {
              return (
                <Link key={key} href={line.href} scroll={false} className={clsx('p-l', styles.lineLink)}>
                  {line.text}
                </Link>
              );
            }
            return (
              <p key={key} className={clsx(line.kicker ? 'p-x' : 'p-l', line.strong && styles.strong, line.kicker && styles.kicker)}>
                {line.text}
              </p>
            );
          })}
        </AppearTitle>
      )}
      <div className={styles.buttonContainer}>
        <ButtonLink href={course.href} label={DESK_TEXT.openGuide.toUpperCase()} ariaLabel={course.ariaLabel} />
      </div>
    </>
  );
}

function Clients({ desk }) {
  const isMobile = useIsMobile();
  const still = useStill();
  const textRefs = useRef([]);
  const rootRef = useRef();
  const windowSize = useWindowSize();
  const rig = useMemo(() => createBadgeRig(COURSES.length), []);
  // the shared physics world runs only while the section is on screen
  const visible = useInView(rootRef);
  const { ready, now } = desk;

  const looks = useMemo(() => COURSES.map((course) => badgeLook(course, ready ? entryFor(desk, course.id) : null)), [desk, ready]);

  const setupScrollAnimation = () => {
    const ctx = gsap.context(() => {
      if (!isMobile) {
        const vw = (coef) => windowSize.height * (coef / 100);
        textRefs.current.forEach((textRef, index) => {
          gsap
            .timeline({
              scrollTrigger: {
                trigger: rootRef.current,
                start: index === 0 ? `top-=${vw(35)}` : `top+=${vw(35 + 5.5555556 * index)}`,
                end: index === 0 ? `bottom-=${vw(35 + 5.5555556 * index)}` : `bottom+=${vw(25)}`,
                toggleActions: 'play none reverse none',
                scrub: true,
                scroller: document?.querySelector('main'),
                invalidateOnRefresh: true,
              },
            })
            .to(textRef, {
              top: `${10 + 30 * index + 5.5555556 * index}vw`,
            });
        });
      }
    });

    return ctx;
  };

  useIsomorphicLayoutEffect(() => {
    const ctx = setupScrollAnimation(textRefs, rootRef, windowSize, isMobile);
    return () => ctx.kill();
  }, [isMobile, windowSize.height]);

  const badge = (i) => (
    // the badge windows are pictures of the text beside them
    <div aria-hidden="true" className={[styles.first, styles.second, styles.third][i]}>
      <Badge index={i} rig={rig} look={looks[i]} world={i === 0} paused={!visible || still} rest={still} />
    </div>
  );

  const text = (i) => <CourseText course={COURSES[i]} entry={entryFor(desk, COURSES[i].id)} now={now} ready={ready} showIndex={!isMobile} />;

  return (
    <section ref={rootRef} className={clsx(styles.root, 'layout-grid-inner')} aria-labelledby="desk-courses-heading">
      <h2 id="desk-courses-heading" className={clsx(styles.sectionTitle, 'h1')}>
        <AppearByWords>{DESK_TEXT.coursesHeading}</AppearByWords>
      </h2>
      {isMobile ? (
        COURSES.map((course, i) => (
          <Fragment key={course.id}>
            <div className={styles.mobileEmpty} />
            <div className={styles.mobileCount}>
              <AppearTitle>
                <span>{course.index}</span>
              </AppearTitle>
            </div>
            {badge(i)}
            <div className={styles.mobileEmptySecond} />
            <div className={styles.textMobile}>{text(i)}</div>
          </Fragment>
        ))
      ) : (
        <>
          {badge(0)}
          <div className={styles.firstEmpty} />
          <div
            ref={(el) => {
              textRefs.current[0] = el;
            }}
            className={styles.firstText}
          >
            {text(0)}
          </div>
          <div className={styles.secondEmpty} />
          {badge(1)}
          <div
            ref={(el) => {
              textRefs.current[1] = el;
            }}
            className={styles.secondText}
          >
            {text(1)}
          </div>
          <div className={styles.fourthEmpty} />
          {badge(2)}
          <div className={styles.fifthEmpty} />
          <div
            ref={(el) => {
              textRefs.current[2] = el;
            }}
            className={styles.thirdText}
          >
            {text(2)}
          </div>
        </>
      )}
    </section>
  );
}

export default Clients;
