import { Component } from 'react';

import useWebGL from '@src/hooks/useWebGL';
import { isContextError, webgl } from '@src/utils/webgl.mjs';

// Catches what a <Canvas> throws. R3F raises renderer-creation failures from its own layout effect and
// rethrows anything its scene throws, so without this the error reaches Next.js, which replaces the page
// with its "Application error" screen. A context error means WebGL itself failed: every other canvas
// falls back too (webgl.markUnavailable). Any other error stays with its own canvas, unless `critical`.
class CanvasBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    const { critical } = this.props;
    if (critical || isContextError(error)) webgl.markUnavailable();
  }

  render() {
    const { failed } = this.state;
    const { children, fallback } = this.props;
    return failed ? fallback : children;
  }
}

// Wraps every R3F <Canvas> on the site. It mounts the canvas only where WebGL works, and shows `fallback`
// (nothing, by default) where it does not or where the canvas fails. `critical`: the canvas other parts of the
// page draw into (the shared View.Port canvas), so any failure of it turns the whole 3D layer off.
function WebGLGate({ children, fallback = null, critical = false }) {
  const supported = useWebGL();
  if (!supported) return fallback;
  return (
    <CanvasBoundary fallback={fallback} critical={critical}>
      {children}
    </CanvasBoundary>
  );
}

export default WebGLGate;
