import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import useDelayedFeedback from '@src/hooks/useDelayedFeedback';
import styles from './styles/navigationFeedback.module.scss';

// Report a real wait for Next's route request, not the cosmetic route entrance.
// Fast requests stay quiet; an error still exposes its retry immediately.
export default function NavigationFeedback() {
  const router = useRouter();
  const [pending, setPending] = useState(null);
  const [error, setError] = useState(false);
  const target = useRef(null);
  useEffect(() => {
    const start = (url) => {
      target.current = url;
      setError(false);
      setPending(url);
    };
    const complete = (url) => {
      if (target.current === url) setPending(null);
    };
    const failed = (reason, url) => {
      if (target.current !== url) return;
      setPending(null);
      setError(!reason.cancelled);
    };
    // Next rejects the render of a page change that a newer one replaced. Its
    // Back/Forward handler (router.onPopState) leaves that rejection unhandled,
    // so two quick Back presses raised an error. It is a successful
    // interruption, as routeChangeError's `cancelled` above, not a page error.
    const interrupted = (event) => {
      if (event.reason?.cancelled) event.preventDefault();
    };
    router.events.on('routeChangeStart', start);
    router.events.on('routeChangeComplete', complete);
    router.events.on('routeChangeError', failed);
    window.addEventListener('unhandledrejection', interrupted);
    return () => {
      router.events.off('routeChangeStart', start);
      router.events.off('routeChangeComplete', complete);
      router.events.off('routeChangeError', failed);
      window.removeEventListener('unhandledrejection', interrupted);
    };
  }, [router.events]);
  const busy = useDelayedFeedback(pending);
  return (
    <div className={styles.status} role="status" data-navigation-status hidden={!busy && !error}>
      <span>{error ? 'Page could not open.' : 'Opening page…'}</span>
      {error && <a href={target.current}>Try again</a>}
    </div>
  );
}
