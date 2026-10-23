import { useEffect, useId, useRef, useState } from 'react';

import clsx from 'clsx';
import styles from '@src/pages/course/components/cards/styles/cards.module.scss';
import { useCourse } from '@src/pages/course/hooks/useCourseState';

// "My notes" and "My target date" (old "My plan & completion"), with the
// footer's 1 px underline as the only input chrome. Saved on this device.
function PlanFields({ itemId, notesLabel, targetLabel, notes }) {
  const { courseId, progress, version } = useCourse();
  const noteId = useId();
  const targetId = useId();
  const [note, setNote] = useState('');
  const [target, setTarget] = useState('');
  const editing = useRef(false);

  // Follow saved values (another tab, an import) unless the field is being typed in.
  useEffect(() => {
    if (!progress.ready) return;
    if (!editing.current) setNote(progress.getNote(courseId, itemId));
    setTarget(progress.getTarget(courseId, itemId));
  }, [progress, version, courseId, itemId]);

  const saveNote = (value) => {
    progress.setNote(courseId, itemId, value);
  };

  return (
    <div className={styles.plan}>
      <label htmlFor={noteId} className={clsx('p-x', styles.fieldLabel)}>
        {notesLabel}
      </label>
      <textarea
        id={noteId}
        className={clsx('p-l', styles.textarea)}
        value={note}
        maxLength={2000}
        rows={3}
        disabled={!progress.ready}
        onFocus={() => {
          editing.current = true;
        }}
        onChange={(event) => {
          const { value } = event.target;
          setNote(value);
          saveNote(value);
        }}
        onBlur={(event) => {
          editing.current = false;
          saveNote(event.target.value);
        }}
      />
      <label htmlFor={targetId} className={clsx('p-x', styles.fieldLabel)}>
        {targetLabel}
      </label>
      <input
        id={targetId}
        type="date"
        className={clsx('p-l', styles.dateInput)}
        value={target}
        disabled={!progress.ready}
        onChange={(event) => {
          setTarget(event.target.value);
          progress.setTarget(courseId, itemId, event.target.value);
        }}
      />
      {(notes || []).filter(Boolean).map((line) => (
        <p key={line} className={clsx('p-x', styles.muted)}>
          {line}
        </p>
      ))}
    </div>
  );
}

export default PlanFields;
