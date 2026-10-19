import { countdown } from '@src/lib';
import { dateBadge, preparationSummary, selectWindowItem } from './window-model.mjs';
import styles from './windows.module.scss';

// Display panels mirror the accessible rows. No controls can be trapped in translated windows.
export function DeadlineWindow({ group, index, selectedId, now }) {
  const item = selectWindowItem(group.items, selectedId);
  const badge = dateBadge(item);
  const time = item && now ? countdown(item, now) : null;
  return (
    <div className={styles.panel} data-window-kind="deadline" data-selected-assessment={item?.id || ''} aria-hidden="true">
      <div className={styles.eyebrow}>
        <span>{group.title}</span>
        <span>{String(index + 1).padStart(2, '0')} / 03</span>
      </div>
      {item ? (
        <>
          <div className={styles.dateFace}>
            <span className={styles.day}>{badge.large}</span>
            <span className={styles.month}>{badge.small}</span>
          </div>
          <div className={styles.subject}>
            <p className={styles.title}>{item.title}</p>
            <p className={styles.when}>{item.when || item.dateLabel}</p>
          </div>
          <div className={styles.footer}>
            <span className={styles.status}>{time?.status || time?.label || item.label}</span>
            <span className={styles.weight}>{item.weightLabel}</span>
          </div>
        </>
      ) : (
        <div className={styles.empty}>
          <span className={styles.emptyMark}>—</span>
          <p className={styles.title}>{now ? 'Nothing scheduled' : 'Your course, your section'}</p>
          <p className={styles.when}>{now ? 'Explore the next section.' : 'Dates appear when the guide is ready.'}</p>
        </div>
      )}
    </div>
  );
}
export function PreparationWindow({ entry, counts, ready }) {
  const summary = ready ? preparationSummary(counts) : null;
  return (
    <div className={`${styles.panel} ${styles.preparation}`} data-window-kind="preparation" data-prepared={summary?.checked ?? ''} aria-hidden="true">
      <div className={styles.eyebrow}>
        <span>Preparation</span>
        <span>MTH140</span>
      </div>
      <div className={styles.progressFace}>
        <svg className={styles.ring} viewBox="0 0 120 120" focusable="false">
          <circle className={styles.track} cx="60" cy="60" r="50" />
          <circle className={styles.fill} cx="60" cy="60" r="50" pathLength="100" strokeDasharray={`${summary?.percent || 0} 100`} />
        </svg>
        <div className={styles.progressNumber}>
          <span>
            {summary ? summary.checked : '—'}
            <small>{summary ? `/${summary.total}` : ''}</small>
          </span>
          <span className={styles.progressLabel}>steps checked</span>
        </div>
      </div>
      <div className={styles.subject}>
        <p className={styles.title}>{entry?.title || (ready ? 'No preparation scheduled' : 'Your preparation')}</p>
        <p className={styles.when}>{summary?.percent === 100 ? 'Checklist complete. Assessment completion is recorded separately.' : 'Your own checklist, not a grade.'}</p>
      </div>
    </div>
  );
}
