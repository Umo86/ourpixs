import { and, eq, isNull, ne } from "drizzle-orm";
import { db, schema } from "@/db";
import { route, json, notFound, assertUuid } from "@/lib/http";
import { requireMember } from "@/lib/auth";
import { accessForOccasion, assertCanDownload, hostDownloadScope } from "@/lib/access";
import { EXT_BY_MIME, privateGetUrl } from "@/lib/storage";

/**
 * Signed download URL (1 h) for one original. Hosts and co-hosts of a paid event; before paying only the hosts' own
 * test uploads (never a guest's), otherwise 402 `payment_required`.
 */
export const GET = route<{ id: string; mediaId: string }>(async (_req, { id, mediaId }) => {
  const { occasion } = await requireMember(id);
  assertUuid(mediaId, "photo");
  const access = await accessForOccasion(occasion);
  const scope = hostDownloadScope(access);
  const [m] = await db.select().from(schema.media)
    .where(and(eq(schema.media.id, mediaId), eq(schema.media.occasionId, occasion.id), eq(schema.media.status, "uploaded"), ne(schema.media.visibility, "deleted"),
      scope === "test" ? isNull(schema.media.guestId) : undefined)).limit(1);
  if (!m) {
    if (scope === "test") assertCanDownload(access);
    throw notFound("Unknown photo");
  }
  const name = `${m.id}.${EXT_BY_MIME[m.mime] || (m.kind === "video" ? "mp4" : "jpg")}`;
  return json({ url: await privateGetUrl(m.keyOriginal, 3600, { download: name }) });
});
