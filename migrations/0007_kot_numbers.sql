-- Migration: Human-readable kot_number per restaurant
-- kot_number is assigned by the application when items are sent to the kitchen.

-- Step 1: Add the kot_number column to order_items
ALTER TABLE "order_items" ADD COLUMN "kot_number" integer;
--> statement-breakpoint

-- Step 2: Add kot_counter to restaurants table
ALTER TABLE "restaurants" ADD COLUMN "kot_counter" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint

-- Step 3: Backfill kot_counter based on existing orders as a simple chronological assignment
-- Since we didn't track batches before, we'll assign one kot_number per order for older items.
WITH order_kots AS (
  SELECT id AS order_id, restaurant_id, order_number AS assigned_kot
  FROM orders
  WHERE order_number IS NOT NULL
)
UPDATE order_items oi
SET kot_number = ok.assigned_kot
FROM order_kots ok
WHERE oi.order_id = ok.order_id AND oi.kot_number IS NULL;
--> statement-breakpoint

-- Step 4: Update kot_counter to match the max order_number (since we mapped KOT to order_number originally)
UPDATE restaurants r
SET kot_counter = (
  SELECT COALESCE(MAX(order_number), 0) FROM orders o WHERE o.restaurant_id = r.id
);
--> statement-breakpoint

-- Step 5: Add index for fast lookups
CREATE INDEX IF NOT EXISTS "order_items_restaurant_kot_idx"
  ON "order_items" USING btree ("restaurant_id", "kot_number");
