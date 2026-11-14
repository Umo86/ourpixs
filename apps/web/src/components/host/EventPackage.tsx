"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, CreditCard, Download, Lock, X } from "lucide-react";
import { Button, Sticker } from "@/components/ui";
import { Field } from "@/components/app/Field";
import { Notice } from "@/components/app/Notice";
import { useLocale, useT } from "@/i18n/client";
import { TIME_ZONES } from "@/lib/config";
import { api, errorMessage } from "@/lib/client/api";
import { formatGBP } from "@/components/marketing/format";
import { formatInZone, utcToZoned, zonedToUtc, zoneLabel } from "@/lib/tz";
import { defaultWindow, windowError } from "@/lib/window";
import type { EventPackage, Occasion } from "@/lib/api-types";

/**
 * Host-side UI for the £69 event package: the Pay button (Stripe Checkout), the status card on the event page,
 * the gallery-window editor (wizard + settings) and the "downloads open once you've paid" dialog.
 * Every rule is enforced on the server (src/lib/access.ts); these only mirror it.
 */

/** Starts Stripe Checkout for the event (owner only). Without STRIPE_SECRET_KEY it shows "Payments coming soon". */
export function PayButton({ occasionId, pricePence, payments, size = "md", tone = "light" }: {
  occasionId: string; pricePence: number; payments: boolean; size?: "md" | "lg"; tone?: "light" | "dark";
}) {
  const t = useT("host");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!payments) return <p className={`m-0 text-sm font-bold ${tone === "dark" ? "text-white" : "text-ink"}`}>{t("pay.comingSoon")}</p>;
  async function go() {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ url: string }>(`/api/v1/occasions/${occasionId}/checkout`, { body: {} });
      window.location.assign(r.url);
    } catch (e) {
      setError(errorMessage(t, e));
      setBusy(false);
    }
  }
  return (
    <div className="flex flex-col gap-2">
      <Button size={size} variant={tone === "dark" ? "light" : "primary"} disabled={busy} onClick={go} className="self-start">
        <CreditCard size={18} aria-hidden />{busy ? t("pay.redirecting") : t("pay.cta", { price: formatGBP(pricePence) })}
      </Button>
      {error ? <Notice tone="error">{error}</Notice> : null}
    </div>
  );
}

const fmt = (iso: string | null, tz: string, locale: "en" | "tr") => (iso ? formatInZone(iso, tz, locale, { weekday: true }) : "");

