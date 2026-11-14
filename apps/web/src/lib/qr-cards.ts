/**
 * Printable table QR cards as real PDFs (A6 105×148 mm, A5 148×210 mm), one card per page, drawn with pdf-lib.
 * Pure: no database, no network, no server-only imports, so scripts/qr-cards-sample.ts can render fixtures.
 * The route (/api/v1/occasions/:id/cards.pdf) gathers the event's copy and passes it in, with the font bytes.
 *
 *  - The QR is VECTOR (one rectangle per run of dark modules), error correction Q, with a white quiet zone.
 *  - Fonts are embedded and subset (DejaVu Sans / Sans Bold / Serif Italic, assets/fonts): full Turkish coverage
 *    (İıŞşĞğÇçÖöÜü).
 *  - Designs follow the QR studio templates: "centered" (photo or colour band on top, white below) and the full-colour
 *    "split" (QR first) and "bold" (text first) layouts, in the template's theme colours.
 *  - Bleed: off by default (page = trim size). `bleed` adds 3 mm on every side (backgrounds run into it; TrimBox/BleedBox
 *    set). `marks` adds crop marks in a slug area outside the bleed (implies bleed).
 */
import { PDFDocument, degrees, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import QRCode from "qrcode";

export type CardSize = "a6" | "a5";
export type CardLayout = "centered" | "split" | "bold";
export type CardTheme = { bg: string; fg: string; accent: string };

export const CARD_SIZES: Record<CardSize, { w: number; h: number }> = { a6: { w: 105, h: 148 }, a5: { w: 148, h: 210 } };
export const BLEED_MM = 3;
const SLUG_MM = 9; // room for crop marks outside the bleed
const MARK_LEN_MM = 5;
const MARK_GAP_MM = 1; // marks start this far outside the bleed

export type CardFace = {
  /** Small caps line above the names (occasion type or day name, venue). */
  eyebrow: string;
  /** The couple's or host's names (or the event title). */
  names: string;
  /** Event (or day) date, already formatted in the card language; null to omit. */
  date: string | null;
  /** Full URL the QR encodes. */
  url: string;
  /** Short link printed under the QR (no https://). */
  shortUrl: string;
};

export type CardsInput = {
  size: CardSize;
  layout: CardLayout;
  theme: CardTheme;
  /** One page per face (e.g. one per day). */
  faces: CardFace[];
  copy: { instruction: string; sub: string; sticker: string };
  /** Brand wordmark (BRANDS[brand].name). */
  brandName: string;
  bleed?: boolean;
  marks?: boolean;
  /** Cover photo for the "centered" design: JPEG bytes already cropped to coverAspect(). */
  cover?: Uint8Array | null;
  fonts: { regular: Uint8Array; bold: Uint8Array; serifItalic: Uint8Array };
  title?: string;
  lang?: "en" | "tr";
};

const PT = 72 / 25.4;
const mm = (v: number) => v * PT;

function hex(c: string): RGB {
  const h = c.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((x) => x + x).join("") : h, 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}
const WHITE = "#FFFFFF";
const INK = "#0A0A0A";

/** Accent that reads on white for themes whose accent is white (same rule as QrArtwork). */
function inkAccent(t: CardTheme) {
  return t.accent.toUpperCase() === WHITE ? t.bg : t.accent;
}

/** Height of the photo / colour band in the centered design, as a share of the trim height. */
const BAND_SHARE = 0.36;

/** Width / height of the cover image the route should crop to (band incl. bleed on the top and sides). */
export function coverAspect(size: CardSize, bleed: boolean): number {
  const { w, h } = CARD_SIZES[size];
  const b = bleed ? BLEED_MM : 0;
  return (w + 2 * b) / (h * BAND_SHARE + b);
}

// ── Text helpers ─────────────────────────────────────────────────────────────────────────────────

function wrap(text: string, font: PDFFont, size: number, maxW: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(next, size) <= maxW || !line) line = next;
    else { lines.push(line); line = w; }
  }
  if (line) lines.push(line);
  return lines;
}

/** Two lines of similar length instead of a long line and a lone last word. */
function balance(lines: string[], font: PDFFont, size: number, maxW: number): string[] {
  if (lines.length !== 2) return lines;
  const words = lines.join(" ").split(" ");
  let best = lines;
  let bestW = Math.max(...lines.map((l) => font.widthOfTextAtSize(l, size)));
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(" "), b = words.slice(i).join(" ");
    const w = Math.max(font.widthOfTextAtSize(a, size), font.widthOfTextAtSize(b, size));
    if (w <= maxW && w < bestW) { best = [a, b]; bestW = w; }
  }
  return best;
}

