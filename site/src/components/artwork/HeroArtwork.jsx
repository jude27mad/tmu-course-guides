import { useCallback, useState } from 'react';
import useWebGL from '@src/hooks/useWebGL';
import SignalField from './SignalField';
import SilkField from './SilkField';
import styles from './signalField.module.scss';

// The artwork under the Desk's windows. Where WebGL 2 works it is React Bits' silk. Where it does not
// (turned off, blocked, a GPU that went away), or the cloth cannot be built, it is Kairo's signal field,
// which needs only Canvas 2D. The static HTML and the hydration pass carry neither canvas (useWebGL()
// is null there), only the field's quiet CSS points, so the markup is the same for every browser.
export default function HeroArtwork() {
  const webgl = useWebGL();
  const [failed, setFailed] = useState(false);
  const onFail = useCallback(() => setFailed(true), []);

  if (webgl && !failed) return <SilkField onFail={onFail} />;
  if (webgl === false || failed) return <SignalField />;
  return <div className={styles.field} aria-hidden="true" />;
}
