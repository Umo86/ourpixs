import type { Locale } from "@/lib/config";
import type { FaqItem } from "./i18n";

export type HelpGroup = { id: string; title: string; items: FaqItem[] };
export type HelpVars = { days: number; email: string; monthly: string; yearly: string; saving: number };

export const HELP_UI = {
  en: { metaTitle: "Help centre", metaDesc: "Answers about guests, hosts, payments and refunds, privacy and safety, and venue Wi-Fi.", title: "How can we", accent: "help?", lead: "Search the answers below. Can't find yours? Email us and a person will reply.", search: "Search help", placeholder: "Search, e.g. refund, Wi-Fi, app", none: "Nothing matches that search. Try another word, or email us.", contact: "Still stuck? Email", count: "{n} answers" },
  tr: { metaTitle: "Yardım merkezi", metaDesc: "Misafirler, ev sahipleri, ödemeler ve iadeler, gizlilik ve güvenlik ile mekan Wi-Fi'si hakkında yanıtlar.", title: "Size nasıl", accent: "yardımcı olabiliriz?", lead: "Aşağıdaki yanıtlarda arama yapın. Aradığınızı bulamadınız mı? Bize yazın; gerçek bir kişi yanıtlar.", search: "Yardımda ara", placeholder: "Ara, örn. iade, Wi-Fi, uygulama", none: "Bu aramayla eşleşen bir şey yok. Başka bir sözcük deneyin ya da bize yazın.", contact: "Hâlâ takıldınız mı? Yazın:", count: "{n} yanıt" },
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
        { q: "Kına ve düğün için ayrı QR kodları olabilir mi?", a: "Evet. Her gün için ayrı bir QR kod verebilirsiniz; her buluşmanın kendi misafirleri ve fotoğrafları olur." },
        { q: "Fotoğraflar yayınlanmadan önce onaylayabilir miyim?", a: "Evet. İsteğe bağlı onay özelliğini açın. Otomatik denetim de bulanık, tekrar eden ya da uygunsuz görünen fotoğrafları incelemeniz için işaretler." },
        { q: "Albümü nasıl indiririm?", a: "Panelinizden tüm orijinal dosyaları tek bir ZIP olarak indirebilirsiniz. İndirmeler abone olduğunuzda açılır; ücretsiz denemede her şeyi görüntüleyebilirsiniz." },
        { q: "Yurt dışındaki akrabalar nasıl katılır?", a: "Özel bir aile bağlantısı oluşturun ve WhatsApp ile gönderin." }] },
      { id: "payments", title: "Ödemeler ve iadeler", items: [
        { q: "Ne kadar tutar?", a: `Her şeyin dahil olduğu tek bir plan var, istediğiniz kadar etkinlik için: aylık ${v.monthly} ya da yıllık ${v.yearly} (%${v.saving} daha uygun). KDV dahil. Kart bilgisi gerekmeden 3 gün ücretsiz deneyin.` },
        { q: "Para iadesi alabilir miyim?", a: `Evet. İlk ödemenizde ${v.days} gün para iade garantisi vardır. İlk ödemenizden sonraki ${v.days} gün içinde ${v.email} adresine yazın, sebep sormadan iade ederiz.` },
        { q: "İstediğim zaman iptal edebilir miyim?", a: "Evet. Panelinizdeki “Ödemeleri yönet” bölümünden iptal edin; ödediğiniz dönemin sonuna kadar her şey çalışmaya devam eder. Aylık ve yıllık plan arasında da buradan geçiş yapabilirsiniz." },
        { q: "İptal edersem fotoğraflarıma ne olur?", a: "Ödediğiniz dönem bittikten sonra etkinlikleriniz yeni yüklemelere kapanır; 90 gün boyunca her şeyi görüntüleyip indirebilirsiniz, sonra dosyalar silinir. Silinmeden 14 gün önce size e-posta göndeririz. Bu süre içinde yeniden abone olursanız her şey hemen geri gelir." }] },
      { id: "privacy", title: "Gizlilik ve güvenlik", items: [
        { q: "Albümü kimler görebilir?", a: "Yalnızca bağlantıya (ya da QR koda) sahip olanlar. Bağlantılar tahmin edilemez, isteğe bağlı PIN ekleyebilirsiniz ve sayfalar arama motorlarının dışında tutulur." },
        { q: "Verilerim nerede saklanıyor?", a: "Etkinlik verileri ve medya dosyaları Londra'da (Birleşik Krallık) saklanır. Hizmet sağlayıcılarımız ve uyguladığımız güvenceler için gizlilik politikamıza bakın." },
        { q: "Hangi çerezleri kullanıyorsunuz?", a: "Yalnızca zorunlu olanları: oturum, dil ve misafir cihaz anahtarı. Reklam ya da izleme çerezi kullanmıyoruz." },
        { q: "Bir fotoğrafın kaldırılmasını nasıl isterim?", a: `Önce ev sahibine söyleyin. Çözülmezse ${v.email} adresine yazın.` }] },
      { id: "wifi", title: "Mekan Wi-Fi'si", items: [
        { q: "Mekanda Wi-Fi yoksa ne olur?", a: "Misafirler kendi mobil verilerini kullanabilir. Yüklemeler sıraya alınır ve bağlantı zayıfsa kaldığı yerden devam eder." },
        { q: "İnternet yarıda kesilirse yükleme kaybolur mu?", a: "Hayır. Yükleme kuyruğu bağlantı geri geldiğinde otomatik devam eder." },
        { q: "Canlı ekran için ne gerekiyor?", a: "İnternete bağlı bir bilgisayar ya da tarayıcısı olan bir televizyon yeterli; canlı ekran bağlantısını bu ekranda açın. Canlı ekran, ücretsiz deneme dahil her etkinlikte vardır." }] },
    ]
    : [
      { id: "guests", title: "Guests", items: [
        { q: "Do I need to install an app?", a: "No. Scan the QR code with your phone's camera, type your first name and start uploading. It works in any phone browser." },
        { q: "Can I see other people's photos?", a: "If the host allows it, you can scroll the live feed and tap a heart or a laugh." },
        { q: "Can I delete a photo I uploaded?", a: "Yes. On the phone you uploaded from, open your own uploads in the album and delete it. On a different device, ask the host or email us. The host can also remove any photo." },
        { q: "The QR code won't scan. What now?", a: "Move closer, check the light and hold steady. If it still fails, ask the host to send you the link on WhatsApp." }] },
      { id: "hosts", title: "Hosts", items: [
        { q: "How long does it take to set up an event?", a: "About three minutes: choose the occasion, add names and a date, print your QR cards." },
        { q: "Can the henna night and the wedding have separate QR codes?", a: "Yes. Each day can have its own QR code, so every gathering has its own guests and photos." },
        { q: "Can I approve photos before they show?", a: "Yes. Turn on moderation. Auto-moderation also flags photos that look blurry, duplicated or inappropriate, so you can review them." },
        { q: "How do I download the album?", a: "From your dashboard, download every original as one ZIP. Downloads unlock when you subscribe; on the free trial you can view everything." },
        { q: "How do relatives abroad join in?", a: "Create a private family link and send it on WhatsApp." }] },
      { id: "payments", title: "Payments & refunds", items: [
        { q: "What does it cost?", a: `One plan with everything included, for as many events as you like: ${v.monthly} a month or ${v.yearly} a year (save ${v.saving}%). VAT included. Try it free for 3 days, no card needed.` },
        { q: "Can I get a refund?", a: `Yes. There is a ${v.days}-day money-back guarantee on your first payment. Email ${v.email} within ${v.days} days of it and we'll refund you, no questions asked.` },
        { q: "Can I cancel any time?", a: "Yes. Cancel from Manage billing in your dashboard; everything keeps working until the end of the period you paid for. You can switch between monthly and yearly there too." },
        { q: "What happens to my photos if I cancel?", a: "When your paid period ends, your events stop taking new uploads, and you can still view and download everything for 90 days. After that the files are deleted. We email you 14 days before. Subscribe again within those 90 days and everything comes straight back." }] },
      { id: "privacy", title: "Privacy & safety", items: [
        { q: "Who can see an album?", a: "Only people with the link or QR code. Links are unguessable, you can add a PIN, and pages are kept out of search engines." },
        { q: "Where is my data stored?", a: "Event data and media files are stored in London, UK. See our privacy policy for our providers and the safeguards we use." },
        { q: "Which cookies do you use?", a: "Only essential ones: sign-in, language and a guest device token. No advertising or tracking cookies." },
        { q: "How do I ask for a photo to be removed?", a: `Tell the host first. If that doesn't work, email ${v.email}.` }] },
      { id: "wifi", title: "Venue Wi-Fi", items: [
        { q: "What if the venue has no Wi-Fi?", a: "Guests can use their own mobile data. Uploads are queued and resume if the signal is weak." },
        { q: "Do uploads get lost if the connection drops?", a: "No. The upload queue resumes automatically when the connection returns." },
        { q: "What do I need for the live wall?", a: "A computer, or a TV with a web browser, connected to the internet. Open the live wall link on that screen. The live wall is included on every event, including the free trial." }] },
    ];
}
