import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { route, json, readJson, readQuery } from "@/lib/http";
import { normalizeEmail } from "@/lib/auth";
import { requireOrgMember } from "@/lib/org";
import { addOrgMemberByEmail, orgMembers } from "@/lib/org-service";
import { limit } from "@/lib/rate-limit";

export const GET = route<{ orgId: string }>(async (_req, { orgId }) => {
  const { org } = await requireOrgMember(orgId);
  return json(await orgMembers(org.id));
});

/** Invite staff by email (they join on next sign-in). */
export const POST = route<{ orgId: string }>(async (req, { orgId }) => {
  const { host, org } = await requireOrgMember(orgId, { owner: true });
  await limit(`org:invite:${host.id}`, 30, 86400);
  const { email } = await readJson(req, z.object({ email: z.email().max(200) }));
  await addOrgMemberByEmail(org.id, normalizeEmail(email));
  return json(await orgMembers(org.id), { status: 201 });
});

export const DELETE = route<{ orgId: string }>(async (req, { orgId }) => {
  const { org } = await requireOrgMember(orgId, { owner: true });
  const q = readQuery(req, z.object({ hostId: z.string().uuid().optional(), inviteId: z.string().uuid().optional() }));
  if (q.hostId) await db.delete(schema.organisationMembers).where(and(eq(schema.organisationMembers.organisationId, org.id), eq(schema.organisationMembers.hostId, q.hostId), eq(schema.organisationMembers.role, "staff")));
  if (q.inviteId) await db.delete(schema.organisationInvites).where(and(eq(schema.organisationInvites.id, q.inviteId), eq(schema.organisationInvites.organisationId, org.id)));
  return json(await orgMembers(org.id));
});