/** Largest size ≤ max (down to min) at which the text fits in maxLines lines of maxW (two lines balanced). */
function fit(text: string, font: PDFFont, max: number, min: number, maxW: number, maxLines: number) {
  for (let s = max; s >= min; s -= 0.5) {
    const lines = wrap(text, font, s, maxW);
    if (lines.length <= maxLines && lines.every((l) => font.widthOfTextAtSize(l, s) <= maxW)) return { size: s, lines: balance(lines, font, s, maxW) };
  }
  // Still too long: hard-truncate the last line.
  const lines = wrap(text, font, min, maxW).slice(0, maxLines);
  const last = lines[lines.length - 1] ?? "";
  let cut = last;
  while (cut.length > 1 && font.widthOfTextAtSize(`${cut}…`, min) > maxW) cut = cut.slice(0, -1);
  if (cut !== last) lines[lines.length - 1] = `${cut}…`;
  return { size: min, lines };
}

/** Centered lines, top at `top` (pt, from the bottom of the page), returns the y below the block. */
function centered(page: PDFPage, lines: string[], o: { font: PDFFont; size: number; cx: number; top: number; color: RGB; leading?: number; spacing?: number }) {
  const lead = o.size * (o.leading ?? 1.15);
  let y = o.top - o.size * 0.8;
  for (const l of lines) {
    const w = o.font.widthOfTextAtSize(l, o.size) + (o.spacing ?? 0) * Math.max(0, [...l].length - 1);
    if (o.spacing) {
      // Letter-spaced (eyebrow): draw character by character.
      let x = o.cx - w / 2;
      for (const ch of l) {
        page.drawText(ch, { x, y, size: o.size, font: o.font, color: o.color });
        x += o.font.widthOfTextAtSize(ch, o.size) + o.spacing;
      }
    } else {
      page.drawText(l, { x: o.cx - w / 2, y, size: o.size, font: o.font, color: o.color });
    }
    y -= lead;
  }
  return y + lead - o.size * 0.25;
}

function roundedRect(page: PDFPage, x: number, y: number, w: number, h: number, r: number, color: RGB, opts: { borderColor?: RGB; borderWidth?: number; rotate?: number } = {}) {
  r = Math.min(r, w / 2, h / 2);
  // SVG path in local coordinates (y down), placed with its top-left at (x, y + h).
  const p = `M ${r} 0 H ${w - r} A ${r} ${r} 0 0 1 ${w} ${r} V ${h - r} A ${r} ${r} 0 0 1 ${w - r} ${h} H ${r} A ${r} ${r} 0 0 1 0 ${h - r} V ${r} A ${r} ${r} 0 0 1 ${r} 0 Z`;
  page.drawSvgPath(p, { x, y: y + h, color, borderColor: opts.borderColor, borderWidth: opts.borderWidth });
}

/** Vector QR: white rounded tile with a 2-module quiet zone, dark modules merged into horizontal runs. */
function drawQr(page: PDFPage, url: string, x: number, y: number, size: number, opts: { border?: RGB; radius: number }) {
  const qr = QRCode.create(url, { errorCorrectionLevel: "Q" });
  const n = qr.modules.size;
  const quiet = 2;
  roundedRect(page, x, y, size, size, opts.radius, hex(WHITE), opts.border ? { borderColor: opts.border, borderWidth: size * 0.012 } : {});
  const pad = size * 0.06;
  const cell = (size - 2 * pad) / (n + 2 * quiet);
  const ox = x + pad + quiet * cell;
  const oy = y + size - pad - quiet * cell; // top edge of the matrix
  const ink = hex(INK);
  for (let r = 0; r < n; r++) {
    let c = 0;
    while (c < n) {
      if (!qr.modules.get(r, c)) { c++; continue; }
      let e = c;
      while (e + 1 < n && qr.modules.get(r, e + 1)) e++;
      // A hair of overlap avoids hairline gaps between runs in some viewers.
      page.drawRectangle({ x: ox + c * cell, y: oy - (r + 1) * cell, width: (e - c + 1) * cell + 0.05, height: cell + 0.05, color: ink });
      c = e + 1;
    }
  }
}

