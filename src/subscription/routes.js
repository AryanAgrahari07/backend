import express from "express";
import { requireAuth, requireRestaurantOwnership } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { rateLimit } from "../middleware/rateLimit.js";
import { 
  getCurrentSubscription, 
  createSubscriptionOrder, 
  verifyPaymentAndActivate, 
  getSubscriptionHistory,
  getAvailablePlans
} from "./service.js";
import { env } from "../config/env.js";

const router = express.Router();

export function registerSubscriptionRoutes(app) {
  // Get available plans and pricing
  router.get(
    "/plans",
    rateLimit({ keyPrefix: "sub:plans", windowSeconds: 60, max: 60 }),
    asyncHandler(async (req, res) => {
      res.json(getAvailablePlans());
    })
  );

  // Get current status
  router.get(
    "/:restaurantId/current",
    requireAuth,
    requireRestaurantOwnership,
    rateLimit({ keyPrefix: "sub:current", windowSeconds: 60, max: 30 }),
    asyncHandler(async (req, res) => {
      const sub = await getCurrentSubscription(req.params.restaurantId);
      res.json(sub);
    })
  );

  // Create order
  router.post(
    "/:restaurantId/create-order",
    requireAuth,
    requireRestaurantOwnership,
    rateLimit({ keyPrefix: "sub:create-order", windowSeconds: 60, max: 5 }), // Strict limit on order creation
    asyncHandler(async (req, res) => {
      const { plan } = req.body;
      if (!plan) return res.status(400).json({ message: "Plan is required" });
      const order = await createSubscriptionOrder(req.params.restaurantId, plan);
      res.json(order);
    })
  );

  // Verify
  router.post(
    "/:restaurantId/verify-payment",
    requireAuth,
    requireRestaurantOwnership,
    rateLimit({ keyPrefix: "sub:verify", windowSeconds: 60, max: 5 }), // Strict limit on verification brute-forcing
    asyncHandler(async (req, res) => {
      const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;
      if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
        return res.status(400).json({ message: "Missing Razorpay fields" });
      }
      const result = await verifyPaymentAndActivate(
        req.params.restaurantId, 
        razorpayOrderId, 
        razorpayPaymentId, 
        razorpaySignature
      );
      res.json(result);
    })
  );

  // History
  router.get(
    "/:restaurantId/history",
    requireAuth,
    requireRestaurantOwnership,
    rateLimit({ keyPrefix: "sub:history", windowSeconds: 60, max: 30 }),
    asyncHandler(async (req, res) => {
      const history = await getSubscriptionHistory(req.params.restaurantId);
      res.json(history);
    })
  );

  app.use("/api/subscriptions", router);
}
