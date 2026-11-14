import "server-only";
import { createHmac } from "node:crypto";
import { copyFile, mkdir, rm, stat, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";

/**
 * TEST ONLY: the `local` storage driver (STORAGE_DRIVER=local, see docs/TESTING.md). Files live under
 * LOCAL_STORAGE_DIR and browsers reach them through the test harness's storage server (apps/web/test/harness/
 * storage-server.mjs at LOCAL_STORAGE_URL), which checks the same HMAC signature and expiry as these URLs carry,
 * so presigned PUT/GET, the ≤1 h expiry of originals and the paywall are exercised for real.
 * Never selectable in production: storage.ts refuses it when VERCEL_ENV=production.
 *
 * URL: {LOCAL_STORAGE_URL}/{key}?m=GET|PUT&exp=<unix s>&ct=<content type>&dl=<file name>&sig=<hex>
 * sig = HMAC-SHA256(LOCAL_STORAGE_SECRET, [m, key, exp, ct, dl].join("\n"))
 */

export function localStorageEnabled(): boolean {
  if (process.env.STORAGE_DRIVER !== "local") return false;
  if (process.env.VERCEL_ENV === "production") throw new Error("STORAGE_DRIVER=local is not allowed in production");
  return !!process.env.LOCAL_STORAGE_DIR && !!process.env.LOCAL_STORAGE_URL && !!process.env.LOCAL_STORAGE_SECRET;
}

const root = () => resolve(process.env.LOCAL_STORAGE_DIR!);

function pathOf(key: string): string {
  const p = resolve(root(), key);
  if (!p.startsWith(root() + sep)) throw new Error(`bad storage key ${key}`);
  return p;
}

export function localSign(parts: { m: "GET" | "PUT"; key: string; exp: number; ct?: string; dl?: string }): string {
  return createHmac("sha256", process.env.LOCAL_STORAGE_SECRET!)
    .update([parts.m, parts.key, String(parts.exp), parts.ct ?? "", parts.dl ?? ""].join("\n")).digest("hex");
}

export function localUrl(m: "GET" | "PUT", key: string, ttlSeconds: number, opts: { ct?: string; dl?: string } = {}): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const q = new URLSearchParams({ m, exp: String(exp) });
  if (opts.ct) q.set("ct", opts.ct);
  if (opts.dl) q.set("dl", opts.dl);
  q.set("sig", localSign({ m, key, exp, ...opts }));
  const base = process.env.LOCAL_STORAGE_URL!.replace(/\/$/, "");
  return `${base}/${key.split("/").map(encodeURIComponent).join("/")}?${q}`;
}

export async function localHead(key: string): Promise<{ bytes: number } | null> {
  try {
    const s = await stat(pathOf(key));
    return s.isFile() ? { bytes: s.size } : null;
  } catch {
    return null;
  }
}

export async function localPut(key: string, body: Buffer | { path: string }, contentType: string) {
  const p = pathOf(key);
  await mkdir(dirname(p), { recursive: true });
  if (Buffer.isBuffer(body)) await writeFile(p, body);
  else await copyFile(body.path, p);
  await writeFile(`${p}.meta.json`, JSON.stringify({ contentType }));
}

export async function localCopyTo(key: string, path: string) {
  await copyFile(pathOf(key), path);
}

export async function localDelete(keys: string[]) {
  for (const k of keys) {
    const p = pathOf(k);
    await rm(p, { force: true });
    await rm(`${p}.meta.json`, { force: true });
  }
}
