import { forwardRef, useEffect, useId, useRef, useState } from 'react';
import {
  GRADE_SCALE,
  OUT_OF_PICKS,
  describeMark,
  floorTenth,
  formatPercent,
  formatScore,
  gradeStanding,
  joinMark,
  letterFor,
  letterTicks,
  parseMark,
  percentsFrom,
  scoreFor,
  scoreGrid,
  seedFor,
  splitMark,
  stepMark,
  suggestOutOf,
} from '@src/lib';
import MarkSlider from './MarkSlider';
import workspace from './workspace.module.scss';
import styles from './markSheet.module.scss';

const LETTERS = GRADE_SCALE.filter((row) => row.min > 0);
const clean = (value) => value.replace(/[^0-9.,/]/g, '').slice(0, 9);
const num = (text) => (text === '' || text === undefined ? null : Number(String(text).replace(',', '.')));
const validTotal = (outOf) => {
  const total = num(outOf);
  return total && total > 0 && /^\d{0,4}(?:[.,]\d{0,3})?$/.test(outOf) ? total : null;
};
const shown = (value) => (value === null || value === undefined ? '—' : formatPercent(floorTenth(value)));
// The readout fields size to what they hold, so '17.25' or '150' is never clipped.
const fieldWidth = (text, least) => `${Math.min(7, Math.max(least, String(text).length + 0.6))}ch`;

