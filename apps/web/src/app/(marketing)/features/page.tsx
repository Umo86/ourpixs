import { getT } from "@/i18n";
import { getMessage } from "@/i18n/shared";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { Sticker } from "@/components/ui/Sticker";
import { Display, Eyebrow } from "@/components/ui/SectionHeading";
import { START_HREF } from "@/components/site/constants";
import { pageMetadata } from "@/components/marketing/meta";

export const generateMetadata = () => pageMetadata("features", "/features");

type Group = { kicker: string; title: string; accent: string; items: { title: string; body: string; soon?: boolean }[] };
const LOOKS = [
  { wrap: "bg-tint text-ink", tone: "light" as const, card: "bg-white", num: "text-royal" },
  { wrap: "bg-ink text-white", tone: "dark" as const, card: "border border-[#2E2E2E]", num: "text-sky-soft" },
  { wrap: "bg-royal text-white", tone: "blue" as const, card: "bg-royal-dark", num: "text-[#C9D3FF]" },
];

export default async function FeaturesPage() {
  const { t, locale } = await getT("marketing");
  const groups = getMessage<Group[]>(locale, "marketing", "features.groups");
  let n = 0;
  return (
    <>
      <section className="py-14 sm:py-20 lg:py-24">
        <Container className="flex flex-col gap-7">
          <Sticker caps tone="ink" rotate={-2} className="self-start">{t("features.sticker", { count: groups.reduce((n, g) => n + g.items.length, 0) })}</Sticker>
          <Display as="h1" size="hero" accent={t("features.accent")} className="max-w-[1200px] text-[clamp(2.9rem,9vw,7.5rem)]!">{t("features.title")}</Display>
          <p className="m-0 max-w-[620px] text-lg leading-relaxed text-text-2 sm:text-[21px]">{t("features.lead")}</p>
        </Container>
      </section>

      {groups.map((g, gi) => {
        const look = LOOKS[gi % LOOKS.length];
        return (
          <section key={g.kicker} className={look.wrap}>
            <Container className="flex flex-wrap gap-10 py-16 sm:py-24 lg:gap-12">
              <div className="flex min-w-0 flex-[1_1_280px] flex-col gap-3.5">
                <Eyebrow className="opacity-75">{g.kicker}</Eyebrow>
                <Display size="md" tone={look.tone} accent={g.accent}>{g.title}</Display>
              </div>
              <div className="grid min-w-0 flex-[2_1_600px] grid-cols-[repeat(auto-fit,minmax(min(280px,100%),1fr))] gap-4">
                {g.items.map((f) => (
                  <article key={f.title} className={`flex flex-col gap-2.5 rounded-3xl p-6 sm:p-7 ${look.card}`}>
                    <span className={`text-[13px] font-extrabold tracking-wider ${look.num}`}>{String(++n).padStart(2, "0")}</span>
                    <h3 className="m-0 flex flex-wrap items-center gap-x-3 gap-y-2 text-[22px] font-extrabold tracking-[-0.03em]">
                      {f.title}
                      {f.soon ? <Sticker rotate={-3} tone="white" className="!px-3 !py-1 text-[11px]">{t("site.comingSoon")}</Sticker> : null}
                    </h3>
                    <p className="m-0 text-[15.5px] leading-relaxed opacity-85">{f.body}</p>
                  </article>
                ))}
              </div>
            </Container>
          </section>
        );
      })}

      <section>
        <Container className="flex flex-col items-center gap-8 py-20 text-center sm:py-28">
          <Display size="xl" accent={t("features.cta.accent")}>{t("features.cta.title")}</Display>
          <div className="flex flex-wrap justify-center gap-3">
            <Button href={START_HREF} size="lg">{t("features.cta.primary")}</Button>
            <Button href="/pricing" variant="secondary" size="lg">{t("features.cta.secondary")}</Button>
          </div>
        </Container>
      </section>
    </>
  );
}
