import type { Metadata } from "next";
import { getBrand, getLocale, getT } from "@/i18n";
import { BRANDS, MAIN_BRAND, SUPPORT_EMAIL, brandBaseUrl, type Brand, type Locale } from "@/lib/config";
import { pricingVars } from "./format";
import { getSettings } from "@/lib/settings";

type Page = "home" | "features" | "pricing" | "privacy" | "terms" | "credits";
type Paths = { en: string; tr: string };

/** `/features` + en → `/features?lang=en` (middleware pins `?lang=`, so the URL always serves that language). */
export function withLang(path: string, locale: Locale): string {
  return `${path}${path.includes("?") ? "&" : "?"}lang=${locale}`;
}

/**
 * hreflang cluster. BizimResimler (bizimresimler.com) is bilingual and language-adaptive, so each language has its
 * own `?lang=` URL and the bare URL is x-default (Turkish phone → tr, anything else → en).
 * ourpixs.com is the English alias: it stays outside the cluster with a self canonical.
 */
export function languageAlternates(brand: Brand, locale: Locale, p: Paths, current: string): NonNullable<Metadata["alternates"]> {
  if (brand !== MAIN_BRAND) return { canonical: current };
  const base = brandBaseUrl(MAIN_BRAND);
  return {
    canonical: withLang(p[locale], locale),
    languages: { en: base + withLang(p.en, "en"), tr: base + withLang(p.tr, "tr"), "x-default": base + p.en },
  };
}

/** Shared metadata builder: canonical + hreflang alternates + OpenGraph. */
export async function buildMetadata(opts: {
  title: string;
  description: string;
  path: string;
  /** Per-language paths when the URL differs between languages (e.g. localized guide slugs). */
  paths?: Paths;
  absolute?: boolean;
  type?: "website" | "article";
}): Promise<Metadata> {
  const [brand, locale] = await Promise.all([getBrand(), getLocale()]);
  const name = BRANDS[brand].name;
  const p = opts.paths ?? { en: opts.path, tr: opts.path };
  const alternates = languageAlternates(brand, locale, p, opts.path);
  return {
    title: opts.absolute ? { absolute: opts.title } : opts.title,
    description: opts.description,
    alternates,
    openGraph: {
      title: opts.absolute ? opts.title : `${opts.title} · ${name}`,
      description: opts.description,
      url: typeof alternates.canonical === "string" ? alternates.canonical : opts.path,
      siteName: name,
      locale: locale === "tr" ? "tr_TR" : "en_GB",
      type: opts.type ?? "website",
    },
  };
}

export async function pageMetadata(page: Page, path: string): Promise<Metadata> {
  const [{ t }, brand, settings] = await Promise.all([getT("marketing"), getBrand(), getSettings()]);
  const name = BRANDS[brand].name;
  const vars = { ...pricingVars(SUPPORT_EMAIL[brand], settings), brand: name };
  return buildMetadata({
    title: t(`meta.${page}.title`, vars),
    description: t(`meta.${page}.description`, vars),
    path,
    absolute: page === "home",
  });
}
