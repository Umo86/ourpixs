"use client";
import { useEffect, useRef, useState } from "react";
import { CreditCard, Lock, X } from "lucide-react";
import { Button, Sticker } from "@/components/ui";
import { Notice } from "@/components/app/Notice";
import { useLocale, useT } from "@/i18n/client";
import { SUBSCRIPTION, YEARLY_SAVING_PERCENT, type PlanInterval } from "@/lib/config";
import { api, errorMessage } from "@/lib/client/api";
import { formatDate } from "@/lib/client/format";
import { formatGBP } from "@/components/marketing/format";
import type { Subscription } from "@/lib/api-types";

const monthly = formatGBP(SUBSCRIPTION.monthlyPence);
const yearly = formatGBP(SUBSCRIPTION.yearlyPence);

/** Subscribe buttons: Monthly is the primary action, Yearly secondary. */
export function SubscribeButtons({ payments, tone = "light", size = "md" }: { payments: boolean; tone?: "light" | "dark"; size?: "md" | "lg" }) {
  const t = useT("host");
  const [busy, setBusy] = useState<PlanInterval | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function go(interval: PlanInterval) {
    setBusy(interval);
    setError(null);
    try {
      const r = await api<{ url: string }>("/api/v1/billing/checkout", { body: { interval } });
      window.location.assign(r.url);
    } catch (e) {
      setError(errorMessage(t, e));
      setBusy(null);
    }
  }
  if (!payments) return <p className={`m-0 text-sm font-bold ${tone === "dark" ? "text-white" : "text-ink"}`}>{t("plan.comingSoon")}</p>;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-3">
        <Button size={size} variant={tone === "dark" ? "light" : "primary"} disabled={!!busy} onClick={() => go("month")}>
          {busy === "month" ? t("billing.redirecting") : t("billing.subscribeMonthly", { price: monthly })}
        </Button>
        <Button size={size} variant={tone === "dark" ? "ghost" : "secondary"} disabled={!!busy} onClick={() => go("year")}>
          {busy === "year" ? t("billing.redirecting") : t("billing.subscribeYearly", { price: yearly, saving: YEARLY_SAVING_PERCENT })}
        </Button>
      </div>
      {error ? <Notice tone="error">{error}</Notice> : null}
    </div>
  );
}

/** Opens the Stripe Customer Portal (card, switch monthly/yearly, cancel at period end, invoices). */
export function ManageBillingButton({ payments, variant = "secondary" }: { payments: boolean; variant?: "secondary" | "light" | "primary" }) {
  const t = useT("host");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!payments) return null;
  async function go() {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ url: string }>("/api/v1/billing/portal", { body: {} });
      window.location.assign(r.url);
    } catch (e) {
      setError(errorMessage(t, e));
      setBusy(false);
    }
  }
  return (
    <div className="flex flex-col gap-2">
      <Button variant={variant} disabled={busy} onClick={go}><CreditCard size={18} aria-hidden />{busy ? t("billing.redirecting") : t("billing.manage")}</Button>
      {error ? <Notice tone="error">{error}</Notice> : null}
    </div>
  );
}

