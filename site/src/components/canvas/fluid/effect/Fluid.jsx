import { forwardRef, useMemo } from 'react';

import FluidEffect from '@src/components/canvas/fluid/effect/FluidEffect';
import { useIsomorphicLayoutEffect } from '@src/hooks/useIsomorphicLayoutEffect';

const FluidEffectWrapper = forwardRef((props, ref) => {
  // ⚡ Bolt Optimization:
  // Avoid JSON.stringify on props that contain Three.js objects (like Texture in tFluid)
  // as it is extremely expensive and blocks the main thread during render.
  // We destructure primitive/stable values instead.
  const { tFluid, intensity, fluidColor, backgroundColor, showBackground } = props;
  const effect = useMemo(
    () => new FluidEffect(props),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tFluid, intensity, fluidColor, backgroundColor, showBackground],
  );

  useIsomorphicLayoutEffect(
    () => () => {
      if (effect) effect.dispose();
    },
    [effect],
  );

  return <primitive ref={ref} object={effect} />;
});

FluidEffectWrapper.defaultProps = {
  intensity: 1.0,
  fluidColor: '#ffffff',
  backgroundColor: '#000000',
};

export default FluidEffectWrapper;
