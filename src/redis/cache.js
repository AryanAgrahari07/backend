/**
 * Minimal caching helpers.
 * Use for read-heavy endpoints like public menu: /r/:slug
 */

export async function cacheGetJson(redis, key) {
  const raw = await redis.get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function cacheSetJson(redis, key, value, ttlSeconds) {
  const payload = JSON.stringify(value);
  if (ttlSeconds && ttlSeconds > 0) {
    await redis.set(key, payload, "EX", ttlSeconds);
    return;
  }
  await redis.set(key, payload);
}

export async function cacheGetOrSetJson(redis, key, ttlSeconds, producer) {
  const cached = await cacheGetJson(redis, key);
  if (cached !== null) return cached;

  // Acquire a distributed lock to prevent stampede
  const lockKey = `lock:${key}`;
  let locked = await redis.set(lockKey, "1", "EX", 10, "NX");

  // BUG-4: Was recursive — replaced with bounded loop to prevent stack overflow under sustained load
  let retries = 0;
  const MAX_RETRIES = 10;
  while (!locked && retries < MAX_RETRIES) {
    await new Promise(r => setTimeout(r, 200));
    retries++;
    // Check if another instance already populated the cache
    const cached2 = await cacheGetJson(redis, key);
    if (cached2 !== null) return cached2;
    // Re-try acquiring the lock
    locked = await redis.set(lockKey, "1", "EX", 10, "NX");
  }

  if (!locked) {
    // Fail open after max retries: serve fresh data directly from producer
    // This is safe since each call still returns valid data; we just skip caching
    return producer();
  }

  try {
    const fresh = await producer();
    await cacheSetJson(redis, key, fresh, ttlSeconds);
    return fresh;
  } finally {
    await redis.del(lockKey);
  }
}

