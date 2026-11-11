import type { MetadataRoute } from "next";
import { getBrand } from "@/i18n";
import { MAIN_BRAND, brandBaseUrl, type Locale } from "@/lib/config";
import { withLang } from "@/components/marketing/meta";
import { GUIDES } from "@/content/guides";
import { OCCASION_PAGES } from "@/content/occasions";

type Entry = MetadataRoute.Sitemap[number];
type Paths = { en: string; tr: string };
const LOCALES: Locale[] = ["en", "tr"];

/**
 * bizimresimler.com (main, bilingual): one URL per language (`?lang=`), each listing both plus x-default — the same
 * cluster as the pages' hreflang tags. ourpixs.com (English alias): its own English URLs only.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const brand = await getBrand();
  const base = brandBaseUrl(brand);
  const main = brand === MAIN_BRAND;

  const entry = (p: Paths, priority: number, changeFrequency: Entry["changeFrequency"] = "monthly", lastModified?: string): Entry[] => {
    if (!main) return [{ url: base + (p.en || "/"), changeFrequency, priority, lastModified }];
    const languages = { en: base + withLang(p.en || "/", "en"), tr: base + withLang(p.tr || "/", "tr"), "x-default": base + (p.en || "/") };
    return LOCALES.map((l) => ({ url: base + withLang(p[l] || "/", l), changeFrequency, priority, lastModified, alternates: { languages } }));
  };
  const same = (path: string, priority: number, changeFrequency: Entry["changeFrequency"] = "monthly") => entry({ en: path, tr: path }, priority, changeFrequency);

  return [
    ...same("", 1), ...same("/features", 0.8), ...same("/pricing", 0.8), ...same("/demo", 0.7),
    ...same("/compare", 0.6), ...same("/templates", 0.6), ...same("/help", 0.6), ...same("/guides", 0.6),
    ...OCCASION_PAGES.flatMap((o) => same(`/for/${o.slug}`, 0.7)),
    // Guides have localized slugs: each language version points at its counterpart.
    ...GUIDES.en.flatMap((e) => {
      const t = GUIDES.tr.find((x) => x.id === e.id);
      return entry({ en: `/guides/${e.slug}`, tr: `/guides/${(t ?? e).slug}` }, 0.5, "yearly", e.date);
    }),
    ...same("/privacy", 0.3, "yearly"), ...same("/terms", 0.3, "yearly"), ...same("/credits", 0.2, "yearly"),
  ];
}
