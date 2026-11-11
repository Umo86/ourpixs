import type { L } from "./i18n";

/** v = "yes" | "partial" | "no" | "varies". Facts are general and hedged; no competitor prices. */
export type Mark = "yes" | "partial" | "no" | "varies";
export type Row = { label: string; cells: [Mark, string][] }; // ours, WhatsApp, Google Photos, other QR apps

export const COMPARE: L<{
  title: string; accent: string; lead: string; updated: string; cols: string[]; rows: Row[];
  marks: Record<Mark, string>; fairTitle: string; fair: string[]; ctaNote: string;
}> = {
  en: {
    title: "How we compare,", accent: "fairly.", lead: "WhatsApp groups, Google Photos shared albums and other QR photo apps can all collect party photos. Here is how they differ in general terms. Products change, so check the details before you decide.",
    updated: "Last reviewed November 2026",
    cols: ["{brand}", "WhatsApp group", "Google Photos shared album", "Other QR photo apps"],
    marks: { yes: "Yes", partial: "Partly", no: "No", varies: "Varies" },
    rows: [
      { label: "Guests need to install an app", cells: [["no", "No, it works in the phone browser"], ["partial", "Guests need WhatsApp installed"], ["partial", "Phone app or a browser; adding photos usually needs a Google account"], ["varies", "Most are browser-based; some use an app"]] },
      { label: "Guests need an account or phone number shared", cells: [["no", "Just a first name"], ["yes", "Everyone joins with their number and sees the others"], ["yes", "A Google account is usually needed to add photos"], ["varies", "Usually no account"]] },
      { label: "Photos kept in original quality", cells: [["yes", "Originals, downloadable as a ZIP"], ["partial", "Photos and videos are usually compressed when sent as normal media"], ["yes", "Can keep original quality, depending on the account's storage settings"], ["varies", "Varies by product and plan"]] },
      { label: "Everything in one organised album", cells: [["yes", "By day, moment and guest"], ["no", "Photos mix with conversation"], ["yes", "One shared album"], ["yes", "Usually one gallery per event"]] },
      { label: "Live slideshow for the venue screen", cells: [["yes", "Live wall, on paid plans"], ["no", "Not built in"], ["no", "Not built in"], ["varies", "Common on paid plans"]] },
      { label: "Fun extras: challenges, disposable camera, voice guestbook", cells: [["yes", "On paid plans (voice guestbook on Big Day)"], ["no", "No"], ["no", "No"], ["varies", "Some offer a few"]] },
      { label: "Host approval before photos show", cells: [["yes", "Optional moderation"], ["partial", "Admins can remove messages afterwards"], ["partial", "Owner can remove items afterwards"], ["varies", "Varies"]] },
      { label: "Turkish and English, with kına, sünnet and nişan presets", cells: [["yes", "Both languages and occasion presets"], ["partial", "Chat works in any language, no event presets"], ["partial", "Many languages, no event presets"], ["varies", "Turkish is rarely a focus"]] },
      { label: "Cost", cells: [["partial", "Free plan, then a one-off payment per event"], ["yes", "Free"], ["yes", "Free within your storage allowance"], ["varies", "Free tiers or one-off or per-guest pricing"]] },
      { label: "Storage period", cells: [["partial", "Set by your plan; we email you before it ends"], ["partial", "Until messages or devices are cleared"], ["yes", "As long as your account and storage last"], ["varies", "Often months to a year or more"]] },
    ],
    fairTitle: "When another option is the better choice",
    fair: ["A small, casual get-together where everyone is already in a WhatsApp group: the group chat is free and perfectly fine.", "You already live in Google Photos and everyone invited has a Google account: a shared album is simple and long-lasting.", "You want printed books, invitations or RSVP tools in the same product: some other apps bundle those."],
    ctaNote: "Try it free at your next event and judge for yourself.",
  },
  tr: {
    title: "Adil bir", accent: "karşılaştırma.", lead: "WhatsApp grupları, Google Fotoğraflar ortak albümleri ve diğer QR fotoğraf uygulamaları parti fotoğraflarını toplamak için kullanılabilir. Aşağıda aralarındaki farkları genel hatlarıyla görebilirsiniz. Ürünler değiştiği için karar vermeden önce ayrıntıları kontrol edin.",
    updated: "Son gözden geçirme: Kasım 2026",
    cols: ["{brand}", "WhatsApp grubu", "Google Fotoğraflar ortak albümü", "Diğer QR fotoğraf uygulamaları"],
    marks: { yes: "Evet", partial: "Kısmen", no: "Hayır", varies: "Değişir" },
    rows: [
      { label: "Misafirlerin uygulama indirmesi gerekir", cells: [["no", "Hayır, telefonun tarayıcısında çalışır"], ["partial", "Misafirlerde WhatsApp kurulu olmalı"], ["partial", "Uygulama ya da tarayıcı; fotoğraf eklemek için genellikle Google hesabı gerekir"], ["varies", "Çoğu tarayıcı tabanlı, bazıları uygulama kullanır"]] },
      { label: "Hesap ya da telefon numarası paylaşımı gerekir", cells: [["no", "Yalnızca bir ad"], ["yes", "Herkes numarasıyla katılır ve diğerlerini görür"], ["yes", "Fotoğraf eklemek için genellikle Google hesabı gerekir"], ["varies", "Genellikle hesap gerekmez"]] },
      { label: "Fotoğraflar orijinal kalitede saklanır", cells: [["yes", "Orijinaller, ZIP olarak indirilebilir"], ["partial", "Normal medya olarak gönderilen fotoğraf ve videolar genellikle sıkıştırılır"], ["yes", "Hesabın depolama ayarına bağlı olarak orijinal kalite korunabilir"], ["varies", "Ürüne ve plana göre değişir"]] },
      { label: "Her şey tek ve düzenli bir albümde", cells: [["yes", "Güne, ana ve misafire göre"], ["no", "Fotoğraflar sohbetin içinde karışır"], ["yes", "Tek ortak albüm"], ["yes", "Genellikle etkinlik başına bir galeri"]] },
      { label: "Mekan ekranı için canlı slayt gösterisi", cells: [["yes", "Canlı ekran, ücretli planlarda"], ["no", "Yerleşik değil"], ["no", "Yerleşik değil"], ["varies", "Ücretli planlarda yaygın"]] },
      { label: "Eğlenceli ekstralar: görevler, tek kullanımlık kamera, sesli anı defteri", cells: [["yes", "Ücretli planlarda (sesli anı defteri Büyük Gün planında)"], ["no", "Yok"], ["no", "Yok"], ["varies", "Bazıları birkaçını sunar"]] },
      { label: "Fotoğraflar görünmeden önce ev sahibi onayı", cells: [["yes", "İsteğe bağlı onay"], ["partial", "Yöneticiler mesajları sonradan silebilir"], ["partial", "Albüm sahibi öğeleri sonradan kaldırabilir"], ["varies", "Değişir"]] },
      { label: "Türkçe ve İngilizce, kına, sünnet ve nişan şablonlarıyla", cells: [["yes", "İki dil ve etkinlik şablonları"], ["partial", "Sohbet her dilde çalışır, etkinlik şablonu yok"], ["partial", "Birçok dil, etkinlik şablonu yok"], ["varies", "Türkçe genellikle öncelikli değildir"]] },
      { label: "Maliyet", cells: [["partial", "Ücretsiz plan, sonrasında etkinlik başına tek ödeme"], ["yes", "Ücretsiz"], ["yes", "Depolama kotanız dahilinde ücretsiz"], ["varies", "Ücretsiz katmanlar, tek seferlik ya da misafir başı fiyat"]] },
      { label: "Saklama süresi", cells: [["partial", "Planınıza göre; süre dolmadan size e-posta göndeririz"], ["partial", "Mesajlar ya da cihazlar temizlenene kadar"], ["yes", "Hesabınız ve depolamanız sürdükçe"], ["varies", "Genellikle birkaç aydan bir yıl veya daha fazlasına"]] },
    ],
    fairTitle: "Başka bir seçenek ne zaman daha iyi?",
    fair: ["Herkesin zaten aynı WhatsApp grubunda olduğu küçük, samimi bir buluşma: grup sohbeti ücretsiz ve gayet yeterli.", "Zaten Google Fotoğraflar kullanıyorsanız ve davetlilerin hepsinin Google hesabı varsa: ortak albüm basit ve uzun ömürlüdür.", "Aynı üründe basılı kitap, davetiye ya da RSVP araçları istiyorsanız: bazı uygulamalar bunları bir arada sunar."],
    ctaNote: "Bir sonraki etkinliğinizde ücretsiz deneyin, kendiniz karar verin.",
  },
};
