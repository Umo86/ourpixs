import "server-only";
import type Stripe from "stripe";
import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { BRANDS, MAIN_BRAND, brandBaseUrl, type Brand, type Locale } from "./config";
import { ApiError } from "./http";
import { accessForOccasion, assertCanPay } from "./access";
import { getSettings } from "./settings";
import { paymentsEnabled, stripe } from "./stripe";
import { addMonths, windowError } from "./window";
import { makeT } from "@/i18n/shared";

/**
 * The £69 event package (Stripe Checkout, mode "payment", GBP, inline price from admin settings).
 * Checkout picks the payment methods itself (card, Apple Pay, Google Pay…: no payment_method_types),
 * so nothing has to be set up in the Stripe dashboard. Test mode only until Umit says otherwise.
 *
 * Protections (kept from the subscription review):
 *  - the webhook is signature-checked and every event re-reads the object from Stripe (payload never trusted);
 *  - marking paid is one conditional UPDATE (setup → paid), so replays and duplicates are harmless;
 *  - a refunded event (or a refunded charge) is never revived by a late or replayed "completed" event;
 *  - the amount, currency, kind and owner are checked against the event before it's marked paid;
 *  - starting a new Checkout expires the previous open one for the same event (no double payments by accident).
 */

type OccasionRow = typeof schema.occasions.$inferSelect;
type HostRow = typeof schema.hosts.$inferSelect;

export const EVENT_PACKAGE_KIND = "event_package";

const idOf = (x: string | { id: string } | null | undefined) => (typeof x === "string" ? x : x?.id ?? null);

function requirePayments() {
  if (!paymentsEnabled()) throw new ApiError(503, "payments_unavailable", "Payments are coming soon");
}

/** Owner only: Stripe Checkout for this event's package. Returns the Checkout URL. */
export async function createEventCheckout(o: OccasionRow, host: HostRow, brand: Brand, locale: Locale): Promise<string> {
  requirePayments();
  if (o.ownerId !== host.id) throw new ApiError(403, "forbidden", "Only the event owner can pay for it");
  const access = await accessForOccasion(o);
  assertCanPay(access);
  const s = await getSettings();
  const err = windowError({ opensAt: o.opensAt, closesAt: o.closesAt }, s.windowDays);
  if (err) throw new ApiError(409, err === "window_past" ? "window_past" : "window_required", err === "window_past"
    ? "Your gallery dates have passed. Pick new dates, then pay."
    : "Pick when your gallery opens and closes, then pay.");

  // Expire the previous open session for this event, so two tabs can't both be paid.
  if (o.stripeCheckoutSessionId) {
    try {
      const prev = await stripe().checkout.sessions.retrieve(o.stripeCheckoutSessionId);
      if (prev.status === "open") await stripe().checkout.sessions.expire(prev.id);
      if (prev.status === "complete") throw new ApiError(409, "already_paid", "This event is already paid for. It can take a minute to show.");
    } catch (e) {
      if (e instanceof ApiError) throw e;
      console.warn("[billing] could not expire previous checkout", e);
    }
  }

  const t = makeT(locale, "host");
  const base = brandBaseUrl(brand);
  const session = await stripe().checkout.sessions.create({
    mode: "payment",
    customer_email: host.email,
    client_reference_id: o.id,
    locale: locale === "tr" ? "tr" : "en-GB",
    line_items: [{
      quantity: 1,
      price_data: {
        currency: "gbp",
        unit_amount: s.eventPricePence,
        tax_behavior: "inclusive",
        // One merchant on every domain: the product (and card statement wording) is always the main brand.
        product_data: { name: `${BRANDS[MAIN_BRAND].name} · ${t("pay.productName")}`, description: o.title.slice(0, 200) },
      },
    }],
    metadata: { kind: EVENT_PACKAGE_KIND, occasionId: o.id, hostId: host.id },
    payment_intent_data: { metadata: { kind: EVENT_PACKAGE_KIND, occasionId: o.id, hostId: host.id } },
    custom_text: { submit: { message: t("pay.checkoutNote") } },
    success_url: `${base}/dashboard/${o.id}?paid=1`,
    cancel_url: `${base}/dashboard/${o.id}?checkout=cancelled`,
  });
  if (!session.url) throw new ApiError(502, "payments_unavailable", "Could not start checkout");
  await db.update(schema.occasions).set({ stripeCheckoutSessionId: session.id }).where(eq(schema.occasions.id, o.id));
  return session.url;
}

/**
 * checkout.session.completed / checkout.session.async_payment_succeeded.
 * Re-reads the session (with its payment intent's charge) and marks the event paid exactly once.
 */
