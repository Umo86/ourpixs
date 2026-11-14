import { route, json } from "@/lib/http";
import { requireMember } from "@/lib/auth";
import { createEventCheckout } from "@/lib/billing";
import { requestBrand, requestLocale } from "@/lib/request";
import { limit } from "@/lib/rate-limit";

/**
 * POST → { url }: Stripe Checkout (mode "payment") for this event's package. Owner only.
 * 409 window_required / window_past when the gallery dates are missing or over; 409 already_paid; 503 payments_unavailable.
 * After paying, Stripe returns to /dashboard/:id?paid=1 and the webhook marks the event paid.
 */
export const POST = route<{ id: string }>(async (req, { id }) => {
  const { host, occasion } = await requireMember(id, { owner: true });
  await limit(`checkout:${host.id}`, 20, 3600);
  const url = await createEventCheckout(occasion, host, requestBrand(req), requestLocale(req, host.locale === "tr" ? "tr" : "en"));
  return json({ url });
});
