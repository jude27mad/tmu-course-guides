export const GAME_CELEBRATION_EVENT = 'tmu-guide:disc-game-first-slice';

// Every 0-to-1 transition keeps the original four-splat bloom. The browser's
// first discovery adds four screen-wide splats to the same simulation, with
// no timers, extra animation loop, or changes to ordinary pointer splats.
// Bursts are one-off splats: their dye does not scale with the frame rate.
export function listenForGameCelebration(target, splatStack, size) {
  const celebrate = (event) => {
    splatStack.current.push(
      { mouseX: 0.4, mouseY: 0.5, velocityX: -90, velocityY: 0, radiusScale: 36, burst: true },
      { mouseX: 0.6, mouseY: 0.5, velocityX: 90, velocityY: 0, radiusScale: 36, burst: true },
      { mouseX: 0.5, mouseY: 0.4, velocityX: 0, velocityY: -90, radiusScale: 36, burst: true },
      { mouseX: 0.5, mouseY: 0.6, velocityX: 0, velocityY: 90, radiusScale: 36, burst: true },
    );
    if (event.detail?.discovery) {
      // The splat shader scales horizontal distance by the canvas aspect.
      // Compensate its squared distance so the bloom reaches every edge on
      // phones, landscape displays and ultrawide screens alike.
      const aspect = size.width / size.height;
      const radiusScale = 600 * Math.max(1, aspect * aspect);
      splatStack.current.push(
        { mouseX: 0.2, mouseY: 0.2, velocityX: -240, velocityY: -240, radiusScale, burst: true },
        { mouseX: 0.8, mouseY: 0.2, velocityX: 240, velocityY: -240, radiusScale, burst: true },
        { mouseX: 0.2, mouseY: 0.8, velocityX: -240, velocityY: 240, radiusScale, burst: true },
        { mouseX: 0.8, mouseY: 0.8, velocityX: 240, velocityY: 240, radiusScale, burst: true },
      );
    }
  };
  target.addEventListener(GAME_CELEBRATION_EVENT, celebrate);
  return () => target.removeEventListener(GAME_CELEBRATION_EVENT, celebrate);
}
