import "server-only";
import { spawn } from "node:child_process";
import { access, chmod, copyFile, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { and, asc, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Brand } from "./config";
import { hmac, requireEnv, safeEqual } from "./crypto";
import { deleteObjects, derivedKey, downloadToFile, storageDriver, uploadObject } from "./storage";
import ffmpegStatic from "ffmpeg-static";
import sharp from "sharp";
import { cleanWebp, watermarkBrand, watermarkedWebp, watermarkFile } from "./watermark";

/**
 * Server-side media copies (docs/CONSUMER-LAUNCH.md "Storage and media pipeline"). Runs in Node functions only.
 *
 * PHOTOS (sharp): from the clean display copy the browser uploaded (≈2,000 px WebP) we make the guest preview
 * (≈1,200 px) and guest thumb (≈400 px), both watermarked. If the browser couldn't make a display copy (e.g. HEIC),
 * we try to make the clean display + thumb from the original with sharp first; if that fails too the item is
 * `failed`: guests see a placeholder, hosts see the original (src/lib/media-urls.ts).
 * Photos take ~1 s each, but a completion request can carry 50 of them, so they are NOT done inline in the
 * completion request: like videos they go to the internal route below.
 *
 * VIDEOS (ffmpeg-static): one ffmpeg run makes the clean 1080p H.264/AAC MP4 (fits 1920×1080 landscape or 1080×1920
 * portrait, veryfast/CRF 23, +faststart) and the 720p watermarked MP4 (overlay of the pre-rendered PNGs); then a
 * poster frame is taken from the clean output and turned into clean + watermarked posters with sharp.
 *
 * FLOW: uploads/complete → after() → POST /api/internal/media/process (HMAC-signed ids, maxDuration 300) → this module.
 * If that request can't be made, the completion request processes the items itself in after(). A cron sweep
 * (/api/cron/media) retries anything pending/failed for more than 10 minutes, at most 3 attempts per item.
 * Claims are a conditional UPDATE with a lease (processing_started_at), so two workers never process one item at once.
 */

type MediaRow = typeof schema.media.$inferSelect;
const M = schema.media;

export const MAX_ATTEMPTS = 3;
const LEASE_MS = 6 * 60_000;
export const SWEEP_AGE_MS = 10 * 60_000;
const DISPLAY_EDGE = 2000;
const THUMB_EDGE = 400;
const GUEST_EDGE = 1200;

// ── Signed trigger for the internal route ─────────────────────────────────────────────────────────

function processingKey(): string {
  const base = process.env.CRON_SECRET || requireEnv("GUEST_TOKEN_SECRET", 16);
  return hmac(base, "media-process:v1");
}

/** HMAC over the media ids and an expiry (unix seconds). */
export function signProcessing(ids: string[], exp: number): string {
  return hmac(processingKey(), `media:${exp}:${ids.join(",")}`);
}

export function verifyProcessing(ids: string[], exp: number, sig: string): boolean {
  if (!Number.isFinite(exp) || exp * 1000 < Date.now()) return false;
  try {
    return safeEqual(sig, signProcessing(ids, exp));
  } catch {
    return false;
  }
}

/** Base URL for calling ourselves: INTERNAL_BASE_URL > the request's own origin > the deployment URL. */
function internalBase(origin: string | null): string | null {
  if (process.env.INTERNAL_BASE_URL) return process.env.INTERNAL_BASE_URL.replace(/\/$/, "");
  if (origin) return origin;
  return process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null;
}

/**
 * Asks the internal route to process these items (videos one per request, photos in batches of 10). Returns the
 * ids that could not be handed over (the caller then processes them itself). Never throws.
 */
export async function triggerProcessing(rows: Pick<MediaRow, "id" | "kind">[], origin: string | null): Promise<string[]> {
  const base = internalBase(origin);
  if (!base) return rows.map((r) => r.id);
  const batches: string[][] = [];
  const photos = rows.filter((r) => r.kind === "photo").map((r) => r.id);
  for (let i = 0; i < photos.length; i += 10) batches.push(photos.slice(i, i + 10));
  for (const r of rows) if (r.kind === "video") batches.push([r.id]);
  const failed: string[] = [];
  await Promise.all(batches.map(async (ids) => {
    const exp = Math.floor(Date.now() / 1000) + 600;
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      // Preview deployments behind Vercel Authentication: "Protection Bypass for Automation" provides this secret.
      if (process.env.VERCEL_AUTOMATION_BYPASS_SECRET) headers["x-vercel-protection-bypass"] = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
      const res = await fetch(`${base}/api/internal/media/process`, {
        method: "POST", headers, body: JSON.stringify({ ids, exp, sig: signProcessing(ids, exp) }), signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
    } catch (e) {
      console.warn("[media] trigger failed; processing inline", ids.length, String((e as Error)?.message ?? e));
      failed.push(...ids);
    }
  }));
  return failed;
}

// ── Claiming ───────────────────────────────────────────────────────────────────────────────────────

/** Claims one item (pending/failed, under the attempt limit, lease free). Voice notes are simply marked ready. */
async function claim(id: string): Promise<MediaRow | null> {
  const now = new Date();
  const [row] = await db.update(M).set({ processingStartedAt: now, processingAttempts: sql`${M.processingAttempts} + 1` })
    .where(and(
      eq(M.id, id), eq(M.status, "uploaded"), inArray(M.processingStatus, ["pending", "failed"]), lt(M.processingAttempts, MAX_ATTEMPTS),
      or(isNull(M.processingStartedAt), lt(M.processingStartedAt, new Date(now.getTime() - LEASE_MS))),
    )).returning();
  return row ?? null;
}

/** Writes the result; false when the row is gone (deleted while processing). */
async function finish(id: string, set: Partial<typeof M.$inferInsert>): Promise<boolean> {
  const r = await db.update(M).set({ ...set, processingStartedAt: null }).where(eq(M.id, id)).returning({ id: M.id });
  return r.length > 0;
}

// ── ffmpeg ─────────────────────────────────────────────────────────────────────────────────────────

let ffmpegReady: Promise<string> | null = null;

/** Path to the ffmpeg-static binary, copied to /tmp and made executable if the bundle lost the exec bit. */
export function ffmpegPath(): Promise<string> {
  ffmpegReady ??= (async () => {
    // ffmpeg-static is in serverExternalPackages (next.config.ts), so this is its real node_modules path.
    const p = process.env.FFMPEG_PATH || ffmpegStatic || "";
    if (!p) throw new Error("ffmpeg-static binary not found for this platform");
    try {
      await access(p, constants.X_OK);
      return p;
    } catch {
      const tmp = path.join(tmpdir(), "ffmpeg");
      await copyFile(p, tmp);
      await chmod(tmp, 0o755);
      return tmp;
    }
  })().catch((e) => { ffmpegReady = null; throw e; });
  return ffmpegReady;
}

function run(bin: string, args: string[], timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn(bin, args, { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    p.stderr.on("data", (d: Buffer) => { err = (err + d.toString()).slice(-4000); });
    const timer = setTimeout(() => { p.kill("SIGKILL"); reject(new Error("ffmpeg timed out")); }, timeoutMs);
    p.on("error", (e) => { clearTimeout(timer); reject(e); });
    p.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited ${code}: ${err.split("\n").slice(-6).join(" ").slice(-600)}`));
    });
  });
}

/** Fit inside 1920×1080 (landscape) or 1080×1920 (portrait), keep aspect, even dimensions. */
const fit = (long: number, short: number) =>
  `scale=w='if(gte(iw,ih),min(${long},iw),min(${short},iw))':h='if(gte(iw,ih),min(${short},ih),min(${long},ih))':force_original_aspect_ratio=decrease:force_divisible_by=2`;

/**
 * Builds the ffmpeg arguments: one decode, two encodes (clean 1080p + watermarked 720p).
 * Exported for the local smoke test (scripts/media-smoke.ts).
 */
export function transcodeArgs(input: string, brand: Brand, out: { clean: string; guest: string }): string[] {
  const overlay = watermarkFile(brand, "overlay-1280.png");
  const corner = watermarkFile(brand, "corner-200.png");
  const graph = [
    `[0:v]split=2[a][b]`,
    `[a]${fit(1920, 1080)},format=yuv420p[hd]`,
    `[b]${fit(1280, 720)}[sd]`,
    `[sd][1:v]overlay=0:0[sd1]`,
    `[sd1][2:v]overlay=W-w-24:H-h-24,format=yuv420p[wm]`,
  ].join(";");
  const audio = (kbps: number) => ["-c:a", "aac", "-b:a", `${kbps}k`, "-ac", "2"];
  return [
    "-hide_banner", "-loglevel", "error", "-y", "-i", input, "-i", overlay, "-i", corner, "-filter_complex", graph,
    "-map", "[hd]", "-map", "0:a?", "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-profile:v", "high", ...audio(128),
    "-movflags", "+faststart", "-max_muxing_queue_size", "1024", out.clean,
    "-map", "[wm]", "-map", "0:a?", "-c:v", "libx264", "-preset", "veryfast", "-crf", "26", ...audio(96),
    "-movflags", "+faststart", "-max_muxing_queue_size", "1024", out.guest,
  ];
}

export async function transcodeVideo(input: string, brand: Brand, dir: string, durationS: number | null, timeoutMs: number) {
  const bin = await ffmpegPath();
  const out = { clean: path.join(dir, "video.mp4"), guest: path.join(dir, "guest.mp4"), poster: path.join(dir, "poster.png") };
  await run(bin, transcodeArgs(input, brand, out), timeoutMs);
  const at = Math.max(0, Math.min(1, (durationS ?? 0) * 0.1));
  await run(bin, ["-hide_banner", "-loglevel", "error", "-y", "-ss", at.toFixed(2), "-i", out.clean, "-frames:v", "1", out.poster], 60_000)
    .catch(() => run(bin, ["-hide_banner", "-loglevel", "error", "-y", "-i", out.clean, "-frames:v", "1", out.poster], 60_000));
  return out;
}

// ── Processing one item ───────────────────────────────────────────────────────────────────────────

const errText = (e: unknown) => String((e as Error)?.message ?? e).slice(0, 500);

async function processPhoto(m: MediaRow, brand: Brand, dir: string): Promise<Partial<typeof M.$inferInsert>> {
  const uploaded: string[] = [];
  try {
    let source: string;
    const set: Partial<typeof M.$inferInsert> = {};
    if (m.keyDisplay) {
      source = path.join(dir, "display");
      await downloadToFile(m.keyDisplay, source);
    } else {
      // No display from the browser (e.g. HEIC it couldn't decode): try to make the clean copies here.
      const orig = path.join(dir, "original");
      await downloadToFile(m.keyOriginal, orig);
      const display = await cleanWebp(orig, DISPLAY_EDGE, 82).catch(() => null);
      if (!display) throw new Error("undecodable: the original can't be read (e.g. HEIC)");
      set.keyDisplay = derivedKey(m.occasionId, m.id, "display", "webp");
      await uploadObject(set.keyDisplay, display.data, "image/webp");
      uploaded.push(set.keyDisplay);
      if (!m.width || !m.height) { set.width = display.width; set.height = display.height; }
      source = path.join(dir, "display.webp");
      await writeFile(source, display.data);
    }
    if (!m.keyThumb) {
      const thumb = await cleanWebp(source, THUMB_EDGE, 72);
      set.keyThumb = derivedKey(m.occasionId, m.id, "thumb", "webp");
      await uploadObject(set.keyThumb, thumb.data, "image/webp");
      uploaded.push(set.keyThumb);
    }
    const [guest, guestThumb] = await Promise.all([
      watermarkedWebp(source, { maxEdge: GUEST_EDGE, brand, quality: 80 }),
      watermarkedWebp(source, { maxEdge: THUMB_EDGE, brand, quality: 72 }),
    ]);
    set.keyGuest = derivedKey(m.occasionId, m.id, "guest", "webp");
    set.keyGuestThumb = derivedKey(m.occasionId, m.id, "guest-thumb", "webp");
    await Promise.all([uploadObject(set.keyGuest, guest, "image/webp"), uploadObject(set.keyGuestThumb, guestThumb, "image/webp")]);
    uploaded.push(set.keyGuest, set.keyGuestThumb);
    return set;
  } catch (e) {
    await deleteObjects(uploaded).catch(() => {});
    throw e;
  }
}

async function processVideo(m: MediaRow, brand: Brand, dir: string, timeoutMs: number): Promise<Partial<typeof M.$inferInsert>> {
  const uploaded: string[] = [];
  try {
    const input = path.join(dir, "original");
    await downloadToFile(m.keyOriginal, input);
    const out = await transcodeVideo(input, brand, dir, m.durationS, timeoutMs);
    const [display, thumb, guest, guestThumb] = await Promise.all([
      cleanWebp(out.poster, DISPLAY_EDGE, 82), cleanWebp(out.poster, THUMB_EDGE, 72),
      watermarkedWebp(out.poster, { maxEdge: GUEST_EDGE, brand, quality: 80 }), watermarkedWebp(out.poster, { maxEdge: THUMB_EDGE, brand, quality: 72 }),
    ]);
    const set: Partial<typeof M.$inferInsert> = {
      keyVideo: derivedKey(m.occasionId, m.id, "video", "mp4"),
      keyGuestVideo: derivedKey(m.occasionId, m.id, "guest-video", "mp4"),
      // The browser's poster keys are reused (overwritten) so nothing is left behind.
      keyDisplay: m.keyDisplay ?? derivedKey(m.occasionId, m.id, "display", "webp"),
      keyThumb: m.keyThumb ?? derivedKey(m.occasionId, m.id, "thumb", "webp"),
      keyGuest: derivedKey(m.occasionId, m.id, "guest", "webp"),
      keyGuestThumb: derivedKey(m.occasionId, m.id, "guest-thumb", "webp"),
    };
    await uploadObject(set.keyVideo!, { path: out.clean }, "video/mp4");
    uploaded.push(set.keyVideo!);
    await uploadObject(set.keyGuestVideo!, { path: out.guest }, "video/mp4");
    uploaded.push(set.keyGuestVideo!);
    await Promise.all([
      uploadObject(set.keyDisplay!, display.data, "image/webp"), uploadObject(set.keyThumb!, thumb.data, "image/webp"),
      uploadObject(set.keyGuest!, guest, "image/webp"), uploadObject(set.keyGuestThumb!, guestThumb, "image/webp"),
    ]);
    uploaded.push(set.keyGuest!, set.keyGuestThumb!);
    if (!m.width || !m.height) {
      const meta = await sharp(out.poster).metadata();
      if (meta.width && meta.height) { set.width = meta.width; set.height = meta.height; }
    }
    const { size } = await stat(out.clean);
    if (!size) throw new Error("empty transcode");
    return set;
  } catch (e) {
    await deleteObjects(uploaded).catch(() => {});
    throw e;
  }
}

/** Processes one claimed item. Returns "ready" | "failed". */
async function processOne(m: MediaRow, brand: Brand, deadline: number): Promise<"ready" | "failed"> {
  if (m.kind === "voice") {
    await finish(m.id, { processingStatus: "ready", processedAt: new Date(), processingError: null });
    return "ready";
  }
  const dir = await mkdtemp(path.join(tmpdir(), `media-${m.id.slice(0, 8)}-`));
  try {
    const set = m.kind === "video"
      ? await processVideo(m, brand, dir, Math.max(30_000, deadline - Date.now() - 20_000))
      : await processPhoto(m, brand, dir);
    const kept = await finish(m.id, { ...set, processingStatus: "ready", processedAt: new Date(), processingError: null });
    // Deleted while we worked: don't leave the new files behind.
    if (!kept) await deleteObjects([set.keyGuest, set.keyGuestThumb, set.keyVideo, set.keyGuestVideo, set.keyDisplay, set.keyThumb]).catch(() => {});
    return "ready";
  } catch (e) {
    console.error("[media] processing failed", m.id, m.kind, errText(e));
    await finish(m.id, { processingStatus: "failed", processingError: errText(e) }).catch(() => {});
    return "failed";
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * Claims and processes the given items (photos 3 at a time, videos one at a time) within `budgetMs`.
 * Items that can't be claimed (already done, in progress elsewhere, out of attempts) are skipped.
 */
export async function processMediaIds(ids: string[], opts: { budgetMs?: number } = {}): Promise<{ ready: number; failed: number; skipped: number }> {
  const out = { ready: 0, failed: 0, skipped: 0 };
  if (!ids.length || !storageDriver()) return out;
  const deadline = Date.now() + (opts.budgetMs ?? 270_000);
  const brands = new Map<string, Brand>();
  const brandOf = async (occasionId: string) => {
    if (!brands.has(occasionId)) {
      const [o] = await db.select({ brand: schema.occasions.brand }).from(schema.occasions).where(eq(schema.occasions.id, occasionId)).limit(1);
      brands.set(occasionId, watermarkBrand(o?.brand));
    }
    return brands.get(occasionId)!;
  };
  const queue = [...ids];
  const worker = async () => {
    for (let id = queue.shift(); id; id = queue.shift()) {
      if (Date.now() > deadline - 15_000) { out.skipped++; continue; }
      const m = await claim(id).catch(() => null);
      if (!m) { out.skipped++; continue; }
      const r = await processOne(m, await brandOf(m.occasionId), deadline);
      out[r]++;
    }
  };
  // Videos are CPU-heavy: one at a time. Photos: three in parallel.
  const kinds = await db.select({ id: M.id, kind: M.kind }).from(M).where(inArray(M.id, ids));
  const hasVideo = kinds.some((k) => k.kind === "video");
  await Promise.all(Array.from({ length: hasVideo ? 1 : 3 }, worker));
  return out;
}

/**
 * Cron sweep: items still pending or failed 10+ minutes after upload (or after their last attempt), under the attempt
 * limit. Voice notes are marked ready in bulk.
 */
export async function sweepMedia(opts: { budgetMs?: number; max?: number } = {}): Promise<Record<string, number>> {
  const voice = await db.update(M).set({ processingStatus: "ready", processedAt: new Date() })
    .where(and(eq(M.kind, "voice"), eq(M.processingStatus, "pending"), eq(M.status, "uploaded"))).returning({ id: M.id });
  const cutoff = new Date(Date.now() - SWEEP_AGE_MS);
  const due = await db.select({ id: M.id, kind: M.kind }).from(M).where(and(
    eq(M.status, "uploaded"), sql`${M.visibility} <> 'deleted'`, inArray(M.processingStatus, ["pending", "failed"]),
    lt(M.processingAttempts, MAX_ATTEMPTS), lt(sql`coalesce(${M.processingStartedAt}, ${M.createdAt})`, cutoff),
  )).orderBy(asc(M.createdAt)).limit(opts.max ?? 60);
  const deadline = Date.now() + (opts.budgetMs ?? 240_000);
  const photos = due.filter((d) => d.kind === "photo").map((d) => d.id);
  const videos = due.filter((d) => d.kind === "video").map((d) => d.id);
  const p = await processMediaIds(photos, { budgetMs: Math.max(0, deadline - Date.now()) });
  const v = await processMediaIds(videos, { budgetMs: Math.max(0, deadline - Date.now()) });
  const [gaveUp] = await db.select({ n: sql<number>`count(*)::int` }).from(M)
    .where(and(eq(M.status, "uploaded"), eq(M.processingStatus, "failed"), sql`${M.processingAttempts} >= ${MAX_ATTEMPTS}`));
  return { voice: voice.length, due: due.length, ready: p.ready + v.ready, failed: p.failed + v.failed, skipped: p.skipped + v.skipped, gaveUp: Number(gaveUp?.n ?? 0) };
}