function cropMarks(page: PDFPage, trim: { x: number; y: number; w: number; h: number }) {
  const off = mm(BLEED_MM + MARK_GAP_MM);
  const len = mm(MARK_LEN_MM);
  const t = 0.25;
  const black = rgb(0, 0, 0);
  const xs = [trim.x, trim.x + trim.w];
  const ys = [trim.y, trim.y + trim.h];
  for (const x of xs) for (const y of ys) {
    const dx = x === trim.x ? -1 : 1;
    const dy = y === trim.y ? -1 : 1;
    // Horizontal mark on the trim line y, outside the bleed; vertical mark on the trim line x.
    page.drawLine({ start: { x: x + dx * off, y }, end: { x: x + dx * (off + len), y }, thickness: t, color: black });
    page.drawLine({ start: { x, y: y + dy * off }, end: { x, y: y + dy * (off + len) }, thickness: t, color: black });
  }
}

// ── Designs ─────────────────────────────────────────────────────────────────────────────────────

type Ctx = {
  page: PDFPage; face: CardFace; input: CardsInput;
  /** Trim box in pt. */
  T: { x: number; y: number; w: number; h: number };
  /** Bleed in pt (0 without bleed). */
  b: number;
  /** Scale: 1 for A6, ≈1.41 for A5 (all sizes are given for A6 in mm). */
  k: number;
  f: { regular: PDFFont; bold: PDFFont; serif: PDFFont };
  cover: Awaited<ReturnType<PDFDocument["embedJpg"]>> | null;
};

function footer(c: Ctx, color: RGB, rule: RGB, muted: RGB) {
  const { page, T, k, f, input } = c;
  const side = mm(6 * k);
  const y0 = T.y + mm(5 * k);
  page.drawLine({ start: { x: T.x + side, y: y0 + mm(6.2 * k) }, end: { x: T.x + T.w - side, y: y0 + mm(6.2 * k) }, thickness: mm(0.4 * k), color: rule });
  const s = mm(4.2 * k);
  page.drawText(input.brandName, { x: T.x + side, y: y0 + mm(1.2 * k), size: s, font: f.serif, color });
  page.drawText(".", { x: T.x + side + f.serif.widthOfTextAtSize(input.brandName, s), y: y0 + mm(1.2 * k), size: s, font: f.serif, color: rule });
  const ss = mm(2.3 * k);
  const subW = f.regular.widthOfTextAtSize(input.copy.sub, ss);
  page.drawText(input.copy.sub, { x: T.x + T.w - side - subW, y: y0 + mm(1.6 * k), size: ss, font: f.regular, color: muted });
}

/** The rotated "Scan me" pill, its top-left corner at (x, y). Clockwise like the CSS sticker (rotate 10deg). */
function sticker(c: Ctx, x: number, y: number, bg: RGB, fg: RGB) {
  const { page, k, f, input } = c;
  const s = mm(2.6 * k);
  const padX = mm(2.6 * k);
  const w = f.bold.widthOfTextAtSize(input.copy.sticker, s) + 2 * padX;
  const h = mm(5.2 * k);
  const theta = -10;
  const r = h / 2;
  const path = `M ${r} 0 H ${w - r} A ${r} ${r} 0 0 1 ${w - r} ${h} H ${r} A ${r} ${r} 0 0 1 ${r} 0 Z`;
  page.drawSvgPath(path, { x, y, color: bg, rotate: degrees(theta) });
  // Local point (lx right, ly down from the pill's top-left) → page coordinates.
  const rad = (theta * Math.PI) / 180;
  const lx = padX, ly = h * 0.68;
  page.drawText(input.copy.sticker, {
    x: x + lx * Math.cos(rad) + ly * Math.sin(rad), y: y + lx * Math.sin(rad) - ly * Math.cos(rad),
    size: s, font: f.bold, color: fg, rotate: degrees(theta),
  });
}

/** The letter-spaced capitals line, shrunk to fit one line (spacing adds about 18% of the size per letter). */
function eyebrow(c: Ctx, maxW: number, size: number) {
  const text = c.face.eyebrow.toLocaleUpperCase(c.input.lang === "tr" ? "tr-TR" : "en-GB");
  const room = maxW - size * 0.18 * [...text].length;
  return fit(text, c.f.bold, size, mm(1.6 * c.k), Math.max(room, maxW * 0.5), 1);
}

