/**
 * Pure rules for guest downloads of originals (no database, no server-only imports; exercised by
 * scripts/paywall-check.ts). src/lib/guest-purchase.ts loads the rows and applies these.
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

/** What the event allows (from access-rules: guests can open the gallery; the event's files can be downloaded). */
export type EventDownloadState = { guestsCanView: boolean; canDownload: boolean };

/**
 * May this guest receive a signed link to this ORIGINAL?
 *  - their own upload: always free (while they can open the gallery);
 *  - anyone else's: only with an active paid purchase, and only while the event's downloads are open.
 */
export function guestMayDownloadOriginal(opts: {
  mediaGuestId: string | null;
  viewerGuestId: string | null;
  purchase: PurchaseLike | null | undefined;
  event: EventDownloadState;
  now?: Date;
}): boolean {
  const own = !!opts.viewerGuestId && opts.mediaGuestId === opts.viewerGuestId;
  if (own) return opts.event.guestsCanView || opts.event.canDownload;
  return opts.event.canDownload && purchaseActive(opts.purchase, opts.now);
}

/**
 * A paying guest's feed shows CLEAN display copies instead of watermarked ones: an active purchase (paid, not refunded,
 * inside its 30 days) and the event's downloads still open. Everyone else stays watermarked.
 */
export function guestSeesClean(purchase: PurchaseLike | null | undefined, event: EventDownloadState, now = new Date()): boolean {
  return event.canDownload && purchaseActive(purchase, now);
}

/** Guests can buy "download everything" only for a paid event that is live or ended (not expired, refunded or suspended). */
export function guestPurchaseOffered(event: EventDownloadState & { paid: boolean }): boolean {
  return event.paid && event.guestsCanView && event.canDownload;
}

export const PURCHASE_VALID_DAYS = 30;
/** ZIPs above this are split per day (browsers struggle with very large single downloads). */
export const SPLIT_ZIP_BYTES = 2 * 1024 ** 3;

/** What a purchase covers right now (download pages). `split`: offer one ZIP per day instead of one big ZIP. */
export type PurchaseSummary = { photos: number; videos: number; bytes: number; days: { id: string | null; name: string | null; count: number; bytes: number }[]; split: boolean };
