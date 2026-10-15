import { Environment, PerspectiveCamera, View } from '@react-three/drei';

import FloatRigidBody from '@src/pages/components/home/components/floatingMeshes/FloatRigidBody';
import { Physics } from '@react-three/rapier';
import useIsMobile from '@src/hooks/useIsMobile';
import { withBasePath } from '@src/utils/basePath';

// `active`: the hero is on screen and motion is on (physics steps, spheres
// drift, accents cycle). `near`: the window is close enough to need the glass
// spheres' transmission pass; off screen it is skipped.
export default function Index({ active = true, near = true }) {
  const isMobile = useIsMobile();

  return (
    <View style={{ position: 'relative', display: 'block', backgroundColor: 'transparent', borderRadius: '1.3888888889vw', height: '100%', width: '100%' }}>
      <PerspectiveCamera makeDefault position={[0, 0, 20]} fov={20} />
      <Physics paused={!active} interpolate timeStep={1 / 60} gravity={[0, 0, 0]}>
        <FloatRigidBody key={isMobile ? 'phone' : 'desktop'} active={active} near={near} isMobile={isMobile} transparentCount={isMobile ? 3 : 5} totalCount={isMobile ? 12 : 18} />
      </Physics>
      {/* the CC0 warehouse HDR, shared with the MagicBall (decision 6) */}
      <Environment files={withBasePath('/other/warehouse.hdr')} blur={1} />
    </View>
  );
}
