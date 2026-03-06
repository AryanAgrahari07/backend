import { pool } from "../dbClient.js";
import { asyncHandler } from "./asyncHandler.js";
import { getRedisClient } from "../redis/client.js";
import { cacheGetOrSetJson } from "../redis/cache.js";

/**
 * Middleware to restrict access if the restaurant's subscription is expired.
 * Should be used AFTER requireAuth so that req.user is populated.
 */
export const requireActiveSubscription = asyncHandler(async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: "Authentication required" });
  }

  if (req.user.role === "platform_admin") {
    return next();
  }

  const targetRestaurantId = req.params.restaurantId || req.body.restaurantId || req.query.restaurantId || req.user.restaurantId || req.headers["x-restaurant-id"];

  if (!targetRestaurantId) {
    return res.status(400).json({ message: "Restaurant ID required for subscription check" });
  }

  const redis = getRedisClient();
  const cacheKey = `sub:status:${targetRestaurantId}`;

  const fetchSubscriptionFromDb = async () => {
    const result = await pool.query(
      `SELECT plan, subscription_valid_until AS "subscriptionValidUntil", subscription_status AS "subscriptionStatus" 
       FROM restaurants WHERE id = $1`,
      [targetRestaurantId]
    );
    return result.rows[0] || null;
  };

  let restaurant = null;
  if (redis) {
    restaurant = await cacheGetOrSetJson(redis, cacheKey, 60, fetchSubscriptionFromDb);
  } else {
    restaurant = await fetchSubscriptionFromDb();
  }

  if (!restaurant) {
    return res.status(404).json({ message: "Restaurant not found" });
  }

  // If status is EXPIRED and validUntil is in the past, block.
  // We'll consider no subscription valid until as implicitly active, or maybe expired by default? 
  // Let's assume if it's explicitly set to past, or status is EXPIRED, it's blocked.
  // Wait, initial users might not have a date. Give them a grace period or assume active if null.
  
  const now = new Date();
  
  if (restaurant.subscriptionValidUntil && new Date(restaurant.subscriptionValidUntil) < now) {
    // Should be expired
    // We update DB status lazily if needed, but for middleware rejecting is fine.
    return res.status(402).json({ 
      error: "SubscriptionExpired",
      message: "Your subscription has expired. Please renew to access this feature.",
      subscriptionValidUntil: restaurant.subscriptionValidUntil
    });
  }

  if (restaurant.subscriptionStatus === "EXPIRED") {
    return res.status(402).json({ 
      error: "SubscriptionExpired",
      message: "Your subscription has expired. Please renew to access this feature.",
    });
  }

  req.restaurantSubscription = restaurant;
  next();
});
