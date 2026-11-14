import "server-only";
import { cache } from "react";
import { inArray, sql, type SQL } from "drizzle-orm";
import { db, schema } from "@/db";
import { ApiError } from "./http";
import { getSettings } from "./settings";
import { computeAccess, type Access, type EventPackageRow, type OwnerRow } from "./access-rules";

/**
 * ONE place that decides what an event may do right now: the event package (setup → paid → live → ended → expired,
 * or refunded), its gallery window and the clock, 12-month retention, and the admin overrides
 * (event lock, owner suspension, "mark as paid"). The pure rules live in ./access-rules.ts (unit-testable);
 * this module adds the loaders (owner suspension + admin settings, memoised per request) and the server-side guards.
 * The UI only mirrors these guards.
 */

export * from "./access-rules";

type OccasionRow = typeof schema.occasions.$inferSelect;
export type AccessInput = EventPackageRow & { ownerId: string };

/** Owners' suspension state, memoised per request. */
const loadOwners = cache(async (key: string): Promise<Map<string, OwnerRow>> => {
  const ids = key.split(",").filter(Boolean);
  const out = new Map<string, OwnerRow>();
  if (!ids.length) return out;
  const rows = await db.select({ id: schema.hosts.id, suspendedAt: schema.hosts.suspendedAt }).from(schema.hosts).where(inArray(schema.hosts.id, ids));
  for (const r of rows) out.set(r.id, { suspendedAt: r.suspendedAt });
  return out;
});
const ownerOf = async (ownerId: string): Promise<OwnerRow> => (await loadOwners(ownerId)).get(ownerId) ?? { suspendedAt: new Date(0) };

/** Access for one event (owner + settings loaded once per request). */
export async function accessForOccasion(o: AccessInput, now = new Date()): Promise<Access> {
  const [owner, s] = await Promise.all([ownerOf(o.ownerId), getSettings()]);
  return computeAccess(o, owner, s, now);
}

/** Batch variant for lists: one owners query, keyed by event id. */
export async function accessForOccasions(rows: Pick<OccasionRow, "id" | "ownerId" | keyof EventPackageRow>[], now = new Date()): Promise<Map<string, Access>> {
  const ids = [...new Set(rows.map((r) => r.ownerId))].sort();
  const [owners, s] = await Promise.all([loadOwners(ids.join(",")), getSettings()]);
  return new Map(rows.map((r) => [r.id, computeAccess(r, owners.get(r.ownerId) ?? { suspendedAt: new Date(0) }, s, now)]));
}

// ── Server-side guards ──────────────────────────────────────────────────────────────────────────────

const unavailable = (a: Access) => a.state === "expired" || a.state === "refunded" || a.reason === "suspended";

/** Hosts and co-hosts adding photos and videos (test mode limits are checked in uploads.ts with the current count). */
export function assertCanUpload(a: Access) {
  if (a.canUpload) return;
  if (a.reason === "locked") throw new ApiError(403, "event_locked", "This event has been locked by our team. Please contact support.");
  if (a.reason === "suspended") throw new ApiError(403, "account_suspended", "This account is suspended. Please contact support.");
  if (a.state === "setup") throw new ApiError(402, "test_limit", "You've used all the test uploads. Pay for the event to open it to your guests.");
  throw new ApiError(403, "upload_closed", "This event isn't accepting uploads");
}

/** Guests opening the gallery (join, feed, wall, share links). */
export function assertGuestsCanView(a: Access) {
  if (a.guestsCanView) return;
  if (unavailable(a)) throw new ApiError(410, "event_unavailable", "This gallery is no longer available");
  throw new ApiError(403, "not_open", "This gallery isn't open yet");
}

/** Guests adding photos, videos and guestbook messages. */
export function assertGuestCanUpload(a: Access) {
  if (a.guestsCanUpload) return;
  assertGuestsCanView(a);
  if (a.reason === "locked") throw new ApiError(403, "upload_closed", "Uploads are closed for this event");
  throw new ApiError(403, "upload_closed", "The gallery has closed, so it isn't taking new photos");
}

