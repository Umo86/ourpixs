import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { route, json, readJson, planLimit } from "@/lib/http";
import { requireMember } from "@/lib/auth";
import { accessForOccasion, assertWritable } from "@/lib/access";
import { deleteObjects, presignPut, storageDriver, StorageNotConfigured } from "@/lib/storage";
import { occasionPayload } from "@/lib/occasion-service";
import { randomToken } from "@/lib/crypto";
import { limit } from "@/lib/rate-limit";

/** Additive: presigned PUT for a host-chosen cover photo (resized to WebP in the browser). Then POST ./complete { key }. */
export const POST = route<{ id: string }>(async (req, { id }) => {
  const { host, occasion } = await requireMember(id);
  assertWritable(await accessForOccasion(occasion));
  if (!storageDriver()) throw new StorageNotConfigured();
  await limit(`cover:${host.id}`, 30, 3600);
  const b = await readJson(req, z.object({ mime: z.enum(["image/webp", "image/jpeg", "image/png"]), bytes: z.number().int().positive() }));
  if (b.bytes > 15 * 1024 * 1024) throw planLimit("Cover photo is too large");
  const ext = b.mime === "image/webp" ? "webp" : b.mime === "image/png" ? "png" : "jpg";
  const key = `o/${occasion.id}/cover/${randomToken(16)}.${ext}`;
  return json({ key, upload: await presignPut(key, b.mime, b.bytes) });
});

/** Additive: remove the custom cover (falls back to a favourite / latest photo). */
export const DELETE = route<{ id: string }>(async (_req, { id }) => {
  const { occasion, role } = await requireMember(id);
  assertWritable(await accessForOccasion(occasion));
  if (occasion.coverKey?.startsWith(`o/${occasion.id}/cover/`)) await deleteObjects([occasion.coverKey]).catch(() => {});
  const [o] = await db.update(schema.occasions).set({ coverKey: null }).where(eq(schema.occasions.id, occasion.id)).returning();
  return json({ occasion: await occasionPayload(o!, role) });
});
