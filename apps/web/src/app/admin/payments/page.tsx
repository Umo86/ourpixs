import Link from "next/link";
import { getT } from "@/i18n";
import { pageParam, requireAdmin, sp1 } from "@/lib/admin";
import { listPayments, PAYMENT_KINDS, PAYMENT_MODES, PAYMENT_STATUSES, type PaymentFilters, type PaymentKind, type PaymentMode, type PaymentStatus } from "@/lib/admin-queries";
import { formatDateTime, formatNumber } from "@/lib/client/format";
import { formatGBP } from "@/components/marketing/format";
import { Empty, FilterBar, linkCls, PageHeader, Pagination, Pill, StatTile, TableWrap, td, th } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

type SP = Promise<Record<string, string | string[] | undefined>>;
const pick = <T extends string>(v: string, list: readonly T[]): T | null => ((list as readonly string[]).includes(v) ? (v as T) : null);
const day = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

/** Every payment: event packages and guests' "download everything", with filters (kind, status, live/test, dates) and totals. */
export default async function AdminPaymentsPage({ searchParams }: { searchParams: SP }) {
  await requireAdmin();
  const sp = await searchParams;
  const { t, locale } = await getT("admin");
  const f: PaymentFilters = {
    kind: pick<PaymentKind>(sp1(sp.kind), PAYMENT_KINDS), status: pick<PaymentStatus>(sp1(sp.status), PAYMENT_STATUSES),
    mode: pick<PaymentMode>(sp1(sp.mode), PAYMENT_MODES), from: day(sp1(sp.from)), to: day(sp1(sp.to)),
  };
  const page = pageParam(sp.page);
  const res = await listPayments(f, page);
  const n = (x: number) => formatNumber(x, locale);
  const all = { value: "", label: t("common.all") };
  const T = res.totals;

  return (
    <>
      <PageHeader eyebrow={t("nav.payments")} title={t("payments.title")} accent={t("payments.accent")} />
      <FilterBar path="/admin/payments"
        selects={[
          { name: "kind", label: t("event.kind"), value: f.kind ?? "", options: [all, ...PAYMENT_KINDS.map((k) => ({ value: k, label: t(`event.kinds.${k}`) }))] },
          { name: "status", label: t("events.status"), value: f.status ?? "", options: [all, ...PAYMENT_STATUSES.map((k) => ({ value: k, label: t(`event.orderStatus.${k}`) }))] },
          { name: "mode", label: t("event.mode"), value: f.mode ?? "", options: [all, { value: "live", label: t("event.live") }, { value: "test", label: t("event.test") }] },
        ]}
        dates={[{ name: "from", label: t("payments.from"), value: f.from ?? "" }, { name: "to", label: t("payments.to"), value: f.to ?? "" }]}
        labels={{ apply: t("common.apply"), clear: t("common.clear") }} />
      <section aria-labelledby="pay-totals" className="flex flex-col gap-3">
        <h2 id="pay-totals" className="m-0 text-xl font-black tracking-tight">{t("payments.totals")}</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile label={t("payments.packagesPaid")} value={formatGBP(T.packages.paidPence)} hint={t("payments.countHint", { n: n(T.packages.paidCount) })} />
          <StatTile label={t("payments.guestsPaid")} value={formatGBP(T.guests.paidPence)} hint={t("payments.countHint", { n: n(T.guests.paidCount) })} />
          <StatTile label={t("payments.refunded")} value={formatGBP(T.packages.refundedPence + T.guests.refundedPence)} hint={t("payments.countHint", { n: n(T.packages.refundedCount + T.guests.refundedCount) })} />
          <StatTile label={t("payments.testCount")} value={n(T.packages.testCount + T.guests.testCount)} hint={t("payments.testHint")} />
        </div>
        <p className="m-0 text-sm text-text-2">{t("payments.totalsNote")}</p>
      </section>
      {res.rows.length === 0 ? <Empty>{t("event.noPayments")}</Empty> : (
        <TableWrap label={t("payments.title")}>
          <thead>
            <tr>
              <th scope="col" className={th}>{t("payments.date")}</th>
              <th scope="col" className={th}>{t("payments.event")}</th>
              <th scope="col" className={th}>{t("payments.payer")}</th>
              <th scope="col" className={th}>{t("event.kind")}</th>
              <th scope="col" className={th}>{t("event.amount")}</th>
              <th scope="col" className={th}>{t("events.status")}</th>
              <th scope="col" className={th}>{t("event.mode")}</th>
            </tr>
          </thead>
          <tbody>
            {res.rows.map((p) => (
              <tr key={`${p.kind}-${p.id}`}>
                <td className={td}>{formatDateTime((p.paidAt ?? p.createdAt).toISOString(), locale)}</td>
                <td className={td}><Link href={`/admin/events/${p.occasionId}`} className={`${linkCls} break-all`}>{p.title}</Link></td>
                <td className={td}><span className="break-all">{p.email ?? "–"}</span><span className="block break-all text-xs text-muted">{p.ref}</span></td>
                <td className={td}>{t(`event.kinds.${p.kind}`)}</td>
                <td className={td}>{formatGBP(p.amountPence)}</td>
                <td className={td}><Pill tone={p.status === "paid" ? "green" : p.status === "refunded" ? "grey" : p.status === "pending" ? "amber" : "red"}>{t(`event.orderStatus.${p.status}`)}</Pill></td>
                <td className={td}>{p.livemode ? <Pill tone="ink">{t("event.live")}</Pill> : <Pill tone="amber">{t("event.test")}</Pill>}</td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}
      <Pagination path="/admin/payments" params={{ kind: f.kind ?? "", status: f.status ?? "", mode: f.mode ?? "", from: f.from ?? "", to: f.to ?? "" }} page={res.page} hasNext={res.hasNext}
        labels={{ previous: t("common.previous"), next: t("common.next"), page: t("common.page", { n: res.page }), nav: t("common.pagination") }} />
    </>
  );
}
