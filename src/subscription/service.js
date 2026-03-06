import Razorpay from "razorpay";
import crypto from "crypto";
import { pool } from "../dbClient.js";
import { env } from "../config/env.js";
import { getRedisClient } from "../redis/client.js";

// Export the singleton
export const razorpay = new Razorpay({
  key_id: env.razorpayKeyId || "test_key",
  key_secret: env.razorpayKeySecret || "test_secret",
});

const PLANS = {
  STARTER: { amount: 0, days: 7, isTrial: true },
  PRO: { amount: 700, days: 30 },
};

export function getAvailablePlans() {
  return PLANS;
}

export async function getCurrentSubscription(restaurantId) {
  const result = await pool.query(
    `SELECT plan, subscription_valid_until AS "subscriptionValidUntil", subscription_status AS "subscriptionStatus"
     FROM restaurants WHERE id = $1`,
    [restaurantId]
  );
  
  const subData = result.rows[0];

  // Check if they have ever used the STARTER plan
  const starterCheck = await pool.query(
    `SELECT id FROM subscriptions WHERE restaurant_id = $1 AND plan = 'STARTER'`,
    [restaurantId]
  );
  
  // They are eligible ONLY if they have never had a STARTER record AND their current plan is not PRO
  const isEligibleForTrial = starterCheck.rows.length === 0 && subData?.plan !== 'PRO';
  
  return {
    ...subData,
    isEligibleForTrial
  };
}

export async function createSubscriptionOrder(restaurantId, planId) {
  const plan = PLANS[planId];
  if (!plan) throw new Error("Invalid plan");

  // If it's the free STARTER trial, bypass Razorpay and activate instantly
  if (plan.amount === 0) {
    // Check if they ever had a STARTER subscription
    const existingStarter = await pool.query(
      `SELECT id FROM subscriptions WHERE restaurant_id = $1 AND plan = 'STARTER' AND status = 'ACTIVE'`,
      [restaurantId]
    );

    if (existingStarter.rows.length > 0) {
      throw new Error("You have already used the 7-day Starter trial.");
    }

    // Insert active subscription record
    await pool.query(
      `INSERT INTO subscriptions (restaurant_id, plan, amount, currency, start_date, end_date, status)
       VALUES ($1, $2, 0, 'INR', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + ($3 || ' days')::interval, 'ACTIVE')`,
      [restaurantId, planId, plan.days]
    );

    // Update restaurant validity
    const d = new Date();
    d.setDate(d.getDate() + plan.days);
    
    await pool.query(
      `UPDATE restaurants 
       SET subscription_valid_until = $1, subscription_status = 'ACTIVE', plan = $2
       WHERE id = $3`,
      [d, planId, restaurantId]
    );

    const redis = getRedisClient();
    if (redis) await redis.del(`sub:status:${restaurantId}`);

    return { isFree: true, validUntil: d, message: "Starter trial activated successfully." };
  }

  // Create Razorpay order
  const options = {
    amount: plan.amount * 100, // in paise
    currency: "INR",
    receipt: `rcpt_${restaurantId.split('-')[0]}_${Date.now()}`.substring(0, 40),
  };

  let order;
  try {
    order = await razorpay.orders.create(options);
  } catch (err) {
    if ((env.razorpayKeyId || "test_key") === "test_key" || !env.razorpayKeyId.startsWith("rzp_")) {
      // Mock order for dev if Razorpay fails without real keys
      order = { id: `mock_order_${Date.now()}` };
    } else {
      console.error("Razorpay order creation failed:", err);
      throw err;
    }
  }

  // Record in DB
  const result = await pool.query(
    `INSERT INTO subscriptions (restaurant_id, plan, amount, currency, end_date, razorpay_order_id, status)
     VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP + ($5 || ' days')::interval, $6, 'PENDING')
     RETURNING id, razorpay_order_id AS "razorpayOrderId", amount, currency`,
    [restaurantId, planId, plan.amount, "INR", plan.days, order.id]
  );

  return { ...result.rows[0], keyId: env.razorpayKeyId || "test_key", isFree: false };
}

