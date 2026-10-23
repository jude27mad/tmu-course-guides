import { useCallback, useRef } from 'react';
import gsap from 'gsap';
import { useIsomorphicLayoutEffect } from '@src/hooks/useIsomorphicLayoutEffect';
import useStill from '@src/hooks/useStill';

// Decoration shared by course links and Work filter buttons. Routing, focus
// and selection semantics stay with their respective controls.
export default function useSelectionMotion(containerRef, selectionRef, value, selector) {
  const position = useRef(null);
  const still = useStill();
  const align = useCallback(
    (animate) => {
      const container = containerRef.current;
      const selection = selectionRef.current;
      const control = container?.querySelector(selector);
      if (!control || !selection) return;
      const next = { x: control.offsetLeft, y: control.offsetTop, width: control.offsetWidth, height: control.offsetHeight };
      const previous = position.current;
      gsap.killTweensOf(selection);
      if (!animate || still || !previous) gsap.set(selection, { ...next, opacity: 1 });
      else if (Math.abs(previous.y - next.y) > 1) {
        gsap.set(selection, { ...next, opacity: 0 });
        gsap.to(selection, { opacity: 1, duration: 0.12, ease: 'power2.out' });
      } else gsap.to(selection, { ...next, opacity: 1, duration: 0.2, ease: 'power2.out' });
      position.current = next;
      container.dataset.selectionReady = 'true';
    },
    [containerRef, selectionRef, selector, still],
  );

  useIsomorphicLayoutEffect(() => {
    align(true);
  }, [align, value]);
  useIsomorphicLayoutEffect(() => {
    let active = true;
    const container = containerRef.current;
    const selection = selectionRef.current;
    const resize = new ResizeObserver(() => align(false));
    resize.observe(container);
    container.querySelectorAll('a,button').forEach((control) => resize.observe(control));
    document.fonts?.ready.then(() => {
      if (active) align(false);
    });
    return () => {
      active = false;
      resize.disconnect();
      gsap.killTweensOf(selection);
    };
  }, [align, containerRef, selectionRef]);
}
