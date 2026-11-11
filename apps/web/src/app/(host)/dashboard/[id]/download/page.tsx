import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui";
import { getT } from "@/i18n";
import { requireMemberPage } from "@/lib/auth";
import { loadDays, occasionStats } from "@/lib/queries";
import { formatBytes, formatDate } from "@/lib/client/format";
import { DownloadClient } from "@/components/host/DownloadClient";
import { Notice } from "@/components/app/Notice";
import { accessForOccasion } from "@/lib/access";
import { paymentsEnabled } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT("host");
  return { title: t("download.metaTitle") };
}

export default async function DownloadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = await requireMemberPage(id);
  if (!m) notFound();
  const { t, locale } = await getT("host");
  const [days, stats, access] = await Promise.all([loadDays(m.occasion.id), occasionStats(m.occasion), accessForOccasion(m.occasion)]);
  return (
    <Container size="narrow" className="flex flex-col gap-6 py-6 sm:py-8">
      <div className="flex flex-col gap-2">
        <h2 className="m-0 text-3xl font-black tracking-[-0.03em]">{t("download.title")} <span className="font-serif text-royal">{t("download.titleAccent")}</span></h2>
        <p className="m-0 text-text-2">{t("download.lead", { size: formatBytes(stats.bytes, locale) })}</p>
        {access.deleteAfter && !access.deleted ? <p className="m-0 text-sm font-semibold text-royal">{t("download.keptUntil", { date: formatDate(access.deleteAfter.toISOString(), locale) })}</p> : null}
      </div>
      {!access.canDownload ? <Notice>{t(access.reason === "trial_ended" ? "billing.downloadsLockedEnded" : "billing.downloadsLocked")}</Notice> : null}
      <DownloadClient occasionId={m.occasion.id} title={m.occasion.title} days={days.map((d) => ({ id: d.id, name: d.name }))}
        canDownload={access.canDownload} isOwner={m.role === "owner"} payments={paymentsEnabled()} />
    </Container>
  );
}
