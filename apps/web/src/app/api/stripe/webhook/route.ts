import type Stripe from "stripe";
import type { NextRequest } from "next/server";
import { errorJson, json, toErrorResponse } from "@/lib/http";
import { stripe } from "@/lib/stripe";
import { fulfilCheckout, handleChargeRefunded } from "@/lib/billing";

/**
 * Stripe webhook for the event package. Subscribe the endpoint to:
 *   checkout.session.completed, checkout.session.async_payment_succeeded, charge.refunded
 *
 * Signature-checked. Idempotent: every event re-reads the session / charge from Stripe and applies its current
 * state with conditional updates (src/lib/billing.ts), so duplicates, replays and out-of-order delivery are harmless,
 * and a refunded event can never be reopened. Other event types are acknowledged and ignored.
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
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const s = event.data.object as Stripe.Checkout.Session;
        // Delayed methods complete with payment_status "unpaid"; fulfilCheckout waits for async_payment_succeeded then.
        if (s.mode === "payment") await fulfilCheckout(s.id);
        break;
      }
      case "charge.refunded":
        await handleChargeRefunded((event.data.object as Stripe.Charge).id);
        break;
      default:
        break;
    }
    return json({ received: true });
  } catch (e) {
    return toErrorResponse(e);
  }
}