/** Status of the event package with the one action that matters now (pay, change dates, download). */
export function PackageCard({ occasionId, pkg, isOwner, payments, testUsed }: {
  occasionId: string; pkg: EventPackage; isOwner: boolean; payments: boolean; testUsed: number;
}) {
  const t = useT("host");
  const { locale } = useLocale();
  const d = (iso: string | null) => fmt(iso, pkg.timeZone, locale);
  const range = pkg.opensAt && pkg.closesAt ? t("window.range", { from: d(pkg.opensAt), to: d(pkg.closesAt) }) : null;
  const settingsHref = `/dashboard/${occasionId}/settings#gallery`;
  const downloadHref = `/dashboard/${occasionId}/download`;
  let title: string, accent: string, body: string;
  switch (pkg.status) {
    case "setup":
      title = t("package.setupTitle"); accent = t("package.setupAccent");
      body = t("package.setupBody", { limit: pkg.testUploadLimit, used: Math.min(testUsed, pkg.testUploadLimit) });
      break;
    case "paid":
      title = t("package.paidTitle"); accent = t("package.paidAccent", { date: d(pkg.opensAt) }); body = t("package.paidBody");
      break;
    case "live":
      title = t("package.liveTitle"); accent = t("package.liveAccent", { date: d(pkg.closesAt) }); body = t("package.liveBody");
      break;
    case "ended":
      title = t("package.endedTitle"); accent = t("package.endedAccent", { date: d(pkg.deleteAfter) }); body = t("package.endedBody", { date: d(pkg.deleteAfter) });
      break;
    case "refunded":
      title = t("package.refundedTitle"); accent = t("package.refundedAccent"); body = t("package.refundedBody");
      break;
    default:
      title = t("package.expiredTitle"); accent = t("package.expiredAccent"); body = t("package.expiredBody");
  }
  const dark = pkg.status === "setup";
  return (
    <section aria-labelledby="pkg-h" className={`flex flex-col gap-4 rounded-[32px] p-7 sm:p-9 ${dark ? "bg-ink text-white" : "bg-tint text-ink"}`}>
      <Sticker rotate={-3} tone={dark ? "royal" : "ink"} className="self-start">{t("package.kicker")}</Sticker>
      <h2 id="pkg-h" className="m-0 text-[clamp(1.9rem,4.6vw,3rem)] font-black leading-[0.95] tracking-[-0.04em]">
        {title} <span className={`font-serif ${dark ? "text-sky-soft" : "text-royal"}`}>{accent}</span>
      </h2>
      <p className={`m-0 max-w-2xl text-[17px] ${dark ? "text-muted-dark" : "text-text-2"}`}>{body}</p>
      {pkg.status === "setup" && pkg.deleteAfter ? (
        <p role="note" className="m-0 self-start rounded-2xl bg-[#FFF3D6] px-4 py-3 text-[15px] font-bold leading-snug text-[#7A4B00]">
          {t("package.unpaidDelete", { date: formatInZone(pkg.deleteAfter, pkg.timeZone, locale) })}
        </p>
      ) : null}
      {pkg.status === "setup" ? (
        <p className="m-0 flex items-center gap-2 text-[15px] font-semibold text-white">
          <CalendarClock size={18} aria-hidden />{range ? t("package.setupDates", { range }) : t("package.setupNoDates")}
        </p>
      ) : range && (pkg.status === "paid" || pkg.status === "live") ? (
        <p className="m-0 flex items-center gap-2 text-[15px] font-semibold"><CalendarClock size={18} aria-hidden />{range}</p>
      ) : null}
      {pkg.comped && pkg.status !== "setup" ? <p className="m-0 text-sm font-semibold text-royal">{t("package.comped")}</p> : null}
      <div className="flex flex-wrap items-start gap-3">
        {pkg.canPay ? (
          isOwner
            ? (range ? <PayButton occasionId={occasionId} pricePence={pkg.pricePence} payments={payments} size="lg" tone="dark" /> : null)
            : <p className="m-0 text-sm font-semibold text-muted-dark">{t("package.cohostPay")}</p>
        ) : null}
        {pkg.canEditWindow ? <Button href={settingsHref} variant={dark ? "ghost" : "secondary"} size={dark && !range ? "lg" : "md"}>{t("package.changeDates")}</Button> : null}
        {pkg.status === "ended" || pkg.status === "live" ? <Button href={downloadHref} variant="secondary"><Download size={18} aria-hidden />{t("package.download")}</Button> : null}
        {pkg.status === "setup" && testUsed > 0 ? <Button href={downloadHref} variant="ghost"><Download size={18} aria-hidden />{t("package.downloadTest")}</Button> : null}
      </div>
      {pkg.canPay && isOwner && payments ? <p className={`m-0 text-xs ${dark ? "text-[#A8ACB8]" : "text-muted"}`}>{t("pay.fine")}</p> : null}
    </section>
  );
}

/** Slim banner on album pages while the event is in test mode. */
export function TestModeBanner({ used, limit }: { used: number; limit: number }) {
  const t = useT("host");
  return (
    <p role="status" className="m-0 rounded-2xl bg-[#FFF3D6] px-5 py-4 text-[15px] font-semibold leading-snug text-[#7A4B00]">
      {t("package.testBanner", { used: Math.min(used, limit), limit })}
    </p>
  );
}

function zoneOptions(current: string, browser: string | null): string[] {
  const list: string[] = [...TIME_ZONES];
  for (const z of [current, browser]) if (z && !list.includes(z)) list.push(z);
  return list;
}

/** The browser's own zone, read after hydration (reading it while rendering made the server's list differ: React #418). */
function useBrowserZone() {
  const [zone, setZone] = useState<string | null>(null);
  useEffect(() => {
    try { setZone(Intl.DateTimeFormat().resolvedOptions().timeZone); } catch { /* keep null */ }
  }, []);
  return zone;
}

function lengthLabel(t: ReturnType<typeof useT>, opens: Date | null, closes: Date | null) {
  if (!opens || !closes || closes <= opens) return null;
  const hoursTotal = Math.round((closes.getTime() - opens.getTime()) / 3600_000);
  const days = Math.floor(hoursTotal / 24);
  const hours = hoursTotal % 24;
  if (!days) return t("window.lengthHours", { hours });
  if (!hours) return t("window.lengthDays", { days });
  return t("window.length", { days, hours });
}

