"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useT } from "@/i18n/client";
import { Button } from "@/components/ui/Button";

const KEY = "cookie-notice-dismissed";

/**
 * Small dismissible notice. We only use essential cookies (session, language, guest token),
 * so this is information, not a consent wall. Needs <I18nProvider> (root layout).
 *
 * Default: a compact bar fixed to the bottom of the screen, plus a block of its height at the end of the page
 * (render it after the footer), so the footer and its language switch can always be scrolled clear of it.
 * `inline`: a quiet card in the page flow (guest app), so it never sits on the name field, the join button or the tab bar.
 */
export function CookieNotice({ inline = false }: { inline?: boolean }) {
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
  const text = (
    <p className="m-0 min-w-0 flex-1 leading-snug">
      {t("site.cookieText")}{" "}
      <Link href="/privacy" className="font-semibold text-sky-soft underline">{t("site.cookieLink")}</Link>
    </p>
  );
  if (inline) {
    return (
      <div role="region" aria-label={t("site.cookieLabel")} className="mx-auto mt-6 flex w-full max-w-xl items-center gap-3 px-5 pb-4 text-[13px] text-muted-dark">
        <div className="flex w-full items-center gap-3 rounded-3xl bg-surface py-2.5 pl-5 pr-2.5">
          {text}
          <Button variant="light" className="flex-none !px-5" onClick={dismiss}>{t("site.cookieOk")}</Button>
        </div>
      </div>
    );
  }
  return (
    // The block keeps the end of the page (footer, language switch) reachable above the fixed bar.
    <div className="h-28 bg-ink sm:h-24 print:hidden">
      <div role="region" aria-label={t("site.cookieLabel")} className="fixed inset-x-3 bottom-[max(12px,env(safe-area-inset-bottom))] z-50 mx-auto flex max-w-[640px] items-center gap-3 rounded-3xl bg-ink py-2.5 pl-5 pr-2.5 text-[13px] text-white shadow-2xl ring-1 ring-white/15 sm:bottom-5 sm:gap-5 sm:py-3 sm:text-sm">
        {text}
        <Button variant="light" className="flex-none !px-5" onClick={dismiss}>{t("site.cookieOk")}</Button>
      </div>
    </div>
  );
}
