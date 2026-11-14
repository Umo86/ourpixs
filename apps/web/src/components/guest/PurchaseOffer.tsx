"use client";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { Download, Sparkles, X } from "lucide-react";
import { useLocale, useT } from "@/i18n/client";
import { api, errorMessage } from "@/lib/client/api";
import { formatDate } from "@/lib/client/format";
import { formatGBP } from "@/components/marketing/format";
import { useGuest } from "./GuestContext";
import { CANCELLATION_DAYS } from "@/lib/config";

/**
 * Starts Stripe Checkout for "download everything" and leaves for it. The guest must first tick the immediate-supply
 * box (digital content: they ask for the download now and lose the 14-day cancellation right); the server refuses without it.
 */
function useBuy() {
  const t = useT("guest");
  const { locale } = useLocale();
  const { api: url } = useGuest();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);
  async function buy() {
    if (!accepted) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ url: string }>(url("/purchase"), { body: { acceptImmediateSupply: true, locale } });
      window.location.assign(r.url);
    } catch (e) {
      setError(errorMessage(t, e));
      setBusy(false);
    }
  }
  return { buy, busy, error, accepted, setAccepted };
}

/** "Start my download now. I understand I lose my 14-day right to cancel." Unticked; required before Checkout. */
function Waiver({ checked, onChange, tone }: { checked: boolean; onChange: (v: boolean) => void; tone: "royal" | "dark" }) {
  const t = useT("guest");
  const id = useId();
  return (
    <label htmlFor={id} className={`flex min-h-11 cursor-pointer items-start gap-3 text-[13px] leading-snug ${tone === "royal" ? "text-white" : "text-muted-dark"}`}>
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-5 w-5 flex-none accent-[#0A0A0A]" />
      <span>{t("purchase.waiver", { days: CANCELLATION_DAYS })} <Link href="/terms" className="font-bold underline">{t("purchase.terms")}</Link></span>
    </label>
  );
}

const btn = "inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-6 font-extrabold no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky disabled:opacity-60";

/**
 * Feed card: "Get every photo and video in full quality — £3". Shown only when the offer can be bought (Stripe
 * configured, event paid and live/ended). After buying it turns into a link to the downloads page.
 */
export function PurchaseCard() {
  const t = useT("guest");
  const { locale } = useLocale();
  const { occasion: o, path } = useGuest();
  const { buy, busy, error, accepted, setAccepted } = useBuy();
  const g = o.guestDownload;
  if (g.purchased) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[28px] bg-surface p-5">
        <span className="flex min-w-0 flex-col gap-1">
          <span className="text-lg font-black tracking-tight">{t("purchase.haveTitle")}</span>
          {g.expiresAt ? <span className="text-sm text-muted-dark">{t("purchase.until", { date: formatDate(g.expiresAt, locale, { day: "numeric", month: "long", year: "numeric", timeZone: o.timeZone }) })}</span> : null}
        </span>
        <Link href={`${path}/download`} className={`${btn} bg-white text-ink`}><Download size={18} aria-hidden />{t("purchase.open")}</Link>
      </div>
    );
  }
  if (!g.available) return null;
  return (
    <div className="relative flex flex-col gap-3 overflow-hidden rounded-[28px] bg-royal p-6">
      <span className="rotate-[-3deg] self-start rounded-full bg-white px-3 py-1.5 text-xs font-extrabold text-royal">{t("purchase.sticker")}</span>
      <p className="m-0 text-2xl font-black leading-tight tracking-tight">{t("purchase.title", { price: formatGBP(g.pricePence) })}</p>
      <p className="m-0 text-[15px] text-[#E3E8FF]">{t("purchase.body")}</p>
      <Waiver checked={accepted} onChange={setAccepted} tone="royal" />
      {error ? <p role="alert" className="m-0 rounded-2xl bg-white/15 p-3 text-sm">{error}</p> : null}
      <button type="button" onClick={buy} disabled={busy || !accepted} className={`${btn} self-start bg-white text-royal`}>
        <Sparkles size={18} aria-hidden />{busy ? t("purchase.opening") : t("purchase.cta", { price: formatGBP(g.pricePence) })}
      </button>
    </div>
  );
}

/** Opened by the download buttons on other people's photos and videos. */
export function PurchaseDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT("guest");
  const { occasion: o } = useGuest();
  const { buy, busy, error, accepted, setAccepted } = useBuy();
  const ref = useRef<HTMLDivElement>(null);
  const g = o.guestDownload;
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
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/70 p-4 sm:items-center" onClick={onClose}>
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="buy-h" onClick={(e) => e.stopPropagation()}
        className="relative flex w-full max-w-md flex-col gap-4 rounded-[28px] bg-surface p-7 text-white shadow-2xl focus:outline-none">
        <button type="button" onClick={onClose} aria-label={t("common.close")} className="absolute right-4 top-4 inline-flex h-11 w-11 items-center justify-center rounded-full bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky"><X size={18} aria-hidden /></button>
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-royal"><Download size={22} aria-hidden /></span>
        <h2 id="buy-h" className="m-0 pr-10 text-2xl font-black tracking-tight">{t("purchase.title", { price: formatGBP(g.pricePence) })}</h2>
        <p className="m-0 text-muted-dark">{t("purchase.dialogBody")}</p>
        {error ? <p role="alert" className="m-0 rounded-2xl bg-surface-2 p-3 text-sm">{error}</p> : null}
        {g.available ? (
          <>
            <Waiver checked={accepted} onChange={setAccepted} tone="dark" />
            <button type="button" onClick={buy} disabled={busy || !accepted} className={`${btn} bg-royal text-white hover:bg-royal-dark`}>
              {busy ? t("purchase.opening") : t("purchase.cta", { price: formatGBP(g.pricePence) })}
            </button>
          </>
        ) : (
          <p className="m-0 rounded-2xl bg-surface-2 p-4 text-sm font-bold">{g.payments ? t("purchase.unavailable") : t("purchase.comingSoon")}</p>
        )}
        <p className="m-0 text-xs text-muted-dark">{t("purchase.fine")}</p>
      </div>
    </div>
  );
}
