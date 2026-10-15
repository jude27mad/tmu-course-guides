import { useCallback, useEffect, useState } from 'react';

import AppearTitle from '@src/components/animationComponents/appearTitle/Index';
import Arrow from '@src/components/imageComponents/Arrow';
import CheckRow from '@src/pages/course/components/CheckRow';
import PlanFields from '@src/pages/course/components/cards/PlanFields';
import clsx from 'clsx';
import { flushSync } from 'react-dom';
import overview from '@src/pages/course/components/overview/styles/overview.module.scss';
import styles from '@src/pages/course/components/cards/styles/cards.module.scss';
import { useCourse } from '@src/pages/course/hooks/useCourseState';

// The old guides' cards (CEN100 assignments, MTH140/141 assessments and
// topics) as rows of the original Overview line list. Each row keeps the old deep
// link id (#assignment-m2, #assessment-midterm, #topic-limits) and opens in
// place like a Services option; the details hold the full checklist, the
// completion records and the private notes.

// "SEP 23" from an ISO date (the old cards' date tile), without a clock.
const tileDate = (iso) => {
  if (!iso) return '';
  const date = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.toLocaleDateString('en-CA', { month: 'short', timeZone: 'UTC' }).replace('.', '')} ${date.getUTCDate()}`.toUpperCase();
};

function useOpenRows(anchors) {
  const [open, setOpen] = useState(() => new Set());
  const toggle = useCallback((anchor) => {
    setOpen((previous) => {
      const next = new Set(previous);
      if (next.has(anchor)) next.delete(anchor);
      else next.add(anchor);
      return next;
    });
  }, []);

  // A deep link (search, a "View requirements" pill, the address bar) opens its card first.
  useEffect(() => {
    const onHash = (event) => {
      const id = event.detail?.id;
      if (!id || !anchors.includes(id)) return;
      flushSync(() => setOpen((previous) => (previous.has(id) ? previous : new Set(previous).add(id))));
    };
    document.addEventListener('guide-hash', onHash);
    return () => document.removeEventListener('guide-hash', onHash);
  }, [anchors]);

  return [open, toggle];
}

function Lines({ items, className = 'p-l' }) {
  if (!items?.length) return null;
  return (
    <ul className={styles.lines}>
      {items.map((line) => (
        <li key={line} className={clsx(className, styles.line)}>
          <Arrow className={styles.bullet} />
          <span>{line}</span>
        </li>
      ))}
    </ul>
  );
}

function CenBody({ item }) {
  const { courseId, progress, copy } = useCourse();
  const records = item.records || [];
  const doneCount = records.filter((record) => progress.isDone(courseId, record.id)).length;
  return (
    <>
      <p className="p-l">{item.what}</p>
      <Lines items={(item.facts || []).map((fact) => fact.text)} />
      {item.groups?.length ? (
        <div className={styles.block}>
          <h4 className={clsx('p-x', styles.heading)}>{copy.fullMarks}</h4>
          {item.groups.map((group) => (
            <div key={group.checks[0]?.id || group.heading} className={styles.group}>
              {group.heading ? <h5 className={clsx('p-l', styles.groupHeading)}>{group.heading}</h5> : null}
              <ul className={styles.checks}>
                {group.checks.map((check) => (
                  <CheckRow
                    key={check.id}
                    checked={progress.isTicked(courseId, item.id, check.id)}
                    disabled={!progress.ready}
                    onChange={(value) => progress.toggleTick(courseId, item.id, check.id, value)}
                  >
                    {check.text}
                  </CheckRow>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : null}
      {item.traps?.length ? (
        <div className={styles.block}>
          <h4 className={clsx('p-x', styles.heading)}>{copy.loseMarks}</h4>
          <Lines items={item.traps} />
        </div>
      ) : null}
      {item.source ? (
        <div className={styles.block}>
          <h4 className={clsx('p-x', styles.heading)}>{item.source.summary}</h4>
          <p className={clsx('p-x', styles.muted)}>{item.source.note}</p>
        </div>
      ) : null}
      {records.length ? (
        <div className={styles.block}>
          <h4 className={clsx('p-x', styles.heading)}>{copy.personalSummary}</h4>
          <fieldset className={styles.fieldset}>
            <legend className={clsx('p-l', styles.legend)}>{copy.personalLegend}</legend>
            <ul className={styles.checks}>
              {records.map((record) => (
                <CheckRow key={record.id} checked={progress.isDone(courseId, record.id)} disabled={!progress.ready} onChange={(value) => progress.setDone(courseId, record.id, value)}>
                  {record.text}
                </CheckRow>
              ))}
            </ul>
          </fieldset>
          <p className={clsx('p-x', styles.muted)}>{progress.ready ? copy.completionCount(doneCount, records.length) : ''}</p>
          <p className={clsx('p-x', styles.muted)}>{copy.personalHint}</p>
          <PlanFields itemId={item.id} notesLabel={copy.notesLabel} targetLabel={copy.targetLabel} notes={[copy.notesInfo]} />
        </div>
      ) : null}
    </>
  );
}

function AssessmentBody({ item }) {
  const { courseId, progress } = useCourse();
  return (
    <>
      <p className="p-l">{item.timing}</p>
      <dl className={styles.facts}>
        {item.room ? (
          <div>
            <dt className="p-x">{item.roomLabel}</dt>
            <dd className="p-l">{item.room}</dd>
          </div>
        ) : null}
        {item.category ? (
          <div>
            <dt className="p-x">{item.categoryLabel}</dt>
            <dd className="p-l">{item.category}</dd>
          </div>
        ) : null}
      </dl>
      {item.dateNote ? <p className={clsx('p-x', styles.muted)}>{item.dateNote}</p> : null}
      <div className={styles.block}>
        <h4 className={clsx('p-x', styles.heading)}>{item.coversHeading}</h4>
        <p className="p-l">{item.scope}</p>
        {item.unconfirmed ? <p className={clsx('p-x', styles.muted)}>{item.unconfirmed}</p> : null}
      </div>
      {item.rules?.length ? (
        <div className={styles.block}>
          <h4 className={clsx('p-x', styles.heading)}>{item.rulesHeading}</h4>
          <Lines items={item.rules} />
          {item.roomNote ? <p className={clsx('p-x', styles.muted)}>{item.roomNote}</p> : null}
        </div>
      ) : null}
      <div className={styles.block}>
        <h4 className={clsx('p-x', styles.heading)}>{item.checklistHeading}</h4>
        <ul className={styles.checks}>
          {item.checklist.map((check) => (
            <CheckRow key={check.id} checked={progress.isTicked(courseId, item.id, check.id)} disabled={!progress.ready} onChange={(value) => progress.toggleTick(courseId, item.id, check.id, value)}>
              {check.text}
            </CheckRow>
          ))}
        </ul>
      </div>
      <p className={clsx('p-x', styles.muted)}>{`${item.sourceLabel} ${item.source}`}</p>
      <div className={styles.block}>
        <h4 className={clsx('p-x', styles.heading)}>{item.personalSummary}</h4>
        <ul className={styles.checks}>
          <CheckRow checked={progress.isDone(courseId, item.id)} disabled={!progress.ready} onChange={(value) => progress.setDone(courseId, item.id, value)}>
            {item.completedLabel}
          </CheckRow>
        </ul>
        <p className={clsx('p-x', styles.muted)}>{item.completedNote}</p>
        <PlanFields itemId={item.id} notesLabel={item.notesLabel} targetLabel={item.targetLabel} notes={[item.targetNote]} />
      </div>
    </>
  );
}

function TopicBody({ item, review }) {
  const { courseId, progress } = useCourse();
  return (
    <>
      <p className="p-l">{item.description}</p>
      {item.midterm ? <p className={clsx('p-x', styles.pill)}>{item.midterm}</p> : null}
      <div className={styles.block}>
        <h4 className={clsx('p-x', styles.heading)}>{item.skillsHeading}</h4>
        <ul className={styles.checks}>
          {item.skills.map((skill) => (
            <CheckRow key={skill.id} checked={progress.isTicked(courseId, item.id, skill.id)} disabled={!progress.ready} onChange={(value) => progress.toggleTick(courseId, item.id, skill.id, value)}>
              {skill.text}
            </CheckRow>
          ))}
        </ul>
        {review?.note ? <p className={clsx('p-x', styles.muted)}>{review.note}</p> : null}
      </div>
      <div className={styles.block}>
        <h4 className={clsx('p-x', styles.heading)}>{item.practiceHeading}</h4>
        <p className={clsx('p-x', styles.muted)}>{item.practiceNote}</p>
        <dl className={styles.practice}>
          {item.practice.map((entry) => (
            <div key={entry.section}>
              <dt className="p-l">{entry.section}</dt>
              {entry.rows.map((row) => (
                <dd key={`${row.label}${row.text}`} className="p-l">
                  {row.label ? <span className={styles.practiceLabel}>{row.label} </span> : null}
                  {row.text}
                </dd>
              ))}
            </div>
          ))}
        </dl>
      </div>
      <p className={clsx('p-x', styles.muted)}>{item.source}</p>
    </>
  );
}

function Card({ item, kind, open, onToggle, meta, review }) {
  const bodyId = `${item.anchor}-details`;
  const title = kind === 'cen' ? item.name : item.title;
  return (
    <li id={item.anchor} className={clsx(styles.card, open && styles.cardOpen)}>
      <button type="button" className={styles.cardHead} aria-expanded={open} aria-controls={bodyId} onClick={() => onToggle(item.anchor)}>
        <span className={clsx('p-x', styles.cardIndex)}>{meta.lead}</span>
        <span className={styles.cardTitleWrap}>
          <span className={clsx('h6', styles.cardTitle)}>{title}</span>
          {meta.preview ? <span className={clsx('p-l', styles.cardPreview)}>{meta.preview}</span> : null}
          <span className={clsx('p-x', styles.cardMeta)}>{meta.line}</span>
        </span>
        <Arrow className={clsx(styles.cardArrow, open && styles.cardArrowOpen)} />
      </button>
      <div id={bodyId} className={styles.cardBody} hidden={!open}>
        {open ? (
          <>
            {kind === 'cen' ? <CenBody item={item} /> : null}
            {kind === 'assessment' ? <AssessmentBody item={item} /> : null}
            {kind === 'topic' ? <TopicBody item={item} review={review} /> : null}
          </>
        ) : null}
      </div>
    </li>
  );
}

function CardBlock({ id, label, lead, items, kind, metaFor, review, footer }) {
  const anchors = items.map((item) => item.anchor);
  const [open, toggle] = useOpenRows(anchors);

  return (
    <section id={id} className={clsx(overview.root, styles.root, 'layout-grid-inner')}>
      <div className={overview.title}>
        <AppearTitle key={`${id}-lead`}>
          <h2 className="h3">{lead}</h2>
        </AppearTitle>
      </div>
      <div className={clsx(overview.text, 'p-l', overview.myStory)}>
        <AppearTitle key={`${id}-label`}>
          <span>{label}</span>
        </AppearTitle>
      </div>
      <div className={overview.desc}>
        {footer}
        <ul className={styles.cards}>
          {items.map((item) => (
            <Card key={item.anchor} item={item} kind={kind} open={open.has(item.anchor)} onToggle={toggle} meta={metaFor(item)} review={review} />
          ))}
        </ul>
      </div>
    </section>
  );
}

function ItemCards() {
  const { courseId, info, live, progress, copy } = useCourse();

  if (courseId === 'cen100') {
    const metaFor = (item) => {
      const rows = live ? live.items.filter((row) => row.item === item.id && row.markable) : [];
      const dates = [...new Set(rows.map((row) => row.dateLabel).filter(Boolean))];
      const tile = item.tile ? [item.tile.top, item.tile.bottom].filter(Boolean).join(' ') : '';
      const ticks = progress.ready ? progress.tickCount(courseId, item.id) : null;
      const records = item.records || [];
      const doneRecords = progress.ready ? records.filter((record) => progress.isDone(courseId, record.id)) : [];
      const done = doneRecords.length;
      // the old completion badge: "1 of 2 recorded", then "Submitted" / "Emailed" / "Completed"
      const verbs = new Set(doneRecords.map((record) => String(record.text).split(':')[0]));
      let badge = '';
      if (done && done < records.length) badge = `${done} of ${records.length} recorded`;
      else if (done) badge = verbs.size === 1 ? [...verbs][0] : 'Completed';
      return {
        lead: tile || tileDate(item.date),
        preview: item.preview,
        line: [dates.join(' · ') || tile, item.who, item.weightLabel, ticks?.total ? `${ticks.checked}/${ticks.total}` : '', badge].filter(Boolean).join(' · '),
      };
    };
    const lists = (info.page?.tabs || []).filter((tab) => tab.id === 'team' || tab.id === 'you');
    return (
      <>
        {lists.map((tab) => (
          <CardBlock key={tab.id} id={`p-${tab.id}`} label={tab.label} lead={info.leads?.[tab.id]} items={info.items.filter((item) => item.list === tab.id)} kind="cen" metaFor={metaFor} />
        ))}
      </>
    );
  }

  const assessmentMeta = (item) => {
    const counts = progress.ready ? progress.tickCount(courseId, item.id) : null;
    const done = progress.ready && progress.isDone(courseId, item.id);
    const tile = item.tile && !item.tile.unknown ? [item.tile.top, item.tile.main].filter(Boolean).join(' ') : '';
    const row = live ? live.items.find((entry) => entry.id === item.id) : null;
    return {
      lead: tile || row?.dateLabel || '—',
      preview: item.scope,
      line: [item.weightLabel, counts ? copy.counts.prepared(counts.checked, counts.total) : '', done ? 'Completed in my records' : ''].filter(Boolean).join(' · '),
    };
  };
  const topicMeta = (item) => {
    const counts = progress.ready ? progress.tickCount(courseId, item.id) : null;
    return {
      lead: item.index,
      preview: item.sub,
      line: [item.midterm, counts ? copy.counts.topic(counts.checked, counts.total) : ''].filter(Boolean).join(' · '),
    };
  };
  const tabs = Object.fromEntries((info.page?.tabs || []).map((tab) => [tab.id, tab.label]));
  const reviewTotals = progress.ready ? info.topics.reduce((sum, topic) => sum + progress.tickCount(courseId, topic.id).checked, 0) : null;
  const reviewTotal = info.topics.reduce((sum, topic) => sum + topic.skills.length, 0);

  return (
    <>
      <CardBlock id="panel-assessments" label={tabs.assessments} lead={info.page?.assessmentsIntro} items={info.assessments} kind="assessment" metaFor={assessmentMeta} />
      <CardBlock
        id="study"
        label={tabs.topics}
        lead={info.review?.label || info.page?.review?.label}
        items={info.topics}
        kind="topic"
        metaFor={topicMeta}
        review={info.review || info.page?.review}
        footer={reviewTotals != null ? <p className={clsx('p-l', styles.reviewCount)}>{copy.counts.review(reviewTotals, reviewTotal)}</p> : null}
      />
    </>
  );
}

export default ItemCards;
