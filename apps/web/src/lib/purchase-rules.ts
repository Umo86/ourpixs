/**
 * Pure rules for guest downloads of originals (no database, no server-only imports; exercised by
 * scripts/paywall-check.ts). src/lib/guest-purchase.ts loads the rows and applies these.
 *
 * A guest who paid for "download everything" keeps it for its full 30 days, whatever happens to the event afterwards:
 * the host's package refunded, the event deleted (by the host, with the account, by an admin or as an unpaid event),
 * retention expiry, or an admin resetting it to setup. The event's files are kept until the latest active purchase
 * expires (occasions.files_delete_after). Only these end a purchase early: a refund of the purchase itself, the owner's
 * account suspended, or the event locked by an admin (abuse). An admin removing one item still removes that item.
 */

/** A guest's "download everything" purchase as far as access is concerned. */
export type PurchaseLike = {
  status: string;
  tokenExpiresAt: Date | null;
};

/** Paid, not refunded, inside its 30 days. */
export function purchaseActive(p: PurchaseLike | null | undefined, now = new Date()): boolean {
  return !!p && p.status === "paid" && !!p.tokenExpiresAt && p.tokenExpiresAt.getTime() > now.getTime();
}

/** The only event facts that can end an active purchase early (from access-rules: owner suspended, event locked by an admin). */
export type PurchaseBlockers = { suspended: boolean; locked: boolean };

/**
 * May this purchase be used right now? Active (paid, not refunded, inside 30 days) and the event not suspended or
 * locked. Deliberately independent of the event's package state (refunded / ended / expired / setup / deleted).
 */
export function purchaseUsable(p: PurchaseLike | null | undefined, event: PurchaseBlockers, now = new Date()): boolean {
  return purchaseActive(p, now) && !event.suspended && !event.locked;
}

/** What the event allows (from access-rules: guests can open the gallery; the event's files can be downloaded; blockers). */
export type EventDownloadState = { guestsCanView: boolean; canDownload: boolean } & PurchaseBlockers;

/**
 * May this guest receive a signed link to this ORIGINAL?
 *  - with a usable paid purchase: anything the purchase covers (see purchaseUsable), whatever the event's package state;
 *  - their own upload without a purchase: free while they can open the gallery or the event's downloads are open;
 *  - anyone else's without a purchase: never.
 */
export function guestMayDownloadOriginal(opts: {
  mediaGuestId: string | null;
  viewerGuestId: string | null;
  purchase: PurchaseLike | null | undefined;
  event: EventDownloadState;
  now?: Date;
}): boolean {
  if (!opts.viewerGuestId) return false;
  if (purchaseUsable(opts.purchase, opts.event, opts.now)) return true;
  const own = opts.mediaGuestId === opts.viewerGuestId;
  return own && (opts.event.guestsCanView || opts.event.canDownload);
}

/**
 * A paying guest's feed shows CLEAN display copies instead of watermarked ones: a usable purchase (paid, not refunded,
 * inside its 30 days, event not suspended or locked). Everyone else stays watermarked.
 */
export function guestSeesClean(purchase: PurchaseLike | null | undefined, event: PurchaseBlockers, now = new Date()): boolean {
  return purchaseUsable(purchase, event, now);
}

/**
 * Guests can buy "download everything" only for a paid event that is live or ended (not expired, refunded, deleted or
 * suspended), and never while an admin has locked it (the purchase couldn't be used: purchaseUsable).
 */
export function guestPurchaseOffered(event: { guestsCanView: boolean; canDownload: boolean; paid: boolean } & PurchaseBlockers): boolean {
  return event.paid && event.guestsCanView && event.canDownload && !event.suspended && !event.locked;
}

/**
 * When an event's files may finally go: the latest expiry among its active purchases, or null when none is active
 * (delete now). Used by every deletion path (host, account, admin, unpaid limit, retention).
 */
export function filesKeptUntil(purchases: PurchaseLike[], now = new Date()): Date | null {
  let until: Date | null = null;
  for (const p of purchases) {
    if (!purchaseActive(p, now)) continue;
    if (!until || p.tokenExpiresAt!.getTime() > until.getTime()) until = p.tokenExpiresAt!;
  }
  return until;
}

export const PURCHASE_VALID_DAYS = 30;
/** ZIPs above this are split per day (browsers struggle with very large single downloads). */
export const SPLIT_ZIP_BYTES = 2 * 1024 ** 3;

/** What a purchase covers right now (download pages). `split`: offer one ZIP per day instead of one big ZIP. */
export type PurchaseSummary = { photos: number; videos: number; bytes: number; days: { id: string | null; name: string | null; count: number; bytes: number }[]; split: boolean };
