/**
 * Renders the PWA / home-screen icons into public/icons/<brand>/ (committed to the repo):
 *   icon-192.png, icon-512.png   "any" purpose: monogram on black, rounded by the OS
 *   maskable-512.png             maskable: the monogram inside the 80 % safe zone
 *   apple-touch-icon.png         180×180, iOS home screen (no transparency)
 * The monogram echoes the wordmark: a serif italic letter (DejaVu Serif Italic, standing in for Bodoni Moda italic)
 * in white with the on-dark blue dot (#4D6BFF), on brand black (#0A0A0A).
 *
 *   node scripts/make-app-icons.mjs        (needs DejaVu Serif: `fc-list | grep "DejaVu Serif"`)
 */
import { mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");
const MONOGRAM = { bizimresimler: "B", ourpixs: "Op" };

/** The italic monogram, rendered large in white on transparent and trimmed to its ink. */
async function glyph(text) {
  const fs = 800;
  const src = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${fs * 2}" height="${fs * 1.6}">
  <text x="${fs * 0.2}" y="${fs * 1.1}" font-family="DejaVu Serif" font-style="italic" font-size="${fs}" fill="#FFFFFF" letter-spacing="${-fs * 0.03}">${text}</text>
</svg>`);
  const buf = await sharp(src).png().trim({ threshold: 1 }).toBuffer({ resolveWithObject: true });
  // Baseline inside the trimmed image (descenders, as in "p", hang below it; the dot sits on it).
  const baseline = fs * 1.1 + (buf.info.trimOffsetTop ?? 0);
  return { png: buf.data, w: buf.info.width, h: buf.info.height, fs, baseline };
}

/** Monogram + blue dot centred on black; `box` = share of the icon the group may fill (safe zone for maskable). */
async function icon(g, size, box) {
  const dotR = g.fs * 0.075;
  const gap = g.fs * 0.03;
  const groupW = g.w + gap + dotR * 2;
  const groupH = g.h;
  const k = Math.min((size * box) / groupW, (size * box) / groupH);
  const gw = Math.round(g.w * k), gh = Math.round(g.h * k);
  const left = Math.round((size - groupW * k) / 2);
  const top = Math.round((size - groupH * k) / 2);
  const r = dotR * k;
  const dot = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><circle cx="${left + gw + gap * k + r}" cy="${top + g.baseline * k - r}" r="${r}" fill="#4D6BFF"/></svg>`);
  const letters = await sharp(g.png).resize(gw, gh).toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: "#0A0A0A" } })
    .composite([{ input: letters, left, top }, { input: dot, left: 0, top: 0 }])
    .flatten({ background: "#0A0A0A" }).png({ compressionLevel: 9 });
}

for (const [brand, text] of Object.entries(MONOGRAM)) {
  const dir = join(OUT, brand);
  mkdirSync(dir, { recursive: true });
  const g = await glyph(text);
  await (await icon(g, 192, 0.62)).toFile(join(dir, "icon-192.png"));
  await (await icon(g, 512, 0.62)).toFile(join(dir, "icon-512.png"));
  // Maskable: everything inside the central 80 % circle (the group's diagonal stays well inside it).
  await (await icon(g, 512, 0.5)).toFile(join(dir, "maskable-512.png"));
  await (await icon(g, 180, 0.62)).toFile(join(dir, "apple-touch-icon.png"));
}
console.log(`icons written to ${OUT}`);
