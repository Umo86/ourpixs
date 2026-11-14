ALTER TABLE "hosts" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "occasions" ADD COLUMN "unpaid_reminder_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "occasions" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "occasions" ADD COLUMN "deleted_by" text;--> statement-breakpoint
ALTER TABLE "occasions" ADD COLUMN "files_delete_after" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "occasions_files_delete_after_idx" ON "occasions" USING btree ("files_delete_after");--> statement-breakpoint
CREATE INDEX "occasions_setup_created_idx" ON "occasions" USING btree ("package_status","created_at");