import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { useStore } from '@src/store';
import styles from './styles/navigationFeedback.module.scss';

// Route events start before Next downloads a missing page chunk. The curtain
// starts later, so it cannot acknowledge a tap during that network wait.
export default function NavigationFeedback() {
  const router = useRouter();
  const transitioning = useStore((state) => state.isTransitioning);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const target = useRef(null);
  useEffect(() => {
    const start = (url) => {
      target.current = url;
      setError(false);
      setPending(true);
    };
    const complete = (url) => {
      if (target.current === url) setPending(false);
    };
    const failed = (reason, url) => {
      if (target.current !== url) return;
      setPending(false);
      setError(!reason.cancelled);
    };
    router.events.on('routeChangeStart', start);
    router.events.on('routeChangeComplete', complete);
    router.events.on('routeChangeError', failed);
    return () => {
      router.events.off('routeChangeStart', start);
      router.events.off('routeChangeComplete', complete);
      router.events.off('routeChangeError', failed);
    };
  }, [router.events]);
  const busy = pending || transitioning;
  return (
    <div className={styles.status} role="status" data-navigation-status hidden={!busy && !error}>
      <span>{error ? 'Page could not open.' : 'Opening page…'}</span>
      {error && <a href={target.current}>Try again</a>}
    </div>
  );
}
