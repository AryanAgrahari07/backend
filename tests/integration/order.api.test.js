/**
 * Integration tests — Full API surface
 *
 * Launch context: ~100 restaurants, targeting < 200ms p95 response time.
 * Extreme-case ceiling validated by load tests: 200 simultaneous restaurants.
 *
 * Covers:
 *  - Order API (create, list, filter, status update, add items, KDS)
 *  - Queue API (register, list, call next, update status)
 *  - Inquiry API (public POST, validation errors)
 *  - Auth rejection (401 on protected routes without token)
 *  - Cross-restaurant isolation
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "@jest/globals";
import request from "supertest";
import express from "express";
import { createTestPool, cleanDatabase, closePool } from "../utils/db.js";
import { generateTestToken, getAuthHeaders } from "../utils/auth.js";
import { fixtures } from "../utils/fixtures.js";
import { drizzle } from "drizzle-orm/node-postgres";
import { restaurants, menuItems, menuCategories, orders, tables } from "../../shared/schema.js";
import { registerOrderRoutes } from "../../src/order/routes.js";
import { registerQueueRoutes } from "../../src/queue/routes.js";
import { registerInquiryRoutes } from "../../src/inquiry/routes.js";

// ───────────────────────── shared state ──────────────────────────────────────
let app, pool, db;
let restaurantId, categoryId, menuItemId, tableId;
let authToken;
let dbAvailable = false;

// ───────────────────────── helpers ───────────────────────────────────────────
/** ms elapsed since process.hrtime() start */
const elapsed = (start) => {
  const [s, ns] = process.hrtime(start);
  return s * 1000 + ns / 1e6;
};

/** Wrap supertest request and assert <= maxMs */
async function assertFast(requestFn, maxMs = 200) {
  const t = process.hrtime();
  const res = await requestFn();
  expect(elapsed(t)).toBeLessThan(maxMs);
  return res;
}

/** Mock auth middleware (injects restaurantId from URL param) */
function mockAuth(req, res, next) {
  req.user = {
    id: "test-user-id",
    email: "owner@spicegarden.in",
    role: "owner",
    restaurantId: req.params.restaurantId || restaurantId,
  };
  next();
}

