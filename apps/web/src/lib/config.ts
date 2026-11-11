/**
 * Shared product config: brands, occasion types, subscription, themes.
 * Single source of truth — never hard-code a brand name, price, limit or occasion wording in components.
 */

export type Locale = "en" | "tr";
export type Brand = "ourpixs" | "bizimresimler";

/**
 * BizimResimler is the main brand (bizimresimler.com): Turkish + English, the language follows the visitor's phone.
 * Our Pixs is the English alias brand on ourpixs.com: English by default, same product and backend.
 * - defaultLocale: language when there is no `lang` cookie (and, for browserLocale brands, no usable Accept-Language).
 * - browserLocale: first-time visitors get their browser/phone language (Turkish → tr, anything else → en).
 * - contentLocale: language that event data (default day names, moment tags) is stored in for events of this brand.
 *   Kept as before so existing events stay consistent; it is not the UI language.
 */
export const BRANDS: Record<Brand, { name: string; domain: string; defaultLocale: Locale; browserLocale: boolean; contentLocale: Locale; envUrl: string }> = {
  bizimresimler: { name: "BizimResimler", domain: "bizimresimler.com", defaultLocale: "en", browserLocale: true, contentLocale: "tr", envUrl: "NEXT_PUBLIC_URL_TR" },
  ourpixs: { name: "Our Pixs", domain: "ourpixs.com", defaultLocale: "en", browserLocale: false, contentLocale: "en", envUrl: "NEXT_PUBLIC_URL_EN" },
};

/** The main brand: legal entity name, Stripe product, store listings, JSON-LD. */
export const MAIN_BRAND: Brand = "bizimresimler";

function isBrand(v: string | undefined): v is Brand {
  return v === "bizimresimler" || v === "ourpixs";
}

/** Exact host (or a subdomain) of one of our domains; anything else (vercel.app, previews, localhost) → DEFAULT_BRAND. */
export function brandFromHost(host: string | null | undefined): Brand {
  const h = (host || "").toLowerCase().trim().split(",")[0]!.trim().replace(/:\d+$/, "").replace(/\.$/, "");
  for (const b of Object.keys(BRANDS) as Brand[]) {
    const d = BRANDS[b].domain;
    if (h === d || h.endsWith(`.${d}`)) return b;
  }
  const env = process.env.DEFAULT_BRAND;
  return isBrand(env) ? env : "bizimresimler";
}

/** iOS bundle identifier and Android package of the Expo app (apps/mobile/app.config.ts). */
export const MOBILE_APP_ID = "com.bizimresimler.app";

export function brandBaseUrl(brand: Brand): string {
  const v = brand === "bizimresimler" ? process.env.NEXT_PUBLIC_URL_TR : process.env.NEXT_PUBLIC_URL_EN;
  return v || `https://${BRANDS[brand].domain}`;
}

export type OccasionType =
  | "dugun" | "nisan" | "kina" | "sunnet" | "dogum_gunu" | "bebek" | "mezuniyet" | "yildonumu" | "ev_partisi" | "kurumsal" | "diger";

