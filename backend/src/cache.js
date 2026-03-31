export function createApiCache({ defaultTtlMs = 60_000 } = {}) {
  const store = new Map();

  function now() {
    return Date.now();
  }

  function get(key) {
    const item = store.get(key);
    if (!item) return null;
    if (item.expiresAt <= now()) {
      store.delete(key);
      return null;
    }
    return item.value;
  }

  function set(key, value, ttlMs = defaultTtlMs) {
    store.set(key, { value, expiresAt: now() + ttlMs });
  }

  function delByPrefix(prefix) {
    for (const key of store.keys()) {
      if (key.startsWith(prefix)) store.delete(key);
    }
  }

  function clear() {
    store.clear();
  }

  return { get, set, delByPrefix, clear };
}