/** Account plan status: trial days left, active monthly/yearly, past due, or read-only until … */
export function SubscriptionCard({ sub, payments }: { sub: Subscription; payments: boolean }) {
  const t = useT("host");
  const { locale } = useLocale();
  const date = (iso: string | null) => formatDate(iso, locale);
  const days = sub.daysLeft ?? 0;
  let title: string;
  let body: string;
  switch (sub.status) {
    case "trialing":
      title = t("billing.status.trialing", { days });
      body = t("billing.status.trialingBody", { date: date(sub.trialEndsAt) });
      break;
    case "active":
      title = t(sub.interval === "year" ? "billing.status.activeYearly" : "billing.status.activeMonthly");
      body = sub.cancelAtPeriodEnd
        ? t("billing.status.cancelling", { date: date(sub.currentPeriodEnd) })
        : sub.currentPeriodEnd ? t("billing.status.renews", { date: date(sub.currentPeriodEnd) }) : "";
      break;
    case "past_due":
      title = t("billing.status.pastDue");
      body = t("billing.status.pastDueBody", { days });
      break;
    case "cancelled":
      title = t("billing.status.cancelled");
      body = t("billing.status.cancelledBody", { date: date(sub.deleteAfter) });
      break;
    case "expired":
      title = t("billing.status.expired");
      body = t("billing.status.expiredBody", { date: date(sub.deleteAfter) });
      break;
    default:
      title = t("billing.status.none", { days: SUBSCRIPTION.trialDays });
      body = t("billing.status.noneBody");
  }
  const hasSubscription = sub.status === "active" || sub.status === "past_due" || sub.status === "cancelled";
  return (
    <section aria-labelledby="plan-h" className="flex flex-col gap-4 rounded-[28px] border border-[#E6E8EF] p-6">
      <span className="text-[13px] font-bold uppercase tracking-[0.16em] text-royal">{t("billing.kicker")}</span>
      <h2 id="plan-h" className="m-0 text-2xl font-black tracking-tight">{title}</h2>
      {body ? <p className="m-0 text-text-2">{body}</p> : null}
      {sub.status === "active" || sub.status === "past_due" ? (
        <ManageBillingButton payments={payments} variant={sub.status === "past_due" ? "primary" : "secondary"} />
      ) : sub.status === "none" ? null : (
        <div className="flex flex-col gap-3">
          <SubscribeButtons payments={payments} />
          {hasSubscription ? <ManageBillingButton payments={payments} /> : null}
        </div>
      )}
      <p className="m-0 text-xs text-muted">{t("billing.fine")}</p>
    </section>
  );
}

/** Prominent prompt: a day into the trial, and whenever the account is read-only or past due. */
export function UpgradePrompt({ sub, payments }: { sub: Subscription; payments: boolean }) {
  const t = useT("host");
  const { locale } = useLocale();
  if (!sub.showUpgradePrompt) return null;
  const date = formatDate(sub.deleteAfter, locale);
  const key = sub.status === "trialing" ? "trial" : sub.status === "past_due" ? "pastDue" : sub.status === "cancelled" ? "cancelled" : "expired";
  return (
    <section aria-labelledby="upgrade-h" className="relative flex flex-col gap-4 overflow-hidden rounded-[32px] bg-ink p-7 text-white sm:p-10">
      <Sticker rotate={-4} className="self-start">{t(`billing.prompt.${key}.sticker`, { days: sub.daysLeft ?? 0 })}</Sticker>
      <h2 id="upgrade-h" className="m-0 text-[clamp(2rem,5vw,3.2rem)] font-black leading-[0.95] tracking-[-0.04em]">
        {t(`billing.prompt.${key}.title`)} <span className="font-serif text-sky-soft">{t(`billing.prompt.${key}.accent`)}</span>
      </h2>
      <p className="m-0 max-w-2xl text-lg text-muted-dark">{t(`billing.prompt.${key}.body`, { date, monthly, yearly, saving: YEARLY_SAVING_PERCENT, days: sub.daysLeft ?? 0 })}</p>
      {sub.status === "past_due" ? <ManageBillingButton payments={payments} variant="light" /> : <SubscribeButtons payments={payments} tone="dark" size="lg" />}
    </section>
  );
}

/**
 * Shown when a locked download button is pressed. The owner can subscribe; a co-host is told the owner can.
 * Accessible modal: focus moves in, Esc closes, focus returns to the opener.
 */
export function UpgradeDialog({ open, onClose, isOwner, payments }: { open: boolean; onClose: () => void; isOwner: boolean; payments: boolean }) {
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
        <p className="m-0 text-text-2">{isOwner ? t("billing.dialog.body", { monthly, yearly }) : t("billing.dialog.cohost")}</p>
        {isOwner ? <SubscribeButtons payments={payments} /> : null}
      </div>
    </div>
  );
}
