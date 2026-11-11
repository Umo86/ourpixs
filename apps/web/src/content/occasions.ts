import type { OccasionType, Plan } from "@/lib/config";
import type { MEDIA } from "@/components/marketing/constants";
import type { FaqItem, L } from "./i18n";

export type OccasionCopy = {
  nav: string;
  metaTitle: string;
  metaDesc: string;
  title: string;
  accent: string;
  lead: string;
  imageAlt: string;
  momentsLead: string;
  steps: { title: string; body: string }[];
  faq: FaqItem[];
  ctaTitle: string;
  ctaAccent: string;
};
export type OccasionPage = { slug: string; type: OccasionType; image: keyof typeof MEDIA; plan: Plan } & L<OccasionCopy>;

export const OCCASION_UI: L<{ momentsTitle: string; momentsAccent: string; howTitle: string; howAccent: string; faqTitle: string; faqAccent: string; planLabel: string; demo: string; start: string; others: string }> = {
  en: { momentsTitle: "Moments", momentsAccent: "set up for you.", howTitle: "How it", howAccent: "works.", faqTitle: "Good to", faqAccent: "know", planLabel: "Suggested plan", demo: "Try the live demo", start: "Create your event →", others: "Other occasions" },
  tr: { momentsTitle: "Sizin için", momentsAccent: "hazır anlar.", howTitle: "Nasıl", howAccent: "çalışır?", faqTitle: "Merak", faqAccent: "edilenler", planLabel: "Önerilen plan", demo: "Canlı demoyu deneyin", start: "Etkinliğinizi oluşturun →", others: "Diğer etkinlik türleri" },
};

const noApp = (en: boolean) => en
  ? { q: "Do my guests need to install an app?", a: "No. They scan the QR code, type their first name and upload from the phone's browser. There is nothing to download and no account to create." }
  : { q: "Misafirlerimin uygulama indirmesi gerekiyor mu?", a: "Hayır. QR kodu okutur, adlarını yazar ve telefonlarının tarayıcısından yüklerler. İndirilecek bir şey ya da açılacak bir hesap yok." };

