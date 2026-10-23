import { useMemo } from 'react';
import Link from 'next/link';
import { assessments } from '@src/lib';
import { useCourse } from '@src/pages/course/hooks/useCourseState';
// eslint-disable-next-line import/extensions
import { informationEntries } from '@src/lib/information.mjs';
import styles from './workspace.module.scss';

function Answer({ entry, info, courseId, rows }) {
  const cen = courseId === 'cen100';
  const { contacts, grading } = info;
  if (entry.kind === 'grading')
    return (
      <>
        {grading.pass ? <p>{grading.pass}</p> : null}

        {rows.categories ? (
          <table>
            <caption>Course grade</caption>
            <thead>
              <tr>
                <th scope="col">Category</th>
                <th scope="col">Weight</th>
              </tr>
            </thead>
            <tbody>
              {rows.categories.map((row) => (
                <tr key={row.title}>
                  <th scope="row">{row.title}</th>
                  <td>{row.weight}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
        {grading.quizPolicy ? <p>{grading.quizPolicy}</p> : null}
        <table>
          <caption>{cen ? 'All graded items' : 'Assessments and dates'}</caption>
          <thead>
            <tr>
              <th scope="col">Assessment</th>
              <th scope="col">Date</th>
              <th scope="col">Weight</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.title}>
                <th scope="row">
                  <Link id={`grade-${row.anchor}`} scroll={false} href={`/${courseId}/#${row.anchor}`}>
                    {row.title}
                  </Link>
                </th>
                <td>{row.dateLabel}</td>
                <td>{row.weightLabel}</td>
              </tr>
            ))}
            {cen ? (
              <tr>
                <th scope="row">Course total</th>
                <td />
                <td>100%</td>
              </tr>
            ) : null}
          </tbody>
        </table>
        {cen ? (
          <>
            <table>
              <caption>{grading.tables[0].label}</caption>
              <thead>
                <tr>
                  {grading.tables[0].columns.map((label) => (
                    <th key={label} scope="col">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {grading.tables[0].rows.map((row) => (
                  <tr key={row.label}>
                    <th scope="row">{row.label}</th>
                    <td>{row.weight}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {grading.notes
              .filter((note) => !note.startsWith('All 20 graded items:'))
              .map((note) => (
                <p key={note}>{note}</p>
              ))}
          </>
        ) : null}
      </>
    );
  if (entry.kind === 'contacts')
    return (
      <>
        {cen ? (
          <>
            <div className={styles.infoBlock}>
              <h3>Graduate Assistant</h3>
              <p>{contacts.ga?.name || contacts.gaPrompt}</p>
              {contacts.ga?.locationText ? <p>{contacts.ga.locationText}</p> : null}
            </div>
            <div className={styles.infoBlock}>
              <h3>Project Manager</h3>
              <p>{contacts.pm?.name || contacts.pmPrompt}</p>
            </div>
          </>
        ) : (
          <>
            <p>
              {contacts.coordinatorLabel} {contacts.coordinator}
            </p>
            {contacts.section ? (
              contacts.section.map((row) => (
                <div className={styles.infoBlock} key={row.heading}>
                  <h3>{row.heading}</h3>
                  {row.href ? <a href={row.href}>{row.text}</a> : <p>{row.text}</p>}
                </div>
              ))
            ) : (
              <p>{contacts.prompt}</p>
            )}
            {contacts.links.map((link) => (
              <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer">
                {link.label} ↗
              </a>
            ))}
          </>
        )}
        <p>{contacts.note}</p>
      </>
    );
  if (entry.kind === 'textbooks')
    return (
      <>
        <p>{info.textbooks.note}</p>
        {info.textbooks.books.map((book) => (
          <div key={book.title} className={styles.infoBlock}>
            <h3>
              <a href={book.url} target="_blank" rel="noopener noreferrer">
                {book.title} ↗
              </a>
            </h3>
            <p>{book.note}</p>
          </div>
        ))}
      </>
    );
  if (entry.kind === 'sources')
    return (
      <>
        <p>{info.sources.note}</p>
        {info.sources.entries.map((source) => (
          <div key={source.title} className={styles.infoBlock}>
            <h3>{source.title}</h3>
            <p>{source.detail}</p>
          </div>
        ))}
      </>
    );
  return entry.blocks.map((block) =>
    block.type === 'list' ? (
      <ul key={block.items.join()} className={styles.bullets}>
        {block.items.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    ) : (
      <p key={block.text} className={block.type === 'source' ? styles.meta : undefined}>
        {block.text}
      </p>
    ),
  );
}

export default function CourseInformation({ panel, back, returnView = 'info' }) {
  const { courseId, info, section } = useCourse();
  const rows = useMemo(() => assessments(courseId, { section }), [courseId, section]);
  const entries = informationEntries(courseId, info);
  const selected = entries.find((entry) => entry.id === panel);
  const cen = courseId === 'cen100';
  let sectionText = 'Choose your section and group above for your lab and contacts.';
  if (cen && info.profile?.value) sectionText = info.profile.summary;
  if (!cen) sectionText = info.section?.brief ? `${info.section.brief.section} · ${info.section.brief.detail}` : info.section?.briefPrompt;
  const returnLabel = {
    info: 'Course info',
    work: 'Work',
    study: 'Study',
    schedule: 'Schedule',
  }[returnView];
  const backButton = (
    <button type="button" className={styles.back} onClick={back}>
      ← Back to {returnLabel}
    </button>
  );
  const answer = (entry) => <Answer entry={entry} info={info} courseId={courseId} rows={rows} />;
  return (
    <div className={styles.information}>
      {selected ? (
        <article id={selected.id} tabIndex={-1} data-info-detail className={styles.detail}>
          {backButton}
          <div className={styles.detailHeading}>
            <span className={styles.eyebrow}>{selected.group}</span>
            <h2>{selected.title}</h2>
          </div>
          <div className={styles.panelBody}>{answer(selected)}</div>
          {backButton}
        </article>
      ) : (
        <>
          <div className={styles.viewHeading}>
            <h2>Course info</h2>
          </div>
          <div id="section-picker" className={styles.infoBlock} tabIndex={-1}>
            <h3>Your section</h3>
            <p>{sectionText}</p>
            {info.organization ? <p>{info.organization}</p> : null}
            <p className={styles.meta}>{cen ? info.page.profile.note : 'Change your section using the selector above.'}</p>
          </div>
          {[...new Set(entries.map((entry) => entry.group))].map((group) => (
            <section key={group} className={styles.workGroup}>
              <h3 className={styles.groupTitle}>{group}</h3>
              <ul className={styles.workList}>
                {entries
                  .filter((entry) => entry.group === group)
                  .map((entry) => (
                    <li key={entry.id}>
                      <Link id={`info-${entry.id}`} className={styles.infoRow} href={`/${courseId}/#${entry.id}`} scroll={false}>
                        <span>{entry.title}</span>
                        <span aria-hidden="true">↗</span>
                      </Link>
                    </li>
                  ))}
              </ul>
            </section>
          ))}
        </>
      )}
      <noscript>
        {entries.map((entry) => (
          <section key={entry.id} id={entry.id} className={styles.infoBlock}>
            <h2>{entry.title}</h2>
            <div className={styles.panelBody}>{answer(entry)}</div>
          </section>
        ))}
      </noscript>
    </div>
  );
}
