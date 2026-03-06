import { WebSocketServer, WebSocket } from "ws";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { setRealtime } from "./emitter.js";
import { randomUUID } from "crypto";
import { register } from "prom-client";
import { getRedisClient } from "../redis/client.js";
import { wsTicketMemoryFallback } from "../auth/wsTicketStore.js";

const INSTANCE_ID = randomUUID();

// SEC-5: Validate UUID format before using as room key
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isValidUUID(str) {
  return typeof str === "string" && UUID_REGEX.test(str);
}

// REL-1: Publish with one retry + exponential backoff
async function publishWithRetry(pub, channel, payload, retries = 1) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      await pub.publish(channel, payload);
      return;
    } catch (err) {
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 200 * Math.pow(2, attempt)));
      } else {
        // Parse only what we need for correlation, not full payload
        try {
          const parsed = JSON.parse(payload);
          console.error("[realtime] Redis pub/sub publish failed after retries", {
            restaurantId: parsed.restaurantId,
            event: parsed.event,
            channel,
            err: err.message,
          });
        } catch {
          console.error("[realtime] Redis pub/sub publish failed", { channel, err: err.message });
        }
      }
    }
  }
}

function restaurantRoom(restaurantId) {
  return `restaurant:${restaurantId}`;
}

function redisChannelForRestaurant(restaurantId) {
  return `rt:restaurant:${restaurantId}`;
}

function safeJsonParse(input) {
  try {
    return JSON.parse(input);
  } catch {
    return null;
  }
}

function isAllowedOrigin(origin) {
  // Some WS clients won't send Origin; accept in dev, but reject in production.
  if (!origin) return !env.isProd;
  if (!env.corsOrigin) return true;
  const allowed = String(env.corsOrigin)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (allowed.includes("*")) return true;
  return allowed.includes(origin);
}

function extractBearerToken(req) {
  const header = req.headers?.authorization || "";
  const [, token] = String(header).split(" ");
  return token || null;
}

function extractTokenFromUrl(req) {
  // BUG-7 FIX: JWT tokens in URLs are logged in server access logs, CDN logs,
  // and browser history — a security exposure.
  // We disable URL tokens entirely if we are using production OR staging environments.
  if (env.isProd || process.env.NODE_ENV === "staging" || process.env.NODE_ENV === "production") return null;


  const host = req.headers?.host || "localhost";
  const url = new URL(req.url || "/", `http://${host}`);
  const token = url.searchParams.get("token");
  return token || null;
}

async function authenticate(req) {
  try {
    const token = extractBearerToken(req) || extractTokenFromUrl(req);
    if (!token) return null;

    // Verify raw JWT for backward compat or admin sessions
    if (token.length > 50 && token.includes(".")) {
      const payload = jwt.verify(token, env.jwtSecret);
      return {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
        restaurantId: payload.restaurantId,
      };
    }

    // Verify Redis Ticket
    const redis = getRedisClient();
    let payloadStr = null;

    if (redis && redis.status === 'ready') {
      payloadStr = await redis.get(`ws:tick:${token}`);
    } else {
      const fallback = wsTicketMemoryFallback.get(token);
      if (fallback && fallback.expiresAt > Date.now()) {
        payloadStr = fallback.payload;
      }
    }

    if (!payloadStr) return null;
    return JSON.parse(payloadStr);
  } catch (err) {
    return null;
  }
}

function isStaffRole(role) {
  return ["owner", "admin", "platform_admin", "WAITER", "KITCHEN"].includes(role);
}

/**
 * Realtime WebSocket gateway (ws).
 *
 * Protocol:
 * - Client connects to: ws://host:PORT/ws?token=JWT
 * - Client then sends:
 *   { "type": "join", "restaurantId": "<uuid>" }
 *
 * Server broadcasts:
 *   { "type": "event", "restaurantId": "<uuid>", "event": "order.created", "data": {...}, "ts": "...", "meta": {...} }
 */
