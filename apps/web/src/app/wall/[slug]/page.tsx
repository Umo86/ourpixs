import type { Metadata } from "next";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { getLocale } from "@/i18n";
import { makeT } from "@/i18n/shared";
import { occasionBySlug } from "@/lib/guest";
import { safeEqual } from "@/lib/crypto";
import { guestUrl, revealedForGuests, wallKey } from "@/lib/occasion";
import { occasionStats, wallMedia } from "@/lib/queries";
import { toMediaItems } from "@/lib/serializers";
import { accessForOccasion } from "@/lib/access";
import { BRANDS } from "@/lib/config";
import { WallClient } from "@/components/wall/WallClient";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function WallPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ k?: string }> }) {
  const { slug } = await params;
  const { k } = await searchParams;
  const o = await occasionBySlug(slug).catch(() => null);
  if (!o || !k || !safeEqual(k, wallKey(o))) notFound();
  const locale = await getLocale();
  const t = makeT(locale, "guest");
  // Ready items only (clean display copies / 1080p videos); processing items join once they're finished.
  const [{ rows, cursor }, stats, access] = await Promise.all([wallMedia(o, revealedForGuests(o)), occasionStats(o), accessForOccasion(o)]);
  if (access.state === "expired" || access.state === "refunded" || access.reason === "suspended") notFound();
  const url = guestUrl(o);
  const qr = await QRCode.toDataURL(url, { margin: 1, width: 600, errorCorrectionLevel: "M", color: { dark: "#0A0A0A", light: "#FFFFFF" } });
  return (
    <WallClient
      slug={slug} wallKey={k} title={o.title} qr={qr} shortUrl={url.replace(/^https?:\/\//, "")}
      initial={await toMediaItems(rows, { kind: "wall" })} initialCursor={cursor} initialStats={{ photos: stats.photos + stats.videos, guests: stats.guests }}
      brandName={BRANDS[o.brand].name} logoUrl={null} accent="#2347E0"
      labels={{
        shareYours: t("wall.shareYours"), shareYoursAccent: t("wall.shareYoursAccent"), scan: t("wall.scan"),
        stats: t("wall.stats", { photos: "{photos}", guests: "{guests}" }), justNow: t("wall.justNow"), by: t("wall.by", { name: "{name}" }),
        empty: t("wall.empty"), fullscreen: t("wall.fullscreen"),
      }}
    />
  );
}
