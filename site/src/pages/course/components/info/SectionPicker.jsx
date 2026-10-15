import { PICKER_ID, useCourse } from '@src/pages/course/hooks/useCourseState';
import { groups as groupsOf, sections as sectionsOf } from '@src/lib';

import clsx from 'clsx';
import styles from '@src/pages/course/components/info/styles/sectionPicker.module.scss';
import { useMemo } from 'react';

// The section (and CEN100 group) choice as a MenuLinks-style list: white rows
// over the dark window, the active one carrying the menu's full underline.
// Saves to the old keys (cen100-contact-choice-v1, mth14x-section-v1).
function SectionPicker() {
  const { courseId, info, section, setSection, group, setGroup, progress } = useCourse();
  const rows = useMemo(() => sectionsOf(courseId), [courseId]);
  const groupRows = useMemo(() => (courseId === 'cen100' && section ? groupsOf(section) : []), [courseId, section]);
  const cen = courseId === 'cen100';
  const page = info.page || {};
  const heading = cen ? page.profile?.sectionLabel : page.section?.label;
  const groupHeading = cen ? page.profile?.groupLabel : null;
  const note = cen ? page.profile?.note : null;

  return (
    <section id={PICKER_ID} className={clsx(styles.root, 'layout-block-inner')} tabIndex={-1} aria-label={heading}>
      <div className={styles.window}>
        <div className={styles.list} role="group" aria-labelledby={`${PICKER_ID}-heading`}>
          <h3 id={`${PICKER_ID}-heading`} className={styles.heading}>
            {heading}
          </h3>
          <ul className={styles.rows}>
            {rows.map((row) => {
              const active = section === row.value;
              return (
                <li key={row.value} className={clsx(styles.item, active && styles.itemActive)}>
                  <button type="button" aria-pressed={active} disabled={!progress.ready} onClick={() => setSection(row.value)}>
                    <span>{row.label}</span>
                    <span className={clsx('p-x', styles.meta)}>{row.detail}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
        {cen ? (
          <div className={styles.list} role="group" aria-labelledby={`${PICKER_ID}-group-heading`}>
            <h3 id={`${PICKER_ID}-group-heading`} className={styles.heading}>
              {groupHeading}
            </h3>
            {groupRows.length ? (
              <ul className={clsx(styles.rows, styles.groupRows)}>
                {groupRows.map((row) => {
                  const active = group === row.value;
                  return (
                    <li key={row.value} className={clsx(styles.item, active && styles.itemActive)}>
                      <button type="button" aria-pressed={active} onClick={() => setGroup(row.value)}>
                        <span>{row.label}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className={clsx('p-l', styles.prompt)}>{page.profile?.groupPlaceholder}</p>
            )}
          </div>
        ) : null}
        {note ? <p className={clsx('p-x', styles.note)}>{note}</p> : null}
      </div>
    </section>
  );
}

export default SectionPicker;
