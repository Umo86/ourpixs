import "server-only";
import { cache } from "react";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { SUBSCRIPTION } from "./config";
import { ApiError } from "./http";

/**
 * ONE place that decides what an account (and every event it owns) may do right now.
 * Everything is computed from the stored billing columns and the clock, so access is correct even
 * before the daily cron has recorded a transition (trial end, past-due grace, period end).
 * Events follow their OWNER's account — co-hosts never change what an event can do.
 */

type HostRow = typeof schema.hosts.$inferSelect;
type OccasionRow = typeof schema.occasions.$inferSelect;
export type BillingRow = Pick<HostRow,
  "planStatus" | "planInterval" | "trialStartedAt" | "trialEndsAt" | "currentPeriodEnd" | "cancelAtPeriodEnd" | "pastDueSince" | "readOnlySince" | "deleteAfter">;

export type SubscriptionStatus = "none" | "trialing" | "active" | "past_due" | "cancelled" | "expired";
/** Why an event is limited: "trial" (downloads locked), "trial_ended", "cancelled", "past_due" (grace period), or null. */
export type AccessReason = "trial" | "trial_ended" | "cancelled" | "past_due" | null;

export type Access = {
  status: SubscriptionStatus;
  interval: "month" | "year" | null;
  canCreateEvents: boolean;
  canUpload: boolean;
  canDownload: boolean;
  readOnly: boolean;
  showUpgradePrompt: boolean;
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  /** Whole days left in the current phase (trial, grace period, paid period being cancelled, or until deletion). */
  daysLeft: number | null;
  /** When files will be deleted (read-only states only). */
  deleteAfter: Date | null;
  /** True once deleteAfter has passed (files are, or are about to be, removed). */
  deleted: boolean;
  reason: AccessReason;
};

const DAY = 86400_000;
const HOUR = 3600_000;
const plus = (d: Date, days: number) => new Date(d.getTime() + days * DAY);
const daysUntil = (d: Date | null, now: Date) => (d ? Math.max(0, Math.ceil((d.getTime() - now.getTime()) / DAY)) : null);

export const trialEndFrom = (start: Date) => plus(start, SUBSCRIPTION.trialDays);
export const trialDeleteAfter = (trialEnd: Date) => plus(trialEnd, SUBSCRIPTION.trialGraceDeleteDays);
export const cancelledDeleteAfter = (endedAt: Date) => plus(endedAt, SUBSCRIPTION.cancelledReadOnlyDays);
export const pastDueGraceEnd = (since: Date) => plus(since, SUBSCRIPTION.pastDueGraceDays);

/** Effective status right now (stored status + the clock). */
function effective(h: BillingRow, now: Date): { status: SubscriptionStatus; endedAt: Date | null } {
  switch (h.planStatus) {
    case "trialing":
      if (h.trialEndsAt && now >= h.trialEndsAt) return { status: "expired", endedAt: h.trialEndsAt };
      return { status: "trialing", endedAt: null };
    case "active":
      // Webhook not processed yet, but the cancelled period is over.
      if (h.cancelAtPeriodEnd && h.currentPeriodEnd && now >= h.currentPeriodEnd) return { status: "cancelled", endedAt: h.currentPeriodEnd };
      return { status: "active", endedAt: null };
    case "past_due": {
      const since = h.pastDueSince ?? now;
      const grace = pastDueGraceEnd(since);
      if (now >= grace) return { status: "cancelled", endedAt: h.readOnlySince ?? grace };
      return { status: "past_due", endedAt: null };
    }
    case "cancelled":
      return { status: "cancelled", endedAt: h.readOnlySince ?? h.currentPeriodEnd ?? now };
    case "expired":
      return { status: "expired", endedAt: h.readOnlySince ?? h.trialEndsAt ?? now };
    default:
      return { status: "none", endedAt: null };
  }
}

