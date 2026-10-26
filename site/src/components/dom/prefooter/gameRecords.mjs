const RECORD_KEY = 'tmu-guide:disc-game:v1';

// One game-only record; no course progress keys are read or written. Memory
// also prevents repeats across route remounts when browser storage is blocked.
export function createGameRecords(getStorage) {
  const memory = { best: 0, celebrated: false };
  const read = () => {
    try {
      const saved = JSON.parse(getStorage()?.getItem(RECORD_KEY) || 'null');
      if (Number.isSafeInteger(saved?.best) && saved.best >= 0) memory.best = Math.max(memory.best, saved.best);
      if (saved?.celebrated === true) memory.celebrated = true;
    } catch {
      // Unavailable or malformed storage must never interrupt a slice.
    }
    return { ...memory };
  };
  const write = () => {
    try {
      getStorage()?.setItem(RECORD_KEY, JSON.stringify(memory));
    } catch {
      // The current page keeps working without persistence.
    }
  };
  return {
    read,
    saveBest(score) {
      read();
      if (Number.isSafeInteger(score) && score > memory.best) {
        memory.best = score;
        write();
      }
    },
    claimCelebration() {
      read();
      if (memory.celebrated) return false;
      // Claim synchronously before emitting, even if one swipe hits many discs.
      memory.celebrated = true;
      write();
      return true;
    },
  };
}

export const gameRecords = createGameRecords(() => (typeof window === 'undefined' ? null : window.localStorage));
