import { useCallback } from 'react';

import PerspectiveText from '@src/components/animationComponents/perspectiveText/Index';
import clsx from 'clsx';
import styles from '@src/components/dom/navbar/styles/menuButton.module.scss';
import { isMobileNow } from '@src/hooks/useIsMobile';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '@src/store';

function MenuButton() {
  const [setIsMenuOpen, isMenuOpen] = useStore(useShallow((state) => [state.setIsMenuOpen, state.isMenuOpen]));

  const handleClick = useCallback(() => {
    if (!useStore.getState().isLoading) {
      if (isMobileNow()) {
        // iPhone Safari only honours programmatic navigation focus during the
        // tap itself. Make the transparent panel focusable before React and
        // GSAP play its entrance; the panel still fades in normally.
        const menu = document.getElementById('menu');
        if (menu) {
          menu.inert = false;
          menu.setAttribute('aria-hidden', 'false');
          menu.style.visibility = 'visible';
          menu.querySelector('a[href], button:not([disabled])')?.focus({ preventScroll: true });
        }
      }
      setIsMenuOpen(true);
    }
  }, [setIsMenuOpen]);

  return (
    <button
      type="button"
      id="menu-button"
      data-glass="dark"
      onClick={handleClick}
      aria-label="Open menu"
      aria-haspopup="dialog"
      aria-expanded={isMenuOpen}
      aria-controls="menu"
      className={clsx('p-xs', styles.button)}
    >
      <PerspectiveText label="Menu" className={clsx('p-x', styles.label)} />
    </button>
  );
}

export default MenuButton;
