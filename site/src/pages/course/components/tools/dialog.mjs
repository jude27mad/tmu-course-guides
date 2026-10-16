const OPEN_EVENT = 'open-guide-tools';

export function openGuideTools(doc = globalThis.document) {
  doc?.dispatchEvent(new Event(OPEN_EVENT));
}

// Native dialog owns the top layer, focus trap and Escape key. Keep only the
// page's scroll/focus lifecycle here, so opening tools never moves the page.
export function bindGuideTools(dialog, { getLenis = () => null } = {}) {
  if (!dialog) return () => {};
  const doc = dialog.ownerDocument;
  const main = doc.querySelector('main');
  const closeButton = dialog.querySelector('[data-close-tools]');
  let active = false;
  let opener = null;
  let lenis = null;
  let wasStopped = false;
  let overflow = '';
  let overflowPriority = '';
  let backdropDown = false;

  const release = (restoreFocus = true) => {
    if (!active) return;
    active = false;
    if (main) {
      if (overflow) main.style.setProperty('overflow', overflow, overflowPriority);
      else main.style.removeProperty('overflow');
    }
    if (lenis && !wasStopped) lenis.start();
    lenis = null;
    if (restoreFocus && opener?.isConnected) opener.focus({ preventScroll: true });
    opener = null;
    backdropDown = false;
  };

  const open = () => {
    if (dialog.open) return;
    opener = doc.activeElement;
    dialog.showModal();
    active = true;
    if (main) {
      overflow = main.style.getPropertyValue('overflow');
      overflowPriority = main.style.getPropertyPriority('overflow');
      main.style.setProperty('overflow', 'hidden');
    }
    lenis = getLenis();
    wasStopped = !!lenis?.isStopped;
    if (lenis && !wasStopped) lenis.stop();
    closeButton?.focus({ preventScroll: true });
  };

  const close = () => {
    if (dialog.open) dialog.close();
    release();
  };
  const onClose = () => {
    // A native close event may arrive after the dialog has already reopened.
    if (!dialog.open) release();
  };
  const onHash = (event) => {
    if (!['guide-tools', 'math-tools'].includes(event.detail?.id)) return;
    event.preventDefault();
    open();
  };
  const outside = (event) => {
    if (event.target !== dialog) return false;
    const box = dialog.getBoundingClientRect();
    return event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom;
  };
  const onPointerDown = (event) => { backdropDown = outside(event); };
  const onClick = (event) => {
    if (backdropDown && outside(event)) close();
    backdropDown = false;
  };
  const onPointerCancel = () => { backdropDown = false; };
  const bindings = [
    [doc, OPEN_EVENT, open],
    [doc, 'guide-hash', onHash],
    [dialog, 'close', onClose],
    [dialog, 'pointerdown', onPointerDown],
    [dialog, 'pointercancel', onPointerCancel],
    [dialog, 'click', onClick],
    [closeButton, 'click', close],
  ];
  bindings.forEach(([target, type, handler]) => target?.addEventListener(type, handler));
  return () => {
    bindings.forEach(([target, type, handler]) => target?.removeEventListener(type, handler));
    if (dialog.open) dialog.close();
    release(false);
  };
}
