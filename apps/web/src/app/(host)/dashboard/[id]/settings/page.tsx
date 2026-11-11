import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui";
import { getT } from "@/i18n";
import { requireMemberPage } from "@/lib/auth";
import { occasionPayload } from "@/lib/occasion-service";
import { paymentsEnabled } from "@/lib/stripe";
import { storageDriver } from "@/lib/storage";
import { SettingsClient } from "@/components/host/SettingsClient";
import { Notice } from "@/components/app/Notice";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT("host");
  return { title: t("settings.metaTitle") };
}

export default async function SettingsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ paid?: string; cancelled?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const m = await requireMemberPage(id);
  if (!m) notFound();
  const { t } = await getT("host");
  const occasion = await occasionPayload(m.occasion, m.role);
  return (
    <Container size="narrow" className="flex flex-col gap-6 py-6 sm:py-8">
      {sp.paid ? <Notice tone="success">{t("plan.paidNotice")}</Notice> : null}
      {sp.cancelled ? <Notice>{t("plan.cancelledNotice")}</Notice> : null}
      <SettingsClient initial={occasion} isOwner={m.role === "owner"} payments={paymentsEnabled()} storage={!!storageDriver()} />
    </Container>
  );
}
