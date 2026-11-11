import "server-only";
import { cookies, headers } from "next/headers";
import { brandFromHost, BRANDS, type Brand, type Locale } from "@/lib/config";
import { makeT, type Namespace } from "./shared";
import { localeFromAcceptLanguage } from "./negotiate";

/** Brand comes from the request host (bizimresimler.com → BizimResimler, ourpixs.com → Our Pixs, anything else → DEFAULT_BRAND). */
export async function getBrand(): Promise<Brand> {
  const h = await headers();
  return brandFromHost(h.get("x-forwarded-host") || h.get("host"));
}

/**
 * Locale: `lang` cookie (EN/TR switch, or `?lang=` via middleware) > browser language > brand default.
 * BizimResimler always follows the browser/phone (Accept-Language: Turkish → tr, anything else → en).
 * Our Pixs stays English unless the page passes `preferBrowser` (guest pages, so a Turkish phone gets Turkish).
 * Every caller reads cookies/headers, so these pages render per request with `Cache-Control: private, no-store`
 * (never cached across visitors). Don't make a language-dependent page static (no `force-static` / ISR).
 */
export async function getLocale(opts: { preferBrowser?: boolean } = {}): Promise<Locale> {
  const c = await cookies();
  const v = c.get("lang")?.value;
  if (v === "en" || v === "tr") return v;
  const brand = await getBrand();
  if (opts.preferBrowser || BRANDS[brand].browserLocale) {
    const fromBrowser = localeFromAcceptLanguage((await headers()).get("accept-language"));
    if (fromBrowser) return fromBrowser;
  }
  return BRANDS[brand].defaultLocale;
}

export async function getT(ns: Namespace, opts: { preferBrowser?: boolean } = {}) {
  const locale = await getLocale(opts);
  return { t: makeT(locale, ns), locale };
}

export type { Namespace };
