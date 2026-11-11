import type { MetadataRoute } from "next";
import { getBrand } from "@/i18n";
import { BRANDS, brandBaseUrl } from "@/lib/config";
import { GUIDES } from "@/content/guides";
import { OCCASION_PAGES } from "@/content/occasions";

type Entry = MetadataRoute.Sitemap[number];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const brand = await getBrand();
  const base = brandBaseUrl(brand);
  const en = brandBaseUrl("ourpixs");
  const tr = brandBaseUrl("bizimresimler");
  const locale = BRANDS[brand].defaultLocale;

  const same = (path: string, priority: number, changeFrequency: Entry["changeFrequency"] = "monthly"): Entry => ({
    url: base + path, changeFrequency, priority, alternates: { languages: { en: en + path, tr: tr + path } },
  });

  const entries: Entry[] = [
    same("", 1), same("/features", 0.8), same("/pricing", 0.8), same("/demo", 0.7), same("/partners", 0.6),
    same("/compare", 0.6), same("/templates", 0.6), same("/help", 0.6), same("/guides", 0.6),
    ...OCCASION_PAGES.map((o) => same(`/for/${o.slug}`, 0.7)),
    // Guides: each brand lists its own language's slugs; hreflang points at the counterpart on the other brand.
    ...GUIDES[locale].map((g): Entry => {
      const e = GUIDES.en.find((x) => x.id === g.id)!;
      const t = GUIDES.tr.find((x) => x.id === g.id)!;
      return {
        url: `${base}/guides/${g.slug}`, lastModified: g.date, changeFrequency: "yearly", priority: 0.5,
        alternates: { languages: { en: `${en}/guides/${e.slug}`, tr: `${tr}/guides/${t.slug}` } },
      };
    }),
    same("/privacy", 0.3, "yearly"), same("/terms", 0.3, "yearly"), same("/credits", 0.2, "yearly"),
  ];
  return entries;
}
