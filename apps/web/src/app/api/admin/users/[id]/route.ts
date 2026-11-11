import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { ApiError, assertUuid, badRequest, json, notFound, readJson } from "@/lib/http";
import { adminRoute, audit, reasonSchema } from "@/lib/admin";
import { normalizeEmail } from "@/lib/auth";
import { SUBSCRIPTION } from "@/lib/config";
import { adminCancelSubscription } from "@/lib/billing";
import { deleteAccount } from "@/lib/account";

export const maxDuration = 60;

const DAY = 86400_000;
const MAX_COMP_DAYS = 5 * 366;
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("extend_trial"), days: z.number().int().min(1).max(30), reason: reasonSchema }),
  z.object({ action: z.literal("grant_comp"), until: dateStr, reason: reasonSchema }),
  z.object({ action: z.literal("remove_comp"), reason: reasonSchema }),
  z.object({ action: z.literal("cancel_subscription"), mode: z.enum(["period_end", "now"]), reason: reasonSchema }),
  z.object({ action: z.literal("suspend"), reason: reasonSchema }),
  z.object({ action: z.literal("unsuspend"), reason: reasonSchema }),
]);

const later = (a: Date | null, b: Date) => (a && a > b ? a : b);
/** Read-only grace after the trial / paid period for a stored read-only state (see SUBSCRIPTION). */
const graceDays = (status: string) => (status === "expired" ? SUBSCRIPTION.trialGraceDeleteDays : SUBSCRIPTION.cancelledReadOnlyDays);

/** Admin actions on one account. Every action is validated, rate-limited (adminRoute) and audited. */
export const POST = adminRoute<{ id: string }>(async (req, { id }, admin) => {
  assertUuid(id, "account");
  const b = await readJson(req, body);
  const [h] = await db.select().from(schema.hosts).where(eq(schema.hosts.id, id)).limit(1);
  if (!h) throw notFound("Unknown account");
  const now = new Date();
  const H = schema.hosts;
  let details: Record<string, unknown> = {};

  switch (b.action) {
    case "extend_trial": {
      // Only for accounts that never paid: trialing, expired trial, or no trial yet. Paid accounts: use complimentary access.
      if (!["none", "trialing", "expired"].includes(h.planStatus)) throw new ApiError(409, "not_trial", "This account isn't on the free trial");
      const base = later(h.trialEndsAt, now);
      const trialEndsAt = new Date(base.getTime() + b.days * DAY);
      await db.update(H).set({
        planStatus: "trialing", trialStartedAt: h.trialStartedAt ?? now, trialEndsAt,
        readOnlySince: null, deleteAfter: null, deletionWarningSentAt: null, trialEndEmailSentAt: null,
      }).where(eq(H.id, id));
      details = { days: b.days, from: h.trialEndsAt?.toISOString() ?? null, to: trialEndsAt.toISOString(), previousStatus: h.planStatus };
      break;
    }
    case "grant_comp": {
      const until = new Date(`${b.until}T23:59:59.999Z`);
      if (until <= now) throw badRequest("Pick a date in the future");
      if (until.getTime() - now.getTime() > MAX_COMP_DAYS * DAY) throw badRequest("Pick a date within 5 years");
      // A read-only account keeps its full grace period after the complimentary access ends (never deleted straight away).
      const pushDelete = h.deleteAfter && (h.planStatus === "expired" || h.planStatus === "cancelled")
        ? { deleteAfter: later(h.deleteAfter, new Date(until.getTime() + graceDays(h.planStatus) * DAY)), deletionWarningSentAt: null }
        : {};
      await db.update(H).set({ compUntil: until, ...pushDelete }).where(eq(H.id, id));
      details = { until: until.toISOString(), previous: h.compUntil?.toISOString() ?? null };
      break;
    }
    case "remove_comp": {
      if (!h.compUntil) throw new ApiError(409, "not_comped", "This account has no complimentary access");
      const minDelete = new Date(now.getTime() + graceDays(h.planStatus) * DAY);
      const keepGrace = h.deleteAfter && h.deleteAfter < minDelete ? { deleteAfter: minDelete, deletionWarningSentAt: null } : {};
      await db.update(H).set({ compUntil: null, ...keepGrace }).where(eq(H.id, id));
      details = { previous: h.compUntil.toISOString() };
      break;
    }
    case "cancel_subscription": {
      await adminCancelSubscription(h, b.mode);
      details = { mode: b.mode, subscription: h.stripeSubscriptionId };
      break;
    }
    case "suspend": {
      if (h.id === admin.id) throw new ApiError(409, "self_action", "You can't suspend your own account");
      await db.update(H).set({ suspendedAt: h.suspendedAt ?? now, suspendedReason: b.reason }).where(eq(H.id, id));
      break;
    }
    case "unsuspend": {
      await db.update(H).set({ suspendedAt: null, suspendedReason: null }).where(eq(H.id, id));
      details = { suspendedSince: h.suspendedAt?.toISOString() ?? null };
      break;
    }
  }
  await audit(admin, `host.${b.action}`, "host", id, { email: h.email, reason: b.reason, ...details });
  return json({ ok: true });
});

const del = z.object({ confirmEmail: z.string().trim().max(320), reason: reasonSchema });

/** Deletes the account the same way the host can (Stripe cancelled first, then every owned event with its files). */
export const DELETE = adminRoute<{ id: string }>(async (req, { id }, admin) => {
  assertUuid(id, "account");
  const b = await readJson(req, del);
  const [h] = await db.select({ id: schema.hosts.id, email: schema.hosts.email }).from(schema.hosts).where(eq(schema.hosts.id, id)).limit(1);
  if (!h) throw notFound("Unknown account");
  if (h.id === admin.id) throw new ApiError(409, "self_action", "Delete your own account from the dashboard instead");
  if (normalizeEmail(b.confirmEmail) !== normalizeEmail(h.email)) throw new ApiError(400, "confirm_mismatch", "The email doesn't match");
  await deleteAccount(h.id);
  await audit(admin, "host.delete", "host", id, { email: h.email, reason: b.reason });
  return json({ ok: true });
});
