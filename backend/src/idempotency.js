function now() {
  return Date.now();
}

function keyFor({ scope, idempotencyKey, fingerprint }) {
  return `${scope}:${idempotencyKey}:${fingerprint}`;
}

export function createIdempotencyStore({ ttlMs = 15 * 60_000 } = {}) {
  const store = new Map();

  function get({ scope, idempotencyKey, fingerprint }) {
    if (!idempotencyKey) return null;
    const key = keyFor({ scope, idempotencyKey, fingerprint });
    const item = store.get(key);
    if (!item) return null;
    if (item.expiresAt <= now()) {
      store.delete(key);
      return null;
    }
    return item.value;
  }

  function set({ scope, idempotencyKey, fingerprint, value }) {
    if (!idempotencyKey) return;
    const key = keyFor({ scope, idempotencyKey, fingerprint });
    store.set(key, { value, expiresAt: now() + ttlMs });
  }

  function clear() {
    store.clear();
  }

  return { get, set, clear };
}
