import { discTexture, loadDiscFont, slicedDiscTexture } from '@src/components/dom/prefooter/discTextures';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { COURSES, DISC } from '@src/lib';
import { PerspectiveCamera } from '@react-three/drei';
import { Physics } from '@react-three/rapier';
import Sticker from '@src/components/dom/prefooter/Sticker';
import useIsMobile from '@src/hooks/useIsMobile';
import { useThree } from '@react-three/fiber';
import { nativeIOSScroll } from '@src/utils/scrollRoot';
// eslint-disable-next-line import/extensions
import { createSpawnSchedule, GAME_GRAVITY } from './gameTiming.mjs';

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
        const look = { code: course.code, ...DISC };
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

  const spawnRef = useRef();
  const intervalRef = useRef();
  intervalRef.current = isMobile ? 5000 : 3000;
  spawnRef.current = () => {
    const cap = isMobile ? MAX_ALIVE_PHONE : MAX_ALIVE;
    const width = Math.max(0, viewportRef.current.width / 2 - 1);
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
  const scheduler = useMemo(() => createSpawnSchedule({ spawn: () => spawnRef.current(), interval: () => intervalRef.current }), []);
  useEffect(() => {
    scheduler.setActive(active && !!textures?.length);
  }, [scheduler, active, textures]);
  useEffect(() => () => scheduler.dispose(), [scheduler]);

  return [fruits, remove];
}

function FruitNinja({ active = true, eventSource }) {
  const viewport = useThree((state) => state.viewport);
  const isMobile = useIsMobile();
  const textures = useDiscTextures();
  const [fruits, remove] = useFruitSpawner({ viewport, textures, isMobile, active });
  const { scene, camera, raycaster, pointer, setEvents } = useThree();

  useEffect(() => {
    setEvents({ enabled: active });
  }, [active, setEvents]);

  useEffect(() => {
    const element = eventSource.current;
    if (!element || !active || !nativeIOSScroll()) return undefined;
    // Native scrolling can cancel pointermove on iOS; passive touches continue.
    // No gesture state, capture or preventDefault: the fluid observes these too.
    const sample = (event) => {
      const bounds = element.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;
      Array.from(event.changedTouches || []).forEach((touch) => {
        pointer.set(((touch.clientX - bounds.left) / bounds.width) * 2 - 1, -((touch.clientY - bounds.top) / bounds.height) * 2 + 1);
        raycaster.setFromCamera(pointer, camera);
        raycaster.intersectObjects(scene.children, true).forEach((hit) => hit.object.userData.slice?.());
      });
    };
    element.addEventListener('touchstart', sample, { passive: true });
    element.addEventListener('touchmove', sample, { passive: true });
    return () => {
      element.removeEventListener('touchstart', sample);
      element.removeEventListener('touchmove', sample);
    };
  }, [active, eventSource, scene, camera, raycaster, pointer]);

  useEffect(() => {
    const element = eventSource.current;
    if (element) element.dataset.gameDiscs = String(fruits.length);
    return () => {
      if (element) delete element.dataset.gameDiscs;
    };
  }, [eventSource, fruits.length]);

  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 0, 10]} />
      <Lighting />
      <Physics paused={!active} interpolate timeStep={1 / 60} gravity={[0, GAME_GRAVITY, 0]} colliders={false}>
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
              eventSource={eventSource}
              active={active}
            />
          ))}
      </Physics>
    </>
  );
}

export default FruitNinja;
