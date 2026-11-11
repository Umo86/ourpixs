import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getT } from "@/i18n";
import { MONEY_BACK_DAYS, OCCASIONS, PLANS } from "@/lib/config";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { Display } from "@/components/ui/SectionHeading";
import { Sticker } from "@/components/ui/Sticker";
import { START_HREF } from "@/components/site/constants";
import { FaqList } from "@/components/marketing/FaqList";
import { FinalCta } from "@/components/marketing/FinalCta";
import { MEDIA } from "@/components/marketing/constants";
import { formatGBP } from "@/components/marketing/format";
import { buildMetadata } from "@/components/marketing/meta";
import { OCCASION_PAGES, OCCASION_UI, getOccasionPage } from "@/content/occasions";

export const dynamicParams = false;
export function generateStaticParams() {
  return OCCASION_PAGES.map((o) => ({ occasion: o.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ occasion: string }> }) {
  const { occasion } = await params;
  const page = getOccasionPage(occasion);
  if (!page) return {};
  const { locale } = await getT("marketing");
  return buildMetadata({ title: page[locale].metaTitle, description: page[locale].metaDesc, path: `/for/${page.slug}` });
}

export default async function OccasionPage({ params }: { params: Promise<{ occasion: string }> }) {
  const { occasion } = await params;
  const page = getOccasionPage(occasion);
  if (!page) notFound();
  const { t, locale } = await getT("marketing");
  const c = page[locale];
  const ui = OCCASION_UI[locale];
  const moments = OCCASIONS[page.type].moments.map((m) => m[locale]);
  const plan = PLANS[page.plan];

  return (
    <>
      <section className="py-12 sm:py-16 lg:py-20">
        <Container className="flex flex-wrap items-center gap-10 lg:gap-14">
          <div className="flex min-w-0 flex-[1_1_460px] flex-col gap-6">
            <Sticker caps tone="royal" rotate={-2} className="self-start">{c.nav}</Sticker>
            <Display as="h1" size="xl" accent={c.accent}>{c.title}</Display>
            <p className="m-0 max-w-[560px] text-lg leading-relaxed text-text-2 sm:text-xl">{c.lead}</p>
            <div className="flex flex-wrap gap-3">
              <Button href={START_HREF} size="lg">{ui.start}</Button>
              <Button href="/demo" variant="secondary" size="lg">{ui.demo}</Button>
            </div>
            <p className="m-0 text-sm text-muted">
              {ui.planLabel}: <strong className="text-ink">{plan.name[locale]}</strong> · {formatGBP(plan.pricePence)}
              {plan.pricePence > 0 ? ` · ${t("pricing.guarantee", { days: MONEY_BACK_DAYS })}` : ""}
            </p>
          </div>
          <div className="relative aspect-[4/3] min-w-0 flex-[1_1_420px] overflow-hidden rounded-[32px]">
            <Image src={MEDIA[page.image]} alt={c.imageAlt} fill priority sizes="(min-width:1024px) 600px, 100vw" className="object-cover" />
          </div>
        </Container>
      </section>

      <section className="bg-ink text-white">
        <Container className="flex flex-col gap-8 py-16 sm:py-24">
          <Display size="lg" tone="dark" accent={ui.momentsAccent}>{ui.momentsTitle}</Display>
          <p className="m-0 max-w-[620px] text-lg leading-relaxed text-muted-dark">{c.momentsLead}</p>
          <ul className="m-0 flex list-none flex-wrap gap-3 p-0">
            {moments.map((m) => (
              <li key={m} className="rounded-full border border-[#2E2E2E] bg-surface px-5 py-3 text-base font-bold">{m}</li>
            ))}
          </ul>
        </Container>
      </section>

      <section className="py-16 sm:py-24">
        <Container className="flex flex-col gap-10">
          <Display size="lg" accent={ui.howAccent}>{ui.howTitle}</Display>
          <ol className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(280px,100%),1fr))] gap-6 p-0">
            {c.steps.map((s, i) => (
              <li key={s.title} className="flex items-start gap-4">
                <span aria-hidden className="flex size-12 flex-none items-center justify-center rounded-full bg-royal text-[19px] font-extrabold text-white">{i + 1}</span>
                <div>
                  <h3 className="m-0 text-2xl font-extrabold tracking-[-0.03em]">{s.title}</h3>
                  <p className="m-0 mt-1 text-[16.5px] leading-relaxed text-text-2">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      <section className="bg-tint">
        <Container size="narrow" className="flex flex-col gap-8 py-16 sm:py-24">
          <Display size="md" accent={ui.faqAccent}>{ui.faqTitle}</Display>
          <FaqList items={c.faq} />
          <nav aria-label={ui.others} className="flex flex-wrap items-center gap-2 pt-4">
            <span className="mr-2 text-sm font-bold">{ui.others}:</span>
            {OCCASION_PAGES.filter((o) => o.slug !== page.slug).map((o) => (
              <Link key={o.slug} href={`/for/${o.slug}`} className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-ink no-underline hover:bg-ink hover:text-white">{o[locale].nav}</Link>
            ))}
          </nav>
        </Container>
      </section>

      <FinalCta title={c.ctaTitle} accent={c.ctaAccent} cta={ui.start} href={START_HREF} note={t("home.cta.note", { days: MONEY_BACK_DAYS })} />
    </>
  );
}
