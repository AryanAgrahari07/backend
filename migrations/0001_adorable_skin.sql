CREATE INDEX "analytics_events_restaurant_event_time_idx" ON "analytics_events" USING btree ("restaurant_id","event_type","occurred_at");--> statement-breakpoint
CREATE INDEX "auth_refresh_tokens_hash_idx" ON "auth_refresh_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "guest_queue_restaurant_status_time_idx" ON "guest_queue" USING btree ("restaurant_id","status","entry_time");--> statement-breakpoint
CREATE INDEX "menu_items_restaurant_id_idx" ON "menu_items" USING btree ("restaurant_id");--> statement-breakpoint
CREATE INDEX "menu_items_category_status_idx" ON "menu_items" USING btree ("restaurant_id","category_id","is_available");--> statement-breakpoint
CREATE INDEX "order_items_order_restaurant_idx" ON "order_items" USING btree ("order_id","restaurant_id");--> statement-breakpoint
CREATE INDEX "orders_restaurant_status_date_idx" ON "orders" USING btree ("restaurant_id","status","created_at");--> statement-breakpoint
CREATE INDEX "orders_restaurant_table_idx" ON "orders" USING btree ("restaurant_id","table_id");--> statement-breakpoint
CREATE INDEX "staff_restaurant_code_idx" ON "staff" USING btree ("restaurant_id","staff_code");--> statement-breakpoint
CREATE INDEX "staff_email_idx" ON "staff" USING btree ("email");--> statement-breakpoint
CREATE INDEX "tables_restaurant_status_idx" ON "tables" USING btree ("restaurant_id","current_status");