import { useEffect, useRef } from 'react';
import Tempus from '@darkroom.engineering/tempus';
import useInView from '@src/hooks/useInView';
import useMediaQuery from '@src/hooks/useMediaQuery';
import useStill from '@src/hooks/useStill';
// eslint-disable-next-line import/extensions
import { DARK_QUERY, FIELD, FIELD_DARK, prefersDark } from '@src/lib/palette.mjs';
import { mountSignalField } from './signalField.mjs';
import styles from './signalField.module.scss';

// One canvas under Giats's existing SVG mask, not one canvas per opening.
export default function SignalField() {
  const canvasRef = useRef(null);
  const controller = useRef(null);
  const visible = useInView(canvasRef);
  const still = useStill();
  // Dark mode: the points sit on the moving artwork, with no panel of their own.
  const dark = useMediaQuery(DARK_QUERY);

  useEffect(() => {
    const canvas = canvasRef.current;
    controller.current = mountSignalField(canvas, {
      host: canvas.parentElement.parentElement,
      subscribe: (callback) => Tempus.add(callback, 1),
      colors: prefersDark() ? FIELD_DARK : FIELD,
    });
    return () => {
      controller.current?.destroy();
      controller.current = null;
    };
  }, []);

  useEffect(() => {
    controller.current?.update({ visible, still });
  }, [visible, still]);

  // `dark` only says when to look again: during hydration it is still the server's false, while the field was
  // mounted with the device's real scheme.
  useEffect(() => {
    controller.current?.update({ colors: prefersDark() ? FIELD_DARK : FIELD });
  }, [dark]);

  return (
    <div className={styles.field} aria-hidden="true">
      <canvas ref={canvasRef} data-signal-field className={styles.canvas} />
    </div>
  );
}