// One item's controls. Keyed by the item, so Next starts it afresh (its Undo point, its suggested total).
function SheetBody({ item, nextItem, plan, marks, standing, need, target, ready, details, onCommit, onNext, onDone, focusOnMount, carried }) {
  const base = useId();
  const saved = marks[item.id] || '';
  const [snapshot] = useState(saved);
  // An item with a saved mark keeps its own kind (a percentage stays a percentage when cleared); an unmarked one
  // starts from its group's total, which counts as chosen only once the student picks or types a total.
  const [pendingOut, setPendingOut] = useState(() => (saved ? splitMark(saved).outOf : suggestOutOf(plan, marks, item.id)));
  const [totalChosen, setTotalChosen] = useState(!!saved);
  // A score set aside while trying a smaller total, given back when a total it fits is chosen again.
  const [heldScore, setHeldScore] = useState('');
  const [savedHere, setSavedHere] = useState(false);
  const [typingTotal, setTypingTotal] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  // The slider's value while it is being dragged, shown in the readout before it is saved.
  const [draft, setDraft] = useState(null);
  const headingRef = useRef(null);
  const scoreRef = useRef(null);
  const outOfRef = useRef(null);
  const text = saved;
  const { score, outOf: savedOut } = splitMark(text);
  const outOf = text ? savedOut : pendingOut;
  const total = validTotal(outOf);
  const grid = scoreGrid(outOf);
  const parsed = parseMark(score, outOf);
  const error = typingTotal && parsed.field ? null : parsed.error;
  const shownScore = draft === null ? score : formatScore(draft);
  const mark = describeMark(joinMark({ score: shownScore, outOf }));
  const dropped = standing.dropped.includes(item.id);
  const seed = seedFor(plan, standing, item.id);
  const max = total ?? 100;
  const value = parsed.percent === null ? null : num(score);
  const sameGroupTotal = !text && pendingOut ? plan.items.find((entry) => entry.groupId === item.groupId && entry.id !== item.id && splitMark(marks[entry.id]).outOf === pendingOut) : null;
  const needScore = need?.status === 'reachable' && total ? scoreFor(need.average, total) : null;
  const before = gradeStanding(plan, percentsFrom({ ...marks, [item.id]: snapshot })).current;
  // The effect line and Undo belong to what this sheet saved, not to a change made in another tab.
  const changed = savedHere && text !== snapshot;
  const previous = describeMark(snapshot).short || snapshot || 'not marked';
  let effect = '';
  if (changed && floorTenth(before ?? -1) !== floorTenth(standing.current ?? -1)) {
    effect = `Avg ${shown(before)} → ${shown(standing.current)}${standing.current !== null ? ` ${letterFor(floorTenth(standing.current)).letter}` : ''}`;
  } else if (changed && !score && outOf) effect = `Out of ${outOf} set`;

  const save = (next) => {
    setSavedHere(true);
    onCommit(item.id, next);
  };
  const focusScore = () => scoreRef.current?.focus({ preventScroll: true });
  const choose = (pick) => {
    if (pick === 'other') {
      outOfRef.current?.focus();
      outOfRef.current?.select();
      return;
    }
    setPendingOut(pick);
    setTotalChosen(true);
    // A score that fits the new total stays; one that doesn't is set aside (not lost) and comes back with a total
    // it fits. Scores are never rescaled.
    const candidate = score || heldScore;
    const fits = candidate !== '' && num(candidate) !== null && num(candidate) <= (validTotal(pick) ?? 100);
    setHeldScore(fits ? '' : candidate);
    save(joinMark({ score: fits ? candidate : '', outOf: pick }));
  };
  const setField = (field, raw) => {
    let next = { score, outOf, [field]: clean(raw).replace(/\//g, field === 'outOf' ? '' : '/') };
    // A slash in the mark field moves to "out of": typing 17/20 or pasting it fills both fields.
    if (field === 'score' && next.score.includes('/')) {
      const [first, ...rest] = next.score.split('/');
      next = { score: first, outOf: rest.join('') || outOf };
      setTotalChosen(true);
      outOfRef.current?.focus();
      if (!rest.join('')) outOfRef.current?.select();
    } else if (field === 'score' && !totalChosen && total && num(next.score) > total && num(next.score) <= 100) {
      // "85" in an item that only borrowed its group's /20 means 85%, not 85 out of 20.
      next = { score: next.score, outOf: '' };
      setPendingOut('');
    }
    if (field === 'outOf') {
      setPendingOut(next.outOf);
      setTotalChosen(true);
    }
    setHeldScore('');
    save(joinMark(next));
  };
  // A mark that can't be right stops Next and Enter where it is, and says why at once.
  const blocked = () => {
    if (!parsed.error) return false;
    (parsed.field === 'outOf' ? outOfRef : scoreRef).current?.focus();
    setAnnouncement(`${item.title}: ${parsed.error}.`);
    return true;
  };
  const goNext = (fromField) => {
    if (blocked()) return;
    onNext({ fromField, spoken: changed ? `Saved ${item.title}, ${mark.spoken}.` : '' });
  };
  const onEnter = (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    if (nextItem) goNext(true);
    else if (!blocked()) onDone();
  };
  const undo = () => {
    save(snapshot);
    setHeldScore('');
    focusScore();
    setAnnouncement(`Undone. ${item.title} is back to ${previous}.`);
  };

  useEffect(() => {
    // Each item starts at the top of the sheet, whatever the last one was scrolled to.
    const dialog = headingRef.current?.closest('dialog');
    if (dialog) dialog.scrollTop = 0;
    if (focusOnMount === 'field' || (focusOnMount && window.matchMedia?.('(pointer: fine)').matches)) {
      focusScore();
      scoreRef.current?.select();
    } else if (focusOnMount) headingRef.current?.focus({ preventScroll: true });
    // What the previous item saved, spoken once this item's live region exists.
    const timer = carried ? setTimeout(() => setAnnouncement(carried), 60) : 0;
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // One announcement after a change settles (the page's own live region is inert behind the sheet).
  const spoken = `Saved. ${item.title}, ${text ? mark.spoken : 'not marked'}. Course average ${standing.current === null ? 'not set' : `${floorTenth(standing.current)} percent, ${letterFor(floorTenth(standing.current)).letter}`}.`;
  const firstText = useRef(text);
  useEffect(() => {
    if (text === firstText.current) return undefined;
    const timer = setTimeout(() => setAnnouncement(spoken), 700);
    return () => clearTimeout(timer);
  }, [text, spoken]);

  let status = 'Not marked yet';
  if (error && draft === null) status = error;
  else if (dropped && mark.percent !== null) status = `${shown(mark.percent)} · Dropped (lowest quiz)`;
  else if (mark.percent !== null) status = `${shown(mark.percent)} · ${mark.letter}`;
  const atMin = !ready || (value !== null && value <= 0);
  const atMax = !ready || (value !== null && value >= max);
  const stepSize = grid ? 0.5 : 1;
  const stepLabel = grid ? 'half a point' : 'one point';
  const step = (delta, limit) => {
    // aria-disabled, not disabled, so a stepper that reaches its limit keeps focus.
    if (!limit) save(stepMark(joinMark({ score, outOf }), delta, { seed }));
  };

  return (
    <div className={styles.body} data-mark-sheet-body={item.id}>
      <div className={styles.head}>
        <div>
          <h3 id={`${base}-title`} ref={headingRef} tabIndex={-1} data-sheet-title>
            {item.title}
          </h3>
          <p id={`${base}-details`} className={workspace.meta}>
            {details}
          </p>
        </div>
        <button type="button" className={styles.close} data-close-sheet aria-label="Close" onClick={onDone}>
          <span aria-hidden="true">×</span>
        </button>
      </div>

      <div className={styles.readout}>
        <button type="button" className={styles.step} aria-label={`${item.title}: ${stepLabel} less`} aria-disabled={atMin || undefined} onClick={() => step(-stepSize, atMin)}>
          <span aria-hidden="true">−</span>
        </button>
        <div className={styles.fields} data-invalid={error ? true : undefined}>
          <input
            ref={scoreRef}
            id={`${base}-score`}
            data-grade-score
            type="text"
            inputMode="decimal"
            enterKeyHint={nextItem ? 'next' : 'done'}
            autoComplete="off"
            spellCheck={false}
            placeholder="—"
            maxLength={9}
            value={shownScore}
            style={{ width: fieldWidth(shownScore || '—', 2.4) }}
            disabled={!ready}
            aria-label={`${item.title} score`}
            aria-invalid={error && parsed.field === 'score' ? true : undefined}
            aria-describedby={`${base}-status`}
            onChange={(event) => setField('score', event.target.value)}
            onKeyDown={onEnter}
          />
          <span className={styles.slash} aria-hidden="true">
            /
          </span>
          <input
            ref={outOfRef}
            id={`${base}-out-of`}
            type="text"
            inputMode="decimal"
            enterKeyHint={nextItem ? 'next' : 'done'}
            autoComplete="off"
            spellCheck={false}
            placeholder="100"
            maxLength={7}
            value={outOf}
            style={{ width: fieldWidth(outOf || '100', 2.2) }}
            disabled={!ready}
            aria-label={`${item.title}: out of`}
            aria-invalid={error && parsed.field === 'outOf' ? true : undefined}
            aria-describedby={`${base}-status`}
            onChange={(event) => setField('outOf', event.target.value)}
            onKeyDown={onEnter}
            onFocus={() => setTypingTotal(true)}
            onBlur={() => setTypingTotal(false)}
          />
        </div>
        <button type="button" className={styles.step} aria-label={`${item.title}: ${stepLabel} more`} aria-disabled={atMax || undefined} onClick={() => step(stepSize, atMax)}>
          <span aria-hidden="true">+</span>
        </button>
      </div>
      {/* The status row keeps its height, so nothing below moves under a finger when Undo appears. */}
      <div className={styles.statusRow}>
        <p id={`${base}-status`} className={styles.status} data-state={error && draft === null ? 'error' : undefined}>
          <span className={styles.pill}>{status}</span>
        </p>
        {effect ? <span className={styles.effect}>{effect}</span> : null}
        {changed ? (
          <button type="button" className={styles.undo} aria-label={`Undo: back to ${previous}`} onClick={undo}>
            Undo
          </button>
        ) : null}
      </div>

      <fieldset className={styles.picks}>
        <legend>Out of</legend>
        <div className={styles.pickRow} data-lenis-prevent>
          {[...new Set([...OUT_OF_PICKS, ...(outOf && !OUT_OF_PICKS.includes(outOf) ? [outOf] : [])])].map((pick) => (
            <label key={pick || 'percent'} className={styles.chip} htmlFor={`${base}-total-${pick || 'percent'}`}>
              <input id={`${base}-total-${pick || 'percent'}`} type="radio" name={`${base}-out-of-pick`} checked={outOf === pick} disabled={!ready} onChange={() => choose(pick)} />
              <span>{pick ? `/${pick}` : '%'}</span>
            </label>
          ))}
          <button type="button" className={styles.chip} disabled={!ready} onClick={() => choose('other')}>
            Other
          </button>
        </div>
      </fieldset>

      {grid ? (
        <fieldset className={styles.grid}>
          <legend>
            Score out of {outOf}
            {sameGroupTotal ? <span className={styles.legendNote}> · same total as {sameGroupTotal.title}</span> : null}
          </legend>
          <div className={styles.gridChips}>
            {/* Highest first: the likely scores sit at the top, where the thumb is. */}
            {[...grid].reverse().map((cell) => (
              <label
                key={cell.score}
                className={styles.scoreChip}
                htmlFor={`${base}-score-${cell.score}`}
                data-need={cell.score === needScore ? target?.letter : undefined}
                data-meets={needScore !== null && cell.score >= needScore ? true : undefined}
              >
                <input
                  id={`${base}-score-${cell.score}`}
                  type="radio"
                  name={`${base}-score-pick`}
                  checked={value === cell.score}
                  disabled={!ready}
                  aria-label={`${cell.score} out of ${outOf}, ${cell.letter}${cell.score === needScore ? `, reaches your ${target?.letter} target` : ''}`}
                  onChange={() => save(`${cell.score}/${outOf}`)}
                />
                <span className={styles.scoreValue} aria-hidden="true">
                  {cell.score}
                </span>
                <span className={styles.scoreLetter} aria-hidden="true">
                  {cell.letter}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      ) : (
        <div className={styles.sliderBlock}>
          <p id={`${base}-slider-label`} className={styles.sliderLabel}>
            {total ? `Score out of ${outOf}` : 'Percentage'}: tap or slide
            {sameGroupTotal ? <span className={styles.legendNote}> · same total as {sameGroupTotal.title}</span> : null}
          </p>
          <MarkSlider
            id={`${base}-slider`}
            min={0}
            max={max}
            step={1}
            value={value}
            ghost={total ? Math.round((seed * total) / 100) : seed}
            ticks={letterTicks(max).map((tick) => ({ key: tick.letter, value: tick.value, label: tick.labelled ? tick.letter : null }))}
            marker={need?.status === 'reachable' ? { value: total ? (need.average * total) / 100 : need.average } : null}
            labelledBy={`${base}-slider-label`}
            describedBy={`${base}-status`}
            disabled={!ready}
            valueText={(v, ghost) => {
              const percent = total ? (v / total) * 100 : v;
              const said = `${total ? `${v} out of ${outOf}, ` : ''}${floorTenth(percent)} percent, ${letterFor(floorTenth(percent)).letter}`;
              return ghost ? `Not marked yet, starts at ${said}` : said;
            }}
            onDraft={setDraft}
            onCancel={() => setDraft(null)}
            onCommit={(v) => {
              setDraft(null);
              save(joinMark({ score: formatScore(v), outOf: total ? outOf : '' }));
            }}
          />
          {!total ? (
            <div className={styles.letters} role="group" aria-label="Set by letter">
              <button type="button" className={styles.chip} aria-label="Full marks, 100 percent" aria-pressed={num(score) === 100} disabled={!ready} onClick={() => save('100')}>
                <strong>100</strong>
              </button>
              {LETTERS.map((row) => (
                <button
                  key={row.letter}
                  type="button"
                  className={styles.chip}
                  aria-label={`Set to ${row.letter}, ${row.min} percent`}
                  aria-pressed={num(score) === row.min}
                  disabled={!ready}
                  onClick={() => save(String(row.min))}
                >
                  <strong>{row.letter}</strong> <span>{row.min}</span>
                </button>
              ))}
            </div>
          ) : null}
          {!total ? <p className={workspace.meta}>A letter counts as its lowest mark: B+ = 77%.</p> : null}
        </div>
      )}
      {target && need ? (
        <p className={styles.needCaption}>
          {need.status === 'reachable' && need.item ? `${target.letter} needs at least ${formatPercent(need.average)} here${needScore !== null ? ` (${needScore}/${outOf})` : ''}.` : null}
          {need.status === 'reachable' && !need.item
            ? `${target.letter} needs an average of ${formatPercent(need.average)} on this and everything else still to be marked${needScore !== null ? ` (${needScore}/${outOf} here)` : ''}.`
            : null}
          {need.status === 'secured' ? `${target.letter} is already secured.` : null}
          {need.status === 'unreachable' ? `${target.letter} is out of reach.` : null}
        </p>
      ) : null}

      <div className={styles.footer}>
        <button
          type="button"
          className={styles.clearMark}
          aria-disabled={!ready || !text || undefined}
          onClick={() => {
            if (!ready || !text) return;
            save('');
            focusScore();
          }}
        >
          Clear
        </button>
        <span className={styles.footerEnd}>
          <button type="button" className={styles.done} onClick={onDone}>
            Done
          </button>
          {nextItem ? (
            <button type="button" className={styles.next} onClick={() => goNext(false)}>
              Next: {nextItem.title}
            </button>
          ) : null}
        </span>
      </div>
      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>
    </div>
  );
}

// The bottom sheet (a centred dialog from 700 px). Grades.jsx opens and closes it through bindModal.
const MarkSheet = forwardRef(({ item, ...props }, ref) => {
  const localRef = useRef(null);
  const setRef = (node) => {
    localRef.current = node;
    if (typeof ref === 'function') ref(node);
    else if (ref) ref.current = node;
  };

  // Keep the sheet, and the field being typed in, above the phone keyboard.
  useEffect(() => {
    const dialog = localRef.current;
    const viewport = window.visualViewport;
    if (!dialog || !viewport) return undefined;
    const place = () => {
      const covered = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      dialog.style.setProperty('--kb', `${Math.round(covered)}px`);
      const field = dialog.contains(document.activeElement) ? document.activeElement : null;
      if (field?.matches('input[type="text"]')) field.scrollIntoView({ block: 'nearest' });
    };
    const onFocusIn = (event) => {
      if (!event.target.matches?.('input[type="text"]')) return;
      viewport.addEventListener('resize', place);
      viewport.addEventListener('scroll', place);
      place();
    };
    const onFocusOut = () => {
      viewport.removeEventListener('resize', place);
      viewport.removeEventListener('scroll', place);
      dialog.style.setProperty('--kb', '0px');
    };
    dialog.addEventListener('focusin', onFocusIn);
    dialog.addEventListener('focusout', onFocusOut);
    return () => {
      dialog.removeEventListener('focusin', onFocusIn);
      dialog.removeEventListener('focusout', onFocusOut);
      onFocusOut();
    };
  }, []);

  return (
    <dialog ref={setRef} className={styles.sheet} aria-label={item ? item.title : 'Mark'} data-lenis-prevent data-mark-sheet>
      {/* eslint-disable-next-line react/jsx-props-no-spreading */}
      {item ? <SheetBody key={item.id} item={item} {...props} /> : null}
    </dialog>
  );
});

export default MarkSheet;
