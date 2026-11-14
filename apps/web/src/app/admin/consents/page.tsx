import { getT } from "@/i18n";
import { pageParam, requireAdmin, sp1 } from "@/lib/admin";
import { listConsents } from "@/lib/admin-queries";
import { CONSENT_STATUS, type ConsentStatus } from "@/lib/consent";
import { BRANDS, type Brand } from "@/lib/config";
import { formatDateTime, formatNumber } from "@/lib/client/format";
import { Card, Empty, FilterBar, PageHeader, Pagination, Pill, StatTile, TableWrap, td, th } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

type SP = Promise<Record<string, string | string[] | undefined>>;

/**
 * Marketing consents: who opted in to offers and news, with the exact wording shown, where and when; withdrawn ones too.
 * CSV export (same filters) goes through /api/admin/consents/export and is written to the audit log.
 */
export default async function AdminConsentsPage({ searchParams }: { searchParams: SP }) {
  await requireAdmin();
  const sp = await searchParams;
  const { t, locale } = await getT("admin");
  const q = sp1(sp.q).trim().slice(0, 200);
  const b = sp1(sp.brand);
  const brand = (b === "bizimresimler" || b === "ourpixs" ? b : null) as Brand | null;
  const s = sp1(sp.status);
  const status = (CONSENT_STATUS as readonly string[]).includes(s) ? (s as ConsentStatus) : null;
  const page = pageParam(sp.page);
  const res = await listConsents({ q, brand, status }, page);
  const n = (x: number) => formatNumber(x, locale);
  const exportQs = new URLSearchParams(Object.entries({ q, brand: brand ?? "", status: status ?? "" }).filter(([, v]) => v)).toString();

  return (
    <>
      <PageHeader eyebrow={t("nav.consents")} title={t("consents.title")} accent={t("consents.accent")}>
        <a href={`/api/admin/consents/export${exportQs ? `?${exportQs}` : ""}`} download
          className="inline-flex min-h-11 items-center rounded-full bg-royal px-6 text-[15px] font-bold text-white no-underline hover:bg-royal-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky focus-visible:ring-offset-2">{t("consents.export")}</a>
      </PageHeader>
      <FilterBar path="/admin/consents" q={q} searchLabel={t("consents.search")} searchPlaceholder={t("consents.searchPlaceholder")}
        selects={[
          { name: "brand", label: t("consents.brand"), value: brand ?? "", options: [{ value: "", label: t("common.all") }, ...(Object.keys(BRANDS) as Brand[]).map((x) => ({ value: x, label: BRANDS[x].name }))] },
          { name: "status", label: t("events.status"), value: status ?? "", options: [{ value: "", label: t("common.all") }, ...CONSENT_STATUS.map((x) => ({ value: x, label: t(`consents.statuses.${x}`) }))] },
        ]}
        labels={{ apply: t("common.apply"), clear: t("common.clear") }} />
      <div className="grid grid-cols-3 gap-3">
        <StatTile label={t("consents.total")} value={n(res.counts.total)} />
        <StatTile label={t("consents.statuses.current")} value={n(res.counts.current)} />
        <StatTile label={t("consents.statuses.withdrawn")} value={n(res.counts.withdrawn)} />
      </div>
      <p className="m-0 text-sm text-text-2">{t("consents.note")}</p>
      {res.rows.length === 0 ? <Empty>{t("consents.empty")}</Empty> : (
        <Card>
          <TableWrap label={t("consents.title")}>
            <thead>
              <tr>
                <th scope="col" className={th}>{t("consents.email")}</th>
                <th scope="col" className={th}>{t("consents.brand")}</th>
                <th scope="col" className={th}>{t("consents.source")}</th>
                <th scope="col" className={th}>{t("consents.wording")}</th>
                <th scope="col" className={th}>{t("consents.consentedAt")}</th>
                <th scope="col" className={th}>{t("events.status")}</th>
              </tr>
            </thead>
            <tbody>
              {res.rows.map(({ consent: c, occasionTitle }) => (
                <tr key={c.id}>
                  <td className={td}><span className="break-all font-bold">{c.email}</span><span className="block text-xs text-muted">{c.locale.toUpperCase()}</span></td>
                  <td className={td}>{BRANDS[c.brand].name}</td>
                  <td className={td}>{t(`consents.sources.${c.source}`)}{occasionTitle ? <span className="block text-xs text-muted">{occasionTitle}</span> : null}</td>
                  <td className={`${td} max-w-[280px] text-xs`}>&ldquo;{c.wording}&rdquo;</td>
                  <td className={td}>{formatDateTime(c.consentedAt.toISOString(), locale)}</td>
                  <td className={td}>
                    {c.withdrawnAt
                      ? <><Pill tone="grey">{t("consents.statuses.withdrawn")}</Pill><span className="block text-xs text-muted">{formatDateTime(c.withdrawnAt.toISOString(), locale)}{c.withdrawnVia ? ` · ${t(`consents.via.${c.withdrawnVia}`)}` : ""}</span></>
                      : <Pill tone="green">{t("consents.statuses.current")}</Pill>}
                  </td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        </Card>
      )}
      <Pagination path="/admin/consents" params={{ q, brand: brand ?? "", status: status ?? "" }} page={res.page} hasNext={res.hasNext}
        labels={{ previous: t("common.previous"), next: t("common.next"), page: t("common.page", { n: res.page }), nav: t("common.pagination") }} />
    </>
  );
}
