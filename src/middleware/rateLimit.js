import { getRedisClient } from "../redis/client.js";
import { RateLimiterMemory, RateLimiterRedis } from "rate-limiter-flexible";

const memoryStore = new RateLimiterMemory({
  points: 100, // Safe generic fallback
  duration: 60,
});

/**
 * Sliding-window rate limiter using rate-limiter-flexible.
 * Uses Redis if available for distributed limiting across pods.
 * Falls back to in-memory store in development/standalone mode.
 */
export function rateLimit({ keyPrefix, windowSeconds, max }) {
  // Create limiters lazily per route configuration
  let redisLimiter = null;
  let memoryLimiter = new RateLimiterMemory({
    keyPrefix,
    points: max,
    duration: windowSeconds,
  });

  return async function rateLimitMiddleware(req, res, next) {
    if (process.env.NODE_ENV !== "production" && req.headers["x-load-test-bypass"] === "true") {
      return next();
    }
    const key = req.ip || "unknown";

    const redis = getRedisClient();
    
    // Initialize Redis limiter on first use if Redis is connected
    if (redis && !redisLimiter && redis.status === 'ready') {
      redisLimiter = new RateLimiterRedis({
        storeClient: redis,
        keyPrefix: `rlflx:${keyPrefix}`,
        points: max,
        duration: windowSeconds,
        inmemoryBlockOnConsumed: max + 1, // Prevent Redis overload on blocked IPs
      });
    }

    try {
      if (redisLimiter && redis && redis.status === 'ready') {
        await redisLimiter.consume(key, 1);
      } else {
        if (process.env.NODE_ENV === "production" && !redis) {
          // eslint-disable-next-line no-console
          console.warn(`[rateLimit] Redis is disabled in production. Using memory limit for ${keyPrefix}. This is not horizontally scalable!`);
        }
        await memoryLimiter.consume(key, 1);
      }
      return next();
    } catch (rejRes) {
      if (rejRes instanceof Error) {
        // Some redis error happened
        // eslint-disable-next-line no-console
        console.warn(`[rateLimit] Cache error on key ${keyPrefix}:${key}:`, rejRes.message);
        if (process.env.NODE_ENV === "production") {
          // Fail open so service stays up
          return next();
        }
      } else {
        // Rate limit exceeded
        const secs = Math.round(rejRes.msBeforeNext / 1000) || 1;
        res.set("Retry-After", String(secs));
        return res.status(429).json({ message: "Too many requests" });
      }
    }
  };
}