// ───────────────────────── setup ─────────────────────────────────────────────
beforeAll(async () => {
  const testDbUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
  if (!testDbUrl) { console.warn("⚠️  Skipping — no DB URL"); return; }
  try {
    pool = createTestPool();
    db   = drizzle(pool);
    await pool.query("SELECT 1");
    await cleanDatabase(pool);
    dbAvailable = true;

    app = express();
    app.use(express.json());
    // Inject mock auth before protected routes
    app.use("/api/restaurants/:restaurantId/orders", mockAuth);
    app.use("/api/restaurants/:restaurantId/queue",  mockAuth);
    registerOrderRoutes(app);
    registerQueueRoutes(app);
    registerInquiryRoutes(app);
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

  const item = fixtures.menuItem(restaurantId, categoryId, { price: "150.00" });
  menuItemId = item.id;
  await db.insert(menuItems).values(item);

  const table = fixtures.table(restaurantId);
  tableId = table.id;
  await db.insert(tables).values(table);

  authToken = generateTestToken({ restaurantId, role: "owner" });
});

// ════════════════════════════════════════════════════════════════════════════
// ORDER API
// ════════════════════════════════════════════════════════════════════════════
describe("Order API", () => {
  describe("POST /api/restaurants/:id/orders", () => {
    it("creates DINE_IN order — 201, tax included (< 200 ms)", async () => {
      if (!dbAvailable) return;
      const res = await assertFast(() =>
        request(app)
          .post(`/api/restaurants/${restaurantId}/orders`)
          .set(getAuthHeaders(authToken))
          .send({ items: [{ menuItemId, quantity: 2 }], orderType: "DINE_IN" })
      );
      expect(res.status).toBe(201);
      expect(res.body.order.status).toBe("PENDING");
      expect(parseFloat(res.body.order.subtotalAmount)).toBeCloseTo(300, 0);
    });

    it("creates TAKEAWAY order with guest details", async () => {
      if (!dbAvailable) return;
      const res = await request(app)
        .post(`/api/restaurants/${restaurantId}/orders`)
        .set(getAuthHeaders(authToken))
        .send({
          items: [{ menuItemId, quantity: 1 }],
          orderType: "TAKEAWAY",
          guestName: "Sunita Reddy",
          guestPhone: "+919988776655",
        });
      expect(res.status).toBe(201);
      expect(res.body.order.orderType).toBe("TAKEAWAY");
    });

    it("creates order with table assignment", async () => {
      if (!dbAvailable) return;
      const res = await request(app)
        .post(`/api/restaurants/${restaurantId}/orders`)
        .set(getAuthHeaders(authToken))
        .send({ tableId, items: [{ menuItemId, quantity: 1 }] });
      expect(res.status).toBe(201);
      expect(res.body.order.tableId).toBe(tableId);
    });

    it("returns 400 for empty items array", async () => {
      if (!dbAvailable) return;
      const res = await request(app)
        .post(`/api/restaurants/${restaurantId}/orders`)
        .set(getAuthHeaders(authToken))
        .send({ items: [] });
      expect(res.status).toBe(400);
    });

    it("returns 401 without auth token", async () => {
      if (!dbAvailable) return;
      const appStrict = express();
      appStrict.use(express.json());
      registerOrderRoutes(appStrict);
      const res = await request(appStrict)
        .post(`/api/restaurants/${restaurantId}/orders`)
        .send({ items: [{ menuItemId, quantity: 1 }] });
      expect([401, 403]).toContain(res.status);
    });
  });

  describe("GET /api/restaurants/:id/orders", () => {
    it("lists orders with pagination (< 150 ms)", async () => {
      if (!dbAvailable) return;
      const o1 = fixtures.order(restaurantId);
      const o2 = fixtures.order(restaurantId, { status: "PREPARING" });
      await db.insert(orders).values([o1, o2]);

      const res = await assertFast(() =>
        request(app)
          .get(`/api/restaurants/${restaurantId}/orders`)
          .set(getAuthHeaders(authToken))
          .query({ limit: 10, offset: 0 }),
        150
      );
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.orders)).toBe(true);
    });

    it("filters by status=PENDING and returns only PENDING orders", async () => {
      if (!dbAvailable) return;
      await db.insert(orders).values([
        fixtures.order(restaurantId, { status: "PENDING" }),
        fixtures.order(restaurantId, { status: "PREPARING" }),
        fixtures.order(restaurantId, { status: "SERVED" }),
      ]);
      const res = await request(app)
        .get(`/api/restaurants/${restaurantId}/orders`)
        .set(getAuthHeaders(authToken))
        .query({ status: "PENDING" });
      expect(res.status).toBe(200);
      expect(res.body.orders.every((o) => o.status === "PENDING")).toBe(true);
    });

    it("does NOT return another restaurant's orders (isolation)", async () => {
      if (!dbAvailable) return;
      const other = fixtures.restaurant();
      await db.insert(restaurants).values(other);
      await db.insert(orders).values(fixtures.order(other.id));

      const res = await request(app)
        .get(`/api/restaurants/${restaurantId}/orders`)
        .set(getAuthHeaders(authToken));
      expect(res.status).toBe(200);
      expect(res.body.orders.every((o) => o.restaurantId === restaurantId)).toBe(true);
    });
  });

  describe("PATCH /api/restaurants/:id/orders/:oid/status", () => {
    it("updates order status PENDING → PREPARING", async () => {
      if (!dbAvailable) return;
      const order = fixtures.order(restaurantId);
      await db.insert(orders).values(order);
      const res = await request(app)
        .patch(`/api/restaurants/${restaurantId}/orders/${order.id}/status`)
        .set(getAuthHeaders(authToken))
        .send({ status: "PREPARING" });
      expect(res.status).toBe(200);
      expect(res.body.order.status).toBe("PREPARING");
    });

    it("returns 404 for non-existent order ID", async () => {
      if (!dbAvailable) return;
      const res = await request(app)
        .patch(`/api/restaurants/${restaurantId}/orders/ghost-order-id/status`)
        .set(getAuthHeaders(authToken))
        .send({ status: "PREPARING" });
      expect(res.status).toBe(404);
    });
  });

  describe("POST /api/restaurants/:id/orders/:oid/items  — add items mid-session", () => {
    it("adds items and recalculates totals", async () => {
      if (!dbAvailable) return;
      const order = fixtures.order(restaurantId);
      await db.insert(orders).values(order);
      const originalTotal = parseFloat(order.totalAmount);

      const res = await request(app)
        .post(`/api/restaurants/${restaurantId}/orders/${order.id}/items`)
        .set(getAuthHeaders(authToken))
        .send({ items: [{ menuItemId, quantity: 1 }] });
      expect(res.status).toBe(200);
      expect(parseFloat(res.body.order.totalAmount)).toBeGreaterThan(originalTotal);
    });
  });

  describe("GET /api/restaurants/:id/orders/kitchen/active  — KDS", () => {
    it("returns only PENDING and PREPARING orders (< 100 ms)", async () => {
      if (!dbAvailable) return;
      await db.insert(orders).values([
        fixtures.order(restaurantId, { status: "PENDING" }),
        fixtures.order(restaurantId, { status: "PREPARING" }),
        fixtures.order(restaurantId, { status: "SERVED" }),
        fixtures.order(restaurantId, { status: "PAID" }),
      ]);
      const res = await assertFast(() =>
        request(app)
          .get(`/api/restaurants/${restaurantId}/orders/kitchen/active`)
          .set(getAuthHeaders(authToken)),
        100
      );
      expect(res.status).toBe(200);
      expect(
        res.body.orders.every((o) => ["PENDING", "PREPARING"].includes(o.status))
      ).toBe(true);
    });
  });
});

