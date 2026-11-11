import type { Locale } from "@/lib/config";

/** Locale-keyed content helper: content files export { en: T, tr: T }. */
export type L<T> = Record<Locale, T>;
export type FaqItem = { q: string; a: string };
export type Para = { h: string; p: string[] };
