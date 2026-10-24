import { Canvas } from '@react-three/fiber';
import { Suspense } from 'react';
import WebGLGate from '@src/components/canvas/WebGLGate';
import dynamic from 'next/dynamic';
import { useCoarsePointer } from '@src/hooks/useMediaQuery';

const FruitNinja = dynamic(() => import('@src/components/dom/prefooter/FruitNinja'), { ssr: false });

// The pre-footer keeps its own canvas: its stickers fly in front of the paper
// and the text, while the shared View.Port canvas draws under the paper (only
// through windows), so it cannot be folded in without changing the look.
// It renders only while `active` (on screen and motion on).
function Index({ active }) {
  const coarse = useCoarsePointer();

  // Without WebGL the section is its heading and line of text; the stickers are decoration.
  return (
    <WebGLGate>
      <Canvas
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
          touchAction: 'pan-y',
        }}
      >
        {/* keeps a loading scene (the physics chunk, the disc font) inside the canvas */}
        <Suspense fallback={null}>
          <FruitNinja active={active} />
        </Suspense>
      </Canvas>
    </WebGLGate>
  );
}

export default Index;
