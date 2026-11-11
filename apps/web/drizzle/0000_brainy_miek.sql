CREATE TYPE "public"."brand" AS ENUM('ourpixs', 'bizimresimler');--> statement-breakpoint
CREATE TYPE "public"."media_kind" AS ENUM('photo', 'video', 'voice');--> statement-breakpoint
CREATE TYPE "public"."media_status" AS ENUM('pending', 'uploaded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."member_role" AS ENUM('owner', 'cohost');--> statement-breakpoint
CREATE TYPE "public"."message_kind" AS ENUM('text', 'voice', 'video');--> statement-breakpoint
CREATE TYPE "public"."occasion_type" AS ENUM('dugun', 'nisan', 'kina', 'sunnet', 'dogum_gunu', 'bebek', 'mezuniyet', 'yildonumu', 'ev_partisi', 'kurumsal', 'diger');--> statement-breakpoint
CREATE TYPE "public"."plan" AS ENUM('free', 'tek', 'buyuk');--> statement-breakpoint
CREATE TYPE "public"."reveal_mode" AS ENUM('live', 'next_morning');--> statement-breakpoint
CREATE TYPE "public"."share_scope" AS ENUM('view', 'view_upload');--> statement-breakpoint
CREATE TYPE "public"."occasion_status" AS ENUM('draft', 'active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."theme" AS ENUM('noir', 'royal', 'ivory', 'dusk', 'mono', 'blush');--> statement-breakpoint
CREATE TYPE "public"."visibility" AS ENUM('visible', 'hidden', 'deleted');--> statement-breakpoint
CREATE TABLE "cohost_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"occasion_id" uuid NOT NULL,
	"email" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "days" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"occasion_id" uuid NOT NULL,
	"name" text NOT NULL,
	"date" date,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "guests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"occasion_id" uuid NOT NULL,
	"display_name" text NOT NULL,
	"device_token_hash" text NOT NULL,
	"consented_at" timestamp with time zone,
	"shots_taken" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hosts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"locale" text DEFAULT 'en' NOT NULL,
	"brand" "brand" DEFAULT 'ourpixs' NOT NULL,
	"stripe_customer_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hosts_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"data" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "login_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"code_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"occasion_id" uuid NOT NULL,
	"day_id" uuid,
	"guest_id" uuid,
	"uploaded_by_host_id" uuid,
	"mission_id" uuid,
	"kind" "media_kind" NOT NULL,
	"key_original" text NOT NULL,
	"key_display" text,
	"key_thumb" text,
	"mime" text NOT NULL,
	"bytes" bigint NOT NULL,
	"width" integer,
	"height" integer,
	"duration_s" integer,
	"moment_tag" text,
	"from_disposable" boolean DEFAULT false NOT NULL,
	"status" "media_status" DEFAULT 'pending' NOT NULL,
	"visibility" "visibility" DEFAULT 'visible' NOT NULL,
	"approved" boolean DEFAULT true NOT NULL,
	"favourite" boolean DEFAULT false NOT NULL,
	"reaction_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"occasion_id" uuid NOT NULL,
	"guest_id" uuid,
	"kind" "message_kind" DEFAULT 'text' NOT NULL,
	"body" text,
	"media_key" text,
	"duration_s" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "missions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"occasion_id" uuid NOT NULL,
	"title" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "occasion_members" (
	"occasion_id" uuid NOT NULL,
	"host_id" uuid NOT NULL,
	"role" "member_role" DEFAULT 'cohost' NOT NULL,
	CONSTRAINT "occasion_members_occasion_id_host_id_pk" PRIMARY KEY("occasion_id","host_id")
);
--> statement-breakpoint
CREATE TABLE "occasions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"owner_id" uuid NOT NULL,
	"brand" "brand" DEFAULT 'ourpixs' NOT NULL,
	"type" "occasion_type" NOT NULL,
	"title" text NOT NULL,
	"honorees" text[] DEFAULT '{}' NOT NULL,
	"starts_on" date,
	"venue_name" text,
	"city" text,
	"theme" "theme" DEFAULT 'noir' NOT NULL,
	"plan" "plan" DEFAULT 'free' NOT NULL,
	"upload_opens_at" timestamp with time zone,
	"upload_closes_at" timestamp with time zone,
	"reveal_mode" "reveal_mode" DEFAULT 'live' NOT NULL,
	"reveal_at" timestamp with time zone,
	"approval_mode" boolean DEFAULT false NOT NULL,
	"pin_hash" text,
	"cover_key" text,
	"disposable_shots" integer,
	"storage_expires_at" timestamp with time zone,
	"status" "occasion_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "occasions_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"occasion_id" uuid NOT NULL,
	"host_id" uuid NOT NULL,
	"stripe_session_id" text NOT NULL,
	"plan" "plan" NOT NULL,
	"amount_pence" integer NOT NULL,
	"currency" text DEFAULT 'gbp' NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_stripe_session_id_unique" UNIQUE("stripe_session_id")
);
--> statement-breakpoint
CREATE TABLE "push_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"host_id" uuid NOT NULL,
	"token" text NOT NULL,
	"platform" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "push_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"tokens" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reactions" (
	"media_id" uuid NOT NULL,
	"guest_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reactions_media_id_guest_id_pk" PRIMARY KEY("media_id","guest_id")
);
--> statement-breakpoint
CREATE TABLE "share_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"occasion_id" uuid NOT NULL,
	"token" text NOT NULL,
	"scope" "share_scope" DEFAULT 'view' NOT NULL,
	"label" text,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "share_links_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "cohost_invites" ADD CONSTRAINT "cohost_invites_occasion_id_occasions_id_fk" FOREIGN KEY ("occasion_id") REFERENCES "public"."occasions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "days" ADD CONSTRAINT "days_occasion_id_occasions_id_fk" FOREIGN KEY ("occasion_id") REFERENCES "public"."occasions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guests" ADD CONSTRAINT "guests_occasion_id_occasions_id_fk" FOREIGN KEY ("occasion_id") REFERENCES "public"."occasions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_occasion_id_occasions_id_fk" FOREIGN KEY ("occasion_id") REFERENCES "public"."occasions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_day_id_days_id_fk" FOREIGN KEY ("day_id") REFERENCES "public"."days"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_guest_id_guests_id_fk" FOREIGN KEY ("guest_id") REFERENCES "public"."guests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_uploaded_by_host_id_hosts_id_fk" FOREIGN KEY ("uploaded_by_host_id") REFERENCES "public"."hosts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_occasion_id_occasions_id_fk" FOREIGN KEY ("occasion_id") REFERENCES "public"."occasions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_guest_id_guests_id_fk" FOREIGN KEY ("guest_id") REFERENCES "public"."guests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "missions" ADD CONSTRAINT "missions_occasion_id_occasions_id_fk" FOREIGN KEY ("occasion_id") REFERENCES "public"."occasions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "occasion_members" ADD CONSTRAINT "occasion_members_occasion_id_occasions_id_fk" FOREIGN KEY ("occasion_id") REFERENCES "public"."occasions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "occasion_members" ADD CONSTRAINT "occasion_members_host_id_hosts_id_fk" FOREIGN KEY ("host_id") REFERENCES "public"."hosts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "occasions" ADD CONSTRAINT "occasions_owner_id_hosts_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."hosts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_occasion_id_occasions_id_fk" FOREIGN KEY ("occasion_id") REFERENCES "public"."occasions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_host_id_hosts_id_fk" FOREIGN KEY ("host_id") REFERENCES "public"."hosts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_tokens" ADD CONSTRAINT "push_tokens_host_id_hosts_id_fk" FOREIGN KEY ("host_id") REFERENCES "public"."hosts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_guest_id_guests_id_fk" FOREIGN KEY ("guest_id") REFERENCES "public"."guests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_links" ADD CONSTRAINT "share_links_occasion_id_occasions_id_fk" FOREIGN KEY ("occasion_id") REFERENCES "public"."occasions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "days_occasion_idx" ON "days" USING btree ("occasion_id");--> statement-breakpoint
CREATE INDEX "guests_occasion_idx" ON "guests" USING btree ("occasion_id");--> statement-breakpoint
CREATE UNIQUE INDEX "guests_device_idx" ON "guests" USING btree ("occasion_id","device_token_hash");--> statement-breakpoint
CREATE INDEX "login_tokens_email_idx" ON "login_tokens" USING btree ("email");--> statement-breakpoint
CREATE INDEX "media_occasion_created_idx" ON "media" USING btree ("occasion_id","created_at");--> statement-breakpoint
CREATE INDEX "media_occasion_day_idx" ON "media" USING btree ("occasion_id","day_id");--> statement-breakpoint
CREATE INDEX "messages_occasion_idx" ON "messages" USING btree ("occasion_id");--> statement-breakpoint
CREATE INDEX "missions_occasion_idx" ON "missions" USING btree ("occasion_id");--> statement-breakpoint
CREATE INDEX "occasions_owner_idx" ON "occasions" USING btree ("owner_id");