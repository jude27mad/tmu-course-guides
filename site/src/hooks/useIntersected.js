import { useMemo, useState } from 'react';

import { useIntersection } from 'react-use';
import { useIsomorphicLayoutEffect } from '@src/hooks/useIsomorphicLayoutEffect';

const useIntersected = (ref, threshold = 0) => {
  const [intersected, setIntersected] = useState(false);
  const intersectionOptions = useMemo(() => ({ threshold }), [threshold]);
  const intersection = useIntersection(ref, intersectionOptions);

  useIsomorphicLayoutEffect(() => {
    if (intersection?.isIntersecting) {
      setIntersected(true);
    } else if (intersection && intersection.boundingClientRect.top > 0) {
      setIntersected(false);
    }
  }, [intersection]);

  return intersected;
};
export default useIntersected;
