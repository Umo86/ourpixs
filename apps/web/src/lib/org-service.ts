import "server-only";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { orgActive, type OrgRow } from "./org";
import { occasionExtras } from "./queries";
import { coverUrlFor, toOrganisation } from "./serializers";
import type { OccasionSummary } from "./api-types";
import type { OccasionType, Plan } from "./config";
import { randomSlug } from "./slug";

export function orgSlug(name: string) {
  const base = name.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/ı/g, "i").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30) || "partner";
  return `${base}-${randomSlug(5).toLowerCase()}`;
}

export const orgPayload = (org: OrgRow, role: "owner" | "staff") => toOrganisation(org, role, orgActive(org));

export async function orgOccasionSummaries(orgId: string): Promise<OccasionSummary[]> {
  const rows = await db.select().from(schema.occasions).where(eq(schema.occasions.organisationId, orgId));
  const extras = await occasionExtras(rows.map((r) => r.id));
  const list = await Promise.all(rows.map(async (o) => {
    const ex = extras.get(o.id);
    return {
      id: o.id, slug: o.slug, type: o.type as OccasionType, title: o.title, startsOn: o.startsOn, plan: o.plan as Plan,
      coverUrl: await coverUrlFor(ex?.coverKey ?? null), mediaCount: ex?.mediaCount ?? 0, guestCount: ex?.guestCount ?? 0, role: "cohost" as const,
    };
  }));
  return list.sort((a, b) => (b.startsOn || "").localeCompare(a.startsOn || ""));
}

export async function orgMembers(orgId: string) {
  const [members, invites] = await Promise.all([
    db.select({ hostId: schema.hosts.id, email: schema.hosts.email, name: schema.hosts.name, role: schema.organisationMembers.role })
      .from(schema.organisationMembers).innerJoin(schema.hosts, eq(schema.hosts.id, schema.organisationMembers.hostId))
      .where(eq(schema.organisationMembers.organisationId, orgId)),
    db.select({ id: schema.organisationInvites.id, email: schema.organisationInvites.email }).from(schema.organisationInvites)
      .where(eq(schema.organisationInvites.organisationId, orgId)),
  ]);
  return { members, invites };
}

export async function addOrgMemberByEmail(orgId: string, email: string) {
  const [existing] = await db.select().from(schema.hosts).where(eq(schema.hosts.email, email)).limit(1);
  if (existing) {
    await db.insert(schema.organisationMembers).values({ organisationId: orgId, hostId: existing.id, role: "staff" }).onConflictDoNothing();
    return existing;
  }
  const [dupe] = await db.select().from(schema.organisationInvites)
    .where(and(eq(schema.organisationInvites.organisationId, orgId), eq(schema.organisationInvites.email, email))).limit(1);
  if (!dupe) await db.insert(schema.organisationInvites).values({ organisationId: orgId, email });
  return null;
}
