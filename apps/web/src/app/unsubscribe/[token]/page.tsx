import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader, SiteFooter } from "@/components/site";
import { Container } from "@/components/ui";
import { getBrand, getT } from "@/i18n";
import { BRANDS, CONTACT_EMAIL } from "@/lib/config";
import { withdrawByToken } from "@/lib/consent";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT("common");
  return { title: t("unsubscribe.metaTitle"), robots: { index: false, follow: false } };
}

/**
 * The visible unsubscribe link in every marketing email. Opening it is enough (one click): every current marketing
 * consent of that email + brand is withdrawn. Idempotent; an unknown or already-used link shows the same neutral page.
 */
export default async function UnsubscribePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [{ t }, brand] = await Promise.all([getT("common"), getBrand()]);
  const r = await withdrawByToken(token, "unsubscribe_link").catch((e) => { console.error("[unsubscribe] failed", e); return null; });
  const name = BRANDS[r?.brand ?? brand].name;
  return (
    <div className="flex min-h-screen flex-col bg-white text-ink">
      <SiteHeader variant="light" minimal />
      <main id="main" className="flex-1">
        <Container size="narrow" className="flex flex-col gap-6 py-14 sm:py-20">
          <h1 className="m-0 text-[clamp(2.4rem,7vw,4rem)] font-black leading-[0.92] tracking-[-0.04em]">
            {t("unsubscribe.title")} <span className="font-serif text-royal">{t("unsubscribe.accent")}</span>
          </h1>
          <p className="m-0 max-w-2xl text-lg text-text-2">{r ? t("unsubscribe.body", { brand: name, email: r.email }) : t("unsubscribe.bodyUnknown", { brand: name })}</p>
          <p className="m-0 max-w-2xl text-text-2">{t("unsubscribe.note", { brand: name })}</p>
          <p className="m-0 text-sm text-muted">{t("unsubscribe.help", { email: CONTACT_EMAIL })}</p>
          <p className="m-0"><Link href="/privacy" className="font-bold text-royal">{t("unsubscribe.privacy")}</Link></p>
        </Container>
      </main>
      <SiteFooter compact />
    </div>
  );
}
