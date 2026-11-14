import { getBrand, getT } from "@/i18n";
import { getMessage } from "@/i18n/shared";
import { BRANDS, MAIN_BRAND, SUPPORT_EMAIL } from "@/lib/config";
import { getSettings } from "@/lib/settings";
import { pricingVars } from "@/components/marketing/format";
import { LegalPage, type LegalSection } from "@/components/marketing/LegalPage";
import { fill } from "@/components/marketing/format";
import { pageMetadata } from "@/components/marketing/meta";

export const generateMetadata = () => pageMetadata("terms", "/terms");

// TODO(legal): English law only. Have these terms reviewed by a solicitor before launch (CCR 2013 cancellation wording for the
// event package and guest downloads, liability cap, retention). Sections changed for the event package and the consumer launch
// have `review: true` in messages/*/marketing.json and show the "Updated · to be checked" badge until reviewed.
export default async function TermsPage() {
  const [{ t, locale }, brand, settings] = await Promise.all([getT("marketing"), getBrand(), getSettings()]);
  // The service is BizimResimler on every domain; ourpixs.com is named as its English alias.
  const vars = { ...pricingVars(SUPPORT_EMAIL[brand], settings), brand: BRANDS[MAIN_BRAND].name, alias: BRANDS.ourpixs.name, aliasDomain: BRANDS.ourpixs.domain };
  const sections = getMessage<LegalSection[]>(locale, "marketing", "terms.sections").map((s) => ({
    h: s.h, p: s.p?.map((x) => fill(x, vars)), list: s.list?.map((x) => fill(x, vars)), review: s.review,
  }));
  return <LegalPage title={t("terms.title")} accent={t("terms.accent")} updated={t("legal.updated")} intro={t("terms.intro", vars)} sections={sections} reviewLabel={t("legal.review")} />;
}
