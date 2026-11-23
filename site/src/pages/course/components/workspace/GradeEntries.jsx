import { useEffect, useId, useRef, useState } from 'react';
import { floorTenth, formatPercent, joinMark, parseMark, splitMark } from '@src/lib';
import workspace from './workspace.module.scss';
import styles from './grades.module.scss';

const shown = (value) => formatPercent(floorTenth(value));
const weight = (value) => formatPercent(Math.round(value * 100) / 100);
const cleanField = (text) => text.replace(/[^0-9.,]/g, '').slice(0, 9);

export default function GradeEntries({ plan, standing, grades, update, onClear, firstGroup }) {
  const baseId = useId();
  const [openGroup, setOpenGroup] = useState(null);
  const [editing, setEditing] = useState(null);
  const [typingTotal, setTypingTotal] = useState(false);
  const scoreInput = useRef(null);
  const totalInput = useRef(null);
  const returnFocus = useRef(null);

  useEffect(() => {
    if (editing) {
      scoreInput.current?.focus();
      scoreInput.current?.select();
    } else if (returnFocus.current) {
      document.getElementById(returnFocus.current)?.focus();
      returnFocus.current = null;
    }
  }, [editing]);

  const toggleId = (groupId) => `${baseId}-toggle-${groupId}`;
  const editId = (itemId) => `${baseId}-edit-${itemId}`;
  const open = (group) => {
    const opening = openGroup !== group.id;
    setOpenGroup(opening ? group.id : null);
    setEditing(opening && group.items.length === 1 ? group.items[0].id : null);
    setTypingTotal(false);
  };
  const finish = (group, item) => {
    returnFocus.current = group.items.length === 1 ? toggleId(group.id) : editId(item.id);
    if (group.items.length === 1) setOpenGroup(null);
    setEditing(null);
    setTypingTotal(false);
  };
  const validForExit = (item) => {
    const { score, outOf } = splitMark(grades.marks[item.id]);
    const { field } = parseMark(score, outOf);
    if (!field) return true;
    (field === 'score' ? scoreInput : totalInput).current?.focus();
    setTypingTotal(false);
    return false;
  };
  const onKeyDown = (event, group, item) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      finish(group, item);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (!validForExit(item)) return;
      const next = plan.items[plan.items.findIndex((entry) => entry.id === item.id) + 1];
      if (next) {
        setOpenGroup(next.groupId);
        setEditing(next.id);
        setTypingTotal(false);
      } else finish(group, item);
    }
  };
  const setField = (item, field, raw) => {
    const next = splitMark(grades.marks[item.id]);
    if (field === 'score' && raw.includes('/')) {
      const [score, outOf] = raw.split('/');
      next.score = cleanField(score);
      next.outOf = outOf ? cleanField(outOf) : next.outOf;
      totalInput.current?.focus();
      if (!outOf) totalInput.current?.select();
    } else {
      next[field] = cleanField(raw);
    }
    if (field === 'score' && item.outOf && next.score && !next.outOf) next.outOf = String(item.outOf);
    const marks = { ...grades.marks };
    const text = joinMark(next);
    if (text) marks[item.id] = text;
    else delete marks[item.id];
    update({ marks });
  };
  const clear = () => {
    if (!onClear()) return;
    setOpenGroup(null);
    setEditing(null);
    setTypingTotal(false);
    firstGroup.current?.focus();
  };

  return (
    <section className={styles.entries} aria-labelledby={`${baseId}-marks`}>
      <div className={styles.entriesHeading}>
        <h3 id={`${baseId}-marks`}>Your marks</h3>
        <button type="button" className={styles.clear} onClick={clear} disabled={!Object.keys(grades.marks).length}>
          Clear marks
        </button>
      </div>
      {plan.groups.map((group, groupIndex) => {
        const groupStanding = standing.groups.find((entry) => entry.id === group.id);
        const opened = group.id === openGroup;
        const single = group.items.length === 1;
        const groupWeight = `${group.bonus ? 'Bonus up to ' : ''}${weight(group.weight)}`;
        const needsCorrection = group.items.some((item) => {
          if (item.id === editing && typingTotal) return false;
          const { score, outOf } = splitMark(grades.marks[item.id]);
          return Boolean(parseMark(score, outOf).error);
        });
        const groupValue = groupStanding.average === null ? 'Add mark' : shown(groupStanding.average);
        const groupStatus = single ? groupValue : `${groupStanding.marked}/${group.items.length} marked`;
        return (
          <div key={group.id} className={styles.group} data-grade-group={group.id}>
            <h4 className={styles.groupHeading}>
              <button
                id={toggleId(group.id)}
                ref={groupIndex === 0 ? firstGroup : undefined}
                type="button"
                className={styles.groupToggle}
                aria-expanded={opened}
                aria-controls={`${baseId}-group-${group.id}`}
                onClick={() => open(group)}
                disabled={!grades.ready}
                data-grade-toggle
              >
                <span className={styles.groupTitle}>{single ? group.items[0].title : group.title}</span>
                <span className={styles.groupMeta}>
                  {groupWeight} · {needsCorrection ? 'Check mark' : groupStatus}
                  {!single && groupStanding.average !== null ? ` · Avg ${shown(groupStanding.average)}` : ''}
                </span>
              </button>
            </h4>
            <div id={`${baseId}-group-${group.id}`} hidden={!opened}>
              {opened && (
                <>
                  {group.note ? <p className={workspace.meta}>{group.note}</p> : null}
                  <ul>
                    {group.items.map((item) => {
                      const active = item.id === editing;
                      const { score, outOf } = splitMark(grades.marks[item.id]);
                      const parsed = parseMark(score, outOf);
                      const error = active && typingTotal ? null : parsed.error;
                      const dropped = standing.dropped.includes(item.id);
                      const share = group.bonus ? `Bonus up to ${weight(item.weight)}` : `${weight(item.weight)}${group.drop ? ' if kept' : ''}`;
                      const details = [share, item.dateLabel, item.parts > 1 ? `${item.parts} submissions, one combined mark` : ''].filter(Boolean).join(' · ');
                      const itemId = `${baseId}-${item.id}`;
                      const result = error || [outOf && parsed.percent !== null ? shown(parsed.percent) : '', dropped ? 'Dropped' : ''].filter(Boolean).join(' · ');
                      const markLabel = score ? score + (outOf ? `/${outOf}` : '%') : 'Add mark';
                      return (
                        <li key={item.id} className={styles.row} data-dropped={dropped || undefined} data-invalid={error ? true : undefined}>
                          <div className={styles.rowText}>
                            {active ? (
                              <label className={styles.itemTitle} htmlFor={`${itemId}-score`}>
                                {item.title}
                              </label>
                            ) : (
                              <span className={styles.itemTitle}>{item.title}</span>
                            )}
                            <span id={`${itemId}-details`} className={workspace.meta}>
                              {details}
                            </span>
                          </div>
                          {active ? (
                            <div className={styles.fields}>
                              <input
                                id={`${itemId}-score`}
                                ref={scoreInput}
                                data-grade-score
                                type="text"
                                inputMode="decimal"
                                enterKeyHint="next"
                                autoComplete="off"
                                spellCheck={false}
                                placeholder="—"
                                maxLength={19}
                                value={score}
                                aria-invalid={error && parsed.field === 'score' ? true : undefined}
                                aria-describedby={`${itemId}-details ${itemId}-result`}
                                onChange={(event) => setField(item, 'score', event.target.value)}
                                onKeyDown={(event) => onKeyDown(event, group, item)}
                              />
                              <span className={styles.slash} aria-hidden="true">
                                /
                              </span>
                              <input
                                ref={totalInput}
                                type="text"
                                inputMode="decimal"
                                enterKeyHint="next"
                                autoComplete="off"
                                spellCheck={false}
                                placeholder={String(item.outOf ?? 100)}
                                maxLength={9}
                                value={outOf}
                                aria-label={`${item.title}: out of`}
                                aria-invalid={error && parsed.field === 'outOf' ? true : undefined}
                                aria-describedby={`${itemId}-result`}
                                onChange={(event) => setField(item, 'outOf', event.target.value)}
                                onKeyDown={(event) => onKeyDown(event, group, item)}
                                onFocus={() => setTypingTotal(true)}
                                onBlur={() => setTypingTotal(false)}
                              />
                              <button
                                type="button"
                                className={styles.finishEdit}
                                onClick={() => {
                                  if (validForExit(item)) finish(group, item);
                                }}
                              >
                                Done
                              </button>
                            </div>
                          ) : (
                            <button
                              id={editId(item.id)}
                              type="button"
                              className={styles.markButton}
                              data-grade-edit={item.id}
                              aria-label={`${score ? 'Edit' : 'Add'} mark for ${item.title}${score ? `, ${markLabel}` : ''}`}
                              aria-describedby={`${itemId}-details ${itemId}-result`}
                              onClick={() => {
                                setEditing(item.id);
                                setTypingTotal(false);
                              }}
                            >
                              {markLabel}
                            </button>
                          )}
                          <span id={`${itemId}-result`} className={styles.result}>
                            {result}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </div>
          </div>
        );
      })}
    </section>
  );
}
