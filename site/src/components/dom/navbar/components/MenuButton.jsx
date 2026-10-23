import { useCallback, useEffect, useRef, useState } from 'react';

import PerspectiveText from '@src/components/animationComponents/perspectiveText/Index';
import clsx from 'clsx';
import styles from '@src/components/dom/navbar/styles/menuButton.module.scss';
import useScroll from '@src/hooks/useScroll';
import { useRouter } from 'next/router';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '@src/store';

// What is under a point: a dark window (any [data-surface="dark"] element), or a masked grid
// ([data-surface="cells"], the Desk masthead) whose [data-cell] rects, placed in percent of the grid's box, are
// the dark cells; while the mask is faded out (the desktop hover reveal) the whole grid is dark.
// `moving` says the point is over a grid, whose cells keep moving.
function surfaceAt(x, y) {
  const hit = (box) => x >= box.left && x <= box.right && y >= box.top && y <= box.bottom;
  if (Array.prototype.some.call(document.querySelectorAll('[data-surface="dark"]'), (node) => hit(node.getBoundingClientRect()))) return { dark: true, moving: false };
  const grid = Array.prototype.find.call(document.querySelectorAll('[data-surface="cells"]'), (node) => hit(node.getBoundingClientRect()));
  if (!grid) return { dark: false, moving: false };
  const box = grid.getBoundingClientRect();
  const style = getComputedStyle(grid);
  if (style.visibility === 'hidden' || parseFloat(style.opacity) < 0.5) return { dark: true, moving: true };
  const part = (cell, name, size) => (parseFloat(cell.getAttribute(name)) / 100) * size;
  const dark = Array.prototype.some.call(grid.querySelectorAll('[data-cell]'), (cell) => {
    const left = box.left + part(cell, 'x', box.width);
    const top = box.top + part(cell, 'y', box.height);
    return hit({ left, top, right: left + part(cell, 'width', box.width), bottom: top + part(cell, 'height', box.height) });
  });
  return { dark, moving: true };
}

// True while the button's centre is over a dark surface, so the ink pill can switch to its light version
// instead of disappearing into the panel.
function useOverDark(ref) {
  const [overDark, setOverDark] = useState(false);
  const frame = useRef(0);
  const again = useRef(0);
  const check = useCallback(() => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const button = ref.current;
      if (!button) return;
      const box = button.getBoundingClientRect();
      const { dark, moving } = surfaceAt(box.left + box.width / 2, box.top + box.height / 2);
      setOverDark(dark);
      // the masthead's cells move on their own: look again while the button is over them
      clearTimeout(again.current);
      if (moving) again.current = setTimeout(check, 500);
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
      clearTimeout(again.current);
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
    <button
      ref={ref}
      type="button"
      id="menu-button"
      onClick={handleClick}
      aria-label="Open menu"
      aria-expanded={isMenuOpen}
      aria-controls="menu"
      className={clsx('p-xs', styles.button, overDark && styles.overDark)}
    >
      <PerspectiveText label="Menu" className={clsx('p-x', styles.label)} />
    </button>
  );
}

export default MenuButton;
