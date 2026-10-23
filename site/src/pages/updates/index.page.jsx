/* eslint-disable react/jsx-props-no-spreading */
import { COURSES, PRIVACY_TEXT, WEBSITE_UPDATES } from '@src/lib';

import CustomHead from '@src/components/dom/CustomHead';
import Link from 'next/link';
import clsx from 'clsx';
import styles from '@src/pages/updates/updates.module.scss';

// Changes to the website itself, newest first. Changes to a course's dates,
// coverage and grading are under "Course updates" in that course's Guide tools.
const seo = {
  title: 'Website updates | TMU Course Guides',
  description: 'Changes to the TMU Course Guides website, newest first.',
};

const CODES = Object.fromEntries(COURSES.map((course) => [course.id, course.code]));
const guides = (ids) => `${ids.map((id) => CODES[id]).join(' and ')} ${ids.length > 1 ? 'guides' : 'guide'}`;

function Page() {
  const back = PRIVACY_TEXT.back.replace(/^←\s*/, '');

  return (
    <>
      <CustomHead {...seo} />
      <section className={clsx(styles.titleContainer, 'layout-block-inner')}>
        <Link href="/" scroll={false} className={clsx('p-l', styles.back)}>
          <span aria-hidden="true">← </span>
          {back}
        </Link>
        <h1 className={clsx(styles.heading, 'h2')}>Website updates</h1>
        <p className={styles.lede}>Changes to the website itself, newest first. Changes to course dates, coverage and grading are under Course updates in each course&apos;s Guide tools.</p>
      </section>
      <section className={clsx(styles.root, 'layout-block-inner')}>
        <ol className={styles.list}>
          {WEBSITE_UPDATES.map((entry) => (
            <li key={entry.id} id={entry.id} className={styles.entry}>
              <p className={styles.meta}>
                <time dateTime={entry.id.slice(0, 10)}>{entry.date}</time>
                {entry.courses ? ` · ${guides(entry.courses)}` : null}
              </p>
              <h2 className={styles.title}>{entry.title}</h2>
              {entry.text ? <p>{entry.text}</p> : null}
              {entry.items.length ? (
                <ul className={styles.items}>
                  {entry.items.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              ) : null}
              {entry.after ? <p>{entry.after}</p> : null}
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}

export default Page;
