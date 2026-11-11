import { getT } from "@/i18n";
import { pageParam, requireAdmin, sp1 } from "@/lib/admin";
import { listAudit } from "@/lib/admin-queries";
import { Card, FilterBar, PageHeader, Pagination } from "@/components/admin/ui";
import { AuditList } from "@/components/admin/AuditList";

export const dynamic = "force-dynamic";

export default async function AdminAuditPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const { t, locale } = await getT("admin");
  const action = sp1(sp.action).slice(0, 80);
  const adminEmail = sp1(sp.admin).slice(0, 320);
  const page = pageParam(sp.page);
  const res = await listAudit({ action, admin: adminEmail, page });
  return (
    <>
      <PageHeader eyebrow={t("nav.audit")} title={t("audit.title")} accent={t("audit.accent")} />
      <FilterBar path="/admin/audit" labels={{ apply: t("common.apply"), clear: t("common.clear") }} selects={[
        { name: "action", label: t("audit.action"), value: action, options: [{ value: "", label: t("common.all") }, ...res.actions.map((a) => ({ value: a, label: a }))] },
        { name: "admin", label: t("audit.admin"), value: adminEmail, options: [{ value: "", label: t("common.all") }, ...res.admins.map((a) => ({ value: a, label: a }))] },
      ]} />
      <Card>
        <AuditList rows={res.rows} t={t} locale={locale} showTarget />
      </Card>
      <Pagination path="/admin/audit" params={{ action, admin: adminEmail }} page={res.page} hasNext={res.hasNext}
        labels={{ previous: t("common.previous"), next: t("common.next"), page: t("common.page", { n: res.page }), nav: t("common.pagination") }} />
    </>
  );
}
