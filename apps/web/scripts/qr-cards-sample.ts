/**
 * Renders sample QR card PDFs (A6 and A5, English and Turkish, every design) from fixtures into /tmp, no database:
 *
 *   npx tsx scripts/qr-cards-sample.ts [outDir]
 *
 * Then check them, e.g. `pdfinfo /tmp/qr-cards/a6-tr-noir.pdf` (page size) and `pdftotext` (Turkish characters).
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { CARD_SIZES, cardFaces, renderCardsPdf, type CardLayout, type CardSize } from "../src/lib/qr-cards";
import { makeT } from "../src/i18n/shared";
import { THEMES } from "../src/lib/config";

const out = process.argv[2] || "/tmp/qr-cards";
mkdirSync(out, { recursive: true });
const font = (f: string) => new Uint8Array(readFileSync(path.join(__dirname, "..", "assets", "fonts", f)));
const fonts = { regular: font("DejaVuSans.ttf"), bold: font("DejaVuSans-Bold.ttf"), serifItalic: font("DejaVuSerif-Italic.ttf") };

const base = "https://bizimresimler.com/g/ilkim-ve-sukru";
const event = (lang: "en" | "tr") => ({
  title: lang === "tr" ? "Gözde & Şükrü'nün Düğünü" : "Gözde & Şükrü's Wedding",
  honorees: ["Gözde İlkım", "Şükrü Aşçıoğlu"],
  typeLabel: lang === "tr" ? "Düğün" : "Wedding",
  startsOn: "2027-06-12",
  venueName: "Çiçek Bahçesi, Göğüş Köşkü, Üsküdar",
  days: [
    { id: "d1", name: lang === "tr" ? "Kına gecesi" : "Henna night", date: "2027-06-11" },
    { id: "d2", name: lang === "tr" ? "Düğün" : "Wedding", date: "2027-06-12" },
  ],
  mainUrl: base,
  dayUrl: (id: string) => `${base}?d=${id}`,
});

async function main() {
  const made: string[] = [];
  for (const size of ["a6", "a5"] as CardSize[]) {
    for (const lang of ["en", "tr"] as const) {
      const t = makeT(lang, "host");
      const copy = { instruction: t("cards.instruction"), sub: t("cards.sub"), sticker: t("qr.sticker") };
      const designs: { id: string; layout: CardLayout; theme: keyof typeof THEMES }[] = [
        { id: "noir", layout: "centered", theme: "noir" }, { id: "royal", layout: "bold", theme: "royal" }, { id: "ivory", layout: "split", theme: "ivory" },
      ];
      for (const d of designs) {
        const pdf = await renderCardsPdf({
          size, layout: d.layout, theme: THEMES[d.theme], faces: cardFaces(event(lang), lang, "each"), copy, brandName: "BizimResimler",
          fonts, lang, title: `QR cards · ${CARD_SIZES[size].w}×${CARD_SIZES[size].h} mm`,
        });
        const file = path.join(out, `${size}-${lang}-${d.id}.pdf`);
        writeFileSync(file, pdf);
        made.push(file);
      }
    }
    // Bleed and crop marks variant.
    const t = makeT("tr", "host");
    const pdf = await renderCardsPdf({
      size, layout: "centered", theme: THEMES.dusk, faces: cardFaces(event("tr"), "tr"), copy: { instruction: t("cards.instruction"), sub: t("cards.sub"), sticker: t("qr.sticker") },
      brandName: "BizimResimler", fonts, lang: "tr", bleed: true, marks: true,
    });
    const file = path.join(out, `${size}-tr-dusk-marks.pdf`);
    writeFileSync(file, pdf);
    made.push(file);
  }
  console.log(made.join("\n"));
}
main().catch((e) => { console.error(e); process.exit(1); });
