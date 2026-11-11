import "server-only";
import { schema } from "@/db";
import type { Day, Host, Message, MediaItem, Mission, Occasion, OccasionSummary, PublicOccasion, ShareLink, Subscription, Theme } from "./api-types";
import { SUBSCRIPTION, type Locale, type OccasionType } from "./config";
import { activeDays, dayGuestUrl, dayUploadOpen, effectiveRevealAt, guestUrl, momentLabels, shareUrl, uploadOpen, wallUrl } from "./occasion";
import { presignGet, signMany, storageDriver } from "./storage";
import { occasionAccessOf, type Access } from "./access";

type HostRow = typeof schema.hosts.$inferSelect;
type OccasionRow = typeof schema.occasions.$inferSelect;
type DayRow = typeof schema.days.$inferSelect;
type MediaRow = typeof schema.media.$inferSelect;
type MessageRow = typeof schema.messages.$inferSelect;
type MissionRow = typeof schema.missions.$inferSelect;
type ShareLinkRow = typeof schema.shareLinks.$inferSelect;

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

export function toHost(h: HostRow): Host {
  return { id: h.id, email: h.email, name: h.name, locale: h.locale === "tr" ? "tr" : "en", brand: h.brand };
}

export function toSubscription(a: Access): Subscription {
  return {
    status: a.status, interval: a.interval, trialEndsAt: iso(a.trialEndsAt), currentPeriodEnd: iso(a.currentPeriodEnd),
    cancelAtPeriodEnd: a.cancelAtPeriodEnd, deleteAfter: iso(a.deleteAfter), canCreateEvents: a.canCreateEvents,
    canDownload: a.canDownload, readOnly: a.readOnly, showUpgradePrompt: a.showUpgradePrompt, daysLeft: a.daysLeft,
    compUntil: a.comped ? iso(a.compUntil) : null,
  };
}

export function toDay(d: DayRow): Day {
  return { id: d.id, name: d.name, date: d.date, sortOrder: d.sortOrder, uploadOpensAt: iso(d.uploadOpensAt), uploadClosesAt: iso(d.uploadClosesAt) };
}

type SummaryExtra = { coverUrl: string | null; mediaCount: number; guestCount: number; role: "owner" | "cohost" };

export function toSummary(o: OccasionRow, extra: SummaryExtra, access: Access): OccasionSummary {
  return { id: o.id, slug: o.slug, type: o.type as OccasionType, title: o.title, startsOn: o.startsOn, ...extra, access: occasionAccessOf(access) };
}

export function toOccasion(o: OccasionRow, days: DayRow[], extra: SummaryExtra, access: Access): Occasion {
  return {
    ...toSummary(o, extra, access),
    honorees: o.honorees, venueName: o.venueName, city: o.city, theme: o.theme as Theme, brand: o.brand,
    approvalMode: o.approvalMode, revealMode: o.revealMode, revealAt: iso(o.revealAt),
    uploadOpensAt: iso(o.uploadOpensAt), uploadClosesAt: iso(o.uploadClosesAt), hasPin: !!o.pinHash,
    disposableShots: o.disposableShots, storageExpiresAt: iso(access.deleteAfter),
    days: (() => {
      const active = new Set(activeDays(o, days).map((d) => d.id));
      return [...days].sort((a, b) => a.sortOrder - b.sortOrder).map((d) => ({ ...toDay(d), guestUrl: dayGuestUrl(o, d.id), active: active.has(d.id) }));
    })(),
    guestUrl: guestUrl(o), wallUrl: wallUrl(o), vanitySlug: o.vanitySlug,
  };
}

export function toPublicOccasion(o: OccasionRow, days: DayRow[], locale: Locale, coverUrl: string | null, access: Access): PublicOccasion {
  const f = SUBSCRIPTION.features;
  const reveal = effectiveRevealAt(o);
  const open = uploadOpen(o, access.canUpload);
  return {
    slug: o.slug, type: o.type as OccasionType, title: o.title, honorees: o.honorees, startsOn: o.startsOn,
    venueName: o.venueName, city: o.city, theme: o.theme as Theme, brand: o.brand,
    days: activeDays(o, days).map((d) => ({ ...toDay(d), uploadOpen: open && dayUploadOpen(d) })), moments: momentLabels(o.type as OccasionType, locale),
    liveWall: f.liveWall, missionsEnabled: f.missions, disposableShots: f.disposable ? o.disposableShots : null,
    voiceGuestbook: f.voiceGuestbook, uploadOpen: open, uploadsOpen: open, downloadsOpen: access.canDownload, revealMode: o.revealMode,
    revealAt: o.revealMode === "next_morning" || o.disposableShots ? iso(reveal) : null,
    coverUrl, hasPin: !!o.pinHash,
  };
}

