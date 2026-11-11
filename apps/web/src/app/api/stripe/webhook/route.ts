import type Stripe from "stripe";
import { and, desc, eq, ne, notInArray, or, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { errorJson, json, toErrorResponse } from "@/lib/http";
import { stripe } from "@/lib/stripe";
import { storageExpiryFor } from "@/lib/occasion";
import type { NextRequest } from "next/server";

const RANK = { free: 0, tek: 1, buyuk: 2 } as const;
type PaidPlan = "tek" | "buyuk";

/**
 * Stripe webhook. Idempotent: an order flips pending → paid exactly once (conditional UPDATE),
 * and only that transition upgrades the occasion. Replays and duplicate events are no-ops.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !process.env.STRIPE_SECRET_KEY) return errorJson(503, "payments_unavailable", "Payments are not configured");
  const sig = req.headers.get("stripe-signature");
  if (!sig) return errorJson(400, "invalid_request", "Missing signature");
  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(raw, sig, secret);
  } catch {
    return errorJson(400, "invalid_request", "Bad signature");
  }
  try {
    if (event.type === "checkout.session.completed" && (event.data.object as Stripe.Checkout.Session).mode === "subscription") {
      const s = event.data.object as Stripe.Checkout.Session;
      const subId = typeof s.subscription === "string" ? s.subscription : s.subscription?.id;
      if (s.metadata?.orgId && subId) {
        await db.update(schema.organisations).set({ stripeSubscriptionId: subId, stripeCustomerId: typeof s.customer === "string" ? s.customer : s.customer?.id })
          .where(eq(schema.organisations.id, s.metadata.orgId));
        await syncSubscription(await stripe().subscriptions.retrieve(subId));
      }
    } else if (event.type === "customer.subscription.created" || event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
      await syncSubscription(event.data.object as Stripe.Subscription);
    } else if (event.type === "invoice.payment_failed") {
      const inv = event.data.object as Stripe.Invoice;
      const customer = typeof inv.customer === "string" ? inv.customer : inv.customer?.id;
      if (customer) {
        await db.update(schema.organisations).set({ status: "past_due", pastDueSince: sql`coalesce(${schema.organisations.pastDueSince}, now())` })
          .where(and(eq(schema.organisations.stripeCustomerId, customer), ne(schema.organisations.status, "cancelled")));
      }
    } else if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
      const s = event.data.object as Stripe.Checkout.Session;
      if (s.payment_status === "paid") await markPaid(s);
    } else if (event.type === "charge.refunded") {
      await markRefunded(event.data.object as Stripe.Charge);
    } else if (event.type === "checkout.session.expired" || event.type === "checkout.session.async_payment_failed") {
      const s = event.data.object as Stripe.Checkout.Session;
      await db.update(schema.orders).set({ status: event.type === "checkout.session.expired" ? "expired" : "failed" })
        .where(and(eq(schema.orders.stripeSessionId, s.id), eq(schema.orders.status, "pending")));
    }
    return json({ received: true });
  } catch (e) {
    return toErrorResponse(e);
  }
}

async function markPaid(s: Stripe.Checkout.Session) {
  const meta = s.metadata || {};
  let [order] = await db.update(schema.orders).set({ status: "paid" })
    // A replayed "completed" event must not revive an order that was refunded since.
    .where(and(eq(schema.orders.stripeSessionId, s.id), notInArray(schema.orders.status, ["paid", "refunded"]))).returning();
  if (!order) {
    const [existing] = await db.select().from(schema.orders).where(eq(schema.orders.stripeSessionId, s.id)).limit(1);
    if (existing) return; // already processed
    if (!meta.occasionId || !meta.hostId || (meta.plan !== "tek" && meta.plan !== "buyuk")) return;
    [order] = await db.insert(schema.orders).values({
      occasionId: meta.occasionId, hostId: meta.hostId, stripeSessionId: s.id, plan: meta.plan as PaidPlan,
      amountPence: s.amount_total ?? 0, currency: s.currency ?? "gbp", status: "paid",
    }).onConflictDoNothing().returning();
    if (!order) return;
  }
  const [o] = await db.select().from(schema.occasions).where(eq(schema.occasions.id, order.occasionId)).limit(1);
  if (!o) return;
  const plan = RANK[order.plan] > RANK[o.plan] ? order.plan : o.plan;
  const expiry = storageExpiryFor(plan, o.startsOn);
  await db.update(schema.occasions).set({
    plan,
    storageExpiresAt: o.storageExpiresAt && o.storageExpiresAt > expiry ? o.storageExpiresAt : expiry,
    status: o.status === "archived" ? o.status : "active",
  }).where(eq(schema.occasions.id, o.id));
}

/**
 * Refunds are issued by hand in the Stripe dashboard (14-day money-back guarantee). A full refund marks the
 * order "refunded" (once) and puts the occasion back on the best plan it still has a paid order for, else free.
 * Media is never deleted here; storage falls back to that plan's retention.
 */
async function markRefunded(charge: Stripe.Charge) {
  if (!charge.refunded && charge.amount_refunded < charge.amount) return; // partial refunds keep the plan
  const pi = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
  if (!pi) return;
  const sessions = await stripe().checkout.sessions.list({ payment_intent: pi, limit: 1 });
  const session = sessions.data[0];
  if (!session) return;
  const [order] = await db.update(schema.orders).set({ status: "refunded" })
    .where(and(eq(schema.orders.stripeSessionId, session.id), eq(schema.orders.status, "paid"))).returning();
  if (!order) return; // unknown or already refunded
  const [o] = await db.select().from(schema.occasions).where(eq(schema.occasions.id, order.occasionId)).limit(1);
  if (!o) return;
  const paid = await db.select({ plan: schema.orders.plan }).from(schema.orders)
    .where(and(eq(schema.orders.occasionId, o.id), eq(schema.orders.status, "paid"))).orderBy(desc(schema.orders.createdAt));
  const plan = paid.reduce<"free" | "tek" | "buyuk">((best, r) => (RANK[r.plan] > RANK[best] ? r.plan : best), "free");
  await db.update(schema.occasions).set({ plan, storageExpiresAt: storageExpiryFor(plan, o.startsOn, o.createdAt) })
    .where(eq(schema.occasions.id, o.id));
}

/** Mirrors a Stripe subscription onto the organisation (status, period end, past-due grace start). */
async function syncSubscription(sub: Stripe.Subscription) {
  const map: Record<string, "trialing" | "active" | "past_due" | "cancelled" | null> = {
    trialing: "trialing", active: "active", past_due: "past_due", unpaid: "past_due",
    canceled: "cancelled", incomplete_expired: "cancelled", incomplete: null, paused: "past_due",
  };
  const status = map[sub.status] ?? null;
  // current_period_end moved onto subscription items in newer API versions.
  const raw = sub as unknown as { current_period_end?: number; items?: { data?: { current_period_end?: number }[] } };
  const end = raw.current_period_end ?? raw.items?.data?.[0]?.current_period_end;
  const orgId = sub.metadata?.orgId;
  // A late "canceled" event for an old subscription must not cancel an organisation that has since re-subscribed:
  // cancellations only match by subscription id.
  const where = orgId && status !== "cancelled" ? or(eq(schema.organisations.id, orgId), eq(schema.organisations.stripeSubscriptionId, sub.id)) : eq(schema.organisations.stripeSubscriptionId, sub.id);
  await db.update(schema.organisations).set({
    stripeSubscriptionId: sub.id,
    ...(status ? { status } : {}),
    ...(end ? { currentPeriodEnd: new Date(end * 1000) } : {}),
    ...(status ? { pastDueSince: status === "past_due" ? sql`coalesce(${schema.organisations.pastDueSince}, now())` : null } : {}),
  }).where(where);
}
