import { getBrand, getT } from "@/i18n";
import { getMessage } from "@/i18n/shared";
import { BRANDS, PARTNER_PENCE, SUPPORT_EMAIL } from "@/lib/config";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { Sticker } from "@/components/ui/Sticker";
import { Display, Eyebrow } from "@/components/ui/SectionHeading";
import { PartnerForm } from "@/components/marketing/PartnerForm";
import { SampleAlbum } from "@/components/marketing/SampleAlbum";
import { fill, formatGBP } from "@/components/marketing/format";
import { ROI_EXAMPLE_PENCE } from "@/components/marketing/constants";
import { pageMetadata } from "@/components/marketing/meta";

export const generateMetadata = () => pageMetadata("partners", "/partners");

type Item = { title: string; body: string };
const section = "py-16 sm:py-24";

export default async function PartnersPage() {
  const [{ t, locale }, brand] = await Promise.all([getT("marketing"), getBrand()]);
  const benefits = getMessage<Item[]>(locale, "marketing", "partners.benefits");
  const branding = getMessage<(Item & { example: string })[]>(locale, "marketing", "partners.branding");
  const who = getMessage<Item[]>(locale, "marketing", "partners.who");
  const steps = getMessage<Item[]>(locale, "marketing", "partners.steps");
  const events = Math.ceil(PARTNER_PENCE / ROI_EXAMPLE_PENCE);
  const platform = BRANDS[brand].name;

  return (
    <>
      <section className="py-14 sm:py-20 lg:py-24">
        <Container className="flex flex-wrap items-end justify-between gap-10">
          <div className="flex min-w-0 flex-[1_1_560px] flex-col gap-7">
            <Sticker caps tone="royal" rotate={-2} className="self-start">{t("partners.sticker")}</Sticker>
            <Display as="h1" size="xl" accent={t("partners.accent")}>{t("partners.title")}</Display>
            <p className="m-0 max-w-[620px] text-lg leading-relaxed text-text-2 sm:text-[21px]">{t("partners.lead")}</p>
            <div className="flex flex-wrap gap-3">
              <Button href="#enquiry" size="lg">{t("partners.cta")}</Button>
              <Button href="/pricing" variant="secondary" size="lg">{t("partners.ctaSecondary")}</Button>
            </div>
          </div>
          <div className="flex min-w-0 flex-[0_1_380px] flex-col gap-3 rounded-[28px] bg-ink p-8 text-white sm:p-10">
            <span className="text-[13px] font-bold uppercase tracking-[0.16em] text-sky-soft">{t("partners.priceKicker")}</span>
            <p className="m-0 flex items-baseline gap-2">
              <span className="text-[clamp(3.5rem,7vw,5.25rem)] font-black leading-none tracking-[-0.05em]">{formatGBP(PARTNER_PENCE)}</span>
              <span className="text-lg text-muted-dark">{t("partners.perMonth")}</span>
            </p>
            <p className="m-0 font-bold">{t("partners.priceNote")}</p>
            <p className="m-0 text-muted-dark">{t("partners.priceFine")}</p>
          </div>
        </Container>
      </section>

      <section className="bg-ink text-white">
        <Container className={`flex flex-col gap-10 ${section}`}>
          <Display size="lg" tone="dark" accent={t("partners.benefitsAccent")}>{t("partners.benefitsTitle")}</Display>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(300px,100%),1fr))] gap-4">
            {benefits.map((b) => (
              <article key={b.title} className="flex flex-col gap-2.5 rounded-3xl border border-[#2E2E2E] p-6 sm:p-7">
                <h3 className="m-0 text-[22px] font-extrabold tracking-[-0.03em]">{b.title}</h3>
                <p className="m-0 text-[15.5px] leading-relaxed text-muted-dark">{fill(b.body, { platform })}</p>
              </article>
            ))}
          </div>
        </Container>
      </section>

      <section className={section}>
        <Container className="flex flex-col gap-10">
          <div className="flex flex-col gap-4">
            <Display size="lg" accent={t("partners.brandingAccent")}>{t("partners.brandingTitle")}</Display>
            <p className="m-0 max-w-[560px] text-lg leading-relaxed text-text-2">{t("partners.brandingLead")}</p>
          </div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(300px,100%),1fr))] gap-4">
            {branding.map((b, i) => (
              <article key={b.title} className={`flex min-h-[240px] flex-col justify-end gap-3 rounded-[28px] p-7 sm:p-8 ${i === 2 ? "bg-royal text-white" : "bg-tint"}`}>
                <p className="m-0 font-serif text-2xl">{b.example}</p>
                <h3 className="m-0 text-[28px] font-extrabold leading-[1.05] tracking-[-0.035em]">{b.title}</h3>
                <p className="m-0 text-base leading-relaxed opacity-90">{b.body}</p>
              </article>
            ))}
          </div>
        </Container>
      </section>

      <section className="bg-tint">
        <Container className={`flex flex-wrap items-center gap-12 lg:gap-16 ${section}`}>
          <div className="flex min-w-0 flex-[1_1_380px] flex-col gap-5">
            <Eyebrow className="text-royal">{t("partners.sample.eyebrow")}</Eyebrow>
            <Display size="lg" accent={t("partners.sample.accent")}>{t("partners.sample.title")}</Display>
            <p className="m-0 max-w-[480px] text-lg leading-relaxed text-text-2">{t("partners.sample.body")}</p>
          </div>
          <div className="min-w-0 flex-[1_1_340px]">
            <SampleAlbum
              logo={t("partners.sample.logo")} venue={t("partners.sample.venue")} album={t("partners.sample.album")}
              at={t("partners.sample.at")} by={t("partners.sample.by")} alt={t("partners.sample.alt")}
            />
          </div>
        </Container>
      </section>

      <section className={section}>
        <Container className="flex flex-wrap items-center gap-10 lg:gap-16">
          <div className="min-w-0 flex-[1_1_380px]">
            <Display size="lg" accent={t("partners.roiAccent")}>{t("partners.roiTitle")}</Display>
          </div>
          <div className="flex min-w-0 flex-[1_1_380px] flex-col gap-3">
            <p className="m-0 text-xl leading-relaxed sm:text-2xl">
              {t("partners.roiBody", { price: formatGBP(ROI_EXAMPLE_PENCE), events })}
            </p>
            <p className="m-0 text-sm text-muted">{t("partners.roiNote")}</p>
          </div>
        </Container>
      </section>

      <section className="bg-tint">
        <Container className={`flex flex-col gap-10 ${section}`}>
          <Display size="lg" accent={t("partners.whoAccent")}>{t("partners.whoTitle")}</Display>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(260px,100%),1fr))] gap-4">
            {who.map((w) => (
              <article key={w.title} className="flex min-h-[180px] flex-col justify-end gap-3 rounded-[28px] bg-white p-7">
                <h3 className="m-0 text-[24px] font-extrabold leading-[1.05] tracking-[-0.035em]">{w.title}</h3>
                <p className="m-0 text-base leading-relaxed text-text-2">{w.body}</p>
              </article>
            ))}
          </div>
        </Container>
      </section>

      <section className={section}>
        <Container className="flex flex-col gap-10">
          <Display size="lg" accent={t("partners.stepsAccent")}>{t("partners.stepsTitle")}</Display>
          <ol className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(280px,100%),1fr))] gap-6 p-0">
            {steps.map((s, i) => (
              <li key={s.title} className="flex items-start gap-4">
                <span aria-hidden className="flex size-12 flex-none items-center justify-center rounded-full bg-royal text-[19px] font-extrabold text-white">{i + 1}</span>
                <div>
                  <h3 className="m-0 text-2xl font-extrabold tracking-[-0.03em]">{s.title}</h3>
                  <p className="m-0 mt-1 text-[16.5px] leading-relaxed text-text-2">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="rounded-[28px] bg-ink p-7 text-white sm:p-8">
            <h3 className="m-0 text-2xl font-extrabold tracking-[-0.03em]">{t("partners.referral.title")}</h3>
            <p className="m-0 mt-1 text-muted-dark">{t("partners.referral.body")}</p>
          </div>
        </Container>
      </section>

      <section id="enquiry" className="scroll-mt-4 bg-royal text-white">
        <Container className={`flex flex-wrap gap-10 lg:gap-16 ${section}`}>
          <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-5">
            <Display size="lg" tone="blue" accent={t("partners.formAccent")}>{t("partners.formTitle")}</Display>
            <p className="m-0 max-w-[420px] text-lg leading-relaxed text-white/90">{t("partners.formLead")}</p>
            <p className="m-0 max-w-[420px] text-white/90">{t("partners.form.emailLine", { email: SUPPORT_EMAIL[brand] })}</p>
          </div>
          <div className="min-w-0 flex-[2_1_480px] text-ink">
            <PartnerForm kind="partner" />
          </div>
        </Container>
      </section>
    </>
  );
}
