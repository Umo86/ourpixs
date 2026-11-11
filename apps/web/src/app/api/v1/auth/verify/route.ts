import { z } from "zod";
import { route, json, readJson, clientIp } from "@/lib/http";
import { sessionCookie, verifyLoginCode } from "@/lib/auth";
import { toHost } from "@/lib/serializers";
import { requestBrand, requestLocale } from "@/lib/request";

const body = z.object({ email: z.email().max(200), code: z.string().trim().regex(/^\d{4,8}$/) });

export const POST = route(async (req) => {
  const b = await readJson(req, body);
  const { token, host } = await verifyLoginCode({ email: b.email, code: b.code, locale: requestLocale(req), brand: requestBrand(req), ip: clientIp(req) });
  const res = json({ token, host: toHost(host) });
  // Web gets the same JWT as an httpOnly cookie; mobile ignores it and uses the Bearer token.
  res.cookies.set(sessionCookie(token));
  return res;
});
