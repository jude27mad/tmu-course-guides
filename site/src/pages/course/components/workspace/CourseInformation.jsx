import { useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { assessments } from '@src/lib';
import { useCourse } from '@src/pages/course/hooks/useCourseState';
import styles from './workspace.module.scss';

function Blocks({ card }) {
  if (!card) return null;
  return (
    <div className={styles.infoBlock}>
      <h3>{card.title}</h3>
      {card.blocks.map((block) =>
        block.type === 'list' ? (
          <ul key={block.text || block.items.join()} className={styles.bullets}>
            {block.items.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : (
          <p key={block.text || block.items.join()}>{block.text}</p>
        ),
      )}
    </div>
  );
}
function Rows({ rows }) {
  return rows.map((row) => (
    <div key={row.title} className={styles.infoBlock}>
      <h3>{row.title}</h3>
      <p>{row.text}</p>
    </div>
  ));
}
export default function CourseInformation({ panel }) {
  const { courseId, info, section } = useCourse();
  const root = useRef(null);
  const rows = useMemo(() => assessments(courseId, { section }), [courseId, section]);
  const cen = courseId === 'cen100';
  const { contacts, grading } = info;
  let sectionText = 'Choose your section and group above for your lab and contacts.';
  if (cen && info.profile?.value) sectionText = info.profile.summary;
  if (!cen) sectionText = info.section?.brief ? `${info.section.brief.section} · ${info.section.brief.detail}` : info.section?.briefPrompt;
  useEffect(() => {
    const target = root.current?.querySelector(`#${panel === 'panel-help' || panel === 't-help' ? 'rules-help' : panel}`);
    if (target?.tagName === 'DETAILS') target.open = true;
  }, [panel]);
  const expand = (open) =>
    root.current?.querySelectorAll('details').forEach((detail) => {
      detail.open = open;
    });
  return (
    <div ref={root} className={styles.information}>
      <div className={styles.viewHeading}>
        <h2>Course info</h2>
        <div className={styles.actions}>
          <button type="button" onClick={() => expand(true)}>
            Expand all
          </button>
          <button type="button" onClick={() => expand(false)}>
            Collapse all
          </button>
        </div>
      </div>
      <div id="section-picker" className={styles.infoBlock} tabIndex={-1}>
        <h3>Your section</h3>
        <p>{sectionText}</p>
        {info.organization ? <p>{info.organization}</p> : null}
        <p className={styles.meta}>{cen ? info.page.profile.note : 'Change your section using the selector above.'}</p>
      </div>
      <details id="course-grading" tabIndex={-1}>
        <summary>
          Grading <span>{cen ? '20 graded items · 100%' : grading.pass}</span>
        </summary>
        <div className={styles.panelBody}>
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
        </div>
      </details>
      <details id="contacts" tabIndex={-1}>
        <summary>
          Contacts <span>Who to ask</span>
        </summary>
        <div className={styles.panelBody}>
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
        </div>
      </details>
      <details id={cen ? 'p-rules' : 'rules-help'} tabIndex={-1}>
        <summary>
          Policies & help <span>Rules, missed work and confirmations</span>
        </summary>
        <div className={styles.panelBody}>
          {cen ? (
            <>
              <Rows rows={info.rules} />
              <h3>{info.page.rulesHeadings[0]}</h3>
              <Rows rows={info.confirmed} />
              <h3>{info.page.rulesHeadings[1]}</h3>
              <p>{info.openLead}</p>
              <Rows rows={info.open} />
            </>
          ) : (
            <>
              <Blocks card={info.notice} />
              {info.rules.map((card) => (
                <Blocks
                  key={card.title}
                  card={{
                    ...card,
                    blocks: card.blocks.map((block) =>
                      block.type === 'list'
                        ? {
                            ...block,
                            items: block.items.filter((line) => line !== 'At least 50% of total course marks is required to pass.' && line !== grading.quizPolicy),
                          }
                        : block,
                    ),
                  }}
                />
              ))}
            </>
          )}
        </div>
      </details>
      {!cen ? (
        <details id="textbooks" tabIndex={-1}>
          <summary>
            Textbooks & sources <span>Practice and reference</span>
          </summary>
          <div className={styles.panelBody}>
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
            <h3>{info.sources.heading}</h3>
            <p>{info.sources.note}</p>
            {info.sources.entries.map((source) => (
              <div key={source.title} className={styles.infoBlock}>
                <h3>{source.title}</h3>
                <p>{source.detail}</p>
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}
