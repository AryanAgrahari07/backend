-- Migration: Human-readable order_number per restaurant
-- order_number is a display-only serial that increments automatically via DB trigger.
-- The UUID `id` column remains the primary key used in all API routes.

-- Step 1: Add the order_number column to orders (nullable so existing rows are unaffected)
ALTER TABLE "orders" ADD COLUMN "order_number" integer;
--> statement-breakpoint

-- Step 2: Create a per-restaurant sequence function using the restaurants table as the counter store
ALTER TABLE "restaurants" ADD COLUMN "order_counter" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint

-- Step 3: Create the trigger function that atomically assigns the next order_number
CREATE OR REPLACE FUNCTION assign_order_number()
RETURNS TRIGGER AS $$
BEGIN
  -- Atomically increment the counter for this restaurant and assign to new order
  UPDATE restaurants
    SET order_counter = order_counter + 1
    WHERE id = NEW.restaurant_id;

  SELECT order_counter INTO NEW.order_number
    FROM restaurants
    WHERE id = NEW.restaurant_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

-- Step 4: Attach trigger on INSERT into orders
DROP TRIGGER IF EXISTS trg_assign_order_number ON orders;
CREATE TRIGGER trg_assign_order_number
  BEFORE INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION assign_order_number();
--> statement-breakpoint

-- Step 5: Backfill existing orders (assign sequential numbers ordered by created_at per restaurant)
WITH numbered AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY restaurant_id ORDER BY created_at ASC) AS rn
  FROM orders
  WHERE order_number IS NULL
)
UPDATE orders
  SET order_number = numbered.rn
  FROM numbered
  WHERE orders.id = numbered.id;
--> statement-breakpoint

-- Step 6: Update order_counter to match the max order_number already assigned
UPDATE restaurants r
  SET order_counter = COALESCE((
    SELECT MAX(o.order_number) FROM orders o WHERE o.restaurant_id = r.id
  ), 0);
--> statement-breakpoint

-- Step 7: Add index for fast lookups by order_number
CREATE INDEX IF NOT EXISTS "orders_restaurant_order_number_idx"
  ON "orders" USING btree ("restaurant_id", "order_number");
