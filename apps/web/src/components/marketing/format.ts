import type { Locale } from "@/lib/config";

/** 1900 -> "£19", 1950 -> "£19.50" */
export function formatGBP(pence: number): string {
  return pence % 100 === 0 ? `£${pence / 100}` : `£${(pence / 100).toFixed(2)}`;
}

/** Replaces {vars} in strings that come from message arrays. */
export function fill(s: string, vars: Record<string, string | number>): string {
  return s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));
}

/** 30 -> "30 days", 365 -> "1 year", 1095 -> "3 years" */
export function formatStorage(days: number, locale: Locale): string {
  if (days >= 365) {
    const y = Math.round(days / 365);
    return locale === "tr" ? `${y} yıl` : `${y} ${y === 1 ? "year" : "years"}`;
  }
  return locale === "tr" ? `${days} gün` : `${days} days`;
}
