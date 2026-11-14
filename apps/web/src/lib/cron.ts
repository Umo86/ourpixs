import "server-only";
import { and, eq, gt, inArray, isNotNull, isNull, lt, lte, ne, or, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { DELETION_REMINDER_DAYS } from "./config";
import { emailConfigured, sendDeletionReminder } from "./email";
import { sendDueEndedEmails } from "./package";
import { sendGuestGalleryEmails } from "./consent";
import { abortUpload, deleteObjects, mediaFileKeys } from "./storage";
import { sweepMedia } from "./media-processing";
import { keysForOccasion } from "./occasion-service";

/**
 * The jobs called by /api/cron/* (Vercel Cron) and by "Run now" on /admin/system: expiry and cleanup (daily) and the
 * media sweep (daily on Hobby, every 10 minutes on Pro; retries pending/failed previews and transcodes).
 * Every run is recorded in `cron_runs` (name, start/finish, ok, summary).
 */
export const CRON_JOBS = ["expiry", "cleanup", "media"] as const;
export type CronJob = (typeof CRON_JOBS)[number];

export async function runCron(name: CronJob, trigger: "schedule" | "admin" = "schedule"): Promise<Record<string, unknown>> {
  const fn = name === "expiry" ? runExpiry : name === "media" ? () => sweepMedia({ budgetMs: 240_000 }) : runCleanup;
  const [run] = await db.insert(schema.cronRuns).values({ name, summary: { trigger } }).returning({ id: schema.cronRuns.id })
    .catch((e) => { console.error("[cron] could not record run", e); return [] as { id: string }[]; });
  try {
    const summary = await fn();
    if (run) await db.update(schema.cronRuns).set({ finishedAt: new Date(), ok: true, summary: { trigger, ...summary } }).where(eq(schema.cronRuns.id, run.id));
    return summary;
  } catch (e) {
    if (run) {
      await db.update(schema.cronRuns).set({ finishedAt: new Date(), ok: false, summary: { trigger, error: String((e as Error)?.message ?? e).slice(0, 500) } })
        .where(eq(schema.cronRuns.id, run.id)).catch(() => {});
    }
    throw e;
  }
}

// ── Expiry: event-package transitions and emails ───────────────────────────────────────────────

const O = schema.occasions;
const DAY_MS = 86400_000;
const BATCH = 100;
const loc = (l: string) => (l === "tr" ? "tr" : "en") as "en" | "tr";

/**
 * Daily event-package jobs. Each step claims rows with a conditional UPDATE … RETURNING, so an event is handled
 * exactly once per step even if the job overlaps or re-runs. Access never waits for this job: src/lib/access.ts
 * derives the effective state from the clock.
 *  1. Gallery ended (closes_at passed) → package_status 'ended' + "download everything" email to the owner.
 *     Vercel Hobby crons run once a day, so this can lag up to a day; the same claim also runs lazily whenever
 *     an ended event is opened (src/lib/package.ts → touchEnded).
 *  2. Guests who asked on the event page get one "the gallery has closed, here are the photos" email.
 *  3. Deletion reminders 30 and 7 days before delete_after (one marker column each).
 * The deletions themselves run in the cleanup job.
 */
export async function runExpiry(): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  out.endedEmails = await sendDueEndedEmails({ max: BATCH });
  // Guests who asked for the photos by email (transactional; they requested it).
  out.guestPhotoEmails = await sendGuestGalleryEmails({ max: 500 });
  out.reminders30 = 0;
  out.reminders7 = 0;
  if (!emailConfigured()) return out;
  const now = new Date();
  for (const days of DELETION_REMINDER_DAYS) {
    const col = days === 30 ? O.reminder30SentAt : O.reminder7SentAt;
    // The 30-day reminder is skipped once the 7-day window has started (no two emails in one run).
    const lowerBound = days === 30 ? new Date(now.getTime() + 7 * DAY_MS) : now;
    const batch = db.select({ id: O.id }).from(O).where(and(
      inArray(O.packageStatus, ["paid", "live", "ended"]), isNull(col), isNotNull(O.deleteAfter),
      gt(O.deleteAfter, lowerBound), lte(O.deleteAfter, new Date(now.getTime() + days * DAY_MS)),
    )).limit(BATCH);
    const claimed = await db.update(O).set(days === 30 ? { reminder30SentAt: now } : { reminder7SentAt: now })
      .where(and(inArray(O.id, batch), isNull(col)))
      .returning({ id: O.id, title: O.title, ownerId: O.ownerId, deleteAfter: O.deleteAfter });
    if (!claimed.length) continue;
    const owners = await db.select({ id: schema.hosts.id, email: schema.hosts.email, locale: schema.hosts.locale, brand: schema.hosts.brand })
      .from(schema.hosts).where(inArray(schema.hosts.id, [...new Set(claimed.map((c) => c.ownerId))]));
    const byId = new Map(owners.map((h) => [h.id, h]));
    let n = 0;
    for (const c of claimed) {
      const h = byId.get(c.ownerId);
      if (!h || !c.deleteAfter) continue;
      const left = Math.max(1, Math.ceil((c.deleteAfter.getTime() - now.getTime()) / DAY_MS));
      await sendDeletionReminder(h.email, { locale: loc(h.locale), brand: h.brand, title: c.title, occasionId: c.id, date: c.deleteAfter, days: left })
        .then(() => n++).catch((e) => console.error(`[expiry] ${days}-day reminder failed`, e));
    }
    out[days === 30 ? "reminders30" : "reminders7"] = n;
  }
  return out;
}

