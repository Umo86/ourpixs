/**
 * Built-in read-only demo event at /g/demo ("Try it as a guest" on the marketing site).
 * Nothing touches the DB or storage: the server renders static data and the browser simulates the API.
 */
import type { GuestMission, MediaItem, PublicOccasion } from "./api-types";
import { MAIN_BRAND, type Locale } from "./config";

export const DEMO_SLUG = "demo";
export const DEMO_COOKIE = "op_demo_name";
export const isDemo = (slug: string) => slug === DEMO_SLUG;

const PHOTOS = ["wedding", "couple", "henna", "family", "selfie", "birthday", "baby", "grad", "poster"];
const NAMES = ["Zeynep", "Mert", "Ayşe Teyze", "Burak", "Selin", "Hakan Amca", "Derya", "Ömer", "Elif"];

export function demoOccasion(locale: Locale): PublicOccasion {
  const tr = locale === "tr";
  const today = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const yesterday = new Date(today.getTime() - 86400000);
  return {
    slug: DEMO_SLUG, type: "dugun", title: "Elif & Can", honorees: ["Elif", "Can"], startsOn: iso(today), venueName: "The Grand", city: "London",
    theme: "noir", brand: MAIN_BRAND,
    days: [
      { id: "demo-day-1", name: tr ? "Kına" : "Henna night", date: iso(yesterday), sortOrder: 0, uploadOpen: true },
      { id: "demo-day-2", name: tr ? "Düğün" : "Wedding", date: iso(today), sortOrder: 1, uploadOpen: true },
    ],
    moments: tr ? ["Gelin girişi", "İlk dans", "Takı töreni", "Halay", "Pasta", "Aile"] : ["Grand entrance", "First dance", "Gold ceremony", "Halay", "Cake", "Family"],
    liveWall: true, missionsEnabled: true, disposableShots: 12, voiceGuestbook: true, uploadOpen: true, uploadsOpen: true, downloadsOpen: true,
    revealMode: "live", revealAt: null, coverUrl: "/media/wedding.jpg", hasPin: false,
  };
}

export function demoMedia(locale: Locale): MediaItem[] {
  const o = demoOccasion(locale);
  return PHOTOS.map((p, i) => ({
    id: `demo-${p}`, kind: "photo", thumbUrl: `/media/${p}.jpg`, displayUrl: `/media/${p}.jpg`, width: 800, height: 1000, durationS: null,
    momentTag: o.moments[i % o.moments.length] ?? null, dayId: i < 3 ? "demo-day-1" : "demo-day-2", guestName: NAMES[i] ?? null,
    reactionCount: 24 - i * 2, reactedByMe: false, createdAt: new Date(Date.now() - (i + 1) * 7 * 60000).toISOString(),
  }));
}

export function demoMissions(locale: Locale): GuestMission[] {
  const titles = locale === "tr"
    ? ["Gelin ya da damatla selfie", "Bütün masan tek karede", "En iyi halay pozu", "En yaşlı ve en genç misafir bir arada", "Mutluluktan ağlayan biri", "10 saniyelik video mesaj"]
    : ["Selfie with the bride or groom", "Your whole table, one frame", "Best halay face", "The oldest and youngest guest together", "Someone crying happy tears", "A 10-second video message"];
  return titles.map((title, i) => ({ id: `demo-m-${i}`, title, sortOrder: i, done: false, doneCount: [42, 31, 58, 9, 14, 27][i] ?? 0 }));
}
