import type { Metadata } from "next";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { eq, inArray } from "drizzle-orm";
import { schema } from "@/db";
import { getLocale } from "@/i18n";
import { makeT } from "@/i18n/shared";
import { occasionBySlug } from "@/lib/guest";
import { safeEqual } from "@/lib/crypto";
import { guestUrl, planOf, revealedForGuests, wallKey } from "@/lib/occasion";
import { liveMedia, mediaPage, occasionStats } from "@/lib/queries";
import { toMediaItems } from "@/lib/serializers";
import { resolveBranding } from "@/lib/org";
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
  if (!planOf(o).liveWall) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-ink p-10 text-center text-white">
        <h1 className="m-0 text-5xl font-black tracking-[-0.04em]">{t("wall.lockedTitle")}</h1>
        <p className="m-0 max-w-xl text-xl text-muted-dark">{t("wall.lockedBody")}</p>
      </main>
    );
  }
  const where = [...liveMedia(o.id), eq(schema.media.visibility, "visible"), eq(schema.media.approved, true), inArray(schema.media.kind, ["photo", "video"]), revealedForGuests(o)];
  const [{ rows }, stats, branding] = await Promise.all([mediaPage({ where, limit: 40 }), occasionStats(o), resolveBranding(o)]);
  const url = guestUrl(o);
  const qr = await QRCode.toDataURL(url, { margin: 1, width: 600, errorCorrectionLevel: "M", color: { dark: "#0A0A0A", light: "#FFFFFF" } });
  return (
    <WallClient
      slug={slug} wallKey={k} title={o.title} qr={qr} shortUrl={url.replace(/^https?:\/\//, "")}
      initial={await toMediaItems(rows, "guest")} initialStats={{ photos: stats.photos + stats.videos, guests: stats.guests }}
      brandName={branding.platform ? BRANDS[o.brand].name : branding.venueName} logoUrl={branding.logoUrl} accent={branding.colours.accent === "#FFFFFF" ? "#2347E0" : branding.mode === "venue" ? branding.colours.bg : "#2347E0"}
      labels={{
        shareYours: t("wall.shareYours"), shareYoursAccent: t("wall.shareYoursAccent"), scan: t("wall.scan"),
        stats: t("wall.stats", { photos: "{photos}", guests: "{guests}" }), justNow: t("wall.justNow"), by: t("wall.by", { name: "{name}" }),
        empty: t("wall.empty"), fullscreen: t("wall.fullscreen"),
      }}
    />
  );
}
