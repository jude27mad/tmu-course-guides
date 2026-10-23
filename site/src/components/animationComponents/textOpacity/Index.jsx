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
    splitted.words.forEach((word) => gsap.set(word, { opacity: 0 }));

    gsap.fromTo(
      splitted.words,
      {
        'will-change': 'opacity, transform',
        z: () => gsap.utils.random(500, 950),
        opacity: 0,
        xPercent: () => gsap.utils.random(-100, 100),
        yPercent: () => gsap.utils.random(-10, 10),
        rotationX: () => gsap.utils.random(-90, 90),
      },
      {
        ease: 'expo',
        opacity: 1,
        rotationX: 0,
        rotationY: 0,
        xPercent: 0,
        yPercent: 0,
        z: 0,
        scrollTrigger: {
          trigger: scrollTrigger,
          start: 'top top',
          end: 'bottom bottom',
          scrub: true,
          scroller: scrollRoot(),
          invalidateOnRefresh: true,
        },
        stagger: {
          each: 0.006,
          from: 'random',
        },
      },
    );
  };

  useIsomorphicLayoutEffect(() => {
    // Motion off: the sentence is simply shown (no scroll-driven fly-in).
    if (still) return undefined;
    const element = containerRef.current;
    const ctx = gsap.context(() => {
      createTextOpacityAnimation(element, trigger);
    }, element);

    return () => {
      ctx.revert();
    };
  }, [trigger, still]);

  return (
    <div ref={containerRef} className={styles.title}>
      {children}
    </div>
  );
}

export default TextOpacity;
