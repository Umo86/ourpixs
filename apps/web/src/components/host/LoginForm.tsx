"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";
import { Field } from "@/components/app/Field";
import { Notice } from "@/components/app/Notice";
import { useLocale, useT } from "@/i18n/client";
import { api, errorMessage } from "@/lib/client/api";
import { BRANDS } from "@/lib/config";

export function LoginForm({ next }: { next: string }) {
  const t = useT("host");
  const { locale, brand } = useLocale();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  // Separate, unticked opt-in; recorded only once the code is verified.
  const [marketing, setMarketing] = useState(false);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  async function requestCode(e?: React.FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ ok: true; previewCode?: string }>("/api/v1/auth/request-code", { body: { email, locale, brand } });
      setPreview(r.previewCode ?? null);
      setStep("code");
      setCooldown(30);
      setTimeout(() => codeRef.current?.focus(), 50);
    } catch (err) {
      setError(errorMessage(t, err));
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/v1/auth/verify", { body: { email, code, ...(marketing ? { marketingConsent: true, locale } : {}) } });
      window.location.assign(next);
    } catch (err) {
      setError(errorMessage(t, err));
      setBusy(false);
    }
  }

  if (step === "email") {
    return (
      <form onSubmit={requestCode} className="flex flex-col gap-5" noValidate={false}>
        <h2 className="m-0 text-2xl font-extrabold tracking-tight">{t("login.emailHeading")}</h2>
        <Field id="email" type="email" required autoComplete="email" inputMode="email" label={t("login.email")} placeholder={t("login.emailPlaceholder")}
          value={email} onChange={(e) => setEmail(e.target.value)} />
        <label className="flex min-h-11 cursor-pointer items-start gap-3 text-[15px] leading-snug text-text-2">
          <input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} className="mt-0.5 h-5 w-5 flex-none accent-[#2347E0]" />
          <span>{t("marketing.optIn", { brand: BRANDS[brand].name })}</span>
        </label>
        {error ? <Notice tone="error">{error}</Notice> : null}
        <Button type="submit" size="lg" disabled={busy || !email}>{busy ? t("login.sending") : t("login.sendCode")}</Button>
        <p className="m-0 text-sm text-muted">{t("login.noPassword")}</p>
      </form>
    );
  }

  return (
    <form onSubmit={verify} className="flex flex-col gap-5">
      <h2 className="m-0 text-2xl font-extrabold tracking-tight">{t("login.codeHeading")}</h2>
      <p className="m-0 text-[15px] text-text-2">{t("login.codeSent", { email })}</p>
      {preview ? (
        <Notice tone="blue">
          <strong className="block">{t("login.previewTitle")}</strong>
          {t("login.previewBody")} <span className="font-black tracking-[0.3em]">{preview}</span>
        </Notice>
      ) : null}
      <Field ref={codeRef} id="code" label={t("login.code")} inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required
        value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
        className="[&_input]:text-center [&_input]:text-2xl [&_input]:font-black [&_input]:tracking-[0.4em]" />
      {error ? <Notice tone="error">{error}</Notice> : null}
      <Button type="submit" size="lg" disabled={busy || code.length !== 6}>{busy ? t("login.checking") : t("login.signIn")}</Button>
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <button type="button" className="min-h-11 font-semibold text-royal underline-offset-4 hover:underline disabled:text-muted disabled:no-underline" disabled={cooldown > 0 || busy} onClick={() => requestCode()}>
          {cooldown > 0 ? t("login.resendIn", { s: cooldown }) : t("login.resend")}
        </button>
        <button type="button" className="min-h-11 font-semibold text-text-2 underline-offset-4 hover:underline" onClick={() => { setStep("email"); setCode(""); setError(null); }}>
          {t("login.changeEmail")}
        </button>
      </div>
    </form>
  );
}