// ── Cleanup: retention deletions and housekeeping ────────────────────────────────────────────────

const MEDIA_BATCH = 300;
const EVENT_BATCH = 15;

/**
 * Retention: once an event's delete_after has passed (closes_at + settings.retentionMonths), its files (media, covers,
 * guestbook recordings) are deleted, the event is archived and its package marked 'expired'. Idempotent: archived events
 * are skipped, so an interrupted run just continues next time. Setup (never paid) and refunded events are not touched here.
 */
async function deleteExpiredEvents() {
  const now = new Date();
  const due = await db.select({ id: O.id }).from(O)
    .where(and(ne(O.status, "archived"), inArray(O.packageStatus, ["paid", "live", "ended", "expired"]), isNotNull(O.deleteAfter), lte(O.deleteAfter, now)))
    .limit(EVENT_BATCH);
  for (const o of due) {
    await deleteObjects(await keysForOccasion(o.id));
    await db.batch([
      db.delete(schema.media).where(eq(schema.media.occasionId, o.id)),
      db.delete(schema.messages).where(eq(schema.messages.occasionId, o.id)),
      db.delete(schema.shareLinks).where(eq(schema.shareLinks.occasionId, o.id)),
      // Guests' emails for this event go with its files (privacy policy: 12 months after the gallery ends).
      db.delete(schema.guestContacts).where(eq(schema.guestContacts.occasionId, o.id)),
      db.update(O).set({ status: "archived", coverKey: null, packageStatus: "expired" }).where(eq(O.id, o.id)),
    ]);
  }
  return due.length;
}

/** Daily (Vercel Hobby allows one run a day; upgrade to Pro to run hourly): delete files of events past retention, purge abandoned/failed/deleted media, stale login codes, rate-limit rows and expired share links. */
export async function runCleanup(): Promise<Record<string, number>> {
  const archived = await deleteExpiredEvents();
  const { media } = schema;
  const dayAgo = new Date(Date.now() - 24 * 3600_000);
  const stale = await db.select({
    id: media.id, status: media.status, keyOriginal: media.keyOriginal, keyDisplay: media.keyDisplay, keyThumb: media.keyThumb,
    keyGuest: media.keyGuest, keyGuestThumb: media.keyGuestThumb, keyVideo: media.keyVideo, keyGuestVideo: media.keyGuestVideo,
  })
    .from(media)
    .where(or(and(eq(media.status, "pending"), lt(media.createdAt, dayAgo)), eq(media.status, "failed"), eq(media.visibility, "deleted")))
    .limit(MEDIA_BATCH);
  if (stale.length) {
    await Promise.all(stale.filter((s) => s.status === "pending").map((s) => abortUpload(s.keyOriginal)));
    await deleteObjects(stale.flatMap(mediaFileKeys));
    await db.delete(media).where(inArray(media.id, stale.map((s) => s.id)));
  }
  await db.delete(schema.loginTokens).where(lt(schema.loginTokens.createdAt, dayAgo));
  await db.delete(schema.rateLimits).where(and(lt(schema.rateLimits.updatedAt, new Date(Date.now() - 2 * 86400_000)), sql`${schema.rateLimits.key} not like 'mark:%'`));
  await db.delete(schema.shareLinks).where(lt(schema.shareLinks.expiresAt, new Date()));
  await db.delete(schema.cohostInvites).where(lt(schema.cohostInvites.createdAt, new Date(Date.now() - 90 * 86400_000)));
  // Records of marketing consent: kept while valid and for 2 years after withdrawal (privacy policy), then purged.
  await db.delete(schema.marketingConsents).where(lt(schema.marketingConsents.withdrawnAt, new Date(Date.now() - 2 * 365 * 86400_000)));
  // Keep a year of run history.
  await db.delete(schema.cronRuns).where(lt(schema.cronRuns.startedAt, new Date(Date.now() - 365 * 86400_000)));
  return { archived, media: stale.length };
}
