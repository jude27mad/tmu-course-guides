import Link from 'next/link';
import DesignCredit from '@src/components/dom/DesignCredit';
import styles from './workspace.module.scss';

export default function CompactFooter() {
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
      <p>Unofficial TMU course companion · Check D2L for updates.</p>
      <DesignCredit />
    </footer>
  );
}
