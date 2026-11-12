export const PEXELS_HOME = "https://www.pexels.com";
export const UNSPLASH_HOME = "https://unsplash.com";

/** Unsplash photos are hotlinked from images.unsplash.com, as Unsplash asks; `w` sets the delivered width. */
const unsplash = (id: string, w = 1600) => `https://images.unsplash.com/${id}?w=${w}&q=80&auto=format&fit=crop`;

export const MEDIA = {
  wedding: unsplash("photo-1708569177111-40b155d78801"),
  couple: unsplash("photo-1768611260730-0e0704e084cc"),
  birthday: "/media/birthday.jpg",
  selfie: unsplash("photo-1752650143737-71844bd21c83"),
  henna: "/media/henna.jpg",
  family: unsplash("photo-1527529482837-4698179dc6ce"),
  grad: unsplash("photo-1577036421869-7c8d388d2123"),
  baby: "/media/baby.jpg",
  poster: "/media/poster.jpg",
} as const;

/** A MEDIA image at a given width (Unsplash images are resized by their CDN; local files are served as they are). */
export function mediaUrl(key: keyof typeof MEDIA, w: number): string {
  const src: string = MEDIA[key];
  return src.startsWith("https://images.unsplash.com/") ? src.replace(/([?&])w=\d+/, `$1w=${w}`) : src;
}

/** Photo and video credits. Names are proper nouns. */
export const CREDITS: { key: keyof typeof MEDIA | "video"; name: string; source: "pexels" | "unsplash"; url?: string }[] = [
  { key: "video", name: "Yan Krukau", source: "pexels" },
  { key: "wedding", name: "Kari Bjorn Photography", source: "unsplash", url: "https://unsplash.com/photos/mF-K6v-fIqg" },
  { key: "couple", name: "Fotógrafo Samuel Cruz", source: "unsplash", url: "https://unsplash.com/photos/FrhQDQEFHMQ" },
  { key: "birthday", name: "Helena Lopes", source: "pexels" },
  { key: "selfie", name: "Vitaly Gariev", source: "unsplash", url: "https://unsplash.com/photos/rtLU82A-K6w" },
  { key: "henna", name: "amine photographe", source: "pexels" },
  { key: "family", name: "Al Elmes", source: "unsplash", url: "https://unsplash.com/photos/ULHxWq8reao" },
  { key: "grad", name: "Clay Banks", source: "unsplash", url: "https://unsplash.com/photos/Hf8n0RUk7g0" },
  { key: "baby", name: "Kampus Production", source: "pexels" },
];
