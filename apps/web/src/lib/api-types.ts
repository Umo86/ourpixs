/** JSON API types — mirror docs/API.md exactly. Safe to import from client components. */
import type { Brand, Locale, OccasionType } from "./config";

export type Host = { id: string; email: string; name: string | null; locale: Locale; brand: Brand };
/** Effective event package state (src/lib/access-rules.ts). */
export type PackageStatus = "setup" | "paid" | "live" | "ended" | "expired" | "refunded";
/**
 * Per-event access, derived from the event package (shape kept from the subscription era).
 * reason: "setup" (not paid; test mode) | "not_open" (paid, window not started) | "ended" | "expired" | "refunded"
 *         | "suspended" (owner suspended) | "locked" (event locked by our team) | null (live).
 * canUpload is the host's (and co-hosts') upload right; guests follow PublicOccasion.uploadsOpen.
 */
export type OccasionAccess = { canUpload: boolean; canDownload: boolean; readOnly: boolean; reason: "setup" | "not_open" | "ended" | "expired" | "refunded" | "suspended" | "locked" | null };
/** The event package as shown to members (host Occasion). */
export type EventPackage = {
  status: PackageStatus;
  pricePence: number;
  paidAt: string | null;
  /** Marked as paid by our team (no payment). */
  comped: boolean;
  opensAt: string | null; closesAt: string | null; timeZone: string;
  /** When files will be deleted (paid events); null before paying. */
  deleteAfter: string | null;
  /** Test mode (before paying): host/co-host uploads only, up to testUploadLimit items. */
  testMode: boolean; testUploadLimit: number;
  canEditWindow: boolean; canEndEarly: boolean; canPay: boolean;
  /** Longest window in days (admin setting). */
  windowDays: number;
  /** Additive: longest video in seconds (admin setting; checked before upload and on the server). */
  videoMaxSeconds: number;
  daysLeft: number | null;
};
export type Theme = "noir" | "royal" | "ivory" | "dusk" | "mono" | "blush";
export type Day = {
  id: string; name: string; date: string | null; sortOrder: number;
  /** Additive: optional per-day upload window. */
  uploadOpensAt?: string | null; uploadClosesAt?: string | null;
  /** Additive (host Occasion only): per-day guest link that locks this day. */
  guestUrl?: string;
  /** Additive (PublicOccasion only): whether this day currently accepts uploads. */
  uploadOpen?: boolean;
  /** Additive (host Occasion only): false when the day is beyond the 5-day limit and hidden from guests. */
  active?: boolean;
};

