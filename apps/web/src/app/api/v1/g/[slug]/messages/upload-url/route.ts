import { z } from "zod";
import { route, json, readJson, planLimit } from "@/lib/http";
import { occasionBySlug, requireGuest } from "@/lib/guest";
import { limit } from "@/lib/rate-limit";
import { accessForOccasion, assertGuestCanUpload } from "@/lib/access";
import { messageKey, presignPut, storageDriver, StorageNotConfigured } from "@/lib/storage";

const MIME = ["audio/webm", "audio/mp4", "audio/m4a", "audio/mpeg", "video/webm", "video/mp4", "video/quicktime"] as const;

/** Additive: presigned PUT for a guestbook voice/video note. Returns `mediaKey` to pass to POST /messages. */
export const POST = route<{ slug: string }>(async (req, { slug }) => {
  const o = await occasionBySlug(slug);
  const guest = await requireGuest(o);
  assertGuestCanUpload(await accessForOccasion(o));
  if (!storageDriver()) throw new StorageNotConfigured();
  await limit(`msgurl:${guest.id}`, 20, 3600);
  const b = await readJson(req, z.object({ mime: z.enum(MIME), bytes: z.number().int().positive() }));
  if (b.bytes > 100 * 1024 * 1024) throw planLimit("Recording is too large");
  const key = messageKey(o.id, guest.id, b.mime);
  return json({ mediaKey: key, upload: await presignPut(key, b.mime, b.bytes) });
});
