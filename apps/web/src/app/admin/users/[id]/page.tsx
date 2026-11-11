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
import { EventPill, PlanPill } from "@/components/admin/plan";
import { AuditList } from "@/components/admin/AuditList";
import { AdminAction } from "@/components/admin/AdminAction";

export const dynamic = "force-dynamic";

const ymd = (d: Date) => d.toISOString().slice(0, 10);

export default async function AdminUserPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const data = await userDetail(id);
  if (!data) notFound();
  const { t, locale } = await getT("admin");
  const { host: h, access: a } = data;
  const dt = (d: Date | null) => (d ? formatDateTime(d.toISOString(), locale) : "–");
  const isSelf = h.id === admin.id;
  const endpoint = `/api/admin/users/${h.id}`;
  const tomorrow = ymd(new Date(Date.now() + 86400_000));
  const canExtendTrial = ["none", "trialing", "expired"].includes(h.planStatus);
  const hasLiveSub = !!h.stripeSubscriptionId && (h.planStatus === "active" || h.planStatus === "past_due");

  return (
    <>
      <PageHeader eyebrow={t("user.eyebrow")} title={<span className="break-all">{h.email}</span>}>
        <PlanPill access={a} t={t} />
      </PageHeader>

      {h.suspendedAt ? <Notice tone="error">{t("user.suspendedNotice", { date: dt(h.suspendedAt), reason: h.suspendedReason || "–" })}</Notice> : null}
      {a.comped ? <Notice tone="blue">{t("user.compedNotice", { date: dt(a.compUntil) })}</Notice> : null}

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
        <Card title={t("user.subscription")} id="u-sub">
          <Facts rows={[
            { label: t("user.storedStatus"), value: `${t(`status.${h.planStatus}`)}${h.planInterval ? ` · ${t(`status.${h.planInterval}`)}` : ""}` },
            { label: t("user.effective"), value: <PlanPill access={a} t={t} /> },
            { label: t("user.trial"), value: h.trialStartedAt ? `${dt(h.trialStartedAt)} → ${dt(h.trialEndsAt)}` : "–" },
            { label: t("user.periodEnd"), value: `${dt(h.currentPeriodEnd)}${h.cancelAtPeriodEnd ? ` · ${t("user.cancelAtPeriodEnd")}` : ""}` },
            { label: t("user.pastDueSince"), value: dt(h.pastDueSince) },
            { label: t("user.readOnlySince"), value: dt(h.readOnlySince) },
            { label: t("user.deleteAfter"), value: dt(a.deleteAfter ?? h.deleteAfter) },
            { label: t("user.compUntil"), value: dt(h.compUntil) },
            {
              label: t("user.stripeCustomer"),
              value: h.stripeCustomerId
                ? <a href={`https://dashboard.stripe.com/customers/${encodeURIComponent(h.stripeCustomerId)}`} target="_blank" rel="noopener noreferrer" className={`${linkCls} break-all`}>{h.stripeCustomerId}</a>
                : "–",
            },
            { label: t("user.stripeSubscription"), value: h.stripeSubscriptionId ? <code className="break-all text-[13px]">{h.stripeSubscriptionId}</code> : "–" },
          ]} />
        </Card>
      </div>

      <Card title={t("user.actions")} id="u-actions">
        {isSelf ? <Notice>{t("user.selfNotice")}</Notice> : null}
        <div className="flex flex-wrap gap-3">
          {canExtendTrial ? (
            <AdminAction label={t("user.extendTrial")} title={t("user.extendTrialTitle")} body={t("user.extendTrialBody")} confirmLabel={t("user.extendTrialConfirm")}
              endpoint={endpoint} method="POST" payload={{ action: "extend_trial" }}
              fields={[{ kind: "number", name: "days", label: t("user.days"), min: 1, max: 30, initial: 7 }, { kind: "reason", required: true }]} />
          ) : null}
          <AdminAction label={a.comped ? t("user.changeComp") : t("user.grantComp")} title={t("user.grantCompTitle")} body={t("user.grantCompBody")} confirmLabel={t("user.grantCompConfirm")}
            endpoint={endpoint} method="POST" payload={{ action: "grant_comp" }}
            fields={[{ kind: "date", name: "until", label: t("user.compDate"), min: tomorrow, initial: h.compUntil && h.compUntil > new Date() ? ymd(h.compUntil) : ymd(new Date(Date.now() + 30 * 86400_000)) }, { kind: "reason", required: true }]} />
          {h.compUntil ? (
            <AdminAction label={t("user.removeComp")} title={t("user.removeCompTitle")} body={t("user.removeCompBody")} confirmLabel={t("user.removeCompConfirm")}
              endpoint={endpoint} method="POST" payload={{ action: "remove_comp" }} />
          ) : null}
          {hasLiveSub ? (
            <AdminAction label={t("user.cancelSub")} title={t("user.cancelSubTitle")} body={t("user.cancelSubBody")} confirmLabel={t("user.cancelSubConfirm")}
              endpoint={endpoint} method="POST" payload={{ action: "cancel_subscription" }} tone="danger"
              fields={[{ kind: "choice", name: "mode", label: t("user.cancelWhen"), initial: "period_end", options: [
                { value: "period_end", label: t("user.cancelAtEnd") }, { value: "now", label: t("user.cancelNow") },
              ] }, { kind: "reason", required: true }]} />
          ) : null}
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
                <th scope="col" className={th}>{t("events.guests")}</th>
                <th scope="col" className={th}>{t("events.media")}</th>
                <th scope="col" className={th}>{t("events.storage")}</th>
                <th scope="col" className={th}>{t("events.dates")}</th>
              </tr>
            </thead>
            <tbody>
              {data.owned.map((o) => (
                <tr key={o.id}>
                  <td className={td}><Link href={`/admin/events/${o.id}`} className={linkCls}>{o.title}</Link></td>
                  <td className={td}>{OCCASIONS[o.type].label[locale]}</td>
                  <td className={td}><EventPill status={o.status} access={o.access} t={t} /></td>
                  <td className={td}>{formatNumber(o.guestCount, locale)}</td>
                  <td className={td}>{formatNumber(o.mediaCount, locale)}</td>
                  <td className={td}>{formatBytes(o.bytes, locale)}</td>
                  <td className={td}>{o.startsOn ? formatDate(o.startsOn, locale) : formatDate(o.createdAt.toISOString(), locale)}</td>
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
