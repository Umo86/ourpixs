import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader, SiteFooter, CookieNotice, supportEmail } from "@/components/site";
import { Container } from "@/components/ui";
import { getBrand, getT } from "@/i18n";
import { pricingVars } from "@/components/marketing/format";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT("host");
  return { title: t("support.metaTitle") };
}

export default async function SupportPage() {
  const { t } = await getT("host");
  const email = supportEmail(await getBrand());
  const faq = t("support.faq", pricingVars(email)).split("|").map((pair) => pair.split("::"));
  return (
    <div className="flex min-h-screen flex-col bg-white text-ink">
      <SiteHeader variant="light" />
      <main id="main" className="flex-1">
        <Container size="narrow" className="flex flex-col gap-8 py-10 sm:py-16">
          <h1 className="m-0 text-[clamp(2.6rem,7vw,4.5rem)] font-black leading-[0.92] tracking-[-0.04em]">{t("support.title")} <span className="font-serif text-royal">{t("support.titleAccent")}</span></h1>
          <p className="m-0 max-w-2xl text-lg text-text-2">{t("support.lead")}</p>
          <div className="flex flex-col gap-2 rounded-[28px] bg-tint p-6">
            <span className="text-sm font-bold text-muted">{t("support.emailLabel")}</span>
            <a href={`mailto:${email}`} className="text-2xl font-black text-royal">{email}</a>
            <span className="text-sm text-muted">{t("support.reply")}</span>
          </div>
          <section aria-labelledby="faq-h" className="flex flex-col gap-4">
            <h2 id="faq-h" className="m-0 text-2xl font-black">{t("support.faqTitle")}</h2>
            {faq.map(([q, a]) => (
              <details key={q} className="rounded-2xl border border-[#E6E8EF] p-5">
                <summary className="cursor-pointer text-[17px] font-extrabold">{q}</summary>
                <p className="m-0 mt-3 text-text-2">{a}</p>
              </details>
            ))}
            <p className="m-0 text-sm"><Link href="/help" className="font-bold text-royal">{t("support.moreHelp")}</Link> · <Link href="/account/delete" className="font-bold text-royal">{t("support.deleteLink")}</Link> · <Link href="/privacy" className="font-bold text-royal">{t("support.privacy")}</Link></p>
          </section>
        </Container>
      </main>
      <SiteFooter />
      <CookieNotice />
    </div>
  );
}
