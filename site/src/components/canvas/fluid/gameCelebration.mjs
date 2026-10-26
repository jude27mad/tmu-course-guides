export const GAME_CELEBRATION_EVENT = 'tmu-guide:disc-game-first-slice';

// A single large bloom in the existing simulation. Four wide, outward splats
// add no timers or animation loops and never alter ordinary pointer splats.
export function listenForGameCelebration(target, splatStack) {
  const celebrate = () => {
    splatStack.current.push(
      { mouseX: 0.4, mouseY: 0.5, velocityX: -90, velocityY: 0, radiusScale: 36 },
      { mouseX: 0.6, mouseY: 0.5, velocityX: 90, velocityY: 0, radiusScale: 36 },
      { mouseX: 0.5, mouseY: 0.4, velocityX: 0, velocityY: -90, radiusScale: 36 },
      { mouseX: 0.5, mouseY: 0.6, velocityX: 0, velocityY: 90, radiusScale: 36 },
    );
  };
  target.addEventListener(GAME_CELEBRATION_EVENT, celebrate);
  return () => target.removeEventListener(GAME_CELEBRATION_EVENT, celebrate);
}
