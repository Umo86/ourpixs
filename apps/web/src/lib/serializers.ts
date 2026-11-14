import "server-only";
import { schema } from "@/db";
import type { Day, EventPackage, GuestDownload, Host, Message, MediaItem, Mission, Occasion, OccasionSummary, PublicOccasion, ShareLink, Theme } from "./api-types";
import { FEATURES, type Locale, type OccasionType, type PackageSettings } from "./config";
import { activeDays, dayGuestUrl, dayUploadOpen, effectiveRevealAt, guestUrl, momentLabels, shareUrl, uploadOpen, wallUrl } from "./occasion";
import { presignGet, privateGetUrl, signMany, storageDriver } from "./storage";
import { planMediaKeys, type MediaAudience } from "./media-urls";
import { occasionAccessOf, type Access } from "./access-rules";

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

export function toPackage(o: OccasionRow, a: Access, s: PackageSettings): EventPackage {
  return {
    status: a.state, pricePence: s.eventPricePence, paidAt: iso(o.paidAt), comped: !!o.compedAt,
    opensAt: iso(o.opensAt), closesAt: iso(o.closesAt), timeZone: o.timeZone, deleteAfter: iso(a.deleteAfter),
    testMode: a.testMode, testUploadLimit: a.testUploadLimit, canEditWindow: a.canEditWindow, canEndEarly: a.canEndEarly,
    canPay: a.canPay, windowDays: s.windowDays, daysLeft: a.daysLeft,
  };
}

export function toDay(d: DayRow): Day {
  return { id: d.id, name: d.name, date: d.date, sortOrder: d.sortOrder, uploadOpensAt: iso(d.uploadOpensAt), uploadClosesAt: iso(d.uploadClosesAt) };
}

type SummaryExtra = { coverUrl: string | null; mediaCount: number; guestCount: number; role: "owner" | "cohost" };

export function toSummary(o: OccasionRow, extra: SummaryExtra, access: Access): OccasionSummary {
  return {
    id: o.id, slug: o.slug, type: o.type as OccasionType, title: o.title, startsOn: o.startsOn, ...extra, access: occasionAccessOf(access),
    packageStatus: access.state, opensAt: iso(o.opensAt), closesAt: iso(o.closesAt), deleteAfter: iso(access.deleteAfter),
    testMode: access.testMode, timeZone: o.timeZone,
  };
}

export function toOccasion(o: OccasionRow, days: DayRow[], extra: SummaryExtra, access: Access, s: PackageSettings): Occasion {
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
    guestUrl: guestUrl(o), wallUrl: wallUrl(o), vanitySlug: o.vanitySlug, package: toPackage(o, access, s),
  };
}

/** What a guest opening the link sees (see PublicOccasion.galleryState). */
export function galleryState(a: Access): PublicOccasion["galleryState"] {
  if (a.state === "expired" || a.state === "refunded" || a.reason === "suspended") return "unavailable";
  if (!a.guestsCanView) return "not_open";
  return a.guestsCanUpload ? "live" : "ended";
}

export function toPublicOccasion(o: OccasionRow, days: DayRow[], locale: Locale, coverUrl: string | null, access: Access, videoMaxSeconds: number, guestDownload: GuestDownload): PublicOccasion {
  const f = FEATURES;
  const reveal = effectiveRevealAt(o);
  const open = uploadOpen(o, access.guestsCanUpload);
  return {
    slug: o.slug, type: o.type as OccasionType, title: o.title, honorees: o.honorees, startsOn: o.startsOn,
    venueName: o.venueName, city: o.city, theme: o.theme as Theme, brand: o.brand,
    days: activeDays(o, days).map((d) => ({ ...toDay(d), uploadOpen: open && dayUploadOpen(d) })), moments: momentLabels(o.type as OccasionType, locale),
    liveWall: f.liveWall, missionsEnabled: f.missions, disposableShots: f.disposable ? o.disposableShots : null,
    voiceGuestbook: f.voiceGuestbook, uploadOpen: open, uploadsOpen: open, downloadsOpen: access.canDownload, revealMode: o.revealMode,
    revealAt: o.revealMode === "next_morning" || o.disposableShots ? iso(reveal) : null,
    coverUrl, hasPin: !!o.pinHash,
    galleryState: galleryState(access), opensAt: iso(o.opensAt), closesAt: iso(o.closesAt), timeZone: o.timeZone, videoMaxSeconds,
    guestDownload,
  };
}

export type MediaJoinRow = { media: MediaRow; guestName: string | null; reactedByMe?: boolean };

/**
 * Media for a list/feed/wall/share payload. Which copy each viewer gets is decided by planMediaKeys (src/lib/media-urls.ts):
 *  host  → clean copies + favourite/visibility/approved/guestId/mime/flags
 *  wall  → clean copies (the host's screen)
 *  guest → clean copies of their own uploads (`mine: true`), WATERMARKED copies of everyone else's (+ reactedByMe)
 *  share → watermarked copies
 * `originalUrl` is always null here: originals only come from the download endpoints (signed, expiring links).
 */
export async function toMediaItems(rows: MediaJoinRow[], audience: MediaAudience): Promise<MediaItem[]> {
  const plans = rows.map((r) => planMediaKeys(r.media, audience));
  // The only original that can appear (hosts, a photo with no display copy) goes through the private signer too.
  const isOriginal = (k: string | null, i: number) => !!k && k === rows[i]!.media.keyOriginal;
  async function sign(keys: (string | null)[]) {
    const copies = await signMany(keys.map((k, i) => (isOriginal(k, i) ? null : k)));
    return Promise.all(keys.map((k, i) => (isOriginal(k, i) && storageDriver() ? privateGetUrl(k!, 3600) : Promise.resolve(copies[i] ?? null))));
  }
  const [thumbs, displays, playbacks] = await Promise.all([sign(plans.map((p) => p.thumb)), sign(plans.map((p) => p.display)), sign(plans.map((p) => p.playback))]);
  return rows.map((r, i) => {
    const m = r.media;
    const p = plans[i]!;
    const item: MediaItem = {
      id: m.id, kind: m.kind, thumbUrl: thumbs[i] ?? null, displayUrl: displays[i] ?? null, originalUrl: null,
      width: m.width, height: m.height, durationS: m.durationS, momentTag: m.momentTag, dayId: m.dayId,
      guestName: r.guestName, reactionCount: m.reactionCount, createdAt: m.createdAt.toISOString(), missionId: m.missionId,
      processing: p.processing,
    };
    if (m.kind === "video") item.playbackUrl = playbacks[i] ?? null;
    if (audience.kind === "host") {
      item.favourite = m.favourite; item.visibility = m.visibility; item.approved = m.approved; item.guestId = m.guestId; item.mime = m.mime; item.moderationFlags = m.moderationFlags;
    } else if (audience.kind === "guest") {
      item.reactedByMe = !!r.reactedByMe;
      item.mine = p.mine;
      if (p.mine) item.approved = m.approved;
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
