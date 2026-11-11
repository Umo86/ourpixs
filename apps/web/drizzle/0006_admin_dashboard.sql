CREATE TABLE "admin_audit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_host_id" uuid,
	"admin_email" text NOT NULL,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text,
	"details" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cron_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"ok" boolean,
	"summary" jsonb
);
--> statement-breakpoint
CREATE TABLE "media_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"media_id" uuid NOT NULL,
	"occasion_id" uuid NOT NULL,
	"guest_id" uuid,
	"reason" text,
	"ip_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolved_by" uuid
);
--> statement-breakpoint
ALTER TABLE "hosts" ADD COLUMN "comp_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "hosts" ADD COLUMN "suspended_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "hosts" ADD COLUMN "suspended_reason" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "handled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "occasions" ADD COLUMN "admin_locked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "admin_audit" ADD CONSTRAINT "admin_audit_admin_host_id_hosts_id_fk" FOREIGN KEY ("admin_host_id") REFERENCES "public"."hosts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_reports" ADD CONSTRAINT "media_reports_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_reports" ADD CONSTRAINT "media_reports_occasion_id_occasions_id_fk" FOREIGN KEY ("occasion_id") REFERENCES "public"."occasions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_reports" ADD CONSTRAINT "media_reports_guest_id_guests_id_fk" FOREIGN KEY ("guest_id") REFERENCES "public"."guests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_reports" ADD CONSTRAINT "media_reports_resolved_by_hosts_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."hosts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_audit_created_idx" ON "admin_audit" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "admin_audit_target_idx" ON "admin_audit" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "admin_audit_action_idx" ON "admin_audit" USING btree ("action");--> statement-breakpoint
CREATE INDEX "cron_runs_name_idx" ON "cron_runs" USING btree ("name","started_at");--> statement-breakpoint
CREATE INDEX "media_reports_media_idx" ON "media_reports" USING btree ("media_id");--> statement-breakpoint
CREATE INDEX "media_reports_open_idx" ON "media_reports" USING btree ("resolved_at","created_at");--> statement-breakpoint
CREATE INDEX "hosts_created_idx" ON "hosts" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "media_created_idx" ON "media" USING btree ("created_at");