import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, asc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { Container } from "@/components/ui";
import { getT } from "@/i18n";
import { requireMemberPage } from "@/lib/auth";
import { OCCASIONS } from "@/lib/config";
import { brandLocale } from "@/lib/occasion";
import { loadDays, occasionStats } from "@/lib/queries";
import { formatBytes, formatNumber } from "@/lib/client/format";
import { storageDriver } from "@/lib/storage";
import { AlbumClient } from "@/components/host/AlbumClient";
import { Notice } from "@/components/app/Notice";
import { PackageCard, TestModeBanner } from "@/components/host/EventPackage";
import { accessForOccasion } from "@/lib/access";
import { toPackage } from "@/lib/serializers";
import { getSettings } from "@/lib/settings";
import { paymentsEnabled } from "@/lib/stripe";
import { fulfilCheckout } from "@/lib/billing";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const m = await requireMemberPage((await params).id);
  return { title: m?.occasion.title };
}

export default async function AlbumPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ paid?: string; checkout?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const m = await requireMemberPage(id);
  if (!m) notFound();
  let o = m.occasion;
  // Back from Stripe Checkout (?paid=1): confirm the payment with Stripe now (idempotent, the same call the webhook
  // makes), so a slow or missing webhook never leaves a paid event in setup. The guest purchase page does the same.
  if (sp.paid === "1" && o.packageStatus === "setup" && o.stripeCheckoutSessionId && paymentsEnabled()) {
    await fulfilCheckout(o.stripeCheckoutSessionId).catch((e) => console.error("[album] confirm on return failed", e));
    const [fresh] = await db.select().from(schema.occasions).where(eq(schema.occasions.id, o.id)).limit(1);
    if (fresh) o = fresh;
  }
  const { t, locale } = await getT("host");
  const [stats, days, guests, access, settings, testUsed] = await Promise.all([
    occasionStats(o),
    loadDays(o.id),
    db.select({ id: schema.guests.id, name: schema.guests.displayName }).from(schema.guests)
      .where(eq(schema.guests.occasionId, o.id)).orderBy(asc(schema.guests.displayName)).limit(1000),
    accessForOccasion(o),
    getSettings(),
    db.select({ n: sql<number>`count(*)::int` }).from(schema.media)
      .where(and(eq(schema.media.occasionId, o.id), sql`${schema.media.status} <> 'failed'`, sql`${schema.media.visibility} <> 'deleted'`))
      .then((r) => Number(r[0]?.n ?? 0)),
  ]);
  const pkg = toPackage(o, access, settings);
  const isOwner = m.role === "owner";
  const payments = paymentsEnabled();
  const occLocale = brandLocale(o);
  const moments = OCCASIONS[o.type].moments.map((mo) => ({ value: mo[occLocale], label: mo[locale] }));
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
      {sp.paid && access.state === "setup" ? <Notice tone="success">{t("pay.paidNotice")}</Notice> : null}
      {sp.checkout === "cancelled" && access.state === "setup" ? <Notice>{t("pay.cancelledNotice")}</Notice> : null}
      {access.reason !== "locked" && access.reason !== "suspended" ? (
        <PackageCard occasionId={o.id} pkg={pkg} isOwner={isOwner} payments={payments} testUsed={testUsed} />
      ) : null}
      {access.testMode ? <TestModeBanner used={testUsed} limit={access.testUploadLimit} /> : null}
      <dl className="m-0 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {tiles.map((s) => (
          <div key={s.label} className="flex flex-col-reverse gap-1 rounded-[24px] bg-tint px-5 py-4">
            <dt className="text-[13px] font-semibold text-muted">{s.label}</dt>
            <dd className="m-0 text-[clamp(1.6rem,4vw,2.4rem)] font-black leading-none tracking-[-0.03em]">{s.value}</dd>
          </div>
        ))}
      </dl>
      <AlbumClient
        occasionId={o.id}
        days={days.map((d) => ({ id: d.id, name: d.name }))}
        moments={moments}
        guests={guests}
        pendingCount={stats.pendingApproval}
        approvalMode={o.approvalMode}
        canDownload={access.canDownload}
        canUpload={access.canUpload}
        isOwner={isOwner}
        payments={payments}
        videoMaxSeconds={settings.videoMaxSeconds}
        testUploadLimit={access.testUploadLimit}
        pricePence={settings.eventPricePence}
        canPay={access.canPay}
      />
    </Container>
  );
}
