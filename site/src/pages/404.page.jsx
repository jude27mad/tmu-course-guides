import { DESK_TEXT } from '@src/lib';
import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/router';

// Unknown paths go to the Desk (the original pushed '/'; replace keeps Back working).
// Without JavaScript the page is a link to the Desk.
export default function Custom404() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/');
  }, [router]);

  return (
    <section className="layout-block-inner" style={{ minHeight: '100svh', backgroundColor: 'var(--white)', paddingTop: 'calc(var(--layout-columns-gap) * 6)' }}>
      <h1 className="h2">
        <Link href="/">{DESK_TEXT.heading}</Link>
      </h1>
    </section>
  );
}
