import { MONEY_BACK_DAYS, SUBSCRIPTION, YEARLY_SAVING_PERCENT, type Locale } from "@/lib/config";

/** 1000 -> "£10", 999 -> "£9.99" */
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

/** Variables for pricing copy ({monthly}, {yearly}, {saving}, {trialDays} …). Every number comes from SUBSCRIPTION in src/lib/config.ts. */
export function pricingVars(email: string) {
  const f = SUBSCRIPTION.features;
  return {
    monthly: formatGBP(SUBSCRIPTION.monthlyPence), yearly: formatGBP(SUBSCRIPTION.yearlyPence),
    yearlyPerMonth: formatGBP(Math.round(SUBSCRIPTION.yearlyPence / 12)), saving: YEARLY_SAVING_PERCENT,
    trialDays: SUBSCRIPTION.trialDays, maxDays: f.maxDays, minutes: Math.round(f.maxVideoSeconds / 60),
    readOnlyDays: SUBSCRIPTION.cancelledReadOnlyDays, trialKeepDays: SUBSCRIPTION.trialGraceDeleteDays,
    graceDays: SUBSCRIPTION.pastDueGraceDays, days: MONEY_BACK_DAYS, email,
  };
}

