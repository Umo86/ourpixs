import type { NextRequest } from "next/server";
import { and, eq, gt, lt, ne } from "drizzle-orm";
import { db, schema } from "@/db";
import { errorJson, json, toErrorResponse } from "@/lib/http";
import { deleteObjects } from "@/lib/storage";
import { emailConfigured, sendExpiryWarning } from "@/lib/email";
import { keysForOccasion } from "@/lib/occasion-service";
import { cronAuthorized } from "../auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Daily: archive albums past storage_expires_at (files deleted) and warn owners 7 days before. */
export async function GET(req: NextRequest) {
  if (!cronAuthorized(req)) return errorJson(401, "unauthorized", "Bad cron secret");
  try {
    const { occasions } = schema;
    const now = new Date();
    const expired = await db.select().from(occasions)
      .where(and(lt(occasions.storageExpiresAt, now), ne(occasions.status, "archived"))).limit(10);
    for (const o of expired) {
      await deleteObjects(await keysForOccasion(o.id));
      await db.batch([
        db.delete(schema.media).where(eq(schema.media.occasionId, o.id)),
        db.delete(schema.messages).where(eq(schema.messages.occasionId, o.id)),
        db.update(occasions).set({ status: "archived", coverKey: null }).where(eq(occasions.id, o.id)),
      ]);
    }

    let warned = 0;
    if (emailConfigured()) {
      const soon = await db.select({ o: occasions, email: schema.hosts.email, locale: schema.hosts.locale })
        .from(occasions).innerJoin(schema.hosts, eq(schema.hosts.id, occasions.ownerId))
        .where(and(gt(occasions.storageExpiresAt, now), lt(occasions.storageExpiresAt, new Date(now.getTime() + 7 * 86400_000)), eq(occasions.status, "active")))
        .limit(50);
      for (const s of soon) {
        // Marker row in rate_limits ("mark:" keys are never cleaned) makes the warning once-only per expiry date.
        const key = `mark:expiry:${s.o.id}:${s.o.storageExpiresAt!.toISOString().slice(0, 10)}`;
        const ins = await db.insert(schema.rateLimits).values({ key, tokens: 0 }).onConflictDoNothing().returning();
        if (!ins.length) continue;
        const locale = s.locale === "tr" ? "tr" : "en";
        await sendExpiryWarning(s.email, {
          title: s.o.title, occasionId: s.o.id, locale, brand: s.o.brand,
          date: s.o.storageExpiresAt!.toLocaleDateString(locale === "tr" ? "tr-TR" : "en-GB", { day: "numeric", month: "long", year: "numeric" }),
        }).catch((e) => console.error("[expiry] email failed", e));
        warned++;
      }
    }
    return json({ ok: true, archived: expired.length, warned });
  } catch (e) {
    return toErrorResponse(e);
  }
}
