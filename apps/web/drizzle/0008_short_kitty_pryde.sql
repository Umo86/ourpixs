CREATE TYPE "public"."media_processing_status" AS ENUM('pending', 'ready', 'failed');--> statement-breakpoint
CREATE TABLE "guest_purchases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"occasion_id" uuid NOT NULL,
	"guest_id" uuid,
	"email" text,
	"amount_pence" integer NOT NULL,
	"currency" text DEFAULT 'gbp' NOT NULL,
	"stripe_checkout_session_id" text NOT NULL,
	"stripe_payment_intent_id" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"paid_at" timestamp with time zone,
	"refunded_at" timestamp with time zone,
	"download_token_hash" text,
	"token_expires_at" timestamp with time zone,
	"emailed_at" timestamp with time zone,
	"locale" text DEFAULT 'en' NOT NULL,
	"brand" "brand" DEFAULT 'bizimresimler' NOT NULL,
	"livemode" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "guest_purchases_stripe_checkout_session_id_unique" UNIQUE("stripe_checkout_session_id")
);
--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "key_guest" text;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "key_guest_thumb" text;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "key_video" text;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "key_guest_video" text;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "processing_status" "media_processing_status" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "processed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "processing_error" text;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "processing_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "processing_started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "guest_purchases" ADD CONSTRAINT "guest_purchases_occasion_id_occasions_id_fk" FOREIGN KEY ("occasion_id") REFERENCES "public"."occasions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guest_purchases" ADD CONSTRAINT "guest_purchases_guest_id_guests_id_fk" FOREIGN KEY ("guest_id") REFERENCES "public"."guests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "guest_purchases_occasion_idx" ON "guest_purchases" USING btree ("occasion_id");--> statement-breakpoint
CREATE INDEX "guest_purchases_guest_idx" ON "guest_purchases" USING btree ("guest_id");--> statement-breakpoint
CREATE INDEX "guest_purchases_pi_idx" ON "guest_purchases" USING btree ("stripe_payment_intent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "guest_purchases_token_idx" ON "guest_purchases" USING btree ("download_token_hash");--> statement-breakpoint
CREATE INDEX "media_processing_idx" ON "media" USING btree ("processing_status","processing_started_at");