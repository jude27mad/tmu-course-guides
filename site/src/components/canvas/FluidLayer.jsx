import { EffectComposer } from '@react-three/postprocessing';
import Fluid from '@src/components/canvas/fluid/Fluid';

// The pointer fluid and its composer, loaded together after the page is usable (_app). The composer
// collects its effects when it mounts, so the fluid has to arrive with it, not a moment later.
export default function FluidLayer({ fluidColor, mainRef }) {
  return (
    // The composer's own scene is empty (the fluid draws into its own buffers), so it needs no
    // multisampling or depth buffer.
    <EffectComposer multisampling={0} depthBuffer={false}>
      <Fluid fluidColor={fluidColor} mainRef={mainRef} />
    </EffectComposer>
  );
}
