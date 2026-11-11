import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { route, json, readJson, badRequest, planLimit } from "@/lib/http";
import { requireMember } from "@/lib/auth";
import { accessForOccasion, assertWritable } from "@/lib/access";
import { deleteObjects, headObject } from "@/lib/storage";
import { occasionPayload } from "@/lib/occasion-service";

export const POST = route<{ id: string }>(async (req, { id }) => {
  const { occasion, role } = await requireMember(id);
  assertWritable(await accessForOccasion(occasion));
  const { key } = await readJson(req, z.object({ key: z.string().max(300) }));
  const prefix = `o/${occasion.id}/cover/`;
  if (!key.startsWith(prefix) || !/^[\w-]+\.(webp|png|jpg)$/.test(key.slice(prefix.length))) throw badRequest("Upload the cover photo first");
  const obj = await headObject(key);
  if (!obj) throw badRequest("Upload the cover photo first");
  // The presigned PUT can't cap the size on every driver, so re-check what actually landed.
  if (obj.bytes > 15 * 1024 * 1024) {
    await deleteObjects([key]).catch(() => {});
    throw planLimit("Cover photo is too large");
  }
  if (occasion.coverKey?.startsWith(prefix) && occasion.coverKey !== key) await deleteObjects([occasion.coverKey]).catch(() => {});
  const [o] = await db.update(schema.occasions).set({ coverKey: key }).where(eq(schema.occasions.id, occasion.id)).returning();
  return json({ occasion: await occasionPayload(o!, role) });
});
