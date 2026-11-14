"use client";
import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { Mail, X } from "lucide-react";
import { useLocale, useT } from "@/i18n/client";
import { api, errorMessage } from "@/lib/client/api";
import { BRANDS } from "@/lib/config";
import { UPLOAD_COUNT_EVENT, uploadCountKey, useGuest } from "./GuestContext";

/** Uploads on this device before the card appears. */
const AFTER_UPLOADS = 3;
const seenKey = (slug: string) => `op_eo_${slug}`;

/**
 * "Want all the photos from this event emailed to you afterwards?" Shown once per device, after the guest's 3rd
 * successful upload, until they send it or close it. Email is optional and never needed to upload. The marketing box is
 * a SEPARATE opt-in, unticked by default; sending the email alone works.
 */
export function EmailOffer() {
  const t = useT("guest");
  const { locale, brand } = useLocale();
  const { slug, guest, occasion: o, api: url } = useGuest();
  const [show, setShow] = useState(false);
  const [email, setEmail] = useState("");
  const [marketing, setMarketing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const id = useId();

  useEffect(() => {
    if (!guest || slug === "demo" || o.galleryState === "unavailable") return;
    const check = () => {
      try {
        if (localStorage.getItem(seenKey(slug))) return setShow(false);
        setShow(Number(localStorage.getItem(uploadCountKey(slug)) || 0) >= AFTER_UPLOADS);
      } catch { setShow(false); }
    };
    check();
    window.addEventListener(UPLOAD_COUNT_EVENT, check);
    return () => window.removeEventListener(UPLOAD_COUNT_EVENT, check);
  }, [guest, slug, o.galleryState]);

  const remember = (v: string) => { try { localStorage.setItem(seenKey(slug), v); } catch { /* private mode */ } };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api(url("/contact"), { body: { email: email.trim(), marketing, locale } });
      remember("sent");
      setDone(true);
    } catch (err) {
      setError(errorMessage(t, err));
    } finally {
      setBusy(false);
    }
  }

  if (!show) return null;
  if (done) {
    return (
      <div role="status" className="flex items-start justify-between gap-3 rounded-[28px] bg-surface p-5">
        <p className="m-0 text-[15px] font-bold">{t("emailOffer.thanks")}</p>
        <button type="button" onClick={() => setShow(false)} aria-label={t("common.close")} className="inline-flex h-11 w-11 flex-none items-center justify-center rounded-full bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky"><X size={18} aria-hidden /></button>
      </div>
    );
  }
  return (
    <section aria-labelledby={`${id}-h`} className="relative flex flex-col gap-4 rounded-[28px] bg-surface p-6">
      <button type="button" onClick={() => { remember("dismissed"); setShow(false); }} aria-label={t("emailOffer.dismiss")}
        className="absolute right-3 top-3 inline-flex h-11 w-11 items-center justify-center rounded-full bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky"><X size={18} aria-hidden /></button>
      <span aria-hidden className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-royal"><Mail size={20} /></span>
      <h2 id={`${id}-h`} className="m-0 pr-10 text-xl font-black leading-tight tracking-tight">{t("emailOffer.title")}</h2>
      <p className="m-0 text-[15px] text-muted-dark">{t("emailOffer.body")}</p>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <label htmlFor={`${id}-e`} className="text-[13px] font-bold text-muted-dark">{t("emailOffer.emailLabel")}</label>
        <input id={`${id}-e`} type="email" required autoComplete="email" inputMode="email" maxLength={200} value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder={t("emailOffer.emailPlaceholder")}
          className="min-h-12 rounded-full border-[1.5px] border-[#3A3F52] bg-ink px-5 text-[16px] text-white outline-none placeholder:text-[#8A8FA0] focus-visible:border-sky focus-visible:ring-2 focus-visible:ring-sky" />
        <label className="flex min-h-11 cursor-pointer items-start gap-3 text-[14px] leading-snug">
          <input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} className="mt-0.5 h-5 w-5 flex-none accent-[#4D6BFF]" />
          <span>{t("emailOffer.marketing", { brand: BRANDS[brand].name })}</span>
        </label>
        {error ? <p role="alert" className="m-0 rounded-2xl bg-surface-2 p-3 text-sm">{error}</p> : null}
        <button type="submit" disabled={busy || !email.trim()} className="inline-flex min-h-12 items-center justify-center rounded-full bg-royal px-6 font-extrabold text-white hover:bg-royal-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky disabled:opacity-60">
          {busy ? t("emailOffer.sending") : t("emailOffer.submit")}
        </button>
        <p className="m-0 text-xs text-[#A8ACB8]">{t("emailOffer.fine")} <Link href="/privacy" className="font-bold text-sky-soft underline">{t("emailOffer.privacy")}</Link></p>
      </form>
    </section>
  );
}