function drawCentered(c: Ctx) {
  const { page, face, input, T, b, k, f } = c;
  const theme = input.theme;
  const accent = hex(inkAccent(theme));
  const bandH = T.h * BAND_SHARE;
  const bandY = T.y + T.h - bandH;
  // White card (into the bleed), then the band (into the bleed on top and sides).
  page.drawRectangle({ x: T.x - b, y: T.y - b, width: T.w + 2 * b, height: T.h + 2 * b, color: hex(WHITE) });
  const band = { x: T.x - b, y: bandY, width: T.w + 2 * b, height: bandH + b };
  const onPhoto = !!c.cover;
  if (c.cover) {
    page.drawImage(c.cover, band);
    // Darken the lower part so the names stay readable (no gradients in PDF basics: two stepped overlays).
    page.drawRectangle({ ...band, color: hex(INK), opacity: 0.25 });
    page.drawRectangle({ x: band.x, y: band.y, width: band.width, height: band.height * 0.6, color: hex(INK), opacity: 0.35 });
  } else {
    page.drawRectangle({ ...band, color: hex(theme.bg) });
  }
  const bandFg = hex(onPhoto ? WHITE : theme.fg);
  const side = mm(6 * k);
  const maxW = T.w - 2 * side;
  // Names: bottom-aligned in the band, up to 2 lines.
  const names = fit(face.names, f.bold, mm(9.5 * k), mm(5.5 * k), maxW, 2);
  const eyebrowSize = mm(2.4 * k);
  const dateSize = mm(2.9 * k);
  const lead = 1.0;
  const blockH = eyebrowSize * 1.6 + names.size * lead * names.lines.length + (face.date ? dateSize * 1.8 : 0);
  let top = bandY + mm(5 * k) + blockH;
  const eb = eyebrow(c, maxW, eyebrowSize);
  top = centered(page, eb.lines, { font: f.bold, size: eb.size, cx: T.x + T.w / 2, top, color: bandFg, spacing: eb.size * 0.18 }) - eyebrowSize * 0.5;
  top = centered(page, names.lines, { font: f.bold, size: names.size, cx: T.x + T.w / 2, top, color: bandFg, leading: lead });
  if (face.date) centered(page, [face.date], { font: f.regular, size: dateSize, cx: T.x + T.w / 2, top: top - dateSize * 0.5, color: bandFg });

  // QR, sticker, instruction, link.
  const qrSize = Math.min(mm(44 * k), (bandY - T.y) * 0.52);
  const qrY = bandY - mm(5 * k) - qrSize;
  const qrX = T.x + (T.w - qrSize) / 2;
  drawQr(page, face.url, qrX, qrY, qrSize, { border: hex(INK), radius: mm(3 * k) });
  sticker(c, qrX + qrSize - mm(8 * k), qrY + qrSize + mm(3 * k), accent, hex(WHITE));
  const instr = fit(input.copy.instruction, f.bold, mm(5.2 * k), mm(3.4 * k), maxW, 2);
  const y = centered(page, instr.lines, { font: f.bold, size: instr.size, cx: T.x + T.w / 2, top: qrY - mm(3.2 * k), color: hex(INK), leading: 1.05 });
  centered(page, [face.shortUrl], { font: f.bold, size: mm(2.7 * k), cx: T.x + T.w / 2, top: y - mm(1.6 * k), color: accent });
  footer(c, hex(INK), accent, hex("#6B6B6B"));
}

function drawSolid(c: Ctx) {
  const { page, face, input, T, b, k, f } = c;
  const theme = input.theme;
  const fg = hex(theme.fg);
  const accent = hex(theme.accent);
  const bold = input.layout === "bold";
  page.drawRectangle({ x: T.x - b, y: T.y - b, width: T.w + 2 * b, height: T.h + 2 * b, color: hex(theme.bg) });
  const side = mm(6 * k);
  const maxW = T.w - 2 * side;
  const cx = T.x + T.w / 2;
  const qrSize = mm((bold ? 50 : 44) * k);
  const footerTop = T.y + mm(13 * k);

  const textBlock = (top: number) => {
    const eb = eyebrow(c, maxW, mm(2.4 * k));
    let y = centered(page, eb.lines, { font: f.bold, size: eb.size, cx, top, color: fg, spacing: eb.size * 0.18 });
    const names = fit(face.names, f.serif, mm(9 * k), mm(5.5 * k), maxW, 2);
    y = centered(page, names.lines, { font: f.serif, size: names.size, cx, top: y - mm(2 * k), color: accent, leading: 1.0 });
    if (face.date) y = centered(page, [face.date], { font: f.regular, size: mm(2.9 * k), cx, top: y - mm(1.4 * k), color: fg });
    const instr = fit(input.copy.instruction, f.bold, mm((bold ? 6.2 : 5.2) * k), mm(3.4 * k), maxW, 2);
    y = centered(page, instr.lines, { font: f.bold, size: instr.size, cx, top: y - mm(2.6 * k), color: fg, leading: 1.02 });
    return centered(page, [face.shortUrl], { font: f.bold, size: mm(2.7 * k), cx, top: y - mm(1.6 * k), color: fg });
  };

  if (bold) {
    // Text first, big QR at the bottom.
    textBlock(T.y + T.h - mm(8 * k));
    drawQr(page, face.url, cx - qrSize / 2, footerTop + mm(4 * k), qrSize, { radius: mm(4 * k) });
  } else {
    const qrY = T.y + T.h - mm(8 * k) - qrSize;
    drawQr(page, face.url, cx - qrSize / 2, qrY, qrSize, { radius: mm(4 * k) });
    textBlock(qrY - mm(4 * k));
  }
  footer(c, fg, accent, fg);
}

