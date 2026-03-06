/**
 * Unit tests — Queue Service
 *
 * Launch context: ~100 restaurants. Extreme ceiling: 200.
 * Peak scenario: friday night dinner rush — 20 parties in queue for a busy restaurant.
 *
 * Validates:
 *  - Guest registration, position assignment, wait-time estimation
 *  - FIFO ordering: oldest WAITING guest gets called first
 *  - Status transitions (WAITING → CALLED → SEATED / CANCELLED)
 *  - Isolation: restaurant A's queue doesn't bleed into restaurant B's
 *  - Latency: queue ops < 150ms (real-time UX requirement)
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "@jest/globals";
import { createTestPool, cleanDatabase, closePool } from "../utils/db.js";
import {
  registerInQueue,
  getQueueEntry,
  updateQueueStatus,
  callNextGuest,
  estimateWaitTime,
} from "../../src/queue/service.js";
import { fixtures } from "../utils/fixtures.js";
import { drizzle } from "drizzle-orm/node-postgres";
import { restaurants } from "../../shared/schema.js";

let pool, db;
let restaurantId;
let dbAvailable = false;

const elapsed = (start) => {
  const [s, ns] = process.hrtime(start);
  return s * 1000 + ns / 1e6;
};

describe("Queue Service — Unit Tests (Launch Scale)", () => {
  beforeAll(async () => {
    const testDbUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
    if (!testDbUrl) { console.warn("⚠️  Skipping — no DB URL"); return; }
    try {
      pool = createTestPool();
      db   = drizzle(pool);
      await pool.query("SELECT 1");
      await cleanDatabase(pool);
      dbAvailable = true;
    } catch (err) {
      console.warn(`⚠️  DB unavailable: ${err.message}`);
    }
  });

  afterAll(async () => { if (pool) await closePool(pool); });

  beforeEach(async () => {
    if (!dbAvailable) return;
    await cleanDatabase(pool);
    const restaurant = fixtures.restaurant();
    restaurantId = restaurant.id;
    await db.insert(restaurants).values(restaurant);
  });

  // ──────────────────────────────────────────────────────────────────────────────
  describe("registerInQueue", () => {
    it("registers first guest with position 1 and a positive wait estimate", async () => {
      if (!dbAvailable) return;
      const t = process.hrtime();
      const entry = await registerInQueue(restaurantId, {
        guestName: "Priya Patel",
        partySize: 2,
        phoneNumber: "+919876543210",
      });
      const ms = elapsed(t);

      expect(entry.guestName).toBe("Priya Patel");
      expect(entry.status).toBe("WAITING");
      expect(entry.position).toBe(1);
      expect(entry.estimatedWaitMinutes).toBeGreaterThan(0);
      expect(ms).toBeLessThan(150);
    });

    it("increments position correctly for multiple guests", async () => {
      if (!dbAvailable) return;
      for (let i = 1; i <= 5; i++) {
        const e = await registerInQueue(restaurantId, { guestName: `Guest ${i}`, partySize: 2 });
        expect(e.position).toBe(i);
      }
    });

    it("larger party gets higher estimated wait", async () => {
      if (!dbAvailable) return;
      const small = await registerInQueue(restaurantId, { guestName: "Small", partySize: 1 });
      const large = await registerInQueue(restaurantId, { guestName: "Large", partySize: 8 });
      // Large party should have >= wait than small (more seats needed)
      expect(large.estimatedWaitMinutes).toBeGreaterThanOrEqual(small.estimatedWaitMinutes);
    });

    it("does NOT mix queues across different restaurants", async () => {
      if (!dbAvailable) return;
      const other = fixtures.restaurant();
      await db.insert(restaurants).values(other);

      // Register 3 guests at restaurant A
      for (let i = 0; i < 3; i++) {
        await registerInQueue(restaurantId, { guestName: `A-${i}`, partySize: 2 });
      }
      // First guest at restaurant B should still be position 1
      const bEntry = await registerInQueue(other.id, { guestName: "B-0", partySize: 2 });
      expect(bEntry.position).toBe(1);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────────
  describe("getQueueEntry", () => {
    it("retrieves entry with correct position (< 100 ms)", async () => {
      if (!dbAvailable) return;
      const entry = await registerInQueue(restaurantId, { guestName: "Vikram", partySize: 3 });

      const t = process.hrtime();
      const result = await getQueueEntry(restaurantId, entry.id);
      const ms = elapsed(t);

      expect(result).toBeDefined();
      expect(result.id).toBe(entry.id);
      expect(result.position).toBeDefined();
      expect(ms).toBeLessThan(100);
    });

    it("returns null for non-existent entry", async () => {
      if (!dbAvailable) return;
      expect(await getQueueEntry(restaurantId, "ghost-id")).toBeNull();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────────
  describe("updateQueueStatus", () => {
    it("transitions WAITING → CALLED → SEATED", async () => {
      if (!dbAvailable) return;
      let entry = await registerInQueue(restaurantId, { guestName: "Anita", partySize: 2 });
      entry = await updateQueueStatus(restaurantId, entry.id, "CALLED");
      expect(entry.status).toBe("CALLED");
      entry = await updateQueueStatus(restaurantId, entry.id, "SEATED");
      expect(entry.status).toBe("SEATED");
    });

    it("supports CANCELLED status", async () => {
      if (!dbAvailable) return;
      const entry = await registerInQueue(restaurantId, { guestName: "Rahul", partySize: 1 });
      const updated = await updateQueueStatus(restaurantId, entry.id, "CANCELLED");
      expect(updated.status).toBe("CANCELLED");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────────
  describe("callNextGuest — FIFO", () => {
    it("calls the oldest WAITING guest first (FIFO)", async () => {
      if (!dbAvailable) return;
      const first = await registerInQueue(restaurantId, { guestName: "First", partySize: 2 });
      await registerInQueue(restaurantId, { guestName: "Second", partySize: 4 });

      const called = await callNextGuest(restaurantId);
      expect(called).toBeDefined();
      expect(called.id).toBe(first.id);
      expect(called.status).toBe("CALLED");
    });

    it("skips non-WAITING guests (already CALLED / SEATED)", async () => {
      if (!dbAvailable) return;
      const first  = await registerInQueue(restaurantId, { guestName: "First", partySize: 2 });
      const second = await registerInQueue(restaurantId, { guestName: "Second", partySize: 2 });

      await updateQueueStatus(restaurantId, first.id, "CALLED");
      // Now callNext should return second (first is already called)
      const next = await callNextGuest(restaurantId);
      expect(next.id).toBe(second.id);
    });

    it("returns null when queue is empty", async () => {
      if (!dbAvailable) return;
      expect(await callNextGuest(restaurantId)).toBeNull();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────────
  describe("estimateWaitTime — realistic dinner rush (20 groups)", () => {
    it("correctly estimates increasing wait time as queue grows", async () => {
      if (!dbAvailable) return;
      const entries = [];
      for (let i = 0; i < 20; i++) {
        entries.push(
          await registerInQueue(restaurantId, { guestName: `Group ${i}`, partySize: (i % 4) + 1 })
        );
      }
      // Each successive group should have >= wait time than the previous
      for (let i = 1; i < entries.length; i++) {
        expect(entries[i].estimatedWaitMinutes).toBeGreaterThanOrEqual(
          entries[i - 1].estimatedWaitMinutes
        );
      }
    });
  });
});
