import { z } from "zod";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { route, json, readQuery } from "@/lib/http";
import { requireMember } from "@/lib/auth";
import { accessForOccasion, assertCanDownload } from "@/lib/access";
import { liveMedia } from "@/lib/queries";
import { EXT_BY_MIME, presignGet } from "@/lib/storage";

const { media, guests } = schema;
const MAX_FILES = 20000;

function stamp(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}-${p(d.getUTCHours())}${p(d.getUTCMinutes())}`;
}
const safe = (s: string) => s.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, "_").replace(/\s+/g, " ").trim().slice(0, 80) || "guest";

/**
 * ZIP manifest: every visible original (photos + videos), oldest first, with signed download URLs.
 * 402 `plan_required` while downloads are locked (trial / unpaid account).
 */
export const GET = route<{ id: string }>(async (req, { id }) => {
  const { occasion } = await requireMember(id);
  assertCanDownload(await accessForOccasion(occasion));
  const q = readQuery(req, z.object({ dayId: z.string().uuid().optional() }));
  const rows = await db.select({ media, guestName: guests.displayName }).from(media)
    .leftJoin(guests, eq(guests.id, media.guestId))
    .where(and(...liveMedia(occasion.id), eq(media.visibility, "visible"), inArray(media.kind, ["photo", "video"]), q.dayId ? eq(media.dayId, q.dayId) : undefined))
    .orderBy(asc(media.createdAt), asc(media.id)).limit(MAX_FILES);
  const files = await Promise.all(rows.map(async (r, i) => {
    const m = r.media;
    const name = `${stamp(m.createdAt)}_${String(i + 1).padStart(4, "0")}_${safe(r.guestName || "host")}.${EXT_BY_MIME[m.mime] || (m.kind === "video" ? "mp4" : "jpg")}`;
    return { id: m.id, name, url: await presignGet(m.keyOriginal, { download: name }), mime: m.mime, kind: m.kind, bytes: m.bytes, dayId: m.dayId, guestName: r.guestName, createdAt: m.createdAt.toISOString() };
  }));
  return json({ files });
});
