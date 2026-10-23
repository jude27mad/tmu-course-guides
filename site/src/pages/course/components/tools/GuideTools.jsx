import { calendarFile, exportBackup, hasUnseenUpdates, importBackup, markUpdatesSeen } from '@src/lib';
import { useEffect, useId, useRef, useState } from 'react';
import gsap from 'gsap';

import Arrow from '@src/components/imageComponents/Arrow';
// eslint-disable-next-line import/extensions
import { bindGuideTools } from '@src/pages/course/components/tools/dialog.mjs';
import clsx from 'clsx';
import styles from '@src/pages/course/components/tools/styles/guideTools.module.scss';
import { useCourse } from '@src/pages/course/hooks/useCourseState';
import { useStore } from '@src/store';

// The existing calendar, backup and update actions, now in a native modal.
// Files and saved progress keep the same formats and '@src/lib' functions.
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
  const [status, setStatus] = useState({ key: null, message: '' });
  const [updatesOpen, setUpdatesOpen] = useState(false);
  const [unseen, setUnseen] = useState(false);
  const fileRef = useRef(null);
  const dialogRef = useRef(null);
  const fileId = useId();
  const cen = courseId === 'cen100';
  const page = info.page || {};
  const tools = info.tools || {};
  const updates = info.updates || {};
  const updateEntries = Array.isArray(updates) ? updates : updates.entries || page.updates || [];

  useEffect(() => {
    if (progress.ready) setUnseen(hasUnseenUpdates(courseId));
  }, [progress.ready, version, courseId]);

  useEffect(() => {
    const dialog = dialogRef.current;
    let tween;
    const unbind = bindGuideTools(dialog, {
      getLenis: () => useStore.getState().lenis,
      animate: (opening, complete) => {
        if (useStore.getState().still) {
          gsap.set(dialog, {
            clearProps: 'transform,opacity,--tools-backdrop-opacity',
          });
          complete();
          return undefined;
        }
        if (opening && !dialog.style.opacity)
          gsap.set(dialog, {
            y: 20,
            opacity: 0,
            '--tools-backdrop-opacity': 0,
          });
        tween = gsap.to(dialog, {
          y: opening ? 0 : 12,
          opacity: opening ? 1 : 0,
          '--tools-backdrop-opacity': opening ? 1 : 0,
          duration: opening ? 0.4 : 0.18,
          ease: 'power2.inOut',
          onComplete: () => {
            complete();
            gsap.set(dialog, {
              clearProps: 'transform,opacity,--tools-backdrop-opacity',
            });
          },
        });
        return () => tween?.kill();
      },
    });
    const unsubscribe = useStore.subscribe((state) => {
      if (state.still) tween?.progress(1);
    });
    return () => {
      unsubscribe();
      unbind();
      gsap.set(dialog, {
        clearProps: 'transform,opacity,--tools-backdrop-opacity',
      });
    };
  }, [courseId]);

  const say = (key, message) => setStatus({ key, message: message || '' });

  const rows = [
    {
      key: 'calendar',
      title: tools.calendar?.download,
      desc: (tools.calendar?.notes || []).join(' '),
      run: () => {
        const file = calendarFile(
          courseId,
          cen
            ? {
                now: live?.now || new Date(),
                item: 'all',
                upcomingOnly: true,
                reminderDays: 1,
              }
            : {
                now: live?.now || new Date(),
                includeTentative: !!section,
                upcomingOnly: true,
              },
        );
        if (file.ok) download(file);
        say('calendar', file.message);
      },
    },
    {
      key: 'export',
      title: tools.backup?.export,
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
    <dialog ref={dialogRef} id="guide-tools" className={styles.dialog} aria-labelledby="guide-tools-title" data-lenis-prevent>
      <div className={styles.header}>
        <h2 id="guide-tools-title" className={styles.title}>
          {page.tools?.summary || 'Guide tools'}
        </h2>
        <button type="button" className={styles.close} data-close-tools aria-label="Close guide tools">
          Close
        </button>
      </div>
      <div className={styles.body} data-lenis-prevent>
        <p className={styles.note}>{page.tools?.updated || page.tools?.note || tools.note}</p>
        <ul className={styles.options}>
          {rows.map((row) => (
            <li key={row.key} className={styles.option}>
              <button type="button" className={styles.optionButton} aria-expanded={row.expanded} aria-controls={row.key === 'updates' ? 'tools-updates' : undefined} onClick={row.run}>
                <Arrow className={clsx(styles.arrow, row.expanded && styles.arrowOpen)} />
                <span className={styles.optionTitle}>{row.title}</span>
                {row.badge ? <span className={styles.badge}>{row.badge}</span> : null}
              </button>
              {row.desc ? <p className={styles.inlineDesc}>{row.desc}</p> : null}
              <p className={styles.status} role="status">
                {status.key === row.key ? status.message : ''}
              </p>
              {row.key === 'updates' ? (
                <ol id="tools-updates" className={styles.updates} hidden={!updatesOpen}>
                  {updateEntries.map((entry) => (
                    <li key={`${entry.date}-${entry.title}`} className={styles.update}>
                      <span className={styles.muted}>{entry.date}</span>
                      <h3 className={styles.updateTitle}>{entry.title}</h3>
                      {entry.text ? <span>{entry.text}</span> : null}
                      {(entry.items || []).map((line) => (
                        <span key={line}>{line}</span>
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
        {page.tools?.updated ? <p className={styles.note}>{tools.note || page.tools?.note}</p> : null}
      </div>
    </dialog>
  );
}

export default GuideTools;