export type OccasionSummary = {
  id: string; slug: string; type: OccasionType; title: string; startsOn: string | null;
  coverUrl: string | null; mediaCount: number; guestCount: number; role: "owner" | "cohost";
  /** What the event can do right now (follows the event package). */
  access: OccasionAccess;
  /** Additive: effective package state and gallery window. */
  packageStatus: PackageStatus; opensAt: string | null; closesAt: string | null; deleteAfter: string | null; testMode: boolean; timeZone: string;
};
export type Occasion = OccasionSummary & {
  honorees: string[]; venueName: string | null; city: string | null; theme: Theme; brand: Brand;
  approvalMode: boolean; revealMode: "live" | "next_morning"; revealAt: string | null;
  uploadOpensAt: string | null; uploadClosesAt: string | null; hasPin: boolean; disposableShots: number | null;
  /** When the event's files will be deleted (same as deleteAfter); null before paying. */
  storageExpiresAt: string | null; days: Day[]; guestUrl: string; wallUrl: string;
  /** Additive: custom link name (null = random slug only). */
  vanitySlug: string | null;
  /** Additive: the event package (price, window, test mode, what the organiser can do). */
  package: EventPackage;
};
export type Stats = { guests: number; photos: number; videos: number; messages: number; bytes: number; pendingApproval: number };
export type PublicOccasion = {
  slug: string; type: OccasionType; title: string; honorees: string[]; startsOn: string | null; venueName: string | null;
  city: string | null; theme: Theme; brand: Brand; days: Day[]; moments: string[]; liveWall: boolean;
  missionsEnabled: boolean; disposableShots: number | null; voiceGuestbook: boolean; uploadOpen: boolean;
  revealMode: "live" | "next_morning"; revealAt: string | null;
  /** Additive: host-chosen cover photo. */
  coverUrl: string | null;
  /** Additive: whether a PIN is required. */
  hasPin: boolean;
  /** False unless the gallery is live (and inside any per-event upload window). Same value as `uploadOpen`. */
  uploadsOpen: boolean;
  /** False when the event's originals can't be downloaded (not paid, expired, refunded). Media `originalUrl` is null then. */
  downloadsOpen: boolean;
  /**
   * Additive: what a guest opening the link sees. "not_open" (not paid yet, or paid and before opensAt) → "opens on …" page;
   * "live" → join and upload; "ended" → join and look, no uploads; "unavailable" → refunded / deleted.
   */
  galleryState: "not_open" | "live" | "ended" | "unavailable";
  opensAt: string | null; closesAt: string | null; timeZone: string;
  /** Additive: longest video in seconds (checked before upload and on the server). */
  videoMaxSeconds: number;
  /** Additive: guests buying every photo and video in full quality ("download everything"). */
  guestDownload: GuestDownload;
};
/**
 * pricePence: the price (admin setting, default £3). available: the offer can be bought now (Stripe configured, event
 * paid and live/ended). payments: Stripe is configured. purchased: this device has an active purchase (30 days).
 */
export type GuestDownload = { pricePence: number; available: boolean; payments: boolean; purchased: boolean; expiresAt: string | null };
export type MediaItem = {
  /**
   * `originalUrl` is always null in lists (feed, album, wall, share links): originals only come from the download
   * endpoints as signed, expiring links. thumbUrl/displayUrl are compressed copies: clean for hosts, the wall and a
   * guest's own uploads, watermarked for everyone else. They are null while the copies are being made (`processing`).
   */
  id: string; kind: "photo" | "video" | "voice"; thumbUrl: string | null; displayUrl: string | null; originalUrl?: string | null;
  /** Videos only: the transcoded MP4 (1080p clean or 720p watermarked). Null until processing is ready. */
  playbackUrl?: string | null;
  /** Additive: server-side copies. "pending" with no URL → show "processing"; "failed" with no URL → placeholder. */
  processing?: "pending" | "ready" | "failed";
  /** Additive (guest feed only): uploaded by this guest (clean copies; original downloadable for free). */
  mine?: boolean;
  width: number | null; height: number | null; durationS: number | null; momentTag: string | null; dayId: string | null;
  guestName: string | null; reactionCount: number; reactedByMe?: boolean; favourite?: boolean; visibility?: string;
  approved?: boolean; createdAt: string;
  /** Additive: guest id (host album only) for the "by guest" filter. */
  guestId?: string | null;
  /** Additive: mission id when uploaded for a mission. */
  missionId?: string | null;
  /** Additive: original mime type (host album only), used for download file names. */
  mime?: string;
  /** Additive (host only): auto-moderation flags — "duplicate" | "blurry" | "nsfw". */
  moderationFlags?: string[];
};
export type Mission = { id: string; title: string; sortOrder: number };
export type GuestMission = Mission & { done: boolean; doneCount: number };
export type Message = { id: string; kind: "text" | "voice" | "video"; body: string | null; mediaUrl: string | null; durationS: number | null; guestName: string | null; createdAt: string };
export type ShareLink = { id: string; token: string; url: string; scope: "view" | "view_upload"; label: string | null; expiresAt: string | null };
export type PresignedPut = {
  url: string; method: "PUT"; headers: Record<string, string>;
  multipart?: { partSize: number; parts: { partNumber: number; url: string }[] };
};
export type UploadTicket = { clientId: string; mediaId: string; original: PresignedPut; display?: PresignedPut; thumb?: PresignedPut };
export type ApiErrorBody = { error: { code: string; message: string } };
