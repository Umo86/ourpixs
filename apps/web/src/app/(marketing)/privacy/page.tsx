import { getBrand, getT } from "@/i18n";
import { getMessage } from "@/i18n/shared";
import { BRANDS, MONEY_BACK_DAYS, PLANS, SUPPORT_EMAIL } from "@/lib/config";
import { LegalPage, type LegalSection } from "@/components/marketing/LegalPage";
import { fill, formatStorage } from "@/components/marketing/format";
import { pageMetadata } from "@/components/marketing/meta";

export const generateMetadata = () => pageMetadata("privacy", "/privacy");

// TODO(legal): UK GDPR / DPA 2018 / PECR only. Fill the [COMPANY NAME], [COMPANY NUMBER], [REGISTERED ADDRESS] and [ICO REGISTRATION NUMBER] placeholders (in messages/*/marketing.json) and have this policy reviewed by a solicitor / DPO before launch.
export default async function PrivacyPage() {
  const [{ t, locale }, brand] = await Promise.all([getT("marketing"), getBrand()]);
  const vars = { brand: BRANDS[brand].name, email: SUPPORT_EMAIL[brand], days: MONEY_BACK_DAYS,
    freeStorage: formatStorage(PLANS.free.storageDays, locale), tekStorage: formatStorage(PLANS.tek.storageDays, locale), bigStorage: formatStorage(PLANS.buyuk.storageDays, locale) };
  const sections = getMessage<LegalSection[]>(locale, "marketing", "privacy.sections").map((s) => ({
    h: s.h, p: s.p?.map((x) => fill(x, vars)), list: s.list?.map((x) => fill(x, vars)),
  }));
  return <LegalPage title={t("privacy.title")} accent={t("privacy.accent")} updated={t("legal.updated")} intro={t("privacy.intro", vars)} sections={sections} />;
}
