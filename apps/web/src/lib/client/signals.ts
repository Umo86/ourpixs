/** Client-side moderation signals: 64-bit difference hash and a blur score (variance of Laplacian). */

function ctx2d(w: number, h: number) {
  const c = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(w, h) : Object.assign(document.createElement("canvas"), { width: w, height: h });
  return c.getContext("2d", { willReadFrequently: true } as CanvasRenderingContext2DSettings) as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
}

function grey(data: Uint8ClampedArray, n: number) {
  const g = new Float32Array(n);
  for (let i = 0; i < n; i++) g[i] = 0.299 * data[i * 4]! + 0.587 * data[i * 4 + 1]! + 0.114 * data[i * 4 + 2]!;
  return g;
}

/** dHash: 9×8 greyscale, each bit = left pixel brighter than right. 16 hex chars. */
export function dHash(src: CanvasImageSource): string | null {
  const ctx = ctx2d(9, 8);
  if (!ctx) return null;
  ctx.drawImage(src, 0, 0, 9, 8);
  const g = grey(ctx.getImageData(0, 0, 9, 8).data, 72);
  let hex = "";
  for (let row = 0; row < 8; row++) {
    let byte = 0;
    for (let col = 0; col < 8; col++) byte = (byte << 1) | (g[row * 9 + col]! > g[row * 9 + col + 1]! ? 1 : 0);
    hex += byte.toString(16).padStart(2, "0");
  }
  return hex;
}

/** Variance of the 4-neighbour Laplacian on a ≤320px greyscale copy. Low values mean little edge detail (blur). */
export function blurScore(src: CanvasImageSource, w: number, h: number): number | null {
  const scale = Math.min(1, 320 / Math.max(w, h));
  const cw = Math.max(3, Math.round(w * scale));
  const ch = Math.max(3, Math.round(h * scale));
  const ctx = ctx2d(cw, ch);
  if (!ctx) return null;
  ctx.drawImage(src, 0, 0, cw, ch);
  const g = grey(ctx.getImageData(0, 0, cw, ch).data, cw * ch);
  let sum = 0;
  let sq = 0;
  let n = 0;
  for (let y = 1; y < ch - 1; y++) {
    for (let x = 1; x < cw - 1; x++) {
      const i = y * cw + x;
      const l = g[i - 1]! + g[i + 1]! + g[i - cw]! + g[i + cw]! - 4 * g[i]!;
      sum += l;
      sq += l * l;
      n++;
    }
  }
  if (!n) return null;
  const mean = sum / n;
  return Math.round((sq / n - mean * mean) * 100) / 100;
}

export function signals(src: CanvasImageSource, w: number, h: number) {
  try {
    return { phash: dHash(src), blurScore: blurScore(src, w, h) };
  } catch {
    return { phash: null, blurScore: null };
  }
}
