import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { route, json, readJson } from "@/lib/http";
import { requireOrgMember } from "@/lib/org";
import { orgPayload } from "@/lib/org-service";

export const GET = route<{ orgId: string }>(async (_req, { orgId }) => {
  const { org, role } = await requireOrgMember(orgId);
  return json({ organisation: await orgPayload(org, role) });
});

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a #RRGGBB colour");
const body = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  primaryColour: hex.nullable().optional(),
  accentColour: hex.nullable().optional(),
  supportEmail: z.email().max(200).nullable().optional(),
  hidePoweredBy: z.boolean().optional(),
});

export const PATCH = route<{ orgId: string }>(async (req, { orgId }) => {
  const { org, role } = await requireOrgMember(orgId, { owner: true });
  const b = await readJson(req, body);
  if (!Object.keys(b).length) return json({ organisation: await orgPayload(org, role) });
  const [updated] = await db.update(schema.organisations).set(b).where(eq(schema.organisations.id, org.id)).returning();
  return json({ organisation: await orgPayload(updated!, role) });
});
