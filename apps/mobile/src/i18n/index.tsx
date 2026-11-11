import { getLocales } from "expo-localization";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { brandForLocale, type Brand, type Locale } from "@/config";
import { storage } from "@/lib/storage";
import en, { type Messages } from "./en";
import tr from "./tr";

const DICTS: Record<Locale, Messages> = { en, tr };
const LOCALE_KEY = "op_locale";

/** Dot-paths to string leaves of the dictionary, e.g. "auth.sendCode". */
type Leaves<T, P extends string = ""> = {
  [K in keyof T & string]: T[K] extends string
    ? `${P}${K}`
    : T[K] extends readonly unknown[]
      ? never
      : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];
/** Dot-paths to string-array leaves. */
type ListLeaves<T, P extends string = ""> = {
  [K in keyof T & string]: T[K] extends readonly string[]
    ? `${P}${K}`
    : T[K] extends string
      ? never
      : ListLeaves<T[K], `${P}${K}.`>;
}[keyof T & string];

export type TKey = Leaves<Messages>;
export type TListKey = ListLeaves<Messages>;
export type Vars = Record<string, string | number>;

function lookup(dict: Messages, key: string): unknown {
  let cur: unknown = dict;
  for (const part of key.split(".")) {
    if (cur && typeof cur === "object" && part in (cur as Record<string, unknown>)) cur = (cur as Record<string, unknown>)[part];
    else return undefined;
  }
  return cur;
}

function interpolate(s: string, vars?: Vars): string {
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

export function translate(locale: Locale, key: TKey, vars?: Vars): string {
  const v = lookup(DICTS[locale], key) ?? lookup(DICTS.en, key);
  return typeof v === "string" ? interpolate(v, vars) : key;
}

export function deviceLocale(): Locale {
  try {
    const lang = getLocales()[0]?.languageCode?.toLowerCase();
    return lang === "tr" ? "tr" : "en";
  } catch {
    return "en";
  }
}

type Ctx = {
  locale: Locale;
  brand: Brand;
  ready: boolean;
  setLocale: (l: Locale) => void;
  t: (key: TKey, vars?: Vars) => string;
  tList: (key: TListKey) => string[];
};

const I18nContext = createContext<Ctx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(deviceLocale());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    storage.get(LOCALE_KEY).then((saved) => {
      if (!alive) return;
      if (saved === "en" || saved === "tr") setLocaleState(saved);
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    void storage.set(LOCALE_KEY, l);
    for (const fn of listeners) fn(l);
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      locale,
      brand: brandForLocale(locale),
      ready,
      setLocale,
      t: (key, vars) => translate(locale, key, vars),
      tList: (key) => {
        const v = lookup(DICTS[locale], key);
        return Array.isArray(v) ? (v as string[]) : [];
      },
    }),
    [locale, ready, setLocale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

const listeners = new Set<(l: Locale) => void>();
/** Subscribe to explicit language changes (used to sync the host profile). */
export function onLocaleChange(fn: (l: Locale) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function useI18n(): Ctx {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>");
  return ctx;
}

/** The translate function for the current locale. */
export function useT() {
  return useI18n().t;
}
