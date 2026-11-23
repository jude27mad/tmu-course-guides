import { PICKER_ID, useCourse } from '@src/pages/course/hooks/useCourseState';
import { groups } from '@src/lib';
import clsx from 'clsx';
import styles from '@src/pages/course/components/info/styles/sectionPicker.module.scss';

function GroupPicker() {
  const { info, group, setGroup, progress } = useCourse();
  const { groupLabel, note } = info.page.profile;
  return (
    <section id={PICKER_ID} className={clsx(styles.root, 'layout-block-inner')} tabIndex={-1} aria-label={groupLabel}>
      <div className={styles.window} data-surface="dark">
        <div className={styles.list} role="group" aria-labelledby={`${PICKER_ID}-heading`}>
          <h3 id={`${PICKER_ID}-heading`} className={styles.heading}>
            {groupLabel}
          </h3>
          <ul className={clsx(styles.rows, styles.groupRows)}>
            {groups().map((row) => (
              <li key={row.value} className={clsx(styles.item, group === row.value && styles.itemActive)}>
                <button type="button" aria-pressed={group === row.value} disabled={!progress.ready} onClick={() => setGroup(row.value)}>
                  <span>{row.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
        {note ? <p className={clsx('p-x', styles.note)}>{note}</p> : null}
      </div>
    </section>
  );
}

export default GroupPicker;