const select = "min-h-12 w-full rounded-2xl border-[1.5px] border-[#D5D8E2] bg-white px-4 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky";

/**
 * Controlled date-time pickers for the gallery window, entered in the event's time zone (default Europe/London).
 * Used by the wizard (before the event exists) and by WindowEditor.
 */
export function WindowFields({ idPrefix, opens, closes, tz, onChange, windowDays, disabled }: {
  idPrefix: string; opens: string; closes: string; tz: string; windowDays: number; disabled?: boolean;
  onChange: (v: { opens: string; closes: string; tz: string }) => void;
}) {
  const t = useT("host");
  const browserZone = useBrowserZone();
  const zones = useMemo(() => zoneOptions(tz, browserZone), [tz, browserZone]);
  const o = zonedToUtc(opens, tz);
  const c = zonedToUtc(closes, tz);
  const err = opens || closes ? windowError({ opensAt: o, closesAt: c }, windowDays) : null;
  const len = lengthLabel(t, o, c);
  // Changing the zone keeps the wall-clock times the host typed (they mean "10:00 where the party is").
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`${idPrefix}-opens`} type="datetime-local" label={t("window.opens")} value={opens} disabled={disabled}
          onChange={(e) => {
            const next = e.target.value;
            // Moving the start keeps the length when the end would no longer fit.
            const no = zonedToUtc(next, tz);
            let nc = closes;
            if (no && (!c || c <= no || c.getTime() - no.getTime() > windowDays * 86400_000)) nc = utcToZoned(new Date(no.getTime() + windowDays * 86400_000), tz);
            onChange({ opens: next, closes: nc, tz });
          }} />
        <Field id={`${idPrefix}-closes`} type="datetime-local" label={t("window.closes")} value={closes} disabled={disabled}
          min={opens || undefined} onChange={(e) => onChange({ opens, closes: e.target.value, tz })} />
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor={`${idPrefix}-tz`} className="text-[13px] font-semibold text-text-2">{t("window.timeZone")}</label>
        <select id={`${idPrefix}-tz`} className={select} value={tz} disabled={disabled} onChange={(e) => onChange({ opens, closes, tz: e.target.value })}>
          {zones.map((z) => <option key={z} value={z}>{zoneLabel(z)}</option>)}
        </select>
        <span className="text-xs text-muted">{t("window.timeZoneHint")}</span>
      </div>
      {len && !err ? <p className="m-0 text-sm font-semibold text-royal">{len}</p> : null}
      {err && err !== "window_incomplete" ? <Notice tone="error">{t(`errors.${err}`)}</Notice> : null}
    </div>
  );
}