export function computeAccess(h: BillingRow, now = new Date()): Access {
  const { status, endedAt } = effective(h, now);
  const base = {
    status, interval: h.planInterval ?? null, trialEndsAt: h.trialEndsAt ?? null, currentPeriodEnd: h.currentPeriodEnd ?? null,
    cancelAtPeriodEnd: !!h.cancelAtPeriodEnd,
  };
  if (status === "none") {
    // No trial yet: creating the first event starts it. (Events without a started trial only exist from before subscriptions.)
    return { ...base, canCreateEvents: true, canUpload: true, canDownload: false, readOnly: false, showUpgradePrompt: false,
      daysLeft: null, deleteAfter: null, deleted: false, reason: "trial" };
  }
  if (status === "trialing") {
    const promptAt = (h.trialStartedAt ?? now).getTime() + SUBSCRIPTION.trialPromptAfterHours * HOUR;
    return { ...base, canCreateEvents: true, canUpload: true, canDownload: false, readOnly: false, showUpgradePrompt: now.getTime() >= promptAt,
      daysLeft: daysUntil(h.trialEndsAt, now), deleteAfter: null, deleted: false, reason: "trial" };
  }
  if (status === "active") {
    return { ...base, canCreateEvents: true, canUpload: true, canDownload: true, readOnly: false, showUpgradePrompt: false,
      daysLeft: h.cancelAtPeriodEnd ? daysUntil(h.currentPeriodEnd, now) : null, deleteAfter: null, deleted: false, reason: null };
  }
  if (status === "past_due") {
    return { ...base, canCreateEvents: true, canUpload: true, canDownload: true, readOnly: false, showUpgradePrompt: true,
      daysLeft: daysUntil(pastDueGraceEnd(h.pastDueSince ?? now), now), deleteAfter: null, deleted: false, reason: "past_due" };
  }
  // Read-only states. Stored delete_after wins (the cron records it); otherwise derive it.
  const deleteAfter = h.deleteAfter ?? (status === "expired" ? trialDeleteAfter(endedAt!) : cancelledDeleteAfter(endedAt!));
  const deleted = now >= deleteAfter;
  return {
    ...base, cancelAtPeriodEnd: false, canCreateEvents: false, canUpload: false,
    // Cancelled: everything stays downloadable until deletion. Unpaid trial: downloads stay locked.
    canDownload: status === "cancelled" && !deleted,
    readOnly: true, showUpgradePrompt: true, daysLeft: daysUntil(deleteAfter, now), deleteAfter, deleted,
    reason: status === "expired" ? "trial_ended" : "cancelled",
  };
}

/** Per-event view of the owner's access (what the API calls `occasion.access`). */
export type OccasionAccess = { canUpload: boolean; canDownload: boolean; readOnly: boolean; reason: AccessReason };
export const occasionAccessOf = (a: Access): OccasionAccess => ({ canUpload: a.canUpload, canDownload: a.canDownload, readOnly: a.readOnly, reason: a.reason });

/** The owner's billing row, memoised per request. */
export const loadOwnerBilling = cache(async (ownerId: string): Promise<BillingRow | null> => {
  const [h] = await db.select({
    planStatus: schema.hosts.planStatus, planInterval: schema.hosts.planInterval, trialStartedAt: schema.hosts.trialStartedAt,
    trialEndsAt: schema.hosts.trialEndsAt, currentPeriodEnd: schema.hosts.currentPeriodEnd, cancelAtPeriodEnd: schema.hosts.cancelAtPeriodEnd,
    pastDueSince: schema.hosts.pastDueSince, readOnlySince: schema.hosts.readOnlySince, deleteAfter: schema.hosts.deleteAfter,
  }).from(schema.hosts).where(eq(schema.hosts.id, ownerId)).limit(1);
  return h ?? null;
});

const NO_OWNER: BillingRow = {
  planStatus: "expired", planInterval: null, trialStartedAt: null, trialEndsAt: null, currentPeriodEnd: null, cancelAtPeriodEnd: false,
  pastDueSince: null, readOnlySince: new Date(0), deleteAfter: new Date(0),
};

/** Access for an event = its owner's access. */
export async function accessForOccasion(o: Pick<OccasionRow, "ownerId">, now = new Date()): Promise<Access> {
  return computeAccess((await loadOwnerBilling(o.ownerId)) ?? NO_OWNER, now);
}

/** Batch variant for lists (one query per distinct owner). */
export async function accessForOwners(ownerIds: string[], now = new Date()): Promise<Map<string, Access>> {
  const out = new Map<string, Access>();
  await Promise.all([...new Set(ownerIds)].map(async (id) => out.set(id, computeAccess((await loadOwnerBilling(id)) ?? NO_OWNER, now))));
  return out;
}

// ── Server-side guards (the UI only mirrors these) ─────────────────────────────────────────────

/** Guests and hosts can add photos, videos and messages. */
export function assertCanUpload(a: Access) {
  if (!a.canUpload) throw new ApiError(403, "upload_closed", "This event is read-only, so it isn't accepting uploads");
}
/** Host edits that change what guests can do (settings, missions, share links, co-hosts). */
export function assertWritable(a: Access) {
  if (a.readOnly) throw new ApiError(402, "plan_required", "This event is read-only. Subscribe to make changes.");
}
/** Originals, ZIPs and share-link downloads. */
export function assertCanDownload(a: Access) {
  if (!a.canDownload) throw new ApiError(402, "plan_required", "Downloads unlock when you subscribe");
}
export function assertCanCreateEvents(a: Access) {
  if (!a.canCreateEvents) throw new ApiError(402, "plan_required", "Subscribe to create more events");
}
