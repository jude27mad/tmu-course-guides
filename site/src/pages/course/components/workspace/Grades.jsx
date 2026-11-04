import { useEffect, useId, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import gsap from 'gsap';
import { GRADE_SCALE, describeMark, floorTenth, formatPercent, gradeIfAverage, gradeNeeded, gradePlan, gradeStanding, letterFor, percentsFrom, roundGrade, scoreFor, suggestOutOf } from '@src/lib';
import { useGrades } from '@src/lib/react';
import useStill from '@src/hooks/useStill';
import { useStore } from '@src/store';
// eslint-disable-next-line import/extensions
import { bindModal } from '@src/pages/course/components/tools/dialog.mjs';
import { useCourse } from '@src/pages/course/hooks/useCourseState';
import MarkSheet from './MarkSheet';
import MarkSlider from './MarkSlider';
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
  if (current === null) return 'Tap an assessment below to add your first mark.';
  if (standing.complete) return 'Every mark is in. This is your calculated final grade.';
  const projected = floorTenth(standing.projected);
  if (projected - current < 0.1) return `Keep this average on the remaining ${weight(standing.remaining)} of the course and it becomes your final grade.`;
  // A low quiz that counts now is dropped once a better one arrives.
  return `Keep averaging ${formatPercent(current)} on what’s left and you finish with ${formatPercent(projected)} (${letterFor(projected).letter}), because your lowest quiz is dropped.`;
}

function Meter({ standing, target, planned }) {
  const secured = Math.min(100, standing.secured);
  const maximum = Math.min(100, standing.maximum);
  const plan = planned === null || planned === undefined ? null : Math.min(100, planned);
  const label = [
    `Secured ${shown(secured)} of the course.`,
    `Up to ${shown(maximum)} still possible.`,
    target ? `Target ${target.letter}, ${target.min}%.` : '',
    plan !== null ? `Plan: final ${shown(plan)}, ${letterFor(floorTenth(plan)).letter}.` : '',
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
          {plan !== null ? <span className={styles.planned} style={{ left: `${secured}%`, width: `${Math.max(0, plan - secured)}%` }} /> : null}
        </div>
        <span className={styles.pass} style={{ left: '50%' }} />
        {target ? <span className={styles.target} style={{ left: `${target.min}%` }} data-label={`${target.letter} ${target.min}%`} data-edge={target.min >= 85 ? 'end' : undefined} /> : null}
        {plan !== null ? <span className={styles.planPin} style={{ left: `${plan}%` }} /> : null}
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
        {plan !== null ? <li data-kind="planned">Plan</li> : null}
      </ul>
    </div>
  );
}