export async function initRealtimeWs(httpServer, { redis = null } = {}) {
  // L7: Enable perMessageDeflate to compress large JSON WS payloads
  const wss = new WebSocketServer({ 
    noServer: true, 
    perMessageDeflate: {
      zlibDeflateOptions: { level: 3 },
      zlibInflateOptions: { chunkSize: 10 * 1024 },
      clientNoContextTakeover: true,
      serverNoContextTakeover: true,
      serverMaxWindowBits: 10,
      concurrencyLimit: 10,
      threshold: 1024 // Only compress payloads > 1KB
    }
  });
  const rooms = new Map(); // roomName -> Set<WebSocket>

  const roomJoin = (ws, room) => {
    const set = rooms.get(room) || new Set();
    set.add(ws);
    rooms.set(room, set);
    ws.__rooms = ws.__rooms || new Set();
    ws.__rooms.add(room);
  };

  const roomLeave = (ws, room) => {
    const set = rooms.get(room);
    if (set) {
      set.delete(ws);
      if (set.size === 0) rooms.delete(room);
    }
    if (ws.__rooms) ws.__rooms.delete(room);
  };

  const roomLeaveAll = (ws) => {
    const rs = ws.__rooms;
    if (!rs) return;
    for (const room of rs) {
      roomLeave(ws, room);
    }
  };

  const broadcastRoom = (room, payload) => {
    const set = rooms.get(room);
    if (!set || set.size === 0) return;
    for (const client of set) {
      if (client.readyState !== WebSocket.OPEN) continue;
      client.send(payload);
    }
  };

  // Optional Redis Pub/Sub for horizontal scaling
  let pub = null;
  let sub = null;
  if (redis) {
    try {
      pub = typeof redis.duplicate === "function" ? redis.duplicate() : redis;
      sub = typeof redis.duplicate === "function" ? redis.duplicate() : redis;

      // Pattern subscribe for all restaurants
      await sub.psubscribe("rt:restaurant:*");
      sub.on("pmessage", (_pattern, channel, message) => {
        const parsed = safeJsonParse(message);
        if (!parsed || parsed.type !== "event") return;
        if (parsed?.meta?.instanceId && parsed.meta.instanceId === INSTANCE_ID) return;

        const restaurantId = parsed.restaurantId;
        if (!restaurantId) return;
        broadcastRoom(restaurantRoom(restaurantId), message);
      });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[realtime] Redis pub/sub not available, falling back to single-node realtime", e);
      pub = null;
      sub = null;
    }
  }

  httpServer.on("upgrade", (req, socket, head) => {
    try {
      const host = req.headers?.host || "localhost";
      const url = new URL(req.url || "/", `http://${host}`);

      if (url.pathname !== "/ws") {
        socket.destroy();
        return;
      }

      const origin = req.headers?.origin;
      if (!isAllowedOrigin(origin)) {
        socket.destroy();
        return;
      }

      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit("connection", ws, req);
      });
    } catch {
      socket.destroy();
    }
  });

  const HEARTBEAT_INTERVAL = 30000;
  setInterval(() => {
    wss.clients.forEach(ws => {
      if (ws.__isAlive === false) { 
        return ws.terminate(); 
      }
      ws.__isAlive = false;
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      }
    });
  }, HEARTBEAT_INTERVAL);

  wss.on("connection", async (ws, req) => {
    ws.__isAlive = true;
    ws.on("pong", () => { ws.__isAlive = true; });

    // REL-3 FIX: Track active WS connections in Prometheus
    const wsGauge = register.getSingleMetric("ws_connections_active");
    if (wsGauge) wsGauge.inc();

    let user = null;
    try {
      user = await authenticate(req);
    } catch {
      user = null;
    }

    ws.__user = user;
    ws.__rooms = new Set();

    ws.send(
      JSON.stringify({
        type: "hello",
        ts: new Date().toISOString(),
        user: user ? { id: user.id, email: user.email, role: user.role } : null,
      }),
    );

    ws.on("message", (raw) => {
      const msg = safeJsonParse(String(raw));
      if (!msg || typeof msg.type !== "string") return;

      if (msg.type === "ping") {
        ws.send(JSON.stringify({ type: "pong", ts: new Date().toISOString() }));
        return;
      }

      if (msg.type === "join") {
        const restaurantId = msg.restaurantId;
        if (!restaurantId) {
          ws.send(JSON.stringify({ type: "error", message: "restaurantId is required" }));
          return;
        }
        // SEC-5: Validate restaurantId is a valid UUID before joining any room
        if (!isValidUUID(restaurantId)) {
          ws.send(JSON.stringify({ type: "error", message: "restaurantId must be a valid UUID" }));
          return;
        }
        if (!ws.__user || !isStaffRole(ws.__user.role)) {
          ws.send(JSON.stringify({ type: "error", message: "Unauthorized" }));
          return;
        }

        // SEC-3: Validate restaurant ownership — staff can only join their own restaurant's room.
        // Platform admins may join any restaurant for monitoring purposes.
        if (
          ws.__user.role !== "platform_admin" &&
          ws.__user.restaurantId &&
          ws.__user.restaurantId !== restaurantId
        ) {
          ws.send(JSON.stringify({ type: "error", message: "Forbidden: you cannot join another restaurant's room" }));
          return;
        }

        roomJoin(ws, restaurantRoom(restaurantId));
        ws.send(JSON.stringify({ type: "joined", restaurantId }));
        return;
      }

      if (msg.type === "leave") {
        const restaurantId = msg.restaurantId;
        if (!restaurantId) return;
        roomLeave(ws, restaurantRoom(restaurantId));
        ws.send(JSON.stringify({ type: "left", restaurantId }));
        return;
      }
    });

    ws.on("close", () => {
      roomLeaveAll(ws);
      // REL-3 FIX: Decrement active WS connections in Prometheus
      const wsGauge = register.getSingleMetric("ws_connections_active");
      if (wsGauge) wsGauge.dec();
    });
  });

  function emitRestaurantEvent(restaurantId, event, data) {
    const payloadObj = {
      type: "event",
      restaurantId,
      event,
      data,
      ts: new Date().toISOString(),
      meta: { instanceId: INSTANCE_ID },
    };
    const payload = JSON.stringify(payloadObj);

    // local broadcast
    broadcastRoom(restaurantRoom(restaurantId), payload);

    // cross-instance broadcast (REL-1: retry once before logging failure)
    if (pub) {
      publishWithRetry(pub, redisChannelForRestaurant(restaurantId), payload);
    }
  }

  // Make emitters available to services
  setRealtime({ emitRestaurantEvent });

  return { emitRestaurantEvent };
}

