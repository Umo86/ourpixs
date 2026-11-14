/**
 * Upload queue shared by host and guest upload screens.
 *
 * Per file: prepare renditions → ask the API for presigned PUT URLs → PUT original/display/thumb
 * straight to storage (never through the API) → POST complete.
 * Runs 3 files at a time, retries each PUT with backoff, survives screen changes (module state).
 */
import { File, UploadTask, UploadType } from "expo-file-system";
import { useMemo, useSyncExternalStore } from "react";
import { Platform } from "react-native";

import { ApiError, guestApi, hostApi } from "@/api/client";
import type { PresignedTarget, UploadFileSpec, UploadGrant } from "@/api/types";
import { DEMO_MODE } from "@/config";
import { prepareVideoThumb, preparePhoto, sizeOf, videoDurationS, type Rendition } from "./prepare";

export type UploadTarget =
  | { type: "host"; occasionId: string }
  | { type: "guest"; slug: string; token: string; pin?: string | null };

export function targetKey(t: UploadTarget): string {
  return t.type === "host" ? `host:${t.occasionId}` : `guest:${t.slug}`;
}

export type QueueStatus = "queued" | "preparing" | "uploading" | "done" | "failed";

export type PickedAsset = {
  uri: string;
  kind: "photo" | "video";
  mime?: string | null;
  name?: string | null;
  bytes?: number | null;
  width?: number;
  height?: number;
  durationS?: number | null;
};

export type UploadExtras = { dayId?: string; momentTag?: string; missionId?: string; fromDisposable?: boolean };

/** Errors that retrying won't fix (shown with a friendly message, not retried automatically). */
export class UploadRejected extends Error {
  constructor(public code: "video_too_long" | "video_duration_required") {
    super(code);
    this.name = "UploadRejected";
  }
}

export type QueueItem = {
  id: string;
  key: string;
  target: UploadTarget;
  asset: PickedAsset;
  extras: UploadExtras;
  status: QueueStatus;
  progress: number; // 0..1
  error?: string;
  mediaId?: string;
  /** Longest video allowed for this event (seconds). */
  maxVideoSeconds?: number;
};

const CONCURRENCY = 3;
const MAX_ATTEMPTS = 3;

let items: QueueItem[] = [];
let active = 0;
const listeners = new Set<() => void>();
const completedListeners = new Set<(key: string) => void>();

function emit() {
  for (const l of listeners) l();
}
function update(id: string, patch: Partial<QueueItem>) {
  items = items.map((it) => (it.id === id ? { ...it, ...patch } : it));
  emit();
}

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

const EXT_MIME: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", heic: "image/heic", heif: "image/heif", webp: "image/webp",
  mp4: "video/mp4", mov: "video/quicktime", webm: "video/webm",
};
function guessMime(a: PickedAsset): string {
  if (a.mime) return a.mime;
  const ext = (a.name || a.uri).split("?")[0].split(".").pop()?.toLowerCase() ?? "";
  return EXT_MIME[ext] ?? (a.kind === "video" ? "video/mp4" : "image/jpeg");
}
function guessName(a: PickedAsset, mime: string): string {
  if (a.name) return a.name;
  const fromUri = a.uri.split("?")[0].split("/").pop();
  if (fromUri && fromUri.includes(".")) return fromUri;
  const ext = Object.entries(EXT_MIME).find(([, m]) => m === mime)?.[0] ?? "jpg";
  return `${a.kind === "video" ? "VID" : "IMG"}_${Date.now()}.${ext}`;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function putFile(uri: string, target: PresignedTarget, mime: string, onBytes: (sent: number) => void): Promise<void> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const headers = { ...target.headers };
      if (!Object.keys(headers).some((h) => h.toLowerCase() === "content-type")) headers["Content-Type"] = mime;
      const task = new UploadTask(new File(uri), target.url, {
        httpMethod: "PUT",
        uploadType: UploadType.BINARY_CONTENT,
        headers,
        mimeType: mime,
        onProgress: (p) => onBytes(p.bytesSent),
      });
      const res = await task.uploadAsync();
      task.release();
      if (res.status >= 200 && res.status < 300) return;
      lastErr = new Error(`Storage responded ${res.status}`);
      // 4xx from storage (expired/invalid signature) won't fix itself by retrying the same URL.
      if (res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429) break;
    } catch (e) {
      lastErr = e;
    }
    onBytes(0);
    if (attempt < MAX_ATTEMPTS) await sleep(1000 * 2 ** attempt - 1000);
  }
  throw lastErr instanceof Error ? lastErr : new Error("Upload failed");
}

async function requestGrant(target: UploadTarget, spec: UploadFileSpec): Promise<UploadGrant> {
  const res =
    target.type === "host"
      ? await hostApi.requestUploads(target.occasionId, [spec])
      : await guestApi.requestUploads(target.slug, { token: target.token, pin: target.pin }, [spec]);
  const grant = res.uploads.find((u) => u.clientId === spec.clientId) ?? res.uploads[0];
  if (!grant) throw new Error("No upload slot returned");
  return grant;
}

async function complete(target: UploadTarget, mediaIds: string[]) {
  if (target.type === "host") await hostApi.completeUploads(target.occasionId, mediaIds);
  else await guestApi.completeUploads(target.slug, { token: target.token, pin: target.pin }, mediaIds);
}

async function simulate(item: QueueItem) {
  update(item.id, { status: "preparing", progress: 0 });
  await sleep(300);
  for (let p = 0.1; p <= 1.0001; p += 0.15) {
    update(item.id, { status: "uploading", progress: Math.min(1, p) });
    await sleep(180);
  }
  update(item.id, { status: "done", progress: 1, mediaId: `demo-${item.id}` });
}

