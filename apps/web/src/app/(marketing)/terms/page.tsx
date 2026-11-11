import { getBrand, getT } from "@/i18n";
import { getMessage } from "@/i18n/shared";
import { BRANDS, SUPPORT_EMAIL } from "@/lib/config";
import { pricingVars } from "@/components/marketing/format";
import { LegalPage, type LegalSection } from "@/components/marketing/LegalPage";
import { fill } from "@/components/marketing/format";
import { pageMetadata } from "@/components/marketing/meta";

export const generateMetadata = () => pageMetadata("terms", "/terms");

// TODO(legal): English law only. Have these terms reviewed by a solicitor before launch (CCR 2013 cancellation wording, liability cap, subscription and auto-renewal terms).
export default async function TermsPage() {
  const [{ t, locale }, brand] = await Promise.all([getT("marketing"), getBrand()]);
  const vars = { ...pricingVars(SUPPORT_EMAIL[brand]), brand: BRANDS[brand].name };
  const sections = getMessage<LegalSection[]>(locale, "marketing", "terms.sections").map((s) => ({
    h: s.h, p: s.p?.map((x) => fill(x, vars)), list: s.list?.map((x) => fill(x, vars)),
  }));
  return <LegalPage title={t("terms.title")} accent={t("terms.accent")} updated={t("legal.updated")} intro={t("terms.intro", vars)} sections={sections} />;
}
