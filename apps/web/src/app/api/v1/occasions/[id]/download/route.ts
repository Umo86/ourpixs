import { z } from "zod";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { route, json, readJson, readQuery } from "@/lib/http";
import { requireMember } from "@/lib/auth";
import { accessForOccasion, assertCanDownload } from "@/lib/access";
import { liveMedia } from "@/lib/queries";
import { EXT_BY_MIME, privateGetUrl } from "@/lib/storage";

const { media, guests } = schema;
const MAX_FILES = 20000;

function stamp(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}-${p(d.getUTCHours())}${p(d.getUTCMinutes())}`;
}
const safe = (s: string) => s.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, "_").replace(/\s+/g, " ").trim().slice(0, 80) || "guest";

type OccasionRow = typeof schema.occasions.$inferSelect;

/** Manifest rows: visible originals (or a selection, hidden ones included), oldest first, with fresh signed links (1 h). */
async function manifest(occasion: OccasionRow, filter: { dayId?: string; ids?: string[] }) {
  const rows = await db.select({ media, guestName: guests.displayName }).from(media)
    .leftJoin(guests, eq(guests.id, media.guestId))
    .where(and(...liveMedia(occasion.id), inArray(media.kind, ["photo", "video"]),
      filter.ids ? inArray(media.id, filter.ids) : eq(media.visibility, "visible"), filter.dayId ? eq(media.dayId, filter.dayId) : undefined))
    .orderBy(asc(media.createdAt), asc(media.id)).limit(MAX_FILES);
  const files = await Promise.all(rows.map(async (r, i) => {
    const m = r.media;
    const name = `${stamp(m.createdAt)}_${String(i + 1).padStart(4, "0")}_${safe(r.guestName || "host")}.${EXT_BY_MIME[m.mime] || (m.kind === "video" ? "mp4" : "jpg")}`;
    return { id: m.id, name, url: await privateGetUrl(m.keyOriginal, 3600, { download: name }), mime: m.mime, kind: m.kind, bytes: m.bytes, dayId: m.dayId, guestName: r.guestName, createdAt: m.createdAt.toISOString() };
  }));
  // totalBytes is additive: above ~2 GB the web app offers one ZIP per day.
  return { files, totalBytes: files.reduce((a, f) => a + Number(f.bytes || 0), 0) };
}

/**
 * ZIP manifest: every visible original (photos + videos), oldest first, with signed download URLs (1 h, minted now).
 * Hosts and co-hosts only (membership), and only once the event is paid: 402 `payment_required` before;
 * 410 `event_expired` after deletion. `?dayId=` limits it to one day.
 */
export const GET = route<{ id: string }>(async (req, { id }) => {
  const { occasion } = await requireMember(id);
  assertCanDownload(await accessForOccasion(occasion));
  const q = readQuery(req, z.object({ dayId: z.string().uuid().optional() }));
  return json(await manifest(occasion, { dayId: q.dayId }));
});

/** Additive: same manifest for a selection from the host album, `{ ids }` (up to 500). */
export const POST = route<{ id: string }>(async (req, { id }) => {
  const { occasion } = await requireMember(id);
  assertCanDownload(await accessForOccasion(occasion));
  const { ids } = await readJson(req, z.object({ ids: z.array(z.string().uuid()).min(1).max(500) }));
  return json(await manifest(occasion, { ids }));
});
