type CacheEntry = {
  scope: string;
  payload: unknown;
  expiresAt: number;
};

const cache = new Map<string, CacheEntry>();

function cleanupExpired(): void {
  const now = Date.now();

  for (const [key, entry] of cache) {
    if (entry.expiresAt <= now) {
      cache.delete(key);
    }
  }
}

/**
 * Best-effort in-memory cache for normalized, non-personal payloads.
 * Cache misses and cache failures never affect API correctness.
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  cleanupExpired();

  const entry = cache.get(key);

  if (!entry || entry.expiresAt <= Date.now()) {
    if (entry) cache.delete(key);
    return null;
  }

  return entry.payload as T;
}

export async function cacheSet(
  key: string,
  scope: string,
  payload: unknown,
  ttlSeconds: number,
): Promise<void> {
  if (ttlSeconds <= 0) return;

  cache.set(key, {
    scope,
    payload,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });

  cleanupExpired();
}
