import express from "express";
import { getRedisClient } from "../redis/client.js";
import { cacheGetOrSetJson } from "../redis/cache.js";
import {
  getRestaurantBySlug,
  getMenuForRestaurant,
  createCategory,
  updateCategory,
  deleteCategory,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  setItemAvailability,
  updateMenuItemImage,
  getMenuSuggestions,
} from "./service.js";
import { env } from "../config/env.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth, requireRole, requireRestaurantOwnership } from "../middleware/auth.js";
import { requireActiveSubscription } from "../middleware/subscriptionBlocked.js";
import { z } from "zod";
import { createPresignedUploadUrl, publicFileUrl } from "../media/s3.js";
import { v4 as uuidv4 } from "uuid";
import { rateLimit } from "../middleware/rateLimit.js";
import { getMenuForRestaurantWithCustomizations } from "../customization/service.js";
import { pool } from "../dbClient.js";

export async function invalidateMenuCache(restaurantId) {
  const redis = getRedisClient();
  if (!redis || redis.status !== "ready") return;
  try {
    let slug = await redis.get(`restaurant:${restaurantId}:slug`);
    if (!slug) {
      const r = await pool.query("SELECT slug FROM restaurants WHERE id = $1", [
        restaurantId,
      ]);
      if (!r.rows[0]) return;
      slug = r.rows[0].slug;
      await redis.setex(`restaurant:${restaurantId}:slug`, 86400, slug); // Cache for 24 hours
    }
    const keys = [
      `menu:${slug}:all`,
      `menu:${slug}:veg`,
      `menu:${slug}:non-veg`,
    ];
    await redis.del(...keys);
  } catch (err) {
    console.warn("[cache] Menu cache invalidation failed:", err.message);
  }
}

const router = express.Router();


