/* eslint-disable react/jsx-props-no-spreading */
import { COURSE_IDS, getCourse } from '@src/lib';
import { CourseContext, useCourseState, useNativeHash, useScrollRefresh } from '@src/pages/course/hooks/useCourseState';

import Assessments from '@src/pages/course/components/overview/Assessments';
import Checklist from '@src/pages/course/components/checklist/Checklist';
import CourseDetails from '@src/pages/course/components/details/CourseDetails';
import CourseInfo from '@src/pages/course/components/info/CourseInfo';
import CourseTiles from '@src/pages/course/components/tiles/CourseTiles';
import CustomHead from '@src/components/dom/CustomHead';
import Deadlines from '@src/pages/course/components/deadlines/Deadlines';
import GuideTools from '@src/pages/course/components/tools/GuideTools';
import Hero from '@src/pages/course/components/hero/Hero';
import ItemCards from '@src/pages/course/components/cards/ItemCards';
import NextCourse from '@src/pages/course/components/nextCourse/NextCourse';
import { ScrollTrigger } from 'gsap/dist/ScrollTrigger';
import clsx from 'clsx';
import { gsap } from 'gsap';
import styles from '@src/pages/course/course.module.scss';
import useIsMobile from '@src/hooks/useIsMobile';
import { useIsomorphicLayoutEffect } from '@src/hooks/useIsomorphicLayoutEffect';
import { usePalette } from '@src/utils/theme';
import { useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '@src/store';
import { useWindowSize } from '@darkroom.engineering/hamo';

// /cen100/, /mth140/, /mth141/: the original /projects/[id] route, extended with
// his /about sections (design-map §7.4). Every value comes from '@src/lib'.
function Page({ id }) {
  const state = useCourseState(id);
  const { course, info } = state;
  const isMobile = useIsMobile();
  const rightContainerRef = useRef();
  const leftContainerRef = useRef();
  const [isLoading] = useStore(useShallow((s) => [s.isLoading]));
  const windowSize = useWindowSize();

  // The original per-project theme: CSS variables + fluid tint, reset on leave.
  usePalette(course.palette);
  useScrollRefresh();
  useNativeHash();

  // ProjectDetails stays pinned beside the tiles on desktop.
  useIsomorphicLayoutEffect(() => {
    const ctx = gsap.context(() => {
      if (!isLoading && !isMobile) {
        ScrollTrigger.create({
          id: 'course-details',
          trigger: rightContainerRef.current,
          start: 'top top',
          end: 'bottom bottom',
          pin: leftContainerRef.current,
          scrub: true,
          scroller: document?.querySelector('main'),
          invalidateOnRefresh: true,
          pinSpacing: false,
        });
      }
    });

    return () => {
      ctx.revert();
      ScrollTrigger.getById('course-details')?.kill();
    };
  }, [isMobile, isLoading, windowSize.width]);

  // The old pages named the saved section in the tab title.
  const title = (id === 'cen100' ? info.profile?.value && info.profile?.title : info.section?.value && info.section?.title) || info.page?.title;

  return (
    <CourseContext.Provider value={state}>
      <CustomHead title={title} description={course.description} />
      <Hero />
      <section className={clsx(styles.root, 'layout-grid-inner')}>
        <div ref={leftContainerRef} className={styles.leftContainer}>
          <CourseDetails />
        </div>
        <div ref={rightContainerRef} className={styles.rightContainer}>
          <CourseTiles />
        </div>
      </section>
      <Deadlines />
      <Checklist />
      <Assessments />
      <ItemCards />
      <CourseInfo />
      <GuideTools />
      <NextCourse />
    </CourseContext.Provider>
  );
}

export async function getStaticPaths() {
  return { paths: COURSE_IDS.map((course) => ({ params: { course } })), fallback: false };
}

export async function getStaticProps({ params }) {
  if (!getCourse(params.course)) return { notFound: true };
  return { props: { id: params.course } };
}

export default Page;
