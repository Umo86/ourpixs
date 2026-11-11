"use client";
import type { PresignedPut, UploadTicket } from "@/lib/api-types";
import { api, ApiClientError } from "./api";
import { guessMime, processFile, type Processed } from "./image";
import { idbAll, idbAvailable, idbDel, idbPut } from "./idb";

export type UploadMeta = { dayId?: string | null; momentTag?: string | null; missionId?: string | null; fromDisposable?: boolean };
export type QueueStatus = "queued" | "processing" | "uploading" | "finishing" | "done" | "error";
export type QueueItem = {
  id: string; name: string; size: number; kind: "photo" | "video"; status: QueueStatus; progress: number;
  errorCode?: string; preview?: string; meta: UploadMeta; attempts: number;
};

type Entry = { item: QueueItem; file: File; ticket?: { t: UploadTicket; at: number; hasDisplay: boolean; hasThumb: boolean } };
type Persisted = { file: File; meta: UploadMeta; ticket?: Entry["ticket"] };

/** Errors the user (or host) has to fix; retrying won't help. */
const FATAL = new Set(["plan_limit", "plan_required", "upload_closed", "shots_exhausted", "invalid_request", "not_joined", "storage_not_configured", "not_found", "unauthorized", "pin_required"]);
const MAX_ATTEMPTS = 6;
const TICKET_TTL = 50 * 60 * 1000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

async function demoUpload(url: string, body: Blob, onProgress?: (loaded: number) => void) {
  const { demoPut } = await import("./demo-api");
  for (let i = 1; i <= 8; i++) {
    await sleep(120);
    onProgress?.((body.size * i) / 8);
  }
  demoPut(url, body);
}

function putWithProgress(target: PresignedPut | { url: string; headers: Record<string, string> }, body: Blob, onProgress?: (loaded: number) => void): Promise<void> {
  if (target.url.startsWith("demo:")) return demoUpload(target.url, body, onProgress);
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", target.url);
    for (const [k, v] of Object.entries(target.headers || {})) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (e) => onProgress?.(e.loaded);
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new ApiClientError(xhr.status, "storage_error", `Upload failed (${xhr.status})`)));
    xhr.onerror = () => reject(new ApiClientError(0, "offline", "Network error"));
    xhr.ontimeout = () => reject(new ApiClientError(0, "offline", "Timeout"));
    xhr.send(body);
  });
}

/**
 * Upload queue: concurrency 3, retries with exponential backoff, resumes after refresh (IndexedDB),
 * waits for the network to come back. Works for any endpoint pair with the /uploads contract.
 */
export class Uploader {
  private entries = new Map<string, Entry>();
  private order: string[] = [];
  private listeners = new Set<() => void>();
  private doneListeners = new Set<(item: QueueItem) => void>();
  private running = 0;
  private snap: QueueItem[] = [];
  private restored = false;

