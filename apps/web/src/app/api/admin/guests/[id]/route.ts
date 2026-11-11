import { z } from "zod";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { assertUuid, json, notFound, readJson } from "@/lib/http";
import { adminRoute, audit, optionalReason } from "@/lib/admin";
import { setGuestBlocked } from "@/lib/media-actions";

const body = z.object({ action: z.enum(["block", "unblock"]), reason: optionalReason });

/** Block / unblock a guest device in its event (same effect as the host's block: their media is hidden, no more uploads). */
export const POST = adminRoute<{ id: string }>(async (req, { id }, admin) => {
  assertUuid(id, "guest");
  const b = await readJson(req, body);
  const [g] = await db.select({ id: schema.guests.id, occasionId: schema.guests.occasionId, displayName: schema.guests.displayName })
    .from(schema.guests).where(eq(schema.guests.id, id)).limit(1);
  if (!g) throw notFound("Unknown guest");
  await setGuestBlocked(g.occasionId, g.id, b.action === "block");
  if (b.action === "block") {
    // Their media is hidden now, so their open reports are dealt with.
    const theirs = db.select({ id: schema.media.id }).from(schema.media).where(and(eq(schema.media.guestId, g.id), eq(schema.media.occasionId, g.occasionId)));
    await db.update(schema.mediaReports).set({ resolvedAt: new Date(), resolvedBy: admin.id })
      .where(and(inArray(schema.mediaReports.mediaId, theirs), isNull(schema.mediaReports.resolvedAt)));
  }
  await audit(admin, `guest.${b.action}`, "guest", g.id, { occasionId: g.occasionId, displayName: g.displayName, reason: b.reason || null });
  return json({ ok: true });
});
