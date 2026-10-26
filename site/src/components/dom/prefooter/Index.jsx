import { Canvas, events } from '@react-three/fiber';
import { Suspense, useCallback, useEffect, useReducer, useRef } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import { useCoarsePointer } from '@src/hooks/useMediaQuery';
import styles from './game.module.scss';
// eslint-disable-next-line import/extensions
import { scoreAfterEvent } from './gameTiming.mjs';
// eslint-disable-next-line import/extensions
import { gameRecords } from './gameRecords.mjs';
// eslint-disable-next-line import/extensions
import { GAME_CELEBRATION_EVENT } from '../../canvas/fluid/gameCelebration.mjs';

const FruitNinja = dynamic(() => import('@src/components/dom/prefooter/FruitNinja'), { ssr: false });

// The pre-footer keeps its own canvas: its stickers fly in front of the paper
// and the text, while the shared View.Port canvas draws under the paper (only
// through windows), so it cannot be folded in without changing the look.
// It renders only while `active` (on screen and motion on).
function Index({ active, eventSource }) {
  const coarse = useCoarsePointer();
  const scoreRef = useRef();
  const [game, dispatch] = useReducer(scoreAfterEvent, { started: false, score: 0, best: 0 });
  useEffect(() => {
    dispatch({ type: 'restore', best: gameRecords.read().best });
  }, []);
  useEffect(() => {
    gameRecords.saveBest(game.best);
  }, [game.best]);
  const onSlice = useCallback(() => {
    dispatch('slice');
    if (gameRecords.claimCelebration()) window.dispatchEvent(new Event(GAME_CELEBRATION_EVENT));
  }, []);
  const onMiss = useCallback(() => dispatch('miss'), []);

  return (
    <>
      <Canvas
        // The game is fixed to the viewport. Scroll must not resize its canvas;
        // real viewport resizes still follow the browser's bottom edge.
        resize={{ scroll: false, debounce: { resize: 0, scroll: 0 } }}
        eventSource={eventSource.current?.closest('main') || eventSource}
        events={(state) => ({
          ...events(state),
          compute: (event, current) => {
            const bounds = current.gl.domElement.getBoundingClientRect();
            if (!bounds?.width || !bounds.height) return;
            current.pointer.set(((event.clientX - bounds.left) / bounds.width) * 2 - 1, -((event.clientY - bounds.top) / bounds.height) * 2 + 1);
            current.raycaster.setFromCamera(current.pointer, current.camera);
          },
        })}
        fallback={<span aria-hidden="true" />}
        frameloop={active ? 'always' : 'never'}
        dpr={1}
        gl={{
          antialias: !coarse,
          powerPreference: 'low-power',
        }}
        flat
        style={{
          position: 'relative',
          display: 'block',
          backgroundColor: 'transparent',
          height: '100%',
          width: '100%',
          pointerEvents: 'none',
        }}
      >
        {/* keeps a loading scene (the physics chunk, the disc font) inside the canvas */}
        <Suspense fallback={null}>
          <FruitNinja active={active} eventSource={eventSource} scoreRef={scoreRef} onSlice={onSlice} onMiss={onMiss} />
        </Suspense>
      </Canvas>
      {eventSource.current &&
        createPortal(
          <span ref={scoreRef} className={styles.score} role="status" data-game-score hidden={!game.started}>
            <span data-game-current>{`Score ${game.score}`}</span>
            <span className={styles.best} data-game-best>
              {`Best ${game.best}`}
            </span>
          </span>,
          eventSource.current,
        )}
    </>
  );
}

export default Index;
