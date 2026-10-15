/* eslint-disable react/jsx-props-no-spreading */
import AppearTitle from '@src/components/animationComponents/appearTitle/Index';
import CustomHead from '@src/components/dom/CustomHead';
import Link from 'next/link';
import { PRIVACY_TEXT } from '@src/lib';
import clsx from 'clsx';
import styles from '@src/pages/privacy/privacy.module.scss';

// The old privacy.html, word for word, in the original /about Overview pattern:
// the first paragraph as the large statement, the update date as the small
// label, the other paragraphs as the h6 column.
const seo = {
  title: 'Privacy | TMU Course Guides',
  description: PRIVACY_TEXT.paragraphs[0]?.text,
};

function Paragraph({ paragraph, className }) {
  return (
    <p className={className}>
      {paragraph.text}
      {paragraph.link && (
        <>
          {' '}
          <a href={paragraph.link.href} rel="noopener noreferrer" className={styles.link}>
            {paragraph.link.label}
          </a>
          {paragraph.after}
        </>
      )}
    </p>
  );
}

function Page() {
  const [first, ...rest] = PRIVACY_TEXT.paragraphs;
  const back = PRIVACY_TEXT.back.replace(/^←\s*/, '');

  return (
    <>
      <CustomHead {...seo} />
      <section className={clsx(styles.titleContainer, 'layout-block-inner')}>
        <Link href="/" scroll={false} className={clsx('p-l', styles.back)}>
          <span aria-hidden="true">← </span>
          {back}
        </Link>
        <h1 className={clsx(styles.heading, 'h1')}>{PRIVACY_TEXT.heading}</h1>
      </section>
      <section className={clsx(styles.root, 'layout-grid-inner')}>
        <div className={styles.title}>
          <AppearTitle>
            <Paragraph paragraph={first} className="h3" />
          </AppearTitle>
        </div>
        <div className={clsx(styles.text, 'p-l', styles.myStory)}>
          <AppearTitle>
            <span>{PRIVACY_TEXT.updated}</span>
          </AppearTitle>
        </div>
        <div className={styles.desc}>
          <AppearTitle>
            {rest.map((paragraph, index) => (
              // eslint-disable-next-line react/no-array-index-key
              <Paragraph key={index} paragraph={paragraph} className={clsx('h6', index > 0 && styles.paddingTop)} />
            ))}
          </AppearTitle>
        </div>
      </section>
    </>
  );
}

export default Page;
