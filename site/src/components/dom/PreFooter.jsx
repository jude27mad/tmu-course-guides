import { useEffect, useRef, useState } from 'react';

import FruitNinja from '@src/components/dom/prefooter/Index';
import clsx from 'clsx';
import styles from '@src/components/dom/styles/preFooter.module.scss';
import useInView from '@src/hooks/useInView';
import useStill from '@src/hooks/useStill';

// Copy: the old Desk's static sentence (index.html) and lede.
function PreFooter() {
  const rootRef = useRef(null);
  // The 3D (and the Rapier physics download) start only when the section is
  // about a screen away, and the canvas only runs while it is on screen.
  const near = useInView(rootRef, { rootMargin: '100% 0px 100% 0px' });
  const visible = useInView(rootRef);
  const still = useStill();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (near && !still) setMounted(true);
  }, [near, still]);

  return (
    <section ref={rootRef} className={clsx(styles.root, 'layout-block-inner')}>
      <div className={styles.textsContainer}>
        <div>
          <h2 className={clsx('h1', styles.lines)}>
            <span>Open a course guide below</span>
            <span>for every deadline,</span>
            <span>requirement and checklist.</span>
          </h2>
        </div>
        <div>
          <p className="h6">Progress stays in this browser.</p>
        </div>
      </div>

      <div className={styles.canvas} aria-hidden="true">
        {mounted && <FruitNinja active={visible && !still} />}
      </div>
    </section>
  );
}

export default PreFooter;
