import type Stripe from "stripe";
import type { NextRequest } from "next/server";
import { errorJson, json, toErrorResponse } from "@/lib/http";
import { stripe } from "@/lib/stripe";
import { invoiceSubscriptionId, markPaymentFailed, syncSubscription } from "@/lib/billing";

/**
 * Stripe webhook for the account subscription. Subscribe the endpoint to:
 *   checkout.session.completed, customer.subscription.created, customer.subscription.updated,
 *   customer.subscription.deleted, invoice.paid, invoice.payment_failed
 *
 * Idempotent: every event re-reads the subscription from Stripe and applies its current state
 * (src/lib/billing.ts → syncSubscription), so duplicates, replays and out-of-order delivery are harmless,
 * and a stale or cancelled subscription can never revive an account.
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
    switch (event.type) {
      case "checkout.session.completed": {
        const s = event.data.object as Stripe.Checkout.Session;
        const subId = typeof s.subscription === "string" ? s.subscription : s.subscription?.id;
        if (s.mode === "subscription" && subId) await syncSubscription(subId, { hostId: s.client_reference_id || s.metadata?.hostId || null });
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await syncSubscription((event.data.object as Stripe.Subscription).id);
        break;
      case "invoice.paid": {
        const subId = invoiceSubscriptionId(event.data.object as Stripe.Invoice);
        if (subId) await syncSubscription(subId);
        break;
      }
      case "invoice.payment_failed": {
        const inv = event.data.object as Stripe.Invoice;
        if (inv.id) await markPaymentFailed(inv.id);
        break;
      }
      default:
        break;
    }
    return json({ received: true });
  } catch (e) {
    return toErrorResponse(e);
  }
}
