import { Canvas, events } from '@react-three/fiber';
import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useCoarsePointer } from '@src/hooks/useMediaQuery';

const FruitNinja = dynamic(() => import('@src/components/dom/prefooter/FruitNinja'), { ssr: false });

// The pre-footer keeps its own canvas: its stickers fly in front of the paper
// and the text, while the shared View.Port canvas draws under the paper (only
// through windows), so it cannot be folded in without changing the look.
// It renders only while `active` (on screen and motion on).
function Index({ active, eventSource }) {
  const coarse = useCoarsePointer();

  return (
    <Canvas
      eventSource={eventSource}
      events={(state) => ({
        ...events(state),
        compute: (event, current) => {
          const bounds = eventSource.current?.getBoundingClientRect();
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
        borderRadius: '1.3888888889vw',
        height: '100%',
        width: '100%',
        pointerEvents: 'none',
      }}
    >
      {/* keeps a loading scene (the physics chunk, the disc font) inside the canvas */}
      <Suspense fallback={null}>
        <FruitNinja active={active} eventSource={eventSource} />
      </Suspense>
    </Canvas>
  );
}

export default Index;
