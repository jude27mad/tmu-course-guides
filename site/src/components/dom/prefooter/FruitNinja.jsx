import { emojiTextures, loadEmojiImages } from '@src/components/dom/prefooter/emojiTextures';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { MeshBasicMaterial } from 'three';
import { PerspectiveCamera } from '@react-three/drei';
import { Physics } from '@react-three/rapier';
import Sticker from '@src/components/dom/prefooter/Sticker';
import useIsMobile from '@src/hooks/useIsMobile';
import { useFrame, useThree } from '@react-three/fiber';
// eslint-disable-next-line import/extensions
import { createSpawnSchedule, GAME_GRAVITY, scoreBoundary, gameDifficulty, gameSpawnDelay, gameSpawnCount } from './gameTiming.mjs';
// eslint-disable-next-line import/extensions
import { bindGameTouch } from './gameTouch.mjs';

// The original spawner added 1-6 stickers every 3 s (phone 5 s) and never removed
// any: after ten minutes about 400 physical bodies. Stickers now leave once
// they have fallen out of view, at most MAX_ALIVE fly at once, and nothing
// spawns or steps while the section is off screen.
const MAX_ALIVE = 10;
const MAX_ALIVE_PHONE = 6;

function useEmojiTextures() {
  const [textures, setTextures] = useState(null);

  useEffect(() => {
    let cancelled = false;
    let made = null;
    loadEmojiImages().then((images) => {
      if (cancelled) return;
      made = images.map(emojiTextures);
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

// One material per emoji face, shared by every target. A target used to declare its own material, which
// R3F disposed when it left; with no other target of that kind in the air, three.js then released the
// compiled shader and the next one compiled it again, a main-thread stall on spawns while the section was
// on screen. The settings are the ones each target declared: the artwork already contains its shading,
// so it keeps its original colours.
const emojiMaterial = (map) => new MeshBasicMaterial({ transparent: true, polygonOffset: true, polygonOffsetFactor: -10, map, toneMapped: false });

function useEmojiMaterials(textures) {
  const materials = useMemo(() => textures?.map(({ whole, sliced }) => ({ whole: emojiMaterial(whole), sliced: emojiMaterial(sliced) })) || null, [textures]);
  useEffect(
    () => () =>
      materials?.forEach(({ whole, sliced }) => {
        whole.dispose();
        sliced.dispose();
      }),
    [materials],
  );
  return materials;
}

const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

function useFruitSpawner({ viewport, textures, isMobile, active, getCeiling, streakRef }) {
  const [fruits, setFruits] = useState([]);
  const nextId = useRef(0);
  const viewportRef = useRef(viewport);
  viewportRef.current = viewport;

  const remove = useCallback((id) => {
    setFruits((previous) => previous.filter((fruit) => fruit.id !== id));
  }, []);

  const spawnRef = useRef();
  const difficultyRef = useRef();
  difficultyRef.current = () => gameDifficulty({ score: streakRef.current, isMobile });
  spawnRef.current = () => {
    const { speed } = difficultyRef.current();
    const ceilingY = getCeiling();
    const radius = (isMobile ? 0.4 : 0.5) * 1.05;
    // Wait for enough space for a whole disc beneath the score.
    if (ceilingY < -viewportRef.current.height / 2 + radius * 2) return;
    const cap = isMobile ? MAX_ALIVE_PHONE : MAX_ALIVE;
    const width = Math.max(0, viewportRef.current.width / 2 - 1);
    setFruits((previous) => {
      if (previous.length >= cap) return previous;
      const count = Math.min(gameSpawnCount({ speed }), cap - previous.length);
      // Spread the group across the play area so several emojis remain distinct.
      const lane = (width * 2) / count;
      const group = Array.from({ length: count }, (_, slot) => {
        nextId.current += 1;
        return {
          id: nextId.current,
          x: -width + lane * (slot + randomInt(20, 80) / 100),
          index: randomInt(0, textures.length - 1),
          ceilingY,
          speed,
        };
      });
      return [...previous, ...group];
    });
  };
  const scheduler = useMemo(() => createSpawnSchedule({ spawn: () => spawnRef.current(), interval: () => gameSpawnDelay(difficultyRef.current()) }), []);
  useEffect(() => {
    scheduler.setActive(active && !!textures?.length);
  }, [scheduler, active, textures]);
  useEffect(() => () => scheduler.dispose(), [scheduler]);

  return [fruits, remove];
}

function FruitNinja({ active = true, eventSource, scoreRef, ceilingAnchorRef, streakRef, onSlice, onMiss }) {
  const viewport = useThree((state) => state.viewport);
  const isMobile = useIsMobile();
  const textures = useEmojiTextures();
  const materials = useEmojiMaterials(textures);
  const { scene, camera, raycaster, pointer, setEvents, gl } = useThree();
  const ceilingRef = useRef(-Infinity);
  const floorRef = useRef(Infinity);
  const insetRef = useRef(null);
  const bottomInsetRef = useRef(null);
  const getCeiling = useCallback(() => {
    const bounds = gl.domElement.getBoundingClientRect();
    const score = scoreRef.current?.getBoundingClientRect();
    const anchor = ceilingAnchorRef.current?.getBoundingClientRect();
    const paper = eventSource.current?.closest('[data-companion-statement]')?.getBoundingClientRect();
    if (!score || !anchor || !paper || !bounds.height) return -Infinity;
    const { inset, bottomInset, ceilingY, floorY } = scoreBoundary({
      scoreBottom: anchor.top + score.height,
      canvasTop: bounds.top,
      canvasHeight: bounds.height,
      viewportHeight: viewport.height,
      stageBottom: paper.bottom,
    });
    ceilingRef.current = ceilingY;
    floorRef.current = floorY;
    // Preserve the original upper limit and the white/dark boundary.
    // The fixed canvas and its screen-bottom launch point stay put.
    if (inset !== insetRef.current || bottomInset !== bottomInsetRef.current) {
      gl.domElement.style.clipPath = `inset(${inset}px 0 ${bottomInset}px 0)`;
      insetRef.current = inset;
      bottomInsetRef.current = bottomInset;
    }
    return ceilingY;
  }, [gl, scoreRef, ceilingAnchorRef, eventSource, viewport.height]);
  useFrame(() => {
    if (active) getCeiling();
  }, -100);
  const [fruits, remove] = useFruitSpawner({ viewport, textures, isMobile, active, getCeiling, streakRef });

  useEffect(() => {
    setEvents({ enabled: active });
  }, [active, setEvents]);

  useEffect(() => {
    const element = eventSource.current?.closest('main');
    if (!element || !active) return undefined;
    const sample = (touches) => {
      getCeiling();
      const bounds = gl.domElement.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;
      Array.from(touches).forEach((touch) => {
        if (touch.clientY < bounds.top + (insetRef.current ?? bounds.height) || touch.clientY >= bounds.bottom - (bottomInsetRef.current ?? bounds.height)) return;
        pointer.set(((touch.clientX - bounds.left) / bounds.width) * 2 - 1, -((touch.clientY - bounds.top) / bounds.height) * 2 + 1);
        raycaster.setFromCamera(pointer, camera);
        raycaster.intersectObjects(scene.children, true).forEach((hit) => hit.object.userData.slice?.(hit));
      });
    };
    return bindGameTouch(element, {
      canStart: (touch, event) => {
        if (event.target?.closest('a, button, input, textarea, select, summary, [contenteditable], [role="button"], [data-lenis-prevent]')) return false;
        getCeiling();
        const bounds = gl.domElement.getBoundingClientRect();
        const insideX = touch.clientX >= bounds.left && touch.clientX <= bounds.right;
        return insideX && touch.clientY >= bounds.top + (insetRef.current ?? bounds.height) && touch.clientY < bounds.bottom - (bottomInsetRef.current ?? bounds.height);
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
      <Physics paused={!active} interpolate timeStep={1 / 60} gravity={[0, GAME_GRAVITY, 0]} colliders={false}>
        {materials &&
          fruits.map((fruit) => (
            <Sticker
              key={fruit.id}
              id={fruit.id}
              positionX={fruit.x}
              material={materials[fruit.index].whole}
              materialSliced={materials[fruit.index].sliced}
              isMobile={isMobile}
              viewportHeight={viewport.height}
              ceilingY={fruit.ceilingY}
              speed={fruit.speed}
              ceilingRef={ceilingRef}
              floorRef={floorRef}
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
