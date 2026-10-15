import { useEffect, useRef, useState } from 'react';

import { Plane } from '@react-three/drei';
import { RigidBody } from '@react-three/rapier';
import { useFrame } from '@react-three/fiber';

const TORQUE_IMPULSE_MIN = 1;
const TORQUE_IMPULSE_MAX = 3;
const IMPULSE_TIMEOUT = 100;
// A flight takes about 3 s; a sticker leaves once it has fallen below the
// section, or after MAX_AGE seconds of running time whatever happens.
const EXIT_Y = -12;
const MAX_AGE = 7;

const getRandomIntInclusive = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

// Slicing is decoration only: it swaps the disc for its two halves and never
// marks anything done (ticks and completion records live on the course pages).
function Sticker({ id, positionX, image, imageSliced, isMobile, viewportHeight, onDone }) {
  const bodyRef = useRef();
  const age = useRef(0);
  const gone = useRef(false);
  const [fruitSliced, setFruitSliced] = useState(false);

  useEffect(() => {
    const rigidBody = bodyRef.current;
    if (!rigidBody) return undefined;

    const torqueImpulse = getRandomIntInclusive(TORQUE_IMPULSE_MIN, TORQUE_IMPULSE_MAX);
    const impulseY = isMobile ? getRandomIntInclusive(viewportHeight * 2, viewportHeight * 2.8) : getRandomIntInclusive(viewportHeight * 2, viewportHeight * 3 + 2);

    const impulseTimeout = setTimeout(() => {
      if (!bodyRef.current) return;
      bodyRef.current.applyImpulse({ x: 0, y: impulseY, z: 0 }, true);
      bodyRef.current.addTorque({ x: 0, y: 0, z: torqueImpulse }, true);
    }, IMPULSE_TIMEOUT);

    return () => {
      clearTimeout(impulseTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFrame((_, delta) => {
    if (gone.current) return;
    age.current += Math.min(delta, 0.1);
    const body = bodyRef.current;
    const y = body ? body.translation().y : 0;
    if (age.current > MAX_AGE || (age.current > 0.5 && y < EXIT_Y)) {
      gone.current = true;
      onDone(id);
    }
  });

  const handleFruitSliced = () => {
    const rigidBody = bodyRef.current;
    if (rigidBody) {
      rigidBody.sleep();
      rigidBody.wakeUp();
    }
    setFruitSliced(true);
  };

  const mobileConfig = isMobile ? { position: [positionX, -5, 0], scale: 0.8 } : { position: [positionX, -7, 0], scale: 1 };
  const map = fruitSliced ? imageSliced : image;

  return (
    <RigidBody ref={bodyRef} collisionGroups={0x00000001} position={mobileConfig.position} colliders="ball">
      <Plane scale={mobileConfig.scale} onPointerEnter={() => !fruitSliced && handleFruitSliced()}>
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
