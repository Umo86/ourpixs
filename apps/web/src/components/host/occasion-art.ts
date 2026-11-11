import type { OccasionType } from "@/lib/config";

/** Stock photos (public/media) used as covers until guests upload. */
export const OCCASION_ART: Record<OccasionType, string> = {
  dugun: "/media/wedding.jpg", nisan: "/media/couple.jpg", kina: "/media/henna.jpg", sunnet: "/media/family.jpg",
  dogum_gunu: "/media/birthday.jpg", bebek: "/media/baby.jpg", mezuniyet: "/media/grad.jpg", yildonumu: "/media/couple.jpg",
  ev_partisi: "/media/selfie.jpg", kurumsal: "/media/poster.jpg", diger: "/media/family.jpg",
};
export const coverFallback = (t: OccasionType) => OCCASION_ART[t];
