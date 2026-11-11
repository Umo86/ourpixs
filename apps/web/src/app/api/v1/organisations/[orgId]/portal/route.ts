import { route, json, ApiError } from "@/lib/http";
import { requireOrgMember } from "@/lib/org";
import { brandBaseUrl } from "@/lib/config";
import { paymentsEnabled, stripe } from "@/lib/stripe";
import { requestBrand } from "@/lib/request";

/** Stripe customer portal: update card, download invoices, cancel. */
export const POST = route<{ orgId: string }>(async (req, { orgId }) => {
  const { org } = await requireOrgMember(orgId, { owner: true });
  if (!paymentsEnabled()) throw new ApiError(503, "payments_unavailable", "Payments are coming soon");
  if (!org.stripeCustomerId) throw new ApiError(409, "no_subscription", "Subscribe first");
  const s = await stripe().billingPortal.sessions.create({ customer: org.stripeCustomerId, return_url: `${brandBaseUrl(requestBrand(req))}/dashboard/partner` });
  return json({ url: s.url });
});
