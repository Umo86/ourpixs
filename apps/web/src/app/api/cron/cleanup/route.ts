import type { NextRequest } from "next/server";
import { and, eq, inArray, lt, or, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { errorJson, json, toErrorResponse } from "@/lib/http";
import { abortUpload, deleteObjects } from "@/lib/storage";
import { cronAuthorized } from "../auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
const BATCH = 300;

/** Hourly: purge abandoned/failed/deleted media, stale login codes, rate-limit rows and expired share links. */
export async function GET(req: NextRequest) {
  if (!cronAuthorized(req)) return errorJson(401, "unauthorized", "Bad cron secret");
  try {
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
    return json({ ok: true, media: stale.length });
  } catch (e) {
    return toErrorResponse(e);
  }
}
