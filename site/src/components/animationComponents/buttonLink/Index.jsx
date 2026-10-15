/* eslint-disable react/jsx-props-no-spreading */
import { forwardRef, useCallback, useRef } from 'react';

import Arrow from '@src/components/imageComponents/Arrow';
import Link from 'next/link';
import clsx from 'clsx';
import gsap from 'gsap';
import styles from '@src/components/animationComponents/buttonLink/buttonLink.module.scss';

// The original pill with the hover "ball". One element now: a link when `href` is
// given (new tab with `target`), otherwise a <button> calling `onClick`
// (SEARCH, MARK DONE, UNDO...). The original nested a <button> in an <a>.
const ButtonLink = forwardRef(({ href, label, target = false, onClick, ariaLabel, ariaHaspopup, ariaControls, ariaPressed, disabled = false, className, type = 'button', children }, ref) => {
  const buttonRef = useRef(null);
  const spanRef = useRef(null);
  const relsRef = useRef({ relX: 0, relY: 0 });

  const setRefs = useCallback(
    (node) => {
      buttonRef.current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) ref.current = node;
    },
    [ref],
  );

  const handleMouseEnter = useCallback((e) => {
    const button = buttonRef.current;
    const span = spanRef.current;
    if (!button || !span || e.pointerType === 'touch') return;

    const { clientY } = e;
    const parentOffset = button.getBoundingClientRect();
    const isTop = clientY < parentOffset.top + parentOffset.height / 2;
    const relX = ((e.clientX - parentOffset.left) / parentOffset.width) * 100;
    const relY = isTop ? 0 : 100;

    relsRef.current = { relX, relY };

    gsap.set(span, { top: `${relY}%`, left: `${relX}%` });
    gsap.to(span, {
      duration: 0.6,
      ease: 'cubic-bezier(.4,0,.1,1)',
    });
  }, []);

  const handleMouseLeave = useCallback((e) => {
    const span = spanRef.current;
    if (!span || e.pointerType === 'touch') return;

    const { relX, relY } = relsRef.current;
    gsap.to(span, {
      duration: 0.6,
      top: `${relY}%`,
      left: `${relX}%`,
      ease: 'cubic-bezier(.4,0,.1,1)',
    });
  }, []);

  const content = (
    <>
      <span className={clsx('p-x', styles.labelClassic)}>{children || label}</span>
      <Arrow className={styles.arrowClassic} />
      <span className={styles.ball} ref={spanRef} />
    </>
  );

  const shared = {
    ref: setRefs,
    className: clsx('p-xs', styles.btnPosnawr, className),
    onPointerEnter: handleMouseEnter,
    onPointerLeave: handleMouseLeave,
    'aria-label': ariaLabel,
  };

  if (href) {
    const external = /^https?:\/\//.test(href) || href.startsWith('mailto:');
    if (external) {
      return (
        <a {...shared} href={href} target={target ? '_blank' : undefined} rel={target ? 'noopener noreferrer' : undefined} onClick={onClick}>
          {content}
        </a>
      );
    }
    return (
      <Link {...shared} href={href} scroll={false} target={target ? '_blank' : undefined} rel={target ? 'noopener noreferrer' : undefined} onClick={onClick}>
        {content}
      </Link>
    );
  }

  return (
    // eslint-disable-next-line react/button-has-type
    <button {...shared} type={type} onClick={onClick} disabled={disabled} aria-haspopup={ariaHaspopup} aria-controls={ariaControls} aria-pressed={ariaPressed}>
      {content}
    </button>
  );
});

export default ButtonLink;
