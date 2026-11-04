const OPEN_EVENT = 'open-guide-tools';

export function openGuideTools(doc = globalThis.document) {
  doc?.dispatchEvent(new Event(OPEN_EVENT));
}

// Native dialog owns the top layer, background inertness and Escape key.
// Keep the page still and cycle Tab inside the dialog rather than browser chrome.
// Shared by Guide tools and the Grades mark sheet: { open(opener?), close(), setOpener(el), unbind() }.
// `initialFocus(dialog)` names the element to focus on opening (default: the close button).
export function bindModal(dialog, { closeSelector = '[data-close-tools]', initialFocus, getLenis = () => null, animate = (_opening, complete) => complete() } = {}) {
  const none = { open() {}, close() {}, setOpener() {}, unbind() {} };
  if (!dialog) return none;
  const doc = dialog.ownerDocument;
  const main = doc.querySelector('main');
  const closeButton = dialog.querySelector(closeSelector);
  let active = false;
  let opener = null;
  let lenis = null;
  let wasStopped = false;
  let overflow = '';
  let overflowPriority = '';
  let backdropDown = false;
  let phase = 'closed';
  let generation = 0;
  let cancelAnimation;

  const transition = (opening, complete) => {
    const current = ++generation;
    cancelAnimation?.();
    phase = opening ? 'opening' : 'closing';
    cancelAnimation = animate(opening, () => {
      if (current !== generation) return;
      phase = opening ? 'open' : 'closed';
      complete?.();
    });
  };

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

  const open = (from) => {
    if (dialog.open) {
      if (phase === 'closing') transition(true);
      return;
    }
    opener = from || doc.activeElement;
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
    (initialFocus?.(dialog) || closeButton)?.focus({ preventScroll: true });
    transition(true);
  };

  const close = () => {
    if (!dialog.open || phase === 'closing') return;
    transition(false, () => {
      dialog.close();
      release();
    });
  };
  const onCancel = (event) => {
    event.preventDefault();
    close();
  };
  const onClose = () => {
    // A native close event may arrive after the dialog has already reopened.
    if (!dialog.open) release();
  };
  const outside = (event) => {
    if (event.target !== dialog) return false;
    const box = dialog.getBoundingClientRect();
    return event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom;
  };
  const onPointerDown = (event) => {
    backdropDown = outside(event);
  };
  const onClick = (event) => {
    if (backdropDown && outside(event)) close();
    backdropDown = false;
  };
  const onPointerCancel = () => {
    backdropDown = false;
  };
  const onKeyDown = (event) => {
    if (event.key !== 'Tab' || !dialog.open) return;
    const controls = [...dialog.querySelectorAll('a[href], button, input, select, textarea, [tabindex]')].filter(
      (element) => element.tabIndex >= 0 && !element.matches(':disabled') && element.getClientRects().length > 0,
    );
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (!first) {
      event.preventDefault();
      return;
    }
    if (event.shiftKey && doc.activeElement === first) {
      event.preventDefault();
      last.focus({ preventScroll: true });
    } else if (!event.shiftKey && doc.activeElement === last) {
      event.preventDefault();
      first.focus({ preventScroll: true });
    }
  };
  const bindings = [
    [dialog, 'close', onClose],
    [dialog, 'cancel', onCancel],
    [dialog, 'keydown', onKeyDown],
    [dialog, 'pointerdown', onPointerDown],
    [dialog, 'pointercancel', onPointerCancel],
    [dialog, 'click', onClick],
    [closeButton, 'click', close],
  ];
  bindings.forEach(([target, type, handler]) => target?.addEventListener(type, handler));
  return {
    open,
    close,
    // Focus returns here on closing (the mark sheet's Next moves it to the item shown last).
    setOpener: (element) => {
      if (element) opener = element;
    },
    unbind: () => {
      generation += 1;
      cancelAnimation?.();
      bindings.forEach(([target, type, handler]) => target?.removeEventListener(type, handler));
      if (dialog.open) dialog.close();
      release(false);
    },
  };
}

// Guide tools: the shared modal, opened by the header action and the guide-tools / math-tools hashes.
export function bindGuideTools(dialog, options = {}) {
  if (!dialog) return () => {};
  const modal = bindModal(dialog, { ...options, closeSelector: '[data-close-tools]' });
  const doc = dialog.ownerDocument;
  const open = () => modal.open();
  const onHash = (event) => {
    if (!['guide-tools', 'math-tools'].includes(event.detail?.id)) return;
    event.preventDefault();
    modal.open();
  };
  doc.addEventListener(OPEN_EVENT, open);
  doc.addEventListener('guide-hash', onHash);
  return () => {
    doc.removeEventListener(OPEN_EVENT, open);
    doc.removeEventListener('guide-hash', onHash);
    modal.unbind();
  };
}
