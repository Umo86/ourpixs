import "server-only";
import type { NextRequest } from "next/server";
import { BRANDS, brandFromHost, type Brand, type Locale } from "./config";

export function requestBrand(req: NextRequest): Brand {
  return brandFromHost(req.headers.get("x-forwarded-host") || req.headers.get("host"));
}

/** `lang` cookie > Accept-Language (tr) > brand default. */
export function requestLocale(req: NextRequest, fallback?: Locale): Locale {
  const c = req.cookies.get("lang")?.value;
  if (c === "en" || c === "tr") return c;
  const al = req.headers.get("accept-language") || "";
  if (/^tr\b|,\s*tr\b/i.test(al)) return "tr";
  if (al) return "en";
  return fallback ?? BRANDS[requestBrand(req)].defaultLocale;
}
