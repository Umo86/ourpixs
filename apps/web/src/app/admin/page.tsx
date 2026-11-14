import { getT } from "@/i18n";
import { requireAdmin } from "@/lib/admin";
import { dailySeries, overviewStats, recentPayments } from "@/lib/admin-queries";
import { formatBytes, formatDate, formatDateTime, formatNumber } from "@/lib/client/format";
import { formatGBP } from "@/components/marketing/format";
import Link from "next/link";
import { Bars, Card, Empty, linkCls, PageHeader, Pill, StatTile, TableWrap, td, th } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  await requireAdmin();
  const { t, locale } = await getT("admin");
  const [s, series, payments] = await Promise.all([overviewStats(), dailySeries(30), recentPayments(15)]);
  const n = (v: number) => formatNumber(v, locale);
  const gbp = (pence: number) => formatGBP(Math.round(pence));
  const dayLabels = series.map((d) => formatDate(d.day, locale, { day: "numeric", month: "short" }));
  const signups30 = series.reduce((a, d) => a + d.signups, 0);
  const uploads30 = series.reduce((a, d) => a + d.uploads, 0);
  const states: [string, number, string][] = (["setup", "paid", "live", "ended", "expired", "refunded"] as const)
    .map((k) => [t(`status.${k}`), s.packages[k], `/admin/events?filter=${k}`]);

  return (
    <>
      <PageHeader eyebrow={t("overview.eyebrow")} title={t("overview.title")} accent={t("overview.accent")} />

      <section aria-labelledby="ov-money" className="flex flex-col gap-3">
        <h2 id="ov-money" className="m-0 text-xl font-black tracking-tight">{t("overview.money")}</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile label={t("overview.revenue30")} value={gbp(s.revenue.pence30)} hint={t("overview.packagesHint", { n: n(s.revenue.count30) })} />
          <StatTile label={t("overview.revenueAll")} value={gbp(s.revenue.pence)} hint={t("overview.packagesHint", { n: n(s.revenue.count) })} />
          <StatTile label={t("overview.testPayments")} value={n(s.revenue.testCount)} hint={t("overview.testPaymentsHint")} />
          <StatTile label={t("overview.refunds")} value={n(s.revenue.refunded)} hint={s.revenue.duplicates ? t("overview.duplicates", { n: n(s.revenue.duplicates) }) : undefined} />
        </div>
        <Card title={t("overview.recentPayments")} id="ov-payments">
          {payments.length === 0 ? <Empty>{t("event.noPayments")}</Empty> : (
            <TableWrap label={t("overview.recentPayments")}>
              <thead>
                <tr>
                  <th scope="col" className={th}>{t("event.payments")}</th>
                  <th scope="col" className={th}>{t("event.kind")}</th>
                  <th scope="col" className={th}>{t("event.amount")}</th>
                  <th scope="col" className={th}>{t("events.status")}</th>
                  <th scope="col" className={th}>{t("event.mode")}</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={`${p.kind}-${p.id}`}>
                    <td className={td}>
                      {formatDateTime((p.paidAt ?? p.createdAt).toISOString(), locale)}
                      <Link href={`/admin/events/${p.occasionId}`} className={`${linkCls} block break-all text-xs`}>{p.title}</Link>
                      {p.email ? <span className="block break-all text-xs text-muted">{p.email}</span> : null}
                    </td>
                    <td className={td}>{t(`event.kinds.${p.kind === "guest_download" ? "guest_download" : "event_package"}`)}</td>
                    <td className={td}>{gbp(p.amountPence)}</td>
                    <td className={td}><Pill tone={p.status === "paid" ? "green" : p.status === "refunded" ? "grey" : "red"}>{t(`event.orderStatus.${p.status}`)}</Pill></td>
                    <td className={td}>{p.livemode ? t("event.live") : t("event.test")}</td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          )}
        </Card>
      </section>

      <section aria-labelledby="ov-hosts" className="flex flex-col gap-3">
        <h2 id="ov-hosts" className="m-0 text-xl font-black tracking-tight">{t("overview.hosts")}</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile label={t("overview.hostsTotal")} value={n(s.hosts.total)} href="/admin/users" />
          <StatTile label={t("overview.new7")} value={n(s.hosts.new7)} />
          <StatTile label={t("overview.new30")} value={n(s.hosts.new30)} />
          <StatTile label={t("status.suspended")} value={n(s.hosts.suspended)} href="/admin/users?filter=suspended" />
        </div>
        <Card title={t("overview.byPackage")} id="ov-plans">
          <ul className="m-0 grid list-none grid-cols-2 gap-2 p-0 sm:grid-cols-3 lg:grid-cols-6">
            {states.map(([label, v, href]) => (
              <li key={label}>
                <a href={href} className="flex min-h-11 flex-col rounded-2xl bg-tint px-4 py-3 text-ink no-underline hover:bg-[#E4E8F5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky">
                  <span className="text-[13px] font-semibold text-muted">{label}</span>
                  <span className="text-2xl font-black tracking-tight">{n(v)}</span>
                </a>
              </li>
            ))}
          </ul>
        </Card>
      </section>

      <section aria-labelledby="ov-activity" className="flex flex-col gap-3">
        <h2 id="ov-activity" className="m-0 text-xl font-black tracking-tight">{t("overview.activity")}</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile label={t("overview.eventsTotal")} value={n(s.events.total)} href="/admin/events" />
          <StatTile label={t("overview.liveNow")} value={n(s.packages.live)} href="/admin/events?filter=live" />
          <StatTile label={t("overview.eventsNew7")} value={n(s.events.new7)} />
          <StatTile label={t("overview.uploadsToday")} value={n(s.uploads.today)} hint={t("overview.uploadsWeek", { n: n(s.uploads.week) })} />
          <StatTile label={t("overview.storage")} value={formatBytes(s.uploads.bytes, locale)} />
          <StatTile label={t("overview.fairUse")} value={n(s.events.fairUse)} href="/admin/events?filter=fair_use" />
          <StatTile label={t("overview.moderation")} value={n(s.moderationOpen)} href="/admin/moderation" />
          <StatTile label={t("overview.enquiries")} value={n(s.enquiriesOpen)} href="/admin/enquiries" />
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={t("overview.signupsChart")} id="ov-signups">
          <Bars values={series.map((d) => d.signups)} labels={dayLabels} label={t("overview.chartSummary", { n: n(signups30), what: t("overview.signupsChart") })} />
          <p className="m-0 text-[13px] text-muted">{t("overview.chartRange", { from: dayLabels[0] ?? "", to: dayLabels[dayLabels.length - 1] ?? "", n: n(signups30) })}</p>
        </Card>
        <Card title={t("overview.uploadsChart")} id="ov-uploads">
          <Bars values={series.map((d) => d.uploads)} labels={dayLabels} label={t("overview.chartSummary", { n: n(uploads30), what: t("overview.uploadsChart") })} />
          <p className="m-0 text-[13px] text-muted">{t("overview.chartRange", { from: dayLabels[0] ?? "", to: dayLabels[dayLabels.length - 1] ?? "", n: n(uploads30) })}</p>
        </Card>
      </div>
    </>
  );
}
