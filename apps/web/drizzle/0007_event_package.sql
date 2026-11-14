CREATE TYPE "public"."package_status" AS ENUM('setup', 'paid', 'live', 'ended', 'expired', 'refunded');--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid
);
--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "plan" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "occasions" ADD COLUMN "package_status" "package_status" DEFAULT 'setup' NOT NULL;--> statement-breakpoint
ALTER TABLE "occasions" ADD COLUMN "paid_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "occasions" ADD COLUMN "comped_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "occasions" ADD COLUMN "opens_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "occasions" ADD COLUMN "closes_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "occasions" ADD COLUMN "time_zone" text DEFAULT 'Europe/London' NOT NULL;--> statement-breakpoint
ALTER TABLE "occasions" ADD COLUMN "delete_after" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "occasions" ADD COLUMN "ended_email_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "occasions" ADD COLUMN "reminder_30_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "occasions" ADD COLUMN "reminder_7_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "occasions" ADD COLUMN "fair_use_alerted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "occasions" ADD COLUMN "stripe_checkout_session_id" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "kind" text DEFAULT 'event_package' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "stripe_payment_intent_id" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "livemode" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "paid_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "refunded_at" timestamp with time zone;--> statement-breakpoint
-- Hand-added: rows from the old one-off per-event plans are not event packages (keeps admin revenue honest).
UPDATE "orders" SET "kind" = 'legacy_plan' WHERE "plan" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_updated_by_hosts_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."hosts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "occasions_package_idx" ON "occasions" USING btree ("package_status","closes_at");--> statement-breakpoint
CREATE INDEX "occasions_delete_after_idx" ON "occasions" USING btree ("delete_after");--> statement-breakpoint
CREATE INDEX "orders_payment_intent_idx" ON "orders" USING btree ("stripe_payment_intent_id");--> statement-breakpoint
CREATE INDEX "orders_occasion_idx" ON "orders" USING btree ("occasion_id");