import type { NextRequest } from "next/server";
import { and, eq, gt, inArray, isNotNull, isNull, lte, or, sql, type SQL } from "drizzle-orm";
import { db, schema } from "@/db";
import { SUBSCRIPTION } from "@/lib/config";
import { errorJson, json, toErrorResponse } from "@/lib/http";
import { emailConfigured, sendBillingEmail } from "@/lib/email";
import { cancelSubscriptionNow } from "@/lib/billing";
import { cronAuthorized } from "../auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const { hosts } = schema;
const BATCH = 100;
const DAY_MS = 86400_000;
const interval = (days: number) => sql.raw(`interval '${Math.round(days)} days'`);
type Claimed = { id: string; email: string; locale: string; brand: "ourpixs" | "bizimresimler"; deleteAfter: Date | null; stripeSubscriptionId: string | null };
const claimedCols = { id: hosts.id, email: hosts.email, locale: hosts.locale, brand: hosts.brand, deleteAfter: hosts.deleteAfter, stripeSubscriptionId: hosts.stripeSubscriptionId };
const loc = (l: string) => (l === "tr" ? "tr" : "en") as "en" | "tr";

/** Batch of host ids matching `where` (keeps every UPDATE bounded). */
const batchOf = (where: SQL | undefined) => db.select({ id: hosts.id }).from(hosts).where(where).limit(BATCH);

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
 * The deletions themselves run in /api/cron/cleanup.
 */
export async function GET(req: NextRequest) {
  if (!cronAuthorized(req)) return errorJson(401, "unauthorized", "Bad cron secret");
  try {
    const now = new Date();
    const out: Record<string, number> = {};

    // 1. Trial prompt (only claimed when email can actually be sent).
    if (emailConfigured()) {
      const prompt = await db.update(hosts).set({ trialPromptSentAt: now }).where(inArray(hosts.id, batchOf(and(
        eq(hosts.planStatus, "trialing"), isNull(hosts.trialPromptSentAt), gt(hosts.trialEndsAt, now),
        lte(hosts.trialStartedAt, new Date(now.getTime() - SUBSCRIPTION.trialPromptAfterHours * 3600_000)),
      )))).returning(claimedCols);
      out.trialPrompt = await mailAll(prompt, "trialPrompt", () => SUBSCRIPTION.trialDays);
    }

    // 2. Trial ended unpaid.
    const ended = await db.update(hosts).set({
      planStatus: "expired",
      readOnlySince: sql`${hosts.trialEndsAt}`,
      deleteAfter: sql`${hosts.trialEndsAt} + ${interval(SUBSCRIPTION.trialGraceDeleteDays)}`,
      trialEndEmailSentAt: emailConfigured() ? now : null,
    }).where(inArray(hosts.id, batchOf(and(eq(hosts.planStatus, "trialing"), lte(hosts.trialEndsAt, now))))).returning(claimedCols);
    out.trialEnded = ended.length;
    await mailAll(ended, "trialEnded", () => SUBSCRIPTION.trialGraceDeleteDays);

    // 3. Past-due grace over: behaves as cancelled from the end of the grace period. Stop Stripe retrying, too.
    const lapsed = await db.update(hosts).set({
      planStatus: "cancelled", cancelAtPeriodEnd: false,
      currentPeriodEnd: sql`${hosts.pastDueSince} + ${interval(SUBSCRIPTION.pastDueGraceDays)}`,
    }).where(inArray(hosts.id, batchOf(and(
      eq(hosts.planStatus, "past_due"), isNotNull(hosts.pastDueSince),
      lte(hosts.pastDueSince, new Date(now.getTime() - SUBSCRIPTION.pastDueGraceDays * DAY_MS)),
    )))).returning(claimedCols);
    out.pastDueLapsed = lapsed.length;
    for (const h of lapsed) await cancelSubscriptionNow(h.stripeSubscriptionId).catch((e) => console.error("[expiry] stripe cancel failed", e));

    // 4. Cancellation effective (from the webhook, step 3, or a cancel-at-period-end whose period is over).
    await db.update(hosts).set({ planStatus: "cancelled", cancelAtPeriodEnd: false }).where(inArray(hosts.id, batchOf(and(
      eq(hosts.planStatus, "active"), eq(hosts.cancelAtPeriodEnd, true), lte(hosts.currentPeriodEnd, new Date(now.getTime() - DAY_MS)),
    ))));
    const cancelled = await db.update(hosts).set({
      readOnlySince: sql`coalesce(${hosts.currentPeriodEnd}, now())`,
      deleteAfter: sql`coalesce(${hosts.currentPeriodEnd}, now()) + ${interval(SUBSCRIPTION.cancelledReadOnlyDays)}`,
    }).where(inArray(hosts.id, batchOf(and(eq(hosts.planStatus, "cancelled"), isNull(hosts.readOnlySince))))).returning(claimedCols);
    out.cancelled = cancelled.length;
    await mailAll(cancelled, "cancelled", () => SUBSCRIPTION.cancelledReadOnlyDays);

    // 5. Deletion warnings.
    if (emailConfigured()) {
      const warn = await db.update(hosts).set({ deletionWarningSentAt: now }).where(inArray(hosts.id, batchOf(and(
        isNull(hosts.deletionWarningSentAt), isNotNull(hosts.deleteAfter), gt(hosts.deleteAfter, now),
        or(
          and(eq(hosts.planStatus, "expired"), lte(hosts.deleteAfter, new Date(now.getTime() + SUBSCRIPTION.trialDeletionWarningDays * DAY_MS))),
          and(eq(hosts.planStatus, "cancelled"), lte(hosts.deleteAfter, new Date(now.getTime() + SUBSCRIPTION.cancelledDeletionWarningDays * DAY_MS))),
        ),
      )))).returning(claimedCols);
      out.deletionWarnings = await mailAll(warn, "deletionSoon", (r) => (r.deleteAfter ? Math.max(1, Math.ceil((r.deleteAfter.getTime() - now.getTime()) / DAY_MS)) : null));
    }
    return json({ ok: true, ...out });
  } catch (e) {
    return toErrorResponse(e);
  }
}
