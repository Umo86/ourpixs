ALTER TABLE "occasions" ADD COLUMN "setup_reset_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "occasions" ADD COLUMN "refunded_at" timestamp with time zone;--> statement-breakpoint
-- Backfill: events refunded before this migration start their 90-day deletion clock at the package refund (or now).
UPDATE "occasions" o SET "refunded_at" = coalesce(
  (SELECT max(r."refunded_at") FROM "orders" r WHERE r."occasion_id" = o."id" AND r."kind" = 'event_package' AND r."refunded_at" IS NOT NULL),
  now()
) WHERE o."package_status" = 'refunded' AND o."refunded_at" IS NULL;
