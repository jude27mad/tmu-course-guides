import { useSyncExternalStore } from 'react';

import { webgl } from '@src/utils/webgl.mjs';

// true when the 3D layer can run: this browser can create a WebGL context and no canvas has failed since;
// false when it cannot. null only during the server render and the hydration pass, so the static HTML carries
// no canvas and a browser without WebGL never builds one (the same shape as useIsMobile); right after
// hydration it becomes true or false, and a component that first mounts later (the Desk after a client-side
// navigation) gets true or false from its first render. Callers that only draw 3D treat null like false;
// callers that draw a stand-in wait for a real false, so a WebGL browser never flashes the stand-in.
const getServerSnapshot = () => null;

const useWebGL = () => useSyncExternalStore(webgl.subscribe, webgl.available, getServerSnapshot);

export default useWebGL;
