import { DEFAULT_TIME_ZONE, type Locale } from "@/lib/config";

const tag = (l: Locale) => (l === "tr" ? "tr-TR" : "en-GB");

/*
 * Timestamps are always formatted in an explicit zone (the event's, else Europe/London), never the runtime's own:
 * these helpers run on the server (UTC) AND in the browser (the visitor's zone) for the same render, and any difference
 * broke hydration (React #418, e.g. the admin moderation list in Istanbul) and showed UTC times to UK visitors in summer.
 */

/** Date only. "YYYY-MM-DD" strings are calendar dates (no zone); timestamps use `opts.timeZone` (default Europe/London). */
export function formatDate(iso: string | null | undefined, locale: Locale, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric" }) {
  if (!iso) return "";
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(iso);
  const d = dateOnly ? new Date(`${iso}T12:00:00Z`) : new Date(iso);
  return d.toLocaleDateString(tag(locale), { ...opts, timeZone: dateOnly ? "UTC" : opts.timeZone ?? DEFAULT_TIME_ZONE });
}

/** Day, month and time in `timeZone` (default Europe/London; pass the event's zone for event times). */
export function formatDateTime(iso: string | null | undefined, locale: Locale, timeZone: string = DEFAULT_TIME_ZONE) {
  if (!iso) return "";
  return new Date(iso).toLocaleString(tag(locale), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone });
}

export function formatNumber(n: number, locale: Locale) {
  return n.toLocaleString(tag(locale));
}

export function formatBytes(n: number, locale: Locale) {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toLocaleString(tag(locale), { maximumFractionDigits: v < 10 && i > 0 ? 1 : 0 })} ${units[i]}`;
}

export function formatDuration(s: number | null | undefined) {
  if (!s && s !== 0) return "";
  const m = Math.floor(s / 60);
  const r = Math.round(s % 60);
  return `${m}:${String(r).padStart(2, "0")}`;
}

/** "Just now", "5 min", "2 h", else a date. */
export function timeAgo(iso: string, locale: Locale) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(tag(locale), { numeric: "auto", style: "short" });
  if (diff < 60) return rtf.format(0, "second");
  if (diff < 3600) return rtf.format(-Math.round(diff / 60), "minute");
  if (diff < 86400) return rtf.format(-Math.round(diff / 3600), "hour");
  if (diff < 7 * 86400) return rtf.format(-Math.round(diff / 86400), "day");
  return formatDate(iso, locale, { day: "numeric", month: "short" });
}

export function initial(name: string | null | undefined) {
  return (name || "?").trim().charAt(0).toLocaleUpperCase() || "?";
}
