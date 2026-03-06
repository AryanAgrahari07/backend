/**
 * k6 Load Test — OrderJi RMS
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  Launch target : 100 restaurants (realistic)                            │
 * │  Extreme-case  : 200 restaurants simultaneously                         │
 * │                                                                         │
 * │  Concurrency model:                                                     │
 * │    Each restaurant has ≈ 10 active sessions at dinner peak.             │
 * │    100 restaurants × 10 sessions  = 1,000 VUs  (normal dinner peak)    │
 * │    200 restaurants × 10 sessions  = 2,000 VUs  (extreme-case ceiling)  │
 * │                                                                         │
 * │  In reality a "session" is a waiter, kitchen screen, or owner tab open. │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * Operations & expected ratios (per VU iteration):
 *   60% — read: list orders / KDS active view (real-time polling)
 *   25% — write: create order / add items (the critical write path)
 *   10% — update: change order status / call queue guest
 *    5% — public: QR menu scan / register in queue
 *
 * SLO Thresholds:
 *   p95 response time < 200 ms  (API budget)
 *   p99 response time < 500 ms
 *   Error rate        < 0.5%    (99.5% success)
 *   Order creation p95 < 200 ms (write must feel instant)
 *   Read operations p95 < 100 ms (KDS / order polling must be near-instant)
 *
 * Run:
 *   k6 run tests/load/rms-launch.js \
 *     -e BASE_URL=http://localhost:5000 \
 *     -e JWT_TOKEN=<owner-jwt> \
 *     -e RESTAURANT_ID=<uuid> \
 *     -e MENU_ITEM_ID=<uuid>
 */

import http from "k6/http";
import { check, sleep, group } from "k6";
import { Rate, Trend, Counter } from "k6/metrics";

// ─── Custom Metrics ───────────────────────────────────────────────────────────
const orderCreateSuccess  = new Rate("order_create_success");
const orderCreateDuration = new Trend("order_create_duration_ms", true);
const orderReadDuration   = new Trend("order_read_duration_ms", true);
const kdsDuration         = new Trend("kds_duration_ms", true);
const statusUpdateSuccess = new Rate("status_update_success");
const queueRegSuccess     = new Rate("queue_register_success");
const errorCount          = new Counter("errors_total");

// ─── Test Configuration ───────────────────────────────────────────────────────
export const options = {
  scenarios: {
    /**
     * normal_peak: Simulates a realistic Friday dinner rush
     * for 100 restaurants (10 active sessions each = 1,000 VUs).
     */
    normal_peak: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "1m",  target: 200  },  // Ramp up (20 restaurants online)
        { duration: "2m",  target: 600  },  // Ramp up (60 restaurants online)
        { duration: "3m",  target: 1000 },  // Peak: all 100 restaurants active
        { duration: "3m",  target: 1000 },  // Sustained peak (dinner rush)
        { duration: "1m",  target: 400  },  // Ramp down
        { duration: "1m",  target: 0    },  // Cool down
      ],
      gracefulRampDown: "30s",
    },

    /**
     * extreme_case: 200 restaurants simultaneously — stress test.
     * Runs AFTER normal_peak completes.
     */
    extreme_case: {
      executor: "ramping-vus",
      startTime: "12m",  // Start after normal_peak scenario
      startVUs: 0,
      stages: [
        { duration: "2m",  target: 1000 },  // Ramp to 100-restaurant level
        { duration: "2m",  target: 2000 },  // Push to 200-restaurant extreme
        { duration: "2m",  target: 2000 },  // Sustain extreme load
        { duration: "1m",  target: 0    },  // Ramp down
      ],
      gracefulRampDown: "30s",
    },
  },

  thresholds: {
    // ── Global SLOs ─────────────────────────────────────────────────
    http_req_duration:          ["p(95)<200", "p(99)<500"],
    http_req_failed:            ["rate<0.005"],          // < 0.5% errors

    // ── Write path: order creation must feel instant ─────────────────
    order_create_duration_ms:   ["p(95)<200", "p(99)<400"],
    order_create_success:       ["rate>0.995"],          // 99.5% success

    // ── Read path: KDS & order list (real-time polling) ───────────────
    order_read_duration_ms:     ["p(95)<100", "p(99)<200"],
    kds_duration_ms:            ["p(95)<100", "p(99)<150"],

    // ── Status update & queue ─────────────────────────────────────────
    status_update_success:      ["rate>0.99"],
    queue_register_success:     ["rate>0.99"],

    errors_total:               ["count<100"],           // Absolute error budget
  },
};

