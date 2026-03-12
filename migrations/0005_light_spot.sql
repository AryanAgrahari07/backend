ALTER TABLE "guest_queue" ADD COLUMN "assigned_table_id" varchar;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "order_number" integer;--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "order_counter" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "guest_queue" ADD CONSTRAINT "guest_queue_assigned_table_id_tables_id_fk" FOREIGN KEY ("assigned_table_id") REFERENCES "public"."tables"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "orders_restaurant_order_number_idx" ON "orders" USING btree ("restaurant_id","order_number");