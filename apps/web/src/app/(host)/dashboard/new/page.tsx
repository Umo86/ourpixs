import type { Metadata } from "next";
import { Container } from "@/components/ui";
import { getT } from "@/i18n";
import { requireHostPage } from "@/lib/auth";
import { NewOccasionWizard } from "@/components/host/NewOccasionWizard";
import { TEMPLATES } from "@/content/templates";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT("host");
  return { title: t("wizard.metaTitle") };
}

export default async function NewOccasionPage({ searchParams }: { searchParams: Promise<{ template?: string }> }) {
  await requireHostPage("/dashboard/new");
  const wanted = (await searchParams).template;
  const template = TEMPLATES.find((x) => x.id === wanted);
  return (
    <Container size="narrow" className="py-8 sm:py-12">
      <NewOccasionWizard templateId={template?.id} initialTheme={template?.theme} />
    </Container>
  );
}
