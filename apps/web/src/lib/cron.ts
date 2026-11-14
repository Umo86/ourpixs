import "server-only";
import { and, eq, gt, inArray, isNotNull, isNull, lt, lte, ne, or, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { DELETION_REMINDER_DAYS, UNPAID_REMINDER_DAYS } from "./config";
import { emailConfigured, sendDeletionReminder, sendUnpaidDeletionReminder } from "./email";
import { sendDueEndedEmails } from "./package";
import { sendGuestGalleryEmails } from "./consent";
import { abortUpload, deleteObjects, mediaFileKeys } from "./storage";
import { sweepMedia } from "./media-processing";
import { deleteOccasion, guestPurchaseHold, holdFilesForBuyers, keysForOccasion, type DeletedBy } from "./occasion-service";
import { getSettings } from "./settings";

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
 *  4. Unpaid events: one reminder UNPAID_REMINDER_DAYS (7) before created_at + settings.unpaidDeleteDays
 *     (unpaid_reminder_sent_at), with a link to pay or download the test uploads.
 * The deletions themselves run in the cleanup job.
 */
export async function runExpiry(): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  // Emails go out one at a time (and the provider rate-limits), so every step works to a deadline inside the function's
  // maxDuration (300 s): rows it can't reach in time are released and picked up by the next run, never left "sent".
  const started = Date.now();
  out.endedEmails = await sendDueEndedEmails({ max: BATCH, deadline: started + 80_000 });
  // Guests who asked for the photos by email (transactional; they requested it).
  out.guestPhotoEmails = await sendGuestGalleryEmails({ max: 300, deadline: started + 190_000 });
  out.reminders30 = 0;
  out.reminders7 = 0;
  if (!emailConfigured()) return out;
  const now = new Date();
  for (const days of DELETION_REMINDER_DAYS) {
    const col = days === 30 ? O.reminder30SentAt : O.reminder7SentAt;
    // The 30-day reminder is skipped once the 7-day window has started (no two emails in one run).
    const lowerBound = days === 30 ? new Date(now.getTime() + 7 * DAY_MS) : now;
    const batch = db.select({ id: O.id }).from(O).where(and(
      inArray(O.packageStatus, ["paid", "live", "ended"]), isNull(col), isNotNull(O.deleteAfter), isNull(O.deletedAt),
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
    for (const [i, c] of claimed.entries()) {
      if (Date.now() > started + 250_000) {
        // Out of time: release the unsent reminders for the next run.
        await db.update(O).set(days === 30 ? { reminder30SentAt: null } : { reminder7SentAt: null }).where(inArray(O.id, claimed.slice(i).map((x) => x.id))).catch(() => {});
        break;
      }
      const h = byId.get(c.ownerId);
      if (!h || !c.deleteAfter) continue;
      const left = Math.max(1, Math.ceil((c.deleteAfter.getTime() - now.getTime()) / DAY_MS));
      await sendDeletionReminder(h.email, { locale: loc(h.locale), brand: h.brand, title: c.title, occasionId: c.id, date: c.deleteAfter, days: left })
        .then(() => n++).catch((e) => console.error(`[expiry] ${days}-day reminder failed`, e));
    }
    out[days === 30 ? "reminders30" : "reminders7"] = n;
  }
  out.unpaidReminders = await sendUnpaidReminders(started + 280_000);
  return out;
}

/**
 * One email per unpaid (setup) event, UNPAID_REMINDER_DAYS before it is deleted (created_at + settings.unpaidDeleteDays):
 * pay to keep it, or download the test uploads. Claimed with a conditional UPDATE on unpaid_reminder_sent_at, released
 * again if sending fails or the run is out of time. Events already past the date are not reminded (they are deleted).
 */
async function sendUnpaidReminders(deadline: number): Promise<number> {
  if (!emailConfigured()) return 0;
  const s = await getSettings();
  const now = new Date();
  const deleteAt = sql`(${O.createdAt} + make_interval(days => ${s.unpaidDeleteDays}::int))`;
  const batch = db.select({ id: O.id }).from(O).where(and(
    eq(O.packageStatus, "setup"), isNull(O.deletedAt), isNull(O.unpaidReminderSentAt),
    sql`${deleteAt} > now()`, sql`${deleteAt} <= now() + make_interval(days => ${UNPAID_REMINDER_DAYS}::int)`,
  )).limit(BATCH);
  const claimed = await db.update(O).set({ unpaidReminderSentAt: now })
    .where(and(inArray(O.id, batch), isNull(O.unpaidReminderSentAt), eq(O.packageStatus, "setup")))
    .returning({ id: O.id, title: O.title, ownerId: O.ownerId, createdAt: O.createdAt });
  if (!claimed.length) return 0;
  const owners = await db.select({ id: schema.hosts.id, email: schema.hosts.email, locale: schema.hosts.locale, brand: schema.hosts.brand, deletedAt: schema.hosts.deletedAt })
    .from(schema.hosts).where(inArray(schema.hosts.id, [...new Set(claimed.map((c) => c.ownerId))]));
  const byId = new Map(owners.map((h) => [h.id, h]));
  let sent = 0;
  for (const [i, c] of claimed.entries()) {
    if (Date.now() > deadline) {
      await db.update(O).set({ unpaidReminderSentAt: null }).where(inArray(O.id, claimed.slice(i).map((x) => x.id))).catch(() => {});
      break;
    }
    const h = byId.get(c.ownerId);
    if (!h || h.deletedAt) continue;
    const date = new Date(c.createdAt.getTime() + s.unpaidDeleteDays * DAY_MS);
    const days = Math.max(1, Math.ceil((date.getTime() - now.getTime()) / DAY_MS));
    try {
      await sendUnpaidDeletionReminder(h.email, { locale: loc(h.locale), brand: h.brand, title: c.title, occasionId: c.id, date, days, limitDays: s.unpaidDeleteDays });
      sent++;
    } catch (e) {
      console.error("[expiry] unpaid reminder failed", e);
      await db.update(O).set({ unpaidReminderSentAt: null }).where(eq(O.id, c.id)).catch(() => {});
    }
  }
  return sent;
}

// ── Cleanup: retention deletions and housekeeping ────────────────────────────────────────────────

const MEDIA_BATCH = 300;
const EVENT_BATCH = 15;

/**
 * Retention: once an event's delete_after has passed (closes_at + settings.retentionMonths), its files (media, covers,
 * guestbook recordings) are deleted, the event is archived and its package marked 'expired'. If guests still have paid
 * download links, the package is marked 'expired' now (closed to host downloads and guests) but the photo/video files
 * are kept until files_delete_after (the latest link expiry); the next run after that date deletes them.
 * Idempotent: archived events are skipped, so an interrupted run just continues next time. Setup and refunded events
 * are not touched here (unpaid events: deleteUnpaidEvents).
 */
async function deleteExpiredEvents(deadline: number) {
  const now = new Date();
  const due = await db.select({ id: O.id }).from(O)
    .where(and(
      ne(O.status, "archived"), inArray(O.packageStatus, ["paid", "live", "ended", "expired"]), isNotNull(O.deleteAfter), lte(O.deleteAfter, now),
      isNull(O.deletedAt), or(isNull(O.filesDeleteAfter), lte(O.filesDeleteAfter, now)),
    ))
    .limit(EVENT_BATCH);
  let deleted = 0, kept = 0;
  for (const o of due) {
    if (Date.now() > deadline) break;
    const hold = await guestPurchaseHold(o.id);
    if (hold.until) {
      await holdFilesForBuyers(o.id, hold.until, { expire: true });
      kept++;
      continue;
    }
    await deleteObjects(await keysForOccasion(o.id));
    await db.batch([
      db.delete(schema.media).where(eq(schema.media.occasionId, o.id)),
      db.delete(schema.messages).where(eq(schema.messages.occasionId, o.id)),
      db.delete(schema.shareLinks).where(eq(schema.shareLinks.occasionId, o.id)),
      // Guests' emails for this event go with its files (privacy policy: 12 months after the gallery ends).
      db.delete(schema.guestContacts).where(eq(schema.guestContacts.occasionId, o.id)),
      db.update(O).set({ status: "archived", coverKey: null, packageStatus: "expired", filesDeleteAfter: null }).where(eq(O.id, o.id)),
    ]);
    deleted++;
  }
  return { deleted, kept };
}

/**
 * Unpaid events: an event still in setup (never paid, not marked as paid) is deleted with its test uploads and files
 * settings.unpaidDeleteDays (default 90) after it was created. Each event is claimed first with a conditional UPDATE
 * (setup, not deleted, still past the date → deleted_at, deleted_by 'unpaid'), so a payment that lands at the same
 * moment wins (billing.ts never marks a deleted event as paid) and the event disappears for the host at once; then
 * deleteOccasion removes the files and the row (or, if guests still hold paid links, e.g. after an admin reset the event
 * to setup, keeps the photo/video files until those expire). A claimed event whose deletion fails half-way is finished by
 * purgeDeletedEvents on the next run.
 */
async function deleteUnpaidEvents(deadline: number) {
  const s = await getSettings();
  const pastLimit = sql`${O.createdAt} + make_interval(days => ${s.unpaidDeleteDays}::int) <= now()`;
  const due = await db.select({ id: O.id }).from(O)
    .where(and(eq(O.packageStatus, "setup"), isNull(O.deletedAt), pastLimit)).limit(EVENT_BATCH);
  let deleted = 0, kept = 0;
  for (const o of due) {
    if (Date.now() > deadline) break;
    const claimed = await db.update(O).set({ deletedAt: new Date(), deletedBy: "unpaid" })
      .where(and(eq(O.id, o.id), eq(O.packageStatus, "setup"), isNull(O.deletedAt), pastLimit)).returning({ id: O.id });
    if (!claimed.length) continue;
    const r = await deleteOccasion(o.id, "unpaid");
    if (r.keptUntil) kept++; else deleted++;
  }
  return { deleted, kept };
}

/**
 * Deleted events whose files were kept for guests' paid links (deleted_at, files_delete_after ≤ now), and claimed
 * deletions that didn't finish (deleted_at, no files_delete_after): deleteOccasion runs again. With no active purchase
 * left the files and the row go; a purchase that became active meanwhile pushes files_delete_after later.
 */
async function purgeDeletedEvents(deadline: number) {
  const now = new Date();
  const due = await db.select({ id: O.id, by: O.deletedBy }).from(O)
    .where(and(isNotNull(O.deletedAt), or(isNull(O.filesDeleteAfter), lte(O.filesDeleteAfter, now)))).limit(EVENT_BATCH);
  let deleted = 0, kept = 0;
  for (const o of due) {
    if (Date.now() > deadline) break;
    const by = (["host", "account", "admin", "unpaid"].includes(o.by ?? "") ? o.by : "host") as DeletedBy;
    const r = await deleteOccasion(o.id, by);
    if (r.keptUntil) kept++; else deleted++;
  }
  // Accounts deleted while some of their events were kept for guests (src/lib/account.ts): gone once those events are.
  const H = schema.hosts;
  const hosts = await db.delete(H).where(and(isNotNull(H.deletedAt), sql`not exists (select 1 from occasions o where o.owner_id = ${H.id})`))
    .returning({ id: H.id });
  return { deleted, kept, accounts: hosts.length };
}

/**
 * Daily (Vercel Hobby allows one run a day; upgrade to Pro to run hourly): finish deletions whose files were kept for
 * guests' paid links, delete unpaid events past settings.unpaidDeleteDays, delete files of events past retention, purge
 * abandoned/failed/deleted media, stale login codes, rate-limit rows and expired share links.
 */
export async function runCleanup(): Promise<Record<string, number>> {
  // Storage deletions are sequential: each step works to a deadline inside the function's maxDuration (300 s) and leaves
  // the rest for the next run (every step is idempotent and picks up where it stopped).
  const started = Date.now();
  const purged = await purgeDeletedEvents(started + 70_000);
  const unpaid = await deleteUnpaidEvents(started + 140_000);
  const retention = await deleteExpiredEvents(started + 210_000);
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
  return {
    archived: retention.deleted, retentionKeptForBuyers: retention.kept, unpaidDeleted: unpaid.deleted, unpaidKeptForBuyers: unpaid.kept,
    deletedPurged: purged.deleted, deletedStillKept: purged.kept, accountsPurged: purged.accounts, media: stale.length,
  };
}