export function registerMenuRoutes(app) {
  // Public menu by restaurant slug (for /r/:slug) // REL-6 rate limit to prevent DDoS
  router.get(
    "/public/:slug",
    rateLimit({ keyPrefix: "public:menu", windowSeconds: 60, max: 200 }),
    asyncHandler(async (req, res) => {
      const { slug } = req.params;
      const { dietary } = req.query; // Accept 'veg', 'non-veg', or 'any' (default)
      
      // Validate dietary filter
      const dietaryFilter = dietary && (dietary === 'veg' || dietary === 'non-veg') ? dietary : null;
      
      const redisClient = getRedisClient();
      // Include filter in cache key for proper cache separation
      const cacheKey = `menu:${slug}:${dietaryFilter || 'all'}`;
      const ttlSeconds = env.menuCacheTtlSec;

      const producer = async () => {
        const restaurant = await getRestaurantBySlug(slug);
        if (!restaurant) {
          const err = new Error("Restaurant not found");
          err.status = 404;
          throw err;
        }

        const menu = await getMenuForRestaurantWithCustomizations(restaurant.id, dietaryFilter);
        return {
          restaurant,
          ...menu,
        };
      };

      if (redisClient) {
        const data = await cacheGetOrSetJson(redisClient, cacheKey, ttlSeconds, producer);
        // PERF-3: Instruct CDN (CloudFlare) to edge-cache the response
        // Without these headers, CDN always forwards requests to origin even if data is in Redis
        res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
        res.setHeader("Vary", "Accept-Encoding");
        return res.json(data);
      }

      const data = await producer();
      // Even without Redis, set cache headers for CDN
      res.setHeader("Cache-Control", "public, max-age=30, stale-while-revalidate=60");
      res.setHeader("Vary", "Accept-Encoding");
      return res.json(data);
    }),
  );

  // Protected: menu suggestions
  router.get(
    "/suggestions",
    requireAuth,
    requireActiveSubscription,
    requireRole("owner", "admin", "platform_admin"),
    rateLimit({ keyPrefix: "menu:suggestions", windowSeconds: 60, max: 200 }),
    asyncHandler(async (req, res) => {
      const query = req.query.q || "";
      const page = parseInt(req.query.page, 10) || 1;
      const limit = parseInt(req.query.limit, 10) || 20;
      
      const suggestions = await getMenuSuggestions(query, page, limit);
      res.json(suggestions);
    })
  );

  // Protected: category CRUD
  const categorySchema = z.object({
    name: z.string().min(1).max(150),
    sortOrder: z.number().int().optional(),
  });
  const categoryUpdateSchema = categorySchema.partial().extend({
    isActive: z.boolean().optional(),
  });

  router.post(
    "/:restaurantId/categories",
    requireAuth,
    requireActiveSubscription,
    requireRole("owner", "admin", "platform_admin"),
    rateLimit({ keyPrefix: "menu:categories:create", windowSeconds: 60, max: 60 }),
    asyncHandler(async (req, res) => {
      const { restaurantId } = req.params;
      const parsed = categorySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid input", errors: parsed.error.errors });
      }
      const category = await createCategory(restaurantId, parsed.data);
      
      // Invalidate cache for instant updates
      await invalidateMenuCache(restaurantId);
      
      res.status(201).json({ category });
    }),
  );

  router.put(
    "/:restaurantId/categories/:categoryId",
    requireAuth,
    requireActiveSubscription,
    requireRole("owner", "admin", "platform_admin"),
    rateLimit({ keyPrefix: "menu:categories:update", windowSeconds: 60, max: 120 }),
    asyncHandler(async (req, res) => {
      const { restaurantId, categoryId } = req.params;
      const parsed = categoryUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid input", errors: parsed.error.errors });
      }
      const category = await updateCategory(restaurantId, categoryId, parsed.data);
      if (!category) return res.status(404).json({ message: "Not found" });
      
      // Invalidate cache for instant updates
      await invalidateMenuCache(restaurantId);
      
      res.json({ category });
    }),
  );

  router.delete(
    "/:restaurantId/categories/:categoryId",
    requireAuth,
    requireActiveSubscription,
    requireRole("owner", "admin", "platform_admin"),
    rateLimit({ keyPrefix: "menu:categories:delete", windowSeconds: 60, max: 60 }),
    asyncHandler(async (req, res) => {
      const { restaurantId, categoryId } = req.params;
      const category = await deleteCategory(restaurantId, categoryId);
      if (!category) return res.status(404).json({ message: "Not found" });
      
      // Invalidate cache for instant updates
      await invalidateMenuCache(restaurantId);
      
      res.json({ category, deleted: true });
    }),
  );

  // Protected: menu item CRUD
  const menuItemSchema = z.object({
    categoryId: z.string().uuid(),
    name: z.string().min(1).max(200),
    description: z.string().max(4000).optional(),
    price: z.number().positive(),
    imageUrl: z.string().url().optional(),
    isAvailable: z.boolean().optional(),
    dietaryTags: z.array(z.string()).optional(),
    sortOrder: z.number().int().optional(),
  });
  const menuItemUpdateSchema = menuItemSchema.partial();
  const availabilitySchema = z.object({
    isAvailable: z.boolean(),
  });
  const uploadSchema = z.object({
    contentType: z.string().optional(),
  });
  const imagePersistSchema = z.object({
    imageUrl: z.string().url(),
  });

  router.post(
    "/:restaurantId/items",
    requireAuth,
    requireActiveSubscription,
    requireRole("owner", "admin", "platform_admin"),
    rateLimit({ keyPrefix: "menu:items:create", windowSeconds: 60, max: 120 }),
    asyncHandler(async (req, res) => {
      const { restaurantId } = req.params;
      const parsed = menuItemSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid input", errors: parsed.error.errors });
      }
      const item = await createMenuItem(restaurantId, parsed.data);
      
      // Invalidate cache for instant updates
      await invalidateMenuCache(restaurantId);
      
      res.status(201).json({ item });
    }),
  );

  router.put(
    "/:restaurantId/items/:itemId",
    requireAuth,
    requireActiveSubscription,
    requireRole("owner", "admin", "platform_admin"),
    rateLimit({ keyPrefix: "menu:items:update", windowSeconds: 60, max: 240 }),
    asyncHandler(async (req, res) => {
      const { restaurantId, itemId } = req.params;
      const parsed = menuItemUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid input", errors: parsed.error.errors });
      }
      const item = await updateMenuItem(restaurantId, itemId, parsed.data);
      if (!item) return res.status(404).json({ message: "Not found" });
      
      // Invalidate cache for instant updates
      await invalidateMenuCache(restaurantId);
      
      res.json({ item });
    }),
  );

  router.delete(
    "/:restaurantId/items/:itemId",
    requireAuth,
    requireActiveSubscription,
    requireRole("owner", "admin", "platform_admin"),
    rateLimit({ keyPrefix: "menu:items:delete", windowSeconds: 60, max: 120 }),
    asyncHandler(async (req, res) => {
      const { restaurantId, itemId } = req.params;
      const item = await deleteMenuItem(restaurantId, itemId);
      if (!item) return res.status(404).json({ message: "Not found" });
      
      // Invalidate cache for instant updates
      await invalidateMenuCache(restaurantId);
      
      res.json({ item, deleted: true });
    }),
  );

  // Availability toggle
  router.patch(
    "/:restaurantId/items/:itemId/availability",
    requireAuth,
    requireActiveSubscription,
    requireRole("owner", "admin", "platform_admin"),
    rateLimit({ keyPrefix: "menu:items:availability", windowSeconds: 60, max: 300 }),
    asyncHandler(async (req, res) => {
      const { restaurantId, itemId } = req.params;
      const parsed = availabilitySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid input", errors: parsed.error.errors });
      }
      const item = await setItemAvailability(restaurantId, itemId, parsed.data.isAvailable);
      if (!item) return res.status(404).json({ message: "Not found" });
      
      // Invalidate cache for instant updates
      await invalidateMenuCache(restaurantId);
      
      res.json({ item });
    }),
  );

  // S3 image upload URL
  router.post(
    "/:restaurantId/items/:itemId/image/upload-url",
    requireAuth,
    requireActiveSubscription,
    requireRole("owner", "admin", "platform_admin"),
    rateLimit({ keyPrefix: "menu:items:imageUploadUrl", windowSeconds: 60, max: 60 }),
    asyncHandler(async (req, res) => {
      const { restaurantId, itemId } = req.params;
      const parsed = uploadSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid input", errors: parsed.error.errors });
      }
      if (!env.s3Bucket || !env.s3Region) {
        return res.status(500).json({ message: "S3 not configured" });
      }

      const contentType = parsed.data.contentType || "image/jpeg";

      // SEC-3 FIX: Only allow image content types to prevent malicious uploads (JS/HTML/etc)
      const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
      if (!ALLOWED_IMAGE_TYPES.includes(contentType)) {
        return res.status(400).json({ message: "Unsupported file type for menu image upload." });
      }

      const key = `restaurants/${restaurantId}/menu-items/${itemId}/${uuidv4()}`;
      const uploadUrl = await createPresignedUploadUrl({ key, contentType, expiresIn: 300 });
      const publicUrl = publicFileUrl(key);

      res.json({
        uploadUrl,
        key,
        publicUrl,
        expiresIn: 300,
      });
    }),
  );

  // Persist imageUrl after successful upload
  router.put(
    "/:restaurantId/items/:itemId/image",
    requireAuth,
    requireActiveSubscription,
    requireRole("owner", "admin", "platform_admin"),
    rateLimit({ keyPrefix: "menu:items:imagePersist", windowSeconds: 60, max: 120 }),
    asyncHandler(async (req, res) => {
      const { restaurantId, itemId } = req.params;
      const parsed = imagePersistSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid input", errors: parsed.error.errors });
      }
      const item = await updateMenuItemImage(restaurantId, itemId, parsed.data.imageUrl);
      if (!item) return res.status(404).json({ message: "Not found" });
      
      // Invalidate cache for instant updates
      await invalidateMenuCache(restaurantId);
      
      res.json({ item });
    }),
  );

  app.use("/api/menu", router);
}