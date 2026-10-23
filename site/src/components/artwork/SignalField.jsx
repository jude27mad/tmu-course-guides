import { useEffect, useRef } from 'react';
import Tempus from '@darkroom.engineering/tempus';
import useInView from '@src/hooks/useInView';
import useStill from '@src/hooks/useStill';
import { mountSignalField } from './signalField.mjs';
import styles from './signalField.module.scss';

// One canvas under Giats's existing SVG mask, not one canvas per opening.
export default function SignalField() {
  const canvasRef = useRef(null);
  const controller = useRef(null);
  const visible = useInView(canvasRef);
  const still = useStill();

  useEffect(() => {
    const canvas = canvasRef.current;
    controller.current = mountSignalField(canvas, {
      host: canvas.parentElement.parentElement,
      subscribe: (callback) => Tempus.add(callback, 1),
    });
    return () => {
      controller.current?.destroy();
      controller.current = null;
    };
  }, []);

  useEffect(() => {
    controller.current?.update({ visible, still });
  }, [visible, still]);

  return (
    <div className={styles.field} aria-hidden="true" data-surface="dark">
      <canvas ref={canvasRef} data-signal-field className={styles.canvas} />
    </div>
  );
}
