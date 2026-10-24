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

// The error three.js throws, and the ones a failed context can leave behind ("WebGL: INVALID_...").
export const isContextError = (error) => /webgl/i.test(String((error && error.message) || error));

export function createWebGLSupport(getDocument = () => (typeof document === 'undefined' ? null : document)) {
  let supported = null; // null until probed; the probe runs once
  const listeners = new Set();

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

  return {
    // true when a WebGL 2 context can be created. Always false without a document (the server render),
    // which is not remembered.
    available() {
      if (supported !== null) return supported;
      const doc = getDocument();
      if (!doc) return false;
      supported = probe(doc);
      return supported;
    },
    // A canvas failed in a way that means the 3D layer cannot be trusted: every gate falls back.
    markUnavailable() {
      if (supported === false) return;
      supported = false;
      listeners.forEach((listener) => listener());
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export const webgl = createWebGLSupport();
