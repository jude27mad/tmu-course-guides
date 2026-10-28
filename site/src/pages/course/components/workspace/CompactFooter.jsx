import Link from 'next/link';
import { courseInfo } from '@src/lib';
import DesignCredit from '@src/components/dom/DesignCredit';
import styles from './workspace.module.scss';

export default function CompactFooter({ courseId }) {
  // The newest Course updates entry: when this guide's dates and details last changed (static data).
  const updated = courseId ? courseInfo(courseId).updates?.entries?.[0]?.date : null;
  return (
    <footer className={styles.footer}>
      <div>
        <Link href="/" scroll={false}>
          Desk ↗
        </Link>
        <Link href="/courses/" scroll={false}>
          All courses ↗
        </Link>
        <Link href="/privacy/" scroll={false}>
          Privacy
        </Link>
        <Link href="/updates/" scroll={false}>
          Website updates
        </Link>
      </div>
      <p>Unofficial TMU course companion{updated ? ` · Course information last updated ${updated}` : ''} · Check D2L for updates.</p>
      <DesignCredit />
    </footer>
  );
}
