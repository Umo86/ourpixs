import type { L } from "./i18n";

export const DEMO_COPY: L<{
  metaTitle: string; metaDesc: string; sticker: string; title: string; accent: string; lead: string; notice: string;
  event: string; tabs: string[]; guestCta: string; createCta: string; qrTitle: string; qrBody: string; qrAlt: string;
  stepsTitle: string; steps: string[]; likeLabel: string; likedLabel: string; ago: string; by: string; photos: { key: string; alt: string; guest: string; tag: string }[];
}> = {
  en: {
    metaTitle: "Live demo album", metaDesc: "See what your guests see. A demo album with sample photos, and a demo QR code to try it as a guest on your own phone.",
    sticker: "Demo · sample photos", title: "See what your", accent: "guests see.", lead: "This is a demo album with sample photos, laid out like the guest feed. Tap a heart, then scan the QR code with your phone to try it as a guest.",
    notice: "Demo only. These are stock photos and made-up guest names, not a real event.",
    event: "Elif & Can · Demo", tabs: ["Feed", "Challenges", "Camera", "Guestbook"], guestCta: "Try it as a guest", createCta: "Create your event →",
    qrTitle: "Scan to try it", qrBody: "Point your phone camera at the code. No app, no sign-up.", qrAlt: "QR code for the demo album",
    stepsTitle: "What you'll see", steps: ["Type a first name", "Upload or take a photo", "Watch it appear in the feed"],
    likeLabel: "Love this photo", likedLabel: "Loved", ago: "Just now", by: "by",
    photos: [
      { key: "wedding", alt: "Bride smiling on the dance floor", guest: "Aylin", tag: "Grand entrance" },
      { key: "selfie", alt: "Friends taking a group selfie", guest: "Mert", tag: "Friends" },
      { key: "henna", alt: "Bridal henna on a hand", guest: "Zeynep", tag: "Henna" },
      { key: "family", alt: "Family toasting at dinner", guest: "Deniz", tag: "Family" },
      { key: "birthday", alt: "Friends with a cake and sparklers", guest: "Selin", tag: "Cake" },
      { key: "couple", alt: "Couple laughing, black and white", guest: "Emre", tag: "First dance" },
      { key: "grad", alt: "Graduates celebrating", guest: "Ece", tag: "Party" },
      { key: "baby", alt: "Friends toasting at a shower", guest: "Burak", tag: "Toast" },
      { key: "poster", alt: "Party with friends dancing", guest: "Ada", tag: "Dancing" },
    ],
  },
  tr: {
    metaTitle: "Canlı demo albüm", metaDesc: "Misafirlerinizin ne gördüğünü görün. Örnek fotoğraflı bir demo albüm ve kendi telefonunuzda misafir olarak denemek için demo QR kodu.",
    sticker: "Demo · örnek fotoğraflar", title: "Misafirleriniz", accent: "ne görüyor?", lead: "Bu, örnek fotoğraflardan oluşan ve misafir akışı gibi düzenlenmiş bir demo albüm. Bir kalbe dokunun, sonra QR kodu telefonunuzla okutup misafir olarak deneyin.",
    notice: "Yalnızca demo. Fotoğraflar stok görsel, misafir adları uydurmadır; gerçek bir etkinlik değildir.",
    event: "Elif & Can · Demo", tabs: ["Akış", "Görevler", "Kamera", "Anı defteri"], guestCta: "Misafir olarak deneyin", createCta: "Etkinliğinizi oluşturun →",
    qrTitle: "Denemek için okutun", qrBody: "Telefonunuzun kamerasını koda tutun. Uygulama yok, üyelik yok.", qrAlt: "Demo albümün QR kodu",
    stepsTitle: "Neler göreceksiniz", steps: ["Adınızı yazın", "Fotoğraf yükleyin ya da çekin", "Akışta belirmesini izleyin"],
    likeLabel: "Bu fotoğrafı beğen", likedLabel: "Beğenildi", ago: "Az önce", by: "paylaşan:",
    photos: [
      { key: "wedding", alt: "Dans pistinde gülümseyen gelin", guest: "Aylin", tag: "Gelin girişi" },
      { key: "selfie", alt: "Toplu selfie çeken arkadaşlar", guest: "Mert", tag: "Arkadaşlar" },
      { key: "henna", alt: "Kınalı bir el", guest: "Zeynep", tag: "Kına" },
      { key: "family", alt: "Yemekte kadeh kaldıran aile", guest: "Deniz", tag: "Aile" },
      { key: "birthday", alt: "Pasta ve maytaplı arkadaşlar", guest: "Selin", tag: "Pasta" },
      { key: "couple", alt: "Siyah beyaz gülen çift", guest: "Emre", tag: "İlk dans" },
      { key: "grad", alt: "Kutlama yapan mezunlar", guest: "Ece", tag: "Eğlence" },
      { key: "baby", alt: "Kadeh kaldıran arkadaşlar", guest: "Burak", tag: "Kadeh" },
      { key: "poster", alt: "Dans eden arkadaşlarla parti", guest: "Ada", tag: "Dans" },
    ],
  },
};