export default function Grades() {
  const { courseId, course, section } = useCourse();
  const [grades, update] = useGrades(courseId);
  const still = useStill();
  const baseId = useId();
  const [announcement, setAnnouncement] = useState('');
  const [editing, setEditing] = useState(null);
  const [lastSaved, setLastSaved] = useState(null);
  // The row the sheet closed on: the Undo banner sits under it, where focus and the student's eyes are.
  const [bannerAnchor, setBannerAnchor] = useState(null);
  const editingRef = useRef(null);
  editingRef.current = editing;
  const [planX, setPlanX] = useState(null);
  const cleared = useRef(false);
  const sheetRef = useRef(null);
  const modalRef = useRef(null);
  const openerRef = useRef(null);
  const viaNext = useRef(false);
  const carried = useRef('');
  const planStart = useRef(undefined);
  const planRef = useRef(null);
  const session = useRef({});
  const marksRef = useRef(grades.marks);
  marksRef.current = grades.marks;
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
  const securedLetter = letterFor(floorTenth(standing.secured));
  const summary = current === null ? 'No marks entered.' : `Current average ${formatPercent(current)}, ${letter.letter}.`;
  const editingItem = plan.items.find((item) => item.id === editing) || null;
  const nextItem = editingItem ? plan.items[plan.items.indexOf(editingItem) + 1] || null : null;
  // The plan shows only while its slider does (there is an average to plan from and marks still to come).
  const planned = planX === null || current === null || standing.complete ? null : gradeIfAverage(plan, percents, planX);
  // In the sheet, the target's need treats the item being edited as unmarked, so its flag and marker stay put
  // while different marks are tried.
  const sheetNeed = useMemo(() => {
    if (!target || !editing) return null;
    const others = Object.fromEntries(Object.entries(grades.marks).filter(([id]) => id !== editing));
    return gradeNeeded(plan, percentsFrom(others), target.min);
  }, [target, editing, grades.marks, plan]);
  const detailsFor = (item, group) =>
    [group.drop ? `${weight(item.weight)} if kept` : weight(item.weight), item.dateLabel, item.parts > 1 ? `${item.parts} submissions, one combined mark` : ''].filter(Boolean).join(' · ');

  // One polite announcement once changes pause, instead of every intermediate value (none on opening).
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

  // The mark sheet: the shared modal (Guide tools' focus, scroll lock, Escape and backdrop handling).
  useEffect(() => {
    const dialog = sheetRef.current;
    let tween;
    const modal = bindModal(dialog, {
      closeSelector: '[data-close-sheet]',
      getLenis: () => useStore.getState().lenis,
      // Touch: focus the title, so no keyboard springs up. Mouse and keyboard: the score field, ready to type.
      initialFocus: (node) => {
        const field = window.matchMedia?.('(pointer: fine)').matches ? node.querySelector('[data-grade-score]') : null;
        field?.select();
        return field || node.querySelector('[data-sheet-title]');
      },
      animate: (opening, complete) => {
        if (useStore.getState().still) {
          gsap.set(dialog, { clearProps: 'transform,opacity' });
          complete();
          return undefined;
        }
        if (opening) gsap.set(dialog, { y: 24, opacity: 0 });
        tween = gsap.to(dialog, {
          y: opening ? 0 : 16,
          opacity: opening ? 1 : 0,
          duration: opening ? 0.3 : 0.16,
          ease: 'power2.out',
          onComplete: () => {
            complete();
            gsap.set(dialog, { clearProps: 'transform,opacity' });
          },
        });
        return () => tween?.kill();
      },
    });
    modalRef.current = modal;
    const onClose = () => {
      // What this visit to the sheet changed and still holds (another tab may have changed a mark since), for Undo.
      const changes = Object.entries(session.current)
        .filter(([id, { before, after }]) => before !== after && (marksRef.current[id] || '') === after)
        .map(([id, { before, after }]) => ({ id, before, after }));
      session.current = {};
      setLastSaved(changes.length ? changes : null);
      setBannerAnchor(editingRef.current);
      setEditing(null);
      // Focus is back on the row last shown; bring it into view if the visit ended far down the list.
      requestAnimationFrame(() => {
        const row = document.activeElement?.closest?.('[data-grade-row]');
        if (!row) return;
        const box = row.getBoundingClientRect();
        if (box.top < 0 || box.bottom > window.innerHeight) row.scrollIntoView({ block: 'center' });
      });
    };
    dialog?.addEventListener('close', onClose);
    return () => {
      dialog?.removeEventListener('close', onClose);
      modal.unbind();
      modalRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (editing && sheetRef.current && !sheetRef.current.open) modalRef.current?.open(openerRef.current);
  }, [editing]);

  // Undo only offers marks that still hold what this visit saved (another tab may have changed them since).
  useEffect(() => {
    setLastSaved((saved) => {
      if (!saved) return saved;
      const holding = saved.filter(({ id, after }) => (grades.marks[id] || '') === after);
      if (holding.length === saved.length) return saved;
      return holding.length ? holding : null;
    });
  }, [grades.marks]);

  const openSheet = (id, opener) => {
    openerRef.current = opener;
    viaNext.current = false;
    carried.current = '';
    session.current = {};
    setLastSaved(null);
    setEditing(id);
  };
  const setMark = (id, text) => {
    session.current[id] = { before: session.current[id]?.before ?? (marksRef.current[id] || ''), after: text };
    const marks = { ...marksRef.current };
    if (text) marks[id] = text;
    else delete marks[id];
    marksRef.current = marks;
    update({ marks });
  };
  // From a typed field, Next keeps the keyboard up on the next item's field; from a tap, it focuses the title.
  const goNext = ({ fromField = false, spoken = '' } = {}) => {
    if (!nextItem) return;
    viaNext.current = fromField ? 'field' : 'heading';
    carried.current = spoken;
    modalRef.current?.setOpener(document.querySelector(`[data-grade-row="${nextItem.id}"]`));
    setEditing(nextItem.id);
  };
  const undoLast = () => {
    if (!lastSaved) return;
    const marks = { ...marksRef.current };
    lastSaved.forEach(({ id, before }) => {
      if (before) marks[id] = before;
      else delete marks[id];
    });
    marksRef.current = marks;
    update({ marks });
    const [first] = lastSaved;
    const back = first.before ? describeMark(first.before).short || first.before : 'not marked';
    setAnnouncement(lastSaved.length === 1 ? `Undone. ${plan.items.find((item) => item.id === first.id)?.title} is back to ${back}.` : 'Undone.');
    setLastSaved(null);
    document.querySelector(`[data-grade-row="${first.id}"]`)?.focus();
  };
  const dismissBanner = () => {
    const id = lastSaved?.[0]?.id;
    setLastSaved(null);
    document.querySelector(`[data-grade-row="${id}"]`)?.focus();
  };
  const clear = () => {
    // eslint-disable-next-line no-alert
    if (!window.confirm(`Clear every mark you entered for ${course.code}? Your target grade is cleared too.`)) return;
    cleared.current = true;
    setLastSaved(null);
    setPlanX(null);
    update({ marks: {}, target: null });
    document.querySelector('[data-grade-row]')?.focus();
  };

  let bannerText = '';
  if (lastSaved?.length === 1) {
    const { id, after } = lastSaved[0];
    const title = plan.items.find((item) => item.id === id)?.title;
    if (!after) bannerText = `${title} cleared.`;
    else if (describeMark(after).error) bannerText = `${title}: check this mark (${after}).`;
    else if (describeMark(after).percent === null) bannerText = `${title}: out of ${describeMark(after).outOf}, no score yet.`;
    else bannerText = `${title} saved as ${describeMark(after).short || after}.`;
  } else if (lastSaved) bannerText = `${lastSaved.length} marks changed.`;

  // Plan the rest: each reachable letter's needed average as a tick. The chosen target is always labelled, and
  // a neighbour too close to it gives up its label.
  const reachable = needs
    .filter(({ need }) => need.status === 'reachable')
    .map(({ row, need }) => ({ row, value: need.average }))
    .sort((a, b) => a.value - b.value);
  const strongValue = reachable.find(({ row }) => row === target)?.value;
  let lastLabelled = -Infinity;
  const planTicks = reachable.map(({ row, value }) => {
    const strong = row === target;
    const nearStrong = !strong && strongValue !== undefined && Math.abs(value - strongValue) < 9;
    const label = strong || (!nearStrong && value - lastLabelled >= 9) ? row.letter : null;
    if (label) lastLabelled = value;
    return { key: row.letter, value, label, strong };
  });
  // Until the slider is moved, the plan is the headline's own: the exact current average and its projection.
  const planValue = planX ?? (current === null ? 75 : Math.round(current));
  const planResult = planX === null && standing.projected !== null ? standing.projected : gradeIfAverage(plan, percents, planValue);
  const planShown = planX === null && current !== null ? formatPercent(current) : `${planValue}%`;
  useEffect(() => {
    if (!lastSaved) return undefined;
    const title = plan.items.find((item) => item.id === bannerAnchor)?.title;
    const timer = setTimeout(() => setAnnouncement(`${bannerText} Undo is under ${title}.`), 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastSaved, bannerAnchor]);
  const banner = lastSaved ? (
    <div className={styles.undoBanner}>
      <span>{bannerText}</span>
      <button type="button" onClick={undoLast}>
        Undo
      </button>
      <button type="button" className={styles.dismiss} aria-label="Dismiss" onClick={dismissBanner}>
        <span aria-hidden="true">×</span>
      </button>
    </div>
  ) : null;

  return (
    <div className={styles.root} data-grades data-still={still || undefined}>
      <div className={workspace.viewHeading}>
        <h2>Grade calculator</h2>
        <p className={styles.saved} data-blocked={grades.saved ? undefined : true} role={grades.saved ? undefined : 'status'}>
          {grades.saved ? 'Saved in this browser' : 'Saving is blocked in this browser, so marks will be lost when you leave.'}
        </p>
      </div>
      <p className={styles.lede}>
        Tap an assessment to add its mark: pick the score, slide, or type it. The weights match{' '}
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
          {lastSaved && !plan.items.some((item) => item.id === bannerAnchor) ? banner : null}
          {/* While the full summary is out of view (phones, short screens), the essentials stay above the marks,
              and a tap goes to the summary and Plan the rest. */}
          <button
            type="button"
            className={styles.quick}
            data-grade-quick
            aria-label={`${current === null ? 'No marks yet' : `Current average ${formatPercent(current)}, ${letter.letter}`}. Go to the summary and Plan the rest.`}
            onClick={() => {
              const card = document.querySelector('[data-grade-summary]');
              card?.scrollIntoView({ block: 'start' });
              card?.focus({ preventScroll: true });
            }}
          >
            <span className={styles.quickValue}>
              {current === null ? '—' : formatPercent(current)}
              {letter ? <strong>{letter.letter}</strong> : null}
            </span>
            <span className={styles.quickNote}>
              {chosen && !standing.complete && chosen.need.status === 'reachable' ? `${chosen.row.letter} needs ${formatPercent(chosen.need.average)}` : `Best possible ${shown(standing.maximum)}`}
              <span aria-hidden="true"> · Plan ›</span>
            </span>
          </button>
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
                    const text = grades.marks[item.id] || '';
                    const mark = describeMark(text);
                    const dropped = standing.dropped.includes(item.id);
                    const marked = mark.percent !== null;
                    const need = chosen && !marked && !standing.complete ? chosen.need : null;
                    const total = mark.outOf || suggestOutOf(plan, grades.marks, item.id);
                    let needLabel = '';
                    if (need?.status === 'reachable') {
                      const score = scoreFor(need.average, total);
                      needLabel = `${chosen.row.letter} needs ${formatPercent(need.average)}${score !== null ? ` (${score}/${total})` : ''}`;
                    } else if (need?.status === 'secured') needLabel = `${chosen.row.letter}: any mark`;
                    else if (need?.status === 'unreachable') needLabel = `${chosen.row.letter} out of reach`;
                    const detailsId = `${baseId}-${item.id.replace(/[^a-z0-9-]/gi, '-')}-details`;
                    const needId = `${detailsId}-need`;
                    let { spoken } = mark;
                    if (dropped && marked) spoken = `${mark.spoken}, dropped`;
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          className={styles.rowButton}
                          aria-haspopup="dialog"
                          aria-label={`${item.title}: ${spoken}`}
                          aria-describedby={needLabel ? `${detailsId} ${needId}` : detailsId}
                          data-grade-row={item.id}
                          data-dropped={dropped || undefined}
                          data-has-need={needLabel ? true : undefined}
                          disabled={!grades.ready}
                          onClick={(event) => openSheet(item.id, event.currentTarget)}
                        >
                          <span className={styles.rowText}>
                            <span className={styles.rowTitle}>{item.title}</span>
                            <span id={detailsId} className={workspace.meta}>
                              {detailsFor(item, group)}
                            </span>
                          </span>
                          <span className={styles.rowValue}>
                            {mark.error ? <span className={styles.checkPill}>Check this mark</span> : null}
                            {!mark.error && marked ? (
                              <>
                                <strong>{mark.short}</strong>
                                <span className={styles.letterPill}>{dropped ? 'Dropped' : mark.letter}</span>
                              </>
                            ) : null}
                            {!mark.error && !marked ? (
                              <>
                                {mark.short ? <strong className={styles.totalOnly}>{mark.short}</strong> : null}
                                <span className={styles.addPill}>+ Add</span>
                              </>
                            ) : null}
                          </span>
                          <span
                            className={styles.rowBar}
                            aria-hidden="true"
                            style={{ '--pct': `${marked ? Math.min(100, mark.percent) : 0}%`, '--need': need?.status === 'reachable' ? `${need.average}%` : undefined }}
                            data-empty={!marked || undefined}
                            data-invalid={mark.error ? true : undefined}
                            data-need={need?.status === 'reachable' || undefined}
                          />
                          {needLabel ? (
                            <span id={needId} className={styles.needLabel}>
                              {needLabel}
                            </span>
                          ) : null}
                        </button>
                        {bannerAnchor === item.id ? banner : null}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </section>
        <div className={styles.side}>
          <section className={styles.standing} aria-labelledby={`${baseId}-standing`} tabIndex={-1} data-grade-summary>
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
            <Meter standing={standing} target={target} planned={planned} />
            {!standing.complete && current !== null ? (
              <div className={styles.plan} data-grade-plan>
                <p id={`${baseId}-plan-label`} className={styles.planLabel}>
                  Plan the rest: if I average <strong>{planShown}</strong> on everything still to be marked
                </p>
                <MarkSlider
                  ref={planRef}
                  id={`${baseId}-plan`}
                  min={0}
                  max={100}
                  value={planValue}
                  ticks={planTicks}
                  labelledBy={`${baseId}-plan-label`}
                  describedBy={`${baseId}-plan-note`}
                  disabled={!grades.ready}
                  compact
                  valueText={(v) => {
                    const final = floorTenth(gradeIfAverage(plan, percents, v));
                    return `${v} percent on the rest gives a final ${final} percent, ${letterFor(final).letter}`;
                  }}
                  onDraft={(v) => {
                    if (planStart.current === undefined) planStart.current = planX;
                    setPlanX(v);
                  }}
                  onCommit={(v) => {
                    planStart.current = undefined;
                    setPlanX(v);
                  }}
                  // A scroll that started on the slider puts the plan back where it was.
                  onCancel={() => {
                    setPlanX(planStart.current ?? null);
                    planStart.current = undefined;
                  }}
                />
                <p className={styles.planResult} data-grade-plan-result>
                  Final <strong>{shown(planResult)}</strong> · {letterFor(floorTenth(planResult)).letter}
                </p>
                <p id={`${baseId}-plan-note`} className={workspace.meta}>
                  Planning only. Your marks don’t change.{' '}
                  {planX !== null ? (
                    <button
                      type="button"
                      className={styles.linkButton}
                      onClick={() => {
                        setPlanX(null);
                        planRef.current?.focus();
                      }}
                    >
                      Reset
                    </button>
                  ) : null}
                </p>
              </div>
            ) : null}
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
                        onClick={() => {
                          update({ target: target === row ? null : row.min });
                          // Show the path to the chosen letter on the plan, too.
                          if (target !== row && need.status === 'reachable') setPlanX(Math.min(100, Math.ceil(need.average)));
                        }}
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
      <MarkSheet
        ref={sheetRef}
        item={editingItem}
        nextItem={nextItem}
        plan={plan}
        marks={grades.marks}
        standing={standing}
        need={sheetNeed}
        target={target}
        ready={grades.ready}
        details={
          editingItem
            ? detailsFor(
                editingItem,
                plan.groups.find((group) => group.id === editingItem.groupId),
              )
            : ''
        }
        focusOnMount={viaNext.current}
        carried={carried.current}
        onCommit={setMark}
        onNext={goNext}
        onDone={() => modalRef.current?.close()}
      />
    </div>
  );
}