/** Settings section: edit the window (until it opens), or end a live gallery early. */
export function WindowEditor({ occasion, onSaved }: { occasion: Occasion; onSaved?: (o: Occasion) => void }) {
  const t = useT("host");
  const { locale } = useLocale();
  const router = useRouter();
  const pkg = occasion.package;
  const [tz, setTz] = useState(pkg.timeZone);
  const [opens, setOpens] = useState(utcToZoned(pkg.opensAt, pkg.timeZone));
  const [closes, setCloses] = useState(utcToZoned(pkg.closesAt, pkg.timeZone));
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  async function save() {
    const o = zonedToUtc(opens, tz);
    const c = zonedToUtc(closes, tz);
    const err = windowError({ opensAt: o, closesAt: c }, pkg.windowDays);
    if (err) { setFlash({ tone: "error", text: t(`errors.${err}`) }); return; }
    setBusy(true);
    setFlash(null);
    try {
      // The gallery window replaces the old event-level upload times, so those are cleared here.
      const r = await api<{ occasion: Occasion }>(`/api/v1/occasions/${occasion.id}`, {
        method: "PATCH", body: { opensAt: o!.toISOString(), closesAt: c!.toISOString(), timeZone: tz, uploadOpensAt: null, uploadClosesAt: null },
      });
      setOpens(utcToZoned(r.occasion.package.opensAt, r.occasion.package.timeZone));
      setCloses(utcToZoned(r.occasion.package.closesAt, r.occasion.package.timeZone));
      setFlash({ tone: "success", text: t("settings.saved") });
      onSaved?.(r.occasion);
      router.refresh();
    } catch (e) {
      setFlash({ tone: "error", text: errorMessage(t, e) });
    } finally {
      setBusy(false);
    }
  }

  async function endNow() {
    if (!window.confirm(t("window.endConfirm"))) return;
    setBusy(true);
    setFlash(null);
    try {
      const r = await api<{ occasion: Occasion }>(`/api/v1/occasions/${occasion.id}/end`, { body: {} });
      setFlash({ tone: "success", text: t("window.ended") });
      onSaved?.(r.occasion);
      router.refresh();
    } catch (e) {
      setFlash({ tone: "error", text: errorMessage(t, e) });
    } finally {
      setBusy(false);
    }
  }

  function useEventDate() {
    const w = defaultWindow(occasion.startsOn, tz, pkg.windowDays);
    if (!w) return;
    setOpens(utcToZoned(w.opensAt, tz));
    setCloses(utcToZoned(w.closesAt, tz));
  }

  const range = pkg.opensAt && pkg.closesAt
    ? t("window.range", { from: formatInZone(pkg.opensAt, pkg.timeZone, locale, { weekday: true }), to: formatInZone(pkg.closesAt, pkg.timeZone, locale, { weekday: true }) })
    : t("window.notSet");

  return (
    <div className="flex flex-col gap-4">
      <p className="m-0 text-sm text-muted">{t("window.hint", { days: pkg.windowDays })}</p>
      {pkg.canEditWindow ? (
        <>
          <WindowFields idPrefix="w" opens={opens} closes={closes} tz={tz} windowDays={pkg.windowDays}
            onChange={(v) => { setOpens(v.opens); setCloses(v.closes); setTz(v.tz); }} />
          <div className="flex flex-wrap gap-3">
            <Button disabled={busy} onClick={save}>{busy ? t("settings.saving") : t("window.save")}</Button>
            {occasion.startsOn ? <Button variant="ghost" disabled={busy} onClick={useEventDate}>{t("window.useDefault")}</Button> : null}
          </div>
        </>
      ) : (
        <>
          <p className="m-0 flex items-center gap-2 text-[15px] font-semibold"><CalendarClock size={18} aria-hidden />{range}</p>
          {pkg.status === "live" ? <Notice>{t("window.lockedLive")}</Notice> : pkg.status === "ended" ? <Notice>{t("window.lockedEnded")}</Notice> : null}
          {pkg.canEndEarly ? (
            <Button variant="secondary" className="self-start border-[#B42318]! text-[#B42318]! hover:bg-[#B42318]! hover:text-white!" disabled={busy} onClick={endNow}>
              {busy ? t("window.ending") : t("window.endNow")}
            </Button>
          ) : null}
        </>
      )}
      {flash ? <Notice tone={flash.tone}>{flash.text}</Notice> : null}
    </div>
  );
}

/**
 * Shown when a locked download button is pressed: the owner can pay; a co-host is told the owner can.
 * Accessible modal: focus moves in, Esc closes, focus returns to the opener.
 */
export function DownloadLockedDialog({ open, onClose, isOwner, payments, occasionId, pricePence, canPay }: {
  open: boolean; onClose: () => void; isOwner: boolean; payments: boolean; occasionId: string; pricePence: number; canPay: boolean;
}) {
  const t = useT("host");
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); prev?.focus?.(); };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 p-4 sm:items-center" onClick={onClose}>
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="dl-lock-h" onClick={(e) => e.stopPropagation()}
        className="relative flex w-full max-w-lg flex-col gap-4 rounded-[28px] bg-white p-7 text-ink shadow-2xl focus:outline-none">
        <button type="button" onClick={onClose} aria-label={t("common.close")} className="absolute right-4 top-4 inline-flex h-11 w-11 items-center justify-center rounded-full bg-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky"><X size={18} aria-hidden /></button>
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-royal text-white"><Lock size={22} aria-hidden /></span>
        <h2 id="dl-lock-h" className="m-0 pr-10 text-2xl font-black tracking-tight">{t("billing.dialog.title")}</h2>
        <p className="m-0 text-text-2">{isOwner ? t("billing.dialog.body", { price: formatGBP(pricePence) }) : t("billing.dialog.cohost")}</p>
        {isOwner && canPay ? <PayButton occasionId={occasionId} pricePence={pricePence} payments={payments} /> : null}
      </div>
    </div>
  );
}
