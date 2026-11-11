import Link from "next/link";
import { getBrand, getLocale } from "@/i18n";
import { BRANDS } from "@/lib/config";
import { makeT } from "@/i18n/shared";
import { Container } from "@/components/ui/Container";
import { Logo } from "@/components/ui/Logo";
import { LanguageSwitch } from "@/components/ui/LanguageSwitch";
import { OCCASION_PAGES } from "@/content/occasions";
import { supportMailto } from "./constants";

/** The one site footer. `compact` = single row for app pages (host / guest). */
export async function SiteFooter({ compact = false, className = "" }: { compact?: boolean; className?: string }) {
  const [brand, locale] = await Promise.all([getBrand(), getLocale()]);
  const c = makeT(locale, "common");
  const m = makeT(locale, "marketing");
  const name = BRANDS[brand].name;
  const mailto = supportMailto(brand);
  const copyright = m("site.copyright", { year: new Date().getFullYear(), brands: `${BRANDS.ourpixs.name} · ${BRANDS.bizimresimler.name}` });
  const link = "rounded-md py-1 text-white no-underline hover:text-sky-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky";

  if (compact) {
    return (
      <footer className={`bg-ink text-white ${className}`}>
        <Container className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 py-6 text-sm">
          <Logo name={name} tone="dark" className="!text-2xl" />
          <nav aria-label="Footer" className="flex flex-wrap items-center gap-x-5 gap-y-1">
            <Link href="/privacy" className={link}>{c("footer.privacy")}</Link>
            <Link href="/terms" className={link}>{c("footer.terms")}</Link>
            <a href={mailto} className={link}>{c("footer.contact")}</a>
          </nav>
          <LanguageSwitch tone="dark" label={m("site.language")} />
          <span className="w-full text-xs text-muted-dark">{copyright}</span>
        </Container>
      </footer>
    );
  }

  const col = (title: string, items: { href: string; label: string; external?: boolean }[]) => (
    <nav aria-label={title} className="flex min-w-[150px] flex-col gap-2">
      <h2 className="m-0 text-[13px] font-bold uppercase tracking-[0.16em] text-sky-soft">{title}</h2>
      {items.map((i) =>
        i.external ? (
          <a key={i.href} href={i.href} className={link}>{i.label}</a>
        ) : (
          <Link key={i.href} href={i.href} className={link}>{i.label}</Link>
        ),
      )}
    </nav>
  );

  return (
    <footer className={`bg-ink text-white ${className}`}>
      <Container className="flex flex-col gap-10 pb-10 pt-14 sm:pt-16">
        <div className="flex flex-wrap justify-between gap-10">
          <Logo name={name} tone="dark" size="xl" />
          <div className="flex flex-wrap gap-x-14 gap-y-8 text-[15px]">
            {col(m("site.product"), [
              { href: "/features", label: c("nav.features") },
              { href: "/pricing", label: c("nav.pricing") },
              { href: "/demo", label: m("site.demo") },
              { href: "/partners", label: c("nav.partners") },
            ])}
            {col(m("site.occasions"), OCCASION_PAGES.map((o) => ({ href: `/for/${o.slug}`, label: o[locale].nav })))}
            {col(m("site.resources"), [
              { href: "/help", label: m("site.help") },
              { href: "/guides", label: m("site.guides") },
              { href: "/templates", label: m("site.templates") },
              { href: "/compare", label: m("site.compare") },
            ])}
            {col(m("site.company"), [
              { href: mailto, label: c("footer.contact"), external: true },
              { href: "/privacy", label: c("footer.privacy") },
              { href: "/terms", label: c("footer.terms") },
              { href: "/credits", label: m("site.creditsLink") },
            ])}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[#2E2E2E] pt-6 text-sm">
          <span className="text-muted-dark">{copyright}</span>
          <LanguageSwitch tone="dark" label={m("site.language")} />
        </div>
        <p className="m-0 text-[12.5px] leading-relaxed text-muted-dark">
          {c("footer.credits")} <Link href="/credits" className="text-white underline">{m("site.creditsLink")}</Link>
        </p>
      </Container>
    </footer>
  );
}
