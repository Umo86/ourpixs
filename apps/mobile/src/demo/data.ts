/**
 * Sample data for demo mode (EXPO_PUBLIC_DEMO=1) — store screenshots and App Review walkthroughs.
 * Photos: Pexels (free licence), same set as apps/web/public/media. See README credits.
 */
import { Asset } from "expo-asset";

import type { EventPackage, GuestMission, Host, MediaItem, Message, Occasion, OccasionAccess, OccasionSummary, PublicOccasion, ShareLink, Stats } from "@/api/types";

const IMAGES = {
  wedding: require("../../assets/demo/wedding.jpg"),
  couple: require("../../assets/demo/couple.jpg"),
  henna: require("../../assets/demo/henna.jpg"),
  family: require("../../assets/demo/family.jpg"),
  selfie: require("../../assets/demo/selfie.jpg"),
  birthday: require("../../assets/demo/birthday.jpg"),
  poster: require("../../assets/demo/poster.jpg"),
  grad: require("../../assets/demo/grad.jpg"),
  baby: require("../../assets/demo/baby.jpg"),
} as const;
type ImgName = keyof typeof IMAGES;

export function demoImage(name: ImgName): string {
  return Asset.fromModule(IMAGES[name]).uri;
}

export const DEMO_SLUG = "elif-can";
export const DEMO_ID = "demo-wedding";
export const DEMO_GUEST_TOKEN = "demo-guest-token";

export const demoHost: Host = { id: "demo-host", email: "elif@example.com", name: "Elif", locale: "en", brand: "bizimresimler" };

const now = Date.now();
const iso = (minsAgo: number) => new Date(now - minsAgo * 60_000).toISOString();

const days = [
  { id: "d1", name: "Henna night", date: "2027-06-12", sortOrder: 0 },
  { id: "d2", name: "Wedding", date: "2027-06-14", sortOrder: 1 },
];

export const demoAccess: OccasionAccess = { canUpload: true, canDownload: true, readOnly: false, reason: null };

/** Demo events: one live wedding gallery (every feature works in screenshots), one ended, one still in setup. */
const hours = (h: number) => new Date(now + h * 3600_000).toISOString();
const LIVE = { packageStatus: "live" as const, opensAt: hours(-20), closesAt: hours(24 * 5), deleteAfter: hours(24 * 370), testMode: false, timeZone: "Europe/London" };

export function demoPackage(s: Pick<OccasionSummary, "packageStatus" | "opensAt" | "closesAt" | "deleteAfter" | "testMode" | "timeZone">): EventPackage {
  return {
    status: s.packageStatus, pricePence: 0, paidAt: s.packageStatus === "setup" ? null : hours(-24 * 30), comped: false,
    opensAt: s.opensAt, closesAt: s.closesAt, timeZone: s.timeZone, deleteAfter: s.deleteAfter, testMode: s.testMode, testUploadLimit: 20,
    canEditWindow: s.packageStatus === "setup" || s.packageStatus === "paid", canEndEarly: s.packageStatus === "live", canPay: false,
    windowDays: 7, videoMaxSeconds: 60, daysLeft: 5,
  };
}

export function demoOccasions(): OccasionSummary[] {
  return [
    { id: DEMO_ID, slug: DEMO_SLUG, type: "dugun", title: "Elif & Can's Wedding", startsOn: "2027-06-14", access: demoAccess, coverUrl: demoImage("wedding"), mediaCount: 1284, guestCount: 212, role: "owner", ...LIVE },
    {
      id: "demo-henna", slug: "elif-kina", type: "kina", title: "Elif's Henna Night", startsOn: "2027-06-12", coverUrl: demoImage("henna"), mediaCount: 342, guestCount: 64, role: "owner",
      access: { ...demoAccess, reason: "ended" }, packageStatus: "ended", opensAt: hours(-24 * 4), closesAt: hours(-24 * 2), deleteAfter: hours(24 * 360), testMode: false, timeZone: "Europe/London",
    },
    {
      id: "demo-bday", slug: "deniz-30", type: "dogum_gunu", title: "Deniz's Birthday", startsOn: "2026-12-05", coverUrl: demoImage("birthday"), mediaCount: 6, guestCount: 0, role: "cohost",
      access: { canUpload: true, canDownload: false, readOnly: false, reason: "setup" }, packageStatus: "setup", opensAt: null, closesAt: null, deleteAfter: null, testMode: true, timeZone: "Europe/London",
    },
  ];
}

