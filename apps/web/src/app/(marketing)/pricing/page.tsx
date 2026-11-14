import { getBrand, getT } from "@/i18n";
import { getMessage } from "@/i18n/shared";
import { SUPPORT_EMAIL } from "@/lib/config";
import { getSettings } from "@/lib/settings";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { Sticker } from "@/components/ui/Sticker";
import { Display } from "@/components/ui/SectionHeading";
import { START_HREF } from "@/components/site/constants";
import { FaqList } from "@/components/marketing/FaqList";
import { fill, pricingVars } from "@/components/marketing/format";
import { pageMetadata } from "@/components/marketing/meta";

export const generateMetadata = () => pageMetadata("pricing", "/pricing");

export default async function PricingPage() {
  const [{ t, locale }, brand, settings] = await Promise.all([getT("marketing"), getBrand(), getSettings()]);
  const vars = pricingVars(SUPPORT_EMAIL[brand], settings);
  const faq = getMessage<{ q: string; a: string }[]>(locale, "marketing", "pricing.faq");
  const items = getMessage<string[]>(locale, "marketing", "pricing.items");
  const guestItems = getMessage<string[]>(locale, "marketing", "pricing.guests.items");

  return (
    <div className="bg-tint">
      <section>
        <Container className="flex flex-col items-center gap-5 pb-10 pt-6 text-center sm:pb-12 sm:pt-12">
          <Display as="h1" size="hero" accent={t("pricing.accent")} className="text-[clamp(2.7rem,8.8vw,7rem)]!">{t("pricing.title")}</Display>
          <p className="m-0 max-w-[640px] text-lg leading-relaxed text-text-2 sm:text-xl">{fill(t("pricing.lead"), vars)}</p>
        </Container>
      </section>

      <section>
        <Container size="narrow" className="pb-6">
          <div className="flex flex-col items-start gap-3 rounded-[28px] bg-ink p-7 text-white sm:flex-row sm:items-center sm:justify-between sm:p-8">
            <div className="flex flex-col gap-2">
              <Sticker rotate={-3} className="self-start">{fill(t("pricing.freeSetup.sticker"), vars)}</Sticker>
              <p className="m-0 max-w-[560px] text-[17px] leading-relaxed text-muted-dark">{fill(t("pricing.freeSetup.body"), vars)}</p>
            </div>
            <Button href={START_HREF} variant="light" size="lg">{t("pricing.freeSetup.cta")}</Button>
          </div>
        </Container>
      </section>

      <section>
        <Container size="narrow" className="grid grid-cols-[repeat(auto-fit,minmax(min(290px,100%),1fr))] items-stretch gap-5 pb-16 pt-4 sm:pb-24">
          <div className="relative flex flex-col gap-4 rounded-[28px] bg-royal p-7 text-white sm:p-10">
            <Sticker rotate={4} tone="ink" className="absolute -top-4 right-7">{fill(t("pricing.package.sticker"), vars)}</Sticker>
            <h2 className="m-0 text-[22px] font-extrabold">{t("pricing.package.name")}</h2>
            <p className="m-0 flex items-baseline gap-2">
              <span className="text-[clamp(3.2rem,7vw,4.75rem)] font-black leading-none tracking-[-0.05em]">{vars.price}</span>
              <span className="text-lg font-bold text-white/85">{t("pricing.perEvent")}</span>
            </p>
            <p className="m-0 text-[15px] text-white/85">{fill(t("pricing.package.note"), vars)}</p>
            <ul className="m-0 flex list-disc flex-col gap-2.5 pl-5 text-base leading-snug">
              {items.map((i) => <li key={i}>{fill(i, vars)}</li>)}
            </ul>
            <Button href={START_HREF} variant="light" size="lg" className="mt-auto w-full text-royal!">{t("pricing.package.cta")}</Button>
            <p className="m-0 text-center text-[13px] font-semibold text-white/85">{fill(t("pricing.guarantee"), vars)}</p>
          </div>
          <div className="relative flex flex-col gap-4 rounded-[28px] bg-white p-7 sm:p-10">
            <h2 className="m-0 text-[22px] font-extrabold">{t("pricing.guests.name")}</h2>
            <p className="m-0 flex items-baseline gap-2">
              <span className="text-[clamp(3.2rem,7vw,4.75rem)] font-black leading-none tracking-[-0.05em]">{vars.guestPrice}</span>
              <span className="text-lg font-bold text-text-2">{t("pricing.guests.per")}</span>
            </p>
            <p className="m-0 text-[15px] text-text-2">{fill(t("pricing.guests.note"), vars)}</p>
            <ul className="m-0 flex list-disc flex-col gap-2.5 pl-5 text-base leading-snug">
              {guestItems.map((i) => <li key={i}>{fill(i, vars)}</li>)}
            </ul>
            <Button href="/demo" variant="dark" size="lg" className="mt-auto w-full">{t("pricing.guests.cta")}</Button>
          </div>
          <p className="col-span-full m-0 text-center text-sm text-muted">{fill(t("pricing.vat"), vars)}</p>
        </Container>
      </section>

      <section className="bg-white">
        <Container size="narrow" className="flex flex-col gap-8 py-16 sm:py-24">
          <Display size="md" accent={t("pricing.faqAccent")}>{t("pricing.faqTitle")}</Display>
          <FaqList items={faq.map((f) => ({ q: fill(f.q, vars), a: fill(f.a, vars) }))} />
        </Container>
      </section>
    </div>
  );
}
