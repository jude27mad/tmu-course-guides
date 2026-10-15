import clsx from 'clsx';
import styles from '@src/components/animationComponents/appearByWords/appearByWords.module.scss';
import useIntersected from '@src/hooks/useIntersected';
import { useRef } from 'react';
import useSplitAnimation from '@src/hooks/useSplitAnimation';
import useStill from '@src/hooks/useStill';

// Splits the title into characters (SplitType) and reveals them in sequence.
// The split copy is aria-hidden; screen readers get the plain text beside it
// (the original hid section titles from them entirely).
function AppearByWords({ children }) {
  const animationContainerRef = useRef();
  const seen = useIntersected(animationContainerRef);
  const still = useStill();
  useSplitAnimation(animationContainerRef, styles);

  return (
    <>
      <span className="sr-only">{children}</span>
      <span ref={animationContainerRef} className={clsx(styles.title, (seen || still) && styles.visible)} aria-hidden="true">
        {children}
      </span>
    </>
  );
}

export default AppearByWords;
