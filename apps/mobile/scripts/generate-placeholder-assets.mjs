#!/usr/bin/env node
/**
 * Generates PLACEHOLDER app icons and splash images for Our Pixs.
 * Pure Node (zlib only) — no native deps. Replace the output with real brand artwork before launch.
 *
 *   node scripts/generate-placeholder-assets.mjs
 *
 * Draws a geometric "OP." wordmark: white O and P, royal-blue dot.
 */
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "assets", "images");
mkdirSync(root, { recursive: true });

const BLACK = [10, 10, 10];
const WHITE = [255, 255, 255];
const BLUE = [35, 71, 224];

// ---------- PNG encoding ----------
const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function encodePng(width, height, rgba, alpha) {
  const ch = alpha ? 4 : 3;
  const raw = Buffer.alloc((width * ch + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * ch + 1)] = 0;
    for (let x = 0; x < width; x++) {
      const si = (y * width + x) * 4;
      const di = y * (width * ch + 1) + 1 + x * ch;
      raw[di] = rgba[si];
      raw[di + 1] = rgba[si + 1];
      raw[di + 2] = rgba[si + 2];
      if (alpha) raw[di + 3] = rgba[si + 3];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = alpha ? 6 : 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------- Shapes (in unit coordinates of the mark box, 0..1) ----------
// Mark box: width UNITS (1.14), height 0.56. Letters: O (x 0..0.56), P (x 0.62..0.94), dot (x 1.015..1.125)
const UNITS = 1.14;
function ring(px, py, cx, cy, ro, ri) {
  const d = Math.hypot(px - cx, py - cy);
  return d <= ro && d >= ri;
}
function markColor(u, v) {
  // u in 0..UNITS, v in 0..0.56 (top to bottom)
  const H = 0.56;
  const stroke = 0.085;
  // O
  const oc = { x: 0.28, y: H / 2 };
  if (ring(u, v, oc.x, oc.y, H / 2, H / 2 - stroke)) return WHITE;
  // P stem
  if (u >= 0.62 && u <= 0.62 + stroke && v >= 0 && v <= H) return WHITE;
  // P bowl: a ring centred at the top half, only the right part + horizontal bars
  const bowlR = 0.17;
  const bc = { x: 0.62 + stroke + 0.06, y: bowlR };
  if (u >= bc.x && ring(u, v, bc.x, bc.y, bowlR, bowlR - stroke)) return WHITE;
  if (u >= 0.62 && u <= bc.x && ((v >= 0 && v <= stroke) || (v >= 2 * bowlR - stroke && v <= 2 * bowlR))) return WHITE;
  // dot
  if (Math.hypot(u - 1.07, v - (H - 0.055)) <= 0.055) return BLUE;
  return null;
}

/**
 * Render an image.
 * @param {number} size  square size in px
 * @param {{bg: number[]|null, markWidth: number, color?: number[]}} opts
 *   markWidth = fraction of the image width the wordmark occupies.
 *   color overrides all mark colours (for monochrome / notification icons).
 */
function render(size, { bg, markWidth, color }) {
  const rgba = Buffer.alloc(size * size * 4);
  const mw = size * markWidth;
  const mh = (mw * 0.56) / UNITS;
  const ox = (size - mw) / 2;
  const oy = (size - mh) / 2;
  const SS = 3; // supersampling per axis
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const u = ((x + (sx + 0.5) / SS - ox) / mw) * UNITS;
          const v = ((y + (sy + 0.5) / SS - oy) / mw) * UNITS;
          let c = u >= 0 && u <= UNITS && v >= 0 && v <= 0.56 ? markColor(u, v) : null;
          if (c && color) c = color;
          if (c) { r += c[0]; g += c[1]; b += c[2]; a += 255; }
          else if (bg) { r += bg[0]; g += bg[1]; b += bg[2]; a += 255; }
        }
      }
      const n = SS * SS;
      const i = (y * size + x) * 4;
      // un-premultiply for transparent backgrounds
      const cover = a / 255;
      rgba[i] = cover ? Math.round(r / cover) : 0;
      rgba[i + 1] = cover ? Math.round(g / cover) : 0;
      rgba[i + 2] = cover ? Math.round(b / cover) : 0;
      rgba[i + 3] = Math.round(a / n);
    }
  }
  return rgba;
}

function out(name, size, opts, alpha) {
  const png = encodePng(size, size, render(size, opts), alpha);
  writeFileSync(join(root, name), png);
  console.log(`wrote assets/images/${name} (${size}x${size})`);
}

// iOS / universal icon: opaque, black background
out("icon.png", 1024, { bg: BLACK, markWidth: 0.62 }, false);
// Android adaptive icon: foreground must sit inside the 66% safe zone
out("adaptive-icon.png", 1024, { bg: null, markWidth: 0.46 }, true);
out("adaptive-icon-monochrome.png", 1024, { bg: null, markWidth: 0.46, color: WHITE }, true);
// Splash: transparent mark on the black splash background colour
out("splash-icon.png", 1024, { bg: null, markWidth: 0.8 }, true);
// Android notification icon must be white + alpha only
out("notification-icon.png", 96, { bg: null, markWidth: 0.8, color: WHITE }, true);
out("favicon.png", 48, { bg: BLACK, markWidth: 0.8 }, false);
