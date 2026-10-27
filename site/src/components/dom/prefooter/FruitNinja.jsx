import { discTexture, loadDiscFont, slicedDiscTexture } from '@src/components/dom/prefooter/discTextures';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { COURSES, DISC } from '@src/lib';
import { PerspectiveCamera } from '@react-three/drei';
import { Physics } from '@react-three/rapier';
import Sticker from '@src/components/dom/prefooter/Sticker';
import useIsMobile from '@src/hooks/useIsMobile';
import { useFrame, useThree } from '@react-three/fiber';
// eslint-disable-next-line import/extensions
import { createSpawnSchedule, GAME_GRAVITY, scoreBoundary } from './gameTiming.mjs';
// eslint-disable-next-line import/extensions
import { bindGameTouch } from './gameTouch.mjs';

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

function useFruitSpawner({ viewport, textures, isMobile, active, getCeiling }) {
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
    const ceilingY = getCeiling();
    const radius = (isMobile ? 0.4 : 0.5) * 1.05;
    // Wait for enough space for a whole disc beneath the score.
    if (ceilingY < -viewportRef.current.height / 2 + radius * 2) return;
    const cap = isMobile ? MAX_ALIVE_PHONE : MAX_ALIVE;
    const width = Math.max(0, viewportRef.current.width / 2 - 1);
    setFruits((previous) => {
      const room = cap - previous.length;
      if (room <= 0) return previous;
      const added = Array.from({ length: Math.min(room, randomInt(1, 6)) }, () => {
        nextId.current += 1;
        const index = randomInt(0, textures.length - 1);
        return { id: nextId.current, x: randomInt(Math.ceil(-width), Math.floor(width)), index, ceilingY };
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

function FruitNinja({ active = true, eventSource, scoreRef, onSlice, onMiss }) {
  const viewport = useThree((state) => state.viewport);
  const isMobile = useIsMobile();
  const textures = useDiscTextures();
  const { scene, camera, raycaster, pointer, setEvents, gl } = useThree();
  const ceilingRef = useRef(-Infinity);
  const insetRef = useRef(null);
  const getCeiling = useCallback(() => {
    const bounds = gl.domElement.getBoundingClientRect();
    const score = scoreRef.current?.getBoundingClientRect();
    if (!score || !bounds.height) return -Infinity;
    const { inset, ceilingY } = scoreBoundary({ scoreBottom: score.bottom, canvasTop: bounds.top, canvasHeight: bounds.height, viewportHeight: viewport.height });
    ceilingRef.current = ceilingY;
    // Scroll can move the score past an already airborne disc. Clip only the
    // upper edge; the fixed canvas and its screen-bottom launch point stay put.
    if (inset !== insetRef.current) {
      gl.domElement.style.clipPath = `inset(${inset}px 0 0 0)`;
      insetRef.current = inset;
    }
    return ceilingY;
  }, [gl, scoreRef, viewport.height]);
  useFrame(() => {
    if (active) getCeiling();
  }, -100);
  const [fruits, remove] = useFruitSpawner({ viewport, textures, isMobile, active, getCeiling });

  useEffect(() => {
    setEvents({ enabled: active });
  }, [active, setEvents]);

  useEffect(() => {
    const element = eventSource.current?.closest('main');
    if (!element || !active) return undefined;
    const sample = (touches) => {
      const bounds = gl.domElement.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;
      Array.from(touches).forEach((touch) => {
        if (touch.clientY < bounds.top + (insetRef.current ?? bounds.height)) return;
        pointer.set(((touch.clientX - bounds.left) / bounds.width) * 2 - 1, -((touch.clientY - bounds.top) / bounds.height) * 2 + 1);
        raycaster.setFromCamera(pointer, camera);
        raycaster.intersectObjects(scene.children, true).forEach((hit) => hit.object.userData.slice?.());
      });
    };
    return bindGameTouch(element, {
      canStart: (touch, event) => {
        if (event.target?.closest('a, button, input, textarea, select, summary, [contenteditable], [role="button"], [data-lenis-prevent]')) return false;
        getCeiling();
        const bounds = gl.domElement.getBoundingClientRect();
        const insideX = touch.clientX >= bounds.left && touch.clientX <= bounds.right;
        return insideX && touch.clientY >= bounds.top + (insetRef.current ?? bounds.height) && touch.clientY <= bounds.bottom;
      },
      sample,
    });
  }, [active, eventSource, scene, camera, raycaster, pointer, gl, getCeiling]);

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
              ceilingY={fruit.ceilingY}
              ceilingRef={ceilingRef}
              onDone={remove}
              onSlice={onSlice}
              onMiss={onMiss}
              eventSource={eventSource}
              active={active}
            />
          ))}
      </Physics>
    </>
  );
}

export default FruitNinja;
