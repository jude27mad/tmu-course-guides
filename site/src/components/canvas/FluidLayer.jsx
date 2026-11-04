import { EffectComposer } from '@react-three/postprocessing';
import Fluid from '@src/components/canvas/fluid/Fluid';

// The pointer fluid and its composer, loaded together after the page is usable (_app). The composer
// collects its effects when it mounts, so the fluid has to arrive with it, not a moment later.
export default function FluidLayer({ fluidColor, mainRef }) {
  return (
    <EffectComposer>
      <Fluid fluidColor={fluidColor} mainRef={mainRef} />
    </EffectComposer>
  );
}
