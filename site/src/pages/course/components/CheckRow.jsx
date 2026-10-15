import Arrow from '@src/components/imageComponents/Arrow';
import Tick from '@src/pages/course/components/Tick';
import clsx from 'clsx';
import styles from '@src/pages/course/components/checkRow.module.scss';
import { useId } from 'react';

// An option row from the original design (arrow + p-l text) that is a real checkbox: the arrow
// turns into a tick and the menu's full underline marks the row when checked.
// Ticks are checklist progress only; they never mark anything done.
function CheckRow({ checked, onChange, disabled = false, children }) {
  const id = useId();
  return (
    <li className={clsx(styles.row, checked && styles.checked)}>
      <label className={styles.label} htmlFor={id}>
        <input id={id} type="checkbox" className={styles.input} checked={!!checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
        <span className={styles.glyph}>{checked ? <Tick className={styles.tick} /> : <Arrow className={styles.arrow} />}</span>
        <span className={clsx('p-l', styles.text)}>{children}</span>
      </label>
    </li>
  );
}

export default CheckRow;
