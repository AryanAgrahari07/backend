CREATE TABLE "menu_suggestions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text,
	"price" numeric(10, 2) NOT NULL,
	"image_url" text,
	"category" varchar(150),
	"dietary_tags" varchar(50)[],
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "kot_number" integer;--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "kot_counter" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "menu_suggestions_name_search_idx" ON "menu_suggestions" USING gin (to_tsvector('english', "name"));--> statement-breakpoint
CREATE INDEX "menu_suggestions_category_idx" ON "menu_suggestions" USING btree ("category");--> statement-breakpoint
CREATE INDEX "order_items_restaurant_kot_idx" ON "order_items" USING btree ("restaurant_id","kot_number");