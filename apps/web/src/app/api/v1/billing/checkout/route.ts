import { z } from "zod";
import { route, json, readJson } from "@/lib/http";
import { requireHost } from "@/lib/auth";
import { createSubscriptionCheckout } from "@/lib/billing";
import { requestBrand, requestLocale } from "@/lib/request";
import { limit } from "@/lib/rate-limit";

/** POST { interval: "month" | "year" } → { url } (Stripe Checkout, subscription mode). */
export const POST = route(async (req) => {
  const host = await requireHost();
  await limit(`checkout:${host.id}`, 20, 3600);
  const { interval } = await readJson(req, z.object({ interval: z.enum(["month", "year"]) }));
  return json({ url: await createSubscriptionCheckout(host, interval, requestBrand(req), requestLocale(req, host.locale === "tr" ? "tr" : "en")) });
});
