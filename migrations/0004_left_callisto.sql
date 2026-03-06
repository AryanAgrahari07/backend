CREATE TYPE "public"."inquiry_status" AS ENUM('PENDING', 'CONTACTED', 'CLOSED');--> statement-breakpoint
CREATE TABLE "inquiries" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"full_name" varchar(150) NOT NULL,
	"phone_number" varchar(30) NOT NULL,
	"restaurant_name" varchar(200) NOT NULL,
	"message" text,
	"status" "inquiry_status" DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "inquiries_status_created_idx" ON "inquiries" USING btree ("status","created_at");