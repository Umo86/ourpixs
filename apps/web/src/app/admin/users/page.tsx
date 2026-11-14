import Link from "next/link";
import { getT } from "@/i18n";
import { pageParam, requireAdmin, sp1 } from "@/lib/admin";
import { listUsers, USER_FILTERS, type UserFilter } from "@/lib/admin-queries";
import { BRANDS } from "@/lib/config";
import { formatBytes, formatDate, formatNumber } from "@/lib/client/format";
import { Empty, FilterBar, linkCls, PageHeader, Pagination, TableWrap, td, th } from "@/components/admin/ui";
import { UserPill } from "@/components/admin/plan";

export const dynamic = "force-dynamic";

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function AdminUsersPage({ searchParams }: { searchParams: SP }) {
  await requireAdmin();
  const sp = await searchParams;
  const { t, locale } = await getT("admin");
  const q = sp1(sp.q).trim().slice(0, 200);
  const fRaw = sp1(sp.filter);
  const filter = (USER_FILTERS as readonly string[]).includes(fRaw) ? (fRaw as UserFilter) : null;
  const page = pageParam(sp.page);
  const res = await listUsers({ q, filter, page });

  return (
    <>
      <PageHeader eyebrow={t("nav.users")} title={t("users.title")} accent={t("users.accent")} />
      <FilterBar path="/admin/users" q={q} searchLabel={t("users.search")} searchPlaceholder={t("users.searchPlaceholder")}
        selects={[{ name: "filter", label: t("users.filter"), value: filter ?? "", options: [{ value: "", label: t("common.all") }, ...USER_FILTERS.map((p) => ({ value: p, label: t(`users.filters.${p}`) }))] }]}
        labels={{ apply: t("common.apply"), clear: t("common.clear") }} />
      {res.rows.length === 0 ? <Empty>{t("users.empty")}</Empty> : (
        <TableWrap label={t("users.title")}>
          <thead>
            <tr>
              <th scope="col" className={th}>{t("users.email")}</th>
              <th scope="col" className={th}>{t("users.name")}</th>
              <th scope="col" className={th}>{t("users.brandLocale")}</th>
              <th scope="col" className={th}>{t("users.state")}</th>
              <th scope="col" className={th}>{t("users.events")}</th>
              <th scope="col" className={th}>{t("users.storage")}</th>
              <th scope="col" className={th}>{t("users.created")}</th>
            </tr>
          </thead>
          <tbody>
            {res.rows.map((u) => (
              <tr key={u.id}>
                <td className={td}><Link href={`/admin/users/${u.id}`} className={`${linkCls} break-all`}>{u.email}</Link></td>
                <td className={td}>{u.name || <span className="text-muted">–</span>}</td>
                <td className={td}>{BRANDS[u.brand].name} · {u.locale.toUpperCase()}</td>
                <td className={td}><UserPill suspended={!!u.suspendedAt} deleted={!!u.deletedAt} paidEvents={u.paidEvents} t={t} /></td>
                <td className={td}>{formatNumber(u.events, locale)}</td>
                <td className={td}>{formatBytes(u.bytes, locale)}</td>
                <td className={td}>{formatDate(u.createdAt.toISOString(), locale, { day: "numeric", month: "short", year: "numeric" })}</td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}
      <Pagination path="/admin/users" params={{ q, filter: filter ?? "" }} page={res.page} hasNext={res.hasNext}
        labels={{ previous: t("common.previous"), next: t("common.next"), page: t("common.page", { n: res.page }), nav: t("common.pagination") }} />
    </>
  );
}
