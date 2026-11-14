import { CANCELLATION_DAYS, FEATURES, type Locale, type PackageSettings } from "@/lib/config";

/** 6900 -> "£69", 350 -> "£3.50" */
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

/**
 * Variables for pricing copy ({price}, {guestPrice}, {windowDays}, {retentionMonths}, {videoSeconds}, {fairUseGb}, {testLimit} …).
 * Every number comes from the live admin settings (src/lib/settings.ts → getSettings()), passed in by the page.
 */
export function pricingVars(email: string, s: PackageSettings) {
  return {
    price: formatGBP(s.eventPricePence), guestPrice: formatGBP(s.guestDownloadPence), windowDays: s.windowDays,
    retentionMonths: s.retentionMonths, videoSeconds: s.videoMaxSeconds, fairUseGb: s.fairUseGb, testLimit: s.hostTestUploadLimit,
    maxDays: FEATURES.maxDays, cancelDays: CANCELLATION_DAYS, email,
  };
}
export type PricingVars = ReturnType<typeof pricingVars>;
