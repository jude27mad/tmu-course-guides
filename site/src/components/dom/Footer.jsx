import { scrollRoot } from '@src/utils/scrollRoot';
import { useMemo, useRef } from 'react';

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
  const triggerRef = useRef();
  const router = useRouter();
  const [isLoading] = useStore(useShallow((state) => [state.isLoading]));
  const courseId = courseIdFromPath(router.asPath);
  const courseLinks = useCourseLinks(courseId);
  const showCourseLinks = !['/', '/courses/', '/privacy/', '/updates/'].includes(pathKey(router.pathname));
  const refreshFooter = () => triggerRef.current?.refresh();

  useIsomorphicLayoutEffect(() => {
    if (still || isLoading) return undefined;
    const footer = footerRef.current;
    // CSS owns the footer's height throughout its lifetime. Resetting to auto
    // while rebuilding the animation used to clamp the scroll position, most
    // visibly after an iOS overlay or opening the credit on a phone.
    const context = gsap.context(() => {
      const uncover = gsap.fromTo(footer, { yPercent: -50 }, { yPercent: 0, ease: 'none', force3D: true, paused: true });
      triggerRef.current = ScrollTrigger.create({
        id: 'footerTrigger',
        // Measure the unmoving wrapper, not a translated section or a nested
        // section from the page above. Tall footers finish revealing before
        // their content scrolls past; short viewports still expose every link.
        trigger: footer.parentElement,
        start: 'top bottom',
        // Safari's visible viewport can be taller than 100svh. The reveal must
        // finish at the reachable end, including after toolbar/overlay changes.
        end: 'clamp(top top)',
        animation: uncover,
        scrub: true,
        scroller: scrollRoot(),
      });
    });
    // Refresh geometry in place for content, font, and real viewport changes.
    // Neither this nor a credit toggle tears down the reveal or its layout.
    const observer = new ResizeObserver(refreshFooter);
    observer.observe(footer);
    observer.observe(viewportRef.current);
    return () => {
      observer.disconnect();
      triggerRef.current = null;
      context.revert();
    };
  }, [isLoading, still]);

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
        <DesignCredit tone="dark" onToggle={refreshFooter} />
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
