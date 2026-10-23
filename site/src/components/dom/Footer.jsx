import { useEffect, useMemo, useRef, useState } from 'react';

import AppearTitle from '@src/components/animationComponents/appearTitle/Index';
import Link from 'next/link';
import LinkText from '@src/components/animationComponents/linkText/Index';
import { ScrollTrigger } from 'gsap/dist/ScrollTrigger';
import clsx from 'clsx';
import { courseIdFromPath } from '@src/utils/routes';
import dynamic from 'next/dynamic';
import footerLinks from '@src/components/dom/navbar/constants/footerLinks';
import { getCourse } from '@src/lib';
import gsap from 'gsap';
import menuLinks from '@src/components/dom/navbar/constants/menuLinks';
import { nextAcrossCourses } from '@src/utils/upcoming';
import styles from '@src/components/dom/styles/footer.module.scss';
import useInView from '@src/hooks/useInView';
import useIsMobile from '@src/hooks/useIsMobile';
import { useIsomorphicLayoutEffect } from '@src/hooks/useIsomorphicLayoutEffect';
import { useNow } from '@src/lib/react';
import { useRouter } from 'next/router';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '@src/store';
import { useWindowSize } from '@darkroom.engineering/hamo';

const Time = dynamic(() => import('@src/components/dom/Time'), { ssr: false });
const GoTop = dynamic(() => import('@src/components/dom/GoTop'), { ssr: false });

const CREDIT_URL = 'https://giats.me';

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
  const footerRef = useRef();
  const router = useRouter();
  const [isLoading] = useStore(useShallow((state) => [state.isLoading]));
  const windowSize = useWindowSize();
  const courseId = courseIdFromPath(router.asPath);
  const courseLinks = useCourseLinks(courseId);
  const now = useNow(60000);
  const inView = useInView(footerRef, { rootMargin: '25% 0px' });
  const [next, setNext] = useState(undefined); // undefined = not computed yet (static HTML)

  // Next deadline: on the minute, on route changes, whenever the footer comes into
  // view (progress may have changed on the page above) and on other tabs' saves.
  useEffect(() => {
    if (!now) return;
    setNext(nextAcrossCourses({ now: new Date(), courseId: courseId || undefined }));
  }, [now, courseId, inView]);

  useEffect(() => {
    const onStorage = () => setNext(nextAcrossCourses({ now: new Date(), courseId: courseId || undefined }));
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [courseId]);

  useIsomorphicLayoutEffect(() => {
    if (!isLoading) {
      const setupFooterAnimation = () => {
        gsap.set(footerRef.current, { height: 'auto' });
        const allSections = document.querySelectorAll('#mainContainer section');
        if (allSections.length > 1) {
          const lastSection = allSections[allSections.length - 2];
          if (footerRef.current.offsetHeight <= windowSize.height) {
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
              scroller: document?.querySelector('main'),
            });
          } else {
            gsap.set(footerRef.current, { transform: 'translate(0%, 0%)', height: 'auto' });
          }
        }
      };

      setupFooterAnimation(footerRef, windowSize);
    }

    return () => {
      const footerTrigger = ScrollTrigger.getById('footerTrigger');
      if (footerTrigger) {
        footerTrigger.kill();
      }
    };
  }, [isLoading, windowSize.height]);

  let nextContent;
  if (next === undefined) {
    nextContent = (
      <Link scroll={false} href="/courses/">
        <span className={clsx(styles.email, 'h4')}>Open guide</span>
      </Link>
    );
  } else if (next) {
    nextContent = (
      <Link scroll={false} href={next.href} aria-label={`Next deadline: ${next.title}, ${next.code}, ${next.when}`}>
        <span className={clsx(styles.email, 'h4')}>{next.title}</span>
      </Link>
    );
  } else {
    nextContent = <span className={clsx(styles.email, 'h4')}>No upcoming deadlines</span>;
  }

  return (
    <section ref={footerRef} className={clsx(styles.root, 'layout-grid-inner')} data-surface="dark">
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
      <div className={styles.emailContaineer}>
        <AppearTitle isFooter>
          <h2 className={clsx(styles.workWithMe, 'h4')}>Next deadline:</h2>
          <div>
            <div className={styles.link}>
              {nextContent}
              {next && (
                <svg className={clsx(styles.linkGraphic)} width="300%" height="100%" viewBox="0 0 1200 60" preserveAspectRatio="none" aria-hidden="true">
                  <path d="M0,56.5c0,0,298.666,0,399.333,0C448.336,56.5,513.994,46,597,46c77.327,0,135,10.5,200.999,10.5c95.996,0,402.001,0,402.001,0" />
                </svg>
              )}
            </div>
            {next && <p className={clsx('p-x', styles.nextWhen)}>{[next.code, next.when].filter(Boolean).join(' · ')}</p>}
          </div>
        </AppearTitle>
      </div>

      <div className={styles.middleContainer} style={{ gridColumn: '1 / 9' }}>
        <AppearTitle isFooter>
          <div className="p-x">Toronto</div>
          <div className={clsx('p-x', styles.middleText)}>
            Current time: <Time />
          </div>
        </AppearTitle>
      </div>

      <div className={styles.middleContainer} style={{ gridColumn: '9 / 13' }}>
        <AppearTitle isFooter>
          <div className="p-x">Progress</div>
          <div className={clsx('p-x', styles.middleText)}>Saved only in this browser</div>
        </AppearTitle>
      </div>
      <div className={styles.middleContainer} style={{ gridColumn: '13 / 17', textAlign: isMobile ? 'left' : 'right' }}>
        <AppearTitle isFooter>
          <div className="p-x">
            Unofficial TMU course companion · Fall 2026 ·{' '}
            <Link scroll={false} href="/privacy/" className={styles.inlineLink}>
              Privacy
            </Link>
          </div>
          <div className={clsx('p-x', styles.middleText)}>
            Original portfolio design and development by Evangelos Giatsidis —{' '}
            <a href={CREDIT_URL} target="_blank" rel="noopener noreferrer" className={styles.inlineLink}>
              giats.me
            </a>
          </div>
        </AppearTitle>
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
