import { getT } from "@/i18n";
import { pageParam, requireAdmin } from "@/lib/admin";
import { moderationQueue } from "@/lib/admin-queries";
import { Empty, PageHeader, Pagination } from "@/components/admin/ui";
import { ModerationQueue } from "@/components/admin/MediaModeration";

export const dynamic = "force-dynamic";

export default async function AdminModerationPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const { t } = await getT("admin");
  const page = pageParam(sp.page);
  const res = await moderationQueue(page);
  return (
    <>
      <PageHeader eyebrow={t("nav.moderation")} title={t("moderation.title")} accent={t("moderation.accent")} />
      <p className="m-0 max-w-3xl text-[15px] text-text-2">{t("moderation.lead")}</p>
      {res.items.length === 0 ? <Empty>{t("moderation.empty")}</Empty> : <ModerationQueue items={res.items} />}
      <Pagination path="/admin/moderation" params={{}} page={res.page} hasNext={res.hasNext}
        labels={{ previous: t("common.previous"), next: t("common.next"), page: t("common.page", { n: res.page }), nav: t("common.pagination") }} />
    </>
  );
}