type L = { en: string; tr: string };
export const OCCASIONS: Record<OccasionType, { label: L; titlePattern: L; days: L[]; moments: L[] }> = {
  dugun: {
    label: { en: "Wedding", tr: "Düğün" },
    titlePattern: { en: "{names}'s Wedding", tr: "{names}'ın Düğünü" },
    days: [{ en: "Henna night", tr: "Kına" }, { en: "Wedding", tr: "Düğün" }, { en: "After party", tr: "After party" }],
    moments: [
      { en: "Grand entrance", tr: "Gelin girişi" }, { en: "First dance", tr: "İlk dans" }, { en: "Gold ceremony", tr: "Takı töreni" },
      { en: "Halay", tr: "Halay" }, { en: "Cake", tr: "Pasta" }, { en: "Family", tr: "Aile" },
    ],
  },
  nisan: {
    label: { en: "Engagement", tr: "Nişan" },
    titlePattern: { en: "{names}'s Engagement", tr: "{names}'ın Nişanı" },
    days: [{ en: "Engagement", tr: "Nişan" }],
    moments: [{ en: "Ring moment", tr: "Yüzük takma" }, { en: "Halay", tr: "Halay" }, { en: "Cake", tr: "Pasta" }, { en: "Family", tr: "Aile" }],
  },
  kina: {
    label: { en: "Henna night", tr: "Kına gecesi" },
    titlePattern: { en: "{names}'s Henna Night", tr: "{names}'ın Kına Gecesi" },
    days: [{ en: "Henna night", tr: "Kına gecesi" }],
    moments: [{ en: "Henna", tr: "Kına yakma" }, { en: "Folk songs", tr: "Türküler" }, { en: "Halay", tr: "Halay" }, { en: "The bride", tr: "Gelin" }],
  },
  sunnet: {
    label: { en: "Sünnet celebration", tr: "Sünnet" },
    titlePattern: { en: "{names}'s Sünnet", tr: "{names}'ın Sünneti" },
    days: [{ en: "Celebration", tr: "Kutlama" }],
    moments: [{ en: "The little prince", tr: "Şehzade" }, { en: "Family", tr: "Aile" }, { en: "Party", tr: "Eğlence" }, { en: "Cake", tr: "Pasta" }],
  },
  dogum_gunu: {
    label: { en: "Birthday", tr: "Doğum günü" },
    titlePattern: { en: "{names}'s Birthday", tr: "{names}'ın Doğum Günü" },
    days: [{ en: "Party", tr: "Parti" }],
    moments: [{ en: "Cake", tr: "Pasta" }, { en: "Candles", tr: "Mumlar" }, { en: "Gifts", tr: "Hediyeler" }, { en: "Dancing", tr: "Dans" }],
  },
  bebek: {
    label: { en: "Baby shower", tr: "Baby shower" },
    titlePattern: { en: "{names}'s Baby Shower", tr: "{names}'ın Baby Shower'ı" },
    days: [{ en: "Baby shower", tr: "Baby shower" }],
    moments: [{ en: "Gender reveal", tr: "Cinsiyet sürprizi" }, { en: "Gifts", tr: "Hediyeler" }, { en: "Games", tr: "Oyunlar" }],
  },
  mezuniyet: {
    label: { en: "Graduation", tr: "Mezuniyet" },
    titlePattern: { en: "{names}'s Graduation", tr: "{names}'ın Mezuniyeti" },
    days: [{ en: "Graduation", tr: "Mezuniyet" }],
    moments: [{ en: "Ceremony", tr: "Tören" }, { en: "Cap toss", tr: "Kep atma" }, { en: "Family", tr: "Aile" }],
  },
  yildonumu: {
    label: { en: "Anniversary", tr: "Yıldönümü" },
    titlePattern: { en: "{names}'s Anniversary", tr: "{names}'ın Yıldönümü" },
    days: [{ en: "Anniversary", tr: "Yıldönümü" }],
    moments: [{ en: "Toast", tr: "Kadeh" }, { en: "Dancing", tr: "Dans" }, { en: "Family", tr: "Aile" }],
  },
  ev_partisi: {
    label: { en: "House party", tr: "Ev partisi" },
    titlePattern: { en: "{names}'s Party", tr: "{names}'ın Partisi" },
    days: [{ en: "Party", tr: "Parti" }],
    moments: [{ en: "Dancing", tr: "Dans" }, { en: "Friends", tr: "Arkadaşlar" }, { en: "Food", tr: "Yemek" }],
  },
  kurumsal: {
    label: { en: "Company event", tr: "Şirket etkinliği" },
    titlePattern: { en: "{names}", tr: "{names}" },
    days: [{ en: "Event", tr: "Etkinlik" }],
    moments: [{ en: "Stage", tr: "Sahne" }, { en: "Awards", tr: "Ödüller" }, { en: "Team", tr: "Ekip" }, { en: "Networking", tr: "Networking" }],
  },
  diger: {
    label: { en: "Something else", tr: "Diğer" },
    titlePattern: { en: "{names}", tr: "{names}" },
    days: [{ en: "Day 1", tr: "1. gün" }],
    moments: [{ en: "Moments", tr: "Anlar" }, { en: "People", tr: "İnsanlar" }, { en: "Fun", tr: "Eğlence" }],
  },
};

