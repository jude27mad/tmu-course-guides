const ownedTouches = new WeakSet();
export const isBadgeTouch = (event) => ownedTouches.has(event);

// Input is attached to the real HTML badge window. The shared WebGL canvas
// must remain transparent to links, text selection, the menu and other pages.
export function bindBadgeDrag(element, { pick, grab }) {
  const doc = element.ownerDocument;
  const win = doc.defaultView;
  const link = element.closest('a');
  let gesture;
  let blockClick = false;
  let timer;

  const clearClick = () => {
    blockClick = false;
    win.clearTimeout(timer);
  };
  const skipClick = (event) => {
    if (!blockClick || !event.detail) return; // includes keyboard/AT activation
    clearClick();
    event.preventDefault();
    event.stopImmediatePropagation();
  };

  const finish = () => {
    if (!gesture) return;
    const { handle, id, type, listeners } = gesture;
    gesture = null;
    delete element.dataset.badgeDragging;
    if (handle) {
      handle.release();
      if (link) {
        blockClick = true;
        timer = win.setTimeout(clearClick, 750);
      }
    }
    if (type !== 'touch' && element.hasPointerCapture?.(id)) element.releasePointerCapture(id);
    listeners.abort();
  };

  function escape(event) {
    if (event.key === 'Escape') finish();
  }
  function visibility() {
    if (doc.hidden) finish();
  }
  function extraTouch(event) {
    if (event.touches.length > 1) finish();
  }
  function pointerEnd(event) {
    if (event.pointerId === gesture?.id) finish();
  }

  function move(x, y) {
    if (!gesture) return false;
    if (!gesture.handle) {
      const dx = Math.abs(x - gesture.x);
      const dy = Math.abs(y - gesture.y);
      const touch = gesture.type === 'touch';
      if (Math.hypot(dx, dy) < (touch ? 8 : 5)) return false;
      if (touch && dy >= dx) {
        finish();
        return false;
      }
      gesture.handle = grab(gesture.hit, x, y);
      if (!gesture.handle) {
        finish();
        return false;
      }
      element.dataset.badgeDragging = '';
      if (!touch) element.setPointerCapture?.(gesture.id);
    }
    gesture.handle.move(x, y);
    return true;
  }

  function pointerMove(event) {
    if (event.pointerId === gesture?.id && move(event.clientX, event.clientY)) event.preventDefault();
  }
  function start(type, id, x, y) {
    if (gesture) return;
    const hit = pick(x, y);
    if (!hit) return;
    const listeners = new win.AbortController();
    const options = { capture: true, signal: listeners.signal };
    gesture = { type, id, x, y, hit, handle: null, listeners };
    doc.addEventListener('keydown', escape, options);
    doc.addEventListener('visibilitychange', visibility, options);
    win.addEventListener('blur', finish, options);
    if (type === 'touch') {
      doc.addEventListener('touchstart', extraTouch, options);
    } else {
      doc.addEventListener('pointermove', pointerMove, options);
      doc.addEventListener('pointerup', pointerEnd, options);
      doc.addEventListener('pointercancel', pointerEnd, options);
    }
  }

  function pointerDown(event) {
    if (event.pointerType !== 'touch' && event.isPrimary && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
      start(event.pointerType, event.pointerId, event.clientX, event.clientY);
    }
  }
  const hover = (event) => {
    if (event.pointerType !== 'mouse' || gesture) return;
    element.toggleAttribute('data-badge-grabbable', !!pick(event.clientX, event.clientY));
  };
  const leave = () => element.removeAttribute('data-badge-grabbable');
  const stopNativeDrag = (event) => {
    if (gesture) event.preventDefault();
  };
  const touchStart = (event) => {
    if (event.touches.length !== 1) return;
    const finger = event.touches[0];
    start('touch', finger.identifier, finger.clientX, finger.clientY);
  };
  const touchMove = (event) => {
    if (gesture?.type !== 'touch' || event.touches.length !== 1) return;
    const finger = event.touches[0];
    if (finger.identifier !== gesture.id) return;
    if (!event.cancelable) {
      finish();
      return;
    }
    if (move(finger.clientX, finger.clientY)) {
      ownedTouches.add(event);
      event.preventDefault();
    }
  };
  const touchEnd = (event) => {
    if (gesture?.type !== 'touch') return;
    if (gesture.handle) ownedTouches.add(event); // Lenis can reuse its last delta on release.
    finish();
  };

  element.dataset.badgeDragReady = '';
  const bindings = [
    [element, 'pointerdown', pointerDown],
    [element, 'pointermove', hover],
    [element, 'pointerleave', leave],
    [element, 'lostpointercapture', pointerEnd],
    [element, 'touchstart', touchStart],
    [element, 'touchend', touchEnd],
    [element, 'touchcancel', touchEnd],
    [link || element, 'dragstart', stopNativeDrag],
    [link || element, 'click', skipClick],
    [link || element, 'pointerdown', clearClick],
    [link || element, 'touchstart', clearClick],
  ];
  bindings.forEach(([node, name, fn]) => node.addEventListener(name, fn, true));
  element.addEventListener('touchmove', touchMove, { capture: true, passive: false });
  return () => {
    finish();
    clearClick();
    leave();
    delete element.dataset.badgeDragReady;
    element.removeEventListener('touchmove', touchMove, true);
    bindings.forEach(([node, name, fn]) => node.removeEventListener(name, fn, true));
  };
}
