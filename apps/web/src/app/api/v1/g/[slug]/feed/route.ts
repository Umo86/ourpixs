import { z } from "zod";
import { eq, ne, sql } from "drizzle-orm";
import { schema } from "@/db";
import { route, json, readQuery, clientIp } from "@/lib/http";
import { getGuest, occasionBySlug, requirePinAccess } from "@/lib/guest";
import { liveMedia, mediaPage } from "@/lib/queries";
import { toMediaItems } from "@/lib/serializers";
import { canonicalMoment, revealedForGuests, uploadOpen } from "@/lib/occasion";
import { accessForOccasion, assertGuestsCanView } from "@/lib/access";

const { media } = schema;

const query = z.object({
  after: z.iso.datetime({ offset: true }).optional(),
  cursor: z.string().max(200).optional(),
  // Additive filters used by the web guest app.
  kind: z.enum(["photo", "video"]).optional(),
  moment: z.string().max(80).optional(),
  dayId: z.string().uuid().optional(),
  sort: z.enum(["new", "top"]).optional(),
});

export const GET = route<{ slug: string }>(async (req, { slug }) => {
  const o = await occasionBySlug(slug);
  const guest = await getGuest(o);
  await requirePinAccess(o, clientIp(req), guest);
  const access = await accessForOccasion(o);
  assertGuestsCanView(access);
  const q = readQuery(req, query);
  const where = [...liveMedia(o.id), eq(media.visibility, "visible"), eq(media.approved, true), ne(media.kind, "voice"), revealedForGuests(o)];
  if (q.after) where.push(sql`${media.createdAt} > ${q.after}::timestamptz`);
  if (q.kind) where.push(eq(media.kind, q.kind));
  if (q.dayId) where.push(eq(media.dayId, q.dayId));
  if (q.moment) where.push(eq(media.momentTag, canonicalMoment(o, q.moment) ?? q.moment));
  const { rows, nextCursor } = await mediaPage({ where, cursor: q.after ? undefined : q.cursor, sort: q.sort, guestIdForReaction: guest?.id, limit: q.after ? 100 : 30 });
  // `uploadsOpen` is false unless the gallery is live (and inside any per-event upload window).
  return json({
    items: await toMediaItems(rows, { kind: "guest", guestId: guest?.id ?? null }), nextCursor: q.after ? null : nextCursor,
    uploadsOpen: uploadOpen(o, access.guestsCanUpload),
  });
});
