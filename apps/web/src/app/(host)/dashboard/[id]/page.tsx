import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { Container } from "@/components/ui";
import { getT } from "@/i18n";
import { requireMemberPage } from "@/lib/auth";
import { OCCASIONS, PLANS } from "@/lib/config";
import { brandLocale } from "@/lib/occasion";
import { loadDays, occasionStats } from "@/lib/queries";
import { formatBytes, formatNumber } from "@/lib/client/format";
import { storageDriver } from "@/lib/storage";
import { AlbumClient } from "@/components/host/AlbumClient";
import { Notice } from "@/components/app/Notice";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const m = await requireMemberPage((await params).id);
  return { title: m?.occasion.title };
}

export default async function AlbumPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = await requireMemberPage(id);
  if (!m) notFound();
  const o = m.occasion;
  const { t, locale } = await getT("host");
  const [stats, days, guests] = await Promise.all([
    occasionStats(o),
    loadDays(o.id),
    db.select({ id: schema.guests.id, name: schema.guests.displayName }).from(schema.guests)
      .where(eq(schema.guests.occasionId, o.id)).orderBy(asc(schema.guests.displayName)).limit(1000),
  ]);
  const occLocale = brandLocale(o);
  const moments = OCCASIONS[o.type].moments.map((mo) => ({ value: mo[occLocale], label: mo[locale] }));
  const plan = PLANS[o.plan];
  const tiles = [
    { label: t("stats.guests"), value: formatNumber(stats.guests, locale) },
    { label: t("stats.photos"), value: formatNumber(stats.photos, locale) },
    { label: t("stats.videos"), value: formatNumber(stats.videos, locale) },
    { label: t("stats.messages"), value: formatNumber(stats.messages, locale) },
    { label: t("stats.storage"), value: formatBytes(stats.bytes, locale) },
  ];

  return (
    <Container className="flex flex-col gap-6 py-6 sm:py-8">
      {!storageDriver() ? <Notice tone="error">{t("errors.storage_not_configured")}</Notice> : null}
      <dl className="m-0 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {tiles.map((s) => (
          <div key={s.label} className="flex flex-col-reverse gap-1 rounded-[24px] bg-tint px-5 py-4">
            <dt className="text-[13px] font-semibold text-muted">{s.label}</dt>
            <dd className="m-0 text-[clamp(1.6rem,4vw,2.4rem)] font-black leading-none tracking-[-0.03em]">{s.value}</dd>
          </div>
        ))}
      </dl>
      {plan.maxMedia !== null ? (
        <p className="m-0 text-sm text-muted">{t("album.freeLimit", { used: formatNumber(stats.photos + stats.videos, locale), max: formatNumber(plan.maxMedia, locale) })}</p>
      ) : null}
      <AlbumClient
        occasionId={o.id}
        days={days.map((d) => ({ id: d.id, name: d.name }))}
        moments={moments}
        guests={guests}
        pendingCount={stats.pendingApproval}
        approvalMode={o.approvalMode}
      />
    </Container>
  );
}
