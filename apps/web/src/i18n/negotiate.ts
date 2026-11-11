import type { Locale } from "@/lib/config";

/**
 * Picks our locale from an Accept-Language header, in the visitor's own order of preference (q values respected):
 * the first of their languages we support wins, so "tr-TR,en;q=0.8" → tr and "en-GB,en;q=0.9,tr;q=0.8" → en.
 * A header with neither Turkish nor English → en (the user base is in the UK). Empty header → null (caller decides).
 * Edge-safe (used by middleware).
 */
export function localeFromAcceptLanguage(header: string | null | undefined): Locale | null {
  const al = (header || "").trim();
  if (!al) return null;
  const langs = al
    .split(",")
    .map((part, i) => {
      const [tag = "", ...params] = part.trim().split(";");
      const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
      const n = q ? Number(q.slice(2)) : 1;
      return { lang: tag.trim().toLowerCase().split("-")[0] ?? "", q: Number.isFinite(n) ? n : 0, i };
    })
    .filter((x) => x.lang && x.q > 0)
    .sort((a, b) => b.q - a.q || a.i - b.i);
  for (const { lang } of langs) {
    if (lang === "tr") return "tr";
    if (lang === "en") return "en";
  }
  return "en";
}

/** `?lang=en|tr` (hreflang URLs, links from the app) pins the language like the EN/TR switch does. */
export function localeParam(v: string | null | undefined): Locale | null {
  return v === "en" || v === "tr" ? v : null;
}
