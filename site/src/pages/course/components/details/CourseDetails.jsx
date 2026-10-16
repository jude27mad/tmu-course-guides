import { openPicker, useCourse } from '@src/pages/course/hooks/useCourseState';

import ButtonLink from '@src/components/animationComponents/buttonLink/Index';
import clsx from 'clsx';
// eslint-disable-next-line import/extensions
import { openGuideTools } from '@src/pages/course/components/tools/dialog.mjs';
import styles from '@src/pages/course/components/details/styles/courseDetails.module.scss';

// The original ProjectDetails (the pinned left column of a project page): code,
// the (term · section) line in Light Italic, the course summary, and pills.
function CourseDetails() {
  const { course, info, courseId, section, group } = useCourse();

  let sectionLine = '';
  let brief = '';
  if (courseId === 'cen100') {
    sectionLine = section ? [`Section ${section}`, group ? `Group ${group}` : null].filter(Boolean).join(' · ') : '';
    brief = info.profile?.summary || '';
  } else {
    sectionLine = info.section?.brief?.section || '';
    brief = info.section?.brief ? `${info.section.brief.section} · ${info.section.brief.detail}` : info.section?.briefPrompt || '';
  }
  const d2l = course.links.find((link) => /courses\.torontomu\.ca/.test(link.href)) || course.links[0];

  return (
    <div className={styles.root}>
      <h2 className={clsx(styles.title, 'h3')}>{course.code}</h2>
      <p className={clsx(styles.date, 'h4')}>({[course.term, sectionLine].filter(Boolean).join(' · ')})</p>
      <div className={styles.others}>
        <div className={styles.desc}>
          <p className="p-l">{course.summary}</p>
          {course.organization ? <p className="p-l">{course.organization}</p> : null}
          <p className={clsx('p-l', styles.brief)} aria-live="polite">
            {brief}
          </p>
        </div>
        <div className={styles.buttonContainer}>
          {d2l ? <ButtonLink target href={d2l.href} label="OPEN D2L" /> : null}
          <ButtonLink onClick={openPicker} label="CHANGE SECTION" ariaControls="section-picker" />
          <ButtonLink onClick={() => openGuideTools()} label="GUIDE TOOLS" ariaHaspopup="dialog" ariaControls="guide-tools" />
        </div>
      </div>
    </div>
  );
}

export default CourseDetails;
