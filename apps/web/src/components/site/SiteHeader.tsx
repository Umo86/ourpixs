import type { ReactNode } from "react";
import { getBrand, getLocale } from "@/i18n";
import { BRANDS } from "@/lib/config";
import { makeT } from "@/i18n/shared";
import { Container } from "@/components/ui/Container";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/Button";
import { LanguageSwitch } from "@/components/ui/LanguageSwitch";
import { NavLinks, type NavItem } from "./NavLinks";
import { MobileMenu } from "./MobileMenu";
import { START_HREF, SIGN_IN_HREF } from "./constants";

export type SiteHeaderProps = {
  /** light = white bg / ink text; dark = ink bg / white text; overlay = transparent, absolutely positioned over a hero (white text). */
  variant?: "light" | "dark" | "overlay";
  /** Logo + language switch + `right` slot only (host / guest apps). */
  minimal?: boolean;
  right?: ReactNode;
  className?: string;
};

/** The one site header. Server component; brand + language come from the request. */
export async function SiteHeader({ variant = "light", minimal = false, right, className = "" }: SiteHeaderProps) {
  const [brand, locale] = await Promise.all([getBrand(), getLocale()]);
  const c = makeT(locale, "common");
  const m = makeT(locale, "marketing");
  const name = BRANDS[brand].name;
  const tone = variant === "light" ? "light" : "dark";

  const items: NavItem[] = [
    { href: "/features", label: c("nav.features") },
    { href: "/pricing", label: c("nav.pricing") },
    { href: "/partners", label: c("nav.partners") },
  ];
  const wrap =
    variant === "overlay" ? "absolute inset-x-0 top-0 z-30 text-white"
    : variant === "dark" ? "relative z-30 bg-ink text-white"
    : "relative z-30 bg-white text-ink";

  return (
    <header className={`${wrap} ${className}`}>
      <Container className="flex items-center justify-between gap-4 py-4 sm:py-7">
        <Logo name={name} tone={tone} />
        {minimal ? (
          <div className="flex items-center gap-3">
            <LanguageSwitch tone={tone} label={m("site.language")} />
            {right}
          </div>
        ) : (
          <>
            <div className="hidden items-center gap-7 md:flex">
              <NavLinks items={items} tone={tone} className="flex" />
              <LanguageSwitch tone={tone} label={m("site.language")} />
              <a
                href={SIGN_IN_HREF}
                className="rounded-md py-2 text-[15px] font-medium no-underline hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky"
              >
                {c("nav.signIn")}
              </a>
              <Button href={START_HREF}>{c("nav.startFree")}</Button>
            </div>
            <MobileMenu
              items={items}
              tone={tone}
              signIn={{ href: SIGN_IN_HREF, label: c("nav.signIn") }}
              start={{ href: START_HREF, label: c("nav.startFree") }}
              labels={{ open: m("site.menu"), close: m("site.closeMenu"), language: m("site.language") }}
            />
          </>
        )}
      </Container>
    </header>
  );
}