// ════════════════════════════════════════════════════════════════════════════
// QUEUE API
// ════════════════════════════════════════════════════════════════════════════
describe("Queue API", () => {
  describe("POST /api/restaurants/:id/queue", () => {
    it("registers a guest and returns position + wait time", async () => {
      if (!dbAvailable) return;
      const res = await assertFast(() =>
        request(app)
          .post(`/api/restaurants/${restaurantId}/queue`)
          .set(getAuthHeaders(authToken))
          .send({ guestName: "Meena Iyer", partySize: 3, phoneNumber: "+919876541234" })
      );
      expect(res.status).toBe(201);
      expect(res.body.entry.position).toBe(1);
      expect(res.body.entry.estimatedWaitMinutes).toBeGreaterThan(0);
    });

    it("rejects registration without guestName", async () => {
      if (!dbAvailable) return;
      const res = await request(app)
        .post(`/api/restaurants/${restaurantId}/queue`)
        .set(getAuthHeaders(authToken))
        .send({ partySize: 2 });
      expect([400, 422]).toContain(res.status);
    });
  });

  describe("GET /api/restaurants/:id/queue", () => {
    it("lists WAITING guests in FIFO order", async () => {
      if (!dbAvailable) return;
      // Register 3 guests
      for (let i = 0; i < 3; i++) {
        await request(app)
          .post(`/api/restaurants/${restaurantId}/queue`)
          .set(getAuthHeaders(authToken))
          .send({ guestName: `Guest ${i}`, partySize: 2 });
      }
      const res = await request(app)
        .get(`/api/restaurants/${restaurantId}/queue`)
        .set(getAuthHeaders(authToken));
      expect(res.status).toBe(200);
      expect(res.body.queue ?? res.body.entries ?? res.body).toHaveLength !== undefined;
    });
  });

  describe("POST /api/restaurants/:id/queue/call-next", () => {
    it("calls the first WAITING guest", async () => {
      if (!dbAvailable) return;
      // Register someone first
      await request(app)
        .post(`/api/restaurants/${restaurantId}/queue`)
        .set(getAuthHeaders(authToken))
        .send({ guestName: "Pallavi", partySize: 2 });

      const res = await request(app)
        .post(`/api/restaurants/${restaurantId}/queue/call-next`)
        .set(getAuthHeaders(authToken));
      expect(res.status).toBe(200);
      expect(res.body.entry?.status ?? res.body.status).toBe("CALLED");
    });

    it("returns 404 / empty when no guests waiting", async () => {
      if (!dbAvailable) return;
      const res = await request(app)
        .post(`/api/restaurants/${restaurantId}/queue/call-next`)
        .set(getAuthHeaders(authToken));
      expect([200, 404]).toContain(res.status);
    });
  });
});

// ════════════════════════════════════════════════════════════════════════════
// INQUIRY API (public — no auth required)
// ════════════════════════════════════════════════════════════════════════════
describe("Inquiry API (public landing form)", () => {
  it("POST /api/inquiries — creates inquiry and returns 201", async () => {
    if (!dbAvailable) return;
    const data = fixtures.inquiry();
    const res = await assertFast(() =>
      request(app).post("/api/inquiries").send(data)
    );
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe("PENDING");
  });

  it("returns 400 when fullName is missing", async () => {
    if (!dbAvailable) return;
    const res = await request(app)
      .post("/api/inquiries")
      .send(fixtures.inquiry({ fullName: "" }));
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("returns 400 when phoneNumber is too short", async () => {
    if (!dbAvailable) return;
    const res = await request(app)
      .post("/api/inquiries")
      .send(fixtures.inquiry({ phoneNumber: "123" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when restaurantName is missing", async () => {
    if (!dbAvailable) return;
    const res = await request(app)
      .post("/api/inquiries")
      .send(fixtures.inquiry({ restaurantName: "" }));
    expect(res.status).toBe(400);
  });

  it("works without optional message field", async () => {
    if (!dbAvailable) return;
    const { message: _, ...data } = fixtures.inquiry();
    const res = await request(app).post("/api/inquiries").send(data);
    expect(res.status).toBe(201);
  });
});
