import "server-only";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { BRANDS, THEMES } from "./config";
import { ApiError, notFound, isUuid } from "./http";
import { requireHost } from "./auth";
import { presignGet, storageDriver } from "./storage";

export type OrgRow = typeof schema.organisations.$inferSelect;
type OccasionRow = typeof schema.occasions.$inferSelect;

export const PAST_DUE_GRACE_DAYS = 7;

/** Subscription grants Partner benefits while active/trialing, and for 7 days after going past_due. */
export function orgActive(org: Pick<OrgRow, "status" | "pastDueSince">, now = new Date()): boolean {
  if (org.status === "active" || org.status === "trialing") return true;
  if (org.status === "past_due") {
    const since = org.pastDueSince ?? now;
    return now.getTime() - since.getTime() < PAST_DUE_GRACE_DAYS * 86400_000;
  }
  return false;
}

export async function loadOrg(id: string | null | undefined): Promise<OrgRow | null> {
  if (!id) return null;
  const [o] = await db.select().from(schema.organisations).where(eq(schema.organisations.id, id)).limit(1);
  return o ?? null;
}

export async function requireOrgMember(orgId: string, opts: { owner?: boolean } = {}) {
  const host = await requireHost();
  if (!isUuid(orgId)) throw notFound("Unknown organisation");
  const [row] = await db.select({ org: schema.organisations, role: schema.organisationMembers.role })
    .from(schema.organisationMembers)
    .innerJoin(schema.organisations, eq(schema.organisations.id, schema.organisationMembers.organisationId))
    .where(and(eq(schema.organisationMembers.organisationId, orgId), eq(schema.organisationMembers.hostId, host.id))).limit(1);
  if (!row) throw notFound("Unknown organisation");
  if (opts.owner && row.role !== "owner") throw new ApiError(403, "forbidden", "Only the account owner can do this");
  return { host, org: row.org, role: row.role };
}

export async function orgsForHost(hostId: string) {
  return db.select({ org: schema.organisations, role: schema.organisationMembers.role })
    .from(schema.organisationMembers)
    .innerJoin(schema.organisations, eq(schema.organisations.id, schema.organisationMembers.organisationId))
    .where(eq(schema.organisationMembers.hostId, hostId));
}

/** Blocks uploads/edits on partner events once the subscription lapsed beyond the grace period. */
export async function assertOrgWritable(o: Pick<OccasionRow, "organisationId">) {
  if (!o.organisationId) return;
  const org = await loadOrg(o.organisationId);
  if (org && !orgActive(org)) throw new ApiError(403, "partner_inactive", "This venue's subscription is inactive, so the event is read-only");
}

export type Branding = {
  mode: "platform" | "venue" | "couple" | "both";
  /** Show the Our Pixs / Bizim Resimler logo + marketing footer. */
  platform: boolean;
  platformName: string;
  venueName: string | null;
  logoUrl: string | null;
  poweredBy: boolean;
  colours: { bg: string; fg: string; accent: string };
};

const HEX = /^#[0-9a-fA-F]{6}$/;

/** What guests see for an event: platform brand, venue brand, the couple's own look, or couple + venue. */
export async function resolveBranding(o: OccasionRow, orgIn?: OrgRow | null): Promise<Branding> {
  const theme = THEMES[o.theme];
  const platformName = BRANDS[o.brand].name;
  const org = orgIn !== undefined ? orgIn : await loadOrg(o.organisationId);
  const mode = org ? o.brandingMode : "platform";
  if (!org || mode === "platform") {
    return { mode: "platform", platform: true, platformName, venueName: null, logoUrl: null, poweredBy: false, colours: { ...theme } };
  }
  const logoUrl = org.logoKey && storageDriver() ? await presignGet(org.logoKey).catch(() => null) : null;
  const venueColours = {
    bg: org.primaryColour && HEX.test(org.primaryColour) ? org.primaryColour : theme.bg,
    fg: "#FFFFFF",
    accent: org.accentColour && HEX.test(org.accentColour) ? org.accentColour : theme.accent,
  };
  return {
    mode,
    platform: false,
    platformName,
    venueName: mode === "couple" ? null : org.name,
    logoUrl: mode === "couple" ? null : logoUrl,
    poweredBy: !org.hidePoweredBy,
    colours: mode === "venue" ? venueColours : { ...theme },
  };
}
