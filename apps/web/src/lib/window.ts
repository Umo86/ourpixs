/**
 * Gallery window rules (pure; used by the server, the access test script and the client editors).
 * The window is when guests can join and upload: opens_at ≤ now < closes_at, at most `windowDays` long.
 */
import { DEFAULT_WINDOW_START_HOUR } from "./config";
import { zonedToUtc } from "./tz";

const DAY = 86400_000;

export type WindowError = "window_incomplete" | "window_order" | "window_too_long" | "window_past";

/** Adds whole calendar months in UTC (31 Jan + 1 month → 3 Mar, like Postgres would roll over; good enough for retention). */
export function addMonths(d: Date, months: number): Date {
  const x = new Date(d);
  x.setUTCMonth(x.getUTCMonth() + months);
  return x;
}

/** Default window: the event date at 10:00 in the event's zone, for `windowDays` days. */
export function defaultWindow(date: string | null | undefined, tz: string, windowDays: number): { opensAt: Date; closesAt: Date } | null {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const opensAt = zonedToUtc(`${date}T${String(DEFAULT_WINDOW_START_HOUR).padStart(2, "0")}:00`, tz);
  if (!opensAt) return null;
  return { opensAt, closesAt: new Date(opensAt.getTime() + windowDays * DAY) };
}

/**
 * Checks a proposed window. `now` matters only for the end: a window that is already over can't be booked.
 * Returns null when it's fine.
 */
export function windowError(w: { opensAt: Date | null; closesAt: Date | null }, windowDays: number, now = new Date()): WindowError | null {
  if (!w.opensAt || !w.closesAt) return "window_incomplete";
  if (w.opensAt.getTime() >= w.closesAt.getTime()) return "window_order";
  // One minute of slack for rounding in the pickers.
  if (w.closesAt.getTime() - w.opensAt.getTime() > windowDays * DAY + 60_000) return "window_too_long";
  if (w.closesAt.getTime() <= now.getTime()) return "window_past";
  return null;
}
