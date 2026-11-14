import { z } from "zod";
import { eq, inArray, sql } from "drizzle-orm";
import { schema } from "@/db";
import { route, json, readQuery, ApiError } from "@/lib/http";
import { occasionBySlug } from "@/lib/guest";
import { safeEqual } from "@/lib/crypto";
import { revealedForGuests, wallKey } from "@/lib/occasion";
import { accessForOccasion } from "@/lib/access";
import { liveMedia, mediaPage, occasionStats } from "@/lib/queries";
import { toMediaItems } from "@/lib/serializers";

const { media } = schema;

/** Additive: live wall feed. Requires the wall key from Occasion.wallUrl. */
export const GET = route<{ slug: string }>(async (req, { slug }) => {
  const o = await occasionBySlug(slug);
  const q = readQuery(req, z.object({ k: z.string().max(64), after: z.iso.datetime({ offset: true }).optional() }));
  if (!safeEqual(q.k, wallKey(o))) throw new ApiError(403, "forbidden", "Invalid wall link");
  const where = [...liveMedia(o.id), eq(media.visibility, "visible"), eq(media.approved, true), inArray(media.kind, ["photo", "video"]), revealedForGuests(o)];
  if (q.after) where.push(sql`${media.createdAt} > ${q.after}::timestamptz`);
  // The live wall is the host's screen: it shows whatever the album holds (also test uploads before paying),
  // until the event is refunded or deleted.
  const [{ rows }, stats, access] = await Promise.all([mediaPage({ where, limit: 40 }), occasionStats(o), accessForOccasion(o)]);
  if (access.state === "expired" || access.state === "refunded") throw new ApiError(410, "event_unavailable", "This gallery is no longer available");
  return json({ items: await toMediaItems(rows, { kind: "wall" }), stats: { photos: stats.photos + stats.videos, guests: stats.guests } });
});
