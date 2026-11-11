import "server-only";
import { and, eq, gt, inArray, isNotNull, isNull, lt, lte, ne, or, sql, type SQL } from "drizzle-orm";
import { db, schema } from "@/db";
import { SUBSCRIPTION } from "./config";
import { emailConfigured, sendBillingEmail } from "./email";
import { cancelSubscriptionNow } from "./billing";
import { abortUpload, deleteObjects } from "./storage";
import { keysForOccasion } from "./occasion-service";

/**
 * The two daily jobs, called by /api/cron/* (Vercel Cron) and by "Run now" on /admin/system.
 * Every run is recorded in `cron_runs` (name, start/finish, ok, summary).
 */
export const CRON_JOBS = ["expiry", "cleanup"] as const;
export type CronJob = (typeof CRON_JOBS)[number];

export async function runCron(name: CronJob, trigger: "schedule" | "admin" = "schedule"): Promise<Record<string, unknown>> {
  const fn = name === "expiry" ? runExpiry : runCleanup;
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

// ── Expiry: account-billing transitions ──────────────────────────────────────────────────────────

const { hosts } = schema;
const BATCH = 100;
const DAY_MS = 86400_000;
const interval = (days: number) => sql.raw(`interval '${Math.round(days)} days'`);
type Claimed = { id: string; email: string; locale: string; brand: "ourpixs" | "bizimresimler"; deleteAfter: Date | null; stripeSubscriptionId: string | null };
const claimedCols = { id: hosts.id, email: hosts.email, locale: hosts.locale, brand: hosts.brand, deleteAfter: hosts.deleteAfter, stripeSubscriptionId: hosts.stripeSubscriptionId };
const loc = (l: string) => (l === "tr" ? "tr" : "en") as "en" | "tr";

/** Batch of host ids matching `where` (keeps every UPDATE bounded). */
const batchOf = (where: SQL | undefined) => db.select({ id: hosts.id }).from(hosts).where(where).limit(BATCH);

/** Complimentary access (admin): the jobs never end, warn or delete an account while it lasts. */
const notComped = (now: Date) => or(isNull(hosts.compUntil), lte(hosts.compUntil, now));

async function mailAll(rows: Claimed[], kind: Parameters<typeof sendBillingEmail>[1], days?: (r: Claimed) => number | null) {
  if (!emailConfigured()) return 0;
  let n = 0;
  for (const r of rows) {
    await sendBillingEmail(r.email, kind, { locale: loc(r.locale), brand: r.brand, date: r.deleteAfter, days: days?.(r) ?? null })
      .then(() => n++).catch((e) => console.error(`[expiry] ${kind} email failed`, e));
  }
  return n;
}

/**
 * Daily account-billing transitions. Every step is a conditional UPDATE … RETURNING, so a host is claimed
 * exactly once per step even if the job overlaps or re-runs (idempotent). Access itself never waits for
 * this job: src/lib/access.ts derives the effective state from the clock.
 *  1. Trial day-1 prompt email (monthly first)            → trial_prompt_sent_at
 *  2. Trial ended unpaid → expired, read-only, delete in 30 days, email
 *  3. Past-due grace (7 days) over → cancelled; Stripe subscription cancelled
 *  4. Cancelled → record read-only start + delete in 90 days, email ("cancellation effective")
 *  5. Deletion warnings (unpaid trial: 7 days before; cancelled: 14 days before) → deletion_warning_sent_at
 * Comped accounts are skipped by every step; once the complimentary period is over, read-only starts no earlier
 * than its end (greatest(…, comp_until)), matching access.ts. The deletions themselves run in the cleanup job.
 */
export async function runExpiry(): Promise<Record<string, number>> {
  const now = new Date();
  const out: Record<string, number> = {};

  // 1. Trial prompt (only claimed when email can actually be sent).
  if (emailConfigured()) {
    const prompt = await db.update(hosts).set({ trialPromptSentAt: now }).where(inArray(hosts.id, batchOf(and(
      eq(hosts.planStatus, "trialing"), isNull(hosts.trialPromptSentAt), gt(hosts.trialEndsAt, now), notComped(now),
      lte(hosts.trialStartedAt, new Date(now.getTime() - SUBSCRIPTION.trialPromptAfterHours * 3600_000)),
    )))).returning(claimedCols);
    out.trialPrompt = await mailAll(prompt, "trialPrompt", () => SUBSCRIPTION.trialDays);
  }

  // 2. Trial ended unpaid.
  const ended = await db.update(hosts).set({
    planStatus: "expired",
    readOnlySince: sql`greatest(${hosts.trialEndsAt}, ${hosts.compUntil})`,
    deleteAfter: sql`greatest(${hosts.trialEndsAt}, ${hosts.compUntil}) + ${interval(SUBSCRIPTION.trialGraceDeleteDays)}`,
    trialEndEmailSentAt: emailConfigured() ? now : null,
  }).where(inArray(hosts.id, batchOf(and(eq(hosts.planStatus, "trialing"), lte(hosts.trialEndsAt, now), notComped(now))))).returning(claimedCols);
  out.trialEnded = ended.length;
  await mailAll(ended, "trialEnded", () => SUBSCRIPTION.trialGraceDeleteDays);

  // 3. Past-due grace over: behaves as cancelled from the end of the grace period. Stop Stripe retrying, too.
  const lapsed = await db.update(hosts).set({
    planStatus: "cancelled", cancelAtPeriodEnd: false,
    currentPeriodEnd: sql`greatest(${hosts.pastDueSince} + ${interval(SUBSCRIPTION.pastDueGraceDays)}, ${hosts.compUntil})`,
  }).where(inArray(hosts.id, batchOf(and(
    eq(hosts.planStatus, "past_due"), isNotNull(hosts.pastDueSince), notComped(now),
    lte(hosts.pastDueSince, new Date(now.getTime() - SUBSCRIPTION.pastDueGraceDays * DAY_MS)),
  )))).returning(claimedCols);
  out.pastDueLapsed = lapsed.length;
  for (const h of lapsed) await cancelSubscriptionNow(h.stripeSubscriptionId).catch((e) => console.error("[expiry] stripe cancel failed", e));

  // 4. Cancellation effective (from the webhook, step 3, or a cancel-at-period-end whose period is over).
  await db.update(hosts).set({ planStatus: "cancelled", cancelAtPeriodEnd: false }).where(inArray(hosts.id, batchOf(and(
    eq(hosts.planStatus, "active"), eq(hosts.cancelAtPeriodEnd, true), lte(hosts.currentPeriodEnd, new Date(now.getTime() - DAY_MS)), notComped(now),
  ))));
  const cancelled = await db.update(hosts).set({
    readOnlySince: sql`greatest(coalesce(${hosts.currentPeriodEnd}, now()), ${hosts.compUntil})`,
    deleteAfter: sql`greatest(coalesce(${hosts.currentPeriodEnd}, now()), ${hosts.compUntil}) + ${interval(SUBSCRIPTION.cancelledReadOnlyDays)}`,
  }).where(inArray(hosts.id, batchOf(and(eq(hosts.planStatus, "cancelled"), isNull(hosts.readOnlySince), notComped(now))))).returning(claimedCols);
  out.cancelled = cancelled.length;
  await mailAll(cancelled, "cancelled", () => SUBSCRIPTION.cancelledReadOnlyDays);

  // 5. Deletion warnings.
  if (emailConfigured()) {
    const warn = await db.update(hosts).set({ deletionWarningSentAt: now }).where(inArray(hosts.id, batchOf(and(
      isNull(hosts.deletionWarningSentAt), isNotNull(hosts.deleteAfter), gt(hosts.deleteAfter, now), notComped(now),
      or(
        and(eq(hosts.planStatus, "expired"), lte(hosts.deleteAfter, new Date(now.getTime() + SUBSCRIPTION.trialDeletionWarningDays * DAY_MS))),
        and(eq(hosts.planStatus, "cancelled"), lte(hosts.deleteAfter, new Date(now.getTime() + SUBSCRIPTION.cancelledDeletionWarningDays * DAY_MS))),
      ),
    )))).returning(claimedCols);
    out.deletionWarnings = await mailAll(warn, "deletionSoon", (r) => (r.deleteAfter ? Math.max(1, Math.ceil((r.deleteAfter.getTime() - now.getTime()) / DAY_MS)) : null));
  }
  return out;
}

// ── Cleanup: retention deletions and housekeeping ────────────────────────────────────────────────

const MEDIA_BATCH = 300;
const EVENT_BATCH = 15;

/**
 * Account retention: once an unpaid trial's or cancelled account's delete_after has passed, every event it owns
 * loses its files (media, covers, guestbook recordings) and is archived. Idempotent: archived events are skipped,
 * so an interrupted run just continues next time. Subscribing before delete_after clears it (nothing is deleted).
 * Comped accounts are never deleted while the complimentary period lasts.
 */
async function deleteExpiredAccounts() {
  const { occasions } = schema;
  const now = new Date();
  const due = await db.select({ id: occasions.id }).from(occasions)
    .innerJoin(hosts, eq(hosts.id, occasions.ownerId))
    .where(and(ne(occasions.status, "archived"), inArray(hosts.planStatus, ["expired", "cancelled"]), lte(hosts.deleteAfter, now), notComped(now)))
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
export async function runCleanup(): Promise<Record<string, number>> {
  const archived = await deleteExpiredAccounts();
  const { media } = schema;
  const dayAgo = new Date(Date.now() - 24 * 3600_000);
  const stale = await db.select({ id: media.id, a: media.keyOriginal, b: media.keyDisplay, c: media.keyThumb, status: media.status })
    .from(media)
    .where(or(and(eq(media.status, "pending"), lt(media.createdAt, dayAgo)), eq(media.status, "failed"), eq(media.visibility, "deleted")))
    .limit(MEDIA_BATCH);
  if (stale.length) {
    await Promise.all(stale.filter((s) => s.status === "pending").map((s) => abortUpload(s.a)));
    await deleteObjects(stale.flatMap((s) => [s.a, s.b, s.c]));
    await db.delete(media).where(inArray(media.id, stale.map((s) => s.id)));
  }
  await db.delete(schema.loginTokens).where(lt(schema.loginTokens.createdAt, dayAgo));
  await db.delete(schema.rateLimits).where(and(lt(schema.rateLimits.updatedAt, new Date(Date.now() - 2 * 86400_000)), sql`${schema.rateLimits.key} not like 'mark:%'`));
  await db.delete(schema.shareLinks).where(lt(schema.shareLinks.expiresAt, new Date()));
  await db.delete(schema.cohostInvites).where(lt(schema.cohostInvites.createdAt, new Date(Date.now() - 90 * 86400_000)));
  // Keep a year of run history.
  await db.delete(schema.cronRuns).where(lt(schema.cronRuns.startedAt, new Date(Date.now() - 365 * 86400_000)));
  return { archived, media: stale.length };
}
