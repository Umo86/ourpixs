/**
 * Pre-renders the brand watermark PNGs into assets/watermark/ (committed to the repo).
 *
 *   node scripts/make-watermarks.mjs
 *
 * Why pre-rendered: fonts are unreliable inside Vercel Functions, so the server never renders text at runtime.
 * It only composites these PNGs (sharp for photos, ffmpeg overlay for videos). Re-run this script (on a machine
 * with DejaVu Sans Bold, `fc-list | grep DejaVu`) only when the wordmarks or the look change.
 *
 * Per brand (bizimresimler = "BizimResimler", ourpixs = "Our Pixs"):
 *   corner-<w>.png   white wordmark with a soft shadow, about 70% opaque, <w> px wide (bottom-right corner mark)
 *   tile.png         one faint diagonal wordmark centred in a transparent tile (repeated across photos)
 *   overlay-1280.png 1280×1280 sheet of the tile (videos: overlaid at 0,0 and cropped to the 720p frame)
 */
import { mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "assets", "watermark");
const BRANDS = { bizimresimler: "BizimResimler", ourpixs: "Our Pixs" };
const CORNER_WIDTHS = [120, 200, 320, 480];
const FONT = "DejaVu Sans";

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

/** Rendered at a large size, then trimmed and resized, so every size is sharp. */
async function cornerMaster(text) {
  const fs = 160;
  const w = Math.ceil(text.length * fs * 0.72) + 120;
  const h = fs + 120;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <defs><filter id="s" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="9"/></filter></defs>
  <text x="60" y="${60 + fs * 0.8}" font-family="${FONT}" font-weight="bold" font-size="${fs}" letter-spacing="-4" fill="#000" fill-opacity="0.45" filter="url(#s)">${esc(text)}</text>
  <text x="60" y="${60 + fs * 0.8}" font-family="${FONT}" font-weight="bold" font-size="${fs}" letter-spacing="-4" fill="#FFF" fill-opacity="0.72">${esc(text)}</text>
</svg>`;
  return sharp(Buffer.from(svg)).png().trim({ threshold: 0 }).toBuffer();
}

async function tile(text) {
  const tw = 560;
  const th = 380;
  const fs = 44;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${tw}" height="${th}">
  <g transform="translate(${tw / 2} ${th / 2}) rotate(-28)">
    <text x="0" y="${fs * 0.35}" text-anchor="middle" font-family="${FONT}" font-weight="bold" font-size="${fs}" fill="#000" fill-opacity="0.07">${esc(text)}</text>
    <text x="-1.5" y="${fs * 0.35 - 1.5}" text-anchor="middle" font-family="${FONT}" font-weight="bold" font-size="${fs}" fill="#FFF" fill-opacity="0.16">${esc(text)}</text>
  </g>
</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

mkdirSync(OUT, { recursive: true });
for (const [brand, text] of Object.entries(BRANDS)) {
  const dir = join(OUT, brand);
  mkdirSync(dir, { recursive: true });
  const master = await cornerMaster(text);
  for (const w of CORNER_WIDTHS) {
    await sharp(master).resize({ width: w }).png({ compressionLevel: 9 }).toFile(join(dir, `corner-${w}.png`));
  }
  const t = await tile(text);
  await sharp(t).png({ compressionLevel: 9 }).toFile(join(dir, "tile.png"));
  await sharp({ create: { width: 1280, height: 1280, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: t, tile: true, top: 0, left: 0 }]).png({ compressionLevel: 9 }).toFile(join(dir, "overlay-1280.png"));
  console.log(`${brand}: corner ${CORNER_WIDTHS.join("/")} px, tile, overlay-1280`);
}
