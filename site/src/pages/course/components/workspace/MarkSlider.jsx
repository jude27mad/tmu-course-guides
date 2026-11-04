import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import styles from './markSlider.module.scss';

// A styled native range (VoiceOver, keyboard and forced colours keep working). Dragging shows a draft through
// onDraft; a mark is committed on release (the native change event), by keys, or by a tap on the track, which
// iOS Safari's own range ignores. Vertical swipes still scroll: touch-action is pan-y.
const THUMB = 14; // half the thumb, as in markSlider.module.scss

const MarkSlider = forwardRef(({ id, min = 0, max, step = 1, value, ghost, ticks = [], marker, labelledBy, describedBy, valueText, onDraft, onCommit, onCancel, disabled, compact }, ref) => {
  const inputRef = useRef(null);
  useImperativeHandle(ref, () => inputRef.current);
  const commitRef = useRef(onCommit);
  commitRef.current = onCommit;
  const cancelRef = useRef(onCancel);
  cancelRef.current = onCancel;
  const [draft, setDraft] = useState(null);
  const tap = useRef(null);
  // The value when a touch, click or key press began: a gesture that ends where it started saves nothing (a
  // finger resting on the thumb must not round a 68.5 to 69), and one gesture saves once.
  const gesture = useRef({ start: null, committed: false, cancelled: false });
  const snap = (raw) => Math.min(max, Math.max(min, Math.round((raw - min) / step) * step + min));
  const current = draft ?? value ?? ghost ?? min;
  const ratio = max > min ? (current - min) / (max - min) : 0;
  const at = (v) => `calc(${THUMB}px + ${((v - min) / (max - min)) * 100}% - ${(((v - min) / (max - min)) * THUMB * 2).toFixed(3)}px)`;

  useEffect(() => {
    const input = inputRef.current;
    const begin = () => {
      gesture.current = { start: Number(input.value), committed: false, cancelled: false };
    };
    // The page or the sheet took the touch over to scroll: whatever the thumb did meanwhile is not a mark.
    const cancel = () => {
      gesture.current.cancelled = true;
      setDraft(null);
      cancelRef.current?.();
    };
    const onChange = () => {
      setDraft(null);
      const next = Number(input.value);
      if (gesture.current.cancelled || (gesture.current.start !== null && next === gesture.current.start)) return;
      gesture.current = { start: next, committed: true, cancelled: false };
      commitRef.current?.(next);
    };
    input.addEventListener('pointerdown', begin);
    input.addEventListener('keydown', begin);
    input.addEventListener('pointercancel', cancel);
    input.addEventListener('change', onChange);
    return () => {
      input.removeEventListener('pointerdown', begin);
      input.removeEventListener('keydown', begin);
      input.removeEventListener('pointercancel', cancel);
      input.removeEventListener('change', onChange);
    };
  }, []);

  // A short touch tap on the bare track sets the mark where it lands (iOS Safari's own range ignores such taps).
  // A touch on the thumb starts a drag instead, and anything that moves is a drag or a scroll.
  const onPointerDown = (event) => {
    if (event.pointerType !== 'touch') {
      tap.current = null;
      return;
    }
    const box = inputRef.current.getBoundingClientRect();
    const thumbX = box.left + THUMB + ratio * (box.width - THUMB * 2);
    tap.current = Math.abs(event.clientX - thumbX) > THUMB ? { x: event.clientX, y: event.clientY } : null;
  };
  const onPointerUp = (event) => {
    const start = tap.current;
    tap.current = null;
    if (!start || disabled || gesture.current.committed || gesture.current.cancelled || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 8) return;
    const box = inputRef.current.getBoundingClientRect();
    const next = snap(min + ((event.clientX - box.left - THUMB) / (box.width - THUMB * 2)) * (max - min));
    if (next !== value) {
      setDraft(null);
      gesture.current = { start: next, committed: true };
      commitRef.current?.(next);
    }
  };

  return (
    <div
      className={styles.root}
      style={{ '--ratio': ratio }}
      data-ghost={draft === null && (value === null || value === undefined) ? true : undefined}
      data-compact={compact || undefined}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        tap.current = null;
      }}
    >
      {ticks.length ? (
        <div className={styles.ticks} aria-hidden="true">
          {ticks.map((tick) => (
            <span key={tick.key ?? tick.value} className={styles.tick} style={{ left: at(tick.value) }} data-labelled={tick.label ? true : undefined} data-strong={tick.strong || undefined}>
              {tick.label ? <span>{tick.label}</span> : null}
            </span>
          ))}
        </div>
      ) : null}
      <div className={styles.trackArea}>
        {marker ? <span className={styles.marker} style={{ left: at(marker.value) }} aria-hidden="true" /> : null}
        <input
          ref={inputRef}
          id={id}
          type="range"
          className={styles.input}
          min={min}
          max={max}
          step={step}
          value={current}
          disabled={disabled}
          aria-labelledby={labelledBy}
          aria-describedby={describedBy}
          aria-valuetext={valueText?.(current, draft === null && (value === null || value === undefined))}
          onChange={(event) => {
            const next = Number(event.target.value);
            setDraft(next);
            onDraft?.(next);
          }}
        />
      </div>
    </div>
  );
});

export default MarkSlider;
