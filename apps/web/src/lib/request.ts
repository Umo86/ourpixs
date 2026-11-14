import "server-only";
import type { NextRequest } from "next/server";
import { headers } from "next/headers";
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

/**
 * This request's origin, only when its host is one of ours (our brand domains and their subdomains, this deployment's
 * Vercel URLs, localhost). Used to call our own internal routes; never follows an arbitrary Host header.
 */
export async function trustedOrigin(): Promise<string | null> {
  try {
    const h = await headers();
    const host = (h.get("x-forwarded-host") || h.get("host") || "").split(",")[0]!.trim().toLowerCase();
    if (!host) return null;
    const bare = host.replace(/:\d+$/, "");
    const ours = Object.values(BRANDS).some((b) => bare === b.domain || bare.endsWith(`.${b.domain}`))
      || [process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL, process.env.VERCEL_PROJECT_PRODUCTION_URL].some((v) => v && bare === v.toLowerCase())
      || (process.env.NODE_ENV !== "production" && (bare === "localhost" || bare === "127.0.0.1"));
    if (!ours) return null;
    const proto = (h.get("x-forwarded-proto") || (bare === "localhost" || bare === "127.0.0.1" ? "http" : "https")).split(",")[0]!.trim();
    return `${proto}://${host}`;
  } catch {
    return null;
  }
}
