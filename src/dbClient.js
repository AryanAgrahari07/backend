import { drizzle } from "drizzle-orm/node-postgres";
import { createPgPool } from "./db.js";
import { env } from "./config/env.js";
import CircuitBreaker from "opossum";

/**
 * Singleton Postgres pool + Drizzle client.
 *
 * IMPORTANT: Do not create new pools in each module. Each pool can open up to
 * PG_POOL_MAX connections. Creating many pools will exhaust Postgres quickly
 * under load or when running multiple API instances.
 *
 * NOTE: In dev (node --watch / hot reload) and in some serverless runtimes,
 * modules can be re-evaluated. Cache the instances on globalThis to avoid
 * accidentally creating multiple pools.
 *
 * TEST MODE: When NODE_ENV=test, readPool is aliased to writePool (no separate
 * read replica in test environments), and the circuit breaker is skipped to
 * avoid false-positive OPEN states from connection failures.
 */

const g      = globalThis;
const isTest = process.env.NODE_ENV === "test";

/** @type {import('pg').Pool | undefined} */
const existingWritePool = g.__qraveWritePool;
const existingReadPool = g.__qraveReadPool;

export const pool = existingWritePool ?? createPgPool(env.databaseWriteUrl); // Alias write pool as default pool
export const writePool = pool;

// In test mode: reuse the same pool for reads — no separate read replica exists
// locally, and a failed connection would trip the circuit breaker for all reads.
export const readPool = isTest
  ? writePool
  : (existingReadPool ?? createPgPool(env.databaseReadUrl));

// Apply circuit breakers to pool.query (isolated read and write breakers).
// Skipped in test mode — circuit breaker on a non-existent replica URL causes
// spurious "Circuit Breaker OPEN" errors that mask real test failures.
if (!g.__qraveCbApplied && !isTest) {
  const breakerOpts = {
    timeout: 10000, // 10s query timeout
    errorThresholdPercentage: 50,
    resetTimeout: 30000 // 30s before trying again
  };

  const writeBreaker = new CircuitBreaker(async (queryFn, ...args) => queryFn(...args), breakerOpts);
  const readBreaker = new CircuitBreaker(async (queryFn, ...args) => queryFn(...args), breakerOpts);

  writeBreaker.fallback(() => { throw new Error("Database Write Service Unavailable (Circuit Breaker OPEN)"); });
  readBreaker.fallback(() => { throw new Error("Database Read Service Unavailable (Circuit Breaker OPEN)"); });

  const originalWriteQuery = writePool.query.bind(writePool);
  writePool.query = async (...args) => writeBreaker.fire(originalWriteQuery, ...args);

  const originalReadQuery = readPool.query.bind(readPool);
  readPool.query = async (...args) => readBreaker.fire(originalReadQuery, ...args);

  // O2: Export Circuit Breaker Prometheus Metrics
  const promClient = await import("prom-client");
  const cbFallbackTotal = new promClient.default.Counter({
    name: "qrave_circuit_breaker_fallbacks_total",
    help: "Total number of fallback executions by circuit breakers",
    labelNames: ["breaker_name", "type"]
  });

  writeBreaker.on("fallback", () => cbFallbackTotal.inc({ breaker_name: "writeBreaker", type: "fallback" }));
  readBreaker.on("fallback", () => cbFallbackTotal.inc({ breaker_name: "readBreaker", type: "fallback" }));
  writeBreaker.on("halfOpen", () => console.warn("[CircuitBreaker] Write circuit is half open"));
  writeBreaker.on("open", () => console.error("[CircuitBreaker] Write circuit is OPEN"));

  g.__qraveCbApplied = true;
}

// Persist for subsequent reloads
g.__qraveWritePool = writePool;
g.__qraveReadPool = readPool;

/** @type {ReturnType<typeof drizzle> | undefined} */
const existingWriteDb = g.__qraveWriteDb;
const existingReadDb = g.__qraveReadDb;

export const db = existingWriteDb ?? drizzle(writePool); // Alias write Db as default Db
export const writeDb = db;
export const readDb = existingReadDb ?? drizzle(readPool);

g.__qraveWriteDb = writeDb;
g.__qraveReadDb = readDb;
