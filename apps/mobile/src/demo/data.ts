/**
 * Sample data for demo mode (EXPO_PUBLIC_DEMO=1) — store screenshots and App Review walkthroughs.
 * Photos: Pexels (free licence), same set as apps/web/public/media. See README credits.
 */
import { Asset } from "expo-asset";

import type { GuestMission, Host, Organisation, MediaItem, Message, Occasion, OccasionSummary, PublicOccasion, ShareLink, Stats } from "@/api/types";

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

export const demoHost: Host = { id: "demo-host", email: "elif@example.com", name: "Elif", locale: "en", brand: "ourpixs" };

const now = Date.now();
const iso = (minsAgo: number) => new Date(now - minsAgo * 60_000).toISOString();

const days = [
  { id: "d1", name: "Henna night", date: "2027-06-12", sortOrder: 0 },
  { id: "d2", name: "Wedding", date: "2027-06-14", sortOrder: 1 },
];

export function demoOccasions(): OccasionSummary[] {
  return [
    { id: DEMO_ID, slug: DEMO_SLUG, type: "dugun", title: "Elif & Can's Wedding", startsOn: "2027-06-14", plan: "buyuk", coverUrl: demoImage("wedding"), mediaCount: 1284, guestCount: 212, role: "owner" },
    { id: "demo-henna", slug: "elif-kina", type: "kina", title: "Elif's Henna Night", startsOn: "2027-06-12", plan: "tek", coverUrl: demoImage("henna"), mediaCount: 342, guestCount: 64, role: "owner" },
    { id: "demo-bday", slug: "deniz-30", type: "dogum_gunu", title: "Deniz's Birthday", startsOn: "2026-12-05", plan: "free", coverUrl: demoImage("birthday"), mediaCount: 58, guestCount: 23, role: "cohost" },
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
    brand: "ourpixs",
    approvalMode: false,
    revealMode: "live",
    revealAt: null,
    uploadOpensAt: null,
    uploadClosesAt: null,
    hasPin: false,
    disposableShots: null,
    storageExpiresAt: "2030-06-14T00:00:00.000Z",
    days,
    guestUrl: `https://ourpixs.com/g/${s.slug}`,
    wallUrl: `https://ourpixs.com/wall/${s.slug}`,
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
      thumbUrl: img,
      displayUrl: video ? null : img,
      originalUrl: img,
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
  { id: "s1", token: "fam-izmir", url: "https://ourpixs.com/s/fam-izmir", scope: "all", label: "Family in Izmir", expiresAt: "2027-09-14T00:00:00.000Z" },
];

export function demoPublic(): PublicOccasion {
  const o = demoOccasion(DEMO_ID);
  return {
    slug: o.slug, type: o.type, title: "Elif & Can", honorees: o.honorees, startsOn: o.startsOn, venueName: o.venueName, city: o.city,
    theme: o.theme, brand: o.brand, plan: o.plan, days, moments: ["Halay", "First dance", "Gold ceremony", "Cake", "Family"],
    liveWall: true, missionsEnabled: true, disposableShots: null, voiceGuestbook: true, uploadOpen: true, revealMode: "live", revealAt: null,
    brandingMode: "platform",
  };
}

export const demoOrg: Organisation = { id: "demo-org", name: "The Grand Hall", logoUrl: null, primaryColor: "#1B2440", accentColor: "#C9A96E", role: "owner" };

export function demoVenueOccasions(): OccasionSummary[] {
  return [
    { id: "demo-v1", slug: "ayse-mert", type: "dugun", title: "Ayşe & Mert's Wedding", startsOn: "2027-05-22", plan: "buyuk", coverUrl: demoImage("family"), mediaCount: 940, guestCount: 180, role: "owner" },
    { id: "demo-v2", slug: "acme-awards", type: "kurumsal", title: "Acme Awards Night", startsOn: "2027-03-10", plan: "buyuk", coverUrl: demoImage("poster"), mediaCount: 410, guestCount: 120, role: "owner" },
  ];
}
