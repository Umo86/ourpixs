import type { Locale } from "@/lib/config";
import type { FaqItem } from "./i18n";

export type HelpGroup = { id: string; title: string; items: FaqItem[] };
export type HelpVars = { days: number; email: string; upgrade: string };

export const HELP_UI = {
  en: { metaTitle: "Help centre", metaDesc: "Answers about guests, hosts, payments and refunds, privacy and safety, and venue Wi-Fi.", title: "How can we", accent: "help?", lead: "Search the answers below. Can't find yours? Email us and a person will reply.", search: "Search help", placeholder: "Search, e.g. refund, Wi-Fi, app", none: "Nothing matches that search. Try another word, or email us.", contact: "Still stuck? Email", count: "{n} answers" },
  tr: { metaTitle: "Yardım merkezi", metaDesc: "Misafirler, ev sahipleri, ödemeler ve iadeler, gizlilik ve güvenlik ile mekan Wi-Fi'ı hakkında yanıtlar.", title: "Size nasıl", accent: "yardımcı olabiliriz?", lead: "Aşağıdaki yanıtlarda arama yapın. Aradığınızı bulamadınız mı? Bize yazın; size bir insan yanıt verir.", search: "Yardımda ara", placeholder: "Ara, örn. iade, Wi-Fi, uygulama", none: "Bu aramayla eşleşen bir şey yok. Başka bir sözcük deneyin ya da bize yazın.", contact: "Hâlâ takıldınız mı? Yazın:", count: "{n} yanıt" },
} as const;

