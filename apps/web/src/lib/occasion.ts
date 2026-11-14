import "server-only";
import { sql, type SQL } from "drizzle-orm";
import { schema } from "@/db";
import { BRANDS, FEATURES, OCCASIONS, brandBaseUrl, type Locale, type OccasionType } from "./config";
import { hmac, requireEnv } from "./crypto";

type OccasionRow = typeof schema.occasions.$inferSelect;
type DayRow = typeof schema.days.$inferSelect;

/** Language an event's stored data (moment tags) is kept in. Not the UI language: see BRANDS.contentLocale. */
export function brandLocale(o: Pick<OccasionRow, "brand">): Locale {
  return BRANDS[o.brand].contentLocale;
}

/** Public link: the vanity name when set, otherwise the random slug (which keeps working as an alias). */
export function publicSlug(o: Pick<OccasionRow, "slug" | "vanitySlug">) {
  return o.vanitySlug || o.slug;
}
export function guestUrl(o: Pick<OccasionRow, "brand" | "slug" | "vanitySlug">) {
  return `${brandBaseUrl(o.brand)}/g/${publicSlug(o)}`;
}
/** Per-day link: preselects and locks that day in the guest app. */
export function dayGuestUrl(o: Pick<OccasionRow, "brand" | "slug" | "vanitySlug">, dayId: string) {
  return `${guestUrl(o)}?d=${dayId}`;
}
export function dayUploadOpen(d: { uploadOpensAt: Date | null; uploadClosesAt: Date | null }, now = new Date()) {
  if (d.uploadOpensAt && now < d.uploadOpensAt) return false;
  if (d.uploadClosesAt && now >= d.uploadClosesAt) return false;
  return true;
}

/** The wall link carries a key derived from the occasion id so a guest who knows the slug can't open the wall without it. */
export function wallKey(o: Pick<OccasionRow, "id">) {
  return hmac(requireEnv("GUEST_TOKEN_SECRET", 16), `wall:${o.id}`).slice(0, 22);
}
export function wallUrl(o: Pick<OccasionRow, "brand" | "slug" | "vanitySlug" | "id">) {
  return `${brandBaseUrl(o.brand)}/wall/${publicSlug(o)}?k=${wallKey(o)}`;
}

export function shareUrl(o: Pick<OccasionRow, "brand">, token: string) {
  return `${brandBaseUrl(o.brand)}/s/${token}`;
}

/**
 * Guest uploads right now. `guestsCanUpload` comes from the event package (access.ts: live window, not locked);
 * the optional legacy per-event upload window (upload_opens_at / upload_closes_at) can narrow it further.
 */
export function uploadOpen(o: OccasionRow, guestsCanUpload: boolean, now = new Date()): boolean {
  if (!guestsCanUpload) return false;
  if (o.status !== "active") return false;
  if (o.uploadOpensAt && now < o.uploadOpensAt) return false;
  if (o.uploadClosesAt && now >= o.uploadClosesAt) return false;
  return true;
}

/** Hour (UTC) the "next morning" reveal happens when the host hasn't picked an exact time. */
const REVEAL_HOUR_UTC = 9;

/** Explicit reveal time, or the morning after the event date. null = per-photo "next morning". */
export function effectiveRevealAt(o: OccasionRow): Date | null {
  if (o.revealAt) return o.revealAt;
  if (o.startsOn) {
    const d = new Date(`${o.startsOn}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    d.setUTCHours(REVEAL_HOUR_UTC);
    return d;
  }
  return null;
}

function revealCondition(o: OccasionRow): SQL {
  const at = effectiveRevealAt(o);
  if (at) return Date.now() >= at.getTime() ? sql`true` : sql`false`;
  // Revealed once it's past REVEAL_HOUR_UTC on the day after the shot was taken.
  return sql`${schema.media.createdAt} < date_trunc('day', now() - make_interval(hours => ${24 + REVEAL_HOUR_UTC})) + interval '1 day'`;
}

/** SQL filter for what other guests may see: next-morning mode hides everything, disposable shots are always developed overnight. */
export function revealedForGuests(o: OccasionRow): SQL {
  if (o.revealMode === "next_morning") return revealCondition(o);
  return sql`(${schema.media.fromDisposable} = false or ${revealCondition(o)})`;
}

export function isFeedRevealed(o: OccasionRow): boolean {
  if (o.revealMode !== "next_morning") return true;
  const at = effectiveRevealAt(o);
  return at ? Date.now() >= at.getTime() : false;
}

/** Days guests can use, in order (every event gets up to FEATURES.maxDays). */
export function activeDays(_o: OccasionRow, days: DayRow[]) {
  return [...days].sort((a, b) => a.sortOrder - b.sortOrder).slice(0, FEATURES.maxDays);
}

export function momentLabels(type: OccasionType, locale: Locale): string[] {
  return OCCASIONS[type].moments.map((m) => m[locale]);
}

/** Accepts a moment label in either language and stores it in the occasion's own language. */
export function canonicalMoment(o: Pick<OccasionRow, "type" | "brand">, tag: string | null | undefined): string | null {
  if (!tag) return null;
  const t = tag.trim().toLowerCase();
  const loc = brandLocale(o);
  const hit = OCCASIONS[o.type as OccasionType].moments.find((m) => m.en.toLowerCase() === t || m.tr.toLowerCase() === t);
  return hit ? hit[loc] : null;
}

export function localizeMoment(type: OccasionType, tag: string | null, locale: Locale): string | null {
  if (!tag) return null;
  const t = tag.toLowerCase();
  const hit = OCCASIONS[type].moments.find((m) => m.en.toLowerCase() === t || m.tr.toLowerCase() === t);
  return hit ? hit[locale] : tag;
}

export function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}
