import { and, eq, ne } from "drizzle-orm";
import { db, schema } from "@/db";
import { route, json, notFound, assertUuid } from "@/lib/http";
import { requireMember } from "@/lib/auth";
import { accessForOccasion, assertCanDownload } from "@/lib/access";
import { EXT_BY_MIME, presignGet } from "@/lib/storage";

/** Signed download URL for one original. 402 `plan_required` while downloads are locked. */
export const GET = route<{ id: string; mediaId: string }>(async (_req, { id, mediaId }) => {
  const { occasion } = await requireMember(id);
  assertUuid(mediaId, "photo");
  assertCanDownload(await accessForOccasion(occasion));
  const [m] = await db.select().from(schema.media)
    .where(and(eq(schema.media.id, mediaId), eq(schema.media.occasionId, occasion.id), eq(schema.media.status, "uploaded"), ne(schema.media.visibility, "deleted"))).limit(1);
  if (!m) throw notFound("Unknown photo");
  const name = `${m.id}.${EXT_BY_MIME[m.mime] || (m.kind === "video" ? "mp4" : "jpg")}`;
  return json({ url: await presignGet(m.keyOriginal, { download: name }) });
});
