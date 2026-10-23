import Link from 'next/link';
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
      </div>
      <p>Unofficial TMU course companion · Check D2L for updates.</p>
      <p>Progress stays in this browser. Back up with Guide tools.</p>
      <p>
        Original portfolio design and development by Evangelos Giatsidis ·{' '}
        <a href="https://giats.me" target="_blank" rel="noopener noreferrer">
          giats.me ↗
        </a>
      </p>
    </footer>
  );
}
