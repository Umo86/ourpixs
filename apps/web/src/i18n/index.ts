import "server-only";
import { cookies, headers } from "next/headers";
import { brandFromHost, BRANDS, type Brand, type Locale } from "@/lib/config";
import { makeT, type Namespace } from "./shared";

/** Brand comes from the request host (ourpixs.com → EN brand, bizimresimler.com → TR brand). */
export async function getBrand(): Promise<Brand> {
  const h = await headers();
  return brandFromHost(h.get("x-forwarded-host") || h.get("host"));
}

/**
 * Locale: `lang` cookie (set by the EN/TR switch) > brand default.
 * Guest pages may pass `preferBrowser` to fall back to Accept-Language before the brand default.
 */
export async function getLocale(opts: { preferBrowser?: boolean } = {}): Promise<Locale> {
  const c = await cookies();
  const v = c.get("lang")?.value;
  if (v === "en" || v === "tr") return v;
  if (opts.preferBrowser) {
    const al = (await headers()).get("accept-language") || "";
    if (/^tr\b|,\s*tr\b/i.test(al)) return "tr";
    if (al) return "en";
  }
  return BRANDS[await getBrand()].defaultLocale;
}

export async function getT(ns: Namespace, opts: { preferBrowser?: boolean } = {}) {
  const locale = await getLocale(opts);
  return { t: makeT(locale, ns), locale };
}

export type { Namespace };
