import { useCallback, useRef, useState } from 'react';

import { Plane } from '@react-three/drei';
import { RigidBody } from '@react-three/rapier';
import { useFrame } from '@react-three/fiber';
// eslint-disable-next-line import/extensions
import { createDiscFlight, GAME_MAX_AGE } from './gameTiming.mjs';

// Slicing swaps the disc for its two halves and scores one point, but never
// marks anything done (ticks and completion records live on the course pages).
function Sticker({ id, positionX, image, imageSliced, isMobile, viewportHeight, onDone, onSlice, onMiss, eventSource, active }) {
  const bodyRef = useRef();
  const age = useRef(0);
  const gone = useRef(false);
  const [fruitSliced, setFruitSliced] = useState(false);
  const sliced = useRef(false);

  const [flight] = useState(() => createDiscFlight({ viewportHeight, isMobile }));

  useFrame((_, delta) => {
    if (!active || gone.current) return;
    age.current += Math.min(delta, 0.1);
    const body = bodyRef.current;
    const belowStage = body && body.linvel().y < 0 && body.translation().y < -viewportHeight / 2 - flight.radius - 0.2;
    if (age.current > GAME_MAX_AGE || belowStage) {
      gone.current = true;
      if (!sliced.current) onMiss();
      onDone(id);
    }
  });

  const handleFruitSliced = useCallback(() => {
    if (!active || sliced.current || gone.current) return;
    sliced.current = true;
    const element = eventSource.current;
    if (element) element.dataset.gameSlices = String(Number(element.dataset.gameSlices || 0) + 1);
    onSlice();
    setFruitSliced(true);
  }, [eventSource, active, onSlice]);

  const mobileConfig = isMobile ? { position: [positionX, flight.startY, 0], scale: 0.8 } : { position: [positionX, flight.startY, 0], scale: 1 };
  const map = fruitSliced ? imageSliced : image;

  return (
    <RigidBody ref={bodyRef} collisionGroups={0x00000001} position={mobileConfig.position} linearVelocity={[0, flight.velocityY, 0]} angularVelocity={[0, 0, flight.spin]} colliders="ball">
      <Plane scale={mobileConfig.scale} onPointerEnter={handleFruitSliced} onPointerDown={handleFruitSliced} userData={{ slice: handleFruitSliced }}>
        {isMobile ? (
          // phones: no iridescence/clearcoat passes
          <meshStandardMaterial transparent polygonOffset polygonOffsetFactor={-10} map={map} roughness={0.6} metalness={0.2} toneMapped={false} />
        ) : (
          <meshPhysicalMaterial
            transparent
            polygonOffset
            polygonOffsetFactor={-10}
            map={map}
            iridescence={2}
            iridescenceIOR={1}
            iridescenceThicknessRange={[0, 1400]}
            roughness={1}
            clearcoat={0.5}
            // The original used 0.75 for printed logos; the discs carry the course colours, which read muddy that metallic
            metalness={0.35}
            toneMapped={false}
          />
        )}
      </Plane>
    </RigidBody>
  );
}

export default Sticker;
