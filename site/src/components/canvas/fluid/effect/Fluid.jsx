import { forwardRef, useState } from 'react';

import FluidEffect from '@src/components/canvas/fluid/effect/FluidEffect';
import { useIsomorphicLayoutEffect } from '@src/hooks/useIsomorphicLayoutEffect';

const FluidEffectWrapper = forwardRef((props, ref) => {
  const { intensity, fluidColor, backgroundColor, edge, tFluid } = props;
  // One effect for the wrapper's lifetime. tFluid alternates between the two density buffers from one render
  // of Fluid to the next, and rebuilding for it disposed the effect that the composer's pass kept drawing
  // with (the pass collects its effects only when its own children change). The colours and intensity are
  // read from `state` every frame (FluidEffect.update), so they change in place.
  const [effect] = useState(() => new FluidEffect({ intensity, fluidColor, backgroundColor, edge, tFluid }));

  useIsomorphicLayoutEffect(() => {
    Object.assign(effect.state, { intensity, fluidColor, backgroundColor, edge });
  }, [effect, intensity, fluidColor, backgroundColor, edge]);

  useIsomorphicLayoutEffect(() => () => effect.dispose(), [effect]);

  return <primitive ref={ref} object={effect} />;
});

FluidEffectWrapper.defaultProps = {
  intensity: 1.0,
  fluidColor: '#ffffff',
  backgroundColor: '#000000',
  edge: 0,
};

export default FluidEffectWrapper;
