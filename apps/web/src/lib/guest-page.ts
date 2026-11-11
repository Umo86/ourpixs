import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";
import { getLocale } from "@/i18n";
import { ApiError } from "./http";
import { getGuest, hasPinAccess, occasionBySlug } from "./guest";
import { loadDays } from "./queries";
import { coverUrlFor, toPublicOccasion } from "./serializers";
import { accessForOccasion } from "./access";
import { DEMO_COOKIE, demoOccasion, isDemo } from "./demo";
import type { PublicOccasion } from "./api-types";

function safeDecode(v: string) {
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
}

type GuestContext = {
  o: { id: string; slug: string; title: string };
  guest: { id: string; displayName: string; shotsTaken: number } | null;
  locale: "en" | "tr";
  publicOccasion: PublicOccasion;
  pinOk: boolean;
  demo: boolean;
};

/** Everything a guest page needs, memoised per request (layout + page share it). */
export const loadGuestContext = cache(async (slug: string): Promise<GuestContext> => {
  const locale = await getLocale({ preferBrowser: true });
  if (isDemo(slug)) {
    const name = (await cookies()).get(DEMO_COOKIE)?.value;
    const po = demoOccasion(locale);
    return {
      o: { id: "demo", slug: "demo", title: po.title },
      guest: name ? { id: "demo-guest", displayName: safeDecode(name).slice(0, 40), shotsTaken: 0 } : null,
      locale, publicOccasion: po, pinOk: true, demo: true,
    };
  }
  let o;
  try {
    o = await occasionBySlug(slug);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
  const h = await headers();
  const ip = (h.get("x-forwarded-for") || "").split(",")[0]?.trim() || "unknown";
  const [guest, days, access, cover] = await Promise.all([getGuest(o), loadDays(o.id), accessForOccasion(o), coverUrlFor(o.coverKey)]);
  // Rendering never spends PIN rate-limit tokens: only the proof cookie / a joined device count here.
  const pinOk = !o.pinHash || !!guest || (await hasPinAccess(o, ip, guest).catch(() => false));
  return {
    o: { id: o.id, slug: o.slug, title: o.title },
    guest: guest ? { id: guest.id, displayName: guest.displayName, shotsTaken: guest.shotsTaken } : null,
    locale, publicOccasion: toPublicOccasion(o, days, locale, cover, access), pinOk, demo: false,
  };
});
