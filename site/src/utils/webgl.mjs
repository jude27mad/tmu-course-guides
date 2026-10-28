// Whether this browser can run the site's 3D layer. One answer, shared by every three.js canvas.
//
// three.js (r163 and later are WebGL 2 only) throws "Error creating WebGL context." when WebGL is turned
// off or blocked: a browser setting or enterprise policy, --disable-3d-apis, a blocklisted or crashed GPU.
// React Three Fiber raises it while it builds the renderer, nothing above the <Canvas> catches it, and Next.js
// replaces the whole page with "Application error: a client-side exception has occurred".
//
// The 3D layer is decoration (the background, the pointer fluid, the course badges, the pre-footer stickers),
// so each canvas mounts only when this says it can work (components/canvas/WebGLGate.jsx) and the page shows
// plain content in its place when it cannot.
//
// WebGL can also go away after the page has loaded (a GPU reset, a driver crash). three.js and R3F survive a
// lost context and carry on when the browser restores it, so a loss is only acted on when it lasts: a canvas
// still lost, and still on the page, `graceMs` after the loss turns the whole layer off, and a canvas that
// failed meanwhile is given another chance when a context comes back.

// The error three.js throws, and the ones a failed context can leave behind ("WebGL: INVALID_...").
export const isContextError = (error) => /webgl/i.test(String((error && error.message) || error));

export function createWebGLSupport(getDocument = () => (typeof document === 'undefined' ? null : document), { graceMs = 5000, setTimer = (callback, ms) => setTimeout(callback, ms), clearTimer = (id) => clearTimeout(id) } = {}) {
  let supported = null; // null until probed; the probe runs once
  const listeners = new Set();
  const restoredListeners = new Set();
  const lost = new Set(); // canvases whose context is lost right now
  let timer = null;
  let watching = false;

  const probe = (doc) => {
    let gl;
    try {
      gl = doc.createElement('canvas').getContext('webgl2');
      // a context that is already lost (the GPU is gone) is as good as none
      if (!gl || (gl.isContextLost && gl.isContextLost())) return false;
    } catch (error) {
      return false;
    }
    try {
      // give the context back at once: browsers keep only a handful alive
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    } catch (error) {
      // it was created; failing to release it does not make WebGL unavailable
    }
    return true;
  };

  const markUnavailable = () => {
    if (supported === false) return;
    supported = false;
    listeners.forEach((listener) => listener());
  };

  // A canvas that React took down on purpose loses its context too (R3F releases it); only a canvas that is
  // still on the page and still lost counts.
  const stillLost = (canvas) => {
    try {
      if (!canvas.isConnected) return false;
      const gl = canvas.getContext('webgl2');
      return !!gl && gl.isContextLost();
    } catch (error) {
      return false;
    }
  };

  const settle = () => {
    timer = null;
    if ([...lost].some(stillLost)) markUnavailable();
  };

  // The events do not bubble, but the capture phase sees them on their way down to the canvas.
  const watch = (doc) => {
    if (watching || !doc.addEventListener) return;
    watching = true;
    doc.addEventListener(
      'webglcontextlost',
      (event) => {
        lost.add(event.target);
        if (timer === null) timer = setTimer(settle, graceMs);
      },
      true,
    );
    doc.addEventListener(
      'webglcontextrestored',
      (event) => {
        lost.delete(event.target);
        if (!lost.size && timer !== null) {
          clearTimer(timer);
          timer = null;
        }
        restoredListeners.forEach((listener) => listener());
      },
      true,
    );
  };

  return {
    // true when a WebGL 2 context can be created. Always false without a document (the server render),
    // which is not remembered.
    available() {
      if (supported !== null) return supported;
      const doc = getDocument();
      if (!doc) return false;
      supported = probe(doc);
      if (supported) watch(doc);
      return supported;
    },
    // A canvas failed in a way that means the 3D layer cannot be trusted: every gate falls back.
    markUnavailable,
    // What a canvas's error means for the layer: WebGL itself failing, or any failure of a `critical` canvas
    // (the one the others draw into), turns it off; any other error stays with its own canvas.
    canvasFailed(error, { critical = false } = {}) {
      if (critical || isContextError(error)) markUnavailable();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    // A context came back after a loss: a canvas that failed meanwhile may try again.
    onRestored(listener) {
      restoredListeners.add(listener);
      return () => restoredListeners.delete(listener);
    },
  };
}

export const webgl = createWebGLSupport();
