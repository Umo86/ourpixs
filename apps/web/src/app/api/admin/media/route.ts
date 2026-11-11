import { z } from "zod";
import { and, inArray, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { json, notFound, readJson } from "@/lib/http";
import { adminRoute, audit, optionalReason } from "@/lib/admin";
import { applyMediaAction } from "@/lib/media-actions";

const { media, mediaReports } = schema;

const body = z.object({
  ids: z.array(z.string().uuid()).min(1).max(200),
  /** approve = keep (approved, reports resolved) · restore = visible + approved · hide · delete (files too). */
  action: z.enum(["approve", "restore", "hide", "delete"]),
  reason: optionalReason,
});

/** Moderation on any media, across events (moderation queue and the event media grid). */
export const PATCH = adminRoute(async (req, _params, admin) => {
  const b = await readJson(req, body);
  const ids = [...new Set(b.ids)];
  const found = await db.select({ id: media.id, occasionId: media.occasionId }).from(media).where(inArray(media.id, ids));
  if (!found.length) throw notFound("Unknown media");
  const scope = inArray(media.id, found.map((f) => f.id));
  if (b.action === "restore") {
    await applyMediaAction(scope, "show");
    await applyMediaAction(scope, "approve");
  } else {
    await applyMediaAction(scope, b.action);
  }
  // Every decision closes the open reports on those items (delete removes them with the row).
  if (b.action !== "delete") {
    await db.update(mediaReports).set({ resolvedAt: new Date(), resolvedBy: admin.id })
      .where(and(inArray(mediaReports.mediaId, found.map((f) => f.id)), isNull(mediaReports.resolvedAt)));
  }
  await audit(admin, `media.${b.action}`, "media", found.length === 1 ? found[0]!.id : null, {
    ids: found.map((f) => f.id), occasionIds: [...new Set(found.map((f) => f.occasionId))], reason: b.reason || null,
  });
  return json({ ok: true, count: found.length });
});
