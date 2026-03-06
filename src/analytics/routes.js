import express from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth, requireRole, requireRestaurantOwnership } from "../middleware/auth.js";
import { requireActiveSubscription } from "../middleware/subscriptionBlocked.js";
import { getAnalyticsOverview, getAnalyticsSummary } from "./service.js";
import { getRedisClient } from "../redis/client.js";
import { cacheGetOrSetJson } from "../redis/cache.js";

const router = express.Router({ mergeParams: true });

const validTimeframes = ["day", "month", "quarter", "year"];

export function registerAnalyticsRoutes(app) {
  // Recommended endpoint: rich overview payload for dashboards
  router.get(
    "/:restaurantId/overview",
    requireAuth,
    requireActiveSubscription,
    requireRole("owner", "platform_admin", "admin"),
    asyncHandler(async (req, res) => {
      const { restaurantId } = req.params;
      const { timeframe = "day", timezone } = req.query;

      if (!validTimeframes.includes(timeframe)) {
        return res.status(400).json({
          message: "Invalid timeframe. Must be one of: day, month, quarter, year",
        });
      }

      const redis = getRedisClient();
      const cacheKey = `analytics:overview:${restaurantId}:${timeframe}`;
      const ttl = timeframe === "day" ? 60 : 300; // 1 min for today, 5 min for historical
      
      const fetchAnalytics = () => getAnalyticsOverview(restaurantId, timeframe, { timeZone: timezone });
      const analytics = redis 
         ? await cacheGetOrSetJson(redis, cacheKey, ttl, fetchAnalytics)
         : await fetchAnalytics();

      res.json({ analytics });
    })
  );

  // Backwards-compatible endpoint
  router.get(
    "/:restaurantId/summary",
    requireAuth,
    requireActiveSubscription,
    requireRole("owner", "platform_admin", "admin"),
    asyncHandler(async (req, res) => {
      const { restaurantId } = req.params;
      const { timeframe = "day", timezone } = req.query;

      if (!validTimeframes.includes(timeframe)) {
        return res.status(400).json({
          message: "Invalid timeframe. Must be one of: day, month, quarter, year",
        });
      }

      const redis = getRedisClient();
      const cacheKey = `analytics:summary:${restaurantId}:${timeframe}`;
      const ttl = timeframe === "day" ? 60 : 300; 
      
      const fetchAnalytics = () => getAnalyticsSummary(restaurantId, timeframe, { timeZone: timezone });
      const analytics = redis 
         ? await cacheGetOrSetJson(redis, cacheKey, ttl, fetchAnalytics)
         : await fetchAnalytics();

      res.json({ analytics });
    })
  );

  app.use("/api/analytics", router);
}
