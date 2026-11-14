import Link from "next/link";
import { notFound } from "next/navigation";
import { getT } from "@/i18n";
import { requireAdmin } from "@/lib/admin";
import { userDetail } from "@/lib/admin-queries";
import { isUuid } from "@/lib/http";
import { BRANDS, OCCASIONS } from "@/lib/config";
import { formatBytes, formatDate, formatDateTime, formatNumber } from "@/lib/client/format";
import { Notice } from "@/components/app/Notice";
import { Card, Empty, Facts, linkCls, PageHeader, TableWrap, td, th } from "@/components/admin/ui";
import { EventPill, FairUsePill, UserPill } from "@/components/admin/plan";
import { AuditList } from "@/components/admin/AuditList";
import { AdminAction } from "@/components/admin/AdminAction";

export const dynamic = "force-dynamic";

export default async function AdminUserPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const data = await userDetail(id);
  if (!data) notFound();
  const { t, locale } = await getT("admin");
  const { host: h } = data;
  const dt = (d: Date | null) => (d ? formatDateTime(d.toISOString(), locale) : "–");
  const isSelf = h.id === admin.id;
  const endpoint = `/api/admin/users/${h.id}`;
  const paidEvents = data.owned.filter((o) => o.access.paid).length;

  return (
    <>
      <PageHeader eyebrow={t("user.eyebrow")} title={<span className="break-all">{h.email}</span>}>
        <UserPill suspended={!!h.suspendedAt} deleted={!!h.deletedAt} paidEvents={paidEvents} t={t} />
      </PageHeader>

      {h.suspendedAt ? <Notice tone="error">{t("user.suspendedNotice", { date: dt(h.suspendedAt), reason: h.suspendedReason || "–" })}</Notice> : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <Card title={t("user.profile")} id="u-profile">
          <Facts rows={[
            { label: t("users.email"), value: <span className="break-all">{h.email}</span> },
            { label: t("users.name"), value: h.name || "–" },
            { label: t("user.brand"), value: BRANDS[h.brand].name },
            { label: t("user.locale"), value: h.locale.toUpperCase() },
            { label: t("users.created"), value: dt(h.createdAt) },
            { label: t("user.id"), value: <code className="break-all text-[13px]">{h.id}</code> },
          ]} />
        </Card>
        <Card title={t("user.payments")} id="u-pay">
          <Facts rows={[
            { label: t("user.paidEvents"), value: formatNumber(paidEvents, locale) },
            {
              label: t("user.stripeCustomer"),
              value: h.stripeCustomerId
                ? <a href={`https://dashboard.stripe.com/customers/${encodeURIComponent(h.stripeCustomerId)}`} target="_blank" rel="noopener noreferrer" className={`${linkCls} break-all`}>{h.stripeCustomerId}</a>
                : "–",
            },
          ]} />
          <p className="m-0 text-[13px] text-muted">{t("user.paymentsHint")}</p>
        </Card>
      </div>

      <Card title={t("user.actions")} id="u-actions">
        {isSelf ? <Notice>{t("user.selfNotice")}</Notice> : null}
        <div className="flex flex-wrap gap-3">
          {!isSelf && !h.suspendedAt ? (
            <AdminAction label={t("user.suspend")} title={t("user.suspendTitle")} body={t("user.suspendBody")} confirmLabel={t("user.suspendConfirm")}
              endpoint={endpoint} method="POST" payload={{ action: "suspend" }} tone="danger" />
          ) : null}
          {h.suspendedAt ? (
            <AdminAction label={t("user.unsuspend")} title={t("user.unsuspendTitle")} body={t("user.unsuspendBody")} confirmLabel={t("user.unsuspendConfirm")}
              endpoint={endpoint} method="POST" payload={{ action: "unsuspend" }} />
          ) : null}
          {!isSelf ? (
            <AdminAction label={t("user.delete")} title={t("user.deleteTitle")} body={t("user.deleteBody")} confirmLabel={t("user.deleteConfirm")}
              endpoint={endpoint} method="DELETE" tone="danger" redirectTo="/admin/users"
              fields={[{ kind: "typed", name: "confirmEmail", label: t("user.typeEmail", { email: h.email }), expected: h.email }, { kind: "reason", required: true }]} />
          ) : null}
        </div>
      </Card>

      <Card title={t("user.events", { n: formatNumber(data.owned.length, locale) })} id="u-events"
        actions={<Link href={`/admin/events?owner=${h.id}`} className={linkCls}>{t("user.allEvents")}</Link>}>
        {data.owned.length === 0 ? <Empty>{t("user.noEvents")}</Empty> : (
          <TableWrap label={t("nav.events")}>
            <thead>
              <tr>
                <th scope="col" className={th}>{t("events.titleCol")}</th>
                <th scope="col" className={th}>{t("events.type")}</th>
                <th scope="col" className={th}>{t("events.status")}</th>
                <th scope="col" className={th}>{t("events.window")}</th>
                <th scope="col" className={th}>{t("events.guests")}</th>
                <th scope="col" className={th}>{t("events.media")}</th>
                <th scope="col" className={th}>{t("events.storage")}</th>
              </tr>
            </thead>
            <tbody>
              {data.owned.map((o) => (
                <tr key={o.id}>
                  <td className={td}><Link href={`/admin/events/${o.id}`} className={linkCls}>{o.title}</Link></td>
                  <td className={td}>{OCCASIONS[o.type].label[locale]}</td>
                  <td className={td}>
                    <div className="flex flex-wrap gap-1"><EventPill status={o.status} access={o.access} t={t} />{o.fairUseAlertedAt ? <FairUsePill t={t} /> : null}</div>
                  </td>
                  <td className={td}>{o.opensAt && o.closesAt ? `${formatDate(o.opensAt.toISOString(), locale)} → ${formatDate(o.closesAt.toISOString(), locale)}` : "–"}</td>
                  <td className={td}>{formatNumber(o.guestCount, locale)}</td>
                  <td className={td}>{formatNumber(o.mediaCount, locale)}</td>
                  <td className={td}>{formatBytes(o.bytes, locale)}</td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
        {data.cohosted.length ? (
          <div className="flex flex-col gap-2">
            <h3 className="m-0 text-[15px] font-black">{t("user.cohostOf")}</h3>
            <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
              {data.cohosted.map((o) => <li key={o.id}><Link href={`/admin/events/${o.id}`} className="inline-flex min-h-11 items-center rounded-full bg-tint px-4 text-[14px] font-bold text-ink no-underline hover:bg-[#E4E8F5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky">{o.title}</Link></li>)}
            </ul>
          </div>
        ) : null}
      </Card>

      <Card title={t("user.audit")} id="u-audit">
        <AuditList rows={data.audit} t={t} locale={locale} />
      </Card>
    </>
  );
}
