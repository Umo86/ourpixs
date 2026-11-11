"use client";
import { createContext, useContext, useMemo } from "react";
import type { Locale, Brand } from "@/lib/config";
import { makeT, type Namespace } from "./shared";

const Ctx = createContext<{ locale: Locale; brand: Brand }>({ locale: "en", brand: "ourpixs" });

export function I18nProvider({ locale, brand, children }: { locale: Locale; brand: Brand; children: React.ReactNode }) {
  return <Ctx.Provider value={{ locale, brand }}>{children}</Ctx.Provider>;
}

export function useLocale() {
  return useContext(Ctx);
}

export function useT(ns: Namespace) {
  const { locale } = useContext(Ctx);
  return useMemo(() => makeT(locale, ns), [locale, ns]);
}

/** Sets the `lang` cookie and reloads. Used by every EN/TR switch. */
export function setLanguage(lang: Locale) {
  document.cookie = `lang=${lang}; path=/; max-age=31536000; samesite=lax`;
  window.location.reload();
}
