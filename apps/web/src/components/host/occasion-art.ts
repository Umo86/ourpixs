import type { OccasionType } from "@/lib/config";
import { MEDIA } from "@/components/marketing/constants";

/** Stock photos (Unsplash / Pexels, see MEDIA) used as covers until guests upload. */
export const OCCASION_ART: Record<OccasionType, string> = {
  dugun: MEDIA.wedding, nisan: MEDIA.couple, kina: MEDIA.henna, sunnet: MEDIA.family,
  dogum_gunu: MEDIA.birthday, bebek: MEDIA.baby, mezuniyet: MEDIA.grad, yildonumu: MEDIA.couple,
  ev_partisi: MEDIA.selfie, kurumsal: MEDIA.poster, diger: MEDIA.family,
};
export const coverFallback = (t: OccasionType) => OCCASION_ART[t];
