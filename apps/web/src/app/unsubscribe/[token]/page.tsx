import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader, SiteFooter } from "@/components/site";
import { Button, Container } from "@/components/ui";
import { getBrand, getT } from "@/i18n";
import { BRANDS, CONTACT_EMAIL } from "@/lib/config";
import { consentByToken } from "@/lib/consent";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT("common");
  return { title: t("unsubscribe.metaTitle"), robots: { index: false, follow: false }, referrer: "no-referrer" };
}

/**
 * The visible unsubscribe link in every marketing email. Opening it (GET) only SHOWS a confirmation with one button:
 * mail scanners and link previews fetch links before the person does, so a GET must never withdraw consent.
 * The button posts to ./confirm, which withdraws every current marketing consent of that email + brand and comes back
 * here. Mail apps' own "Unsubscribe" uses the RFC 8058 one-click POST (/api/v1/unsubscribe/<token>).
 * An unknown link shows the same neutral page; a link whose consent is already withdrawn shows "unsubscribed".
 */
export default async function UnsubscribePage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ slow?: string }> }) {
  const [{ token }, sp] = await Promise.all([params, searchParams]);
  const [{ t }, brand] = await Promise.all([getT("common"), getBrand()]);
  const r = await consentByToken(token).catch((e) => { console.error("[unsubscribe] lookup failed", e); return null; });
  const name = BRANDS[r?.brand ?? brand].name;
  const confirm = !!r && r.current;
  return (
    <div className="flex min-h-screen flex-col bg-white text-ink">
      <SiteHeader variant="light" minimal />
      <main id="main" className="flex-1">
        <Container size="narrow" className="flex flex-col gap-6 py-14 sm:py-20">
          <h1 className="m-0 text-[clamp(2.4rem,7vw,4rem)] font-black leading-[0.92] tracking-[-0.04em]">
            {t(confirm ? "unsubscribe.confirmTitle" : "unsubscribe.title")} <span className="font-serif text-royal">{t(confirm ? "unsubscribe.confirmAccent" : "unsubscribe.accent")}</span>
          </h1>
          {confirm ? (
            <>
              <p className="m-0 max-w-2xl text-lg text-text-2">{t("unsubscribe.confirmBody", { brand: name, email: r.email })}</p>
              {sp.slow ? <p role="alert" className="m-0 max-w-2xl font-bold text-ink">{t("unsubscribe.slowDown")}</p> : null}
              <form method="post" action={`/unsubscribe/${token}/confirm`} className="m-0">
                <Button type="submit" size="lg">{t("unsubscribe.confirmButton")}</Button>
              </form>
            </>
          ) : (
            <p className="m-0 max-w-2xl text-lg text-text-2">{r ? t("unsubscribe.body", { brand: name, email: r.email }) : t("unsubscribe.bodyUnknown", { brand: name })}</p>
          )}
          <p className="m-0 max-w-2xl text-text-2">{t("unsubscribe.note", { brand: name })}</p>
          <p className="m-0 text-sm text-muted">{t("unsubscribe.help", { email: CONTACT_EMAIL })}</p>
          <p className="m-0"><Link href="/privacy" className="font-bold text-royal">{t("unsubscribe.privacy")}</Link></p>
        </Container>
      </main>
      <SiteFooter compact />
    </div>
  );
}
