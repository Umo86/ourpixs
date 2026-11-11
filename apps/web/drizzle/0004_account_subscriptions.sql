CREATE TYPE "public"."host_plan_status" AS ENUM('none', 'trialing', 'active', 'past_due', 'cancelled', 'expired');--> statement-breakpoint
CREATE TYPE "public"."plan_interval" AS ENUM('month', 'year');--> statement-breakpoint
ALTER TABLE "hosts" ADD COLUMN "plan_status" "host_plan_status" DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "hosts" ADD COLUMN "plan_interval" "plan_interval";--> statement-breakpoint
ALTER TABLE "hosts" ADD COLUMN "trial_started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "hosts" ADD COLUMN "trial_ends_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "hosts" ADD COLUMN "current_period_end" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "hosts" ADD COLUMN "cancel_at_period_end" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "hosts" ADD COLUMN "past_due_since" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "hosts" ADD COLUMN "stripe_subscription_id" text;--> statement-breakpoint
ALTER TABLE "hosts" ADD COLUMN "read_only_since" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "hosts" ADD COLUMN "delete_after" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "hosts" ADD COLUMN "trial_prompt_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "hosts" ADD COLUMN "trial_end_email_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "hosts" ADD COLUMN "deletion_warning_sent_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "hosts_plan_status_idx" ON "hosts" USING btree ("plan_status");--> statement-breakpoint
CREATE INDEX "hosts_stripe_customer_idx" ON "hosts" USING btree ("stripe_customer_id");--> statement-breakpoint
ALTER TABLE "hosts" ADD CONSTRAINT "hosts_stripe_subscription_id_unique" UNIQUE("stripe_subscription_id");--> statement-breakpoint
-- Hosts who already have events start their 3-day trial now (the trial normally starts with the first event).
UPDATE "hosts" SET "plan_status" = 'trialing', "trial_started_at" = now(), "trial_ends_at" = now() + interval '3 days'
WHERE "plan_status" = 'none' AND EXISTS (SELECT 1 FROM "occasions" o WHERE o."owner_id" = "hosts"."id" AND o."status" <> 'archived');