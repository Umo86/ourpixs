import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, Monitor } from "lucide-react";
import { getT } from "@/i18n";
import { pageParam, requireAdmin, sp1 } from "@/lib/admin";
import { eventDetail, MEDIA_FILTERS, type MediaFilter } from "@/lib/admin-queries";
import { isUuid } from "@/lib/http";
import { BRANDS, OCCASIONS } from "@/lib/config";
import { guestUrl, wallUrl } from "@/lib/occasion";
import { formatBytes, formatDate, formatDateTime, formatNumber } from "@/lib/client/format";
import { Notice } from "@/components/app/Notice";
import { Card, Empty, Facts, linkCls, PageHeader, Pagination, Pill, StatTile, TableWrap, td, th } from "@/components/admin/ui";
import { EventPill, FairUsePill } from "@/components/admin/plan";
import { formatGBP } from "@/components/marketing/format";
import { formatInZone } from "@/lib/tz";
import { AuditList } from "@/components/admin/AuditList";
import { AdminAction } from "@/components/admin/AdminAction";
import { GuestBlockButton, MediaGrid } from "@/components/admin/MediaModeration";

export const dynamic = "force-dynamic";

type SP = Promise<Record<string, string | string[] | undefined>>;
const chip = "inline-flex min-h-11 items-center rounded-full border-[1.5px] px-4 text-[13px] font-bold no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky";
const extLink = "inline-flex min-h-11 items-center gap-2 rounded-full bg-tint px-5 text-[14px] font-bold text-ink no-underline hover:bg-[#E4E8F5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky";

