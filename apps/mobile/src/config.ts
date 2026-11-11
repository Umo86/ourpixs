/**
 * Product config copied from apps/web/src/lib/config.ts (the single source of truth).
 * The mobile app is a standalone npm project, so this is a copy: keep it in sync when the web config changes.
 */
import Constants from "expo-constants";

export type Locale = "en" | "tr";
export type Brand = "ourpixs" | "bizimresimler";
type L = { en: string; tr: string };

export const BRANDS: Record<Brand, { name: string; domain: string; defaultLocale: Locale }> = {
  ourpixs: { name: "Our Pixs", domain: "ourpixs.com", defaultLocale: "en" },
  bizimresimler: { name: "Bizim Resimler", domain: "bizimresimler.com", defaultLocale: "tr" },
};

/** The brand the app presents in a given UI language. */
export function brandForLocale(locale: Locale): Brand {
  return locale === "tr" ? "bizimresimler" : "ourpixs";
}

const extra = (Constants.expoConfig?.extra ?? {}) as { apiUrl?: string; demo?: boolean };

/** API base URL. EXPO_PUBLIC_API_URL wins, then app.config extra, then production. */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL || extra.apiUrl || "https://ourpixs.com").replace(/\/+$/, "");

/** Demo mode: every screen is reachable with built-in sample data (store screenshots). */
export const DEMO_MODE = process.env.EXPO_PUBLIC_DEMO === "1" || extra.demo === true;

/**
 * Show a "Choose a plan" button that opens the website's pricing page in the browser.
 * OFF for App Store / Play builds: selling an account subscription via an external link, or showing prices,
 * conflicts with Apple 3.1.1 and Google Play Payments policy. Store builds show plan status only, neutrally.
 * Only non-store dev builds (EXPO_PUBLIC_EXTERNAL_CHECKOUT=1) may show the button.
 */
export const EXTERNAL_CHECKOUT = process.env.EXPO_PUBLIC_EXTERNAL_CHECKOUT === "1";

/** Show the dev-only login code when the backend returns one. */
export const SHOW_PREVIEW_CODE = __DEV__ || process.env.EXPO_PUBLIC_SHOW_PREVIEW_CODE === "1";

export const SUPPORT_EMAILS: Record<Brand, string> = {
  ourpixs: process.env.EXPO_PUBLIC_SUPPORT_EMAIL_EN || "hello@ourpixs.com",
  bizimresimler: process.env.EXPO_PUBLIC_SUPPORT_EMAIL_TR || "merhaba@bizimresimler.com",
};
export function supportEmail(brand: Brand): string {
  return SUPPORT_EMAILS[brand];
}

/** Public website for a brand (privacy, terms…). Always the brand's own domain. */
export function siteUrl(brand: Brand, path = ""): string {
  return `https://${BRANDS[brand].domain}${path}`;
}

/** Hosts whose /g/<slug> links open the join flow. */
export const GUEST_LINK_HOSTS = ["ourpixs.com", "www.ourpixs.com", "bizimresimler.com", "www.bizimresimler.com"];

export type OccasionType =
  | "dugun" | "nisan" | "kina" | "sunnet" | "dogum_gunu" | "bebek" | "mezuniyet" | "yildonumu" | "ev_partisi" | "kurumsal" | "diger";

export const OCCASION_TYPES: OccasionType[] = [
  "dugun", "nisan", "kina", "sunnet", "dogum_gunu", "bebek", "mezuniyet", "yildonumu", "ev_partisi", "kurumsal", "diger",
];

/** How many honoree names to ask for per type (couples get two). */
export const HONOREE_COUNT: Record<OccasionType, number> = {
  dugun: 2, nisan: 2, kina: 1, sunnet: 1, dogum_gunu: 1, bebek: 1, mezuniyet: 1, yildonumu: 2, ev_partisi: 1, kurumsal: 1, diger: 1,
};

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

export function occasionLabel(type: string, locale: Locale): string {
  const o = OCCASIONS[type as OccasionType];
  return o ? o.label[locale] : type;
}

/** Applies the per-type title pattern. Names are joined with " & ". */
export function buildTitle(type: OccasionType, names: string[], locale: Locale): string {
  const joined = names.map((n) => n.trim()).filter(Boolean).join(" & ");
  if (!joined) return "";
  return OCCASIONS[type].titlePattern[locale].replace("{names}", joined);
}

export const THEMES = {
  noir: { bg: "#0A0A0A", fg: "#FFFFFF", accent: "#4D6BFF" },
  royal: { bg: "#2347E0", fg: "#FFFFFF", accent: "#FFFFFF" },
  ivory: { bg: "#F7F5F0", fg: "#0A0A0A", accent: "#2347E0" },
  dusk: { bg: "#1B2440", fg: "#FFFFFF", accent: "#8097FF" },
  mono: { bg: "#FFFFFF", fg: "#0A0A0A", accent: "#0A0A0A" },
  blush: { bg: "#F3E4E1", fg: "#0A0A0A", accent: "#2347E0" },
} as const;
export type ThemeName = keyof typeof THEMES;
export const THEME_NAMES = Object.keys(THEMES) as ThemeName[];

export function themeOf(name: string | null | undefined) {
  return THEMES[(name as ThemeName) in THEMES ? (name as ThemeName) : "noir"];
}

export const ALLOWED_MIME = [
  "image/jpeg", "image/png", "image/heic", "image/heif", "image/webp",
  "video/mp4", "video/quicktime", "video/webm", "audio/mp4", "audio/m4a", "audio/webm", "audio/mpeg",
];

/** Demo-review account (App Review / Play pre-launch). Server must honour it in /api/v1/auth/verify. */
export const REVIEW_EMAIL = (process.env.EXPO_PUBLIC_REVIEW_EMAIL || "").trim().toLowerCase();
