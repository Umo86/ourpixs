ALTER TABLE "days" ADD COLUMN "upload_opens_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "days" ADD COLUMN "upload_closes_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "phash" text;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "blur_score" real;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "moderation_flags" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "occasions" ADD COLUMN "vanity_slug" text;--> statement-breakpoint
ALTER TABLE "occasions" ADD CONSTRAINT "occasions_vanity_slug_unique" UNIQUE("vanity_slug");