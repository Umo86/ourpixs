import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { route, json, readJson, badRequest, planLimit } from "@/lib/http";
import { requireOrgMember } from "@/lib/org";
import { deleteObjects, headObject } from "@/lib/storage";
import { orgPayload } from "@/lib/org-service";

export const POST = route<{ orgId: string }>(async (req, { orgId }) => {
  const { org, role } = await requireOrgMember(orgId, { owner: true });
  const { key } = await readJson(req, z.object({ key: z.string().max(300) }));
  const prefix = `org/${org.id}/`;
  if (!key.startsWith(prefix) || !/^logo-[\w-]+\.(webp|png|jpg)$/.test(key.slice(prefix.length))) throw badRequest("Upload the logo first");
  const obj = await headObject(key);
  if (!obj) throw badRequest("Upload the logo first");
  if (obj.bytes > 5 * 1024 * 1024) {
    await deleteObjects([key]).catch(() => {});
    throw planLimit("Logo is too large");
  }
  if (org.logoKey && org.logoKey !== key) await deleteObjects([org.logoKey]).catch(() => {});
  const [updated] = await db.update(schema.organisations).set({ logoKey: key }).where(eq(schema.organisations.id, org.id)).returning();
  return json({ organisation: await orgPayload(updated!, role) });
});
