/** Types for the /api/v1 contract (docs/API.md). Keep in sync with the backend. */
import type { Brand, Locale, OccasionType } from "@/config";

export type Host = { id: string; email: string; name: string | null; locale: Locale; brand: Brand };

export type SubscriptionStatus = "none" | "trialing" | "active" | "past_due" | "cancelled" | "expired";

/** Account subscription, returned by GET /api/v1/me. */
export type Subscription = {
  status: SubscriptionStatus;
  interval: "month" | "year" | null;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  /** When read-only events are deleted (trial ended unpaid: 30 days; cancelled: 90 days). */
  deleteAfter: string | null;
  canCreateEvents: boolean;
  canDownload: boolean;
  readOnly: boolean;
  showUpgradePrompt: boolean;
  daysLeft: number | null;
};

/** What the host can do with one event right now. */
export type OccasionAccess = {
  canUpload: boolean;
  canDownload: boolean;
  readOnly: boolean;
  reason: "trial" | "trial_ended" | "cancelled" | "past_due" | null;
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
  /** False while the host's account can't accept uploads (read-only events). */
  uploadsOpen: boolean;
  /** False while the host's account has downloads locked (free trial / unpaid). */
  downloadsOpen?: boolean;
  revealMode: RevealMode;
  revealAt: string | null;
};

export type MediaKind = "photo" | "video" | "voice";

export type MediaItem = {
  id: string;
  kind: MediaKind;
  thumbUrl: string | null;
  displayUrl: string | null;
  originalUrl?: string;
  /** Videos only: playable URL, present even while downloads are locked. */
  playbackUrl?: string | null;
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
}>;
