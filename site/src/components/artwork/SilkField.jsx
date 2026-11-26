import { useEffect, useRef } from 'react';
import Tempus from '@darkroom.engineering/tempus';
import useInView from '@src/hooks/useInView';
import useMediaQuery from '@src/hooks/useMediaQuery';
import useStill from '@src/hooks/useStill';
// eslint-disable-next-line import/extensions
import { DARK_QUERY, SILK, SILK_DARK, prefersDark } from '@src/lib/palette.mjs';
import { mountSilkField } from './silkField.mjs';
import styles from './silkField.module.scss';

// The Desk's cloth: one WebGL canvas under Giats's existing SVG mask, not one canvas per opening.
// `onFail` asks for the Kairo field in its place (no WebGL 2 context, or a GPU that did not come back).
export default function SilkField({ onFail }) {
  const canvasRef = useRef(null);
  const controller = useRef(null);
  const fail = useRef(onFail);
  fail.current = onFail;
  const visible = useInView(canvasRef);
  const still = useStill();
  const startsStill = useRef(still);
  // The shade is a step lighter on the dark page. This component mounts only in the browser (HeroArtwork), so
  // the scheme is the device's real one from its first render.
  const dark = useMediaQuery(DARK_QUERY);
  const [top, middle, foot] = (dark ? SILK_DARK : SILK).shade;

  useEffect(() => {
    const canvas = canvasRef.current;
    controller.current = mountSilkField(canvas, {
      host: canvas.parentElement.parentElement,
      subscribe: (callback) => Tempus.add(callback, 1),
      still: startsStill.current,
      colors: prefersDark() ? SILK_DARK : SILK,
      onFail: () => fail.current?.(),
    });
    if (!controller.current) fail.current?.();
    return () => {
      controller.current?.destroy();
      controller.current = null;
    };
  }, []);

  useEffect(() => {
    controller.current?.update({ visible, still });
  }, [visible, still]);

  // The device's scheme changed during the visit (or printing began, which is always light).
  useEffect(() => {
    controller.current?.update({ colors: prefersDark() ? SILK_DARK : SILK });
  }, [dark]);

  // The panel is the shade the shader screens the cloth over, so a window is that deep blue from its first
  // paint and the cloth unfolds on it.
  return (
    <div className={styles.field} style={{ backgroundImage: `linear-gradient(155deg, ${top} 0%, ${middle} 45%, ${foot} 100%)` }} aria-hidden="true">
      <canvas ref={canvasRef} data-silk-field className={styles.canvas} />
    </div>
  );
}
