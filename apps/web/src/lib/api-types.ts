/** JSON API types — mirror docs/API.md exactly. Safe to import from client components. */
import type { Brand, Locale, OccasionType, Plan } from "./config";

export type Host = { id: string; email: string; name: string | null; locale: Locale; brand: Brand };
export type Theme = "noir" | "royal" | "ivory" | "dusk" | "mono" | "blush";
export type Day = {
  id: string; name: string; date: string | null; sortOrder: number;
  /** Additive: optional per-day upload window. */
  uploadOpensAt?: string | null; uploadClosesAt?: string | null;
  /** Additive (host Occasion only): per-day guest link that locks this day. */
  guestUrl?: string;
  /** Additive (PublicOccasion only): whether this day currently accepts uploads. */
  uploadOpen?: boolean;
  /** Additive (host Occasion only): false when the plan's maxDays hides this day from guests. */
  active?: boolean;
};

export type OccasionSummary = {
  id: string; slug: string; type: OccasionType; title: string; startsOn: string | null; plan: Plan;
  coverUrl: string | null; mediaCount: number; guestCount: number; role: "owner" | "cohost";
};
export type Occasion = OccasionSummary & {
  honorees: string[]; venueName: string | null; city: string | null; theme: Theme; brand: Brand;
  approvalMode: boolean; revealMode: "live" | "next_morning"; revealAt: string | null;
  uploadOpensAt: string | null; uploadClosesAt: string | null; hasPin: boolean; disposableShots: number | null;
  storageExpiresAt: string | null; days: Day[]; guestUrl: string; wallUrl: string;
  /** Additive: custom link name (null = random slug only). */
  vanitySlug: string | null;
  /** Additive: partner organisation that owns the event, and how guests see it branded. */
  organisationId: string | null;
  brandingMode: "platform" | "venue" | "couple" | "both";
};
export type Stats = { guests: number; photos: number; videos: number; messages: number; bytes: number; pendingApproval: number };
export type PublicOccasion = {
  slug: string; type: OccasionType; title: string; honorees: string[]; startsOn: string | null; venueName: string | null;
  city: string | null; theme: Theme; brand: Brand; plan: Plan; days: Day[]; moments: string[]; liveWall: boolean;
  missionsEnabled: boolean; disposableShots: number | null; voiceGuestbook: boolean; uploadOpen: boolean;
  revealMode: "live" | "next_morning"; revealAt: string | null;
  /** Additive: host-chosen cover photo. */
  coverUrl: string | null;
  /** Additive: whether a PIN is required. */
  hasPin: boolean;
  /** Additive: how guests see the event branded (partner events). */
  brandingMode: "platform" | "venue" | "couple" | "both";
  /** Additive: white-label branding. `venueLogoUrl`/`primaryColor`/`accentColor`/`monogram` mirror the mobile app's field names. */
  branding: {
    mode: "platform" | "venue" | "couple" | "both"; venueName: string | null; logoUrl: string | null; poweredBy: boolean;
    colours: { bg: string; fg: string; accent: string };
    venueLogoUrl: string | null; primaryColor: string | null; accentColor: string | null; monogram: string | null; coupleLogoUrl: string | null;
  };
};
export type Organisation = {
  id: string; name: string; slug: string; logoUrl: string | null; primaryColour: string | null; accentColour: string | null;
  supportEmail: string | null; status: "trialing" | "active" | "past_due" | "cancelled"; active: boolean;
  currentPeriodEnd: string | null; hidePoweredBy: boolean; role: "owner" | "staff";
  /** Aliases matching the mobile app's spelling. */
  primaryColor: string | null; accentColor: string | null;
};
export type MediaItem = {
  id: string; kind: "photo" | "video" | "voice"; thumbUrl: string | null; displayUrl: string | null; originalUrl?: string;
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
