/** Types for the /api/v1 contract (docs/API.md). Keep in sync with the backend. */
import type { Brand, BrandingMode, Locale, OccasionType, Plan } from "@/config";

export type Host = { id: string; email: string; name: string | null; locale: Locale; brand: Brand };

export type OccasionSummary = {
  id: string;
  slug: string;
  type: OccasionType | string;
  title: string;
  startsOn: string | null;
  plan: Plan;
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
  /** PROVISIONAL (Partner plan) — not yet in docs/API.md. */
  organisationId?: string | null;
  brandingMode?: BrandingMode;
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
  plan: Plan;
  days: OccasionDay[];
  moments: string[];
  liveWall: boolean;
  missionsEnabled: boolean;
  disposableShots: number | null;
  voiceGuestbook: boolean;
  uploadOpen: boolean;
  revealMode: RevealMode;
  revealAt: string | null;
  /** PROVISIONAL (Partner plan) — guest-facing branding; absent = "platform". */
  brandingMode?: BrandingMode;
  branding?: EventBranding | null;
};

/**
 * PROVISIONAL — /api/v1/organisations is announced but not yet documented in docs/API.md.
 * Every field the UI relies on is optional or nullable so the app degrades gracefully.
 */
export type EventBranding = {
  venueName?: string | null;
  venueLogoUrl?: string | null;
  primaryColor?: string | null;
  accentColor?: string | null;
  /** Couple monogram text, e.g. "E & C". */
  monogram?: string | null;
  coupleLogoUrl?: string | null;
};

export type Organisation = {
  id: string;
  name: string;
  logoUrl: string | null;
  primaryColor: string | null;
  accentColor: string | null;
  role: "owner" | "admin" | "member";
};

export type MediaKind = "photo" | "video" | "voice";

export type MediaItem = {
  id: string;
  kind: MediaKind;
  thumbUrl: string | null;
  displayUrl: string | null;
  originalUrl?: string;
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