async function run(item: QueueItem) {
  if (DEMO_MODE) return simulate(item);
  const { asset, target } = item;
  update(item.id, { status: "preparing", progress: 0, error: undefined });

  const mime = guessMime(asset);
  const name = guessName(asset, mime);
  const bytes = asset.bytes || sizeOf(asset.uri);

  // Videos must send their length (server: 400 `video_duration_required`) and stay within the event's limit.
  let durationS: number | null = null;
  if (asset.kind === "video") {
    durationS = await videoDurationS(asset.uri, asset.durationS);
    if (durationS == null) throw new UploadRejected("video_duration_required");
    if (item.maxVideoSeconds && durationS > item.maxVideoSeconds + 1) throw new UploadRejected("video_too_long");
  }

  let display: Rendition | null = null;
  let thumb: Rendition | null = null;
  if (asset.kind === "photo") {
    ({ display, thumb } = await preparePhoto(asset.uri, asset.width ?? 0, asset.height ?? 0));
  } else {
    thumb = await prepareVideoThumb(asset.uri);
  }

  const spec: UploadFileSpec = {
    clientId: item.id,
    name,
    mime,
    bytes,
    kind: asset.kind,
    width: asset.width || undefined,
    height: asset.height || undefined,
    durationS: durationS ?? undefined,
    ...item.extras,
    hasDisplay: !!display,
    hasThumb: !!thumb,
  };
  const grant = await requestGrant(target, spec);
  update(item.id, { status: "uploading", mediaId: grant.mediaId });

  const parts: { uri: string; mime: string; bytes: number; target: PresignedTarget }[] = [
    { uri: asset.uri, mime, bytes, target: grant.original },
  ];
  if (display && grant.display) parts.push({ uri: display.uri, mime: display.mime, bytes: display.bytes, target: grant.display });
  if (thumb && grant.thumb) parts.push({ uri: thumb.uri, mime: thumb.mime, bytes: thumb.bytes, target: grant.thumb });

  const total = parts.reduce((s, p) => s + Math.max(p.bytes, 1), 0);
  const sent = parts.map(() => 0);
  const report = () => update(item.id, { progress: Math.min(0.99, sent.reduce((a, b) => a + b, 0) / total) });

  // Thumb + display first (small, makes the item show up quickly), then the original.
  const order = parts.map((_, i) => i).sort((a, b) => (a === 0 ? 1 : b === 0 ? -1 : 0));
  for (const i of order) {
    const p = parts[i];
    await putFile(p.uri, p.target, p.mime, (s) => {
      sent[i] = Math.min(s, Math.max(p.bytes, 1));
      report();
    });
    sent[i] = Math.max(p.bytes, 1);
    report();
  }

  await complete(target, [grant.mediaId]);
  update(item.id, { status: "done", progress: 1 });
  for (const l of completedListeners) l(item.key);

  // Clean up generated renditions.
  for (const r of [display, thumb]) {
    if (!r) continue;
    try {
      new File(r.uri).delete();
    } catch {
      // ignore
    }
  }
}

function pump() {
  while (active < CONCURRENCY) {
    const next = items.find((i) => i.status === "queued");
    if (!next) return;
    active++;
    // mark immediately so the loop doesn't pick it twice
    update(next.id, { status: "preparing" });
    run(next)
      .catch((e: unknown) => update(next.id, { status: "failed", error: e instanceof UploadRejected ? e.code : e instanceof ApiError ? e.code : e instanceof Error ? e.message : String(e) }))
      .finally(() => {
        active--;
        pump();
      });
  }
}

export function enqueue(target: UploadTarget, assets: PickedAsset[], extras: UploadExtras = {}, maxVideoSeconds?: number) {
  const key = targetKey(target);
  const added: QueueItem[] = assets.map((asset) => ({
    id: uid(), key, target, asset, extras, status: "queued", progress: 0, maxVideoSeconds,
  }));
  items = [...items, ...added];
  emit();
  pump();
}

const NO_RETRY = new Set(["video_too_long", "video_duration_required", "upload_closed", "not_open", "test_limit", "payment_required", "event_locked", "guest_blocked"]);

export function retryFailed(key: string) {
  items = items.map((i) => (i.key === key && i.status === "failed" && !NO_RETRY.has(i.error ?? "") ? { ...i, status: "queued", progress: 0, error: undefined } : i));
  emit();
  pump();
}

export function clearFinished(key: string) {
  items = items.filter((i) => !(i.key === key && i.status === "done"));
  emit();
}

export function onUploadCompleted(fn: (key: string) => void): () => void {
  completedListeners.add(fn);
  return () => completedListeners.delete(fn);
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
const getSnapshot = () => items;

/** Live view of the queue for one target. */
export function useUploadQueue(key: string) {
  const all = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return useMemo(() => {
    const mine = all.filter((i) => i.key === key);
    const done = mine.filter((i) => i.status === "done").length;
    const failed = mine.filter((i) => i.status === "failed").length;
    const inFlight = mine.filter((i) => i.status !== "done" && i.status !== "failed").length;
    const progress = mine.length ? mine.reduce((s, i) => s + (i.status === "done" ? 1 : i.progress), 0) / mine.length : 0;
    return { items: mine, done, failed, inFlight, total: mine.length, progress };
  }, [all, key]);
}

export const isWeb = Platform.OS === "web";
