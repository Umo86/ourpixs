import { route, json } from "@/lib/http";
import { requireHost } from "@/lib/auth";
import { createPortalSession } from "@/lib/billing";
import { requestBrand, requestLocale } from "@/lib/request";
import { limit } from "@/lib/rate-limit";

/** POST → { url } (Stripe Customer Portal: card, switch monthly/yearly, cancel at period end, invoices). */
export const POST = route(async (req) => {
  const host = await requireHost();
  await limit(`portal:${host.id}`, 30, 3600);
  return json({ url: await createPortalSession(host, requestBrand(req), requestLocale(req, host.locale === "tr" ? "tr" : "en")) });
});
