import { Pool } from "pg";
import { env } from "./config/env.js";

/**
 * Postgres connection pooling (application-level).
 *
 * PgBouncer is deployed in transaction pooling mode (see docker-compose.yml).
 * The API instances connect to PgBouncer (which runs on port 6432) instead of
 * directly to Postgres, allowing us to horizontally scale the number of API nodes
 * without exhausting the underlying PostgreSQL connection limits.
 */
export function createPgPool(connectionString = env.databaseUrl) {
  if (!connectionString) {
    throw new Error("DATABASE_URL is required");
  }

  // C3/SCALE-8: Connection pool values optimized for PgBouncer / high scale
  // With PgBouncer in transaction mode, the internal API pool still needs keepAlive: true
  // and a max value that suits the API's concurrency. PgBouncer will multiplex
  // these virtual connections down to the actual DB.
  const max = Number(process.env.PG_POOL_MAX || "25"); 
  const idleTimeoutMillis = Number(process.env.PG_POOL_IDLE_MS || "30000"); // 30s idle
  const connectionTimeoutMillis = Number(process.env.PG_POOL_CONN_TIMEOUT_MS || "5000");

  const pool = new Pool({
    connectionString,
    max,
    idleTimeoutMillis,
    connectionTimeoutMillis,
    statement_timeout: 25000, 
    query_timeout: 25000,
    keepAlive: true, // Crucial for load balancers / PgBouncer
  });

  pool.on("error", (err) => {
    // eslint-disable-next-line no-console
    console.error("[pg] pool error", err);
  });

  // O3: Configure log thresholds for slow queries
  const originalQuery = pool.query.bind(pool);
  pool.query = async (...args) => {
    const start = Date.now();
    try {
      return await originalQuery(...args);
    } finally {
      const duration = Date.now() - start;
      if (duration > 200) { // Log queries taking longer than 200ms
        const queryText = typeof args[0] === 'string' ? args[0] : args[0]?.text;
        console.warn(`[Slow Query] Executed in ${duration}ms: ${queryText?.slice(0, 500) || 'Unknown'}`);
      }
    }
  };

  return pool;
}

