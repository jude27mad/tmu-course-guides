import { nativeIOSScroll, scrollRoot, scrollTop } from '@src/utils/scrollRoot';
import { useMemo, useRef, useState } from 'react';

import DesignCredit from '@src/components/dom/DesignCredit';
import AppearTitle from '@src/components/animationComponents/appearTitle/Index';
import Link from 'next/link';
import LinkText from '@src/components/animationComponents/linkText/Index';
import { ScrollTrigger } from 'gsap/dist/ScrollTrigger';
import clsx from 'clsx';
import { courseIdFromPath, pathKey } from '@src/utils/routes';
import dynamic from 'next/dynamic';
import footerLinks from '@src/components/dom/navbar/constants/footerLinks';
import { getCourse } from '@src/lib';
import gsap from 'gsap';
import menuLinks from '@src/components/dom/navbar/constants/menuLinks';
import styles from '@src/components/dom/styles/footer.module.scss';
import useIsMobile from '@src/hooks/useIsMobile';
import useStill from '@src/hooks/useStill';
import { useIsomorphicLayoutEffect } from '@src/hooks/useIsomorphicLayoutEffect';
import { useRouter } from 'next/router';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '@src/store';
import { useWindowSize } from '@darkroom.engineering/hamo';

const GoTop = dynamic(() => import('@src/components/dom/GoTop'), { ssr: false });

// "Course links": the current course's own links on a course page; elsewhere
// the three course guides. Falls back to the official sources.
function useCourseLinks(courseId) {
  return useMemo(() => {
    if (courseId) {
      const links = (getCourse(courseId)?.links || []).filter((link) => link && link.href && link.label);
      if (links.length) return links.map((link) => ({ title: link.label, href: link.href, external: /^https?:/.test(link.href) }));
      return footerLinks.map((link) => ({ ...link, external: true }));
    }
    return menuLinks.filter((link) => ['/cen100/', '/mth140/', '/mth141/'].includes(link.href)).map((link) => ({ ...link, external: false }));
  }, [courseId]);
}

function Footer() {
  const isMobile = useIsMobile();
  const still = useStill();
  const footerRef = useRef();
  const viewportRef = useRef();
  const router = useRouter();
  const [isLoading] = useStore(useShallow((state) => [state.isLoading]));
  const windowSize = useWindowSize();
  // Measure the same stable 100svh used by the contained shell, including when
  // Safari scrolls the document. Toolbar-only changes to innerHeight must not
  // rebuild the reveal or temporarily collapse the page's scroll range.
  const [resizeHeight, setResizeHeight] = useState(0);
  const courseId = courseIdFromPath(router.asPath);
  const courseLinks = useCourseLinks(courseId);
  const showCourseLinks = !['/', '/courses/', '/privacy/', '/updates/'].includes(pathKey(router.pathname));
  const [creditOpen, setCreditOpen] = useState(false);
  const creditScrollRef = useRef(null);

  const toggleCredit = (open) => {
    if (open === creditOpen) return;
    if (!isMobile && !nativeIOSScroll() && !still) creditScrollRef.current = scrollTop();
    setCreditOpen(open);
  };

  useIsomorphicLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return undefined;
    // clientHeight excludes transforms applied during menu/page transitions.
    const measure = () => setResizeHeight(viewport.clientHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  useIsomorphicLayoutEffect(() => {
    const creditScroll = creditScrollRef.current;
    creditScrollRef.current = null;
    // Native credit disclosure must not rebuild an uncover transform or
    // temporarily collapse the scroller when motion is disabled.
    if (still || !resizeHeight) return undefined;
    const context = gsap.context(() => {
      if (!isLoading) {
        const setupFooterAnimation = () => {
          gsap.set(footerRef.current, { height: 'auto' });
          const allSections = document.querySelectorAll('#mainContainer section');
          if (allSections.length > 1) {
            const lastSection = allSections[allSections.length - 2];
            if (footerRef.current.offsetHeight <= resizeHeight) {
              gsap.set(footerRef.current, { yPercent: -50 });
              const uncover = gsap.timeline({ paused: true });
              gsap.set(footerRef.current, { height: '100.5svh' });
              uncover.to(footerRef.current, {
                yPercent: 0,
                ease: 'none',
              });
              ScrollTrigger.create({
                id: 'footerTrigger',
                trigger: lastSection,
                start: 'bottom bottom',
                end: '+=100%',
                animation: uncover,
                scrub: true,
                scroller: scrollRoot(),
              });
            } else {
              gsap.set(footerRef.current, { transform: 'translate(0%, 0%)', height: 'auto' });
            }
          }
        };

        setupFooterAnimation();
      }
    });
    if (creditScroll !== null) {
      // Reverting the reveal and measuring height:auto can clamp desktop scroll
      // at the end of the page. Restore it before paint, with Lenis in sync.
      ScrollTrigger.refresh();
      const { lenis } = useStore.getState();
      if (lenis) {
        lenis.resize();
        lenis.scrollTo(creditScroll, { immediate: true, force: true });
      } else {
        scrollRoot()?.scrollTo(0, creditScroll);
      }
      ScrollTrigger.update();
    }
    return () => context.revert();
  }, [isLoading, windowSize.width, resizeHeight, creditOpen, still]);

  return (
    <section ref={footerRef} className={clsx(styles.root, 'layout-grid-inner')} data-surface="dark">
      <span ref={viewportRef} className={styles.viewportMeasure} data-footer-viewport aria-hidden="true" />
      <div style={{ gridColumn: isMobile ? '1 / 3' : '1 / 5' }} className={styles.linksContainer}>
        <AppearTitle isFooter>
          <h2 className={clsx(styles.title, 'h6')}>Sitemap</h2>
          {menuLinks.map((link) => (
            <div key={link.title} className={styles.linkTextContainer}>
              <LinkText className={styles.linkText} title={link.title} href={link.href}>
                <span className="footer">{link.title}</span>
              </LinkText>
            </div>
          ))}
        </AppearTitle>
      </div>
      {showCourseLinks && (
        <div style={{ gridColumn: isMobile ? '3 / 7' : '5 / 9' }} className={styles.linksContainer}>
          <AppearTitle isFooter>
            <h2 className={clsx(styles.title, 'h6')}>Course links</h2>
            {courseLinks.map((link) => (
              <div key={link.href} className={styles.linkTextContainer}>
                <LinkText target={link.external} className={styles.linkText} title={link.title} href={link.href}>
                  <span className="footer">{link.title}</span>
                </LinkText>
              </div>
            ))}
          </AppearTitle>
        </div>
      )}
      <div className={clsx(styles.metaContainer, 'p-x')}>
        <p>
          Unofficial TMU course companion · Fall 2026 ·{' '}
          <Link scroll={false} href="/privacy/" className={styles.inlineLink}>
            Privacy
          </Link>
        </p>
        <DesignCredit tone="dark" onToggle={toggleCredit} />
      </div>

      <div className={styles.wordmark} aria-hidden="true">
        <span>GUIDES</span>
      </div>
      <div className={styles.goToTop}>
        <GoTop />
      </div>
    </section>
  );
}

export default Footer;
