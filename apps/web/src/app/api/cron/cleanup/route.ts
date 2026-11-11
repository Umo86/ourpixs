import type { NextRequest } from "next/server";
import { and, eq, inArray, lt, lte, ne, or, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { errorJson, json, toErrorResponse } from "@/lib/http";
import { abortUpload, deleteObjects } from "@/lib/storage";
import { keysForOccasion } from "@/lib/occasion-service";
import { cronAuthorized } from "../auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
const BATCH = 300;
const EVENT_BATCH = 15;

/**
 * Account retention: once an unpaid trial's or cancelled account's delete_after has passed, every event it owns
 * loses its files (media, covers, guestbook recordings) and is archived. Idempotent: archived events are skipped,
 * so an interrupted run just continues next time. Subscribing before delete_after clears it (nothing is deleted).
 */
async function deleteExpiredAccounts() {
  const { occasions, hosts } = schema;
  const due = await db.select({ id: occasions.id }).from(occasions)
    .innerJoin(hosts, eq(hosts.id, occasions.ownerId))
    .where(and(ne(occasions.status, "archived"), inArray(hosts.planStatus, ["expired", "cancelled"]), lte(hosts.deleteAfter, new Date())))
    .limit(EVENT_BATCH);
  for (const o of due) {
    await deleteObjects(await keysForOccasion(o.id));
    await db.batch([
      db.delete(schema.media).where(eq(schema.media.occasionId, o.id)),
      db.delete(schema.messages).where(eq(schema.messages.occasionId, o.id)),
      db.delete(schema.shareLinks).where(eq(schema.shareLinks.occasionId, o.id)),
      db.update(occasions).set({ status: "archived", coverKey: null }).where(eq(occasions.id, o.id)),
    ]);
  }
  return due.length;
}

/** Daily (Vercel Hobby allows one run a day; upgrade to Pro to run hourly): delete files of lapsed accounts, purge abandoned/failed/deleted media, stale login codes, rate-limit rows and expired share links. */
export async function GET(req: NextRequest) {
  if (!cronAuthorized(req)) return errorJson(401, "unauthorized", "Bad cron secret");
  try {
    const archived = await deleteExpiredAccounts();
    const { media } = schema;
    const dayAgo = new Date(Date.now() - 24 * 3600_000);
    const stale = await db.select({ id: media.id, a: media.keyOriginal, b: media.keyDisplay, c: media.keyThumb, status: media.status })
      .from(media)
      .where(or(and(eq(media.status, "pending"), lt(media.createdAt, dayAgo)), eq(media.status, "failed"), eq(media.visibility, "deleted")))
      .limit(BATCH);
    if (stale.length) {
      await Promise.all(stale.filter((s) => s.status === "pending").map((s) => abortUpload(s.a)));
      await deleteObjects(stale.flatMap((s) => [s.a, s.b, s.c]));
      await db.delete(media).where(inArray(media.id, stale.map((s) => s.id)));
    }
    await db.delete(schema.loginTokens).where(lt(schema.loginTokens.createdAt, dayAgo));
    await db.delete(schema.rateLimits).where(and(lt(schema.rateLimits.updatedAt, new Date(Date.now() - 2 * 86400_000)), sql`${schema.rateLimits.key} not like 'mark:%'`));
    await db.delete(schema.shareLinks).where(lt(schema.shareLinks.expiresAt, new Date()));
    await db.delete(schema.cohostInvites).where(lt(schema.cohostInvites.createdAt, new Date(Date.now() - 90 * 86400_000)));
    return json({ ok: true, archived, media: stale.length });
  } catch (e) {
    return toErrorResponse(e);
  }
}
