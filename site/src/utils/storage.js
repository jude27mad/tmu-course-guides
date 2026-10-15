// window.localStorage, or null when it is missing or blocked (private mode,
// disabled site data). Every @src/lib reader/writer accepts null.
export function safeStorage() {
  try {
    if (typeof window === 'undefined') return null;
    const { localStorage } = window;
    return localStorage || null;
  } catch (error) {
    return null;
  }
}

export default safeStorage;