export default async function AdminEventPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SP }) {
  await requireAdmin();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const sp = await searchParams;
  const mRaw = sp1(sp.media);
  const mediaFilter: MediaFilter = (MEDIA_FILTERS as readonly string[]).includes(mRaw) ? (mRaw as MediaFilter) : "all";
  const mediaPage = pageParam(sp.mpage);
  const guestPage = pageParam(sp.gpage);
  const data = await eventDetail(id, { mediaPage, mediaFilter, guestPage });
  if (!data) notFound();
  const { t, locale } = await getT("admin");
  const { occasion: o, owner, access, stats, settings } = data;
  const zdt = (d: Date | null) => (d ? `${formatInZone(d, o.timeZone, locale)}` : "–");
  const overFairUse = stats.bytes > settings.fairUseGb * 1024 ** 3;
  const dt = (d: Date | null) => (d ? formatDateTime(d.toISOString(), locale) : "–");
  const n = (v: number) => formatNumber(v, locale);
  const endpoint = `/api/admin/events/${o.id}`;
  const pager = (page: number) => ({ previous: t("common.previous"), next: t("common.next"), page: t("common.page", { n: page }), nav: t("common.pagination") });
  const eyebrow = [OCCASIONS[o.type].label[locale], o.startsOn ? formatDate(o.startsOn, locale) : null].filter(Boolean).join(" · ");

  return (
    <>
      <PageHeader eyebrow={eyebrow} title={o.title}>
        <EventPill status={o.status} access={access} t={t} />
        {o.fairUseAlertedAt ? <FairUsePill t={t} /> : null}
      </PageHeader>
      {o.fairUseAlertedAt ? <Notice tone="error">{t("event.fairUseNotice", { date: dt(o.fairUseAlertedAt), gb: settings.fairUseGb })}</Notice> : null}

      {o.adminLockedAt ? <Notice tone="error">{t("event.lockedNotice", { date: dt(o.adminLockedAt) })}</Notice> : null}
      {access.suspended ? <Notice tone="error">{t("event.ownerSuspended")}</Notice> : null}

      <div className="flex flex-wrap gap-3">
        <a href={guestUrl(o)} target="_blank" rel="noopener noreferrer" className={extLink}><ExternalLink size={16} aria-hidden />{t("event.openGuest")}</a>
        <a href={wallUrl(o)} target="_blank" rel="noopener noreferrer" className={extLink}><Monitor size={16} aria-hidden />{t("event.openWall")}</a>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label={t("event.guests")} value={n(stats.guests)} />
        <StatTile label={t("event.photos")} value={n(stats.photos)} />
        <StatTile label={t("event.videos")} value={n(stats.videos)} />
        <StatTile label={t("event.messages")} value={n(stats.messages)} />
        <StatTile label={t("event.storage")} value={formatBytes(stats.bytes, locale)} />
        <StatTile label={t("event.hidden")} value={n(stats.hidden)} />
        <StatTile label={t("event.pending")} value={n(stats.pending)} />
        <StatTile label={t("event.openReports")} value={n(stats.openReports)} href={stats.openReports ? "/admin/moderation" : undefined} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card title={t("event.package")} id="e-package">
          <Facts rows={[
            { label: t("event.packageState"), value: <EventPill status={o.status} access={access} t={t} /> },
            { label: t("event.storedState"), value: <code className="text-[13px]">{o.packageStatus}</code> },
            { label: t("event.paidAt"), value: `${dt(o.paidAt)}${o.compedAt ? ` · ${t("status.comped")}` : ""}` },
            { label: t("event.window"), value: o.opensAt || o.closesAt ? `${zdt(o.opensAt)} → ${zdt(o.closesAt)}` : t("event.noWindow") },
            { label: t("event.timeZone"), value: o.timeZone },
            { label: t("event.deleteAfter"), value: dt(access.deleteAfter) },
            { label: t("event.endedEmail"), value: dt(o.endedEmailSentAt) },
            { label: t("event.fairUse"), value: `${formatBytes(stats.bytes, locale)} / ${settings.fairUseGb} GB${overFairUse ? ` · ${t("status.fair_use")}` : ""}` },
          ]} />
          {data.orders.length ? (
            <TableWrap label={t("event.payments")}>
              <thead>
                <tr>
                  <th scope="col" className={th}>{t("event.payments")}</th>
                  <th scope="col" className={th}>{t("event.amount")}</th>
                  <th scope="col" className={th}>{t("events.status")}</th>
                  <th scope="col" className={th}>{t("event.mode")}</th>
                </tr>
              </thead>
              <tbody>
                {data.orders.map((r) => (
                  <tr key={r.id}>
                    <td className={td}>{dt(r.paidAt ?? r.createdAt)}<span className="block break-all text-xs text-muted">{r.stripeSessionId}</span></td>
                    <td className={td}>{formatGBP(r.amountPence)}</td>
                    <td className={td}><Pill tone={r.status === "paid" ? "green" : r.status === "refunded" ? "grey" : "red"}>{t(`event.orderStatus.${r.status}`)}</Pill></td>
                    <td className={td}>{r.livemode ? t("event.live") : t("event.test")}</td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          ) : <p className="m-0 text-sm text-muted">{t("event.noPayments")}</p>}
        </Card>
        <Card title={t("event.summary")} id="e-summary">
          <Facts rows={[
            { label: t("event.owner"), value: <Link href={`/admin/users/${owner.id}`} className={`${linkCls} break-all`}>{owner.email}</Link> },
            { label: t("event.link"), value: <code className="break-all text-[13px]">{o.slug}{o.vanitySlug ? ` · ${o.vanitySlug}` : ""}</code> },
            { label: t("user.brand"), value: BRANDS[o.brand].name },
            { label: t("users.created"), value: dt(o.createdAt) },
            { label: t("event.place"), value: [o.venueName, o.city].filter(Boolean).join(", ") || "–" },
            { label: t("event.uploadWindow"), value: o.uploadOpensAt || o.uploadClosesAt ? `${dt(o.uploadOpensAt)} → ${dt(o.uploadClosesAt)}` : t("event.noLegacyWindow") },
            { label: t("event.approval"), value: o.approvalMode ? t("common.yes") : t("common.no") },
            { label: t("event.pin"), value: o.pinHash ? t("common.yes") : t("common.no") },
            { label: t("event.id"), value: <code className="break-all text-[13px]">{o.id}</code> },
          ]} />
        </Card>
        <Card title={t("event.daysAndTeam")} id="e-days">
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {data.days.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-tint px-4 py-3 text-[15px]">
                <span className="font-bold">{d.name}</span>
                <span className="text-text-2">{d.date ? formatDate(d.date, locale) : "–"}</span>
              </li>
            ))}
          </ul>
          <h3 className="m-0 text-[15px] font-black">{t("event.team")}</h3>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {data.members.map((m) => (
              <li key={m.hostId} className="flex flex-wrap items-center justify-between gap-2">
                <Link href={`/admin/users/${m.hostId}`} className={`${linkCls} break-all`}>{m.email}</Link>
                <Pill tone={m.role === "owner" ? "ink" : "grey"}>{t(`event.role.${m.role}`)}</Pill>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card title={t("event.actions")} id="e-actions">
        <div className="flex flex-wrap gap-3">
          {o.packageStatus === "setup" ? (
            <AdminAction label={t("event.markPaid")} title={t("event.markPaidTitle")} body={t("event.markPaidBody")} confirmLabel={t("event.markPaidConfirm")}
              endpoint={endpoint} method="POST" payload={{ action: "mark_paid" }} tone="primary" />
          ) : null}
          {o.compedAt && ["paid", "live", "ended"].includes(o.packageStatus) ? (
            <AdminAction label={t("event.resetSetup")} title={t("event.resetSetupTitle")} body={t("event.resetSetupBody")} confirmLabel={t("event.resetSetupConfirm")}
              endpoint={endpoint} method="POST" payload={{ action: "reset_setup" }} />
          ) : null}
          {o.fairUseAlertedAt ? (
            <AdminAction label={t("event.clearFairUse")} title={t("event.clearFairUseTitle")} body={t("event.clearFairUseBody")} confirmLabel={t("event.clearFairUseConfirm")}
              endpoint={endpoint} method="POST" payload={{ action: "clear_fair_use" }} />
          ) : null}
          {o.adminLockedAt ? (
            <AdminAction label={t("event.unlock")} title={t("event.unlockTitle")} body={t("event.unlockBody")} confirmLabel={t("event.unlockConfirm")}
              endpoint={endpoint} method="POST" payload={{ action: "unlock" }} />
          ) : (
            <AdminAction label={t("event.lock")} title={t("event.lockTitle")} body={t("event.lockBody")} confirmLabel={t("event.lockConfirm")}
              endpoint={endpoint} method="POST" payload={{ action: "lock" }} tone="danger" />
          )}
          {o.status === "archived" ? (
            <AdminAction label={t("event.unarchive")} title={t("event.unarchiveTitle")} body={t("event.unarchiveBody")} confirmLabel={t("event.unarchiveConfirm")}
              endpoint={endpoint} method="POST" payload={{ action: "unarchive" }} />
          ) : (
            <AdminAction label={t("event.archive")} title={t("event.archiveTitle")} body={t("event.archiveBody")} confirmLabel={t("event.archiveConfirm")}
              endpoint={endpoint} method="POST" payload={{ action: "archive" }} />
          )}
          <AdminAction label={t("event.delete")} title={t("event.deleteTitle")} body={t("event.deleteBody")} confirmLabel={t("event.deleteConfirm")}
            endpoint={endpoint} method="DELETE" tone="danger" redirectTo="/admin/events"
            fields={[{ kind: "typed", name: "confirmSlug", label: t("event.typeSlug", { slug: o.slug }), expected: o.slug }, { kind: "reason", required: true }]} />
        </div>
      </Card>

      <Card title={t("event.media")} id="e-media">
        <nav aria-label={t("event.mediaFilter")} className="-mx-1 overflow-x-auto px-1">
          <ul className="m-0 flex list-none gap-2 p-0">
            {MEDIA_FILTERS.map((f) => {
              const on = f === mediaFilter;
              return (
                <li key={f}>
                  <Link href={f === "all" ? `/admin/events/${o.id}` : `/admin/events/${o.id}?media=${f}`} aria-current={on ? "page" : undefined}
                    className={`${chip} ${on ? "border-royal bg-royal text-white" : "border-[#D5D8E2] bg-white text-ink hover:border-ink"}`}>{t(`event.mediaFilters.${f}`)}</Link>
                </li>
              );
            })}
          </ul>
        </nav>
        {data.media.items.length === 0 ? <Empty>{t("event.noMedia")}</Empty> : <MediaGrid items={data.media.items} />}
        <Pagination path={`/admin/events/${o.id}`} params={{ media: mediaFilter === "all" ? "" : mediaFilter, gpage: guestPage > 1 ? String(guestPage) : "" }}
          param="mpage" page={data.media.page} hasNext={data.media.hasNext} labels={pager(data.media.page)} />
      </Card>

      <Card title={t("event.guestList")} id="e-guests">
        {data.guests.rows.length === 0 ? <Empty>{t("event.noGuests")}</Empty> : (
          <TableWrap label={t("event.guestList")}>
            <thead>
              <tr>
                <th scope="col" className={th}>{t("guests.name")}</th>
                <th scope="col" className={th}>{t("guests.joined")}</th>
                <th scope="col" className={th}>{t("guests.uploads")}</th>
                <th scope="col" className={th}>{t("guests.state")}</th>
                <th scope="col" className={th}><span className="sr-only">{t("guests.actions")}</span></th>
              </tr>
            </thead>
            <tbody>
              {data.guests.rows.map((g) => (
                <tr key={g.id}>
                  <td className={td}>{g.displayName}</td>
                  <td className={td}>{dt(g.createdAt)}</td>
                  <td className={td}>{n(g.uploads)}</td>
                  <td className={td}>{g.blockedAt ? <Pill tone="red">{t("guests.blocked")}</Pill> : <Pill tone="green">{t("guests.active")}</Pill>}</td>
                  <td className={td}><GuestBlockButton guestId={g.id} blocked={!!g.blockedAt} name={g.displayName} /></td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
        <Pagination path={`/admin/events/${o.id}`} params={{ media: mediaFilter === "all" ? "" : mediaFilter, mpage: mediaPage > 1 ? String(mediaPage) : "" }}
          param="gpage" page={data.guests.page} hasNext={data.guests.hasNext} labels={pager(data.guests.page)} />
      </Card>

      <Card title={t("event.audit")} id="e-audit">
        <AuditList rows={data.audit} t={t} locale={locale} />
      </Card>
    </>
  );
}
