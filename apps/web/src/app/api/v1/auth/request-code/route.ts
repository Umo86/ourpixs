import { z } from "zod";
import { route, json, readJson, clientIp } from "@/lib/http";
import { requestLoginCode } from "@/lib/auth";
import { requestBrand, requestLocale } from "@/lib/request";

const body = z.object({
  email: z.email().max(200),
  locale: z.enum(["en", "tr"]).optional(),
  brand: z.enum(["ourpixs", "bizimresimler"]).optional(),
});

export const POST = route(async (req) => {
  const b = await readJson(req, body);
  const brand = b.brand ?? requestBrand(req);
  const res = await requestLoginCode({ email: b.email, locale: b.locale ?? requestLocale(req), brand, ip: clientIp(req) });
  return json(res);
});
