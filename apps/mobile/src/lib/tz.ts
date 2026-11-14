/**
 * Wall-clock ↔ instant conversion in an IANA time zone with Intl only (copy of apps/web/src/lib/tz.ts).
 * The gallery window is entered as local date and time in the event's zone (default Europe/London) and sent as UTC.
 */
import type { Locale } from "@/config";

function partsIn(d: Date, tz: string) {
  const f = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
  return { y: +p.year!, m: +p.month!, d: +p.day!, h: +p.hour! % 24, mi: +p.minute!, s: +p.second! };
}

function offsetMinutes(d: Date, tz: string): number {
  const p = partsIn(d, tz);
  const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s);
  return Math.round((asUtc - Math.floor(d.getTime() / 1000) * 1000) / 60000);
}

/** "YYYY-MM-DD" + "HH:mm" read as wall-clock time in `tz` → the UTC instant. */
export function zonedToUtc(date: string, time: string, tz: string): Date | null {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const t = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!d || !t || +t[1]! > 23 || +t[2]! > 59) return null;
  const guess = Date.UTC(+d[1]!, +d[2]! - 1, +d[3]!, +t[1]!, +t[2]!);
  if (Number.isNaN(guess)) return null;
  try {
    let x = guess - offsetMinutes(new Date(guess), tz) * 60000;
    x = guess - offsetMinutes(new Date(x), tz) * 60000;
    return new Date(x);
  } catch {
    return null;
  }
}

/** UTC instant → { date: "DD/MM/YYYY", time: "HH:mm" } wall-clock in `tz` (for the form fields). */
export function utcToZonedFields(iso: string | null | undefined, tz: string): { date: string; time: string } {
  if (!iso) return { date: "", time: "" };
  const x = new Date(iso);
  if (Number.isNaN(x.getTime())) return { date: "", time: "" };
  try {
    const p = partsIn(x, tz);
    const pad = (n: number) => String(n).padStart(2, "0");
    return { date: `${pad(p.d)}/${pad(p.m)}/${p.y}`, time: `${pad(p.h)}:${pad(p.mi)}` };
  } catch {
    return { date: "", time: "" };
  }
}

/** "12 June, 10:00" in the app language, shown in the event's zone. */
export function formatInZone(iso: string | null | undefined, tz: string, locale: Locale, opts: { year?: boolean } = {}): string {
  if (!iso) return "";
  const x = new Date(iso);
  if (Number.isNaN(x.getTime())) return "";
  try {
    return new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-GB", {
      timeZone: tz, day: "numeric", month: "long", ...(opts.year ? { year: "numeric" } : {}), hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).format(x);
  } catch {
    return x.toLocaleString();
  }
}
