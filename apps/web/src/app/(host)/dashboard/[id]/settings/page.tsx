import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui";
import { getT } from "@/i18n";
import { requireMemberPage } from "@/lib/auth";
import { occasionPayload } from "@/lib/occasion-service";
import { storageDriver } from "@/lib/storage";
import { SettingsClient } from "@/components/host/SettingsClient";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT("host");
  return { title: t("settings.metaTitle") };
}

export default async function SettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = await requireMemberPage(id);
  if (!m) notFound();
  const occasion = await occasionPayload(m.occasion, m.role);
  return (
    <Container size="narrow" className="flex flex-col gap-6 py-6 sm:py-8">
      <SettingsClient initial={occasion} isOwner={m.role === "owner"} storage={!!storageDriver()} />
    </Container>
  );
}
