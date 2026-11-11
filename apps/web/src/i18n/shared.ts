import type { Locale } from "@/lib/config";
import enCommon from "@/messages/en/common.json";
import trCommon from "@/messages/tr/common.json";
import enMarketing from "@/messages/en/marketing.json";
import trMarketing from "@/messages/tr/marketing.json";
import enHost from "@/messages/en/host.json";
import trHost from "@/messages/tr/host.json";
import enGuest from "@/messages/en/guest.json";
import trGuest from "@/messages/tr/guest.json";
import enAdmin from "@/messages/en/admin.json";
import trAdmin from "@/messages/tr/admin.json";

const MESSAGES = {
  en: { common: enCommon, marketing: enMarketing, host: enHost, guest: enGuest, admin: enAdmin },
  tr: { common: trCommon, marketing: trMarketing, host: trHost, guest: trGuest, admin: trAdmin },
} as const;

export type Namespace = keyof (typeof MESSAGES)["en"];
type Dict = Record<string, unknown>;

function lookup(dict: Dict, key: string): unknown {
  return key.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Dict)[k] : undefined), dict);
}

/**
 * t("hero.title", { name: "Elif" }) → string with {name} replaced.
 * Missing TR keys fall back to EN; missing EN keys return the key (so gaps are visible).
 */
export function makeT(locale: Locale, ns: Namespace) {
  const primary = MESSAGES[locale][ns] as Dict;
  const fallback = MESSAGES.en[ns] as Dict;
  return (key: string, vars?: Record<string, string | number>): string => {
    let v = lookup(primary, key);
    if (typeof v !== "string") v = lookup(fallback, key);
    if (typeof v !== "string") return key;
    return vars ? (v as string).replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`)) : (v as string);
  };
}

/** For arrays/objects in message files (e.g. FAQ lists). */
export function getMessage<T = unknown>(locale: Locale, ns: Namespace, key: string): T {
  const v = lookup(MESSAGES[locale][ns] as Dict, key);
  return (v ?? lookup(MESSAGES.en[ns] as Dict, key)) as T;
}
