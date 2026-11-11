"use client";
import { setLanguage, useLocale } from "@/i18n/client";
import type { Locale } from "@/lib/config";

const LOCALES: Locale[] = ["en", "tr"];

/** EN / TR switch. Sets the `lang` cookie and reloads (setLanguage). Must be inside <I18nProvider>. */
export function LanguageSwitch({ tone = "light", label = "Language", className = "" }: { tone?: "light" | "dark"; label?: string; className?: string }) {
  const { locale } = useLocale();
  const idle = tone === "dark" ? "text-muted-dark hover:text-white" : "text-muted hover:text-ink";
  const active = tone === "dark" ? "text-white" : "text-ink";
  return (
    <div role="group" aria-label={label} className={`inline-flex items-center text-[13px] ${className}`}>
      {LOCALES.map((l, i) => (
        <span key={l} className="inline-flex items-center">
          {i > 0 ? <span aria-hidden className={tone === "dark" ? "text-muted-dark" : "text-muted"}>/</span> : null}
          <button
            type="button"
            lang={l}
            aria-pressed={locale === l}
            onClick={() => locale !== l && setLanguage(l)}
            className={`inline-flex min-h-11 min-w-9 items-center justify-center rounded-md px-1.5 uppercase focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky ${locale === l ? `font-bold ${active}` : `font-medium ${idle}`}`}
          >
            {l}
          </button>
        </span>
      ))}
    </div>
  );
}
