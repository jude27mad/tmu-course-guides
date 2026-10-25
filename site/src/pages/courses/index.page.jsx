/* eslint-disable react/jsx-props-no-spreading */
import { DESK_TEXT } from '@src/lib';
import CourseCards from '@src/pages/components/projects/CourseCards';
import CustomHead from '@src/components/dom/CustomHead';
import clsx from 'clsx';
import styles from '@src/pages/courses/courses.module.scss';
import useDesk from '@src/pages/components/useDesk';

// The original /projects index as the course index: the title, then one stacked
// window card per course (section, next date, code and name, the old Desk
// description).
const seo = {
  title: 'Courses | TMU Course Guides',
  description: DESK_TEXT.description,
};

function Page() {
  const desk = useDesk();

  return (
    <>
      <CustomHead {...seo} />
      <section className={clsx(styles.titleContainer, 'layout-block-inner')}>
        <h1 className={clsx(styles.title, 'h1')}>All Courses</h1>
      </section>
      <CourseCards desk={desk} />
    </>
  );
}

export default Page;
