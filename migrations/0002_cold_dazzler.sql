ALTER TABLE "order_items" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now();--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "invoice_counter" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "inventory_items_restaurant_id_idx" ON "inventory_items" USING btree ("restaurant_id");--> statement-breakpoint
CREATE INDEX "menu_categories_restaurant_id_idx" ON "menu_categories" USING btree ("restaurant_id");--> statement-breakpoint
CREATE INDEX "menu_item_variants_restaurant_id_idx" ON "menu_item_variants" USING btree ("restaurant_id");--> statement-breakpoint
CREATE INDEX "menu_item_variants_menu_item_id_idx" ON "menu_item_variants" USING btree ("menu_item_id");--> statement-breakpoint
CREATE INDEX "modifier_groups_restaurant_id_idx" ON "modifier_groups" USING btree ("restaurant_id");--> statement-breakpoint
CREATE INDEX "modifiers_restaurant_id_idx" ON "modifiers" USING btree ("restaurant_id");--> statement-breakpoint
CREATE INDEX "modifiers_group_id_idx" ON "modifiers" USING btree ("modifier_group_id");--> statement-breakpoint
CREATE INDEX "order_items_restaurant_created_idx" ON "order_items" USING btree ("restaurant_id","created_at") WHERE status != 'CANCELLED';--> statement-breakpoint
CREATE INDEX "orders_restaurant_updated_at_idx" ON "orders" USING btree ("restaurant_id","updated_at");--> statement-breakpoint
CREATE INDEX "orders_open_table_idx" ON "orders" USING btree ("restaurant_id","table_id","is_closed") WHERE is_closed = false;--> statement-breakpoint
CREATE INDEX "staff_email_lower_idx" ON "staff" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "subscriptions_restaurant_id_idx" ON "subscriptions" USING btree ("restaurant_id");--> statement-breakpoint
CREATE INDEX "transactions_restaurant_id_idx" ON "transactions" USING btree ("restaurant_id");--> statement-breakpoint
CREATE INDEX "transactions_restaurant_created_idx" ON "transactions" USING btree ("restaurant_id","created_at");--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_order_id_unique" UNIQUE("order_id");