/** Host edits that change what guests see (settings, missions, cover, share links, co-hosts). */
export function assertWritable(a: Access) {
  if (!a.readOnly) return;
  if (a.reason === "locked") throw new ApiError(403, "event_locked", "This event has been locked by our team. Please contact support.");
  if (a.reason === "suspended") throw new ApiError(403, "account_suspended", "This account is suspended. Please contact support.");
  if (a.state === "refunded") throw new ApiError(403, "event_refunded", "This event was refunded, so it can't be changed");
  throw new ApiError(410, "event_expired", "This event's files have been deleted");
}

/** Originals, ZIPs and share-link downloads. */
export function assertCanDownload(a: Access) {
  if (a.canDownload) return;
  if (a.state === "setup") throw new ApiError(402, "payment_required", "Downloads open once you've paid for the event");
  if (a.reason === "suspended") throw new ApiError(403, "account_suspended", "This account is suspended. Please contact support.");
  if (a.state === "expired") throw new ApiError(410, "event_expired", "This event's files have been deleted");
  throw new ApiError(403, "download_closed", "Downloads aren't available for this event");
}

/**
 * Host downloads: "all" once the package is paid (assertCanDownload), "test" before paying (only media a host added,
 * never a guest's: access.canDownloadTest). Throws like assertCanDownload otherwise.
 */
export function hostDownloadScope(a: Access): "all" | "test" {
  if (a.canDownload) return "all";
  if (a.canDownloadTest) return "test";
  assertCanDownload(a);
  return "all";
}

export function assertCanEditWindow(a: Access) {
  if (a.canEditWindow) return;
  assertWritable(a);
  throw new ApiError(409, "window_locked", "The gallery has already opened, so its dates can't change. You can still end it early.");
}

export function assertCanPay(a: Access) {
  if (a.canPay) return;
  if (a.paid) throw new ApiError(409, "already_paid", "This event is already paid for");
  assertWritable(a);
  throw new ApiError(409, "cannot_pay", "This event can't be paid for right now");
}

// ── SQL mirror for admin lists and the crons (keep in step with packageState in access-rules.ts) ─────────

const o0 = schema.occasions;

/** Start of the unpaid-event clock: max(created_at, setup_reset_at) (mirror of unpaidDeleteAtOf). */
export function unpaidClockSql(o: typeof o0 = o0): SQL<Date> {
  return sql<Date>`greatest(${o.createdAt}, ${o.setupResetAt})`;
}

/**
 * Effective package state as SQL text ('setup' | 'paid' | 'live' | 'ended' | 'expired' | 'refunded').
 * `retentionMonths` is only used for events without a stored delete_after; `unpaidDeleteDays` turns a setup event
 * older than that into 'expired'. A deleted event kept for guests' paid links (deleted_at) counts as 'expired'
 * (or 'refunded').
 */
export function packageStateSql(s: { retentionMonths: number; unpaidDeleteDays: number }, o: typeof o0 = o0): SQL<string> {
  const del = sql`coalesce(${o.deleteAfter}, ${o.closesAt} + make_interval(months => ${s.retentionMonths}::int))`;
  return sql<string>`(case
    when ${o.deletedAt} is not null then (case when ${o.packageStatus} = 'refunded' then 'refunded' else 'expired' end)
    when ${o.packageStatus} = 'setup' and ${unpaidClockSql(o)} + make_interval(days => ${s.unpaidDeleteDays}::int) <= now() then 'expired'
    when ${o.packageStatus} in ('refunded', 'expired', 'setup') then ${o.packageStatus}::text
    when ${del} is not null and ${del} <= now() then 'expired'
    when ${o.packageStatus} = 'ended' then 'ended'
    when ${o.closesAt} is not null and ${o.closesAt} <= now() then 'ended'
    when ${o.opensAt} is not null and ${o.closesAt} is not null and ${o.opensAt} <= now() then 'live'
    else 'paid' end)`;
}
