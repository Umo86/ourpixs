import type { Metadata, Viewport } from "next";
import { Inter_Tight, Bodoni_Moda } from "next/font/google";
import { getBrand, getLocale } from "@/i18n";
import { BRANDS, brandBaseUrl } from "@/lib/config";
import { I18nProvider } from "@/i18n/client";
import "./globals.css";

const inter = Inter_Tight({ subsets: ["latin", "latin-ext"], weight: ["400", "500", "600", "700", "800", "900"], variable: "--font-inter-tight", display: "swap" });
const bodoni = Bodoni_Moda({ subsets: ["latin", "latin-ext"], style: ["italic"], weight: ["400", "500"], variable: "--font-bodoni", display: "swap" });

export async function generateMetadata(): Promise<Metadata> {
  const [brand, locale] = await Promise.all([getBrand(), getLocale()]);
  const name = BRANDS[brand].name;
  const tr = locale === "tr";
  // hreflang alternates are per page (src/components/marketing/meta.ts); app pages are noindex.
  return {
    metadataBase: new URL(brandBaseUrl(brand)),
    applicationName: name,
    title: { default: tr ? `${name} — Özel gününüzün her karesi tek albümde` : `${name} — Every guest photo, one album`, template: `%s · ${name}` },
    description: tr
      ? "Misafirler QR kodu okutur, fotoğraf ve videolarını yükler. Uygulama yok, üyelik yok. Düğün, kına, doğum günü ve her özel gün için."
      : "Guests scan a QR code and share their photos and videos. No app, no sign-up. For weddings, birthdays, parties and every special day.",
    openGraph: { siteName: name, locale: tr ? "tr_TR" : "en_GB" },
    icons: { icon: "/favicon.ico" },
  };
}

export const viewport: Viewport = { themeColor: "#0A0A0A", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [brand, locale] = await Promise.all([getBrand(), getLocale({ preferBrowser: false })]);
  return (
    <html lang={locale} className={`${inter.variable} ${bodoni.variable}`}>
      <body className="antialiased">
        <I18nProvider locale={locale} brand={brand}>{children}</I18nProvider>
      </body>
    </html>
  );
}
