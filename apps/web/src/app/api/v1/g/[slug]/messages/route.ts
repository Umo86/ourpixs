import { z } from "zod";
import { db, schema } from "@/db";
import { route, json, readJson, badRequest, planFeature } from "@/lib/http";
import { occasionBySlug, requireGuest } from "@/lib/guest";
import { limit } from "@/lib/rate-limit";
import { planOf } from "@/lib/occasion";
import { headObject } from "@/lib/storage";
import { toMessages } from "@/lib/serializers";
import { notifyHosts } from "@/lib/push";
import { after } from "next/server";

const body = z.object({
  kind: z.enum(["text", "voice", "video"]),
  body: z.string().trim().max(2000).optional().nullable(),
  mediaKey: z.string().max(300).optional().nullable(),
  /** Additive: recording length in seconds. */
  durationS: z.number().min(0).max(600).optional().nullable(),
});

export const POST = route<{ slug: string }>(async (req, { slug }) => {
  const o = await occasionBySlug(slug);
  const guest = await requireGuest(o);
  await limit(`msg:${guest.id}`, 20, 3600);
  const b = await readJson(req, body);
  let mediaKey: string | null = null;
  if (b.kind === "text") {
    if (!b.body) throw badRequest("Write a message first");
  } else {
    if (!planOf(o).voiceGuestbook) throw planFeature("voice and video messages");
    // Key must come from /messages/upload-url for this guest and exist in storage.
    if (!b.mediaKey || !b.mediaKey.startsWith(`o/${o.id}/msg/${guest.id}/`)) throw badRequest("Upload the recording first");
    if (!(await headObject(b.mediaKey))) throw badRequest("The recording didn't finish uploading");
    mediaKey = b.mediaKey;
  }
  const [m] = await db.insert(schema.messages).values({
    occasionId: o.id, guestId: guest.id, kind: b.kind, body: b.body || null, mediaKey,
    durationS: b.durationS != null ? Math.round(b.durationS) : null,
  }).returning();
  const [message] = await toMessages([{ message: m!, guestName: guest.displayName }]);
  after(() => notifyHosts(o, "message"));
  return json({ message }, { status: 201 });
});
