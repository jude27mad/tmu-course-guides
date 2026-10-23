import { forwardRef, useMemo } from 'react';

import FluidEffect from '@src/components/canvas/fluid/effect/FluidEffect';
import { useIsomorphicLayoutEffect } from '@src/hooks/useIsomorphicLayoutEffect';

const FluidEffectWrapper = forwardRef((props, ref) => {
  // Rebuild only when an input the effect reads changes (not on a JSON copy of the texture).
  const { intensity, fluidColor, backgroundColor, tFluid } = props;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const effect = useMemo(() => new FluidEffect(props), [intensity, fluidColor, backgroundColor, tFluid]);

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
