import { discTexture, loadDiscFont, slicedDiscTexture } from '@src/components/dom/prefooter/discTextures';
import { useCallback, useEffect, useRef, useState } from 'react';

import { COURSES } from '@src/lib';
import { PerspectiveCamera } from '@react-three/drei';
import { Physics } from '@react-three/rapier';
import Sticker from '@src/components/dom/prefooter/Sticker';
import useIsMobile from '@src/hooks/useIsMobile';
import { useThree } from '@react-three/fiber';

// The original spawner added 1-6 stickers every 3 s (phone 5 s) and never removed
// any: after ten minutes about 400 physical bodies. Stickers now leave once
// they have fallen out of view, at most MAX_ALIVE fly at once, and nothing
// spawns or steps while the section is off screen.
const MAX_ALIVE = 10;
const MAX_ALIVE_PHONE = 6;

function Lighting() {
  return (
    <>
      <ambientLight intensity={1.3} />
      <directionalLight position={[5, 5, 5]} intensity={1.5} />
      <directionalLight position={[-5, 5, 5]} intensity={1} />
      <directionalLight position={[0, 5, -5]} intensity={1} />
    </>
  );
}

function useDiscTextures() {
  const [textures, setTextures] = useState(null);

  useEffect(() => {
    let cancelled = false;
    let made = null;
    loadDiscFont().then(() => {
      if (cancelled) return;
      made = COURSES.map((course) => {
        const look = { code: course.code, background: course.palette?.menuColor || '#28282b', color: course.palette?.menuFontColor || '#f0f4f1' };
        return { whole: discTexture(look), sliced: slicedDiscTexture(look) };
      });
      setTextures(made);
    });
    return () => {
      cancelled = true;
      made?.forEach(({ whole, sliced }) => {
        whole.dispose();
        sliced.dispose();
      });
    };
  }, []);

  return textures;
}

const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

function useFruitSpawner({ viewport, textures, isMobile, active }) {
  const [fruits, setFruits] = useState([]);
  const nextId = useRef(0);
  const viewportRef = useRef(viewport);
  viewportRef.current = viewport;

  const remove = useCallback((id) => {
    setFruits((previous) => previous.filter((fruit) => fruit.id !== id));
  }, []);

  useEffect(() => {
    if (!active || !textures?.length) return undefined;
    const cap = isMobile ? MAX_ALIVE_PHONE : MAX_ALIVE;
    const spawn = () => {
      const width = viewportRef.current.width / 2 - 1;
      setFruits((previous) => {
        const room = cap - previous.length;
        if (room <= 0) return previous;
        const added = Array.from({ length: Math.min(room, randomInt(1, 6)) }, () => {
          nextId.current += 1;
          const index = randomInt(0, textures.length - 1);
          return { id: nextId.current, x: randomInt(Math.ceil(-width), Math.floor(width)), index };
        });
        return [...previous, ...added];
      });
    };
    const timer = setInterval(spawn, (isMobile ? 5 : 3) * 1000);
    return () => clearInterval(timer);
  }, [active, textures, isMobile]);

  return [fruits, remove];
}

function FruitNinja({ active = true }) {
  const viewport = useThree((state) => state.viewport);
  const isMobile = useIsMobile();
  const textures = useDiscTextures();
  const [fruits, remove] = useFruitSpawner({ viewport, textures, isMobile, active });

  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 0, 10]} />
      <Lighting />
      <Physics paused={!active} interpolate timeStep={1 / 60} gravity={[0, -15, 0]} colliders={false}>
        {textures &&
          fruits.map((fruit) => (
            <Sticker
              key={fruit.id}
              id={fruit.id}
              positionX={fruit.x}
              image={textures[fruit.index].whole}
              imageSliced={textures[fruit.index].sliced}
              isMobile={isMobile}
              viewportHeight={viewport.height}
              onDone={remove}
            />
          ))}
      </Physics>
    </>
  );
}

export default FruitNinja;
