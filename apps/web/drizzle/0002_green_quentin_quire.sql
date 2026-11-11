CREATE TYPE "public"."branding_mode" AS ENUM('platform', 'venue', 'couple', 'both');--> statement-breakpoint
CREATE TYPE "public"."org_role" AS ENUM('owner', 'staff');--> statement-breakpoint
CREATE TYPE "public"."org_status" AS ENUM('trialing', 'active', 'past_due', 'cancelled');--> statement-breakpoint
CREATE TABLE "organisation_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"email" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organisation_members" (
	"organisation_id" uuid NOT NULL,
	"host_id" uuid NOT NULL,
	"role" "org_role" DEFAULT 'staff' NOT NULL,
	CONSTRAINT "organisation_members_organisation_id_host_id_pk" PRIMARY KEY("organisation_id","host_id")
);
--> statement-breakpoint
CREATE TABLE "organisations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"logo_key" text,
	"primary_colour" text,
	"accent_colour" text,
	"support_email" text,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"status" "org_status" DEFAULT 'cancelled' NOT NULL,
	"current_period_end" timestamp with time zone,
	"past_due_since" timestamp with time zone,
	"hide_powered_by" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organisations_slug_unique" UNIQUE("slug"),
	CONSTRAINT "organisations_stripe_subscription_id_unique" UNIQUE("stripe_subscription_id")
);
--> statement-breakpoint
ALTER TABLE "occasions" ADD COLUMN "organisation_id" uuid;--> statement-breakpoint
ALTER TABLE "occasions" ADD COLUMN "branding_mode" "branding_mode" DEFAULT 'platform' NOT NULL;--> statement-breakpoint
ALTER TABLE "organisation_invites" ADD CONSTRAINT "organisation_invites_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organisation_members" ADD CONSTRAINT "organisation_members_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organisation_members" ADD CONSTRAINT "organisation_members_host_id_hosts_id_fk" FOREIGN KEY ("host_id") REFERENCES "public"."hosts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "org_members_host_idx" ON "organisation_members" USING btree ("host_id");--> statement-breakpoint
ALTER TABLE "occasions" ADD CONSTRAINT "occasions_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "occasions_org_idx" ON "occasions" USING btree ("organisation_id");