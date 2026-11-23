import { useEffect, useId, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { GRADE_SCALE, floorTenth, formatPercent, gradeNeeded, gradePlan, gradeProjection, gradeRequirements, gradeStanding, letterFor, percentsFrom, roundGrade } from '@src/lib';
import { useGrades } from '@src/lib/react';
import { useCourse } from '@src/pages/course/hooks/useCourseState';
import GradeEntries from './GradeEntries';
import workspace from './workspace.module.scss';
import styles from './grades.module.scss';

// Standings round down and required marks round up, so the calculator never flatters.
const shown = (value) => formatPercent(floorTenth(value));
const weight = (value) => formatPercent(Math.round(value * 100) / 100);
const TARGETS = GRADE_SCALE.filter((row) => row.min > 0);
// "an A- (80%)", "a B+ (77%)"; "the Final Exam" but "Lab Quiz 4".
const grade = (row) => `${/^[AEF]/.test(row.letter) ? 'an' : 'a'} ${row.letter} (${row.min}%)`;
const named = (title) => (/\d$/.test(title) ? title : `the ${title}`);
const capital = (text) => `${text.charAt(0).toUpperCase()}${text.slice(1)}`;

function needText(row, need, standing, plan) {
  const goal = grade(row);
  // PCS211: the mark needed can come from the other option than the one shown (the course applies the higher one).
  const under = need.option && need.option !== plan.variant ? `, under ${need.optionTitle}` : '';
  if (need.status === 'secured') return `You’ve already secured ${goal}, even with 0 on everything still to be marked.`;
  if (need.status === 'unreachable') {
    const best = floorTenth(standing.maximum);
    return `${capital(goal)} is out of reach: the highest grade still possible is ${formatPercent(best)} (${letterFor(best).letter}).`;
  }
  if (need.status === 'complete') return `All marks are in, and ${goal} wasn’t reached.`;
  const mark = formatPercent(need.average);
  if (need.item) return `For ${goal}, you need at least ${mark} on ${named(need.item.title)}${under}.`;
  return `For ${goal}, you need an average of at least ${mark} on everything still to be marked (${weight(need.remaining ?? standing.remaining)} of the course${under}).`;
}

function headlineText(standing, current, plan) {
  if (standing.complete) return 'Every mark is in. This is your calculated final grade.';
  const projected = floorTenth(standing.projected);
  if (plan.options) return `At your current pace, the higher evaluation option gives you a projected course grade of ${formatPercent(projected)} (${letterFor(projected).letter}).`;
  if (projected - current < 0.1) return `Keep this average on the remaining ${weight(standing.remaining)} of the course and it becomes your final grade.`;
  // A low quiz (or homework) that counts now is dropped once a better one arrives; a bonus adds on top.
  const bonus = plan.groups.find((group) => group.bonus);
  const reason = bonus && !plan.groups.some((group) => group.drop) ? `with the ${bonus.title.toLowerCase()}` : `because your lowest ${plan.courseId === 'chy102' ? 'homework' : 'quiz'} is dropped`;
  return `Keep averaging ${formatPercent(current)} on what’s left and you finish with ${formatPercent(projected)} (${letterFor(projected).letter}), ${reason}.`;
}

// PCS211: which evaluation option the page shows, and why.
function optionSentence(plan, standing) {
  const name = <strong>{plan.variantTitle}</strong>;
  if (standing.current === null) {
    return (
      <>
        Showing {name} ({plan.variantNote}) until you enter marks. The course applies whichever option gives you the higher grade.
      </>
    );
  }
  if (plan.optionalSkipped) {
    return (
      <>
        Using {name} ({plan.variantNote}): with no WebAssign mark entered, its 5% moves to the final exam, as the outline says. Enter a WebAssign mark to compare both options.
      </>
    );
  }
  return (
    <>
      Using {name} ({plan.variantNote}), the higher of the two at your current average. Secured, best possible and the marks needed each use whichever option is higher for them.
    </>
  );
}

const REQUIREMENT = { met: 'Met so far', below: 'Below the minimum so far', open: 'No marks yet' };

function Meter({ standing, target, projection }) {
  const secured = Math.min(100, standing.secured);
  const maximum = Math.min(100, standing.maximum);
  const label = [
    `Secured ${shown(secured)} of the course.`,
    `Up to ${shown(maximum)} still possible.`,
    target ? `Target ${target.letter}, ${target.min}%.` : '',
    projection !== null ? `What-if result ${shown(projection)}.` : '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <div className={styles.meter}>
      <div className={styles.track} role="img" aria-label={label}>
        <div className={styles.fill}>
          <span className={styles.secured} style={{ width: `${secured}%` }} />
          <span className={styles.possible} style={{ left: `${secured}%`, width: `${maximum - secured}%` }} />
          <span className={styles.lost} style={{ left: `${maximum}%`, width: `${100 - maximum}%` }} />
        </div>
        {projection !== null ? <span className={styles.forecast} style={{ left: `${projection}%` }} data-grade-forecast /> : null}
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
        {projection !== null ? <li data-kind="forecast">What-if result</li> : null}
      </ul>
    </div>
  );
}

export default function Grades() {
  const { courseId, course } = useCourse();
  return <CourseGrades key={courseId} courseId={courseId} course={course} />;
}

function CourseGrades({ courseId, course }) {
  const [grades, update] = useGrades(courseId);
  const baseId = useId();
  const [scenarioMark, setScenarioMark] = useState(null);
  const firstGroup = useRef(null);
  const [announcement, setAnnouncement] = useState('');
  const cleared = useRef(false);
  const percents = useMemo(() => percentsFrom(grades.marks), [grades.marks]);
  // CHY102: the grading scheme the student chose; PCS211: whichever option gives the higher grade on these marks.
  const plan = useMemo(() => gradePlan(courseId, { variant: grades.variant ?? undefined, percents }), [courseId, grades.variant, percents]);
  const standing = useMemo(() => gradeStanding(plan, percents), [plan, percents]);
  const requirements = useMemo(() => gradeRequirements(plan, standing), [plan, standing]);
  const target = TARGETS.find((row) => row.min === grades.target) || null;
  const need = useMemo(() => (target ? gradeNeeded(plan, percents, target.min, standing) : null), [target, plan, percents, standing]);
  const current = standing.current === null ? null : floorTenth(standing.current);
  const letter = letterFor(current);
  const assumedMark = scenarioMark ?? Math.round(current ?? 70);
  const projection = standing.complete ? null : gradeProjection(plan, percents, assumedMark);
  const onlyItem = standing.unmarked.length === 1 ? plan.items.find((item) => item.id === standing.unmarked[0]) : null;
  // An optional bonus (PCS211) counts only once it is entered, in every figure.
  const unenteredBonus = plan.groups.find((group) => group.bonus && group.items.every((item) => typeof percents[item.id] !== 'number')) || null;
  const answer = target ? needText(target, need, standing, plan) : '';
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
    const message = cleared.current ? 'Marks cleared.' : [summary, target && !standing.complete ? answer : ''].filter(Boolean).join(' ');
    cleared.current = false;
    const timer = setTimeout(() => setAnnouncement(message), 900);
    return () => clearTimeout(timer);
  }, [grades.ready, summary, answer, target, standing.complete]);

  const clear = () => {
    // eslint-disable-next-line no-alert
    if (!window.confirm(`Clear every mark you entered for ${course.code}? Your target grade is cleared too.`)) return false;
    cleared.current = true;
    setScenarioMark(null);
    update({ marks: {}, target: null });
    return true;
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
        Enter a percentage or a score like 17/20. Course weights come from{' '}
        <Link href={`/${courseId}/#course-grading`} scroll={false}>
          Course info → Grading
        </Link>
        .
      </p>
      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>
      <div className={styles.layout}>
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
            {current === null ? (
              <button type="button" className={styles.clear} disabled={!grades.ready} onClick={() => firstGroup.current?.focus()}>
                Choose an assessment
              </button>
            ) : (
              <p className={styles.headlineNote}>{headlineText(standing, current, plan)}</p>
            )}
            <Meter standing={standing} target={target} projection={projection} />
            <dl className={styles.stats}>
              <div>
                <dt>Secured</dt>
                <dd>{shown(standing.secured)}</dd>
                <dd className={workspace.meta}>{securedLetter.letter === 'F' ? 'Earned so far' : `At least ${securedLetter.letter}`}</dd>
              </div>
              <div>
                <dt>Best possible</dt>
                <dd>{shown(standing.maximum)}</dd>
                <dd className={workspace.meta}>
                  Up to {letterFor(floorTenth(standing.maximum)).letter}
                  {unenteredBonus ? `, without the ${unenteredBonus.title.toLowerCase()} until you enter it` : ''}
                </dd>
              </div>
              <div>
                <dt>Still to be marked</dt>
                <dd>{weight(standing.remaining)}</dd>
                <dd className={workspace.meta}>of the course</dd>
              </div>
            </dl>
            {projection !== null ? (
              <div className={styles.simulator}>
                <div className={styles.simulatorHeading}>
                  <label htmlFor={`${baseId}-what-if`}>{onlyItem ? `What if I score this on ${named(onlyItem.title)}?` : 'What if I average this on the remaining work?'}</label>
                  <output htmlFor={`${baseId}-what-if`}>{formatPercent(assumedMark)}</output>
                </div>
                <input
                  id={`${baseId}-what-if`}
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={assumedMark}
                  disabled={!grades.ready}
                  data-grade-slider
                  aria-valuetext={`${formatPercent(assumedMark)}, projected course grade ${shown(projection)}`}
                  onChange={(event) => setScenarioMark(Number(event.target.value))}
                />
                <div className={styles.projection}>
                  <span>Projected course grade</span>
                  <strong data-grade-projection>
                    {shown(projection)} · {letterFor(projection).letter}
                  </strong>
                </div>
              </div>
            ) : null}
            {requirements.length ? (
              // PCS211: passing also needs 50% in THEORY and in LABORATORY.
              <ul className={styles.requirements} aria-label="Other pass requirements">
                {requirements.map((row) => (
                  <li key={row.id} data-state={row.status}>
                    <span className={styles.requirementTitle}>
                      {row.title} · at least {row.min}%
                    </span>
                    <span className={styles.requirementValue}>{row.average === null ? '—' : shown(row.average)}</span>
                    <span className={workspace.meta}>{REQUIREMENT[row.status]}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
          <section className={styles.targets} aria-labelledby={`${baseId}-targets`}>
            <h3 id={`${baseId}-targets`}>What do I need?</h3>
            {standing.complete ? (
              <p className={styles.answer}>All marks are in.</p>
            ) : (
              <>
                <label htmlFor={`${baseId}-target`} className={workspace.meta}>
                  Target grade
                  <select
                    id={`${baseId}-target`}
                    className={styles.targetSelect}
                    data-grade-target
                    value={target?.min ?? ''}
                    disabled={!grades.ready}
                    onChange={(event) => update({ target: event.target.value ? Number(event.target.value) : null })}
                  >
                    <option value="">Choose a grade</option>
                    {TARGETS.map((row) => (
                      <option key={row.min} value={row.min}>
                        {row.letter} · {row.min}%
                      </option>
                    ))}
                  </select>
                </label>
                {target ? (
                  <p className={styles.answer} data-grade-answer>
                    {answer}
                  </p>
                ) : null}
              </>
            )}
          </section>
        </div>
        <div className={styles.markColumn}>
          {plan.variants ? (
            <section className={styles.variants} aria-labelledby={`${baseId}-variants`}>
              <h3 id={`${baseId}-variants`}>{plan.pick === 'choose' ? 'Your grading scheme' : 'Evaluation option'}</h3>
              {plan.pick === 'choose' ? (
                <div className={styles.variantGrid} role="group" aria-label="Grading scheme">
                  {plan.variants.map((variant) => (
                    <button
                      key={variant.id}
                      type="button"
                      className={styles.variant}
                      aria-pressed={plan.variant === variant.id}
                      disabled={!grades.ready}
                      onClick={() => update({ variant: variant.id })}
                    >
                      <span className={styles.variantTitle}>{variant.title}</span>
                      <span className={styles.variantNote}>{variant.note}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className={styles.variantApplied} data-grade-option>
                  {optionSentence(plan, standing)}
                </p>
              )}
              {plan.notes[0] ? <p className={workspace.meta}>{plan.notes[0]}</p> : null}
            </section>
          ) : null}
          <GradeEntries key={plan.pick === 'choose' ? plan.variant : courseId} plan={plan} standing={standing} grades={grades} update={update} onClear={clear} firstGroup={firstGroup} />
        </div>
        <div className={styles.notes}>
          {plan.quizPolicy ? <p>{plan.quizPolicy}</p> : null}
          <p>
            Letters follow TMU’s undergraduate grading scale (Senate Policy 170(a)). Your final percentage is rounded to a whole number before it becomes a letter, so 79.5% counts as 80%, an A-. A D-
            ({plan.pass}%) is the university’s minimum pass; some programs, including engineering, require more in particular courses.
          </p>
          <p>This is an estimate from the weights in this guide. Your course outline and the grades your instructors post are what count.</p>
          {courseId === 'cen100' ? <p>Rows with two submissions take one combined mark for both. Weights: CEN100 Course Outline F26, p. 9.</p> : null}
          {plan.notes?.slice(1).map((note) => (
            <p key={note}>{note}</p>
          ))}
          {requirements.length ? (
            <p>THEORY and LABORATORY are shown from the marks entered so far: {requirements.map((row) => `${row.title} = ${row.note}`).join('; ')}. Weights: PCS 211 Course Outline, p. 4.</p>
          ) : null}
          {courseId === 'chy102' ? <p>Weights: CHY 102 Course Outline, pp. 8–9.</p> : null}
          <p>Marks stay in this browser only and are not part of progress backups.</p>
        </div>
      </div>
    </div>
  );
}
