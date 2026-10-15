import { useEffect, useRef, useState } from 'react';

import { ScrollTrigger } from 'gsap/dist/ScrollTrigger';
import { gsap } from 'gsap';
import clsx from 'clsx';
import useInView from '@src/hooks/useInView';
import useStill from '@src/hooks/useStill';
import { withBasePath } from '@src/utils/basePath';
import { artworkFor, FALLBACK_ARTWORK } from './artworks.mjs';
import { createPixelReveal } from './pixelReveal.mjs';
import styles from './courseArtwork.module.scss';

// The photograph is real HTML and is never hidden. Only the decorative canvas
// is enhanced, so SSR, no-JS, reduced motion and canvas failures stay readable.
export default function CourseArtwork({ courseId, className, priority = false, sizes = '(max-width: 800px) 100vw, 50vw' }) {
  const requested = artworkFor(courseId);
  const [failedSource, setFailedSource] = useState(null);
  const artwork = failedSource === requested.src ? FALLBACK_ARTWORK : requested;
  const rootRef = useRef(null);
  const imageRef = useRef(null);
  const canvasRef = useRef(null);
  const revealRef = useRef(null);
  const finishedSource = useRef(null);
  const inView = useInView(rootRef);
  const still = useStill();

  useEffect(() => {
    const reveal = createPixelReveal({
      image: imageRef.current,
      canvas: canvasRef.current,
      element: rootRef.current,
      gsap,
      ScrollTrigger,
      document,
      still: still || typeof IntersectionObserver === 'undefined' || finishedSource.current === artwork.src,
      active: inView,
      onComplete: () => {
        finishedSource.current = artwork.src;
      },
    });
    revealRef.current = reveal;
    return () => {
      reveal.destroy();
      revealRef.current = null;
    };
    // View changes pause/resume the existing timeline without recreating it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artwork.src, still]);

  useEffect(() => {
    revealRef.current?.setActive(inView);
  }, [inView]);

  return (
    <div ref={rootRef} className={clsx(styles.root, className)} style={{ '--artwork-position': artwork.position }} data-course-artwork={courseId || 'fallback'} aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imageRef}
        src={withBasePath(artwork.src)}
        srcSet={`${withBasePath(artwork.smallSrc)} 800w, ${withBasePath(artwork.src)} 1600w`}
        sizes={sizes}
        width={artwork.width}
        height={artwork.height}
        alt=""
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        onError={() => setFailedSource(requested.src)}
      />
      <canvas ref={canvasRef} aria-hidden="true" />
    </div>
  );
}
