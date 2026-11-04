import { useCallback, useRef, useState } from 'react';

import { Plane } from '@react-three/drei';
import { RigidBody } from '@react-three/rapier';
import { useFrame } from '@react-three/fiber';
// eslint-disable-next-line import/extensions
import { createDiscFlight, GAME_MAX_AGE } from './gameTiming.mjs';

// Slicing swaps the emoji for its two halves and scores one point, but never
// marks anything done (ticks and completion records live on the course pages).
function Sticker({ id, positionX, material, materialSliced, isMobile, viewportHeight, ceilingY, speed, ceilingRef, floorRef, onDone, onSlice, onMiss, eventSource, active }) {
  const bodyRef = useRef();
  const age = useRef(0);
  const gone = useRef(false);
  const [fruitSliced, setFruitSliced] = useState(false);
  const sliced = useRef(false);

  const [flight] = useState(() => createDiscFlight({ viewportHeight, isMobile, ceilingY, speed }));

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

  const handleFruitSliced = useCallback(
    (event) => {
      // Touches are sampled after their direction is known. Pointer events
      // arrive first and would otherwise score while the user is scrolling.
      if (event?.pointerType === 'touch') return;
      if (!active || sliced.current || gone.current) return;
      // Raycasting still sees clipped meshes. Never score an invisible hit.
      const hitY = event?.point?.y ?? bodyRef.current?.translation().y ?? Infinity;
      if (hitY > ceilingRef.current || hitY <= floorRef.current) return;
      sliced.current = true;
      const element = eventSource.current;
      if (element) element.dataset.gameSlices = String(Number(element.dataset.gameSlices || 0) + 1);
      onSlice();
      setFruitSliced(true);
    },
    [eventSource, active, onSlice, ceilingRef, floorRef],
  );

  const mobileConfig = { position: [positionX, flight.startY, 0], scale: flight.radius * 2 };

  return (
    <RigidBody
      ref={bodyRef}
      collisionGroups={0x00000001}
      position={mobileConfig.position}
      linearVelocity={[0, flight.velocityY, 0]}
      angularVelocity={[0, 0, flight.spin]}
      gravityScale={flight.gravityScale}
      colliders="ball"
    >
      {/* The shared material of this emoji's face (FruitNinja): whole, then its halves once sliced. */}
      <Plane
        scale={mobileConfig.scale}
        material={fruitSliced ? materialSliced : material}
        onPointerEnter={handleFruitSliced}
        onPointerDown={handleFruitSliced}
        userData={{ slice: handleFruitSliced }}
      />
    </RigidBody>
  );
}

export default Sticker;
