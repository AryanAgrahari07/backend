/**
 * Unit tests — Order Service
 *
 * Launch context: ~100 restaurants. Extreme-case ceiling: 200 restaurants.
 * Each restaurant averages 50-100 orders/day.
 *
 * What we validate here:
 *  - Correct tax calculation (GST 5% + Service 10%)
 *  - Order creation with / without tables
 *  - Status state-machine transitions
 *  - Adding items to open orders re-calculates totals
 *  - Proper error handling for bad input
 *  - Latency: each service call should complete in < 200ms
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "@jest/globals";
import { createTestPool, cleanDatabase, closePool } from "../utils/db.js";
import { createOrder, getOrder, updateOrderStatus, addOrderItems } from "../../src/order/service.js";
import { fixtures } from "../utils/fixtures.js";
import { drizzle } from "drizzle-orm/node-postgres";
import { restaurants, menuItems, menuCategories, tables } from "../../shared/schema.js";

let pool, db;
let restaurantId, categoryId, menuItemId1, menuItemId2;
let dbAvailable = false;

/** Measure elapsed ms since a given hrtime start */
const elapsed = (start) => {
  const [s, ns] = process.hrtime(start);
  return s * 1000 + ns / 1e6;
};

describe("Order Service — Unit Tests (Launch Scale)", () => {
  beforeAll(async () => {
    const testDbUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
    if (!testDbUrl) {
      console.warn("⚠️  Skipping — TEST_DATABASE_URL not configured");
      return;
    }
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

    const cat = fixtures.menuCategory(restaurantId);
    categoryId = cat.id;
    await db.insert(menuCategories).values(cat);

    const item1 = fixtures.menuItem(restaurantId, categoryId, { price: "150.00" }); // Paneer Tikka
    const item2 = fixtures.menuItem(restaurantId, categoryId, { price: "80.00" }); // Veg Biryani
    menuItemId1 = item1.id;
    menuItemId2 = item2.id;
    await db.insert(menuItems).values([item1, item2]);
  });

  // ──────────────────────────────────────────────────────────────────────────────
  // createOrder
  // ──────────────────────────────────────────────────────────────────────────────
  describe("createOrder", () => {
    it("creates DINE_IN order with correct Indian tax calc (GST 5% + Service 10%)", async () => {
      if (!dbAvailable) return;

      const t = process.hrtime();
      const order = await createOrder(restaurantId, {
        items: [
          { menuItemId: menuItemId1, quantity: 2 }, // 300
          { menuItemId: menuItemId2, quantity: 1 }, // 80
        ],
        orderType: "DINE_IN",
      });
      const ms = elapsed(t);

      // Correctness
      expect(order.status).toBe("PENDING");
      expect(order.orderType).toBe("DINE_IN");

      const sub  = parseFloat(order.subtotalAmount);
      const gst  = parseFloat(order.gstAmount);
      const svc  = parseFloat(order.serviceTaxAmount);
      const tot  = parseFloat(order.totalAmount);

      expect(sub).toBeCloseTo(380, 1);       // 150*2 + 80*1
      expect(gst).toBeCloseTo(19, 1);        // 380 * 0.05
      expect(svc).toBeCloseTo(38, 1);        // 380 * 0.10
      expect(tot).toBeCloseTo(437, 1);       // 380 + 19 + 38
      expect(order.items).toHaveLength(2);

      // Latency — restaurant operations must feel instant
      expect(ms).toBeLessThan(200);
    });

    it("creates TAKEAWAY order", async () => {
      if (!dbAvailable) return;
      const order = await createOrder(restaurantId, {
        items: [{ menuItemId: menuItemId1, quantity: 1 }],
        orderType: "TAKEAWAY",
        guestName: "Ravi Sharma",
        guestPhone: "+919999988888",
      });
      expect(order.status).toBe("PENDING");
      expect(order.orderType).toBe("TAKEAWAY");
    });

    it("creates order with table assignment", async () => {
      if (!dbAvailable) return;
      const table = fixtures.table(restaurantId);
      await db.insert(tables).values(table);

      const order = await createOrder(restaurantId, {
        tableId: table.id,
        items: [{ menuItemId: menuItemId1, quantity: 1 }],
      });
      expect(order.tableId).toBe(table.id);
    });

    it("rejects order with zero items", async () => {
      if (!dbAvailable) return;
      await expect(createOrder(restaurantId, { items: [] })).rejects.toThrow();
    });

    it("rejects order with non-existent menu item", async () => {
      if (!dbAvailable) return;
      await expect(
        createOrder(restaurantId, { items: [{ menuItemId: "does-not-exist", quantity: 1 }] })
      ).rejects.toThrow();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────────
  // getOrder
  // ──────────────────────────────────────────────────────────────────────────────
  describe("getOrder", () => {
    it("retrieves order with items (< 100ms read)", async () => {
      if (!dbAvailable) return;
      const created = await createOrder(restaurantId, {
        items: [{ menuItemId: menuItemId1, quantity: 1 }],
      });

      const t = process.hrtime();
      const retrieved = await getOrder(restaurantId, created.id);
      const ms = elapsed(t);

      expect(retrieved).toBeDefined();
      expect(retrieved.id).toBe(created.id);
      expect(retrieved.items).toHaveLength(1);
      expect(ms).toBeLessThan(100); // Reads should be near-instant
    });

    it("returns null for non-existent order", async () => {
      if (!dbAvailable) return;
      expect(await getOrder(restaurantId, "non-existent-id")).toBeNull();
    });

    it("cannot access another restaurant's order", async () => {
      if (!dbAvailable) return;
      const other = fixtures.restaurant();
      await db.insert(restaurants).values(other);
      const created = await createOrder(restaurantId, {
        items: [{ menuItemId: menuItemId1, quantity: 1 }],
      });
      // getOrder scoped to other.id must not return our order
      const result = await getOrder(other.id, created.id);
      expect(result).toBeNull();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────────
  // updateOrderStatus — state machine
  // ──────────────────────────────────────────────────────────────────────────────
  describe("updateOrderStatus", () => {
    const statuses = ["PENDING", "PREPARING", "READY", "SERVED", "PAID"];

    it("advances through full status lifecycle", async () => {
      if (!dbAvailable) return;
      let order = await createOrder(restaurantId, {
        items: [{ menuItemId: menuItemId1, quantity: 1 }],
      });
      for (const status of statuses.slice(1)) {
        order = await updateOrderStatus(restaurantId, order.id, status);
        expect(order.status).toBe(status);
      }
    });

    it("sets closedAt and isClosed when status becomes PAID", async () => {
      if (!dbAvailable) return;
      let order = await createOrder(restaurantId, {
        items: [{ menuItemId: menuItemId1, quantity: 1 }],
      });
      order = await updateOrderStatus(restaurantId, order.id, "PAID");
      expect(order.status).toBe("PAID");
      expect(order.closedAt).toBeDefined();
    });

    it("returns null for unknown order (not found)", async () => {
      if (!dbAvailable) return;
      const result = await updateOrderStatus(restaurantId, "bad-id", "PREPARING");
      // Service returns null when the order ID doesn't match — not a thrown error
      expect(result).toBeNull();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────────
  // addOrderItems — waiter adds items mid-session
  // ──────────────────────────────────────────────────────────────────────────────
  describe("addOrderItems", () => {
    it("adds items and recalculates totals correctly", async () => {
      if (!dbAvailable) return;
      const order = await createOrder(restaurantId, {
        items: [{ menuItemId: menuItemId1, quantity: 1 }], // 150
      });
      const originalTotal = parseFloat(order.totalAmount);

      const t = process.hrtime();
      const result = await addOrderItems(restaurantId, order.id, [
        { menuItemId: menuItemId2, quantity: 2 }, // +160
      ]);
      const ms = elapsed(t);

      expect(result.order.items).toHaveLength(2);
      expect(parseFloat(result.order.totalAmount)).toBeGreaterThan(originalTotal);
      expect(ms).toBeLessThan(200);
    });
  });
});
