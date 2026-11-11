import "server-only";
import type Stripe from "stripe";
import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { BRANDS, brandBaseUrl, intervalPence, type Brand, type Locale, type PlanInterval } from "./config";
import { ApiError } from "./http";
import { subscriptionAccess } from "./access";
import { paymentsEnabled, stripe } from "./stripe";
import { makeT } from "@/i18n/shared";

type HostRow = typeof schema.hosts.$inferSelect;

const idOf = (x: string | { id: string } | null | undefined) => (typeof x === "string" ? x : x?.id ?? null);

function requirePayments() {
  if (!paymentsEnabled()) throw new ApiError(503, "payments_unavailable", "Payments are coming soon");
}

/**
 * Stripe Checkout for the account subscription. Prices are inline (price_data), so nothing has to be set up
 * in the Stripe dashboard. Amounts are VAT-inclusive GBP from SUBSCRIPTION in config.ts.
 */
export async function createSubscriptionCheckout(host: HostRow, interval: PlanInterval, brand: Brand, locale: Locale) {
  requirePayments();
  // The Stripe state, not admin overrides: a comped account may still subscribe for when the complimentary period ends.
  const a = subscriptionAccess(host);
  if (a.status === "active" || a.status === "past_due") {
    throw new ApiError(409, "already_subscribed", "You already have a subscription. Use Manage billing to change it.");
  }
  const t = makeT(locale, "host");
  const base = brandBaseUrl(brand);
  const session = await stripe().checkout.sessions.create({
    mode: "subscription",
    ...(host.stripeCustomerId ? { customer: host.stripeCustomerId } : { customer_email: host.email }),
    client_reference_id: host.id,
    locale: locale === "tr" ? "tr" : "en-GB",
    line_items: [{
      quantity: 1,
      price_data: {
        currency: "gbp",
        unit_amount: intervalPence(interval),
        tax_behavior: "inclusive",
        recurring: { interval },
        product_data: { name: `${BRANDS[brand].name} — ${t(interval === "year" ? "billing.yearly" : "billing.monthly")}` },
      },
    }],
    metadata: { hostId: host.id, interval },
    subscription_data: { metadata: { hostId: host.id } },
    success_url: `${base}/dashboard?subscribed=1`,
    cancel_url: `${base}/dashboard?checkout=cancelled`,
  });
  if (!session.url) throw new ApiError(502, "payments_unavailable", "Could not start checkout");
  return session.url;
}

/** Stripe Customer Portal: change card, switch monthly/yearly, cancel at period end, invoices. */
export async function createPortalSession(host: HostRow, brand: Brand, locale: Locale) {
  requirePayments();
  if (!host.stripeCustomerId) throw new ApiError(409, "no_subscription", "There is no subscription on this account yet");
  const s = await stripe().billingPortal.sessions.create({
    customer: host.stripeCustomerId,
    locale: locale === "tr" ? "tr" : "en-GB",
    return_url: `${brandBaseUrl(brand)}/dashboard`,
  });
  return s.url;
}

/** Account deletion: stop billing straight away (no refund here; refunds are manual). */
export async function cancelSubscriptionNow(subId: string | null) {
  if (!subId || !paymentsEnabled()) return;
  let sub: Stripe.Subscription;
  try {
    sub = await stripe().subscriptions.retrieve(subId);
  } catch (e) {
    if ((e as { code?: string }).code === "resource_missing") return;
    throw e;
  }
  if (sub.status === "canceled" || sub.status === "incomplete_expired") return;
  await stripe().subscriptions.cancel(subId);
}

/**
 * Admin: cancel a host's subscription, either at the end of the paid period or immediately (no refund; refunds stay manual).
 * The host row is then re-synced from Stripe (the webhook would do the same, this just makes it instant).
 */
export async function adminCancelSubscription(host: Pick<HostRow, "id" | "stripeSubscriptionId">, mode: "period_end" | "now") {
  requirePayments();
  if (!host.stripeSubscriptionId) throw new ApiError(409, "no_subscription", "There is no subscription on this account");
  try {
    if (mode === "now") await cancelSubscriptionNow(host.stripeSubscriptionId);
    else await stripe().subscriptions.update(host.stripeSubscriptionId, { cancel_at_period_end: true });
    await syncSubscription(host.stripeSubscriptionId, { hostId: host.id });
  } catch (e) {
    if (e instanceof ApiError) throw e;
    console.error("[billing] admin cancel failed", e);
    throw new ApiError(502, "billing_error", "Stripe could not cancel the subscription");
  }
}

function periodEnd(sub: Stripe.Subscription): Date | null {
  // current_period_end lives on subscription items in current API versions.
  const raw = sub as unknown as { current_period_end?: number; items?: { data?: { current_period_end?: number }[] } };
  const end = raw.items?.data?.[0]?.current_period_end ?? raw.current_period_end;
  return end ? new Date(end * 1000) : null;
}
function intervalOf(sub: Stripe.Subscription): PlanInterval | null {
  const i = sub.items?.data?.[0]?.price?.recurring?.interval;
  return i === "year" ? "year" : i === "month" ? "month" : null;
}

