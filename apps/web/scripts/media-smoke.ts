/**
 * Local smoke test of the media pipeline (no storage, no database): makes a test photo and a test video, then runs the
 * same sharp watermarking and ffmpeg transcode the server uses, and prints what came out.
 *
 *   npx tsx --conditions=react-server --require ./scripts/server-only-shim.cjs scripts/media-smoke.ts [outDir]
 */
import { mkdirSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import sharp from "sharp";
import { cleanWebp, watermarkedWebp } from "../src/lib/watermark";
import { ffmpegPath, transcodeVideo } from "../src/lib/media-processing";

const out = process.argv[2] || "/tmp/media-smoke";
mkdirSync(out, { recursive: true });
let failed = false;
const check = (name: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
  if (!ok) failed = true;
};

async function main() {
  // Photo: a 3000×2000 gradient with some shapes (white and dark areas, so the watermark must read on both).
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="3000" height="2000"><defs><linearGradient id="g"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#123"/></linearGradient></defs><rect width="3000" height="2000" fill="url(#g)"/><circle cx="2200" cy="1000" r="600" fill="#2347E0"/></svg>`;
  const photo = path.join(out, "photo.png");
  await sharp(Buffer.from(svg)).png().toFile(photo);
  const display = await cleanWebp(photo, 2000, 82);
  check("clean display ≤ 2000 px", Math.max(display.width, display.height) === 2000, `${display.width}×${display.height}, ${display.data.length} B`);
  for (const brand of ["bizimresimler", "ourpixs"] as const) {
    const g = await watermarkedWebp(display.data, { maxEdge: 1200, brand });
    const gt = await watermarkedWebp(display.data, { maxEdge: 400, brand, quality: 72 });
    const gm = await sharp(g).metadata();
    const tm = await sharp(gt).metadata();
    await sharp(g).toFile(path.join(out, `guest-${brand}.webp`));
    await sharp(gt).toFile(path.join(out, `guest-thumb-${brand}.webp`));
    check(`${brand}: guest preview 1200 px`, Math.max(gm.width!, gm.height!) === 1200, `${gm.width}×${gm.height}`);
    check(`${brand}: guest thumb 400 px`, Math.max(tm.width!, tm.height!) === 400, `${tm.width}×${tm.height}`);
    // The watermarked copy must differ from a plain resize of the same image.
    const plain = await sharp(display.data).resize({ width: 1200 }).raw().toBuffer();
    const marked = await sharp(g).raw().removeAlpha().toBuffer();
    let diff = 0;
    for (let i = 0; i < Math.min(plain.length, marked.length); i += 97) diff += Math.abs(plain[i]! - marked[i]!) > 12 ? 1 : 0;
    check(`${brand}: watermark visible`, diff > 50, `${diff} sampled pixels changed`);
  }
  // Square tiny image (thumb path edge case).
  const tiny = await sharp({ create: { width: 90, height: 60, channels: 3, background: "#888" } }).png().toBuffer();
  check("tiny image watermark", (await watermarkedWebp(tiny, { maxEdge: 400, brand: "bizimresimler" })).length > 0);

  // Video: 4 s 2560×1440 landscape and 4 s 1080×1920 portrait test patterns with audio.
  const bin = await ffmpegPath();
  for (const [name, size] of [["landscape", "2560x1440"], ["portrait", "1080x1920"]] as const) {
    const src = path.join(out, `src-${name}.mp4`);
    const r = spawnSync(bin, ["-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i", `testsrc2=size=${size}:rate=30:duration=4`,
      "-f", "lavfi", "-i", "sine=frequency=440:duration=4", "-c:v", "libx264", "-preset", "ultrafast", "-c:a", "aac", "-shortest", src]);
    if (r.status !== 0) { check(`make ${name} source`, false, r.stderr.toString()); continue; }
    const dir = path.join(out, name);
    mkdirSync(dir, { recursive: true });
    const t0 = Date.now();
    const res = await transcodeVideo(src, "bizimresimler", dir, 4, 120_000);
    const ms = Date.now() - t0;
    const probe = (f: string) => {
      const p = spawnSync(bin, ["-hide_banner", "-i", f]);
      const m = /Video: h264.*?, (\d{2,5})x(\d{2,5})/.exec(p.stderr.toString());
      return { w: Number(m?.[1] ?? 0), h: Number(m?.[2] ?? 0), audio: /Audio: aac/.test(p.stderr.toString()) };
    };
    const c = probe(res.clean);
    const g = probe(res.guest);
    const long = name === "landscape" ? [1920, 1080] : [1080, 1920];
    const short = name === "landscape" ? [1280, 720] : [720, 1280];
    check(`${name}: clean 1080p h264+aac`, c.w === long[0] && c.h === long[1] && c.audio, `${c.w}×${c.h}, ${statSync(res.clean).size} B, ${ms} ms total`);
    check(`${name}: guest 720p h264+aac`, g.w === short[0] && g.h === short[1] && g.audio, `${g.w}×${g.h}, ${statSync(res.guest).size} B`);
    const pm = await sharp(res.poster).metadata();
    check(`${name}: poster from clean output`, pm.width === long[0] && pm.height === long[1], `${pm.width}×${pm.height}`);
  }
  console.log(failed ? "\nSOME CHECKS FAILED" : `\nAll media checks passed. Files in ${out}`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
