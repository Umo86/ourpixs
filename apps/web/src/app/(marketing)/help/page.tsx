import { getBrand, getT } from "@/i18n";
import { MONEY_BACK_DAYS, SUBSCRIPTION, SUPPORT_EMAIL, YEARLY_SAVING_PERCENT } from "@/lib/config";
import { Container } from "@/components/ui/Container";
import { Display } from "@/components/ui/SectionHeading";
import { HelpCentre } from "@/components/marketing/HelpCentre";
import { formatGBP } from "@/components/marketing/format";
import { buildMetadata } from "@/components/marketing/meta";
import { HELP_UI, helpGroups } from "@/content/help";

export async function generateMetadata() {
  const { locale } = await getT("marketing");
  return buildMetadata({ title: HELP_UI[locale].metaTitle, description: HELP_UI[locale].metaDesc, path: "/help" });
}

export default async function HelpPage() {
  const [{ locale }, brand] = await Promise.all([getT("marketing"), getBrand()]);
  const ui = HELP_UI[locale];
  const email = SUPPORT_EMAIL[brand];
  const groups = helpGroups(locale, { days: MONEY_BACK_DAYS, email, monthly: formatGBP(SUBSCRIPTION.monthlyPence), yearly: formatGBP(SUBSCRIPTION.yearlyPence), saving: YEARLY_SAVING_PERCENT });
  return (
    <Container size="narrow" className="flex flex-col gap-10 py-14 sm:py-20">
      <div className="flex flex-col gap-5">
        <Display as="h1" size="xl" accent={ui.accent}>{ui.title}</Display>
        <p className="m-0 max-w-[560px] text-lg leading-relaxed text-text-2">{ui.lead}</p>
      </div>
      <HelpCentre groups={groups} labels={{ search: ui.search, placeholder: ui.placeholder, none: ui.none, contact: ui.contact, email, count: ui.count }} />
    </Container>
  );
}
