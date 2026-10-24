import { useSyncExternalStore } from 'react';

import { webgl } from '@src/utils/webgl.mjs';

// true when the 3D layer can run: this browser can create a WebGL context and no canvas has failed since;
// false when it cannot; null until the browser has been asked. The server render and the hydration pass see
// null, so the static HTML carries no canvas and a browser without WebGL never builds one (the same shape as
// useIsMobile); a browser with WebGL flips to true, and one without to false, right after hydration.
// Callers that only draw 3D treat null like false; callers that draw a stand-in wait for a real false.
const getServerSnapshot = () => null;

const useWebGL = () => useSyncExternalStore(webgl.subscribe, webgl.available, getServerSnapshot);

export default useWebGL;
