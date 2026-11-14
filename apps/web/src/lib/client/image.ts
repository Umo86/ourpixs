import { stripJpegGps } from "./exif";
import { signals } from "./signals";

export type Processed = {
  original: Blob;
  display?: Blob;
  thumb?: Blob;
  width?: number;
  height?: number;
  durationS?: number;
  phash?: string | null;
  blurScore?: number | null;
  kind: "photo" | "video";
  mime: string;
};

const DISPLAY = 1600;
const THUMB = 400;

/** Normalises odd/empty mime types from mobile pickers. */
export function guessMime(file: File): string {
  if (file.type) return file.type === "image/jpg" ? "image/jpeg" : file.type;
  const ext = file.name.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", heic: "image/heic", heif: "image/heif", webp: "image/webp", mp4: "video/mp4", mov: "video/quicktime", webm: "video/webm" };
  return (ext && map[ext]) || "application/octet-stream";
}

function makeCanvas(w: number, h: number): OffscreenCanvas | HTMLCanvasElement {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(w, h);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

async function toWebp(canvas: OffscreenCanvas | HTMLCanvasElement, quality: number): Promise<Blob | undefined> {
  if ("convertToBlob" in canvas) {
    const b = await canvas.convertToBlob({ type: "image/webp", quality });
    // Safari < 17 silently returns PNG for webp; skip rather than upload a mislabeled file.
    return b.type === "image/webp" ? b : undefined;
  }
  return new Promise((res) => (canvas as HTMLCanvasElement).toBlob((b) => res(b && b.type === "image/webp" ? b : undefined), "image/webp", quality));
}

async function resized(src: CanvasImageSource, w: number, h: number, max: number, quality: number) {
  const scale = Math.min(1, max / Math.max(w, h));
  const cw = Math.max(1, Math.round(w * scale));
  const ch = Math.max(1, Math.round(h * scale));
  const c = makeCanvas(cw, ch);
  const ctx = c.getContext("2d") as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
  if (!ctx) return undefined;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src, 0, 0, cw, ch);
  return toWebp(c, quality);
}

/** Photos: EXIF-oriented WebP display (1600px) + thumb (400px). Canvas output carries no EXIF, so no GPS. */
async function processPhoto(file: File, mime: string): Promise<Processed> {
  let original: Blob = file;
  if (mime === "image/jpeg") {
    try {
      original = new Blob([stripJpegGps(await file.arrayBuffer())], { type: mime });
    } catch {
      original = file;
    }
  }
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    const [display, thumb] = [await resized(bmp, bmp.width, bmp.height, DISPLAY, 0.82), await resized(bmp, bmp.width, bmp.height, THUMB, 0.72)];
    const out = { original, display, thumb, width: bmp.width, height: bmp.height, kind: "photo" as const, mime, ...signals(bmp, bmp.width, bmp.height) };
    bmp.close();
    return out;
  } catch {
    // HEIC on browsers that can't decode it: upload the original only; the album shows it via the original URL.
    return { original, kind: "photo", mime };
  }
}

/** Videos: duration/size from metadata and a poster frame at ~10% (max 1s) as display + thumb. */
function processVideo(file: File, mime: string): Promise<Processed> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    let settled = false;
    const done = (p: Processed) => {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(url);
      video.removeAttribute("src");
      video.load();
      resolve(p);
    };
    // The length is kept as soon as metadata loads, so a poster frame failing later doesn't lose it.
    let durationS: number | undefined;
    const timer = setTimeout(() => done({ original: file, kind: "video", mime, durationS }), 10000);
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.onloadedmetadata = () => {
      if (Number.isFinite(video.duration)) durationS = video.duration;
      video.currentTime = Math.min(1, (video.duration || 0) * 0.1);
    };
    video.onseeked = async () => {
      clearTimeout(timer);
      const w = video.videoWidth;
      const h = video.videoHeight;
      const base = { original: file, kind: "video" as const, mime, width: w || undefined, height: h || undefined, durationS: Number.isFinite(video.duration) ? video.duration : undefined };
      try {
        const display = await resized(video, w, h, DISPLAY, 0.8);
        const thumb = await resized(video, w, h, THUMB, 0.7);
        done({ ...base, display, thumb, phash: signals(video, w, h).phash });
      } catch {
        done(base);
      }
    };
    video.onerror = () => {
      clearTimeout(timer);
      done({ original: file, kind: "video", mime, durationS });
    };
    video.src = url;
  });
}

/** Resize any image to a WebP of at most `max` px (used for the host's cover photo). */
export async function resizeToWebp(file: File, max = 2000): Promise<Blob | undefined> {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    return await resized(bmp, bmp.width, bmp.height, max, 0.85);
  } finally {
    bmp.close();
  }
}

export async function processFile(file: File): Promise<Processed> {
  const mime = guessMime(file);
  if (mime.startsWith("video/")) return processVideo(file, mime);
  return processPhoto(file, mime);
}
