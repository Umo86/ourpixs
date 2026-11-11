import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui";
import { getT } from "@/i18n";
import { requireMemberPage } from "@/lib/auth";
import { planOf } from "@/lib/occasion";
import { MissionsClient } from "@/components/host/MissionsClient";
import { UpsellCard } from "@/components/host/UpsellCard";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT("host");
  return { title: t("missions.metaTitle") };
}

export default async function MissionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = await requireMemberPage(id);
  if (!m) notFound();
  const { t } = await getT("host");
  const enabled = planOf(m.occasion).missions;
  return (
    <Container size="narrow" className="flex flex-col gap-6 py-6 sm:py-8">
      <div className="flex flex-col gap-2">
        <h2 className="m-0 text-3xl font-black tracking-[-0.03em]">{t("missions.title")} <span className="font-serif text-royal">{t("missions.titleAccent")}</span></h2>
        <p className="m-0 text-text-2">{t("missions.lead")}</p>
      </div>
      {enabled ? <MissionsClient occasionId={m.occasion.id} /> : <UpsellCard occasionId={m.occasion.id} feature={t("missions.feature")} />}
    </Container>
  );
}
