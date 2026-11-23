import { PICKER_ID, openPicker, useCourse } from '@src/pages/course/hooks/useCourseState';

import ButtonLink from '@src/components/animationComponents/buttonLink/Index';
import clsx from 'clsx';
// eslint-disable-next-line import/extensions
import { openGuideTools } from '@src/pages/course/components/tools/dialog.mjs';
import styles from '@src/pages/course/components/details/styles/courseDetails.module.scss';

// The original ProjectDetails (the pinned left column of a project page): code,
// the term line in Light Italic, the course summary, and pills.
function CourseDetails() {
  const { course, courseId, group } = useCourse();
  const d2l = course.links.find((link) => /courses\.torontomu\.ca/.test(link.href)) || course.links[0];

  return (
    <div className={styles.root}>
      <h2 className={clsx(styles.title, 'h3')}>{course.code}</h2>
      <p className={clsx(styles.date, 'h4')}>({[course.term, group && `Group ${group}`].filter(Boolean).join(' · ')})</p>
      <div className={styles.others}>
        <div className={styles.desc}>
          <p className="p-l">{course.summary}</p>
          {course.organization ? <p className="p-l">{course.organization}</p> : null}
        </div>
        <div className={styles.buttonContainer}>
          {d2l ? <ButtonLink target href={d2l.href} label="OPEN D2L" /> : null}
          {courseId === 'cen100' ? <ButtonLink onClick={openPicker} label="CHANGE GROUP" ariaControls={PICKER_ID} /> : null}
          <ButtonLink onClick={() => openGuideTools()} label="GUIDE TOOLS" ariaHaspopup="dialog" ariaControls="guide-tools" />
        </div>
      </div>
    </div>
  );
}

export default CourseDetails;
