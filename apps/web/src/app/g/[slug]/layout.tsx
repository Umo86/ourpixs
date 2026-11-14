import type { Metadata, Viewport } from "next";
import { SiteHeader, SiteFooter, CookieNotice } from "@/components/site";
import { getBrand } from "@/i18n";
import { makeT } from "@/i18n/shared";
import { I18nProvider } from "@/i18n/client";
import { loadGuestContext } from "@/lib/guest-page";
import { GuestProvider } from "@/components/guest/GuestContext";
import { TabBar } from "@/components/guest/TabBar";
import "./guest.css";

export const dynamic = "force-dynamic";
export const viewport: Viewport = { themeColor: "#0A0A0A", width: "device-width", initialScale: 1, viewportFit: "cover" };

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { o } = await loadGuestContext((await params).slug);
  return { title: o.title, robots: { index: false, follow: false }, openGraph: null };
}

export default async function GuestLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { o, guest, locale, publicOccasion, pinOk, demo } = await loadGuestContext(slug);
  const brand = await getBrand();
  const t = makeT(locale, "guest");
  const open = publicOccasion.galleryState === "live" || publicOccasion.galleryState === "ended";
  const joined = !!guest && open;
  return (
    <I18nProvider locale={locale} brand={brand}>
      <GuestProvider
        value={{
          slug: o.slug, path: `/g/${slug}`, occasion: publicOccasion, pinOk,
          guest,
        }}
      >
        <div className="guest-app flex min-h-dvh flex-col bg-ink text-white">
          <SiteHeader variant="dark" minimal />
          {demo ? <p className="m-0 bg-royal px-5 py-2 text-center text-[13px] font-bold">{t("demo.banner")}</p> : null}
          <div className={`flex flex-1 flex-col ${joined ? "pb-28" : ""}`}>{children}</div>
          <CookieNotice />
          {joined ? <TabBar /> : <SiteFooter compact />}
        </div>
      </GuestProvider>
    </I18nProvider>
  );
}
