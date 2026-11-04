import clsx from 'clsx';
import { gsap } from 'gsap';
import styles from '@src/components/animationComponents/infiniteText/infiniteText.module.scss';
import { useIsomorphicLayoutEffect } from '@src/hooks/useIsomorphicLayoutEffect';
import { useRef } from 'react';
import useStill from '@src/hooks/useStill';

function InfiniteText({ text, length, className, hasStroke = true, paused = false }) {
  const containerRef = useRef();
  const tweenRef = useRef(null);
  const still = useStill();

  useIsomorphicLayoutEffect(() => {
    const container = containerRef.current;
    const containerWidth = container.getBoundingClientRect().width;
    const itemWidth = container.children[0].getBoundingClientRect().width;
    const initialOffset = ((2 * itemWidth) / containerWidth) * 100 * -1;

    gsap.set(container, {
      xPercent: `${initialOffset}`,
    });

    const duration = 5;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline();

      tl.to(container, {
        ease: 'none',
        duration,
        xPercent: 0,
        repeat: -1,
      });
      tweenRef.current = tl;
    }, containerRef);

    return () => ctx.kill();
  }, []);

  // Motion off: the marquee stands still. Off screen (`paused`), it waits where it is instead of
  // writing its transform every frame; the loop is seamless, so where it resumes cannot be seen.
  useIsomorphicLayoutEffect(() => {
    const tl = tweenRef.current;
    if (!tl) return;
    if (still || paused) tl.pause();
    else tl.play();
  }, [still, paused]);

  return (
    <div ref={containerRef} className={styles.root}>
      {Array.from({ length }, (_, index) => (
        <div key={`${index}-${text}`} className={clsx(styles.infiniteItem, index % 2 === 0 && hasStroke && styles.stroke, className)}>
          <span>{text}</span>
        </div>
      ))}
    </div>
  );
}

export default InfiniteText;
