import { useCallback } from 'react';

import PerspectiveText from '@src/components/animationComponents/perspectiveText/Index';
import clsx from 'clsx';
import styles from '@src/components/dom/navbar/styles/menuButton.module.scss';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '@src/store';

function MenuButton() {
  const [setIsMenuOpen, isMenuOpen] = useStore(useShallow((state) => [state.setIsMenuOpen, state.isMenuOpen]));

  const handleClick = useCallback(() => {
    if (!useStore.getState().isLoading) {
      setIsMenuOpen(true);
    }
  }, [setIsMenuOpen]);

  return (
    <button type="button" id="menu-button" onClick={handleClick} aria-label="Open menu" aria-expanded={isMenuOpen} aria-controls="menu" className={clsx('p-xs', styles.button)}>
      <PerspectiveText label="Menu" className={clsx('p-x', styles.label)} />
    </button>
  );
}

export default MenuButton;
