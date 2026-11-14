CREATE TABLE "guest_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"occasion_id" uuid NOT NULL,
	"guest_id" uuid,
	"email" text NOT NULL,
	"locale" text DEFAULT 'en' NOT NULL,
	"brand" "brand" DEFAULT 'bizimresimler' NOT NULL,
	"wants_event_photos" boolean DEFAULT true NOT NULL,
	"photos_emailed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketing_consents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"brand" "brand" DEFAULT 'bizimresimler' NOT NULL,
	"locale" text DEFAULT 'en' NOT NULL,
	"consented" boolean DEFAULT true NOT NULL,
	"wording" text NOT NULL,
	"source" text NOT NULL,
	"occasion_id" uuid,
	"ip_hash" text,
	"user_agent" text,
	"consented_at" timestamp with time zone DEFAULT now() NOT NULL,
	"withdrawn_at" timestamp with time zone,
	"withdrawn_via" text,
	"unsubscribe_token_hash" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "guest_purchases" ADD COLUMN "waiver_accepted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "guest_purchases" ADD COLUMN "waiver_wording" text;--> statement-breakpoint
ALTER TABLE "guest_contacts" ADD CONSTRAINT "guest_contacts_occasion_id_occasions_id_fk" FOREIGN KEY ("occasion_id") REFERENCES "public"."occasions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guest_contacts" ADD CONSTRAINT "guest_contacts_guest_id_guests_id_fk" FOREIGN KEY ("guest_id") REFERENCES "public"."guests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_consents" ADD CONSTRAINT "marketing_consents_occasion_id_occasions_id_fk" FOREIGN KEY ("occasion_id") REFERENCES "public"."occasions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "guest_contacts_occasion_email_idx" ON "guest_contacts" USING btree ("occasion_id","email");--> statement-breakpoint
CREATE INDEX "guest_contacts_due_idx" ON "guest_contacts" USING btree ("wants_event_photos","photos_emailed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "marketing_consents_unsub_idx" ON "marketing_consents" USING btree ("unsubscribe_token_hash");--> statement-breakpoint
CREATE INDEX "marketing_consents_email_idx" ON "marketing_consents" USING btree ("email","brand");--> statement-breakpoint
CREATE INDEX "marketing_consents_created_idx" ON "marketing_consents" USING btree ("consented_at");