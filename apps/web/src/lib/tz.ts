/**
 * Wall-clock ↔ instant conversion in an IANA time zone, with Intl only (safe on server and client).
 * The gallery window is entered as local date/time in the event's zone (default Europe/London) and stored as UTC.
 */

/** True when `tz` is a zone this runtime knows. */
export function isTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Wall-clock parts of an instant in `tz`. */
function partsIn(d: Date, tz: string) {
  const f = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
  return { y: +p.year!, m: +p.month!, d: +p.day!, h: +p.hour! % 24, mi: +p.minute!, s: +p.second! };
}

/** Offset of `tz` from UTC at instant `d`, in minutes (London summer = 60). */
function offsetMinutes(d: Date, tz: string): number {
  const p = partsIn(d, tz);
  const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s);
  return Math.round((asUtc - Math.floor(d.getTime() / 1000) * 1000) / 60000);
}

/**
 * "2027-06-12T10:00" read as wall-clock time in `tz` → the UTC instant.
 * Times that don't exist (spring-forward gap) move forward by the gap; repeated times (autumn) take the first.
 */
export function zonedToUtc(local: string, tz: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!m) return null;
  const guess = Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!, +m[4]!, +m[5]!);
  if (Number.isNaN(guess)) return null;
  // Two passes settle DST edges.
  let t = guess - offsetMinutes(new Date(guess), tz) * 60000;
  t = guess - offsetMinutes(new Date(t), tz) * 60000;
  return new Date(t);
}

/** UTC instant → "YYYY-MM-DDTHH:mm" wall-clock in `tz` (the value of an <input type="datetime-local">). */
export function utcToZoned(d: Date | string | null | undefined, tz: string): string {
  if (!d) return "";
  const x = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(x.getTime())) return "";
  const p = partsIn(x, tz);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${p.y}-${pad(p.m)}-${pad(p.d)}T${pad(p.h)}:${pad(p.mi)}`;
}

/** "Saturday 12 June 2027, 10:00" in the viewer's language, shown in the event's zone. */
export function formatInZone(d: Date | string | null | undefined, tz: string, locale: "en" | "tr", opts: { weekday?: boolean; year?: boolean } = {}): string {
  if (!d) return "";
  const x = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(x.getTime())) return "";
  return new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-GB", {
    timeZone: tz, day: "numeric", month: "long", ...(opts.year === false ? {} : { year: "numeric" }),
    ...(opts.weekday ? { weekday: "long" } : {}), hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).format(x);
}

/** Short zone label for the UI, e.g. "Europe/London (GMT+1)". */
export function zoneLabel(tz: string, at = new Date()): string {
  const off = offsetMinutes(at, tz);
  const sign = off >= 0 ? "+" : "−";
  const h = Math.floor(Math.abs(off) / 60);
  const m = Math.abs(off) % 60;
  return `${tz.replace(/_/g, " ")} (GMT${off === 0 ? "" : `${sign}${h}${m ? `:${String(m).padStart(2, "0")}` : ""}`})`;
}
