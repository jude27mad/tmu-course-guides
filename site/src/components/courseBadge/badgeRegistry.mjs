// One registry per app. Slots belong to live lanyards, never course order.
export function createBadgeRegistry() {
  let state = { entries: [], rigs: [] };
  const listeners = new Set();
  const publish = (entries) => {
    // Directory windows share one lanyard. Merge visibility so overlapping
    // windows still apply the original scroll impulse exactly once per frame.
    const rigs = new Map();
    entries.forEach((entry) => {
      const rig = rigs.get(entry.motionId);
      if (rig) rig.swing = rig.swing || entry.swing;
      else rigs.set(entry.motionId, { id: entry.motionId, slot: entry.slot, body: entry.body, swing: entry.swing });
    });
    state = { entries, rigs: [...rigs.values()] };
    listeners.forEach((listener) => listener());
  };
  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    register(id, descriptor) {
      const existing = state.entries.find((entry) => entry.id === id);
      if (existing) return existing;
      const motionId = descriptor.motionGroup ? `group:${descriptor.motionGroup}` : `badge:${id}`;
      const shared = state.entries.find((entry) => entry.motionId === motionId);
      let slot = 0;
      while (state.entries.some((entry) => entry.slot === slot)) slot += 1;
      if (shared) slot = shared.slot;
      const body = shared?.body ?? Object.fromEntries(['fixed', 'j1', 'j2', 'j3', 'card', 'cardObject', 'j1Object', 'j2Object', 'j3Object'].map((key) => [key, { current: null }]));
      const entry = { ...descriptor, id, motionId, slot, body, visible: false, swing: false };
      publish([...state.entries, entry]);
      return entry;
    },
    update(id, changes) {
      const current = state.entries.find((entry) => entry.id === id);
      if (!current || Object.entries(changes).every(([key, value]) => current[key] === value)) return;
      publish(state.entries.map((entry) => (entry.id === id ? { ...entry, ...changes } : entry)));
    },
    unregister(id) {
      if (state.entries.some((entry) => entry.id === id)) publish(state.entries.filter((entry) => entry.id !== id));
    },
  };
}
