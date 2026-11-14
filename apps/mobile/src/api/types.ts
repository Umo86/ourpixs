/** Types for the /api/v1 contract (docs/API.md). Keep in sync with the backend. */
import type { Brand, Locale, OccasionType } from "@/config";

export type Host = { id: string; email: string; name: string | null; locale: Locale; brand: Brand };

/**
 * Effective event package state (one payment per event, made on the website; the app never sells it).
 * setup → paid (gallery not open yet) → live (opensAt ≤ now < closesAt) → ended → expired (files deleted), or refunded.
 */
export type PackageStatus = "setup" | "paid" | "live" | "ended" | "expired" | "refunded";

/** What the host can do with one event right now (derived from the event package; server-enforced). */
export type OccasionAccess = {
  canUpload: boolean;
  canDownload: boolean;
  readOnly: boolean;
  reason: "setup" | "not_open" | "ended" | "expired" | "refunded" | "suspended" | "locked" | null;
};

/** The event package as shown to members. The app shows status and dates only: never a price or a pay button. */
export type EventPackage = {
  status: PackageStatus;
  /** Present in the API; the store builds never display it. */
  pricePence: number;
  paidAt: string | null;
  comped: boolean;
  opensAt: string | null;
  closesAt: string | null;
  timeZone: string;
  deleteAfter: string | null;
  testMode: boolean;
  testUploadLimit: number;
  canEditWindow: boolean;
  canEndEarly: boolean;
  canPay: boolean;
  windowDays: number;
  /** Longest video in seconds (default 60). */
  videoMaxSeconds?: number;
  daysLeft: number | null;
};

export type OccasionSummary = {
  id: string;
  slug: string;
  type: OccasionType | string;
  title: string;
  startsOn: string | null;
  access?: OccasionAccess;
  coverUrl: string | null;
  mediaCount: number;
  guestCount: number;
  role: "owner" | "cohost";
  packageStatus: PackageStatus;
  opensAt: string | null;
  closesAt: string | null;
  deleteAfter: string | null;
  testMode: boolean;
  timeZone: string;
};

export type OccasionDay = { id: string; name: string; date: string | null; sortOrder: number };
export type RevealMode = "live" | "next_morning";

export type Occasion = OccasionSummary & {
  honorees: string[];
  venueName: string | null;
  city: string | null;
  theme: string | null;
  brand: Brand;
  approvalMode: boolean;
  revealMode: RevealMode;
  revealAt: string | null;
  uploadOpensAt: string | null;
  uploadClosesAt: string | null;
  hasPin: boolean;
  disposableShots: number | null;
  storageExpiresAt: string | null;
  days: OccasionDay[];
  guestUrl: string;
  wallUrl: string;
  access: OccasionAccess;
  vanitySlug?: string | null;
  package: EventPackage;
};

export type Stats = { guests: number; photos: number; videos: number; messages: number; bytes: number; pendingApproval: number };

export type PublicOccasion = {
  slug: string;
  type: OccasionType | string;
  title: string;
  honorees: string[];
  startsOn: string | null;
  venueName: string | null;
  city: string | null;
  theme: string | null;
  brand: Brand;
  days: OccasionDay[];
  moments: string[];
  liveWall: boolean;
  missionsEnabled: boolean;
  disposableShots: number | null;
  voiceGuestbook: boolean;
  /** Upload window (host schedule). */
  uploadOpen: boolean;
  /** True only while the gallery is live. */
  uploadsOpen: boolean;
  /** False when the event's originals can't be downloaded (not paid, expired, refunded). */
  downloadsOpen?: boolean;
  revealMode: RevealMode;
  revealAt: string | null;
  /** not_open → "opens on …"; live → join and upload; ended → look only; unavailable → refunded / deleted. */
  galleryState?: "not_open" | "live" | "ended" | "unavailable";
  opensAt?: string | null;
  closesAt?: string | null;
  timeZone?: string;
  /** Longest video in seconds (checked before upload and on the server). */
  videoMaxSeconds?: number;
};

export type MediaKind = "photo" | "video" | "voice";

export type MediaItem = {
  id: string;
  kind: MediaKind;
  /** Compressed copies (clean for hosts and a guest's own uploads, watermarked for other guests). Null while processing. */
  thumbUrl: string | null;
  displayUrl: string | null;
  /** Always null in lists: originals only come from the download endpoints (signed links, ≤ 1 hour). */
  originalUrl?: string | null;
  /** Videos only: the transcoded MP4 (1080p clean for hosts). Null until processing is ready. */
  playbackUrl?: string | null;
  /** "pending": copies are being made (show a processing tile); "failed": no preview (placeholder). */
  processing?: "pending" | "ready" | "failed";
  /** Guest feed: uploaded by this device. */
  mine?: boolean;
  width: number | null;
  height: number | null;
  durationS: number | null;
  momentTag: string | null;
  dayId: string | null;
  guestName: string | null;
  reactionCount: number;
  reactedByMe?: boolean;
  favourite?: boolean;
  visibility?: string;
  approved?: boolean;
  /** Host responses only: the uploading guest (null for host uploads). */
  guestId?: string | null;
  createdAt: string;
};

export type Mission = { id: string; title: string; sortOrder: number };
export type GuestMission = Mission & { done: boolean; doneCount: number };

export type MessageKind = "text" | "voice" | "video";
export type Message = {
  id: string;
  kind: MessageKind;
  body: string | null;
  mediaUrl: string | null;
  durationS: number | null;
  guestName: string | null;
  createdAt: string;
};

export type ShareLink = { id: string; token: string; url: string; scope: string; label: string | null; expiresAt: string | null };

export type MediaAction = "hide" | "show" | "delete" | "favourite" | "unfavourite" | "approve";
export type MediaFilter = "favourites" | "hidden" | "pending";

export type MediaQuery = {
  cursor?: string | null;
  dayId?: string;
  moment?: string;
  guestId?: string;
  kind?: "photo" | "video";
  filter?: MediaFilter;
};

export type Page<T> = { items: T[]; nextCursor: string | null };

export type UploadFileSpec = {
  clientId: string;
  name: string;
  mime: string;
  bytes: number;
  kind: "photo" | "video";
  width?: number;
  height?: number;
  durationS?: number;
  dayId?: string;
  momentTag?: string;
  missionId?: string;
  fromDisposable?: boolean;
  hasDisplay: boolean;
  hasThumb: boolean;
};

export type PresignedTarget = { url: string; method: "PUT"; headers: Record<string, string> };
export type UploadGrant = {
  clientId: string;
  mediaId: string;
  original: PresignedTarget;
  display?: PresignedTarget;
  thumb?: PresignedTarget;
};

export type OccasionCreate = {
  type: string;
  title: string;
  honorees: string[];
  startsOn?: string;
  venueName?: string;
  city?: string;
  theme?: string;
  days?: { name: string; date?: string }[];
  /** IANA zone the gallery window is entered in (default Europe/London). */
  timeZone?: string;
  opensAt?: string;
  closesAt?: string;
};

export type OccasionPatch = Partial<{
  title: string;
  honorees: string[];
  startsOn: string | null;
  venueName: string | null;
  city: string | null;
  theme: string;
  approvalMode: boolean;
  revealMode: RevealMode;
  revealAt: string | null;
  uploadOpensAt: string | null;
  uploadClosesAt: string | null;
  pin: string | null;
  disposableShots: number | null;
  /** Gallery window (ISO instants), entered as local time in `timeZone`; closesAt − opensAt ≤ package.windowDays. */
  opensAt: string;
  closesAt: string;
  timeZone: string;
}>;
