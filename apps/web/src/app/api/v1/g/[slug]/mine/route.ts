import { z } from "zod";
import { and, eq, ne } from "drizzle-orm";
import { db, schema } from "@/db";
import { route, json, readQuery, notFound } from "@/lib/http";
import { occasionBySlug, requireGuest } from "@/lib/guest";
import { liveMedia, mediaPage } from "@/lib/queries";
import { toMediaItems } from "@/lib/serializers";
import { deleteObjects, mediaFileKeys } from "@/lib/storage";

const { media } = schema;

export const GET = route<{ slug: string }>(async (_req, { slug }) => {
  const o = await occasionBySlug(slug);
  const guest = await requireGuest(o);
  const { rows } = await mediaPage({ where: [...liveMedia(o.id), eq(media.guestId, guest.id), ne(media.kind, "voice")], limit: 500, guestIdForReaction: guest.id });
  return json({ items: await toMediaItems(rows, { kind: "guest", guestId: guest.id }) });
});

export const DELETE = route<{ slug: string }>(async (req, { slug }) => {
  const o = await occasionBySlug(slug);
  const guest = await requireGuest(o);
  const { mediaId } = readQuery(req, z.object({ mediaId: z.string().uuid() }));
  const scope = and(eq(media.id, mediaId), eq(media.occasionId, o.id), eq(media.guestId, guest.id));
  const [m] = await db.select().from(media).where(scope).limit(1);
  if (!m) throw notFound("Unknown photo");
  await db.update(media).set({ visibility: "deleted" }).where(scope);
  try {
    await deleteObjects(mediaFileKeys(m));
    await db.delete(media).where(scope);
  } catch (e) {
    console.error("[mine] storage delete failed; cron will retry", e);
  }
  return json({ ok: true });
});
