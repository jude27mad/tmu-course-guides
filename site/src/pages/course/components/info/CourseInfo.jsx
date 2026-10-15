import AppearTitle from '@src/components/animationComponents/appearTitle/Index';
import Arrow from '@src/components/imageComponents/Arrow';
import ButtonLink from '@src/components/animationComponents/buttonLink/Index';
import SectionPicker from '@src/pages/course/components/info/SectionPicker';
import clsx from 'clsx';
import overview from '@src/pages/course/components/overview/styles/overview.module.scss';
import styles from '@src/pages/course/components/info/styles/courseInfo.module.scss';
import { PICKER_ID, openPicker, useCourse } from '@src/pages/course/hooks/useCourseState';

// Course info: the original Overview blocks (h3 title, small label, a column of
// lines) for the section brief, who to ask, the rules and the help, with the
// section picker as a MenuLinks-style window between them.

function Block({ id, title, label, children }) {
  return (
    <section id={id} className={clsx(overview.root, styles.block, 'layout-grid-inner')}>
      <div className={overview.title}>
        <AppearTitle key={`${id}-${title}`}>
          <h2 className="h3">{title}</h2>
        </AppearTitle>
      </div>
      {label ? (
        <div className={clsx(overview.text, 'p-l', overview.myStory)}>
          <AppearTitle key={`${id}-${label}`}>
            <span>{label}</span>
          </AppearTitle>
        </div>
      ) : null}
      <div className={clsx(overview.desc, styles.desc)}>{children}</div>
    </section>
  );
}

function Pair({ label, value, href }) {
  if (!value) return null;
  return (
    <div className={styles.pair}>
      <span className={clsx('p-x', styles.pairLabel)}>{label}</span>
      {href ? (
        <a className={clsx('h6', styles.link)} href={href} target="_blank" rel="noopener noreferrer">
          {value}
        </a>
      ) : (
        <span className="h6">{value}</span>
      )}
    </div>
  );
}

function Rows({ rows, marked }) {
  return (
    <ul className={styles.rows}>
      {rows.map((row) => (
        <li key={row.title} className={clsx(styles.row, marked && row.severity === 'red' && styles.rowStrong)}>
          <span className="h6">{row.title}</span>
          <span className="p-l">{row.text}</span>
        </li>
      ))}
    </ul>
  );
}

function RuleCard({ card }) {
  return (
    <div className={styles.card}>
      <h3 className="h6">{card.title}</h3>
      {card.blocks.map((block, index) => {
        const key = `${card.title}-${index}`;
        if (block.type === 'list') {
          return (
            <ul key={key} className={styles.lines}>
              {block.items.map((line) => (
                <li key={line} className={clsx('p-l', styles.line)}>
                  <Arrow className={styles.bullet} />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={key} className={block.type === 'source' ? clsx('p-x', styles.muted) : 'p-l'}>
            {block.text}
          </p>
        );
      })}
    </div>
  );
}

function CenInfo() {
  const { info } = useCourse();
  const { contacts } = info;
  const page = info.page || {};
  const [confirmedHeading, openHeading] = page.rulesHeadings || [];
  return (
    <>
      <Block id="course-info" title="Course info" label={page.profile?.summary}>
        <p className="h6" aria-live="polite">
          {info.profile?.value ? info.profile.summary : ''}
        </p>
        <p className={clsx('p-l', styles.muted)}>{page.profile?.note}</p>
      </Block>
      <SectionPicker />
      <Block id="contacts" title={contacts.heading}>
        {contacts.ga ? (
          <>
            <Pair label={contacts.ga.role} value={contacts.ga.name} />
            <Pair label={contacts.ga.locationText?.split(':')[0]} value={contacts.ga.location} />
          </>
        ) : (
          <p className="p-l">{contacts.gaPrompt}</p>
        )}
        {contacts.pm ? <Pair label={contacts.pm.role} value={contacts.pm.name} /> : <p className="p-l">{contacts.pmPrompt}</p>}
        <p className={clsx('p-x', styles.muted)}>{contacts.note}</p>
        <div className={styles.buttons}>
          <ButtonLink onClick={openPicker} label={String(contacts.change || '').toUpperCase()} ariaControls={PICKER_ID} />
        </div>
      </Block>
      <Block id="p-rules" title={info.leads?.rules} label={(page.tabs || []).find((tab) => tab.id === 'rules')?.label}>
        <Rows rows={info.rules} marked />
        <h3 className={clsx('h6', styles.subheading)}>{confirmedHeading}</h3>
        <Rows rows={info.confirmed} />
        <h3 className={clsx('h6', styles.subheading)}>{openHeading}</h3>
        <p className="p-l">{info.openLead}</p>
        <Rows rows={info.open} />
      </Block>
    </>
  );
}

function MathInfo() {
  const { info } = useCourse();
  const page = info.page || {};
  const { contacts, section } = info;
  const help = (page.tabs || []).find((tab) => tab.id === 'help')?.label;
  return (
    <>
      <Block id="course-info" title="Course info" label={page.section?.label}>
        <p className="h6" aria-live="polite">
          {section?.brief ? `${section.brief.section} · ${section.brief.detail}` : section?.briefPrompt}
        </p>
        {info.organization ? <p className={clsx('p-l', styles.muted)}>{info.organization}</p> : null}
      </Block>
      <SectionPicker />
      <Block id="contacts" title={contacts.heading} label={`${contacts.coordinatorLabel} ${contacts.coordinator}`}>
        {contacts.section ? contacts.section.map((entry) => <Pair key={entry.heading} label={entry.heading} value={entry.text} href={entry.href} />) : <p className="p-l">{contacts.prompt}</p>}
        <p className={clsx('p-x', styles.muted)}>{contacts.note}</p>
        <div className={styles.buttons}>
          {contacts.links.map((link) => (
            <ButtonLink key={link.href} target href={link.href} label={link.label.toUpperCase()} />
          ))}
        </div>
      </Block>
      <Block id="rules-help" title={help}>
        {info.notice ? <RuleCard card={info.notice} /> : null}
        {info.rules.map((card) => (
          <RuleCard key={card.title} card={card} />
        ))}
      </Block>
      <Block id="textbooks" title={info.textbooks.heading}>
        <p className={clsx('p-l', styles.muted)}>{info.textbooks.note}</p>
        {info.textbooks.books.map((book) => (
          <div key={book.title} className={styles.card}>
            <a className={clsx('h6', styles.link)} href={book.url} target="_blank" rel="noopener noreferrer">
              {book.title}
            </a>
            <p className="p-l">{book.note}</p>
          </div>
        ))}
        <h3 className={clsx('h6', styles.subheading)}>{info.sources.heading}</h3>
        <p className={clsx('p-l', styles.muted)}>{info.sources.note}</p>
        <ul className={styles.rows}>
          {info.sources.entries.map((entry) => (
            <li key={entry.title} className={styles.row}>
              <span className="p-l">{entry.title}</span>
              <span className={clsx('p-x', styles.muted)}>{entry.detail}</span>
            </li>
          ))}
        </ul>
      </Block>
    </>
  );
}

function CourseInfo() {
  const { courseId } = useCourse();
  return courseId === 'cen100' ? <CenInfo /> : <MathInfo />;
}

export default CourseInfo;