export async function fulfilCheckout(sessionId: string): Promise<{ applied: boolean; reason?: string; occasionId?: string }> {
  const session = await stripe().checkout.sessions.retrieve(sessionId, { expand: ["payment_intent.latest_charge"] });
  if (session.mode !== "payment" || session.metadata?.kind !== EVENT_PACKAGE_KIND) return { applied: false, reason: "not_event_package" };
  if (session.payment_status !== "paid") return { applied: false, reason: "not_paid" };
  const occasionId = session.metadata?.occasionId;
  const hostId = session.metadata?.hostId;
  if (!occasionId || !hostId) return { applied: false, reason: "no_metadata" };

  const pi = typeof session.payment_intent === "object" ? session.payment_intent : null;
  const charge = pi && typeof pi.latest_charge === "object" ? pi.latest_charge : null;
  const piId = idOf(session.payment_intent);
  const refunded = !!charge && (charge.refunded || charge.amount_refunded >= (charge.amount || 0));

  const [o] = await db.select().from(schema.occasions).where(eq(schema.occasions.id, occasionId)).limit(1);
  if (!o) {
    console.error("[billing] paid checkout for a missing event — refund by hand", { sessionId, occasionId });
    return { applied: false, reason: "no_event" };
  }
  if (o.ownerId !== hostId) {
    console.error("[billing] checkout owner mismatch — refund by hand", { sessionId, occasionId });
    return { applied: false, reason: "owner_mismatch" };
  }
  if (session.currency !== "gbp" || !session.amount_total || session.amount_total <= 0) {
    console.error("[billing] unexpected amount/currency", { sessionId, amount: session.amount_total, currency: session.currency });
    return { applied: false, reason: "bad_amount" };
  }

  const now = new Date();
  const paidAt = now;
  const s = await getSettings();
  // Record the payment first (idempotent on the session id).
  const [order] = await db.insert(schema.orders).values({
    occasionId: o.id, hostId, stripeSessionId: session.id, kind: EVENT_PACKAGE_KIND, amountPence: session.amount_total,
    currency: "gbp", status: refunded ? "refunded" : "paid", stripePaymentIntentId: piId, livemode: session.livemode,
    paidAt, refundedAt: refunded ? now : null,
  }).onConflictDoNothing({ target: schema.orders.stripeSessionId }).returning({ id: schema.orders.id });
  if (refunded) {
    // Refund already processed (out-of-order delivery): never open the event. If something else already paid for it,
    // leave it alone (this was a second payment that has been refunded).
    if (o.packageStatus === "setup") await markRefunded(o.id);
    return { applied: false, reason: "refunded", occasionId: o.id };
  }

  const deleteAfter = o.closesAt ? addMonths(o.closesAt, s.retentionMonths) : null;
  const updated = await db.update(schema.occasions)
    .set({ packageStatus: "paid", paidAt, deleteAfter, stripeCheckoutSessionId: session.id })
    .where(and(eq(schema.occasions.id, o.id), eq(schema.occasions.packageStatus, "setup")))
    .returning({ id: schema.occasions.id });
  if (!updated.length && order) {
    // A new payment that didn't open anything: the event was already paid (another session, or marked as paid by
    // an admin), refunded or expired. Flag it for a manual refund.
    await db.update(schema.orders).set({ status: "duplicate" }).where(eq(schema.orders.id, order.id));
    console.error("[billing] duplicate payment for an event — refund by hand", { sessionId, occasionId });
    return { applied: false, reason: "duplicate", occasionId: o.id };
  }
  return { applied: updated.length > 0, occasionId: o.id };
}

/** Event goes to "refunded" (read-only, closed to guests). Expired events stay expired. */
async function markRefunded(occasionId: string) {
  await db.update(schema.occasions).set({ packageStatus: "refunded" })
    .where(and(eq(schema.occasions.id, occasionId), inArray(schema.occasions.packageStatus, ["setup", "paid", "live", "ended"])));
}

/**
 * charge.refunded: only a FULL refund of an event-package payment closes the event. Partial refunds
 * (e.g. a pro-rata refund in the cancellation period) just update the order record.
 */
export async function handleChargeRefunded(chargeId: string): Promise<{ applied: boolean; reason?: string }> {
  const charge: Stripe.Charge = await stripe().charges.retrieve(chargeId);
  const piId = idOf(charge.payment_intent);
  if (!piId) return { applied: false, reason: "no_payment_intent" };
  const [order] = await db.select().from(schema.orders).where(eq(schema.orders.stripePaymentIntentId, piId)).limit(1);
  if (!order || order.kind !== EVENT_PACKAGE_KIND) return { applied: false, reason: "no_order" };
  const full = charge.refunded || charge.amount_refunded >= charge.amount;
  if (!full) return { applied: false, reason: "partial" };
  const now = new Date();
  await db.update(schema.orders).set({ status: "refunded", refundedAt: order.refundedAt ?? now }).where(eq(schema.orders.id, order.id));
  // A duplicate payment being refunded must not close the event that the other payment paid for.
  if (order.status === "duplicate") return { applied: false, reason: "duplicate_refunded" };
  await markRefunded(order.occasionId);
  return { applied: true };
}
