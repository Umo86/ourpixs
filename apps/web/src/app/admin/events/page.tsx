import Link from "next/link";
import { getT } from "@/i18n";
import { pageParam, requireAdmin, sp1 } from "@/lib/admin";
import { EVENT_FILTERS, listEvents, type EventFilter } from "@/lib/admin-queries";
import { isUuid } from "@/lib/http";
import { OCCASIONS } from "@/lib/config";
import { formatBytes, formatDate, formatNumber } from "@/lib/client/format";
import { Empty, FilterBar, linkCls, PageHeader, Pagination, TableWrap, td, th } from "@/components/admin/ui";
import { EventPill, FairUsePill } from "@/components/admin/plan";

export const dynamic = "force-dynamic";

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function AdminEventsPage({ searchParams }: { searchParams: SP }) {
  await requireAdmin();
  const sp = await searchParams;
  const { t, locale } = await getT("admin");
  const q = sp1(sp.q).trim().slice(0, 200);
  const fRaw = sp1(sp.filter);
  const filter = (EVENT_FILTERS as readonly string[]).includes(fRaw) ? (fRaw as EventFilter) : null;
  const owner = isUuid(sp1(sp.owner)) ? sp1(sp.owner) : null;
  const page = pageParam(sp.page);
  const res = await listEvents({ q, filter, page, ownerId: owner });
  const d = (s: string) => formatDate(s, locale, { day: "numeric", month: "short", year: "numeric" });

  return (
    <>
      <PageHeader eyebrow={t("nav.events")} title={t("events.title")} accent={t("events.accent")} />
      <FilterBar path="/admin/events" q={q} hidden={owner ? { owner } : undefined} searchLabel={t("events.search")} searchPlaceholder={t("events.searchPlaceholder")}
        selects={[{ name: "filter", label: t("events.filter"), value: filter ?? "", options: [{ value: "", label: t("common.all") }, ...EVENT_FILTERS.map((f) => ({ value: f, label: t(`status.${f}`) }))] }]}
        labels={{ apply: t("common.apply"), clear: t("common.clear") }} />
      {owner ? <p className="m-0 text-sm text-text-2">{t("events.ownerFiltered")} <Link href="/admin/events" className={linkCls}>{t("common.clear")}</Link></p> : null}
      {res.rows.length === 0 ? <Empty>{t("events.empty")}</Empty> : (
        <TableWrap label={t("events.title")}>
          <thead>
            <tr>
              <th scope="col" className={th}>{t("events.titleCol")}</th>
              <th scope="col" className={th}>{t("events.type")}</th>
              <th scope="col" className={th}>{t("events.owner")}</th>
              <th scope="col" className={th}>{t("events.window")}</th>
              <th scope="col" className={th}>{t("events.guests")}</th>
              <th scope="col" className={th}>{t("events.media")}</th>
              <th scope="col" className={th}>{t("events.storage")}</th>
              <th scope="col" className={th}>{t("events.status")}</th>
            </tr>
          </thead>
          <tbody>
            {res.rows.map((o) => (
              <tr key={o.id}>
                <td className={td}>
                  <Link href={`/admin/events/${o.id}`} className={linkCls}>{o.title}</Link>
                  <span className="block text-xs text-muted">{o.slug}</span>
                </td>
                <td className={td}>{OCCASIONS[o.type].label[locale]}</td>
                <td className={td}><Link href={`/admin/users/${o.ownerId}`} className={`${linkCls} break-all`}>{o.ownerEmail}</Link></td>
                <td className={td}>
                  {o.opensAt && o.closesAt ? `${d(o.opensAt.toISOString())} → ${d(o.closesAt.toISOString())}` : o.startsOn ? d(o.startsOn) : "–"}
                  <span className="block text-xs text-muted">{t("events.createdOn", { date: d(o.createdAt.toISOString()) })}</span>
                </td>
                <td className={td}>{formatNumber(o.guestCount, locale)}</td>
                <td className={td}>{formatNumber(o.mediaCount, locale)}</td>
                <td className={td}>{formatBytes(o.bytes, locale)}</td>
                <td className={td}><div className="flex flex-wrap gap-1"><EventPill status={o.status} access={o.access} t={t} />{o.fairUseAlertedAt ? <FairUsePill t={t} /> : null}</div></td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}
      <Pagination path="/admin/events" params={{ q, filter: filter ?? "", owner: owner ?? "" }} page={res.page} hasNext={res.hasNext}
        labels={{ previous: t("common.previous"), next: t("common.next"), page: t("common.page", { n: res.page }), nav: t("common.pagination") }} />
    </>
  );
}
