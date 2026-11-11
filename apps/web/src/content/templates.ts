import type { THEMES } from "@/lib/config";
import type { L } from "./i18n";

export type TemplateDesign = { id: string; theme: keyof typeof THEMES; layout: "centered" | "split" | "bold"; name: L<string> };

export const TEMPLATES: TemplateDesign[] = [
  { id: "noir", theme: "noir", layout: "centered", name: { en: "Noir", tr: "Noir" } },
  { id: "royal", theme: "royal", layout: "bold", name: { en: "Royal", tr: "Royal" } },
  { id: "ivory", theme: "ivory", layout: "split", name: { en: "Ivory", tr: "Fildişi" } },
  { id: "dusk", theme: "dusk", layout: "centered", name: { en: "Dusk", tr: "Alacakaranlık" } },
  { id: "mono", theme: "mono", layout: "bold", name: { en: "Mono", tr: "Mono" } },
  { id: "blush", theme: "blush", layout: "split", name: { en: "Blush", tr: "Pudra" } },
];

export const TEMPLATE_COPY: L<{
  metaTitle: string; metaDesc: string; title: string; accent: string; lead: string;
  headline: string; sub: string; names: string; sample: string; print: string; use: string; note: string; designLabel: string; qrAlt: string;
}> = {
  en: {
    metaTitle: "QR card and table sign templates", metaDesc: "Six printable QR card and table sign designs for weddings, henna nights and parties. Print them, or use a design for your own event.",
    title: "QR cards worth", accent: "putting on the table.", lead: "Six designs in our colours. Print a sample to check the size and feel, or pick one and make it with your own QR code and names in the QR studio.",
    headline: "Scan to share your photos", sub: "No app. No sign-up.", names: "Elif & Can", sample: "Sample QR", print: "Print sample", use: "Use this design", note: "Samples use a demo QR code. The QR studio in your dashboard makes cards with your own QR code, names and colours.", designLabel: "Design", qrAlt: "Sample QR code",
  },
  tr: {
    metaTitle: "QR kart ve masa tabelası şablonları", metaDesc: "Düğün, kına gecesi ve partiler için yazdırılabilir altı QR kart ve masa tabelası tasarımı. Örneği yazdırın ya da kendi etkinliğiniz için birini seçin.",
    title: "Masaya koymaya", accent: "değer QR kartlar.", lead: "Renklerimizle hazırlanmış altı tasarım. Boyutunu ve görünümünü görmek için bir örnek yazdırın ya da birini seçip QR stüdyosunda kendi QR kodunuz ve isimlerinizle hazırlayın.",
    headline: "Fotoğraflarınızı paylaşmak için okutun", sub: "Uygulama yok. Üyelik yok.", names: "Elif & Can", sample: "Örnek QR", print: "Örneği yazdır", use: "Bu tasarımı kullan", note: "Örneklerde demo QR kod kullanılır. Panelinizdeki QR stüdyosu kartları kendi QR kodunuz, isimleriniz ve renklerinizle hazırlar.", designLabel: "Tasarım", qrAlt: "Örnek QR kod",
  },
};
