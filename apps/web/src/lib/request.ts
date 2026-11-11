import "server-only";
import type { NextRequest } from "next/server";
import { BRANDS, brandFromHost, type Brand, type Locale } from "./config";
import { localeFromAcceptLanguage } from "@/i18n/negotiate";

export function requestBrand(req: NextRequest): Brand {
  return brandFromHost(req.headers.get("x-forwarded-host") || req.headers.get("host"));
}

/** `lang` cookie > Accept-Language (first supported language; Turkish → tr, anything else → en) > fallback > brand default. */
export function requestLocale(req: NextRequest, fallback?: Locale): Locale {
  const c = req.cookies.get("lang")?.value;
  if (c === "en" || c === "tr") return c;
  return localeFromAcceptLanguage(req.headers.get("accept-language")) ?? fallback ?? BRANDS[requestBrand(req)].defaultLocale;
}
