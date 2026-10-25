import { scrollRoot } from '@src/utils/scrollRoot';
import SplitType from 'split-type';
import gsap from 'gsap';
import styles from '@src/components/animationComponents/textOpacity/textOpacity.module.scss';
import { useIsomorphicLayoutEffect } from '@src/hooks/useIsomorphicLayoutEffect';
import { useRef } from 'react';
import useStill from '@src/hooks/useStill';

function TextOpacity({ children, trigger }) {
  const containerRef = useRef();
  const still = useStill();

  const createTextOpacityAnimation = (element, scrollTrigger) => {
    const splitted = new SplitType(element, { types: 'words' });
    const words = gsap.utils.shuffle([...splitted.words]);
    // Sample the original scattered poses once. Toolbar/viewport refreshes
    // should update the scroll range, not send each word to a new random pose.
    gsap.set(words, {
      willChange: 'opacity, transform',
      z: () => gsap.utils.random(500, 950),
      opacity: 0,
      xPercent: () => gsap.utils.random(-100, 100),
      yPercent: () => gsap.utils.random(-10, 10),
      rotationX: () => gsap.utils.random(-90, 90),
    });

    const timeline = gsap.timeline({
      scrollTrigger: {
        id: 'companion-statement',
        trigger: scrollTrigger,
        start: 'top bottom',
        end: 'bottom bottom',
        scrub: 0.2,
        scroller: scrollRoot(),
      },
    });
    // Show the words early, but let their 3D movement continue while the
    // statement is centred beside the game, across the existing short stage.
    timeline.to(words, { opacity: 1, duration: 0.25, ease: 'expo.out', stagger: 0.006 }, 0);
    timeline.to(words, { rotationX: 0, rotationY: 0, xPercent: 0, yPercent: 0, z: 0, duration: 1, ease: 'none', stagger: 0.006 }, 0);
    return splitted;
  };

  useIsomorphicLayoutEffect(() => {
    // Motion off: the sentence is simply shown (no scroll-driven fly-in).
    if (still) return undefined;
    const element = containerRef.current;
    let split;
    const ctx = gsap.context(() => {
      split = createTextOpacityAnimation(element, trigger);
    }, element);

    return () => {
      ctx.revert();
      split?.revert();
    };
  }, [trigger, still]);

  return (
    <div ref={containerRef} className={styles.title}>
      {children}
    </div>
  );
}

export default TextOpacity;
