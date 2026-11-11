import { Mail } from "lucide-react";
import { getT } from "@/i18n";
import { pageParam, requireAdmin, sp1 } from "@/lib/admin";
import { ENQUIRY_FILTERS, listEnquiries, type EnquiryFilter } from "@/lib/admin-queries";
import { formatDateTime } from "@/lib/client/format";
import { Empty, FilterBar, PageHeader, Pagination, Pill } from "@/components/admin/ui";
import { AdminQuickAction } from "@/components/admin/AdminAction";

export const dynamic = "force-dynamic";

/** Values of the lead's `data` json as label/value pairs (strings only; nested values as JSON). */
function fields(data: unknown): [string, string][] {
  if (!data || typeof data !== "object" || Array.isArray(data)) return data == null ? [] : [["data", JSON.stringify(data)]];
  return Object.entries(data as Record<string, unknown>).filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([k, v]) => [k, typeof v === "string" ? v : JSON.stringify(v)]);
}

export default async function AdminEnquiriesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const { t, locale } = await getT("admin");
  const q = sp1(sp.q).trim().slice(0, 200);
  const fRaw = sp1(sp.filter);
  const filter: EnquiryFilter = (ENQUIRY_FILTERS as readonly string[]).includes(fRaw) ? (fRaw as EnquiryFilter) : "open";
  const page = pageParam(sp.page);
  const res = await listEnquiries({ q, filter, page });

  return (
    <>
      <PageHeader eyebrow={t("nav.enquiries")} title={t("enquiries.title")} accent={t("enquiries.accent")} />
      <FilterBar path="/admin/enquiries" q={q} searchLabel={t("enquiries.search")} searchPlaceholder={t("enquiries.searchPlaceholder")}
        selects={[{ name: "filter", label: t("enquiries.filter"), value: filter, options: ENQUIRY_FILTERS.map((f) => ({ value: f, label: t(`enquiries.filters.${f}`) })) }]}
        labels={{ apply: t("common.apply"), clear: t("common.clear") }} />
      {res.rows.length === 0 ? <Empty>{t("enquiries.empty")}</Empty> : (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {res.rows.map((l) => {
            const subject = t("enquiries.replySubject", { kind: l.kind });
            const mailto = `mailto:${encodeURIComponent(l.email)}?subject=${encodeURIComponent(subject)}`;
            return (
              <li key={l.id}>
                <details className="group rounded-[24px] border border-[#E6E8EF] p-4 open:bg-tint sm:p-5">
                  <summary className="flex min-h-11 cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-2 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky [&::-webkit-details-marker]:hidden">
                    <Pill tone={l.handledAt ? "green" : "amber"}>{l.handledAt ? t("status.handled") : t("status.open")}</Pill>
                    <span className="break-all text-[15px] font-black">{l.name ? `${l.name} · ` : ""}{l.email}</span>
                    <code className="rounded-md bg-white px-2 py-0.5 text-[12px] font-bold">{l.kind}</code>
                    <time dateTime={l.createdAt.toISOString()} className="ml-auto text-[13px] text-muted">{formatDateTime(l.createdAt.toISOString(), locale)}</time>
                  </summary>
                  <div className="mt-4 flex flex-col gap-4">
                    {fields(l.data).length ? (
                      <dl className="m-0 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-[max-content_minmax(0,1fr)]">
                        {fields(l.data).map(([k, v]) => (
                          <div key={k} className="contents">
                            <dt className="text-[13px] font-semibold text-muted">{k}</dt>
                            <dd className="m-0 whitespace-pre-wrap break-words text-[15px]">{v}</dd>
                          </div>
                        ))}
                      </dl>
                    ) : <p className="m-0 text-[15px] text-text-2">{t("enquiries.noDetails")}</p>}
                    {l.handledAt ? <p className="m-0 text-[13px] text-text-2">{t("enquiries.handledOn", { date: formatDateTime(l.handledAt.toISOString(), locale) })}</p> : null}
                    <div className="flex flex-wrap items-start gap-3">
                      <a href={mailto} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-royal px-6 text-[15px] font-bold text-white no-underline hover:bg-royal-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky focus-visible:ring-offset-2">
                        <Mail size={16} aria-hidden />{t("enquiries.reply")}
                      </a>
                      <AdminQuickAction endpoint={`/api/admin/enquiries/${l.id}`} method="POST" busyLabel={t("common.working")}
                        payload={{ action: l.handledAt ? "reopen" : "handled" }} label={l.handledAt ? t("enquiries.reopen") : t("enquiries.markHandled")} />
                    </div>
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
      )}
      <Pagination path="/admin/enquiries" params={{ q, filter }} page={res.page} hasNext={res.hasNext}
        labels={{ previous: t("common.previous"), next: t("common.next"), page: t("common.page", { n: res.page }), nav: t("common.pagination") }} />
    </>
  );
}
