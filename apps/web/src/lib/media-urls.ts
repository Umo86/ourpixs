/**
 * Which stored copy each viewer may see — the paywall rules for media, as a PURE function (no database, no signing,
 * no server-only imports), so scripts/paywall-check.ts can assert them with fixtures. src/lib/serializers.ts signs
 * the keys this returns; nothing else decides which key goes into a feed payload.
 *
 * Rules (docs/CONSUMER-LAUNCH.md):
 *  - Nobody gets an ORIGINAL in a list/feed/wall/share payload (`originalUrl` is always null). Originals are only
 *    handed out by the download endpoints through signed, expiring links (storage.privateGetUrl).
 *    One exception, for the host only: a photo with no display copy at all (e.g. a HEIC that neither the browser
 *    nor the server could decode) is shown to hosts from its original, because there is nothing else to show.
 *  - Hosts and co-hosts: clean copies (≈2,000 px display, thumb, 1080p video).
 *  - Live wall (the host's screen): clean copies.
 *  - A guest's OWN uploads: clean copies (they have the originals on their phone anyway).
 *  - A guest who BOUGHT "download everything" (paid, not refunded, inside its 30 days, event downloads open — decided by
 *    purchase-rules.ts → guestSeesClean, passed in as `purchased`): clean copies of everything, on that device only.
 *    The emailed /d/<token> page (the buyer's link, which also hands out the originals) is audience "buyer": clean.
 *  - Everyone else (other guests, share links / family abroad): WATERMARKED copies only (≈1,200 px guest preview,
 *    watermarked thumb, 720p watermarked video). While those are being made the item is "processing": no URL at all,
 *    never a fallback to the clean copy or the original.
 */

export type ProcessingStatus = "pending" | "ready" | "failed";

export type MediaKeyRow = {
  id: string;
  kind: "photo" | "video" | "voice";
  guestId: string | null;
  keyOriginal: string;
  keyDisplay: string | null;
  keyThumb: string | null;
  keyGuest: string | null;
  keyGuestThumb: string | null;
  keyVideo: string | null;
  keyGuestVideo: string | null;
  processingStatus: ProcessingStatus;
};

export type MediaAudience =
  | { kind: "host" }
  | { kind: "wall" }
  | { kind: "share" }
  /**
   * `guestId` = the viewing guest (null for a visitor who hasn't joined). `purchased` = this device has an active
   * "download everything" purchase (purchase-rules.ts → guestSeesClean); only then are other people's items clean.
   */
  | { kind: "guest"; guestId: string | null; purchased?: boolean }
  /** The buyer's emailed /d/<token> page (an active purchase; checked by purchaseFromToken). */
  | { kind: "buyer" };

export type PlannedMedia = {
  thumb: string | null;
  display: string | null;
  /** Videos: the transcoded MP4 to play. */
  playback: string | null;
  /** The viewer gets clean (non-watermarked) copies. */
  clean: boolean;
  /** Guest audience: the viewer uploaded this item. */
  mine: boolean;
  /** pending = copies still being made (show the "processing" state when there's no URL); failed = placeholder. */
  processing: ProcessingStatus;
};

export function planMediaKeys(m: MediaKeyRow, audience: MediaAudience): PlannedMedia {
  const mine = audience.kind === "guest" && !!audience.guestId && m.guestId === audience.guestId;
  const paidGuest = audience.kind === "guest" && !!audience.guestId && audience.purchased === true;
  const clean = audience.kind === "host" || audience.kind === "wall" || audience.kind === "buyer" || mine || paidGuest;
  const processing: ProcessingStatus = m.kind === "voice" ? "ready" : m.processingStatus;
  if (m.kind === "voice") return { thumb: null, display: null, playback: null, clean, mine, processing };

  if (clean) {
    let display = m.keyDisplay;
    // Host-only fallback: nothing else exists to show (undecodable HEIC). Never for the wall or guests.
    if (!display && m.kind === "photo" && audience.kind === "host") display = m.keyOriginal;
    const thumb = m.keyThumb ?? m.keyDisplay ?? (display === m.keyOriginal ? display : null);
    const playback = m.kind === "video" && processing === "ready" ? m.keyVideo : null;
    return { thumb, display, playback, clean, mine, processing };
  }

  // Watermarked copies only; nothing until they exist.
  const ready = processing === "ready";
  const display = ready ? m.keyGuest : null;
  const thumb = ready ? (m.keyGuestThumb ?? m.keyGuest) : null;
  const playback = ready && m.kind === "video" ? m.keyGuestVideo : null;
  return { thumb, display, playback, clean, mine, processing };
}

/** Every key an audience's payload can contain for this row (used by the paywall check). */
export function plannedKeys(p: PlannedMedia): string[] {
  return [p.thumb, p.display, p.playback].filter((k): k is string => !!k);
}
