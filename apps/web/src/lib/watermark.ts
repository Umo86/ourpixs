import "server-only";
import path from "node:path";
import sharp, { type OverlayOptions } from "sharp";
import type { Brand } from "./config";

/**
 * Watermarks are PRE-RENDERED PNGs in apps/web/assets/watermark/<brand>/ (scripts/make-watermarks.mjs; DejaVu Sans Bold).
 * Fonts are unreliable inside Vercel Functions, so nothing here renders text: we only resize and composite PNGs.
 * The files are bundled into the functions through `outputFileTracingIncludes` in next.config.ts.
 *
 * Look: a semi-transparent white wordmark with a soft shadow in the bottom-right corner ("BizimResimler", or
 * "Our Pixs" for ourpixs events) plus a faint diagonal repeat of it across the whole image.
 */

export const WATERMARK_DIR = path.join(process.cwd(), "assets", "watermark");
const CORNER_WIDTHS = [120, 200, 320, 480] as const;

/** The event's brand decides the wordmark (default and bizimresimler → "BizimResimler"; ourpixs → "Our Pixs"). */
export const watermarkBrand = (b: Brand | null | undefined): Brand => (b === "ourpixs" ? "ourpixs" : "bizimresimler");

export function watermarkFile(brand: Brand, name: string) {
  return path.join(WATERMARK_DIR, watermarkBrand(brand), name);
}

/** Corner mark PNG for a frame `width` px wide: ~22% of the width (90–480 px), from the nearest larger master. */
async function corner(brand: Brand, width: number): Promise<Buffer> {
  const target = Math.max(90, Math.min(480, Math.round(width * 0.22)));
  const master = CORNER_WIDTHS.find((w) => w >= target) ?? 480;
  return sharp(watermarkFile(brand, `corner-${master}.png`)).resize({ width: target }).png().toBuffer();
}

/** The diagonal tile, scaled to ~45% of the long edge and never larger than the frame. */
async function tile(brand: Brand, w: number, h: number): Promise<Buffer> {
  const tw = Math.max(120, Math.min(560, Math.round(Math.max(w, h) * 0.45), w));
  const buf = await sharp(watermarkFile(brand, "tile.png")).resize({ width: tw }).png().toBuffer({ resolveWithObject: true });
  if (buf.info.height <= h) return buf.data;
  return sharp(buf.data).resize({ height: h, width: Math.min(w, tw), fit: "inside" }).png().toBuffer();
}

/** Clean WebP: EXIF-rotated, at most `maxEdge` px, metadata stripped (no GPS). */
export async function cleanWebp(input: Buffer | string, maxEdge: number, quality: number): Promise<{ data: Buffer; width: number; height: number }> {
  const { data, info } = await sharp(input, { failOn: "none" }).rotate()
    .resize({ width: maxEdge, height: maxEdge, fit: "inside", withoutEnlargement: true })
    .webp({ quality }).toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

/** Watermarked WebP (guest previews and thumbs) from a clean image: corner mark + faint diagonal repeat. */
export async function watermarkedWebp(input: Buffer | string, opts: { maxEdge: number; brand: Brand; quality?: number }): Promise<Buffer> {
  const { data, info } = await sharp(input, { failOn: "none" }).rotate()
    .resize({ width: opts.maxEdge, height: opts.maxEdge, fit: "inside", withoutEnlargement: true })
    .png().toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  const [t, c] = await Promise.all([tile(opts.brand, w, h), corner(opts.brand, w)]);
  const cm = await sharp(c).metadata();
  const cw = Math.min(cm.width ?? 0, w);
  const ch = Math.min(cm.height ?? 0, h);
  const margin = Math.max(8, Math.round(Math.min(w, h) * 0.03));
  const layers: OverlayOptions[] = [{ input: t, tile: true, top: 0, left: 0 }];
  if (cw && ch && cw < w && ch < h) layers.push({ input: c, left: Math.max(0, w - cw - margin), top: Math.max(0, h - ch - margin) });
  return sharp(data).composite(layers).webp({ quality: opts.quality ?? 80 }).toBuffer();
}