export function demoOccasion(id: string): Occasion {
  const s = demoOccasions().find((o) => o.id === id) ?? demoOccasions()[0];
  return {
    ...s,
    honorees: ["Elif", "Can"],
    venueName: "The Grand Hall",
    city: "London",
    theme: "noir",
    brand: "bizimresimler",
    approvalMode: false,
    revealMode: "live",
    revealAt: null,
    uploadOpensAt: null,
    uploadClosesAt: null,
    hasPin: false,
    disposableShots: null,
    storageExpiresAt: "2030-06-14T00:00:00.000Z",
    days,
    guestUrl: `https://bizimresimler.com/g/${s.slug}`,
    wallUrl: `https://bizimresimler.com/wall/${s.slug}`,
    access: s.access ?? demoAccess,
    package: demoPackage(s),
  };
}

export const demoStats: Stats = { guests: 212, photos: 1196, videos: 88, messages: 46, bytes: 6_400_000_000, pendingApproval: 0 };

const ORDER: ImgName[] = ["couple", "selfie", "family", "wedding", "henna", "poster", "grad", "birthday", "baby"];
const NAMES = ["Mert", "Ayşe", "Zeynep", "Can", "Selin", "Emre", "Sophie", "Burak", "Deniz", "James"];
const MOMENTS = ["Halay", "First dance", "Cake", "Family", null];

export function demoMedia(count = 36): MediaItem[] {
  return Array.from({ length: count }, (_, i) => {
    const img = demoImage(ORDER[i % ORDER.length]);
    const video = i % 7 === 3;
    return {
      id: `m${i + 1}`,
      kind: video ? "video" : "photo",
      thumbUrl: i === 2 || i === 9 ? null : img,
      displayUrl: i === 2 || i === 9 ? null : img,
      originalUrl: null,
      playbackUrl: null,
      // A couple of fresh uploads are still being processed (placeholder tile).
      processing: i === 2 || i === 9 ? "pending" : "ready",
      width: 600,
      height: 800,
      durationS: video ? 14 + (i % 30) : null,
      momentTag: MOMENTS[i % MOMENTS.length],
      dayId: i % 3 === 0 ? "d1" : "d2",
      guestName: NAMES[i % NAMES.length],
      reactionCount: (i * 7) % 23,
      reactedByMe: i % 5 === 0,
      favourite: i % 6 === 1,
      visibility: "visible",
      approved: true,
      createdAt: iso(i * 3),
    } satisfies MediaItem;
  });
}

export const demoMessages: Message[] = [
  { id: "g1", kind: "text", body: "Elif, you looked unreal. Can, you're a lucky man. Love you both!", mediaUrl: null, durationS: null, guestName: "Ayşe", createdAt: iso(12) },
  { id: "g2", kind: "voice", body: null, mediaUrl: null, durationS: 34, guestName: "Grandma Nur", createdAt: iso(40) },
  { id: "g3", kind: "text", body: "Best halay of my life. Ömür boyu mutluluklar!", mediaUrl: null, durationS: null, guestName: "Mert", createdAt: iso(55) },
  { id: "g4", kind: "video", body: null, mediaUrl: null, durationS: 21, guestName: "Sophie & James", createdAt: iso(80) },
  { id: "g5", kind: "text", body: "So happy we could be here from Izmir. Tebrikler!", mediaUrl: null, durationS: null, guestName: "Selin", createdAt: iso(130) },
];

export const demoMissionTitles = ["Selfie with the couple", "Best dance move", "The cake before it's cut", "Someone mid-laugh", "Your table, all together"];

export function demoGuestMissions(): GuestMission[] {
  return demoMissionTitles.map((title, i) => ({ id: `mi${i}`, title, sortOrder: i, done: i < 2, doneCount: 40 - i * 7 }));
}

export const demoShareLinks: ShareLink[] = [
  { id: "s1", token: "fam-izmir", url: "https://bizimresimler.com/s/fam-izmir", scope: "all", label: "Family in Izmir", expiresAt: "2027-09-14T00:00:00.000Z" },
];

export function demoPublic(): PublicOccasion {
  const o = demoOccasion(DEMO_ID);
  return {
    slug: o.slug, type: o.type, title: "Elif & Can", honorees: o.honorees, startsOn: o.startsOn, venueName: o.venueName, city: o.city,
    theme: o.theme, brand: o.brand, days, moments: ["Halay", "First dance", "Gold ceremony", "Cake", "Family"],
    liveWall: true, missionsEnabled: true, disposableShots: null, voiceGuestbook: true, uploadOpen: true, uploadsOpen: true, revealMode: "live", revealAt: null,
    downloadsOpen: true, galleryState: "live", opensAt: o.opensAt, closesAt: o.closesAt, timeZone: o.timeZone, videoMaxSeconds: 60,
  };
}
