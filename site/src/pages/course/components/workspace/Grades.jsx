import { useEffect, useId, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { GRADE_SCALE, floorTenth, formatPercent, gradeNeeded, gradePlan, gradeStanding, joinMark, letterFor, parseMark, percentsFrom, roundGrade, splitMark } from '@src/lib';
import { useGrades } from '@src/lib/react';
import { useCourse } from '@src/pages/course/hooks/useCourseState';
import workspace from './workspace.module.scss';
import styles from './grades.module.scss';

// Standings round down and required marks round up, so the calculator never flatters.
const shown = (value) => formatPercent(floorTenth(value));
const weight = (value) => formatPercent(Math.round(value * 100) / 100);
const TARGETS = GRADE_SCALE.filter((row) => row.min > 0);
const clean = (value) => value.replace(/[^0-9.,/]/g, '').slice(0, 9);

// "an A- (80%)", "a B+ (77%)"; "the Final Exam" but "Lab Quiz 4".
const grade = (row) => `${/^[AEF]/.test(row.letter) ? 'an' : 'a'} ${row.letter} (${row.min}%)`;
const named = (title) => (/\d$/.test(title) ? title : `the ${title}`);
const capital = (text) => `${text.charAt(0).toUpperCase()}${text.slice(1)}`;

function needText(row, need, standing) {
  const goal = grade(row);
  if (need.status === 'secured') return `You’ve already secured ${goal}, even with 0 on everything still to be marked.`;
  if (need.status === 'unreachable') {
    const best = floorTenth(standing.maximum);
    return `${capital(goal)} is out of reach: the highest grade still possible is ${formatPercent(best)} (${letterFor(best).letter}).`;
  }
  if (need.status === 'complete') return `All marks are in, and ${goal} wasn’t reached.`;
  const mark = formatPercent(need.average);
  if (need.item) return `For ${goal}, you need at least ${mark} on ${named(need.item.title)}.`;
  return `For ${goal}, you need an average of at least ${mark} on everything still to be marked (${weight(standing.remaining)} of the course).`;
}

function headlineText(standing, current) {
  if (current === null) return 'Enter a mark to see your average.';
  if (standing.complete) return 'Every mark is in. This is your calculated final grade.';
  const projected = floorTenth(standing.projected);
  if (projected - current < 0.1) return `Keep this average on the remaining ${weight(standing.remaining)} of the course and it becomes your final grade.`;
  // A low quiz that counts now is dropped once a better one arrives.
  return `Keep averaging ${formatPercent(current)} on what’s left and you finish with ${formatPercent(projected)} (${letterFor(projected).letter}), because your lowest quiz is dropped.`;
}

function Meter({ standing, target }) {
  const secured = Math.min(100, standing.secured);
  const maximum = Math.min(100, standing.maximum);
  const label = [`Secured ${shown(secured)} of the course.`, `Up to ${shown(maximum)} still possible.`, target ? `Target ${target.letter}, ${target.min}%.` : ''].filter(Boolean).join(' ');
  return (
    <div className={styles.meter}>
      <div className={styles.track} role="img" aria-label={label}>
        <div className={styles.fill}>
          <span className={styles.secured} style={{ width: `${secured}%` }} />
          <span className={styles.possible} style={{ left: `${secured}%`, width: `${maximum - secured}%` }} />
          <span className={styles.lost} style={{ left: `${maximum}%`, width: `${100 - maximum}%` }} />
        </div>
        <span className={styles.pass} style={{ left: '50%' }} />
        {target ? <span className={styles.target} style={{ left: `${target.min}%` }} data-label={`${target.letter} ${target.min}%`} data-edge={target.min >= 85 ? 'end' : undefined} /> : null}
      </div>
      <div className={styles.scale} aria-hidden="true">
        <span>0</span>
        <span style={{ left: '50%' }}>Pass 50</span>
        <span>100</span>
      </div>
      <ul className={styles.legend} aria-hidden="true">
        <li data-kind="secured">Secured</li>
        <li data-kind="possible">Still possible</li>
        <li data-kind="lost">No longer possible</li>
      </ul>
    </div>
  );
}

export default function Grades() {
  const { courseId, course, section } = useCourse();
  const [grades, update] = useGrades(courseId);
  const baseId = useId();
  const [typingTotal, setTypingTotal] = useState(null);
  const [announcement, setAnnouncement] = useState('');
  const cleared = useRef(false);
  const plan = useMemo(() => gradePlan(courseId, { section: section ?? undefined }), [courseId, section]);
  const percents = useMemo(() => percentsFrom(grades.marks), [grades.marks]);
  const standing = useMemo(() => gradeStanding(plan, percents), [plan, percents]);
  const needs = useMemo(
    () =>
      TARGETS.map((row) => ({
        row,
        need: gradeNeeded(plan, percents, row.min, standing),
      })),
    [plan, percents, standing],
  );
  const target = TARGETS.find((row) => row.min === grades.target) || null;
  const chosen = needs.find((entry) => entry.row === target);
  const current = standing.current === null ? null : floorTenth(standing.current);
  const letter = letterFor(current);
  const hasMarks = Object.keys(grades.marks).length > 0;
  const answer = chosen ? needText(chosen.row, chosen.need, standing) : 'Choose a grade to see exactly what it takes.';
  const fieldId = (item, part) => `${baseId}-${item.id.replace(/[^a-z0-9-]/gi, '-')}-${part}`;
  const securedLetter = letterFor(floorTenth(standing.secured));
  const summary = current === null ? 'No marks entered.' : `Current average ${formatPercent(current)}, ${letter.letter}.`;

  // One polite announcement once typing pauses, instead of every intermediate value (none on opening).
  const opened = useRef(false);
  useEffect(() => {
    if (!grades.ready) return undefined;
    if (!opened.current) {
      opened.current = true;
      return undefined;
    }
    const message = cleared.current ? 'Marks cleared.' : [summary, chosen && !standing.complete ? answer : ''].filter(Boolean).join(' ');
    cleared.current = false;
    const timer = setTimeout(() => setAnnouncement(message), 900);
    return () => clearTimeout(timer);
  }, [grades.ready, summary, answer, chosen, standing.complete]);

  const setField = (item, field, raw) => {
    const saved = splitMark(grades.marks[item.id]);
    let next = { ...saved, [field]: clean(raw).replace(/\//g, field === 'outOf' ? '' : '/') };
    // A slash in the mark field moves to "out of": typing 17/20 or pasting it fills both fields.
    if (field === 'score' && next.score.includes('/')) {
      const [score, ...rest] = next.score.split('/');
      next = { score, outOf: rest.join('') || saved.outOf };
      const outOf = document.getElementById(fieldId(item, 'out-of'));
      outOf?.focus();
      if (!rest.join('')) outOf?.select();
    }
    const marks = { ...grades.marks };
    const text = joinMark(next);
    if (text) marks[item.id] = text;
    else delete marks[item.id];
    update({ marks });
  };
  // Enter (or the phone keyboard's Next) moves to the next row's mark, from either field.
  const nextRow = (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    const fields = [...document.querySelectorAll('[data-grade-score]')];
    const own = event.currentTarget.closest('li')?.querySelector('[data-grade-score]');
    const next = fields[fields.indexOf(own) + 1];
    if (next) next.focus();
    else event.currentTarget.blur();
  };
  const clear = () => {
    // eslint-disable-next-line no-alert
    if (!window.confirm(`Clear every mark you entered for ${course.code}? Your target grade is cleared too.`)) return;
    cleared.current = true;
    update({ marks: {}, target: null });
    document.querySelector('[data-grade-score]')?.focus();
  };

  return (
    <div className={styles.root} data-grades>
      <div className={workspace.viewHeading}>
        <h2>Grade calculator</h2>
        <p className={styles.saved} data-blocked={grades.saved ? undefined : true} role={grades.saved ? undefined : 'status'}>
          {grades.saved ? 'Saved in this browser' : 'Saving is blocked in this browser, so marks will be lost when you leave.'}
        </p>
      </div>
      <p className={styles.lede}>
        Enter your marks as a percentage or a score, like 17 out of 20. The weights match{' '}
        <Link href={`/${courseId}/#course-grading`} scroll={false}>
          Course info → Grading
        </Link>
        .
      </p>
      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>
      <div className={styles.layout}>
        <section className={styles.entries} aria-labelledby={`${baseId}-marks`}>
          <div className={styles.entriesHeading}>
            <h3 id={`${baseId}-marks`}>Your marks</h3>
            <button type="button" className={styles.clear} onClick={clear} disabled={!hasMarks}>
              Clear marks
            </button>
          </div>
          {/* While the full summary is out of view (phones, short screens), the essentials stay above the marks. */}
          <div className={styles.quick} aria-hidden="true" data-grade-quick>
            <span className={styles.quickValue}>
              {current === null ? '—' : formatPercent(current)}
              {letter ? <strong>{letter.letter}</strong> : null}
            </span>
            <span className={styles.quickNote}>
              {chosen && !standing.complete && chosen.need.status === 'reachable' ? `${chosen.row.letter} needs ${formatPercent(chosen.need.average)}` : `Best possible ${shown(standing.maximum)}`}
            </span>
          </div>
          {plan.groups.map((group) => {
            const groupStanding = standing.groups.find((entry) => entry.id === group.id);
            return (
              <div key={group.id} className={styles.group} data-grade-group={group.id}>
                {/* A one-item group (a midterm, a final) is just its row; its title would repeat the row's. */}
                {group.items.length > 1 ? (
                  <>
                    <div className={styles.groupHeading}>
                      <h4>{group.title}</h4>
                      <span>
                        {groupStanding.average !== null ? <span className={styles.groupAverage}>Average {shown(groupStanding.average)} · </span> : null}
                        {weight(group.weight)}
                      </span>
                    </div>
                    {group.note ? <p className={workspace.meta}>{group.note}</p> : null}
                  </>
                ) : null}
                <ul>
                  {group.items.map((item) => {
                    const { score, outOf } = splitMark(grades.marks[item.id]);
                    const parsed = parseMark(score, outOf);
                    // While the total is still being typed (8 / 1… on the way to 8 / 10), say nothing yet; a wrong
                    // total shows once the field is left.
                    const unfinished = typingTotal === item.id && parsed.field;
                    const error = unfinished ? null : parsed.error;
                    const dropped = standing.dropped.includes(item.id);
                    const details = [group.drop ? `${weight(item.weight)} if kept` : weight(item.weight), item.dateLabel, item.parts > 1 ? `${item.parts} submissions, one combined mark` : '']
                      .filter(Boolean)
                      .join(' · ');
                    let result = '';
                    if (error) result = error;
                    else if (parsed.percent !== null && dropped) result = `${shown(parsed.percent)} · Dropped`;
                    else if (parsed.percent !== null && outOf) result = shown(parsed.percent);
                    const resultId = fieldId(item, 'result');
                    return (
                      <li key={item.id} className={styles.row} data-dropped={dropped || undefined} data-invalid={error ? true : undefined}>
                        <div className={styles.rowText}>
                          <label htmlFor={fieldId(item, 'score')}>{item.title}</label>
                          <span id={fieldId(item, 'details')} className={workspace.meta}>
                            {details}
                          </span>
                        </div>
                        <div className={styles.fields}>
                          <input
                            id={fieldId(item, 'score')}
                            data-grade-score
                            type="text"
                            inputMode="decimal"
                            enterKeyHint="next"
                            autoComplete="off"
                            spellCheck={false}
                            placeholder="—"
                            maxLength={9}
                            value={score}
                            disabled={!grades.ready}
                            aria-invalid={error && parsed.field === 'score' ? true : undefined}
                            aria-describedby={`${fieldId(item, 'details')} ${resultId}`}
                            onChange={(event) => setField(item, 'score', event.target.value)}
                            onKeyDown={nextRow}
                          />
                          <span className={styles.slash} aria-hidden="true">
                            /
                          </span>
                          <input
                            id={fieldId(item, 'out-of')}
                            type="text"
                            inputMode="decimal"
                            enterKeyHint="next"
                            autoComplete="off"
                            spellCheck={false}
                            placeholder="100"
                            maxLength={7}
                            value={outOf}
                            disabled={!grades.ready}
                            aria-label={`${item.title}: out of`}
                            aria-invalid={error && parsed.field === 'outOf' ? true : undefined}
                            aria-describedby={resultId}
                            onChange={(event) => setField(item, 'outOf', event.target.value)}
                            onKeyDown={nextRow}
                            onFocus={() => setTypingTotal(item.id)}
                            onBlur={() => setTypingTotal(null)}
                          />
                        </div>
                        <span id={resultId} className={styles.result}>
                          {result}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </section>
        <div className={styles.side}>
          <section className={styles.standing} aria-labelledby={`${baseId}-standing`}>
            <h3 id={`${baseId}-standing`} className={workspace.eyebrow}>
              {standing.complete ? 'Final grade' : 'Current average'}
            </h3>
            <div className={styles.headline} data-grade-current>
              <span className={styles.big}>{current === null ? '—' : formatPercent(current)}</span>
              {letter ? (
                <span className={styles.letter}>
                  <strong>{letter.letter}</strong>
                  <span>{roundGrade(current) > current ? `Rounds to ${roundGrade(current)}% · GPA ${letter.points.toFixed(2)}` : `GPA ${letter.points.toFixed(2)}`}</span>
                </span>
              ) : null}
            </div>
            <p className={styles.headlineNote}>{headlineText(standing, current)}</p>
            <Meter standing={standing} target={target} />
            <dl className={styles.stats}>
              <div>
                <dt>Secured</dt>
                <dd>{shown(standing.secured)}</dd>
                <dd className={workspace.meta}>{securedLetter.letter === 'F' ? 'Earned so far' : `At least ${securedLetter.letter}`}</dd>
              </div>
              <div>
                <dt>Best possible</dt>
                <dd>{shown(standing.maximum)}</dd>
                <dd className={workspace.meta}>Up to {letterFor(floorTenth(standing.maximum)).letter}</dd>
              </div>
              <div>
                <dt>Still to be marked</dt>
                <dd>{weight(standing.remaining)}</dd>
                <dd className={workspace.meta}>of the course</dd>
              </div>
            </dl>
          </section>
          <section className={styles.targets} aria-labelledby={`${baseId}-targets`}>
            <h3 id={`${baseId}-targets`}>What do I need?</h3>
            {standing.complete ? (
              <p className={styles.answer}>All marks are in. Clear a mark to try a different result.</p>
            ) : (
              <>
                <p className={workspace.meta}>Choose a grade. Each one shows the average you need on everything still to be marked.</p>
                <div className={styles.grid} role="group" aria-label="Target grade">
                  {needs.map(({ row, need }) => {
                    let value = formatPercent(need.average ?? 0);
                    let state = 'reachable';
                    if (need.status === 'secured') [value, state] = ['Secured', 'secured'];
                    if (need.status === 'unreachable') [value, state] = ['Out of reach', 'unreachable'];
                    return (
                      <button
                        key={row.letter}
                        type="button"
                        className={styles.chip}
                        data-state={state}
                        aria-pressed={target === row}
                        aria-label={`${row.letter}, ${row.min}% or more: ${state === 'reachable' ? `need ${value} average` : value.toLowerCase()}`}
                        onClick={() => update({ target: target === row ? null : row.min })}
                        disabled={!grades.ready}
                      >
                        <span className={styles.chipLetter}>{row.letter}</span>
                        <span className={styles.chipMin}>{row.min}+</span>
                        <span className={styles.chipNeed}>{value}</span>
                      </button>
                    );
                  })}
                </div>
                <p className={styles.answer} data-grade-answer>
                  {answer}
                </p>
              </>
            )}
          </section>
        </div>
        <div className={styles.notes}>
          {plan.quizPolicy ? <p>{plan.quizPolicy}</p> : null}
          <p>
            Letters follow TMU’s undergraduate grading scale (Senate Policy 170(a)). Your final percentage is rounded to a whole number before it becomes a letter, so 79.5% counts as 80%, an A-. A D-
            ({plan.pass}%) is the university’s minimum pass; some programs, including engineering, require more in particular courses.
          </p>
          <p>This is an estimate from the weights in this guide. Your course outline and the grades your instructors post are what count.</p>
          {courseId === 'cen100' ? <p>Rows with two submissions take one combined mark for both. Weights: CEN100 Course Outline F26, p. 9.</p> : null}
          <p>Marks stay in this browser only and are not part of progress backups.</p>
        </div>
      </div>
    </div>
  );
}
