import Redis from "ioredis";

function parseRedisNodes(nodesString) {
  if (!nodesString) return [];
  return nodesString
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((hostPort) => {
      const [host, portStr] = hostPort.split(":");
      const port = Number(portStr || "6379");
      return { host, port };
    });
}

/**
 * Cluster/Sentinel/Single Redis client factory.
 *
 * Env options:
 * ── Single (default) ──────────────────────────────────────
 *   REDIS_MODE=single  (or omitted)
 *   REDIS_URL=redis://:pass@host:6379/0
 *
 * ── Cluster (Redis Cluster mode) ─────────────────────────
 *   REDIS_MODE=cluster
 *   REDIS_NODES=host1:6379,host2:6379,host3:6379
 *   REDIS_PASSWORD=...  (optional)
 *
 * ── Sentinel (INFRA: HA — recommended for 3-node prod) ───
 *   REDIS_MODE=sentinel
 *   REDIS_SENTINELS=sentinel1:26379,sentinel2:26379,sentinel3:26379
 *   REDIS_SENTINEL_NAME=mymaster        (default: mymaster)
 *   REDIS_PASSWORD=...                  (primary password)
 *   REDIS_SENTINEL_PASSWORD=...         (sentinel auth, if set)
 *
 * ── TLS (any mode) ────────────────────────────────────────
 *   REDIS_TLS=true
 */
export function createRedisClient() {
  const mode = (process.env.REDIS_MODE || "single").toLowerCase();
  const useTls = String(process.env.REDIS_TLS || "").toLowerCase() === "true";

  // ── Sentinel mode: Automatic failover without full Redis Cluster overhead ──
  if (mode === "sentinel") {
    const sentinels = parseRedisNodes(process.env.REDIS_SENTINELS);
    if (sentinels.length === 0) {
      throw new Error(
        "REDIS_MODE=sentinel requires REDIS_SENTINELS=host1:26379,host2:26379,..."
      );
    }

    const name = process.env.REDIS_SENTINEL_NAME || "mymaster";
    const password = process.env.REDIS_PASSWORD;
    const sentinelPassword = process.env.REDIS_SENTINEL_PASSWORD;

    const client = new Redis({
      sentinels,
      name,
      ...(password ? { password } : {}),
      ...(sentinelPassword ? { sentinelPassword } : {}),
      ...(useTls ? { tls: {} } : {}),
      maxRetriesPerRequest: 2,
      enableReadyCheck: true,
    });

    client.on("error", (err) => {
      // eslint-disable-next-line no-console
      console.error("[redis] sentinel error", err.message);
    });

    client.on("+failover-end", () => {
      // eslint-disable-next-line no-console
      console.warn("[redis] HA failover completed — connected to new primary");
    });

    return client;
  }

  // ── Cluster mode ────────────────────────────────────────────────────────────
  if (mode === "cluster") {
    const nodes = parseRedisNodes(process.env.REDIS_NODES);
    if (nodes.length === 0) {
      throw new Error("REDIS_MODE=cluster requires REDIS_NODES=host1:6379,host2:6379,...");
    }

    const password = process.env.REDIS_PASSWORD;

    const cluster = new Redis.Cluster(nodes, {
      redisOptions: {
        ...(password ? { password } : {}),
        ...(useTls ? { tls: {} } : {}),
      },
    });

    cluster.on("error", (err) => {
      // eslint-disable-next-line no-console
      console.error("[redis] cluster error", err.message);
    });

    return cluster;
  }

  // ── Single mode (default / dev) ─────────────────────────────────────────────
  const url = process.env.REDIS_URL || "redis://localhost:6379/0";
  const client = new Redis(url, {
    ...(useTls ? { tls: {} } : {}),
    maxRetriesPerRequest: 2,
    enableReadyCheck: true,
  });

  client.on("error", (err) => {
    // eslint-disable-next-line no-console
    console.error("[redis] error", err.message);
  });

  return client;
}

/**
 * Get or create a singleton Redis client instance.
 * Reusing the same connection is critical for scalability.
 * Returns null if Redis is not configured (graceful degradation).
 */
export function getRedisClient() {
  const g = globalThis;

  if (!("redisClient" in g)) {
    const hasConfig =
      process.env.REDIS_URL ||
      process.env.REDIS_MODE === "cluster" ||
      process.env.REDIS_MODE === "sentinel";

    g.redisClient = hasConfig ? createRedisClient() : null;
  }

  return g.redisClient;
}
