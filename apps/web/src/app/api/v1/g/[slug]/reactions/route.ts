import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { route, json, readJson, notFound } from "@/lib/http";
import { occasionBySlug, requireGuest } from "@/lib/guest";
import { limit } from "@/lib/rate-limit";

const { media, reactions } = schema;

export const POST = route<{ slug: string }>(async (req, { slug }) => {
  const o = await occasionBySlug(slug);
  const guest = await requireGuest(o);
  await limit(`react:${guest.id}`, 120, 60);
  const { mediaId } = await readJson(req, z.object({ mediaId: z.string().uuid() }));
  const [m] = await db.select({ id: media.id }).from(media)
    .where(and(eq(media.id, mediaId), eq(media.occasionId, o.id), eq(media.status, "uploaded"), eq(media.visibility, "visible"))).limit(1);
  if (!m) throw notFound("Unknown photo");
  const inserted = await db.insert(reactions).values({ mediaId, guestId: guest.id }).onConflictDoNothing().returning();
  let reacted = true;
  if (!inserted.length) {
    await db.delete(reactions).where(and(eq(reactions.mediaId, mediaId), eq(reactions.guestId, guest.id)));
    reacted = false;
  }
  // Recount rather than +/-1 so the counter self-heals under concurrent toggles.
  const [u] = await db.update(media)
    .set({ reactionCount: sql`(select count(*)::int from reactions where media_id = ${mediaId})` })
    .where(eq(media.id, mediaId)).returning({ count: media.reactionCount });
  return json({ reacted, count: u?.count ?? 0 });
});
