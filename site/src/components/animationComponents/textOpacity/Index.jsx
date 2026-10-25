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
    gsap.set(splitted.words, { opacity: 0 });

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
          id: 'companion-statement',
          trigger: scrollTrigger,
          // Reveal during entry, so the game never leads a blank pinned panel.
          start: 'top bottom',
          end: 'top top',
          scrub: 0.18,
          scroller: scrollRoot(),
          invalidateOnRefresh: true,
        },
        stagger: {
          each: 0.006,
          from: 'random',
        },
      },
    );
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
