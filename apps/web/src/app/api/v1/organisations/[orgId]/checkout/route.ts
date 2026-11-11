import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { route, json, ApiError } from "@/lib/http";
import { requireOrgMember } from "@/lib/org";
import { brandBaseUrl } from "@/lib/config";
import { paymentsEnabled, stripe } from "@/lib/stripe";
import { requestBrand, requestLocale } from "@/lib/request";

/** Partner plan: Stripe Checkout in subscription mode (STRIPE_PRICE_PARTNER = recurring monthly price). */
export const POST = route<{ orgId: string }>(async (req, { orgId }) => {
  const { host, org } = await requireOrgMember(orgId, { owner: true });
  const price = process.env.STRIPE_PRICE_PARTNER;
  if (!paymentsEnabled() || !price) throw new ApiError(503, "payments_unavailable", "Payments are coming soon");
  if (org.status === "active" || org.status === "trialing") throw new ApiError(409, "already_on_plan", "This partner account is already subscribed");
  let customer = org.stripeCustomerId;
  if (!customer) {
    const c = await stripe().customers.create({ email: org.supportEmail || host.email, name: org.name, metadata: { orgId: org.id } });
    customer = c.id;
    await db.update(schema.organisations).set({ stripeCustomerId: customer }).where(eq(schema.organisations.id, org.id));
  }
  const base = brandBaseUrl(requestBrand(req));
  const session = await stripe().checkout.sessions.create({
    mode: "subscription",
    customer,
    line_items: [{ price, quantity: 1 }],
    locale: requestLocale(req) === "tr" ? "tr" : "en-GB",
    metadata: { orgId: org.id, kind: "partner" },
    subscription_data: { metadata: { orgId: org.id } },
    allow_promotion_codes: true,
    ...(process.env.STRIPE_TAX === "1" ? { automatic_tax: { enabled: true }, customer_update: { address: "auto" as const } } : {}),
    success_url: `${base}/dashboard/partner?subscribed=1`,
    cancel_url: `${base}/dashboard/partner?cancelled=1`,
  });
  if (!session.url) throw new ApiError(502, "payments_unavailable", "Could not start checkout");
  return json({ url: session.url });
});
