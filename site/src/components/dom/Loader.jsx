import { nativeIOSScroll } from '@src/utils/scrollRoot';
import { useEffect, useRef } from 'react';
import clsx from 'clsx';
import gsap from 'gsap';
import { scrollToHash } from '@src/utils/scrollToHash';
import styles from '@src/components/dom/styles/loader.module.scss';
import { useRouter } from 'next/router';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '@src/store';
import { wantsSRGB } from '@src/utils/routes';

function Loader() {
  const [lenis, introOut, setIntroOut, setIsLoading, setIsAbout, still] = useStore(
    useShallow((state) => [state.lenis, state.introOut, state.setIntroOut, state.setIsLoading, state.setIsAbout, state.still]),
  );
  const root = useRef(null);
  const router = useRouter();

  // The app has started: the boot failsafe (_document) stands down, even while a background tab
  // holds the curtain's animation.
  useEffect(() => {
    document.documentElement.setAttribute('data-hydrated', '');
  }, []);

  useEffect(() => {
    if (introOut || !lenis) return undefined;
    setIsAbout(wantsSRGB(router.pathname));
    const main = document.querySelector('main');
    const layout = document.getElementById('layout');
    const reveal = () => {
      // Restores `js` if the boot failsafe (_document) dropped it before the app started.
      document.documentElement.classList.add('js');
      gsap.set(root.current, { autoAlpha: 0, display: 'none' });
      gsap.set(main, { willChange: 'auto', pointerEvents: 'auto' });
      if (nativeIOSScroll()) gsap.set(main, { clearProps: 'transform,transformOrigin' });
      setIntroOut(true);
      setIsLoading(false);
      lenis.start();
      scrollToHash({ immediate: true });
    };
    // Hydration and the scroller are ready. Fonts, photographs and 3D assets
    // can finish independently; none of them is a prerequisite for coursework.
    lenis.scrollTo(0, { force: true, immediate: true });
    gsap.set(layout, { height: '100%' });
    gsap.set(main, { height: 'auto', border: 'none', borderRadius: 0, scale: 1 });
    // After the failsafe has shown the page without JavaScript, arrive without the curtain.
    if (still || document.documentElement.hasAttribute('data-failsafe')) {
      gsap.set(main, { x: 0, opacity: 1 });
      gsap.set('header', { autoAlpha: 1 });
      reveal();
      return undefined;
    }
    const tl = gsap.timeline({ onComplete: reveal });
    tl.set(main, { x: '100%', opacity: 1, willChange: 'transform' })
      .set('header', { autoAlpha: 0 })
      .to(root.current, { x: '-100%', ease: 'power2.inOut', duration: 0.4 }, 0)
      .to(main, { x: 0, ease: 'power2.inOut', duration: 0.4 }, 0)
      .to('header', { autoAlpha: 1, ease: 'power2.out', duration: 0.2 }, 0.3);
    return () => tl.kill();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lenis, introOut, still]);

  return (
    <div id="loader" ref={root} className={clsx(styles.root, 'layout-block-inner')} aria-hidden={introOut}>
      <div className={styles.innerContainer}>
        <div className={styles.fullNameContainer}>
          <p className={clsx(styles.fullName, 'h2')}>{introOut ? 'Opening page…' : 'TMU Course Guides'}</p>
        </div>
        {!introOut && (
          <div className={styles.progressContainer}>
            <p className="p" role="status">
              Opening guide…
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default Loader;
