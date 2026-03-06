-- Migration: 0005_analytics_bigint
-- Purpose: Change analytics_events.id from INTEGER to BIGINT.
-- At 100 restaurants with 500 events/day = 50K/day.
-- At 1K+ restaurants this could overflow within a few years.
-- BIGINT supports 9.2 quintillion — effectively unlimited.
--
-- This migration is safe on PostgreSQL and runs quickly on an empty/small table.
-- For large tables (>10M rows), this may require a maintenance window or
-- adding a new column + backfill strategy. On a fresh deployment, it is instant.

ALTER TABLE analytics_events ALTER COLUMN id TYPE bigint;
