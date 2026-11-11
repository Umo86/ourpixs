ALTER TABLE "occasions" DROP CONSTRAINT "occasions_organisation_id_organisations_id_fk";--> statement-breakpoint
DROP INDEX "occasions_org_idx";--> statement-breakpoint
ALTER TABLE "occasions" DROP COLUMN "organisation_id";--> statement-breakpoint
ALTER TABLE "occasions" DROP COLUMN "branding_mode";--> statement-breakpoint
DROP TABLE "organisation_invites" CASCADE;--> statement-breakpoint
DROP TABLE "organisation_members" CASCADE;--> statement-breakpoint
DROP TABLE "organisations" CASCADE;--> statement-breakpoint
DROP TYPE "public"."branding_mode";--> statement-breakpoint
DROP TYPE "public"."org_role";--> statement-breakpoint
DROP TYPE "public"."org_status";