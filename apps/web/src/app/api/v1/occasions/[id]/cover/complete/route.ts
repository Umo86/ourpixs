import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { route, json, readJson, badRequest } from "@/lib/http";
import { requireMember } from "@/lib/auth";
import { deleteObjects, headObject } from "@/lib/storage";
import { occasionPayload } from "@/lib/occasion-service";

export const POST = route<{ id: string }>(async (req, { id }) => {
  const { occasion, role } = await requireMember(id);
  const { key } = await readJson(req, z.object({ key: z.string().max(300) }));
  const prefix = `o/${occasion.id}/cover/`;
  if (!key.startsWith(prefix) || !(await headObject(key))) throw badRequest("Upload the cover photo first");
  if (occasion.coverKey?.startsWith(prefix) && occasion.coverKey !== key) await deleteObjects([occasion.coverKey]).catch(() => {});
  const [o] = await db.update(schema.occasions).set({ coverKey: key }).where(eq(schema.occasions.id, occasion.id)).returning();
  return json({ occasion: await occasionPayload(o!, role) });
});
