-- Migration: 0004_performance_indexes
-- Purpose: Add critical database indexes for scalability at 100+ restaurants.
-- Without these indexes, common queries (kitchen KDS, live orders, queue, floor map)
-- will do full table scans and degrade sharply as data grows.
--
-- Run: psql $DATABASE_URL -f migrations/0004_performance_indexes.sql
-- (Safe to run multiple times due to IF NOT EXISTS)

-- ============================================================================
-- ORDERS: Most critical — kitchen KDS, live orders, status filters
-- ============================================================================

-- Primary access pattern: list orders by restaurant + status + time
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_status
  ON orders(restaurant_id, status, created_at DESC);

-- For live-orders page: filter open orders by restaurant
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_closed_status
  ON orders(restaurant_id, is_closed, status, created_at DESC);

-- For table-specific order lookup (floor map, order creation deduplication)
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_table
  ON orders(restaurant_id, table_id, is_closed)
  WHERE table_id IS NOT NULL;

-- For payment status filtering (transactions page)
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_payment_status
  ON orders(restaurant_id, payment_status, created_at DESC);

-- For staff/waiter filtering (waiter terminal)
CREATE INDEX IF NOT EXISTS idx_orders_placed_by_staff
  ON orders(restaurant_id, placed_by_staff_id, created_at DESC)
  WHERE placed_by_staff_id IS NOT NULL;

-- ============================================================================
-- ORDER_ITEMS: N+1 query prevention — items are always fetched by order_id
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_order_items_order_id
  ON order_items(order_id);

CREATE INDEX IF NOT EXISTS idx_order_items_restaurant
  ON order_items(restaurant_id, order_id);

-- ============================================================================
-- GUEST_QUEUE: Active queue loads, status transitions
-- ============================================================================

-- Primary queue display: waiting guests for a restaurant, ordered by entry time
CREATE INDEX IF NOT EXISTS idx_queue_restaurant_status_time
  ON guest_queue(restaurant_id, status, entry_time ASC);

-- Phone-based status check (public endpoint)
CREATE INDEX IF NOT EXISTS idx_queue_restaurant_phone
  ON guest_queue(restaurant_id, phone_number)
  WHERE phone_number IS NOT NULL;

-- ============================================================================
-- TABLES: Floor map & status lookups
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_tables_restaurant_status
  ON tables(restaurant_id, current_status);

CREATE INDEX IF NOT EXISTS idx_tables_restaurant_active
  ON tables(restaurant_id, is_active);

-- ============================================================================
-- MENU_ITEMS: Public menu page lookups (high traffic CDN-miss path)
-- ============================================================================

-- Public menu: all active items for a restaurant
CREATE INDEX IF NOT EXISTS idx_menu_items_restaurant_available
  ON menu_items(restaurant_id, is_available, is_active, sort_order);

-- Menu items by category (used in category display)
CREATE INDEX IF NOT EXISTS idx_menu_items_category_available
  ON menu_items(category_id, is_available, sort_order);

-- ============================================================================
-- MENU_CATEGORIES: Category ordering per restaurant
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_menu_categories_restaurant_active
  ON menu_categories(restaurant_id, is_active, sort_order);

-- ============================================================================
-- ANALYTICS_EVENTS: Time-series aggregations (dashboard, analytics page)
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_analytics_restaurant_time
  ON analytics_events(restaurant_id, occurred_at DESC);

-- Event type filtering (e.g., "page_view" events only)
CREATE INDEX IF NOT EXISTS idx_analytics_restaurant_type_time
  ON analytics_events(restaurant_id, event_type, occurred_at DESC);

-- ============================================================================
-- STAFF: Login lookups and per-restaurant filtering
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_staff_restaurant_active
  ON staff(restaurant_id, is_active);

-- ============================================================================
-- TRANSACTIONS: Payment history, billing lookups
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_transactions_restaurant_time
  ON transactions(restaurant_id, paid_at DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_order_id
  ON transactions(order_id);

-- ============================================================================
-- AUTH_REFRESH_TOKENS: Token rotation and cleanup
-- (token_hash has UNIQUE constraint which auto-creates an index — skip)
-- ============================================================================

-- Index for cleanup job: expired/revoked tokens
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires
  ON auth_refresh_tokens(expires_at)
  WHERE revoked_at IS NULL;

-- Index for subject lookups (revoke all tokens for a user)
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_subject
  ON auth_refresh_tokens(subject_id, subject_type);

-- ============================================================================
-- SUBSCRIPTIONS: Subscription status lookups
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_subscriptions_restaurant_status
  ON subscriptions(restaurant_id, status, end_date DESC);

-- ============================================================================
-- INVENTORY: Stock level queries
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_inventory_restaurant_active
  ON inventory_items(restaurant_id, is_active);
