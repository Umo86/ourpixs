import "server-only";
import { schema } from "@/db";
import type { Day, Host, Message, MediaItem, Mission, Occasion, OccasionSummary, PublicOccasion, ShareLink, Theme } from "./api-types";
import { PLANS, type Locale, type OccasionType, type Plan } from "./config";
import { activeDays, dayGuestUrl, dayUploadOpen, effectiveRevealAt, guestUrl, momentLabels, shareUrl, uploadOpen, wallUrl } from "./occasion";
import { presignGet, signMany, storageDriver } from "./storage";
import type { Branding, OrgRow } from "./org";
import type { Organisation } from "./api-types";

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

export function toDay(d: DayRow): Day {
  return { id: d.id, name: d.name, date: d.date, sortOrder: d.sortOrder, uploadOpensAt: iso(d.uploadOpensAt), uploadClosesAt: iso(d.uploadClosesAt) };
}

export function toSummary(o: OccasionRow, extra: { coverUrl: string | null; mediaCount: number; guestCount: number; role: "owner" | "cohost" }): OccasionSummary {
  return { id: o.id, slug: o.slug, type: o.type as OccasionType, title: o.title, startsOn: o.startsOn, plan: o.plan as Plan, ...extra };
}

export function toOccasion(o: OccasionRow, days: DayRow[], extra: { coverUrl: string | null; mediaCount: number; guestCount: number; role: "owner" | "cohost" }): Occasion {
  return {
    ...toSummary(o, extra),
    honorees: o.honorees, venueName: o.venueName, city: o.city, theme: o.theme as Theme, brand: o.brand,
    approvalMode: o.approvalMode, revealMode: o.revealMode, revealAt: iso(o.revealAt),
    uploadOpensAt: iso(o.uploadOpensAt), uploadClosesAt: iso(o.uploadClosesAt), hasPin: !!o.pinHash,
    disposableShots: o.disposableShots, storageExpiresAt: iso(o.storageExpiresAt),
    days: (() => {
      const active = new Set(activeDays(o, days).map((d) => d.id));
      return [...days].sort((a, b) => a.sortOrder - b.sortOrder).map((d) => ({ ...toDay(d), guestUrl: dayGuestUrl(o, d.id), active: active.has(d.id) }));
    })(),
    guestUrl: guestUrl(o), wallUrl: wallUrl(o), vanitySlug: o.vanitySlug,
    organisationId: o.organisationId, brandingMode: o.brandingMode,
  };
}

export function toPublicOccasion(o: OccasionRow, days: DayRow[], locale: Locale, coverUrl: string | null, branding: Branding): PublicOccasion {
  const plan = PLANS[o.plan as Plan];
  const reveal = effectiveRevealAt(o);
  return {
    slug: o.slug, type: o.type as OccasionType, title: o.title, honorees: o.honorees, startsOn: o.startsOn,
    venueName: o.venueName, city: o.city, theme: o.theme as Theme, brand: o.brand, plan: o.plan as Plan,
    days: activeDays(o, days).map((d) => ({ ...toDay(d), uploadOpen: uploadOpen(o) && dayUploadOpen(d) })), moments: momentLabels(o.type as OccasionType, locale),
    liveWall: plan.liveWall, missionsEnabled: plan.missions, disposableShots: plan.disposable ? o.disposableShots : null,
    voiceGuestbook: plan.voiceGuestbook, uploadOpen: uploadOpen(o), revealMode: o.revealMode,
    revealAt: o.revealMode === "next_morning" || o.disposableShots ? iso(reveal) : null,
    coverUrl, hasPin: !!o.pinHash,
    brandingMode: branding.mode,
    branding: {
      mode: branding.mode, venueName: branding.venueName, logoUrl: branding.logoUrl, poweredBy: branding.poweredBy, colours: branding.colours,
      venueLogoUrl: branding.logoUrl, primaryColor: branding.mode === "platform" ? null : branding.colours.bg,
      accentColor: branding.mode === "platform" ? null : branding.colours.accent,
      monogram: branding.mode === "couple" || branding.mode === "both" ? o.honorees.map((h) => h.trim().charAt(0).toLocaleUpperCase()).filter(Boolean).join(" & ") || null : null,
      coupleLogoUrl: null,
    },
  };
}

export type MediaJoinRow = { media: MediaRow; guestName: string | null; reactedByMe?: boolean };

/**
 * `audience` controls which fields are exposed:
 *  host  → everything incl. originalUrl, favourite/visibility/approved, guestId
 *  guest → public fields (+ reactedByMe); `withOriginal` for a guest's own uploads
 */
export async function toMediaItems(rows: MediaJoinRow[], audience: "host" | "guest", opts: { withOriginal?: boolean } = {}): Promise<MediaItem[]> {
  const thumbs = await signMany(rows.map((r) => r.media.keyThumb));
  const displays = await signMany(rows.map((r) => r.media.keyDisplay));
  const wantOriginal = audience === "host" || opts.withOriginal;
  // Guests get the original only for their own uploads, and for videos (needed to play them).
  const originals = await signMany(rows.map((r) => (wantOriginal || r.media.kind === "video" ? r.media.keyOriginal : null)));
  return rows.map((r, i) => {
    const m = r.media;
    // Photos without a generated display (e.g. HEIC the browser couldn't decode) fall back to the original.
    const fallback = m.kind === "photo" && !m.keyDisplay ? (originals[i] ?? null) : null;
    const item: MediaItem = {
      id: m.id, kind: m.kind, thumbUrl: thumbs[i] ?? displays[i] ?? fallback, displayUrl: displays[i] ?? fallback,
      width: m.width, height: m.height, durationS: m.durationS, momentTag: m.momentTag, dayId: m.dayId,
      guestName: r.guestName, reactionCount: m.reactionCount, createdAt: m.createdAt.toISOString(), missionId: m.missionId,
    };
    if (originals[i]) item.originalUrl = originals[i]!;
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

export async function toOrganisation(org: OrgRow, role: "owner" | "staff", active: boolean): Promise<Organisation> {
  return {
    id: org.id, name: org.name, slug: org.slug, logoUrl: await coverUrlFor(org.logoKey), primaryColour: org.primaryColour,
    accentColour: org.accentColour, supportEmail: org.supportEmail, status: org.status, active,
    primaryColor: org.primaryColour, accentColor: org.accentColour,
    currentPeriodEnd: iso(org.currentPeriodEnd), hidePoweredBy: org.hidePoweredBy, role,
  };
}
