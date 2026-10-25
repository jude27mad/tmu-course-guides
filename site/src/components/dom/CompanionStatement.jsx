import TextOpacity from '@src/components/animationComponents/textOpacity/Index';
import clsx from 'clsx';
import styles from '@src/components/dom/styles/companionStatement.module.scss';
import FruitNinja from '@src/components/dom/prefooter/Index';
import useInView from '@src/hooks/useInView';
import useStill from '@src/hooks/useStill';
import { memo, useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '@src/store';

// One existing sentence, word for word (the site README's disclaimer).
const QUOTE = 'This is an unofficial student-built companion, not a replacement for D2L or announcements from the teaching team.';

function CompanionStatement() {
  const [isLoading, covered] = useStore(useShallow((state) => [state.isLoading, state.isMenuOpen || state.isSearchOpen || state.isTransitioning]));

  const rootRef = useRef();
  const stageRef = useRef();
  const near = useInView(rootRef, { rootMargin: '100% 0px' });
  const visible = useInView(stageRef);
  const still = useStill();
  const [mounted, setMounted] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    if (near && !still) setMounted(true);
  }, [near, still]);

  useEffect(() => {
    const updateVisibility = () => setHidden(document.hidden);
    const updateDialog = () => setDialogOpen(!!document.querySelector('dialog[open]'));
    const observer = new MutationObserver(updateDialog);
    observer.observe(document.body, { attributes: true, attributeFilter: ['open'], subtree: true });
    document.addEventListener('visibilitychange', updateVisibility);
    updateVisibility();
    updateDialog();
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', updateVisibility);
    };
  }, []);
  const active = visible && !still && !hidden && !covered && !dialogOpen && !isLoading;

  return (
    <section ref={rootRef} className={clsx(styles.root, 'layout-block-inner', still && styles.still)} data-companion-statement>
      <div ref={stageRef} className={styles.stage}>
        <blockquote className={clsx(styles.text, 'h3')}>
          {/* plain until the page is in (and without JS); then the original scroll fly-in */}
          {isLoading ? <span>{QUOTE}</span> : <TextOpacity trigger={rootRef.current}>{QUOTE}</TextOpacity>}
        </blockquote>
        <p className={clsx(styles.progress, 'h6')} data-companion-progress>
          Progress stays in this browser.
        </p>
        <div className={styles.canvas} aria-hidden="true" data-companion-game data-active={active}>
          {mounted && <FruitNinja active={active} eventSource={stageRef} />}
        </div>
      </div>
    </section>
  );
}

export default memo(CompanionStatement);