export const OCCASION_PAGES: OccasionPage[] = [
  {
    slug: "wedding", type: "dugun", image: "wedding", plan: "buyuk",
    en: {
      nav: "Weddings", metaTitle: "Wedding photo sharing with a QR code", metaDesc: "Collect every guest photo and video from your wedding in one album. Scan, upload, no app. Multi-day events, live wall and full-quality downloads.",
      title: "Every angle of", accent: "your wedding.", lead: "Your photographer shows the highlights. Your guests capture everything else: the grand entrance from the back row, the halay, the quiet moments at table nine. One QR code gathers it all.",
      imageAlt: "Bride smiling on the dance floor under blue light", momentsLead: "Guests tag what they shoot, so the album is easy to browse afterwards. Henna night, wedding and after-party can live in one album.",
      steps: [
        { title: "Create the album", body: "Choose Wedding, add your names and dates, and add a day for each part of the celebration." },
        { title: "Put QR cards on the tables", body: "Print them from your dashboard in your colours, in English and Turkish, with a separate QR for each day if you like." },
        { title: "Watch it fill up", body: "Show uploads on the live wall during the night. The next morning, download every original in one ZIP." }],
      faq: [noApp(true),
        { q: "Can I include the henna night and the after-party?", a: "Yes. The Big Day plan covers up to 5 days in one album, and each day can have its own QR code." },
        { q: "How long are the photos kept?", a: "For the storage period of your plan, shown on the pricing page. We email you before it ends so you can download everything." }],
      ctaTitle: "Don't miss a", ctaAccent: "single shot.",
    },
    tr: {
      nav: "Düğünler", metaTitle: "QR kodla düğün fotoğrafı paylaşımı", metaDesc: "Düğününüzdeki tüm misafir fotoğraf ve videolarını tek albümde toplayın. Okut, yükle; uygulama yok. Çok günlü etkinlik, canlı ekran ve tam kalite indirme.",
      title: "Düğününüzün", accent: "her açısı.", lead: "Fotoğrafçınız öne çıkan anları çeker. Gerisini misafirleriniz yakalar: arka sıradan gelin girişi, halay, dokuzuncu masadaki sessiz anlar. Tek bir QR kod hepsini bir araya getirir.",
      imageAlt: "Mavi ışık altında dans pistinde gülümseyen gelin", momentsLead: "Misafirler çektiklerini bir ana etiketler; böylece albümde sonradan gezinmek kolaylaşır. Kına, düğün ve after party tek bir albümde durabilir.",
      steps: [
        { title: "Albümü oluşturun", body: "“Düğün” seçeneğini seçin, isimlerinizi ve tarihleri girin, kutlamanın her bölümü için bir gün ekleyin." },
        { title: "Masalara QR kartları koyun", body: "Panelinizden kendi renklerinizle, Türkçe ve İngilizce olarak yazdırın; isterseniz her gün için ayrı QR kullanın." },
        { title: "Albümün dolmasını izleyin", body: "Gece boyunca yüklenenleri canlı ekranda gösterin. Ertesi sabah tüm orijinal dosyaları tek bir ZIP olarak indirin." }],
      faq: [noApp(false),
        { q: "Kına gecesini ve after party'yi de ekleyebilir miyim?", a: "Evet. Büyük Gün planı tek albümde 5 güne kadar destekler; her günün kendi QR kodu olabilir." },
        { q: "Fotoğraflar ne kadar süre saklanır?", a: "Planınızın saklama süresi boyunca; bu süre fiyatlar sayfasında yazıyor. Süre dolmadan önce size e-posta göndeririz, böylece her şeyi indirebilirsiniz." }],
      ctaTitle: "Tek bir kareyi", ctaAccent: "bile kaçırmayın.",
    },
  },
  {
    slug: "henna-night", type: "kina", image: "henna", plan: "buyuk",
    en: {
      nav: "Henna nights", metaTitle: "Henna night (kına gecesi) photo sharing", metaDesc: "Collect photos and videos from a kına gecesi: the henna, the folk songs and the halay, all from your guests' phones. No app needed.",
      title: "A kına gecesi,", accent: "remembered by everyone.", lead: "Tears, folk songs, the bride's red veil, the whole family on the dance floor. At a henna night everyone is holding a phone. Make sure the best shots end up in one place.",
      imageAlt: "Bridal henna on a hand beside a bouquet", momentsLead: "Moments like henna, folk songs and halay are ready to tag, in Turkish or English.",
      steps: [
        { title: "Choose Henna night", body: "Add the bride's name and the date. The wording and moments are set up for you." },
        { title: "Share the QR and the link", body: "Print QR cards for the tables and send the guest link in the family WhatsApp group, so relatives who can't come can join in." },
        { title: "Keep it for later", body: "Download the originals the next day and keep them with your wedding album." }],
      faq: [noApp(true),
        { q: "Can the henna night and the wedding be separate?", a: "Yes. Give each its own day, with a separate QR code, inside the same event on the Big Day plan. Or create two events." },
        { q: "Can relatives abroad see the photos?", a: "Yes. Anyone you send the guest link to can follow the feed and add their own photos from wherever they are. On the Big Day plan you can also create a separate private family link." }],
      ctaTitle: "Keep every", ctaAccent: "henna song.",
    },
    tr: {
      nav: "Kına geceleri", metaTitle: "Kına gecesi fotoğraf paylaşımı", metaDesc: "Kına gecesindeki fotoğraf ve videoları toplayın: kına, türküler ve halay, hepsi misafirlerinizin telefonlarından. Uygulama gerekmez.",
      title: "Kına gecesi,", accent: "herkesin gözünden.", lead: "Gözyaşları, türküler, gelinin al duvağı, dans pistinde tüm aile. Kına gecesinde herkesin elinde bir telefon vardır. En güzel kareler tek bir yerde buluşsun.",
      imageAlt: "Gelin buketinin yanında kınalı bir el", momentsLead: "Kına yakma, türküler ve halay gibi anlar Türkçe ya da İngilizce olarak etiketlenmeye hazır.",
      steps: [
        { title: "“Kına gecesi”ni seçin", body: "Gelinin adını ve tarihi girin. Metinler ve anlar sizin için hazır." },
        { title: "QR kodu ve bağlantıyı paylaşın", body: "Masalar için QR kartları yazdırın, misafir bağlantısını da aile WhatsApp grubuna gönderin; gelemeyen akrabalar da katılsın." },
        { title: "Sonrası için saklayın", body: "Ertesi gün orijinal dosyaları indirin, düğün albümünüzün yanında saklayın." }],
      faq: [noApp(false),
        { q: "Kına ve düğün ayrı olabilir mi?", a: "Evet. Büyük Gün planında aynı etkinliğin içinde her birine ayrı QR kodlu bir gün verebilirsiniz. İsterseniz iki ayrı etkinlik de oluşturabilirsiniz." },
        { q: "Yurt dışındaki akrabalar fotoğrafları görebilir mi?", a: "Evet. Misafir bağlantısını gönderdiğiniz herkes, nerede olursa olsun akışı izleyebilir ve kendi fotoğraflarını ekleyebilir. Büyük Gün planında ayrıca özel bir aile bağlantısı da oluşturabilirsiniz." }],
      ctaTitle: "Her kına türküsü", ctaAccent: "saklansın.",
    },
  },
  {
    slug: "sunnet", type: "sunnet", image: "family", plan: "tek",
    en: {
      nav: "Sünnet celebrations", metaTitle: "Sünnet celebration photo sharing", metaDesc: "Collect photos and videos from a sünnet düğünü. The little prince, the family and the party, shared by every guest with one QR code.",
      title: "The little prince's day,", accent: "from every guest.", lead: "A sünnet celebration brings the whole family together: grandparents, cousins, neighbours. Everyone takes photos, but few people ever see them all. One QR code puts them in a single album.",
      imageAlt: "Family raising a toast at an outdoor evening dinner", momentsLead: "Tag the prince, the family, the party and the cake, in Turkish or English.",
      steps: [
        { title: "Create the celebration", body: "Choose Sünnet, add the little prince's name and the date." },
        { title: "Invite the family", body: "Put a QR card on each table and share the link in the family group chat." },
        { title: "Enjoy the album", body: "Download everything the next day and share the best shots with those who couldn't come." }],
      faq: [noApp(true),
        { q: "Is it suitable for children's photos?", a: "Albums are private: only people with your link can see them, and pages are kept out of search engines. You decide who gets the link and you can remove any photo." },
        { q: "Which plan do I need?", a: "One Day suits most celebrations. Try it free first with up to 100 photos." }],
      ctaTitle: "Keep the whole", ctaAccent: "family day.",
    },
    tr: {
      nav: "Sünnet düğünleri", metaTitle: "Sünnet düğünü fotoğraf paylaşımı", metaDesc: "Sünnet düğünündeki fotoğraf ve videoları toplayın. Şehzade, aile ve eğlence; tek bir QR kodla her misafirden.",
      title: "Şehzadenin günü,", accent: "her misafirden.", lead: "Sünnet düğünü tüm aileyi bir araya getirir: büyükanneler, kuzenler, komşular. Herkes fotoğraf çeker ama hepsini gören pek olmaz. Tek bir QR kod hepsini tek albümde toplar.",
      imageAlt: "Açık havada akşam yemeğinde kadeh kaldıran aile", momentsLead: "Şehzadeyi, aileyi, eğlenceyi ve pastayı Türkçe ya da İngilizce olarak etiketleyin.",
      steps: [
        { title: "Kutlamayı oluşturun", body: "“Sünnet” seçeneğini seçin, şehzadenin adını ve tarihi girin." },
        { title: "Aileyi davet edin", body: "Her masaya bir QR kart koyun, bağlantıyı aile grubunda paylaşın." },
        { title: "Albümün keyfini çıkarın", body: "Ertesi gün her şeyi indirin, en güzel kareleri gelemeyenlerle paylaşın." }],
      faq: [noApp(false),
        { q: "Çocuk fotoğrafları için uygun mu?", a: "Albümler gizlidir: yalnızca bağlantıya sahip olanlar görebilir ve sayfalar arama motorlarının dışında tutulur. Bağlantıyı kimin alacağına siz karar verirsiniz, istediğiniz fotoğrafı kaldırabilirsiniz." },
        { q: "Hangi plana ihtiyacım var?", a: "Çoğu kutlama için Tek Gün planı yeterlidir. Önce 100 fotoğrafa kadar ücretsiz deneyebilirsiniz." }],
      ctaTitle: "Ailenin bu özel gününü", ctaAccent: "saklayın.",
    },
  },
  {
    slug: "engagement", type: "nisan", image: "couple", plan: "tek",
    en: {
      nav: "Engagements", metaTitle: "Engagement party (nişan) photo sharing", metaDesc: "Capture the ring moment, the halay and the families coming together. One QR code collects every guest photo from your engagement.",
      title: "The ring moment,", accent: "from every seat.", lead: "Two families, one room, one very important minute. Your guests will all film it from different angles. Collect the lot without chasing anyone on WhatsApp.",
      imageAlt: "Bride and groom laughing together in black and white", momentsLead: "Ring moment, halay, cake and family are ready to tag.",
      steps: [
        { title: "Create the event", body: "Choose Engagement and add both names." },
        { title: "Share the QR", body: "Put a card on each table and send the link to anyone who couldn't be there." },
        { title: "Relive it", body: "Watch the uploads on the live wall, then download the originals the next day." }],
      faq: [noApp(true),
        { q: "Can I turn it into my wedding album later?", a: "Create a new Big Day event for the wedding and keep the engagement album as it is. Both stay in your dashboard." },
        { q: "What does it cost?", a: "Start free, or choose One Day for unlimited photos and live wall. All prices are on the pricing page." }],
      ctaTitle: "Say yes to", ctaAccent: "every photo.",
    },
    tr: {
      nav: "Nişanlar", metaTitle: "Nişan fotoğraf paylaşımı", metaDesc: "Yüzük takma anını, halayı ve iki ailenin buluşmasını yakalayın. Tek bir QR kod, nişanınızdaki tüm misafir fotoğraflarını toplar.",
      title: "Yüzük takma anı,", accent: "her koltuktan.", lead: "İki aile, tek salon, çok önemli bir dakika. Misafirlerin hepsi farklı açılardan çekecek. Kimsenin peşinden WhatsApp'ta koşmadan hepsini toplayın.",
      imageAlt: "Siyah beyaz bir karede birlikte gülen gelin ve damat", momentsLead: "Yüzük takma, halay, pasta ve aile anları etiketlenmeye hazır.",
      steps: [
        { title: "Etkinliği oluşturun", body: "“Nişan” seçeneğini seçin, iki ismi de girin." },
        { title: "QR kodu paylaşın", body: "Her masaya bir kart koyun, gelemeyenlere bağlantıyı gönderin." },
        { title: "Anıları yeniden yaşayın", body: "Yüklenenleri canlı ekranda izleyin, ertesi gün orijinal dosyaları indirin." }],
      faq: [noApp(false),
        { q: "Sonradan düğün albümüne dönüştürebilir miyim?", a: "Düğün için yeni bir Büyük Gün etkinliği oluşturun, nişan albümü olduğu gibi kalsın. İkisi de panelinizde durur." },
        { q: "Ne kadar tutar?", a: "Ücretsiz başlayabilir ya da sınırsız fotoğraf ve canlı ekran için Tek Gün planını seçebilirsiniz. Tüm fiyatlar fiyatlar sayfasında." }],
      ctaTitle: "Her fotoğrafa", ctaAccent: "evet deyin.",
    },
  },
  {
    slug: "birthday", type: "dogum_gunu", image: "birthday", plan: "free",
    en: {
      nav: "Birthdays", metaTitle: "Birthday party photo sharing", metaDesc: "Gather every photo from a birthday party with one QR code. Cake, candles and chaos, from all your guests. Free to try.",
      title: "The cake, the candles,", accent: "the chaos.", lead: "Birthday parties are over in a blur. Let every guest add what they saw, from the surprise to the last dance, and look through it all the next day.",
      imageAlt: "Friends with a birthday cake and sparklers", momentsLead: "Cake, candles, gifts and dancing are ready to tag.",
      steps: [
        { title: "Start free", body: "Choose Birthday, add the name and date. The free plan covers a small party." },
        { title: "Stick up a QR", body: "Print a card or a sign, or just send the link to the group chat." },
        { title: "Look back", body: "Scroll the album and download your favourites the next morning." }],
      faq: [noApp(true),
        { q: "Is there a free plan?", a: "Yes: 1 day, up to 100 photos (no video) and 30 days of storage. Upgrade to One Day for unlimited photos, video and the live wall." },
        { q: "Can I try a disposable-camera style party?", a: "Yes. On paid plans, guests get a limited number of shots each, revealed together the next morning." }],
      ctaTitle: "Blow out the", ctaAccent: "candles. We'll catch it.",
    },
    tr: {
      nav: "Doğum günleri", metaTitle: "Doğum günü fotoğraf paylaşımı", metaDesc: "Doğum günü partisindeki tüm fotoğrafları tek bir QR kodla toplayın. Pasta, mumlar ve eğlence; bütün misafirlerinizden. Ücretsiz deneyin.",
      title: "Pasta, mumlar,", accent: "kahkahalar.", lead: "Doğum günleri bir anda geçer gider. Sürpriz anından son dansa kadar her misafir gördüğünü eklesin, ertesi gün hepsine birlikte bakın.",
      imageAlt: "Doğum günü pastası ve maytaplarla kutlama yapan arkadaşlar", momentsLead: "Pasta, mumlar, hediyeler ve dans anları etiketlenmeye hazır.",
      steps: [
        { title: "Ücretsiz başlayın", body: "“Doğum günü” seçeneğini seçin, adı ve tarihi girin. Ücretsiz plan küçük bir parti için yeterli." },
        { title: "Bir QR kod asın", body: "Bir kart ya da afiş yazdırın, ya da bağlantıyı doğrudan grup sohbetine gönderin." },
        { title: "Geriye dönüp bakın", body: "Albümde gezinin, ertesi sabah favorilerinizi indirin." }],
      faq: [noApp(false),
        { q: "Ücretsiz plan var mı?", a: "Evet: 1 gün, 100 fotoğrafa kadar (video yok) ve 30 gün saklama. Sınırsız fotoğraf, video ve canlı ekran için Tek Gün planına geçebilirsiniz." },
        { q: "Tek kullanımlık kamera tarzı bir parti yapabilir miyim?", a: "Evet. Ücretli planlarda her misafire sınırlı sayıda kare hakkı verilir; kareler ertesi sabah birlikte ortaya çıkar." }],
      ctaTitle: "Mumları siz üfleyin,", ctaAccent: "kareleri biz toplayalım.",
    },
  },
  {
    slug: "house-party", type: "ev_partisi", image: "selfie", plan: "free",
    en: {
      nav: "House parties", metaTitle: "House party and get-together photo sharing", metaDesc: "Friends and family get-togethers, housewarmings and dinners: collect everyone's photos in one place with a QR code. Free to try.",
      title: "A night with friends,", accent: "in one album.", lead: "Group chats bury photos and compress them. A shared QR album keeps the originals together and lets everyone see the night through everyone else's eyes.",
      imageAlt: "Friends taking a group selfie at a party", momentsLead: "Dancing, friends and food are ready to tag.",
      steps: [
        { title: "Create it in minutes", body: "Choose House party, name it, and you're done." },
        { title: "Share the link", body: "Send it to the group chat or show the QR on the fridge." },
        { title: "Keep the originals", body: "Everyone's photos, in full quality, ready to download." }],
      faq: [noApp(true),
        { q: "Why not just use a WhatsApp group?", a: "WhatsApp is great for chatting, but it usually compresses photos and buries them in conversation. See our comparison page for a fair side-by-side." },
        { q: "Is it free?", a: "You can start free: 1 day, up to 100 photos and 30 days of storage. Paid plans add video and the live wall." }],
      ctaTitle: "Your next night in", ctaAccent: "one album.",
    },
    tr: {
      nav: "Ev partileri", metaTitle: "Ev partisi ve aile buluşması fotoğraf paylaşımı", metaDesc: "Arkadaş ve aile buluşmaları, yeni ev partileri ve yemekler: herkesin fotoğraflarını QR kodla tek yerde toplayın. Ücretsiz deneyin.",
      title: "Arkadaşlarla bir gece,", accent: "tek albümde.", lead: "Grup sohbetleri fotoğrafları sıkıştırır ve mesajların arasında kaybeder. Ortak bir QR albüm orijinalleri bir arada tutar, herkesin geceyi başkalarının gözünden de görmesini sağlar.",
      imageAlt: "Partide toplu selfie çeken arkadaşlar", momentsLead: "Dans, arkadaşlar ve yemek anları etiketlenmeye hazır.",
      steps: [
        { title: "Dakikalar içinde oluşturun", body: "“Ev partisi” seçeneğini seçin, bir ad verin; hepsi bu." },
        { title: "Bağlantıyı paylaşın", body: "Grup sohbetine gönderin ya da QR kodu buzdolabına koyun." },
        { title: "Orijinalleri saklayın", body: "Herkesin fotoğrafları tam kalitede, indirmeye hazır." }],
      faq: [noApp(false),
        { q: "WhatsApp grubu yetmez mi?", a: "WhatsApp sohbet için harika, ancak fotoğraflar genellikle sıkıştırılır ve konuşmaların arasında kaybolur. Adil bir yan yana karşılaştırma için karşılaştırma sayfamıza bakın." },
        { q: "Ücretsiz mi?", a: "Ücretsiz başlayabilirsiniz: 1 gün, 100 fotoğrafa kadar ve 30 gün saklama. Ücretli planlarda video ve canlı ekran da var." }],
      ctaTitle: "Bir sonraki geceniz", ctaAccent: "tek albümde.",
    },
  },
];

export const getOccasionPage = (slug: string) => OCCASION_PAGES.find((o) => o.slug === slug);
