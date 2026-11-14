import { z } from "zod";
import { route, json, readJson, clientIp } from "@/lib/http";
import { sessionCookie, verifyLoginCode } from "@/lib/auth";
import { toHost } from "@/lib/serializers";
import { requestBrand, requestLocale } from "@/lib/request";
import { consentWording, recordConsent } from "@/lib/consent";

/**
 * `marketingConsent` (optional, web sign-in form): the separate, unticked "Send me offers and news" box. Recorded only
 * after the code is verified, with the wording shown in `locale`.
 */
const body = z.object({
  email: z.email().max(200), code: z.string().trim().regex(/^\d{4,8}$/),
  marketingConsent: z.boolean().optional(), locale: z.enum(["en", "tr"]).optional(),
});

export const POST = route(async (req) => {
  const b = await readJson(req, body);
  const { token, host } = await verifyLoginCode({ email: b.email, code: b.code, locale: requestLocale(req), brand: requestBrand(req), ip: clientIp(req) });
  if (b.marketingConsent) {
    const locale = b.locale ?? requestLocale(req);
    const brand = requestBrand(req); // the site the box was shown on
    await recordConsent({
      email: host.email, brand, locale, source: "host_signup", wording: consentWording(locale, brand, "host_signup"),
      ip: clientIp(req), userAgent: req.headers.get("user-agent"),
    }).catch((e) => console.error("[verify] consent not recorded", e));
  }
  const res = json({ token, host: toHost(host) });
  // Web gets the same JWT as an httpOnly cookie; mobile ignores it and uses the Bearer token.
  res.cookies.set(sessionCookie(token));
  return res;
});