/** Renders the cards PDF (one page per face). */
export async function renderCardsPdf(input: CardsInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  doc.setTitle(input.title ?? "QR cards");
  doc.setCreator(input.brandName);
  doc.setProducer(input.brandName);
  if (input.lang) doc.setLanguage(input.lang === "tr" ? "tr-TR" : "en-GB");
  const f = {
    regular: await doc.embedFont(input.fonts.regular, { subset: true }),
    bold: await doc.embedFont(input.fonts.bold, { subset: true }),
    serif: await doc.embedFont(input.fonts.serifItalic, { subset: true }),
  };
  const cover = input.cover && input.layout === "centered" ? await doc.embedJpg(input.cover).catch(() => null) : null;
  const { w, h } = CARD_SIZES[input.size];
  const bleed = !!(input.bleed || input.marks);
  const b = bleed ? mm(BLEED_MM) : 0;
  const slug = input.marks ? mm(SLUG_MM) : 0;
  const k = w / CARD_SIZES.a6.w;
  for (const face of input.faces.length ? input.faces : []) {
    const pw = mm(w) + 2 * b + 2 * slug;
    const ph = mm(h) + 2 * b + 2 * slug;
    const page = doc.addPage([pw, ph]);
    const T = { x: slug + b, y: slug + b, w: mm(w), h: mm(h) };
    page.setTrimBox(T.x, T.y, T.w, T.h);
    if (bleed) page.setBleedBox(T.x - b, T.y - b, T.w + 2 * b, T.h + 2 * b);
    const c: Ctx = { page, face, input, T, b, k, f, cover };
    if (input.layout === "centered") drawCentered(c);
    else drawSolid(c);
    if (input.marks) cropMarks(page, T);
  }
  return doc.save();
}

/** File name for the download, e.g. "elif-and-can-a6-cards.pdf". */
export function cardsFileName(base: string, size: CardSize) {
  const slug = base.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "cards";
  return `${slug}-${size}-qr-cards.pdf`;
}

// ── Card copy from event data (shared by the route and the sample script) ──────────────────────────

export type CardEvent = {
  title: string; honorees: string[]; typeLabel: string; startsOn: string | null; venueName: string | null;
  days: { id: string; name: string; date: string | null }[];
  mainUrl: string; dayUrl: (dayId: string) => string;
};

/** "Elif & Can" from the honorees (falls back to the event title). */
export function cardNames(e: Pick<CardEvent, "title" | "honorees">): string {
  const h = e.honorees.map((x) => x.trim()).filter(Boolean);
  if (!h.length) return e.title;
  if (h.length === 1) return h[0]!;
  return `${h.slice(0, -1).join(", ")} & ${h[h.length - 1]}`;
}

function formatCardDate(iso: string | null, lang: "en" | "tr"): string | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString(lang === "tr" ? "tr-TR" : "en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}
const short = (url: string) => url.replace(/^https?:\/\//, "").replace(/\?d=.*$/, "");

/**
 * Faces to print. `day`: undefined → one card with the main link; a day id → that day's link (locks the day);
 * "each" → one card per day (events with several days). Unknown day ids fall back to the main link.
 */
export function cardFaces(e: CardEvent, lang: "en" | "tr", day?: string | null): CardFace[] {
  const venue = e.venueName?.trim() || null;
  const main: CardFace = {
    eyebrow: [e.typeLabel, venue].filter(Boolean).join(" · "), names: cardNames(e), date: formatCardDate(e.startsOn, lang),
    url: e.mainUrl, shortUrl: short(e.mainUrl),
  };
  const forDay = (d: CardEvent["days"][number]): CardFace => ({
    eyebrow: [d.name, venue].filter(Boolean).join(" · "), names: cardNames(e), date: formatCardDate(d.date ?? e.startsOn, lang),
    url: e.dayUrl(d.id), shortUrl: short(e.dayUrl(d.id)),
  });
  if (e.days.length > 1 && day === "each") return e.days.map(forDay);
  const one = e.days.length > 1 && day ? e.days.find((d) => d.id === day) : null;
  return [one ? forDay(one) : main];
}
