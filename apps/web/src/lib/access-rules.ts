/**
 * Pure event-package access rules (no database, no server-only imports), so they can be unit-tested
 * with a plain script (scripts/access-check.ts). src/lib/access.ts re-exports these and adds the loaders and guards.
 *
 * Everything derives from the EVENT: its package status, its gallery window, the clock, 12-month retention,
 * and the admin overrides (event lock, owner suspension, "marked as paid" by an admin). Co-hosts never change
 * what an event can do; the owner's account only matters when an admin has suspended it.
 */
import { addMonths } from "./window";

/** Effective state (stored package_status + the clock). */
export type PackageState = "setup" | "paid" | "live" | "ended" | "expired" | "refunded";

/**
 * Why an event is limited (API `access.reason`):
 *  setup     — not paid yet: test mode (host only, limited uploads); guests see "not open yet"
 *  not_open  — paid, gallery window hasn't started: guests see "opens on …"
 *  ended     — window over: guest uploads closed; viewing and host downloads continue until deletion
 *  expired   — past delete_after: files are deleted
 *  refunded  — refunded in full: read-only, guests can't open it
 *  suspended — owner suspended by an admin
 *  locked    — event locked by an admin (uploads closed, read-only)
 *  null      — live
 */
export type AccessReason = "setup" | "not_open" | "ended" | "expired" | "refunded" | "suspended" | "locked" | null;

export type EventPackageRow = {
  packageStatus: "setup" | "paid" | "live" | "ended" | "expired" | "refunded";
  opensAt: Date | null;
  closesAt: Date | null;
  deleteAfter: Date | null;
  adminLockedAt?: Date | null;
  compedAt?: Date | null;
  paidAt?: Date | null;
};
export type OwnerRow = { suspendedAt: Date | null } | null;
export type AccessSettings = { retentionMonths: number; hostTestUploadLimit: number };

export type Access = {
  state: PackageState;
  reason: AccessReason;
  /** Before paying: only hosts/co-hosts upload, up to `testUploadLimit` items. */
  testMode: boolean;
  testUploadLimit: number;
  /** Hosts and co-hosts may add photos/videos (test mode counts against the limit). */
  canUpload: boolean;
  /** Guests may open the gallery (join, feed, wall, share links). */
  guestsCanView: boolean;
  /** Guests may upload photos, videos and guestbook messages. */
  guestsCanUpload: boolean;
  /** Hosts may download originals and ZIPs. */
  canDownload: boolean;
  /** Host settings, missions, cover, share links and co-hosts can't change. */
  readOnly: boolean;
  /** The organiser may change the window (any time before paying; after paying, until it opens). */
  canEditWindow: boolean;
  /** The organiser may close the gallery now. */
  canEndEarly: boolean;
  /** The Pay button is offered. */
  canPay: boolean;
  /** Paid (by card or marked as paid by an admin) and not refunded. */
  paid: boolean;
  comped: boolean;
  locked: boolean;
  suspended: boolean;
  opensAt: Date | null;
  closesAt: Date | null;
  /** When the files will be deleted (paid events with a window). */
  deleteAfter: Date | null;
  deleted: boolean;
  /** Whole days until the next milestone: opening (paid), closing (live) or deletion (ended). */
  daysLeft: number | null;
};

const DAY = 86400_000;
const daysUntil = (d: Date | null, now: Date) => (d ? Math.max(0, Math.ceil((d.getTime() - now.getTime()) / DAY)) : null);

/** delete_after: stored value, else closes_at + retention. */
export function deleteAfterOf(o: Pick<EventPackageRow, "deleteAfter" | "closesAt">, retentionMonths: number): Date | null {
  return o.deleteAfter ?? (o.closesAt ? addMonths(o.closesAt, retentionMonths) : null);
}

