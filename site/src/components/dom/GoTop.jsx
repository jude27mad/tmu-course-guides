import { useCallback, useRef } from 'react';

import Arrow from '@src/components/imageComponents/Arrow';
import gsap from 'gsap';
import styles from '@src/components/dom/styles/footer.module.scss';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '@src/store';

function GoTop() {
  const buttonRef = useRef(null);
  const spanRef = useRef(null);
  const relsRef = useRef({ relX: 0, relY: 0 });
  const [lenis, still] = useStore(useShallow((state) => [state.lenis, state.still]));

  const scrollToTop = useCallback(() => {
    if (!lenis) return;
    lenis.scrollTo(0, {
      duration: 1.5,
      force: true,
      immediate: still,
      easing: (t) => Math.min(1, 1.001 - 2 ** (-10 * t)),
      onComplete: () => {
        lenis.start();
      },
    });
    // keyboard users land back at the top of the page
    const skipTarget = document.querySelector('main');
    if (skipTarget) skipTarget.focus({ preventScroll: true });
  }, [lenis, still]);

  const handleMouseEnter = useCallback((e) => {
    if (e.pointerType === 'touch') return;
    const button = buttonRef.current;
    const span = spanRef.current;
    const { clientY } = e;
    const parentOffset = button.getBoundingClientRect();
    const isTop = clientY < parentOffset.top + parentOffset.height / 2;
    const relX = ((e.clientX - parentOffset.left) / parentOffset.width) * 100;
    const relY = isTop ? 0 : 100;

    relsRef.current = { relX, relY };

    gsap.context(() => {
      gsap.set(span, { top: `${relY}%`, left: `${relX}%` });

      gsap.to(span, {
        duration: 0.6,
        ease: 'cubic-bezier(.4,0,.1,1)',
      });
    });
  }, []);

  const handleMouseLeave = useCallback((e) => {
    if (e.pointerType === 'touch') return;
    const span = spanRef.current;
    const { relX, relY } = relsRef.current;

    gsap.context(() => {
      gsap.to(span, {
        duration: 0.6,
        top: `${relY}%`,
        left: `${relX}%`,
        ease: 'cubic-bezier(.4,0,.1,1)',
      });
    });
  }, []);

  return (
    <button type="button" ref={buttonRef} aria-label="Back to top" onClick={scrollToTop} onPointerEnter={handleMouseEnter} onPointerLeave={handleMouseLeave} className={styles.circleButton}>
      <Arrow className={styles.arrowClassic} />
      <span className={styles.ball} ref={spanRef} />
    </button>
  );
}

export default GoTop;
