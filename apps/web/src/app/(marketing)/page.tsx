import Image from "next/image";
import Link from "next/link";
import { getT } from "@/i18n";
import { getMessage } from "@/i18n/shared";
import { MONEY_BACK_DAYS, PLANS } from "@/lib/config";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { Sticker } from "@/components/ui/Sticker";
import { Display, Eyebrow } from "@/components/ui/SectionHeading";
import { START_HREF } from "@/components/site/constants";
import { HeroVideo } from "@/components/marketing/HeroVideo";
import { FinalCta } from "@/components/marketing/FinalCta";
import { MEDIA } from "@/components/marketing/constants";
import { fill } from "@/components/marketing/format";
import { pageMetadata } from "@/components/marketing/meta";

export const generateMetadata = () => pageMetadata("home", "/");

type Item = { title: string; body: string; soon?: boolean };
type Occasion = { key: string; label: string; tag: string; alt: string };

/** Occasion card -> landing page (graduations and baby showers go straight to sign-up). */
const OCCASION_HREF: Record<string, string> = {
  wedding: "/for/wedding", birthday: "/for/birthday", henna: "/for/henna-night", family: "/for/house-party", nisan: "/for/engagement", sunnet: "/for/sunnet",
};
const OCCASION_IMAGE: Record<string, keyof typeof MEDIA> = {
  wedding: "wedding", birthday: "birthday", henna: "henna", family: "family", grad: "grad", baby: "baby", nisan: "couple",
};

const BENTO_LOOKS = [
  "bg-ink text-white", "bg-royal text-white", "bg-tint text-ink", "bg-tint text-ink", "bg-ink text-white", "bg-royal text-white",
];
const section = "py-16 sm:py-24 lg:py-28";