/** Stored status + the clock. Never needs the cron to have run. */
export function packageState(o: EventPackageRow, now: Date, retentionMonths: number): PackageState {
  if (o.packageStatus === "refunded") return "refunded";
  if (o.packageStatus === "expired") return "expired";
  if (o.packageStatus === "setup") return "setup";
  const del = deleteAfterOf(o, retentionMonths);
  if (del && now >= del) return "expired";
  if (o.packageStatus === "ended") return "ended";
  if (o.closesAt && now >= o.closesAt) return "ended";
  if (o.opensAt && now >= o.opensAt && o.closesAt) return "live";
  return "paid";
}

const NONE = {
  testMode: false, canUpload: false, guestsCanView: false, guestsCanUpload: false, canDownload: false,
  readOnly: true, canEditWindow: false, canEndEarly: false, canPay: false,
};

/** What the event allows right now, with admin overrides applied (suspension wins over the event lock). */
export function computeAccess(o: EventPackageRow, owner: OwnerRow, s: AccessSettings, now = new Date()): Access {
  const state = packageState(o, now, s.retentionMonths);
  const paidStates: PackageState[] = ["paid", "live", "ended", "expired"];
  const deleteAfter = paidStates.includes(state) ? deleteAfterOf(o, s.retentionMonths) : null;
  const base = {
    state, testUploadLimit: s.hostTestUploadLimit, paid: paidStates.includes(state), comped: !!o.compedAt,
    locked: !!o.adminLockedAt, suspended: !!owner?.suspendedAt, opensAt: o.opensAt, closesAt: o.closesAt, deleteAfter,
    deleted: state === "expired",
  };
  let a: Access;
  switch (state) {
    case "setup":
      a = { ...base, ...NONE, reason: "setup", testMode: true, canUpload: s.hostTestUploadLimit > 0, readOnly: false,
        canEditWindow: true, canPay: true, daysLeft: null };
      break;
    case "paid":
      a = { ...base, ...NONE, reason: "not_open", canUpload: true, canDownload: true, readOnly: false, canEditWindow: true,
        daysLeft: daysUntil(o.opensAt, now) };
      break;
    case "live":
      a = { ...base, ...NONE, reason: null, canUpload: true, guestsCanView: true, guestsCanUpload: true, canDownload: true,
        readOnly: false, canEndEarly: true, daysLeft: daysUntil(o.closesAt, now) };
      break;
    case "ended":
      // Guest uploads close; hosts can still add their own (e.g. the photographer's shots) and download until deletion.
      a = { ...base, ...NONE, reason: "ended", canUpload: true, guestsCanView: true, canDownload: true, readOnly: false,
        daysLeft: daysUntil(deleteAfter, now) };
      break;
    case "refunded":
      a = { ...base, ...NONE, reason: "refunded", daysLeft: null };
      break;
    default:
      a = { ...base, ...NONE, reason: "expired", daysLeft: 0 };
  }
  if (base.suspended) {
    // Suspended: closed to guests as well (the guest page shows "unavailable"; feed, join and share links answer 410).
    return { ...a, canUpload: false, guestsCanView: false, guestsCanUpload: false, canDownload: false, readOnly: true, canEditWindow: false,
      canEndEarly: false, canPay: false, testMode: false, reason: "suspended" };
  }
  if (base.locked) {
    // Locked: uploads closed and nothing can be edited; viewing and downloads follow the package.
    return { ...a, canUpload: false, guestsCanUpload: false, readOnly: true, canEditWindow: false, canEndEarly: false,
      canPay: false, testMode: false, reason: a.state === "expired" || a.state === "refunded" ? a.reason : "locked" };
  }
  return a;
}

/** The per-event `access` object the API returns (shape kept from the subscription era for the mobile app). */
export type OccasionAccess = { canUpload: boolean; canDownload: boolean; readOnly: boolean; reason: AccessReason };
export const occasionAccessOf = (a: Access): OccasionAccess => ({ canUpload: a.canUpload, canDownload: a.canDownload, readOnly: a.readOnly, reason: a.reason });
