import { getT } from "@/i18n";
import { requireAdmin } from "@/lib/admin";
import { dailySeries, overviewStats } from "@/lib/admin-queries";
import { formatBytes, formatDate, formatNumber } from "@/lib/client/format";
import { formatGBP } from "@/components/marketing/format";
import { Bars, Card, PageHeader, StatTile } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  await requireAdmin();
  const { t, locale } = await getT("admin");
  const [s, series] = await Promise.all([overviewStats(), dailySeries(30)]);
  const n = (v: number) => formatNumber(v, locale);
  const gbp = (pence: number) => formatGBP(Math.round(pence));
  const conv = s.conversion.cohort ? Math.round((s.conversion.converted / s.conversion.cohort) * 100) : null;
  const dayLabels = series.map((d) => formatDate(d.day, locale, { day: "numeric", month: "short" }));
  const signups30 = series.reduce((a, d) => a + d.signups, 0);
  const uploads30 = series.reduce((a, d) => a + d.uploads, 0);
  const plans: [string, number, string][] = [
    [t("status.trialing"), s.plans.trialing, "/admin/users?plan=trialing"],
    [t("overview.activeMonthly"), s.plans.activeMonthly, "/admin/users?plan=active"],
    [t("overview.activeYearly"), s.plans.activeYearly, "/admin/users?plan=active"],
    [t("status.past_due"), s.plans.pastDue, "/admin/users?plan=past_due"],
    [t("status.cancelled"), s.plans.cancelled, "/admin/users?plan=cancelled"],
    [t("status.expired"), s.plans.expired, "/admin/users?plan=expired"],
    [t("status.none"), s.plans.none, "/admin/users?plan=none"],
    [t("status.comped"), s.plans.comped, "/admin/users?plan=comped"],
    [t("status.suspended"), s.plans.suspended, "/admin/users?plan=suspended"],
  ];

  return (
    <>
      <PageHeader eyebrow={t("overview.eyebrow")} title={t("overview.title")} accent={t("overview.accent")} />

      <section aria-labelledby="ov-money" className="flex flex-col gap-3">
        <h2 id="ov-money" className="m-0 text-xl font-black tracking-tight">{t("overview.money")}</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile label={t("overview.mrr")} value={gbp(s.mrrPence)} hint={t("overview.mrrHint")} />
          <StatTile label={t("overview.arr")} value={gbp(s.arrPence)} />
          <StatTile label={t("overview.conversion")} value={conv === null ? "–" : `${conv}%`}
            hint={t("overview.conversionHint", { converted: n(s.conversion.converted), cohort: n(s.conversion.cohort) })} />
          <StatTile label={t("overview.paying")} value={n(s.plans.activeMonthly + s.plans.activeYearly)} href="/admin/users?plan=active" />
        </div>
      </section>

      <section aria-labelledby="ov-hosts" className="flex flex-col gap-3">
        <h2 id="ov-hosts" className="m-0 text-xl font-black tracking-tight">{t("overview.hosts")}</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <StatTile label={t("overview.hostsTotal")} value={n(s.hosts.total)} href="/admin/users" />
          <StatTile label={t("overview.new7")} value={n(s.hosts.new7)} />
          <StatTile label={t("overview.new30")} value={n(s.hosts.new30)} />
        </div>
        <Card title={t("overview.byPlan")} id="ov-plans">
          <ul className="m-0 grid list-none grid-cols-2 gap-2 p-0 sm:grid-cols-3 lg:grid-cols-5">
            {plans.map(([label, v, href]) => (
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
          <StatTile label={t("overview.liveToday")} value={n(s.events.liveToday)} />
          <StatTile label={t("overview.eventsNew7")} value={n(s.events.new7)} />
          <StatTile label={t("overview.uploadsToday")} value={n(s.uploads.today)} hint={t("overview.uploadsWeek", { n: n(s.uploads.week) })} />
          <StatTile label={t("overview.storage")} value={formatBytes(s.uploads.bytes, locale)} />
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
