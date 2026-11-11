/** JSON API types — mirror docs/API.md exactly. Safe to import from client components. */
import type { Brand, Locale, OccasionType } from "./config";

export type Host = { id: string; email: string; name: string | null; locale: Locale; brand: Brand };
/** Account subscription as returned by GET /api/v1/me (`subscription`). */
export type Subscription = {
  status: "none" | "trialing" | "active" | "past_due" | "cancelled" | "expired";
  interval: "month" | "year" | null;
  trialEndsAt: string | null; currentPeriodEnd: string | null; cancelAtPeriodEnd: boolean; deleteAfter: string | null;
  canCreateEvents: boolean; canDownload: boolean; readOnly: boolean; showUpgradePrompt: boolean; daysLeft: number | null;
  /** Additive: set while the account has complimentary access (granted by our team); status is then "active". */
  compUntil?: string | null;
};
/** Per-event access (follows the event owner's subscription). */
/** reason "suspended" (owner suspended) and "locked" (event locked by our team) are additive. */
export type OccasionAccess = { canUpload: boolean; canDownload: boolean; readOnly: boolean; reason: "trial" | "trial_ended" | "cancelled" | "past_due" | "suspended" | "locked" | null };
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
  /** What the event can do right now (follows the owner's subscription). */
  access: OccasionAccess;
};
export type Occasion = OccasionSummary & {
  honorees: string[]; venueName: string | null; city: string | null; theme: Theme; brand: Brand;
  approvalMode: boolean; revealMode: "live" | "next_morning"; revealAt: string | null;
  uploadOpensAt: string | null; uploadClosesAt: string | null; hasPin: boolean; disposableShots: number | null;
  /** When the event's files will be deleted (the owner's account deleteAfter); null while the account is active or trialing. */
  storageExpiresAt: string | null; days: Day[]; guestUrl: string; wallUrl: string;
  /** Additive: custom link name (null = random slug only). */
  vanitySlug: string | null;
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
  /** False when the event is read-only (owner's account) or outside its upload window. Same value as `uploadOpen`. */
  uploadsOpen: boolean;
  /** False while the owner's account has downloads locked (trial / unpaid). Media `originalUrl` is null then. */
  downloadsOpen: boolean;
};
export type MediaItem = {
  /** `originalUrl` is null when downloads are locked for the event (trial / unpaid account). */
  id: string; kind: "photo" | "video" | "voice"; thumbUrl: string | null; displayUrl: string | null; originalUrl?: string | null;
  /** Videos only: URL to play the video. Present even while downloads are locked (viewing is always allowed). */
  playbackUrl?: string | null;
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
