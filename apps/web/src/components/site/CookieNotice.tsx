"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useT } from "@/i18n/client";
import { Button } from "@/components/ui/Button";

const KEY = "cookie-notice-dismissed";

/**
 * Small dismissible notice. We only use essential cookies (session, language, guest token),
 * so this is information, not a consent wall. Needs <I18nProvider> (root layout).
 */
export function CookieNotice() {
  const t = useT("marketing");
  const [show, setShow] = useState(false);
  useEffect(() => {
    try {
      if (!localStorage.getItem(KEY)) setShow(true);
    } catch {
      setShow(true);
    }
  }, []);
  if (!show) return null;
  const dismiss = () => {
    try { localStorage.setItem(KEY, "1"); } catch { /* ignore */ }
    setShow(false);
  };
  return (
    <div role="region" aria-label={t("site.cookieLabel")} className="fixed inset-x-3 bottom-3 z-50 mx-auto flex max-w-[640px] flex-wrap items-center gap-x-5 gap-y-3 rounded-3xl bg-ink px-5 py-4 text-sm text-white shadow-2xl sm:bottom-5">
      <p className="m-0 min-w-0 flex-[1_1_260px] leading-snug">
        {t("site.cookieText")}{" "}
        <Link href="/privacy" className="font-semibold text-sky-soft underline">{t("site.cookieLink")}</Link>
      </p>
      <Button variant="light" onClick={dismiss}>{t("site.cookieOk")}</Button>
    </div>
  );
}