export default async function HomePage() {
  const { t, locale } = await getT("marketing");
  const stats = getMessage<{ value: string; label: string }[]>(locale, "marketing", "home.hero.stats");
  const occasions = getMessage<Occasion[]>(locale, "marketing", "home.occasions.items");
  const steps = getMessage<Item[]>(locale, "marketing", "home.how.steps");
  const bento = getMessage<Item[]>(locale, "marketing", "home.bento.items");
  const night = getMessage<Item[]>(locale, "marketing", "home.night.items");

  return (
    <>
      {/* HERO (header is rendered by the layout as the transparent overlay on this route) */}
      <section aria-label={t("home.hero.sticker")} className="relative flex min-h-[640px] flex-col bg-ink text-white sm:min-h-[860px] lg:min-h-[920px]">
        <HeroVideo poster={MEDIA.poster} className="absolute inset-0 size-full object-cover" />
        <div aria-hidden className="absolute inset-0 bg-ink/45" />
        <Container className="relative flex flex-1 flex-col justify-end gap-7 pb-12 pt-28 sm:gap-8 sm:pb-16 sm:pt-32">
          <Sticker caps rotate={-3} tone="royal" className="self-start">{t("home.hero.sticker")}</Sticker>
          <Display as="h1" size="hero" tone="dark" accent={t("home.hero.accent")} className="max-w-[1200px]">{t("home.hero.title")}</Display>
          <div className="flex flex-wrap items-end justify-between gap-7">
            <p className="m-0 max-w-[520px] text-lg leading-relaxed text-[#EEF0F6] sm:text-[21px]">{t("home.hero.sub")}</p>
            <div className="flex flex-wrap gap-3">
              <Button href={START_HREF} variant="light" size="lg">{t("home.hero.cta")}</Button>
              <Button href="/features" variant="ghost" size="lg">{t("home.hero.ctaSecondary")}</Button>
            </div>
          </div>
          <dl className="m-0 mt-3 flex flex-wrap gap-x-12 gap-y-4 border-t border-white/35 pt-6">
            {stats.map((s) => (
              <div key={s.label} className="flex flex-col-reverse">
                <dt className="text-[13px] text-[#D5D8E2]">{s.label}</dt>
                <dd className="m-0 text-[28px] font-black tracking-[-0.03em] sm:text-4xl">{fill(s.value, { days: MONEY_BACK_DAYS })}</dd>
              </div>
            ))}
          </dl>
        </Container>
      </section>

      {/* OCCASIONS */}
      <section className={section}>
        <Container className="flex flex-col gap-10 sm:gap-11">
          <div className="flex flex-wrap items-end justify-between gap-5">
            <Display size="xl" accent={t("home.occasions.accent")}>{t("home.occasions.title")}</Display>
            <p className="m-0 max-w-[380px] text-lg leading-relaxed text-text-2">{t("home.occasions.lead")}</p>
          </div>
          <ul className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(380px,100%),1fr))] gap-4 p-0">
            {occasions.map((o, i) => {
              const img = OCCASION_IMAGE[o.key];
              return (
                <li key={o.key}>
                  <Link
                    href={OCCASION_HREF[o.key] ?? START_HREF}
                    className="group relative block h-[300px] overflow-hidden rounded-[28px] bg-[#1B2440] text-white no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky focus-visible:ring-offset-2 sm:h-[380px]"
                  >
                    {img ? (
                      <Image src={MEDIA[img]} alt={o.alt} fill sizes="(min-width:1024px) 33vw, (min-width:640px) 50vw, 100vw" priority={i < 2} className="object-cover transition-transform duration-500 group-hover:scale-105" />
                    ) : (
                      <span aria-hidden className="absolute inset-0 flex items-start justify-end overflow-hidden bg-royal p-6">
                        <span className="font-serif text-[clamp(5rem,16vw,9rem)] leading-none text-white/25">Sünnet</span>
                      </span>
                    )}
                    <span aria-hidden className="absolute inset-x-0 bottom-0 h-[55%] bg-gradient-to-b from-ink/0 to-ink/80" />
                    <span className="absolute inset-x-5 bottom-5 flex items-end justify-between gap-3">
                      <span className="text-[28px] font-black leading-none tracking-[-0.035em] sm:text-4xl">{o.label}</span>
                      <span className="whitespace-nowrap rounded-full bg-white px-3 py-1.5 text-xs font-bold text-ink">{fill(o.tag, { days: PLANS.buyuk.maxDays })}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Container>
      </section>

      {/* SELFIE + STEPS */}
      <section className="bg-ink text-white">
        <Container className={`flex flex-wrap items-center gap-12 lg:gap-16 ${section}`}>
          <div className="relative min-w-0 flex-[1_1_440px]">
            <div className="relative aspect-[4/3] overflow-hidden rounded-[32px]">
              <Image src={MEDIA.selfie} alt={t("home.how.selfieAlt")} fill sizes="(min-width:1024px) 600px, 100vw" className="object-cover" />
            </div>
            <Sticker rotate={-6} tone="royal" className="absolute left-2 top-7 sm:-left-2.5 sm:text-sm">{t("home.how.uploaded")}</Sticker>
            <Sticker rotate={0} tone="white" className="absolute bottom-4 right-4 sm:text-sm">{t("home.how.loves")}</Sticker>
          </div>
          <div className="flex min-w-0 flex-[1_1_400px] flex-col gap-8">
            <Display size="lg" tone="dark" accent={t("home.how.accent")}>{t("home.how.title")}</Display>
            <ol className="m-0 flex list-none flex-col gap-5 p-0">
              {steps.map((s, i) => (
                <li key={s.title} className="flex items-start gap-4">
                  <span aria-hidden className="flex size-12 flex-none items-center justify-center rounded-full bg-royal text-[19px] font-extrabold">{i + 1}</span>
                  <div className="flex flex-col gap-1">
                    <h3 className="m-0 text-2xl font-extrabold tracking-[-0.03em]">{s.title}</h3>
                    <p className="m-0 text-[16.5px] leading-relaxed text-muted-dark">{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </Container>
      </section>

      {/* BENTO */}
      <section className={section}>
        <Container className="flex flex-col gap-10 sm:gap-11">
          <Display size="xl" accent={t("home.bento.accent")}>{t("home.bento.title")}</Display>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(380px,100%),1fr))] gap-4">
            {bento.map((f, i) => (
              <article key={f.title} className={`flex min-h-[200px] flex-col justify-end gap-3 rounded-[28px] p-7 sm:p-8 ${BENTO_LOOKS[i % BENTO_LOOKS.length]}`}>
                <h3 className="m-0 flex flex-wrap items-center gap-x-3 gap-y-2 text-[28px] font-extrabold leading-[1.05] tracking-[-0.035em]">
                  {f.title}
                  {f.soon ? <Sticker rotate={-3} tone="white" className="text-xs">{t("site.comingSoon")}</Sticker> : null}
                </h3>
                <p className="m-0 text-base leading-relaxed opacity-90">{f.body}</p>
              </article>
            ))}
          </div>
        </Container>
      </section>

      {/* HOW IT LOOKS ON THE NIGHT
          TODO(reviews): once pilot events are done, add a real testimonial section here with permission from the hosts.
          Do not invent customer quotes. */}
      <section className="bg-tint">
        <Container className={`flex flex-wrap items-center gap-12 lg:gap-16 ${section}`}>
          <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-8">
            <div className="flex flex-col gap-4">
              <Eyebrow className="text-royal">{t("home.night.eyebrow")}</Eyebrow>
              <Display size="lg" accent={t("home.night.accent")}>{t("home.night.title")}</Display>
            </div>
            <ol className="m-0 flex list-none flex-col gap-5 p-0">
              {night.map((s, i) => (
                <li key={s.title} className="flex items-start gap-4">
                  <span aria-hidden className="flex size-10 flex-none items-center justify-center rounded-full bg-ink text-base font-extrabold text-white">{i + 1}</span>
                  <div>
                    <h3 className="m-0 text-xl font-extrabold tracking-[-0.03em]">{s.title}</h3>
                    <p className="m-0 mt-1 text-[16.5px] leading-relaxed text-text-2">{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>
            <Button href="/features" variant="secondary" className="self-start">{t("home.night.cta")}</Button>
          </div>
          <div className="relative min-w-0 flex-[1_1_440px]">
            <div className="relative aspect-[4/3] overflow-hidden rounded-[32px]">
              <Image src={MEDIA.couple} alt={t("home.night.imageAlt")} fill sizes="(min-width:1024px) 600px, 100vw" className="object-cover grayscale" />
            </div>
            <Sticker rotate={4} tone="royal" className="absolute -top-3 right-4">{t("home.night.sticker")}</Sticker>
          </div>
        </Container>
      </section>

      <FinalCta id="start" title={t("home.cta.title")} accent={t("home.cta.accent")} cta={t("home.cta.cta")} href={START_HREF} note={t("home.cta.note", { days: MONEY_BACK_DAYS })} />
    </>
  );
}