/**
 * Account subscription: one price list, every feature, unlimited events. Amounts in pence, GBP, VAT included.
 * Access rules (trial, read-only, retention) are computed in src/lib/access.ts from these numbers.
 */
export const SUBSCRIPTION = {
  monthlyPence: 999,
  yearlyPence: 6999,
  /** Free trial length. It starts when the host creates their first event, and needs no card. */
  trialDays: 3,
  /** After this long into the trial, the dashboard and one email prompt the host to subscribe. */
  trialPromptAfterHours: 24,
  /** Unpaid trial: files are kept this long after the trial ends, then deleted. */
  trialGraceDeleteDays: 30,
  /** After a cancelled subscription's paid period ends: read-only (downloads allowed) this long, then deleted. */
  cancelledReadOnlyDays: 90,
  /** A failed renewal keeps working this long from the first failed payment, then behaves as cancelled. */
  pastDueGraceDays: 7,
  /** Deletion warning emails, days before files are deleted. */
  trialDeletionWarningDays: 7,
  cancelledDeletionWarningDays: 14,
  /** What every event gets on the trial and on both plans (fair use applies; see the terms). */
  features: {
    maxDays: 5,
    maxVideoSeconds: 600,
    maxVideoBytes: 1024 * 1024 * 1024,
    liveWall: true,
    missions: true,
    disposable: true,
    voiceGuestbook: true,
    shareLinks: true,
    cohosts: true,
    autoModeration: true,
  },
} as const;
export type PlanInterval = "month" | "year";
export const intervalPence = (i: PlanInterval): number => (i === "year" ? SUBSCRIPTION.yearlyPence : SUBSCRIPTION.monthlyPence);
/** Yearly saving vs 12 × monthly, as a whole percentage (42). */
export const YEARLY_SAVING_PERCENT = Math.round((1 - SUBSCRIPTION.yearlyPence / (SUBSCRIPTION.monthlyPence * 12)) * 100);
/** 14-day money-back guarantee on a host's first subscription payment (refunded by support). */
export const MONEY_BACK_DAYS = 14;
/** One address for both brands: support inbox and email sender. */
export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "hello@bizimresimler.com";
export const SUPPORT_EMAIL: Record<Brand, string> = { bizimresimler: CONTACT_EMAIL, ourpixs: CONTACT_EMAIL };

export const THEMES = {
  noir: { bg: "#0A0A0A", fg: "#FFFFFF", accent: "#4D6BFF" },
  royal: { bg: "#2347E0", fg: "#FFFFFF", accent: "#FFFFFF" },
  ivory: { bg: "#F7F5F0", fg: "#0A0A0A", accent: "#2347E0" },
  dusk: { bg: "#1B2440", fg: "#FFFFFF", accent: "#8097FF" },
  mono: { bg: "#FFFFFF", fg: "#0A0A0A", accent: "#0A0A0A" },
  blush: { bg: "#F3E4E1", fg: "#0A0A0A", accent: "#2347E0" },
} as const;

export const ALLOWED_MIME = [
  "image/jpeg", "image/png", "image/heic", "image/heif", "image/webp",
  "video/mp4", "video/quicktime", "video/webm", "audio/mp4", "audio/m4a", "audio/webm", "audio/mpeg",
];
