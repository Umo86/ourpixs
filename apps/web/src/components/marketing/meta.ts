import type { Metadata } from "next";
import { getBrand, getT } from "@/i18n";
import { BRANDS, SUPPORT_EMAIL, brandBaseUrl } from "@/lib/config";
import { pricingVars } from "./format";

type Page = "home" | "features" | "pricing" | "privacy" | "terms" | "credits";

/** Shared metadata builder: canonical + hreflang alternates (ourpixs.com = en, bizimresimler.com = tr). */
export async function buildMetadata(opts: {
  title: string;
  description: string;
  path: string;
  /** Per-brand paths when the URL differs between sites (e.g. localized guide slugs). */
  paths?: { en: string; tr: string };
  absolute?: boolean;
  type?: "website" | "article";
}): Promise<Metadata> {
  const brand = await getBrand();
  const name = BRANDS[brand].name;
  const p = opts.paths ?? { en: opts.path, tr: opts.path };
  return {
    title: opts.absolute ? { absolute: opts.title } : opts.title,
    description: opts.description,
    alternates: {
      canonical: opts.path,
      languages: { en: brandBaseUrl("ourpixs") + p.en, tr: brandBaseUrl("bizimresimler") + p.tr },
    },
    openGraph: { title: opts.absolute ? opts.title : `${opts.title} · ${name}`, description: opts.description, url: opts.path, siteName: name, type: opts.type ?? "website" },
  };
}

export async function pageMetadata(page: Page, path: string): Promise<Metadata> {
  const [{ t }, brand] = await Promise.all([getT("marketing"), getBrand()]);
  const name = BRANDS[brand].name;
  const vars = { ...pricingVars(SUPPORT_EMAIL[brand]), brand: name };
  return buildMetadata({
    title: t(`meta.${page}.title`, vars),
    description: t(`meta.${page}.description`, vars),
    path,
    absolute: page === "home",
  });
}