const LIVE = new Set<Stripe.Subscription.Status>(["active", "trialing", "past_due", "unpaid", "paused"]);

/**
 * Mirrors a subscription onto its host. Always re-reads the subscription from Stripe, so replayed or
 * out-of-order webhook events can only ever apply the CURRENT state. Rules:
 *  - a host is matched by its current subscription id first;
 *  - a different subscription is adopted only while it is live in Stripe and the host has no other live one
 *    (so an old/cancelled subscription can never revive or overwrite the account);
 *  - incomplete subscriptions (first payment not done) are ignored.
 */
export async function syncSubscription(subId: string, hint: { hostId?: string | null } = {}) {
  const sub = await stripe().subscriptions.retrieve(subId);
  const customerId = idOf(sub.customer);
  let [host] = await db.select().from(schema.hosts).where(eq(schema.hosts.stripeSubscriptionId, sub.id)).limit(1);
  if (!host) {
    if (!LIVE.has(sub.status)) return { applied: false as const, reason: "not_live" };
    const hostId = sub.metadata?.hostId || hint.hostId || null;
    if (hostId) [host] = await db.select().from(schema.hosts).where(eq(schema.hosts.id, hostId)).limit(1);
    if (!host && customerId) [host] = await db.select().from(schema.hosts).where(eq(schema.hosts.stripeCustomerId, customerId)).limit(1);
    if (!host) return { applied: false as const, reason: "no_host" };
    const local = subscriptionAccess(host).status;
    if (host.stripeSubscriptionId && (local === "active" || local === "past_due")) {
      console.error("[billing] host already has a live subscription; not adopting", { hostId: host.id, sub: sub.id });
      return { applied: false as const, reason: "has_live_subscription" };
    }
  }

  const common = {
    stripeSubscriptionId: sub.id,
    ...(customerId ? { stripeCustomerId: customerId } : {}),
    ...(intervalOf(sub) ? { planInterval: intervalOf(sub) } : {}),
  };
  const restore = { readOnlySince: null, deleteAfter: null, deletionWarningSentAt: null, pastDueSince: null };
  let set: Partial<typeof schema.hosts.$inferInsert> | null = null;
  if (sub.status === "active" || sub.status === "trialing") {
    set = { ...common, ...restore, planStatus: "active", currentPeriodEnd: periodEnd(sub), cancelAtPeriodEnd: sub.cancel_at_period_end || !!sub.cancel_at };
  } else if (sub.status === "past_due" || sub.status === "unpaid" || sub.status === "paused") {
    // Our cron may already have ended the grace period (status cancelled); Stripe saying "past_due" must not reopen it.
    set = host.planStatus === "cancelled" || host.planStatus === "expired"
      ? { ...common }
      : { ...common, planStatus: "past_due", currentPeriodEnd: periodEnd(sub), cancelAtPeriodEnd: sub.cancel_at_period_end || !!sub.cancel_at,
          pastDueSince: host.pastDueSince ?? new Date() };
  } else if (sub.status === "canceled") {
    if (host.planStatus !== "cancelled") {
      const ended = sub.ended_at ? new Date(sub.ended_at * 1000) : new Date();
      // read_only_since / delete_after are recorded by the daily cron (it also sends the "cancelled" email).
      set = { ...common, planStatus: "cancelled", cancelAtPeriodEnd: false, currentPeriodEnd: ended };
    }
  }
  if (!set) return { applied: false as const, reason: "no_change" };
  await db.update(schema.hosts).set(set).where(eq(schema.hosts.id, host.id));
  return { applied: true as const, hostId: host.id };
}

/** invoice.payment_failed: start the past-due grace period at the first failed renewal (if still unpaid). */
export async function markPaymentFailed(invoiceId: string) {
  const inv = await stripe().invoices.retrieve(invoiceId);
  if (inv.status === "paid" || inv.status === "void") return;
  const subId = invoiceSubscriptionId(inv);
  if (!subId) return;
  await syncSubscription(subId);
  await db.update(schema.hosts)
    .set({ planStatus: "past_due", pastDueSince: sql`coalesce(${schema.hosts.pastDueSince}, now())` })
    .where(sql`${schema.hosts.stripeSubscriptionId} = ${subId} and ${schema.hosts.planStatus} = 'active'`);
}

export function invoiceSubscriptionId(inv: Stripe.Invoice): string | null {
  const parent = inv.parent?.subscription_details?.subscription;
  const legacy = (inv as unknown as { subscription?: string | { id: string } | null }).subscription;
  return idOf(parent ?? legacy ?? null);
}