  constructor(private cfg: { ns: string; createUrl: string; completeUrl: string; concurrency?: number }) {
    if (typeof window !== "undefined") window.addEventListener("online", () => this.pump());
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  onDone(fn: (item: QueueItem) => void) {
    this.doneListeners.add(fn);
    return () => { this.doneListeners.delete(fn); };
  }
  getSnapshot = () => this.snap;

  private emit() {
    this.snap = this.order.map((id) => this.entries.get(id)!.item);
    this.listeners.forEach((l) => l());
  }
  private patch(id: string, p: Partial<QueueItem>) {
    const e = this.entries.get(id);
    if (!e) return;
    e.item = { ...e.item, ...p };
    this.emit();
  }

  /** Re-queue anything left from a previous visit. Safe to call more than once. */
  async restore() {
    if (this.restored || !idbAvailable()) return;
    this.restored = true;
    try {
      const rows = await idbAll<Persisted>(`${this.cfg.ns}:`);
      for (const r of rows) {
        const id = r.key.slice(this.cfg.ns.length + 1);
        if (this.entries.has(id) || !r.value?.file) continue;
        this.insert(id, r.value.file, r.value.meta, r.value.ticket);
      }
      this.emit();
      this.pump();
    } catch {
      /* private mode etc. */
    }
  }

  private insert(id: string, file: File, meta: UploadMeta, ticket?: Entry["ticket"]) {
    const mime = guessMime(file);
    const kind = mime.startsWith("video/") ? "video" : "photo";
    const preview = kind === "photo" && !/hei[cf]/.test(mime) ? URL.createObjectURL(file) : undefined;
    this.entries.set(id, { item: { id, name: file.name || "photo.jpg", size: file.size, kind, status: "queued", progress: 0, preview, meta, attempts: 0 }, file, ticket });
    this.order.push(id);
  }

  add(files: File[], meta: UploadMeta = {}) {
    for (const file of files) {
      const id = uid();
      this.insert(id, file, meta);
      if (idbAvailable()) idbPut(`${this.cfg.ns}:${id}`, { file, meta } satisfies Persisted).catch(() => {});
    }
    this.emit();
    this.pump();
  }

  retry(id: string) {
    const e = this.entries.get(id);
    if (!e || e.item.status !== "error") return;
    this.patch(id, { status: "queued", errorCode: undefined, attempts: 0, progress: 0 });
    this.pump();
  }

  remove(id: string) {
    const e = this.entries.get(id);
    if (!e || (e.item.status !== "done" && e.item.status !== "error" && e.item.status !== "queued")) return;
    if (e.item.preview) URL.revokeObjectURL(e.item.preview);
    this.entries.delete(id);
    this.order = this.order.filter((x) => x !== id);
    idbDel(`${this.cfg.ns}:${id}`).catch(() => {});
    this.emit();
  }

  clearDone() {
    for (const id of [...this.order]) if (this.entries.get(id)?.item.status === "done") this.remove(id);
  }

  private pump() {
    const max = this.cfg.concurrency ?? 3;
    if (typeof navigator !== "undefined" && navigator.onLine === false) return;
    for (const id of this.order) {
      if (this.running >= max) break;
      const e = this.entries.get(id);
      if (e?.item.status === "queued") {
        this.running++;
        this.run(id).finally(() => {
          this.running--;
          this.pump();
        });
      }
    }
  }

  private async run(id: string) {
    const e = this.entries.get(id);
    if (!e) return;
    try {
      this.patch(id, { status: "processing", progress: 0 });
      const p: Processed = await processFile(e.file);
      const ticket = await this.ticketFor(e, p);
      this.patch(id, { status: "uploading" });
      const total = p.original.size + (p.display?.size ?? 0) + (p.thumb?.size ?? 0);
      let base = 0;
      const prog = (loaded: number) => this.patch(id, { progress: Math.min(0.99, (base + loaded) / total) });
      await this.putOriginal(ticket.original, p.original, prog);
      base += p.original.size;
      if (ticket.display && p.display) { await putWithProgress(ticket.display, p.display, prog); base += p.display.size; }
      if (ticket.thumb && p.thumb) await putWithProgress(ticket.thumb, p.thumb, prog);
      this.patch(id, { status: "finishing", progress: 0.99 });
      const r = await api<{ ok: true; missing?: string[] }>(this.cfg.completeUrl, { body: { mediaIds: [ticket.mediaId] } });
      if (r.missing?.includes(ticket.mediaId)) {
        e.ticket = undefined;
        throw new ApiClientError(0, "storage_error", "File did not arrive");
      }
      this.patch(id, { status: "done", progress: 1 });
      idbDel(`${this.cfg.ns}:${id}`).catch(() => {});
      const item = this.entries.get(id)?.item;
      if (item) this.doneListeners.forEach((l) => l(item));
    } catch (err) {
      const code = err instanceof ApiClientError ? err.code : "server_error";
      const attempts = (this.entries.get(id)?.item.attempts ?? 0) + 1;
      if (FATAL.has(code) || attempts >= MAX_ATTEMPTS) {
        this.patch(id, { status: "error", errorCode: code, attempts });
        if (FATAL.has(code)) idbDel(`${this.cfg.ns}:${id}`).catch(() => {});
        return;
      }
      this.patch(id, { status: "queued", attempts, progress: 0 });
      await sleep(Math.min(30000, 1000 * 2 ** (attempts - 1)) + Math.random() * 500);
    }
  }

  /** Reuses a recent ticket so a retry doesn't create a second media row (or spend a second disposable shot). */
  private async ticketFor(e: Entry, p: Processed): Promise<UploadTicket> {
    const hasDisplay = !!p.display;
    const hasThumb = !!p.thumb;
    if (e.ticket && Date.now() - e.ticket.at < TICKET_TTL && e.ticket.hasDisplay === hasDisplay && e.ticket.hasThumb === hasThumb) return e.ticket.t;
    const m = e.item.meta;
    const r = await api<{ uploads: UploadTicket[] }>(this.cfg.createUrl, {
      body: {
        files: [{
          clientId: e.item.id, name: e.item.name.slice(0, 300), mime: p.mime, bytes: p.original.size, kind: p.kind,
          width: p.width ?? null, height: p.height ?? null, durationS: p.durationS ?? null,
          dayId: m.dayId ?? null, momentTag: m.momentTag ?? null, missionId: m.missionId ?? null, fromDisposable: !!m.fromDisposable,
          hasDisplay, hasThumb, phash: p.phash ?? null, blurScore: p.blurScore ?? null,
        }],
      },
    });
    const t = r.uploads[0]!;
    e.ticket = { t, at: Date.now(), hasDisplay, hasThumb };
    if (idbAvailable()) idbPut(`${this.cfg.ns}:${e.item.id}`, { file: e.file, meta: m, ticket: e.ticket } satisfies Persisted).catch(() => {});
    return t;
  }

  private async putOriginal(target: PresignedPut, blob: Blob, onProgress: (n: number) => void) {
    if (!target.multipart) return putWithProgress(target, blob, onProgress);
    const { partSize, parts } = target.multipart;
    let done = 0;
    for (const part of parts) {
      const chunk = blob.slice((part.partNumber - 1) * partSize, part.partNumber * partSize);
      for (let i = 0; ; i++) {
        try {
          await putWithProgress({ url: part.url, headers: {} }, chunk, (n) => onProgress(done + n));
          break;
        } catch (err) {
          if (i >= 3) throw err;
          await sleep(1000 * 2 ** i);
        }
      }
      done += chunk.size;
    }
  }
}
