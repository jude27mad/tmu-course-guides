// One registry per app. Slots belong to mounted positions, never course order.
export function createBadgeRegistry() {
  let state = { entries: [] };
  const listeners = new Set();
  const publish = (entries) => {
    state = { entries };
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
      let slot = 0;
      while (state.entries.some((entry) => entry.slot === slot)) slot += 1;
      const body = Object.fromEntries(['fixed', 'j1', 'j2', 'j3', 'card', 'cardObject'].map((key) => [key, { current: null }]));
      const entry = { ...descriptor, id, slot, body, visible: false, swing: false };
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
