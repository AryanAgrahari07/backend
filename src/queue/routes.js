import express from "express";
import { z } from "zod";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth, requireRole, requireRestaurantOwnership } from "../middleware/auth.js";
import { requireActiveSubscription } from "../middleware/subscriptionBlocked.js";
import { rateLimit } from "../middleware/rateLimit.js";
import {
  registerInQueue,
  getQueueEntry,
  getQueueEntryByPhone,
  listQueue,
  getActiveQueue,
  updateQueueStatus,
  callNextGuest,
  seatGuest,
  cancelQueueEntry,
  getQueueStats,
  getQueueHistory,
  bulkUpdateQueue,
} from "./service.js";

const router = express.Router({ mergeParams: true });

// Validation schemas
const registerQueueSchema = z.object({
  guestName: z.string().min(1).max(150),
  partySize: z.number().int().positive().max(50),
  // SEC-2: Validate phone number format (E.164-compatible, 10-15 digits, optional leading +)
  phoneNumber: z
    .string()
    .max(20)
    .regex(/^\+?[0-9]{10,15}$/, "Invalid phone number — must be 10–15 digits")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  notes: z.string().max(500).optional(),
});

const updateStatusSchema = z.object({
  status: z.enum(["WAITING", "CALLED", "SEATED", "CANCELLED"]),
});

const seatGuestSchema = z.object({
  tableId: z.string().uuid().optional(),
});

const bulkUpdateSchema = z.object({
  updates: z.array(
    z.object({
      id: z.string().uuid(),
      status: z.enum(["WAITING", "CALLED", "SEATED", "CANCELLED"]),
    })
  ).min(1),
});

