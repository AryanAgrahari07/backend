import express from "express";
import { z } from "zod";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth, requireRole, requireRestaurantOwnership } from "../middleware/auth.js";
import { requireActiveSubscription } from "../middleware/subscriptionBlocked.js";
import { rateLimit } from "../middleware/rateLimit.js";
import {
  createTransaction,
  listTransactions,
  getTransaction,
  streamTransactionsCSV,
  getRecentTransactionsSummary,
} from "./service.js";

const router = express.Router({ mergeParams: true });

const createTransactionSchema = z.object({
  orderId: z.string().uuid(),
  billNumber: z.string().min(1).max(50),
  paymentMethod: z.enum(["CASH", "UPI", "CARD", "WALLET", "OTHER"]),
  paymentReference: z.string().max(100).optional(),
  combinedSubtotal: z.number().optional(),
  combinedGst: z.number().optional(),
  combinedService: z.number().optional(),
  combinedTotal: z.number().optional(),
});

const listTransactionsQuerySchema = z.object({
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  paymentMethod: z.enum(["CASH", "UPI", "CARD", "WALLET", "OTHER"]).optional(),
  search: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

const exportCSVQuerySchema = z.object({
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  paymentMethod: z.enum(["CASH", "UPI", "CARD", "WALLET", "OTHER"]).optional(),
});

export function registerTransactionRoutes(app) {
  app.use(
    "/api/restaurants/:restaurantId/transactions",
    requireAuth,
    requireRestaurantOwnership, // H1: Tenant isolation — prevent cross-restaurant transaction access
    requireActiveSubscription,
    router
  );

  // Create transaction (when order is paid)
  router.post(
    "/",
    requireRole("owner", "admin", "platform_admin", "WAITER"),
    rateLimit({ keyPrefix: "transactions:create", windowSeconds: 60, max: 200 }),
    asyncHandler(async (req, res) => {
      const { restaurantId } = req.params;
      const parsed = createTransactionSchema.safeParse(req.body);

      if (!parsed.success) {
        return res.status(400).json({
          message: "Invalid transaction data",
          errors: parsed.error.errors,
        });
      }

      try {
        const transaction = await createTransaction(restaurantId, parsed.data.orderId, parsed.data);
        res.status(201).json({ transaction });
      } catch (error) {
        console.error("Transaction creation error:", error);
        res.status(400).json({
          message: error.message || "Failed to create transaction",
        });
      }
    })
  );

  // List transactions with pagination and search
  router.get(
    "/",
    requireRole("owner", "admin", "platform_admin", "WAITER"),
    rateLimit({ keyPrefix: "transactions:list", windowSeconds: 60, max: 200 }),
    asyncHandler(async (req, res) => {
      const { restaurantId } = req.params;
      const parsed = listTransactionsQuerySchema.safeParse(req.query);

      if (!parsed.success) {
        return res.status(400).json({
          message: "Invalid query parameters",
          errors: parsed.error.errors,
        });
      }

      const result = await listTransactions(restaurantId, parsed.data);
      res.json(result);
    })
  );

  // Export transactions as CSV
  router.get(
    "/export/csv",
    requireRole("owner", "admin", "platform_admin"),
    rateLimit({ keyPrefix: "transactions:export", windowSeconds: 60, max: 10 }),
    asyncHandler(async (req, res) => {
      const { restaurantId } = req.params;
      const parsed = exportCSVQuerySchema.safeParse(req.query);

      if (!parsed.success) {
        return res.status(400).json({
          message: "Invalid query parameters",
          errors: parsed.error.errors,
        });
      }

      // Set headers for file download and chunked transfer
      const filename = `transactions_${new Date().toISOString().split('T')[0]}.csv`;
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Transfer-Encoding', 'chunked');

      // The streamTransactionsCSV handles the looping through data and chunks directly to the response
      await streamTransactionsCSV(restaurantId, { ...parsed.data, search: req.query.search }, res);
    })
  );

  router.get(
      "/recent",
      requireRole("owner", "admin", "platform_admin", "WAITER"),
      rateLimit({ keyPrefix: "transactions:recent", windowSeconds: 60, max: 200 }),
      asyncHandler(async (req, res) => {
        const { restaurantId } = req.params;
        const limit = parseInt(req.query.limit) || 5;

        const recentTransactions = await getRecentTransactionsSummary(restaurantId, limit);
        res.json({ transactions: recentTransactions });
      })
    );

  // Get specific transaction
  router.get(
    "/:transactionId",
    requireRole("owner", "admin", "platform_admin", "WAITER"),
    rateLimit({ keyPrefix: "transactions:get", windowSeconds: 60, max: 200 }),
    asyncHandler(async (req, res) => {
      const { restaurantId, transactionId } = req.params;
      const transaction = await getTransaction(restaurantId, transactionId);

      if (!transaction) {
        return res.status(404).json({ message: "Transaction not found" });
      }

      res.json({ transaction });
    })
  );
}