import clsx from 'clsx';
import { ScrollTrigger } from 'gsap/dist/ScrollTrigger';
import styles from './styles/designCredit.module.scss';

// Native disclosure: keyboard, touch and no-JavaScript access share one path.
export default function DesignCredit({ tone = 'light', onToggle }) {
  return (
    <details
      className={clsx(styles.root, tone === 'dark' && styles.dark)}
      data-design-credit
      onToggle={(event) => {
        if (onToggle) onToggle(event.currentTarget.open);
        else ScrollTrigger.refresh();
      }}
    >
      <summary>
        Design credit <span aria-hidden="true">⌄</span>
      </summary>
      <p>
        Original portfolio design and development by <span className={styles.author}>Evangelos Giatsidis.</span>
      </p>
      <a href="https://giats.me" target="_blank" rel="noopener noreferrer">
        giats.me ↗
      </a>
    </details>
  );
}
