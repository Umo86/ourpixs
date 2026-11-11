import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { HeaderByRoute } from "@/components/site/HeaderByRoute";
import { CookieNotice } from "@/components/site/CookieNotice";
import { getT } from "@/i18n";

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const { t } = await getT("marketing");
  return (
    <div className="relative flex min-h-screen flex-col bg-white text-ink">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-white focus:px-5 focus:py-3 focus:font-bold focus:text-ink"
      >
        {t("site.skip")}
      </a>
      {/* "/" gets the transparent overlay header over the hero video; every other page the light one. Same component, same links. */}
      <HeaderByRoute overlay={<SiteHeader variant="overlay" />} light={<SiteHeader variant="light" />} />
      <main id="main" className="flex-1">{children}</main>
      <SiteFooter />
      <CookieNotice />
    </div>
  );
}
