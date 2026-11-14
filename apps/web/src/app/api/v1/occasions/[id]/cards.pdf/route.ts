import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { route, readQuery } from "@/lib/http";
import { requireMember } from "@/lib/auth";
import { limit } from "@/lib/rate-limit";
import { makeT } from "@/i18n/shared";
import { BRANDS, OCCASIONS, THEMES } from "@/lib/config";
import { TEMPLATES } from "@/content/templates";
import { activeDays, dayGuestUrl, guestUrl } from "@/lib/occasion";
import { loadDays } from "@/lib/queries";
import { coverUrlFor } from "@/lib/serializers";
import { cardFaces, cardsFileName, coverAspect, renderCardsPdf, type CardSize } from "@/lib/qr-cards";

export const runtime = "nodejs";

/**
 * GET /api/v1/occasions/:id/cards.pdf?size=a6|a5&template=<id>&day=<dayId>|each&lang=en|tr&bleed=1&marks=1
 * Print-ready table QR cards (one card per page at trim size). Hosts and co-hosts only; works in every state,
 * including setup (before paying), so cards can be printed early.
 *  - template: one of the QR studio designs (default: the one matching the event's theme)
 *  - day: a day id prints that day's link; "each" prints one card per day; omitted → the main link
 *  - lang: language of the instruction and date (default: the host's language)
 *  - bleed=1: 3 mm bleed (off by default); marks=1: crop marks (implies bleed)
 */
const query = z.object({
  size: z.enum(["a6", "a5"]).default("a6"),
  template: z.string().max(20).optional(),
  day: z.union([z.literal("each"), z.string().uuid()]).optional(),
  lang: z.enum(["en", "tr"]).optional(),
  bleed: z.enum(["0", "1"]).optional(),
  marks: z.enum(["0", "1"]).optional(),
});

let fontCache: Promise<{ regular: Uint8Array; bold: Uint8Array; serifItalic: Uint8Array }> | null = null;
function fonts() {
  const dir = path.join(process.cwd(), "assets", "fonts");
  const read = (f: string) => readFile(path.join(dir, f)).then((b) => new Uint8Array(b));
  fontCache ??= Promise.all([read("DejaVuSans.ttf"), read("DejaVuSans-Bold.ttf"), read("DejaVuSerif-Italic.ttf")])
    .then(([regular, bold, serifItalic]) => ({ regular, bold, serifItalic }))
    .catch((e) => { fontCache = null; throw e; });
  return fontCache;
}

/** The event's cover photo as a JPEG cropped to the card's photo band (best effort; the colour band is the fallback). */
async function coverJpeg(key: string | null, size: CardSize, bleed: boolean): Promise<Uint8Array | null> {
  if (!key) return null;
  try {
    const url = await coverUrlFor(key);
    if (!url) return null;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const sharp = (await import("sharp")).default;
    const width = size === "a5" ? 1800 : 1300;
    const buf = await sharp(Buffer.from(await res.arrayBuffer())).rotate()
      .resize({ width, height: Math.round(width / coverAspect(size, bleed)), fit: "cover", position: "attention" })
      .jpeg({ quality: 86, mozjpeg: true }).toBuffer();
    return new Uint8Array(buf);
  } catch (e) {
    console.error("[cards.pdf] cover skipped", e);
    return null;
  }
}

export const GET = route<{ id: string }>(async (req, { id }) => {
  const { host, occasion: o } = await requireMember(id);
  await limit(`cards:${host.id}`, 30, 600);
  const q = readQuery(req, query);
  const lang = q.lang ?? (host.locale === "tr" ? "tr" : "en");
  const template = TEMPLATES.find((x) => x.id === q.template) ?? TEMPLATES.find((x) => x.theme === o.theme) ?? TEMPLATES[0]!;
  const days = activeDays(o, await loadDays(o.id));
  const t = makeT(lang, "host");
  const bleed = q.bleed === "1" || q.marks === "1";
  const faces = cardFaces({
    title: o.title, honorees: o.honorees, typeLabel: OCCASIONS[o.type].label[lang], startsOn: o.startsOn, venueName: o.venueName,
    days: days.map((d) => ({ id: d.id, name: d.name, date: d.date })), mainUrl: guestUrl(o), dayUrl: (dayId) => dayGuestUrl(o, dayId),
  }, lang, q.day);
  const [fontBytes, cover] = await Promise.all([fonts(), template.layout === "centered" ? coverJpeg(o.coverKey, q.size, bleed) : Promise.resolve(null)]);
  const pdf = await renderCardsPdf({
    size: q.size, layout: template.layout, theme: THEMES[template.theme], faces,
    copy: { instruction: t("cards.instruction"), sub: t("cards.sub"), sticker: t("qr.sticker") },
    brandName: BRANDS[o.brand].name, bleed, marks: q.marks === "1", cover, fonts: fontBytes, lang, title: o.title,
  });
  const name = cardsFileName(o.vanitySlug || o.slug, q.size);
  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
});