export type MediaJoinRow = { media: MediaRow; guestName: string | null; reactedByMe?: boolean };

/**
 * `audience` controls which fields are exposed:
 *  host  → everything incl. originalUrl, favourite/visibility/approved, guestId
 *  guest → public fields (+ reactedByMe); `withOriginal` for a guest's own uploads
 * `canDownload` = the event owner's access. When false, `originalUrl` is null on every item (download lock).
 */
export async function toMediaItems(rows: MediaJoinRow[], audience: "host" | "guest", opts: { withOriginal?: boolean; canDownload: boolean }): Promise<MediaItem[]> {
  const thumbs = await signMany(rows.map((r) => r.media.keyThumb));
  const displays = await signMany(rows.map((r) => r.media.keyDisplay));
  const wantOriginal = audience === "host" || opts.withOriginal;
  // Guests get the original only for their own uploads, and for videos (needed to play them). Never while downloads are locked.
  const originals = opts.canDownload
    ? await signMany(rows.map((r) => (wantOriginal || r.media.kind === "video" ? r.media.keyOriginal : null)))
    : rows.map(() => null);
  // Viewing is always allowed, even while downloads are locked: videos need a playable URL, and photos
  // without a generated display (e.g. undecodable HEIC) fall back to their original for display.
  const viewing = await signMany(rows.map((r) => (r.media.kind === "video" || (r.media.kind === "photo" && !r.media.keyDisplay) ? r.media.keyOriginal : null)));
  return rows.map((r, i) => {
    const m = r.media;
    // Photos without a generated display (e.g. HEIC the browser couldn't decode) fall back to the original.
    const fallback = m.kind === "photo" && !m.keyDisplay ? (viewing[i] ?? null) : null;
    const item: MediaItem = {
      id: m.id, kind: m.kind, thumbUrl: thumbs[i] ?? displays[i] ?? fallback, displayUrl: displays[i] ?? fallback,
      width: m.width, height: m.height, durationS: m.durationS, momentTag: m.momentTag, dayId: m.dayId,
      guestName: r.guestName, reactionCount: m.reactionCount, createdAt: m.createdAt.toISOString(), missionId: m.missionId,
    };
    if (m.kind === "video") item.playbackUrl = viewing[i] ?? null;
    if (!opts.canDownload) item.originalUrl = null;
    else if (originals[i]) item.originalUrl = originals[i]!;
    if (audience === "host") {
      item.favourite = m.favourite; item.visibility = m.visibility; item.approved = m.approved; item.guestId = m.guestId; item.mime = m.mime; item.moderationFlags = m.moderationFlags;
    } else {
      item.reactedByMe = !!r.reactedByMe;
      if (opts.withOriginal) item.approved = m.approved;
    }
    return item;
  });
}

export async function toMessages(rows: { message: MessageRow; guestName: string | null }[]): Promise<Message[]> {
  const urls = await signMany(rows.map((r) => r.message.mediaKey));
  return rows.map((r, i) => ({
    id: r.message.id, kind: r.message.kind, body: r.message.body, mediaUrl: urls[i] ?? null,
    durationS: r.message.durationS, guestName: r.guestName, createdAt: r.message.createdAt.toISOString(),
  }));
}

export function toMission(m: MissionRow): Mission {
  return { id: m.id, title: m.title, sortOrder: m.sortOrder };
}

export function toShareLink(o: OccasionRow, l: ShareLinkRow): ShareLink {
  return { id: l.id, token: l.token, url: shareUrl(o, l.token), scope: l.scope, label: l.label, expiresAt: iso(l.expiresAt) };
}

export async function coverUrlFor(key: string | null): Promise<string | null> {
  if (!key || !storageDriver()) return null;
  return presignGet(key);
}
