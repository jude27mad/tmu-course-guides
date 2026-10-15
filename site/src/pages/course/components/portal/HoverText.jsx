import Portal from '@src/pages/course/components/portal/Portal';
import clsx from 'clsx';

// The original hover text (Services / Process): fixed bottom-right, difference
// blended, fading in and out through the Portal. Desktop pointers only.
function HoverText({ portals, className, textClassName }) {
  return portals.map((portal) => (
    <Portal fadeIn={portal.fadeIn} key={portal.key}>
      <div className={clsx(className, portal.fadeIn ? 'fade-in' : 'fade-out')} aria-hidden="true">
        {portal.lines.map((line, index) => (
          // eslint-disable-next-line react/no-array-index-key
          <div key={index} className={clsx('p-l', textClassName)}>
            {line}
          </div>
        ))}
      </div>
    </Portal>
  ));
}

export default HoverText;

// Shared hover handlers: dim the page (the original `color-change`) while a mouse is
// over an option, and always undo it on leave or unmount (a tap never sends a
// leave, which left phones dimmed in the original).
export function dimPage(on, section) {
  const main = document.querySelector('main');
  if (on) {
    main?.classList.add('color-change');
    section?.classList.add('fill-change');
  } else {
    main?.classList.remove('color-change');
    section?.classList.remove('fill-change');
  }
}

export const showPortal = (setPortals, key, lines) =>
  setPortals((previous) => {
    const index = previous.findIndex((portal) => portal.key === key);
    if (index !== -1) {
      const next = [...previous];
      next[index] = { ...next[index], lines, fadeIn: true };
      return next;
    }
    return [...previous, { key, lines, fadeIn: true }];
  });

export const hidePortal = (setPortals, key) =>
  setPortals((previous) => {
    const index = previous.findIndex((portal) => portal.key === key);
    if (index === -1) return previous;
    const next = [...previous];
    next[index] = { ...next[index], fadeIn: false };
    return next;
  });
