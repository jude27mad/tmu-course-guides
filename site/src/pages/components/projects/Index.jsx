import AppearByWords from '@src/components/animationComponents/appearByWords/Index';
import ButtonLink from '@src/components/animationComponents/buttonLink/Index';
import CourseCards from '@src/pages/components/projects/CourseCards';
import clsx from 'clsx';
import styles from '@src/pages/components/projects/styles/projects.module.scss';

// The original "Selected Projects" as the Desk's course cards: one stacked window
// card per course, then "ALL COURSES" (his "ALL PROJECTS") to /courses/.
// The title is the old guides' nav label ("Course guides").
function Projects({ desk }) {
  return (
    <>
      <section className={clsx(styles.titleContainer, 'layout-grid-inner')}>
        <h2 className={clsx(styles.title, 'h1')}>
          <AppearByWords>Course guides</AppearByWords>
        </h2>
      </section>
      <CourseCards desk={desk} variant="desk">
        <div className={styles.buttonContainer}>
          <ButtonLink href="/courses/" label="ALL COURSES" />
        </div>
      </CourseCards>
    </>
  );
}

export default Projects;
