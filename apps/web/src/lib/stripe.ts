import "server-only";
import Stripe from "stripe";

let client: Stripe | null = null;
export function paymentsEnabled() {
  return !!process.env.STRIPE_SECRET_KEY;
}
export function stripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY not set");
  client ??= new Stripe(process.env.STRIPE_SECRET_KEY, fakeStripeConfig());
  return client;
}

/**
 * TEST ONLY: STRIPE_FAKE=1 points the real Stripe library at the test harness's fake Stripe API
 * (apps/web/test/harness/stripe-fake.mjs at STRIPE_FAKE_URL), so Checkout, the signed webhook and refunds run through
 * the real billing code. Refused when VERCEL_ENV=production; without STRIPE_FAKE nothing changes.
 */
function fakeStripeConfig(): Stripe.StripeConfig | undefined {
  if (process.env.STRIPE_FAKE !== "1") return undefined;
  if (process.env.VERCEL_ENV === "production") throw new Error("STRIPE_FAKE is not allowed in production");
  const u = new URL(process.env.STRIPE_FAKE_URL || "http://127.0.0.1:12111");
  return { host: u.hostname, port: Number(u.port || 80), protocol: u.protocol === "https:" ? "https" : "http", maxNetworkRetries: 0 };
}
