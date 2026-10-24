import { TOKENS } from '@src/lib/palette.mjs';
import { useMemo } from 'react';

const useOpts = () => {
  const isMobile = window.innerWidth < 812;
  const OPTS = useMemo(
    () => ({
      intensity: 5,
      force: 1,
      curl: 1,
      radius: isMobile ? 0.11 : 0.14,
      swirl: 3,

      pressure: 0.0,
      densityDissipation: isMobile ? 0.96 : 0.965,
      velocityDissipation: 0.93,

      fluidColor: TOKENS.fluid,
      // Giats's original deep-violet shader base for the difference-blended brush
      backgroundColor: '#070410',

      showBackground: false,

      dyeRes: isMobile ? 64 : 256,
      simRes: isMobile ? 16 : 50,
    }),
    [isMobile],
  );
  return OPTS;
};
export default useOpts;