export function helpGroups(locale: Locale, v: HelpVars): HelpGroup[] {
  return locale === "tr"
    ? [
      { id: "guests", title: "Misafirler", items: [
        { q: "Uygulama indirmem gerekiyor mu?", a: "Hayır. QR kodu telefonunuzun kamerasıyla okutun, adınızı yazın ve yüklemeye başlayın. Her telefonun tarayıcısında çalışır." },
        { q: "Başkalarının fotoğraflarını görebilir miyim?", a: "Ev sahibi izin verdiyse canlı akışta herkesin paylaştıklarını görebilir, kalp ya da gülen yüz bırakabilirsiniz." },
        { q: "Yüklediğim bir fotoğrafı silebilir miyim?", a: "Evet. Yüklediğiniz telefondan albümdeki kendi yüklemelerinizi açıp silebilirsiniz. Başka bir cihazdaysanız ev sahibine söyleyin ya da bize yazın. Ev sahibi de istediği fotoğrafı kaldırabilir." },
        { q: "QR kodu okutamıyorum, ne yapmalıyım?", a: "Kamerayı koda biraz daha yaklaştırın ve ışığı kontrol edin. Olmazsa ev sahibinden bağlantıyı WhatsApp ile göndermesini isteyin." }] },
      { id: "hosts", title: "Ev sahipleri", items: [
        { q: "Etkinlik oluşturmak ne kadar sürer?", a: "Yaklaşık üç dakika: etkinlik türünü seçin, isimleri ve tarihi girin, QR kartlarınızı yazdırın." },
        { q: "Kına ve düğün için ayrı QR kodları olabilir mi?", a: "Evet. Büyük Gün planında her gün için ayrı bir QR kod verebilirsiniz; her buluşmanın kendi misafirleri ve fotoğrafları olur." },
        { q: "Fotoğraflar yayınlanmadan önce onaylayabilir miyim?", a: "Evet. İsteğe bağlı onay özelliğini açın. Otomatik denetim de bulanık, tekrar eden ya da uygunsuz görünen fotoğrafları incelemeniz için işaretler." },
        { q: "Albümü nasıl indiririm?", a: "Panelinizden tüm orijinal dosyaları tek bir ZIP olarak indirebilirsiniz. Saklama süreniz dolmadan indirmeyi unutmayın." },
        { q: "Yurt dışındaki akrabalar nasıl katılır?", a: "Özel bir aile bağlantısı oluşturun ve WhatsApp ile gönderin. Büyük Gün planında kullanılabilir." }] },
      { id: "payments", title: "Ödemeler ve iadeler", items: [
        { q: "Abonelik var mı?", a: "Etkinlik planlarında yok: etkinlik başına bir kez ödersiniz. Mekanlar için Partner planı ise aylık bir aboneliktir." },
        { q: "Para iadesi alabilir miyim?", a: `Evet. Ücretli etkinlik planlarında ${v.days} gün para iade garantisi vardır. Satın almanızdan sonraki ${v.days} gün içinde ${v.email} adresine yazın, sebep sormadan iade edelim.` },
        { q: "Sonradan yükseltebilir miyim?", a: `Evet. Tek Gün planından Büyük Gün planına geçerken yalnızca ${v.upgrade} farkı ödersiniz.` },
        { q: "Saklama süresi bitince ne olur?", a: "Süre dolmadan 30 ve 7 gün önce size e-posta göndeririz; böylece her şeyi indirebilirsiniz. Süreyi uzatmak için bizimle iletişime geçin." }] },
      { id: "privacy", title: "Gizlilik ve güvenlik", items: [
        { q: "Albümü kimler görebilir?", a: "Yalnızca bağlantıya (ya da QR koda) sahip olanlar. Bağlantılar tahmin edilemez, isteğe bağlı PIN ekleyebilirsiniz ve sayfalar arama motorlarının dışında tutulur." },
        { q: "Verilerim nerede saklanıyor?", a: "Etkinlik verileri ve medya dosyaları Birleşik Krallık ve AB'de saklanır. Hizmet sağlayıcılarımız ve uyguladığımız güvenceler için gizlilik politikamıza bakın." },
        { q: "Hangi çerezleri kullanıyorsunuz?", a: "Yalnızca zorunlu olanları: oturum, dil ve misafir cihaz anahtarı. Reklam ya da izleme çerezi kullanmıyoruz." },
        { q: "Bir fotoğrafın kaldırılmasını nasıl isterim?", a: `Önce ev sahibine söyleyin. Çözülmezse ${v.email} adresine yazın.` }] },
      { id: "wifi", title: "Mekan Wi-Fi'ı", items: [
        { q: "Mekanda Wi-Fi yoksa ne olur?", a: "Misafirler kendi mobil verilerini kullanabilir. Yüklemeler sıraya alınır ve bağlantı zayıfsa kaldığı yerden devam eder." },
        { q: "İnternet yarıda kesilirse yükleme kaybolur mu?", a: "Hayır. Yükleme kuyruğu bağlantı geri geldiğinde otomatik devam eder." },
        { q: "Canlı ekran için ne gerekiyor?", a: "İnternete bağlı bir bilgisayar ya da tarayıcısı olan bir televizyon yeterli; canlı ekran bağlantısını bu ekranda açın. Canlı ekran Tek Gün ve Büyük Gün planlarında vardır." }] },
    ]
    : [
      { id: "guests", title: "Guests", items: [
        { q: "Do I need to install an app?", a: "No. Scan the QR code with your phone's camera, type your first name and start uploading. It works in any phone browser." },
        { q: "Can I see other people's photos?", a: "If the host allows it, you can scroll the live feed and tap a heart or a laugh." },
        { q: "Can I delete a photo I uploaded?", a: "Yes. On the phone you uploaded from, open your own uploads in the album and delete it. On a different device, ask the host or email us. The host can also remove any photo." },
        { q: "The QR code won't scan. What now?", a: "Move closer, check the light and hold steady. If it still fails, ask the host to send you the link on WhatsApp." }] },
      { id: "hosts", title: "Hosts", items: [
        { q: "How long does it take to set up an event?", a: "About three minutes: choose the occasion, add names and a date, print your QR cards." },
        { q: "Can the henna night and the wedding have separate QR codes?", a: "Yes. On the Big Day plan each day can have its own QR code, so every gathering has its own guests and photos." },
        { q: "Can I approve photos before they show?", a: "Yes. Turn on moderation. Auto-moderation also flags photos that look blurry, duplicated or inappropriate, so you can review them." },
        { q: "How do I download the album?", a: "From your dashboard, download every original as one ZIP. Do it before your storage period ends." },
        { q: "How do relatives abroad join in?", a: "Create a private family link and send it on WhatsApp. It is available on the Big Day plan." }] },
      { id: "payments", title: "Payments & refunds", items: [
        { q: "Is there a subscription?", a: "Not for event plans: you pay once per event. The Partner plan for venues is a monthly subscription." },
        { q: "Can I get a refund?", a: `Yes. Paid event plans have a ${v.days}-day money-back guarantee. Email ${v.email} within ${v.days} days of purchase and we'll refund you, no questions asked.` },
        { q: "Can I upgrade later?", a: `Yes. Moving from One Day to Big Day costs only the ${v.upgrade} difference.` },
        { q: "What happens when storage ends?", a: "We email you 30 days and 7 days before it ends, so you can download everything. To extend storage, contact us." }] },
      { id: "privacy", title: "Privacy & safety", items: [
        { q: "Who can see an album?", a: "Only people with the link or QR code. Links are unguessable, you can add a PIN, and pages are kept out of search engines." },
        { q: "Where is my data stored?", a: "Event data and media files are stored in the UK and EU. See our privacy policy for our providers and the safeguards we use." },
        { q: "Which cookies do you use?", a: "Only essential ones: sign-in, language and a guest device token. No advertising or tracking cookies." },
        { q: "How do I ask for a photo to be removed?", a: `Tell the host first. If that doesn't work, email ${v.email}.` }] },
      { id: "wifi", title: "Venue Wi-Fi", items: [
        { q: "What if the venue has no Wi-Fi?", a: "Guests can use their own mobile data. Uploads are queued and resume if the signal is weak." },
        { q: "Do uploads get lost if the connection drops?", a: "No. The upload queue resumes automatically when the connection returns." },
        { q: "What do I need for the live wall?", a: "A computer, or a TV with a web browser, connected to the internet. Open the live wall link on that screen. The live wall is included in the One Day and Big Day plans." }] },
    ];
}
