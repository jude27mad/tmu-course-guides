import { useCallback, useEffect, useRef, useState } from 'react';

import PerspectiveText from '@src/components/animationComponents/perspectiveText/Index';
import clsx from 'clsx';
import styles from '@src/components/dom/navbar/styles/menuButton.module.scss';
import useScroll from '@src/hooks/useScroll';
import { useRouter } from 'next/router';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '@src/store';

// True while the button's centre is over a dark window (any [data-surface="dark"] element),
// so the ink pill can switch to its light version instead of disappearing into the panel.
function useOverDark(ref) {
  const [overDark, setOverDark] = useState(false);
  const frame = useRef(0);
  const check = useCallback(() => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const button = ref.current;
      if (!button) return;
      const box = button.getBoundingClientRect();
      const x = box.left + box.width / 2;
      const y = box.top + box.height / 2;
      const dark = Array.prototype.some.call(document.querySelectorAll('[data-surface="dark"]'), (node) => {
        const area = node.getBoundingClientRect();
        return x >= area.left && x <= area.right && y >= area.top && y <= area.bottom;
      });
      setOverDark(dark);
    });
  }, [ref]);
  const { asPath } = useRouter();

  useScroll(check);
  useEffect(() => {
    check();
    // once more after the route transition has settled
    const settled = setTimeout(check, 1500);
    window.addEventListener('resize', check);
    return () => {
      clearTimeout(settled);
      window.removeEventListener('resize', check);
      cancelAnimationFrame(frame.current);
    };
  }, [asPath, check]);

  return overDark;
}

function MenuButton() {
  const [setIsMenuOpen, isMenuOpen] = useStore(useShallow((state) => [state.setIsMenuOpen, state.isMenuOpen]));
  const ref = useRef(null);
  const overDark = useOverDark(ref);

  const handleClick = useCallback(() => {
    if (!useStore.getState().isLoading) {
      setIsMenuOpen(true);
    }
  }, [setIsMenuOpen]);

  return (
    <button ref={ref} type="button" id="menu-button" onClick={handleClick} aria-label="Open menu" aria-expanded={isMenuOpen} aria-controls="menu" className={clsx('p-xs', styles.button, overDark && styles.overDark)}>
      <PerspectiveText label="Menu" className={clsx('p-x', styles.label)} />
    </button>
  );
}

export default MenuButton;