export function registerQueueRoutes(app) {
  // Public queue registration (no auth required)
  app.post(
    "/api/queue/register/:restaurantId",
    rateLimit({ keyPrefix: "queue:register:public", windowSeconds: 60, max: 20 }),
    asyncHandler(async (req, res) => {
      const { restaurantId } = req.params;
      const parsed = registerQueueSchema.safeParse(req.body);

      if (!parsed.success) {
        return res.status(400).json({
          message: "Invalid registration data",
          errors: parsed.error.errors,
        });
      }

      try {
        const entry = await registerInQueue(restaurantId, parsed.data);
        res.status(201).json({
          entry,
          message: "Successfully added to queue",
        });
      } catch (error) {
        console.error("Queue registration error:", error);
        res.status(400).json({
          message: error.message || "Failed to register in queue",
        });
      }
    })
  );

  // Public queue status check by phone
  app.get(
    "/api/queue/status/:restaurantId",
    rateLimit({ keyPrefix: "queue:status:public", windowSeconds: 60, max: 30 }),
    asyncHandler(async (req, res) => {
      const { restaurantId } = req.params;
      const { phone } = req.query;

      if (!phone) {
        return res.status(400).json({
          message: "Phone number is required",
        });
      }

      const entry = await getQueueEntryByPhone(restaurantId, phone);

      if (!entry) {
        return res.status(404).json({
          message: "No active queue entry found",
        });
      }

      res.json({ entry });
    })
  );

  // Protected queue management routes
  app.use(
    "/api/restaurants/:restaurantId/queue",
    requireAuth,
    requireRestaurantOwnership,
    requireActiveSubscription,
    router
  );

  const listQuerySchema = z.object({
    status: z.string().optional(),
    limit: z.coerce.number().int().positive().max(200).optional().default(50),
    offset: z.coerce.number().int().min(0).optional().default(0),
  });

  // List queue entries
  router.get(
    "/",
    requireRole("owner", "admin", "platform_admin", "WAITER"),
    rateLimit({ keyPrefix: "queue:list", windowSeconds: 60, max: 200 }),
    asyncHandler(async (req, res) => {
      const { restaurantId } = req.params;
      const parsed = listQuerySchema.safeParse(req.query);

      if (!parsed.success) {
        return res.status(400).json({
          message: "Invalid query parameters",
          errors: parsed.error.errors,
        });
      }

      const { status, limit, offset } = parsed.data;

      const filters = { limit, offset };

      if (status) {
        filters.status = status.includes(",") 
          ? status.split(",")
          : status;
      }

      const entries = await listQueue(restaurantId, filters);
      res.json({ entries });
    })
  );

  // Get active queue (WAITING only)
  router.get(
    "/active",
    requireRole("owner", "admin", "platform_admin", "WAITER"),
    rateLimit({ keyPrefix: "queue:active", windowSeconds: 10, max: 600 }),
    asyncHandler(async (req, res) => {
      const { restaurantId } = req.params;
      const entries = await getActiveQueue(restaurantId);
      res.json({ entries });
    })
  );

  // Get specific queue entry
  router.get(
    "/:queueId",
    requireRole("owner", "admin", "platform_admin", "WAITER"),
    rateLimit({ keyPrefix: "queue:get", windowSeconds: 60, max: 200 }),
    asyncHandler(async (req, res) => {
      const { restaurantId, queueId } = req.params;
      const entry = await getQueueEntry(restaurantId, queueId);

      if (!entry) {
        return res.status(404).json({
          message: "Queue entry not found",
        });
      }

      res.json({ entry });
    })
  );

  // Register guest in queue (admin)
  router.post(
    "/",
    requireRole("owner", "admin", "platform_admin", "WAITER"),
    rateLimit({ keyPrefix: "queue:register", windowSeconds: 60, max: 100 }),
    asyncHandler(async (req, res) => {
      const { restaurantId } = req.params;
      const parsed = registerQueueSchema.safeParse(req.body);

      if (!parsed.success) {
        return res.status(400).json({
          message: "Invalid registration data",
          errors: parsed.error.errors,
        });
      }

      try {
        const entry = await registerInQueue(restaurantId, parsed.data);
        res.status(201).json({ entry });
      } catch (error) {
        console.error("Queue registration error:", error);
        res.status(400).json({
          message: error.message || "Failed to register in queue",
        });
      }
    })
  );

  // Update queue entry status
  router.patch(
    "/:queueId/status",
    requireRole("owner", "admin", "platform_admin", "WAITER"),
    rateLimit({ keyPrefix: "queue:status", windowSeconds: 60, max: 300 }),
    asyncHandler(async (req, res) => {
      const { restaurantId, queueId } = req.params;
      const parsed = updateStatusSchema.safeParse(req.body);

      if (!parsed.success) {
        return res.status(400).json({
          message: "Invalid status",
          errors: parsed.error.errors,
        });
      }

      const entry = await updateQueueStatus(
        restaurantId,
        queueId,
        parsed.data.status
      );

      if (!entry) {
        return res.status(404).json({
          message: "Queue entry not found",
        });
      }

      res.json({ entry });
    })
  );

  // Call next guest
  router.post(
    "/call-next",
    requireRole("owner", "admin", "platform_admin", "WAITER"),
    rateLimit({ keyPrefix: "queue:call-next", windowSeconds: 60, max: 200 }),
    asyncHandler(async (req, res) => {
      const { restaurantId } = req.params;
      const entry = await callNextGuest(restaurantId);

      if (!entry) {
        return res.status(404).json({
          message: "No guests waiting in queue",
        });
      }

      res.json({
        entry,
        message: "Guest called successfully",
      });
    })
  );

  // Mark guest as seated
  router.post(
    "/:queueId/seat",
    requireRole("owner", "admin", "platform_admin", "WAITER"),
    rateLimit({ keyPrefix: "queue:seat", windowSeconds: 60, max: 200 }),
    asyncHandler(async (req, res) => {
      const { restaurantId, queueId } = req.params;
      const parsed = seatGuestSchema.safeParse(req.body || {});

      if (!parsed.success) {
        return res.status(400).json({
          message: "Invalid data",
          errors: parsed.error.errors,
        });
      }

      const entry = await seatGuest(
        restaurantId,
        queueId,
        parsed.data.tableId
      );

      if (!entry) {
        return res.status(404).json({
          message: "Queue entry not found",
        });
      }

      res.json({
        entry,
        message: "Guest seated successfully",
      });
    })
  );

  // Cancel queue entry
  router.post(
    "/:queueId/cancel",
    requireRole("owner", "admin", "platform_admin", "WAITER"),
    rateLimit({ keyPrefix: "queue:cancel", windowSeconds: 60, max: 200 }),
    asyncHandler(async (req, res) => {
      const { restaurantId, queueId } = req.params;
      const entry = await cancelQueueEntry(restaurantId, queueId);

      if (!entry) {
        return res.status(404).json({
          message: "Queue entry not found",
        });
      }

      res.json({
        entry,
        message: "Queue entry cancelled",
      });
    })
  );

  // Get queue statistics
  router.get(
    "/stats/summary",
    requireRole("owner", "admin", "platform_admin"),
    rateLimit({ keyPrefix: "queue:stats", windowSeconds: 60, max: 100 }),
    asyncHandler(async (req, res) => {
      const { restaurantId } = req.params;
      const stats = await getQueueStats(restaurantId);
      res.json({ stats });
    })
  );

  const historyQuerySchema = z.object({
    limit: z.coerce.number().int().positive().max(200).optional().default(50),
    offset: z.coerce.number().int().min(0).optional().default(0),
  });

  // Get queue history
  router.get(
    "/history/all",
    requireRole("owner", "admin", "platform_admin"),
    rateLimit({ keyPrefix: "queue:history", windowSeconds: 60, max: 100 }),
    asyncHandler(async (req, res) => {
      const { restaurantId } = req.params;
      const parsed = historyQuerySchema.safeParse(req.query);

      if (!parsed.success) {
        return res.status(400).json({
          message: "Invalid query parameters",
          errors: parsed.error.errors,
        });
      }

      const result = await getQueueHistory(restaurantId, parsed.data);

      res.json(result);
    })
  );

  // Bulk update queue entries
  router.post(
    "/bulk-update",
    requireRole("owner", "admin", "platform_admin"),
    rateLimit({ keyPrefix: "queue:bulk-update", windowSeconds: 60, max: 20 }),
    asyncHandler(async (req, res) => {
      const { restaurantId } = req.params;
      const parsed = bulkUpdateSchema.safeParse(req.body);

      if (!parsed.success) {
        return res.status(400).json({
          message: "Invalid bulk update data",
          errors: parsed.error.errors,
        });
      }

      const entries = await bulkUpdateQueue(
        restaurantId,
        parsed.data.updates
      );

      res.json({
        entries,
        updated: entries.length,
      });
    })
  );
}
