import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { route, json, readJson, badRequest } from "@/lib/http";
import { requireOrgMember } from "@/lib/org";
import { deleteObjects, headObject } from "@/lib/storage";
import { orgPayload } from "@/lib/org-service";

export const POST = route<{ orgId: string }>(async (req, { orgId }) => {
  const { org, role } = await requireOrgMember(orgId, { owner: true });
  const { key } = await readJson(req, z.object({ key: z.string().max(300) }));
  if (!key.startsWith(`org/${org.id}/`) || !(await headObject(key))) throw badRequest("Upload the logo first");
  if (org.logoKey && org.logoKey !== key) await deleteObjects([org.logoKey]).catch(() => {});
  const [updated] = await db.update(schema.organisations).set({ logoKey: key }).where(eq(schema.organisations.id, org.id)).returning();
  return json({ organisation: await orgPayload(updated!, role) });
});
