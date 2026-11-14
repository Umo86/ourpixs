import { z } from "zod";
import { route, json, readJson, clientIp } from "@/lib/http";
import { requireHost } from "@/lib/auth";
import { limit } from "@/lib/rate-limit";
import { requestBrand } from "@/lib/request";
import { consentWording, currentConsent, recordConsent, withdrawConsent } from "@/lib/consent";

/**
 * The host's "Send me offers and news" choice (opt-in, off by default), for the brand of the site it is shown on.
 * `locale` = the language the switch was shown in, so the stored wording is exactly what the host saw.
 */
const body = z.object({ consented: z.boolean(), locale: z.enum(["en", "tr"]) });

export const GET = route(async (req) => {
  const host = await requireHost();
  return json({ consented: !!(await currentConsent(host.email, requestBrand(req))) });
});

export const PUT = route(async (req) => {
  const host = await requireHost();
  await limit(`marketing:${host.id}`, 20, 3600);
  const b = await readJson(req, body);
  const brand = requestBrand(req);
  if (b.consented) {
    await recordConsent({
      email: host.email, brand, locale: b.locale, source: "host_settings", wording: consentWording(b.locale, brand, "host_settings"),
      ip: clientIp(req), userAgent: req.headers.get("user-agent"),
    });
  } else {
    await withdrawConsent(host.email, brand, "host_settings");
  }
  return json({ consented: b.consented });
});
