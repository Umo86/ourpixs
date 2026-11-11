import { z } from "zod";
import { and, eq, inArray, ne, sql, type SQL } from "drizzle-orm";
import { schema } from "@/db";
import { route, json, readJson, readQuery } from "@/lib/http";
import { requireMember } from "@/lib/auth";
import { liveMedia, mediaPage } from "@/lib/queries";
import { toMediaItems } from "@/lib/serializers";
import { canonicalMoment } from "@/lib/occasion";
import { applyMediaAction } from "@/lib/media-actions";
import { accessForOccasion } from "@/lib/access";

const { media } = schema;

const query = z.object({
  cursor: z.string().max(200).optional(),
  dayId: z.string().uuid().optional(),
  moment: z.string().max(80).optional(),
  guestId: z.string().uuid().optional(),
  kind: z.enum(["photo", "video"]).optional(),
  // flagged | duplicates | blurry are additive (auto-moderation).
  filter: z.enum(["favourites", "hidden", "pending", "flagged", "duplicates", "blurry"]).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

export const GET = route<{ id: string }>(async (req, { id }) => {
  const { occasion } = await requireMember(id);
  const q = readQuery(req, query);
  const where = [...liveMedia(occasion.id), ne(media.kind, "voice")];
  if (q.filter === "hidden") where.push(eq(media.visibility, "hidden"));
  else where.push(eq(media.visibility, "visible"));
  if (q.filter === "favourites") where.push(eq(media.favourite, true));
  if (q.filter === "pending") where.push(eq(media.approved, false));
  if (q.filter === "flagged") where.push(sql`cardinality(${media.moderationFlags}) > 0`);
  if (q.filter === "duplicates") where.push(sql`'duplicate' = any(${media.moderationFlags})`);
  if (q.filter === "blurry") where.push(sql`'blurry' = any(${media.moderationFlags})`);
  if (q.dayId) where.push(eq(media.dayId, q.dayId));
  if (q.guestId) where.push(eq(media.guestId, q.guestId));
  if (q.kind) where.push(eq(media.kind, q.kind));
  if (q.moment) where.push(eq(media.momentTag, canonicalMoment(occasion, q.moment) ?? q.moment));
  const [{ rows, nextCursor }, access] = await Promise.all([mediaPage({ where, cursor: q.cursor, limit: q.limit }), accessForOccasion(occasion)]);
  return json({ items: await toMediaItems(rows, "host", { canDownload: access.canDownload }), nextCursor });
});

const patch = z.object({
  ids: z.array(z.string().uuid()).min(1).max(500).optional(),
  /** Additive: act on every visible item with a moderation flag, e.g. "hide all duplicates". Only hide/approve. */
  match: z.enum(["duplicates", "blurry", "flagged"]).optional(),
  action: z.enum(["hide", "show", "delete", "favourite", "unfavourite", "approve"]),
}).refine((b) => !!b.ids !== !!b.match, { message: "Send either ids or match" })
  .refine((b) => !b.match || b.action === "hide" || b.action === "approve", { message: "match supports hide or approve" });

const MATCH: Record<"duplicates" | "blurry" | "flagged", SQL> = {
  duplicates: sql`'duplicate' = any(${media.moderationFlags})`,
  blurry: sql`'blurry' = any(${media.moderationFlags})`,
  flagged: sql`cardinality(${media.moderationFlags}) > 0`,
};

export const PATCH = route<{ id: string }>(async (req, { id }) => {
  const { occasion } = await requireMember(id);
  const { ids, match, action } = await readJson(req, patch);
  const scope = match
    ? and(eq(media.occasionId, occasion.id), eq(media.visibility, "visible"), MATCH[match])
    : and(eq(media.occasionId, occasion.id), inArray(media.id, ids!));
  await applyMediaAction(scope!, action);
  return json({ ok: true });
});
