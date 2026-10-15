import { calendarFile, exportBackup, hasUnseenUpdates, importBackup, markUpdatesSeen } from '@src/lib';
import { useEffect, useId, useRef, useState } from 'react';

import AppearTitle from '@src/components/animationComponents/appearTitle/Index';
import Arrow from '@src/components/imageComponents/Arrow';
import HoverText, { dimPage, hidePortal, showPortal } from '@src/pages/course/components/portal/HoverText';
import clsx from 'clsx';
import deadlineStyles from '@src/pages/course/components/deadlines/styles/deadlines.module.scss';
import overview from '@src/pages/course/components/overview/styles/overview.module.scss';
import styles from '@src/pages/course/components/tools/styles/guideTools.module.scss';
import { useCourse } from '@src/pages/course/hooks/useCourseState';

// Guide tools as a Services options list (arrow rows): each row is a button;
// its description shows in the Portal on desktop hover and under the row on
// phones. Files are built by '@src/lib' in the old formats and saved here.
const finePointer = () => typeof window !== 'undefined' && window.matchMedia?.('(hover: hover) and (pointer: fine)').matches;

function download(file) {
  const blob = new Blob([file.text], { type: file.type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function GuideTools() {
  const { courseId, info, copy, progress, section, live, version } = useCourse();
  const [portals, setPortals] = useState([]);
  const [status, setStatus] = useState({ key: null, message: '' });
  const [updatesOpen, setUpdatesOpen] = useState(false);
  const [unseen, setUnseen] = useState(false);
  const fileRef = useRef(null);
  const sectionRef = useRef(null);
  const fileId = useId();
  const cen = courseId === 'cen100';
  const page = info.page || {};
  const tools = info.tools || {};
  const updates = info.updates || {};
  const updateEntries = Array.isArray(updates) ? updates : updates.entries || page.updates || [];

  useEffect(() => {
    if (progress.ready) setUnseen(hasUnseenUpdates(courseId));
  }, [progress.ready, version, courseId]);

  useEffect(() => () => dimPage(false, sectionRef.current), []);

  const say = (key, message) => setStatus({ key, message: message || '' });

  const rows = [
    {
      key: 'calendar',
      title: tools.calendar?.download,
      desc: (tools.calendar?.notes || []).join(' '),
      run: () => {
        const file = calendarFile(
          courseId,
          cen ? { now: live?.now || new Date(), item: 'all', upcomingOnly: true, reminderDays: 1 } : { now: live?.now || new Date(), includeTentative: !!section, upcomingOnly: true },
        );
        if (file.ok) download(file);
        say('calendar', file.message);
      },
    },
    {
      key: 'export',
      title: tools.backup?.export,
      desc: (tools.backup?.notes || []).join(' '),
      run: () => {
        const file = exportBackup(courseId, { now: new Date() });
        if (file) {
          download(file);
          say('export', file.message);
        }
      },
    },
    {
      key: 'import',
      title: tools.backup?.importLabel,
      desc: (tools.backup?.notes || []).join(' '),
      run: () => fileRef.current?.click(),
    },
    cen
      ? {
          key: 'reset',
          title: info.footer?.reset,
          desc: copy.clearTicksConfirm,
          run: () => {
            // eslint-disable-next-line no-alert
            if (window.confirm(copy.clearTicksConfirm)) {
              const saved = progress.clearTicks();
              say('reset', saved ? '' : copy.blocked);
            }
          },
        }
      : null,
    {
      key: 'updates',
      title: updates.summary || page.updatesSummary,
      badge: unseen ? updates.badge || page.updatesBadge : '',
      desc: updateEntries[0] ? `${updateEntries[0].date} · ${updateEntries[0].title}` : '',
      expanded: updatesOpen,
      run: () => {
        setUpdatesOpen((value) => !value);
        if (!updatesOpen) {
          markUpdatesSeen(courseId);
          setUnseen(false);
        }
      },
    },
  ].filter((row) => row && row.title);

  const onFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const limit = cen ? 250 * 1024 : 300 * 1024;
    if (file.size > limit) {
      say('import', copy.backupTooLarge);
      return;
    }
    const text = await file.text();
    const result = importBackup(courseId, text);
    say('import', result.saved || !result.ok ? result.message : `${result.message} ${copy.blocked}`);
  };

  return (
    <section ref={sectionRef} id="guide-tools" className={clsx(overview.root, styles.root, 'layout-grid-inner')}>
      <div className={overview.title}>
        <AppearTitle key={`tools-${courseId}`}>
          <h2 className="h3">{page.tools?.summary}</h2>
        </AppearTitle>
      </div>
      <div className={clsx(overview.text, 'p-l', overview.myStory)}>
        <AppearTitle key={`tools-label-${courseId}`}>
          <span>{page.tools?.updated || page.tools?.note || tools.note}</span>
        </AppearTitle>
      </div>
      <div className={clsx(overview.desc, styles.desc)}>
        <ul className={styles.options}>
          {rows.map((row) => (
            <li key={row.key} className={styles.option}>
              <button
                type="button"
                className={deadlineStyles.optionButton}
                aria-expanded={row.expanded}
                onClick={row.run}
                onPointerEnter={(event) => {
                  if (event.pointerType !== 'mouse' || !finePointer() || !row.desc) return;
                  dimPage(true, sectionRef.current);
                  showPortal(setPortals, row.key, [row.title, row.desc]);
                }}
                onPointerLeave={() => {
                  dimPage(false, sectionRef.current);
                  hidePortal(setPortals, row.key);
                }}
              >
                <Arrow className={clsx(deadlineStyles.arrow, row.expanded && deadlineStyles.arrowOpen)} />
                <span className={clsx('p-l', deadlineStyles.optionTitle)}>{row.title}</span>
                {row.badge ? <span className={clsx('p-x', styles.badge)}>{row.badge}</span> : null}
              </button>
              {row.desc ? <p className={clsx('p-x', styles.inlineDesc)}>{row.desc}</p> : null}
              <p className={clsx('p-l', styles.status)} role="status">
                {status.key === row.key ? status.message : ''}
              </p>
              {row.key === 'updates' && updatesOpen ? (
                <ol className={styles.updates}>
                  {updateEntries.map((entry) => (
                    <li key={`${entry.date}-${entry.title}`} className={styles.update}>
                      <span className={clsx('p-x', styles.muted)}>{entry.date}</span>
                      <span className="h6">{entry.title}</span>
                      {entry.text ? <span className="p-l">{entry.text}</span> : null}
                      {(entry.items || []).map((line) => (
                        <span key={line} className="p-l">
                          {line}
                        </span>
                      ))}
                    </li>
                  ))}
                </ol>
              ) : null}
            </li>
          ))}
        </ul>
        <label htmlFor={fileId} className="sr-only">
          {tools.backup?.importLabel}
        </label>
        <input id={fileId} ref={fileRef} type="file" accept="application/json,.json" className={styles.file} tabIndex={-1} onChange={onFile} />
        {page.tools?.updated ? <p className={clsx('p-x', styles.muted)}>{tools.note || page.tools?.note}</p> : null}
      </div>
      <HoverText portals={portals} className={deadlineStyles.hoverTextContainer} textClassName={deadlineStyles.hoverText} />
    </section>
  );
}

export default GuideTools;
