import "server-only";
import Stripe from "stripe";

let client: Stripe | null = null;
export function paymentsEnabled() {
  return !!process.env.STRIPE_SECRET_KEY;
}
export function stripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY not set");
  client ??= new Stripe(process.env.STRIPE_SECRET_KEY);
  return client;
}
