"use client";
import { ApiClientError } from "./api";
import type { MediaItem, Message } from "@/lib/api-types";
import type { Locale } from "@/lib/config";
import { DEMO_COOKIE, demoMedia, demoMissions } from "@/lib/demo";

/** In-memory fake of /api/v1/g/demo/* — nothing leaves the browser. */
const state = {
  locale: "en" as Locale,
  seeded: false,
  feed: [] as MediaItem[],
  mine: [] as MediaItem[],
  missionsDone: new Set<string>(),
  blobs: new Map<string, string>(),
  pending: new Map<string, { kind: "photo" | "video"; missionId: string | null; momentTag: string | null; dayId: string | null }>(),
};

function seed() {
  if (state.seeded) return;
  state.locale = document.documentElement.lang === "tr" ? "tr" : "en";
  state.feed = demoMedia(state.locale);
  state.seeded = true;
}

const name = () => decodeURIComponent(document.cookie.split("; ").find((c) => c.startsWith(`${DEMO_COOKIE}=`))?.split("=")[1] || "");

/** Called by the uploader instead of a real PUT: remembers the blob as an object URL. */
export function demoPut(url: string, body: Blob) {
  state.blobs.set(url, URL.createObjectURL(body));
}

export async function demoApi<T>(path: string, opts: { method?: string; body?: unknown }): Promise<T> {
  seed();
  await new Promise((r) => setTimeout(r, 150));
  const [route, query = ""] = path.replace(/^\/api\/v1\/g\/demo/, "").split("?");
  const q = new URLSearchParams(query);
  const body = (opts.body || {}) as Record<string, unknown>;
  const method = opts.method || (opts.body !== undefined ? "POST" : "GET");
  const out = (v: unknown) => v as T;

  if (route === "/join") {
    document.cookie = `${DEMO_COOKIE}=${encodeURIComponent(String(body.name || "Guest").slice(0, 40))}; path=/; max-age=86400; samesite=lax`;
    return out({ guestToken: "demo", guest: { id: "demo-guest", displayName: body.name } });
  }
  if (route === "/feed") {
    let items = [...state.feed];
    if (q.get("after")) items = items.filter((i) => i.createdAt > q.get("after")!);
    if (q.get("kind")) items = items.filter((i) => i.kind === q.get("kind"));
    if (q.get("moment")) items = items.filter((i) => i.momentTag === q.get("moment"));
    if (q.get("sort") === "top") items.sort((a, b) => b.reactionCount - a.reactionCount);
    return out({ items, nextCursor: null });
  }
  if (route === "/reactions") {
    const m = state.feed.find((i) => i.id === body.mediaId);
    if (m) { m.reactedByMe = !m.reactedByMe; m.reactionCount += m.reactedByMe ? 1 : -1; }
    return out({ reacted: !!m?.reactedByMe, count: m?.reactionCount ?? 0 });
  }
  if (route === "/missions") {
    const ms = demoMissions(state.locale).map((m) => ({ ...m, done: state.missionsDone.has(m.id) }));
    return out({ missions: ms, leaderboard: [{ guestName: "Zeynep", done: 6 }, { guestName: "Mert", done: 4 }, { guestName: "Selin", done: 3 }], me: { rank: state.missionsDone.size ? 4 : null, done: state.missionsDone.size } });
  }
  if (route === "/mine") {
    if (method === "DELETE") {
      const id = q.get("mediaId");
      state.mine = state.mine.filter((i) => i.id !== id);
      state.feed = state.feed.filter((i) => i.id !== id);
      return out({ ok: true });
    }
    return out({ items: state.mine });
  }
  if (route === "/uploads") {
    const files = (body.files || []) as { clientId: string; kind: "photo" | "video"; missionId?: string; momentTag?: string; dayId?: string; hasDisplay: boolean; hasThumb: boolean }[];
    return out({
      uploads: files.map((f) => {
        const id = `demo-up-${f.clientId}`;
        state.pending.set(id, { kind: f.kind, missionId: f.missionId ?? null, momentTag: f.momentTag ?? null, dayId: f.dayId ?? null });
        const put = (k: string) => ({ url: `demo:${id}/${k}`, method: "PUT", headers: {} });
        return { clientId: f.clientId, mediaId: id, original: put("original"), ...(f.hasDisplay ? { display: put("display") } : {}), ...(f.hasThumb ? { thumb: put("thumb") } : {}) };
      }),
    });
  }
  if (route === "/uploads/complete") {
    for (const id of (body.mediaIds || []) as string[]) {
      const p = state.pending.get(id);
      if (!p) continue;
      const original = state.blobs.get(`demo:${id}/original`) ?? null;
      const display = state.blobs.get(`demo:${id}/display`) ?? (p.kind === "photo" ? original : null);
      const item: MediaItem = {
        id, kind: p.kind, thumbUrl: state.blobs.get(`demo:${id}/thumb`) ?? display, displayUrl: display, originalUrl: null,
        playbackUrl: p.kind === "video" ? original : undefined, mine: true, processing: "ready",
        width: null, height: null, durationS: null, momentTag: p.momentTag, dayId: p.dayId, guestName: name() || null,
        reactionCount: 0, reactedByMe: false, createdAt: new Date().toISOString(), missionId: p.missionId,
      };
      state.feed.unshift(item);
      state.mine.unshift(item);
      if (p.missionId) state.missionsDone.add(p.missionId);
      state.pending.delete(id);
    }
    return out({ ok: true, missing: [] });
  }
  const dl = /^\/media\/([^/]+)\/download$/.exec(route);
  if (dl) {
    // Demo: your own uploads download from this browser; everyone else's open the (demo) offer.
    const mine = state.mine.find((i) => i.id === dl[1]);
    const url = mine ? state.blobs.get(`demo:${mine.id}/original`) : null;
    if (!url) throw new ApiClientError(402, "purchase_required", "Demo");
    return out({ url });
  }
  if (route === "/messages/upload-url") return out({ mediaKey: "demo", upload: { url: "demo:message", method: "PUT", headers: {} } });
  if (route === "/messages") {
    const message: Message = { id: `demo-msg-${Date.now()}`, kind: body.kind as Message["kind"], body: (body.body as string) || null, mediaUrl: null, durationS: (body.durationS as number) ?? null, guestName: name(), createdAt: new Date().toISOString() };
    return out({ message });
  }
  return out({ ok: true });
}
