import TextOpacity from '@src/components/animationComponents/textOpacity/Index';
import clsx from 'clsx';
import styles from '@src/pages/components/quote/styles/quote.module.scss';
import { memo, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '@src/store';

// One existing sentence, word for word (the site README's disclaimer).
const QUOTE = 'This is an unofficial student-built companion, not a replacement for D2L or announcements from the teaching team.';

function Quote() {
  const [isLoading] = useStore(useShallow((state) => [state.isLoading]));

  const rootRef = useRef();

  return (
    <section ref={rootRef} className={clsx(styles.root, 'layout-block-inner')}>
      <blockquote className={clsx(styles.text, 'h3')}>
        {/* plain until the page is in (and without JS); then the original scroll fly-in */}
        {isLoading ? <span>{QUOTE}</span> : <TextOpacity trigger={rootRef.current}>{QUOTE}</TextOpacity>}
      </blockquote>
    </section>
  );
}

export default memo(Quote);
