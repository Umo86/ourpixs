import { z } from "zod";
import { route, json, readQuery, ApiError } from "@/lib/http";
import { occasionBySlug } from "@/lib/guest";
import { safeEqual } from "@/lib/crypto";
import { revealedForGuests, wallKey } from "@/lib/occasion";
import { accessForOccasion } from "@/lib/access";
import { occasionStats, wallMedia } from "@/lib/queries";
import { toMediaItems } from "@/lib/serializers";

/** Postgres timestamptz text (what `cursor` returns), e.g. "2027-06-12 18:04:05.123456+00". */
const CURSOR_RE = /^\d{4}-\d\d-\d\d[ T][\d:.]+([+-]\d\d(:?\d\d)?|Z)?$/;

/**
 * Live wall feed (the host's screen). Requires the wall key from Occasion.wallUrl. Only items whose clean copies are
 * READY (never "processing"): photos as the clean display copy, videos as the clean 1080p MP4 (`playbackUrl`).
 * `since` = the previous response's `cursor`: returns what became ready after it (new uploads and finished videos).
 * `after` (legacy, upload time) is still accepted and treated like `since`.
 */
export const GET = route<{ slug: string }>(async (req, { slug }) => {
  const o = await occasionBySlug(slug);
  const q = readQuery(req, z.object({ k: z.string().max(64), since: z.string().max(40).regex(CURSOR_RE).optional(), after: z.iso.datetime({ offset: true }).optional() }));
  if (!safeEqual(q.k, wallKey(o))) throw new ApiError(403, "forbidden", "Invalid wall link");
  // The live wall shows whatever the album holds (also test uploads before paying), until the event is refunded or deleted.
  const [{ rows, cursor }, stats, access] = await Promise.all([wallMedia(o, revealedForGuests(o), q.since ?? q.after), occasionStats(o), accessForOccasion(o)]);
  if (access.state === "expired" || access.state === "refunded" || access.reason === "suspended") throw new ApiError(410, "event_unavailable", "This gallery is no longer available");
  return json({ items: await toMediaItems(rows, { kind: "wall" }), cursor, stats: { photos: stats.photos + stats.videos, guests: stats.guests } });
});
