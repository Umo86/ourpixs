/**
 * Generates the e2e fixtures (not committed): real JPEGs (with EXIF incl. GPS, one rotated), a HEIF ".heic",
 * a 5-second and a 70-second H.264 MP4 (ffmpeg-static). Idempotent: existing files are kept.
 *   node test/fixtures/make-fixtures.mjs [outDir]
 */
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import sharp from "sharp";
import ffmpeg from "ffmpeg-static";

const out = process.argv[2] || new URL("./generated/", import.meta.url).pathname;
mkdirSync(out, { recursive: true });

function scene(w, h, hue, label) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue},70%,55%)"/><stop offset="1" stop-color="hsl(${(hue + 120) % 360},70%,30%)"/></linearGradient></defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
  ${Array.from({ length: 40 }, (_, i) => `<circle cx="${(i * 97) % w}" cy="${(i * 53) % h}" r="${20 + (i % 7) * 12}" fill="hsla(${(hue + i * 9) % 360},80%,70%,0.45)"/>`).join("")}
  <text x="50%" y="55%" font-family="DejaVu Sans, sans-serif" font-size="${Math.round(h / 8)}" font-weight="700" text-anchor="middle" fill="#fff">${label}</text>
</svg>`);
}

const photos = [
  { name: "photo-1.jpg", w: 3024, h: 4032, hue: 210, label: "Photo 1" },
  { name: "photo-2.jpg", w: 4032, h: 3024, hue: 20, label: "Photo 2" },
  { name: "photo-3.jpg", w: 2400, h: 2400, hue: 300, label: "Photo 3" },
  { name: "photo-4.jpg", w: 1600, h: 1200, hue: 120, label: "Photo 4" },
];
for (const p of photos) {
  const f = join(out, p.name);
  if (existsSync(f)) continue;
  await sharp(scene(p.w, p.h, p.hue, p.label)).jpeg({ quality: 88 })
    .withExif({ IFD0: { Make: "Apple", Model: "iPhone 14" }, IFD3: { GPSLatitudeRef: "N", GPSLatitude: "51/1 30/1 0/1", GPSLongitudeRef: "W", GPSLongitude: "0/1 7/1 0/1" } })
    .toFile(f);
}
const heic = join(out, "photo-5.heic");
if (!existsSync(heic)) {
  const img = sharp(scene(2000, 1500, 45, "Photo 5 HEIF"));
  try {
    await img.heif({ compression: "hevc", quality: 60 }).toFile(heic);
  } catch {
    await sharp(scene(2000, 1500, 45, "Photo 5 HEIF")).heif({ compression: "av1", quality: 60 }).toFile(heic);
  }
}
function video(name, seconds, size) {
  const f = join(out, name);
  if (existsSync(f)) return;
  execFileSync(ffmpeg, ["-y", "-loglevel", "error",
    "-f", "lavfi", "-i", `testsrc2=size=${size}:rate=30:duration=${seconds}`,
    "-f", "lavfi", "-i", `sine=frequency=440:duration=${seconds}`,
    "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-b:v", seconds > 10 ? "200k" : "1500k",
    "-c:a", "aac", "-b:a", "64k", "-movflags", "+faststart", "-shortest", f]);
}
video("video-5s.mp4", 5, "1280x720");
video("video-70s.mp4", 70, "640x360");
console.log(`fixtures ready in ${out}`);
