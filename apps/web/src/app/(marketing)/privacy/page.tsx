import { getBrand, getT } from "@/i18n";
import { getMessage } from "@/i18n/shared";
import { BRANDS, MAIN_BRAND, SUPPORT_EMAIL } from "@/lib/config";
import { getSettings } from "@/lib/settings";
import { LegalPage, type LegalSection } from "@/components/marketing/LegalPage";
import { fill, pricingVars } from "@/components/marketing/format";
import { pageMetadata } from "@/components/marketing/meta";

export const generateMetadata = () => pageMetadata("privacy", "/privacy");

// TODO(legal): UK GDPR / DPA 2018 / PECR only. Fill the [COMPANY NAME], [COMPANY NUMBER], [REGISTERED ADDRESS] and [ICO REGISTRATION NUMBER] placeholders (in messages/*/marketing.json) and have this policy reviewed by a solicitor / DPO before launch.
export default async function PrivacyPage() {
  const [{ t, locale }, brand, settings] = await Promise.all([getT("marketing"), getBrand(), getSettings()]);
  // The service is BizimResimler on every domain; ourpixs.com is named as its English alias.
  const vars = { ...pricingVars(SUPPORT_EMAIL[brand], settings), brand: BRANDS[MAIN_BRAND].name, alias: BRANDS.ourpixs.name, aliasDomain: BRANDS.ourpixs.domain };
  const sections = getMessage<LegalSection[]>(locale, "marketing", "privacy.sections").map((s) => ({
    h: s.h, p: s.p?.map((x) => fill(x, vars)), list: s.list?.map((x) => fill(x, vars)), review: s.review,
  }));
  return <LegalPage title={t("privacy.title")} accent={t("privacy.accent")} updated={t("legal.updated")} intro={t("privacy.intro", vars)} sections={sections} reviewLabel={t("legal.review")} />;
}