export async function verifyPaymentAndActivate(restaurantId, razorpayOrderId, razorpayPaymentId, razorpaySignature) {
  const keySecret = env.razorpayKeySecret || "test_secret";
  
  if (keySecret !== "test_secret" && !razorpayOrderId.startsWith("mock_")) {
    // SEC-2: For client-side verification, the signature is: HMAC(orderId | paymentId, keySecret).
    // This is correct for the Razorpay checkout flow where the signature is returned to the client.
    // For server-to-server webhook endpoints, req.rawBody (Buffer captured in body parser) must be
    // used instead of re-serialized JSON (req.body). No server webhook route exists yet — when added,
    // use: crypto.createHmac('sha256', webhookSecret).update(req.rawBody).digest('hex').
    const body = razorpayOrderId + "|" + razorpayPaymentId;
    const expectedSignature = crypto
      .createHmac("sha256", keySecret)
      .update(body.toString())
      .digest("hex");

    if (expectedSignature !== razorpaySignature) {
      await pool.query(
        `UPDATE subscriptions SET status = 'FAILED', failure_reason = 'Invalid signature' WHERE razorpay_order_id = $1`,
        [razorpayOrderId]
      );
      throw new Error("Invalid payment signature");
    }

    // Double check with Razorpay API directly to explicitly block cancelled/failed transactions 
    // that might theoretically have valid signatures from other flows
    const payment = await razorpay.payments.fetch(razorpayPaymentId);
    if (payment.status !== 'captured') {
        await pool.query(
          `UPDATE subscriptions SET status = 'FAILED', failure_reason = $1 WHERE razorpay_order_id = $2`,
          [`Payment not captured. Status: ${payment.status}`, razorpayOrderId]
        );
        throw new Error(`Payment is not completely successful. Status: ${payment.status}`);
    }
  }

  // Update subscription record
  const subResult = await pool.query(
    `UPDATE subscriptions 
     SET status = 'ACTIVE', razorpay_payment_id = $1, razorpay_signature = $2 
     WHERE razorpay_order_id = $3 AND status = 'PENDING'
     RETURNING id, plan, end_date AS "endDate"`,
    [razorpayPaymentId, razorpaySignature, razorpayOrderId]
  );
  
  if (subResult.rows.length === 0) {
    throw new Error("Subscription order not found or already processed");
  }

  const sub = subResult.rows[0];

  // Extend restaurant's validity
  const restResult = await pool.query(
    `SELECT subscription_valid_until AS "validUntil" FROM restaurants WHERE id = $1`,
    [restaurantId]
  );
  const currentValid = restResult.rows[0]?.validUntil;
  
  let newValidUntil;
  if (!currentValid || new Date(currentValid) < new Date()) {
    const days = PLANS[sub.plan]?.days || 30;
    const d = new Date();
    d.setDate(d.getDate() + days);
    newValidUntil = d;
  } else {
    // Append
    const days = PLANS[sub.plan]?.days || 30;
    const d = new Date(currentValid);
    d.setDate(d.getDate() + days);
    newValidUntil = d;
  }

  await pool.query(
    `UPDATE restaurants 
     SET subscription_valid_until = $1, subscription_status = 'ACTIVE', plan = $2
     WHERE id = $3`,
    [newValidUntil, sub.plan, restaurantId]
  );

  const redis = getRedisClient();
  if (redis) await redis.del(`sub:status:${restaurantId}`);

  return { success: true, validUntil: newValidUntil };
}

export async function getSubscriptionHistory(restaurantId) {
  const result = await pool.query(
    `SELECT id, plan, amount, currency, start_date AS "startDate", end_date AS "endDate", status, created_at AS "createdAt"
     FROM subscriptions 
     WHERE restaurant_id = $1
     ORDER BY created_at DESC`,
    [restaurantId]
  );
  return result.rows;
}
