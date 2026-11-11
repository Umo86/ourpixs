import type { Metadata } from "next";
import { Container } from "@/components/ui";
import { getT } from "@/i18n";
import { requireHostPage } from "@/lib/auth";
import { NewOccasionWizard } from "@/components/host/NewOccasionWizard";
import { TEMPLATES } from "@/content/templates";
import { computeAccess } from "@/lib/access";
import { paymentsEnabled } from "@/lib/stripe";
import { SUBSCRIPTION } from "@/lib/config";
import { formatGBP } from "@/components/marketing/format";
import { SubscribeButtons } from "@/components/host/Billing";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT("host");
  return { title: t("wizard.metaTitle") };
}

export default async function NewOccasionPage({ searchParams }: { searchParams: Promise<{ template?: string }> }) {
  const host = await requireHostPage("/dashboard/new");
  if (!computeAccess(host).canCreateEvents) {
    const { t } = await getT("host");
    return (
      <Container size="narrow" className="flex flex-col gap-6 py-8 sm:py-12">
        <h1 className="m-0 text-[clamp(2.2rem,6vw,3.6rem)] font-black leading-[0.95] tracking-[-0.04em]">{t("wizard.blockedTitle")} <span className="font-serif text-royal">{t("wizard.blockedAccent")}</span></h1>
        <p className="m-0 max-w-xl text-lg text-text-2">{t("wizard.blockedBody", { monthly: formatGBP(SUBSCRIPTION.monthlyPence), yearly: formatGBP(SUBSCRIPTION.yearlyPence) })}</p>
        <SubscribeButtons payments={paymentsEnabled()} size="lg" />
      </Container>
    );
  }
  const wanted = (await searchParams).template;
  const template = TEMPLATES.find((x) => x.id === wanted);
  return (
    <Container size="narrow" className="py-8 sm:py-12">
      <NewOccasionWizard templateId={template?.id} initialTheme={template?.theme} />
    </Container>
  );
}