// ─── Environment Variables ────────────────────────────────────────────────────
const BASE_URL       = (__ENV.BASE_URL       || "http://localhost:5000").replace(/[\r\n"']/g, '').trim();
const JWT_TOKEN      = (__ENV.JWT_TOKEN      || "test-token").replace(/[\r\n"']/g, '').trim();
const RESTAURANT_ID  = (__ENV.RESTAURANT_ID  || "test-restaurant-id").replace(/[\r\n"']/g, '').trim();
const MENU_ITEM_ID   = (__ENV.MENU_ITEM_ID   || "test-menu-item-id").replace(/[\r\n"']/g, '').trim();

const AUTH_HEADERS = {
  Authorization:  `Bearer ${JWT_TOKEN}`,
  "Content-Type": "application/json",
  "x-load-test-bypass": "true",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function rnd(n) { return Math.floor(Math.random() * n); }

function randomOrderPayload() {
  const types = ["DINE_IN", "TAKEAWAY", "DELIVERY"];
  return JSON.stringify({
    items: [{ menuItemId: MENU_ITEM_ID, quantity: rnd(5) + 1 }],
    orderType: types[rnd(types.length)],
    guestName: `Guest ${Math.random().toString(36).slice(2, 7)}`,
  });
}

// ─── Scenario Functions ───────────────────────────────────────────────────────

/** 25% of traffic — create a new order (critical write path) */
function createOrder() {
  const res = http.post(
    `${BASE_URL}/api/restaurants/${RESTAURANT_ID}/orders`,
    randomOrderPayload(),
    { headers: AUTH_HEADERS, tags: { name: "CreateOrder" } }
  );

  const ok = check(res, {
    "create order — 201":           (r) => {
      if (r.status === 403) console.log(`[403 Body] ${r.body.substring(0,200)}`);
      return r.status === 201;
    },
    "create order — has order.id":  (r) => { 
      try { 
        const body = JSON.parse(r.body);
        return !!(body && body.order && body.order.id); 
      } catch (e) { 
        return false; 
      } 
    },
    "create order — p95 < 200ms":   () => res.timings.duration < 200,
  });

  orderCreateSuccess.add(ok);
  orderCreateDuration.add(res.timings.duration);
  if (!ok) errorCount.add(1);

  return res;
}

/** 35% of traffic — list orders (dashboard / waiter view) */
function listOrders() {
  const res = http.get(
    `${BASE_URL}/api/restaurants/${RESTAURANT_ID}/orders?limit=20&offset=0`,
    { headers: AUTH_HEADERS, tags: { name: "ListOrders" } }
  );

  check(res, {
    "list orders — 200":            (r) => r.status === 200,
    "list orders — array present":  (r) => { try { return Array.isArray(JSON.parse(r.body).orders); } catch (e) { return false; } },
  });

  orderReadDuration.add(res.timings.duration);
  return res;
}

/** 25% of traffic — KDS active orders (real-time kitchen polling) */
function getKdsOrders() {
  const res = http.get(
    `${BASE_URL}/api/restaurants/${RESTAURANT_ID}/orders/kitchen/active`,
    { headers: AUTH_HEADERS, tags: { name: "KDS" } }
  );

  check(res, {
    "KDS — 200":          (r) => r.status === 200,
    "KDS — p95 < 100ms":  () => res.timings.duration < 100,
  });

  kdsDuration.add(res.timings.duration);
  return res;
}

/** 10% of traffic — update order status */
function updateOrderStatus(orderId) {
  if (!orderId) return;
  const statuses = ["PREPARING", "READY", "SERVED"];
  const res = http.patch(
    `${BASE_URL}/api/restaurants/${RESTAURANT_ID}/orders/${orderId}/status`,
    JSON.stringify({ status: statuses[rnd(statuses.length)] }),
    { headers: AUTH_HEADERS, tags: { name: "UpdateStatus" } }
  );

  const ok = check(res, { "update status — 200": (r) => r.status === 200 });
  statusUpdateSuccess.add(ok);
  if (!ok) errorCount.add(1);
}

/** 5% of traffic — public QR: guest registers in queue */
function registerInQueue() {
  const res = http.post(
    `${BASE_URL}/api/restaurants/${RESTAURANT_ID}/queue`,
    JSON.stringify({
      guestName: `Diner ${Math.random().toString(36).slice(2, 6)}`,
      partySize: rnd(6) + 1,
      phoneNumber: `+91${Math.floor(9000000000 + Math.random() * 999999999)}`,
    }),
    { headers: AUTH_HEADERS, tags: { name: "QueueRegister" } }
  );

  const ok = check(res, { "queue register — 201": (r) => r.status === 201 });
  queueRegSuccess.add(ok);
  if (!ok) errorCount.add(1);
}

// ─── Main VU Function ─────────────────────────────────────────────────────────
export default function () {
  const roll = Math.random();

  if (roll < 0.35) {
    // 35% — read: list orders (most frequent, dashboard polling)
    group("Read — List Orders", listOrders);

  } else if (roll < 0.60) {
    // 25% — read: KDS polling (kitchen display)
    group("Read — KDS Active", getKdsOrders);

  } else if (roll < 0.85) {
    // 25% — write: create order (the critical path)
    group("Write — Create Order", () => {
      const res = createOrder();
      // If order created, immediately do a status update (realistic waiter flow)
      if (res.status === 201) {
        let orderId = null;
        try { 
          const body = JSON.parse(res.body);
          if (body && body.order && body.order.id) {
            orderId = body.order.id;
          }
        } catch (e) { /* noop */ }
        if (orderId) {
          sleep(0.2);  // brief think time (waiter confirms order)
          updateOrderStatus(orderId);
        }
      }
    });

  } else if (roll < 0.95) {
    // 10% — status update only (kitchen hitting KDS to advance status)
    group("Write — Status Update Only", () => {
      updateOrderStatus(MENU_ITEM_ID); // Will return 404 on fake ID — acceptable
    });

  } else {
    // 5% — public queue registration (guest at door)
    group("Public — Queue Register", registerInQueue);
  }

  // Think time: restaurant staff don't hammer the API continuously
  sleep(0.5 + Math.random() * 1.0);
}

// ─── Setup / Teardown ─────────────────────────────────────────────────────────
export function setup() {
  console.log(`[DEBUG] BASE_URL="${BASE_URL}" JWT_TOKEN_LEN=${JWT_TOKEN.length}`);
  const health = http.get(`${BASE_URL}/healthz/live`);
  console.log(`[DEBUG] health.status=${health.status}`);
  if (health.status !== 200) {
    throw new Error(
      `❌ Health check failed (${health.status}). Is the backend running at ${BASE_URL}?`
    );
  }
  console.log(`✅ API healthy — starting load test against ${BASE_URL}`);
  console.log(`   Restaurant : ${RESTAURANT_ID}`);
  console.log(`   Normal peak: 1,000 VUs (100 restaurants × 10 sessions)`);
  console.log(`   Extreme    : 2,000 VUs (200 restaurants × 10 sessions)`);
  return { baseUrl: BASE_URL };
}

export function teardown(data) {
  console.log(`\n🏁 Load test complete — ${data.baseUrl}`);
  console.log("   Review the thresholds above to determine launch readiness.");
}
