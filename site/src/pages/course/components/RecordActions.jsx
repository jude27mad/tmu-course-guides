import { useEffect, useRef } from 'react';

import ButtonLink from '@src/components/animationComponents/buttonLink/Index';
import clsx from 'clsx';
import { useCourse } from '@src/pages/course/hooks/useCourseState';

// MARK DONE / UNDO pills for one completion record (separate from checklist
// ticks, as on the old pages). Focus moves Mark done -> Undo -> Mark done.
function RecordActions({ record, className, showStatus = true }) {
  const { markDone, undo, pendingUndo, status, live } = useCourse();
  const markRef = useRef(null);
  const undoRef = useRef(null);
  const focusAfter = useRef(null);
  const pending = pendingUndo === record.id;
  const markable = live ? live.items.some((item) => item.id === record.id && item.markable) : false;

  useEffect(() => {
    if (focusAfter.current === 'undo' && pending) undoRef.current?.focus({ preventScroll: true });
    if (focusAfter.current === 'mark' && !pending) markRef.current?.focus({ preventScroll: true });
    focusAfter.current = null;
  }, [pending]);

  if (!live || (!markable && !pending)) return null;

  return (
    <div className={className}>
      {pending ? (
        <ButtonLink
          ref={undoRef}
          onClick={() => {
            focusAfter.current = 'mark';
            undo();
          }}
          label="UNDO"
        />
      ) : null}
      {!pending && record.done ? <span className={clsx('p-x')}>Completed</span> : null}
      {!pending && !record.done ? (
        <ButtonLink
          ref={markRef}
          onClick={() => {
            focusAfter.current = 'undo';
            markDone(record.id);
          }}
          label="MARK DONE"
          ariaLabel={`Mark ${record.title} done`}
          primary
        />
      ) : null}
      {showStatus ? (
        <span className="p-x" role="status">
          {pending && status.itemId === record.id ? status.message : ''}
        </span>
      ) : null}
    </div>
  );
}

export default RecordActions;
