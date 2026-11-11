/** Illustrative per-couple add-on price for the Partner ROI line (not a forecast). */
export const ROI_EXAMPLE_PENCE = 6000;

export const PEXELS_HOME = "https://www.pexels.com";

export const MEDIA = {
  wedding: "/media/wedding.jpg",
  couple: "/media/couple.jpg",
  birthday: "/media/birthday.jpg",
  selfie: "/media/selfie.jpg",
  henna: "/media/henna.jpg",
  family: "/media/family.jpg",
  grad: "/media/grad.jpg",
  baby: "/media/baby.jpg",
  poster: "/media/poster.jpg",
} as const;

/** Pexels credits. Names are proper nouns. */
export const CREDITS: { key: keyof typeof MEDIA | "video"; name: string }[] = [
  { key: "video", name: "Yan Krukau" },
  { key: "wedding", name: "Mario Amé" },
  { key: "couple", name: "Novkov Visuals" },
  { key: "birthday", name: "Helena Lopes" },
  { key: "selfie", name: "Pavel Danilyuk" },
  { key: "henna", name: "amine photographe" },
  { key: "family", name: "Askar Abayev" },
  { key: "grad", name: "George Pak" },
  { key: "baby", name: "Kampus Production" },
];
