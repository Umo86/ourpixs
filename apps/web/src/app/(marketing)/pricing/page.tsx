import { getBrand, getT } from "@/i18n";
import { getMessage } from "@/i18n/shared";
import { MONEY_BACK_DAYS, PARTNER_PENCE, PLANS, SUPPORT_EMAIL, UPGRADE_TEK_TO_BUYUK_PENCE, type Plan } from "@/lib/config";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { Sticker } from "@/components/ui/Sticker";
import { Display, Eyebrow } from "@/components/ui/SectionHeading";
import { START_HREF } from "@/components/site/constants";
import { FaqList } from "@/components/marketing/FaqList";
import { fill, formatGBP, formatStorage } from "@/components/marketing/format";
import { pageMetadata } from "@/components/marketing/meta";

export const generateMetadata = () => pageMetadata("pricing", "/pricing");

const ORDER: Plan[] = ["free", "tek", "buyuk"];
const CARD: Record<Plan, { box: string; btn: "secondary" | "dark" | "light"; btnCls: string; muted: string }> = {
  free: { box: "bg-white", btn: "secondary", btnCls: "", muted: "text-text-2" },
  tek: { box: "bg-white", btn: "dark", btnCls: "", muted: "text-text-2" },
  buyuk: { box: "bg-royal text-white", btn: "light", btnCls: "text-royal!", muted: "text-white/85" },
};

export default async function PricingPage() {
  const [{ t, locale }, brand] = await Promise.all([getT("marketing"), getBrand()]);
  const faq = getMessage<{ q: string; a: string }[]>(locale, "marketing", "pricing.faq");
  const tekName = PLANS.tek.name[locale];
  const bigName = PLANS.buyuk.name[locale];

  const vars = (p: Plan) => ({
    name: PLANS[p].name[locale],
    days: PLANS[p].maxDays,
    media: PLANS[p].maxMedia ?? "",
    minutes: Math.round(PLANS[p].maxVideoSeconds / 60),
    storage: formatStorage(PLANS[p].storageDays, locale),
    tekName,
  });

  return (
    <div className="bg-tint">
      <section>
        <Container className="flex flex-col items-center gap-5 pb-12 pt-6 text-center sm:pb-14 sm:pt-12">
          <Display as="h1" size="hero" accent={t("pricing.accent")} className="text-[clamp(2.7rem,8.8vw,7rem)]!">{t("pricing.title")}</Display>
          <p className="m-0 max-w-[560px] text-lg leading-relaxed text-text-2 sm:text-xl">{t("pricing.lead")}</p>
        </Container>
      </section>

      <section>
        <Container className="grid grid-cols-[repeat(auto-fit,minmax(min(290px,100%),1fr))] items-stretch gap-5 pb-16 pt-4 sm:pb-24">
          {ORDER.map((p) => {
            const c = CARD[p];
            const items = getMessage<string[]>(locale, "marketing", `pricing.plans.${p}.items`);
            return (
              <div key={p} className={`relative flex flex-col gap-4 rounded-[28px] p-7 sm:p-10 ${c.box}`}>
                {p === "buyuk" ? <Sticker rotate={4} tone="ink" className="absolute -top-4 right-7">{t("pricing.badge")}</Sticker> : null}
                <h2 className="m-0 text-[22px] font-extrabold">{PLANS[p].name[locale]}</h2>
                <p className="m-0 text-[clamp(3.5rem,7vw,5.25rem)] font-black leading-none tracking-[-0.05em]">{formatGBP(PLANS[p].pricePence)}</p>
                <p className={`m-0 text-[15px] ${c.muted}`}>{t(`pricing.plans.${p}.note`)}</p>
                <ul className="m-0 flex list-disc flex-col gap-2.5 pl-5 text-base leading-snug">
                  {items.map((i) => <li key={i}>{fill(i, vars(p))}</li>)}
                </ul>
                <Button href={START_HREF} variant={c.btn} size="lg" className={`mt-auto w-full ${c.btnCls}`}>
                  {fill(t(`pricing.plans.${p}.cta`), vars(p))}
                </Button>
                {p !== "free" ? <p className={`m-0 text-center text-[13px] font-semibold ${c.muted}`}>{t("pricing.guarantee", { days: MONEY_BACK_DAYS })}</p> : null}
              </div>
            );
          })}
        </Container>
      </section>

      <section className="bg-ink text-white">
        <Container className="flex flex-wrap items-center justify-between gap-8 py-16 sm:py-20">
          <div className="flex min-w-0 flex-[1_1_480px] flex-col gap-3.5">
            <Eyebrow className="text-sky-soft">{t("pricing.partner.kicker", { price: formatGBP(PARTNER_PENCE) })}</Eyebrow>
            <Display size="md" tone="dark" accent={t("pricing.partner.accent")}>{t("pricing.partner.title")}</Display>
            <p className="m-0 max-w-[560px] text-lg leading-relaxed text-muted-dark">{t("pricing.partner.body")}</p>
          </div>
          <Button href="/partners" variant="light" size="lg">{t("pricing.partner.cta")}</Button>
        </Container>
      </section>

      <section className="bg-white">
        <Container size="narrow" className="flex flex-col gap-8 py-16 sm:py-24">
          <Display size="md" accent={t("pricing.faqAccent")}>{t("pricing.faqTitle")}</Display>
          <FaqList items={faq.map((f) => ({ q: f.q, a: fill(f.a, { tekName, bigName, upgrade: formatGBP(UPGRADE_TEK_TO_BUYUK_PENCE), days: MONEY_BACK_DAYS, email: SUPPORT_EMAIL[brand] }) }))} />
        </Container>
      </section>
    </div>
  );
}
