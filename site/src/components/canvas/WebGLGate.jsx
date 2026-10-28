import { Component } from 'react';

import useWebGL from '@src/hooks/useWebGL';
import { webgl } from '@src/utils/webgl.mjs';

// Catches what a <Canvas> throws. R3F raises renderer-creation failures from its own layout effect and
// rethrows anything its scene throws, so without this the error reaches Next.js, which replaces the page
// with its "Application error" screen. What the error means for the other canvases is webgl.canvasFailed's
// call: WebGL itself failing, or any failure of a `critical` canvas, turns the whole layer off; any other
// error stays with its own canvas. That canvas tries again when a lost context comes back (a GPU reset can
// make a canvas throw while its context is gone).
class CanvasBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
    this.retry = this.retry.bind(this);
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidMount() {
    this.stopWatching = webgl.onRestored(this.retry);
  }

  componentDidCatch(error) {
    const { critical } = this.props;
    webgl.canvasFailed(error, { critical });
  }

  componentWillUnmount() {
    this.stopWatching();
  }

  retry() {
    const { failed } = this.state;
    if (failed) this.setState({ failed: false });
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
