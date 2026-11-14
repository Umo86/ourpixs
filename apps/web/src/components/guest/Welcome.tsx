"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { Field } from "@/components/app/Field";
import { Notice } from "@/components/app/Notice";
import { useLocale, useT } from "@/i18n/client";
import { OCCASIONS, THEMES } from "@/lib/config";
import { api, errorMessage } from "@/lib/client/api";
import { formatDate } from "@/lib/client/format";
import { useGuest } from "./GuestContext";
import { Title } from "./Title";

export function Welcome({ shareToken }: { shareToken?: string }) {
  const t = useT("guest");
  const { locale } = useLocale();
  const router = useRouter();
  const { occasion: o, pinOk, api: url } = useGuest();
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const needPin = o.hasPin && !pinOk && !shareToken;
  const c = THEMES[o.theme];
  const eyebrow = [OCCASIONS[o.type].label[locale], o.startsOn ? formatDate(o.startsOn, locale, { day: "numeric", month: "long" }) : null, o.city].filter(Boolean).join(" · ");

  async function join(e: React.FormEvent) {
    e.preventDefault();
    if (!consent) { setError(t("welcome.needConsent")); return; }
    setBusy(true);
    setError(null);
    try {
      await api(url("/join"), { body: { name: name.trim(), consent: true, pin: needPin ? pin : undefined, shareToken } });
      router.refresh();
    } catch (err) {
      setError(errorMessage(t, err));
      setBusy(false);
    }
  }

  return (
    <main id="main" className="mx-auto flex w-full max-w-xl flex-1 flex-col">
      <div className="relative mx-0 flex min-h-[46dvh] flex-col justify-end overflow-hidden rounded-b-[36px] p-5 sm:mx-5 sm:rounded-[36px]" style={{ background: c.bg, color: o.coverUrl ? "#fff" : c.fg }}>
        {o.coverUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={o.coverUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
            <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
          </>
        ) : null}
        <div className="relative flex flex-col gap-2">
          {eyebrow ? <span className="self-start rounded-full bg-white px-3 py-1.5 text-xs font-bold text-ink">{eyebrow}</span> : null}
          {o.venueName ? <span className="text-sm font-semibold opacity-90">{t("welcome.atVenue", { venue: o.venueName })}</span> : null}
          <h1 className="m-0 text-[clamp(2.8rem,14vw,4rem)] font-black leading-[0.9] tracking-[-0.045em]"><Title text={o.title} accent={o.coverUrl ? "#8097FF" : c.accent} /></h1>
        </div>
      </div>

      <form onSubmit={join} className="flex flex-1 flex-col gap-5 px-5 pb-6 pt-6">
        <p className="m-0 text-2xl font-extrabold leading-tight tracking-[-0.03em]">{t("welcome.lead")} <span className="font-serif font-normal text-sky-soft">{t("welcome.leadAccent")}</span></p>
        {!o.uploadOpen ? <Notice tone="info" className="!bg-surface !text-muted-dark">{o.galleryState === "ended" ? t("welcome.closed") : t("welcome.paused")}</Notice> : null}
        <Field id="g-name" tone="dark" label={t("welcome.name")} placeholder={t("welcome.namePlaceholder")} autoComplete="given-name" required maxLength={40}
          value={name} onChange={(e) => setName(e.target.value)} className="[&_input]:text-lg" />
        {needPin ? (
          <Field id="g-pin" tone="dark" label={t("welcome.pin")} hint={t("welcome.pinHint")} inputMode="numeric" autoComplete="off" required maxLength={8}
            value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} className="[&_input]:text-lg [&_input]:tracking-[0.3em]" />
        ) : null}
        <label className="flex items-start gap-3 text-[13px] leading-snug text-muted-dark">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-[22px] w-[22px] flex-none accent-royal" />
          <span>{t("welcome.consent")} <Link href="/privacy" className="font-semibold text-sky-soft underline">{t("welcome.privacy")}</Link></span>
        </label>
        {error ? <Notice tone="error">{error}</Notice> : null}
        <button type="submit" disabled={busy || !name.trim() || (needPin && pin.length < 4)}
          className="mt-auto inline-flex min-h-[60px] items-center justify-center gap-2 rounded-full bg-royal text-lg font-extrabold text-white transition-colors hover:bg-royal-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky focus-visible:ring-offset-2 focus-visible:ring-offset-ink disabled:opacity-60">
          {busy ? t("welcome.joining") : t("welcome.cta")} <ArrowRight size={20} aria-hidden />
        </button>
        <span className="text-center text-xs text-[#A8ACB8]">{t("welcome.small")}</span>
      </form>
    </main>
  );
}
