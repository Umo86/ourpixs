/** In-memory fake of /api/v1 for demo mode. Mutations persist for the session only. */
import type { MediaItem, Mission, ShareLink } from "@/api/types";
import {
  DEMO_GUEST_TOKEN, demoGuestMissions, demoHost, demoMedia, demoMessages, demoMissionTitles, demoOccasion, demoOccasions, demoPublic,
  demoAccess, demoShareLinks, demoStats, demoSubscription,
} from "./data";

let media: MediaItem[] | null = null;
let missions: Mission[] = demoMissionTitles.map((title, i) => ({ id: `mi${i}`, title, sortOrder: i }));
let links: ShareLink[] = [...demoShareLinks];
let occasionPatch: Record<string, unknown> = {};

const PAGE = 24;
const delay = (ms = 220) => new Promise((r) => setTimeout(r, ms));

function allMedia() {
  if (!media) media = demoMedia(60);
  return media;
}

function page(list: MediaItem[], cursor?: unknown) {
  const start = cursor ? Number(cursor) : 0;
  const items = list.slice(start, start + PAGE);
  return { items, nextCursor: start + PAGE < list.length ? String(start + PAGE) : null };
}

export async function demoRequest<T>(method: string, path: string, body?: unknown, query?: Record<string, unknown>): Promise<T> {
  await delay();
  const b = (body ?? {}) as Record<string, unknown>;
  const q = query ?? {};
  const p = path.replace(/^\/api\/v1/, "");
  let m: RegExpMatchArray | null;

  if (p === "/auth/request-code") return { ok: true, previewCode: "123456" } as T;
  if (p === "/auth/verify") return { token: "demo-token", host: demoHost } as T;
  if (p === "/me") return { host: demoHost, subscription: demoSubscription } as T;
  if (p === "/push-tokens") return { ok: true } as T;

  if (p === "/occasions" && method === "GET") return { occasions: demoOccasions() } as T;
  if (p === "/occasions" && method === "POST") {
    return { occasion: { ...demoOccasion("demo-wedding"), id: "demo-new", title: String(b.title ?? ""), type: String(b.type ?? "dugun"), mediaCount: 0, guestCount: 0, access: demoAccess } } as T;
  }

  if ((m = p.match(/^\/occasions\/([^/]+)$/))) {
    if (method === "DELETE") return { ok: true } as T;
    if (method === "PATCH") occasionPatch = { ...occasionPatch, ...b, ...(b.pin !== undefined ? { hasPin: b.pin !== null } : {}) };
    return { occasion: { ...demoOccasion(m[1]), ...occasionPatch }, stats: demoStats } as T;
  }
  if ((m = p.match(/^\/occasions\/([^/]+)\/media$/))) {
    if (method === "PATCH") {
      const ids = new Set((b.ids as string[]) ?? []);
      const action = b.action as string;
      media = allMedia()
        .filter((it) => !(action === "delete" && ids.has(it.id)))
        .map((it) => {
          if (!ids.has(it.id)) return it;
          if (action === "favourite") return { ...it, favourite: true };
          if (action === "unfavourite") return { ...it, favourite: false };
          if (action === "hide") return { ...it, visibility: "hidden" };
          if (action === "show") return { ...it, visibility: "visible" };
          if (action === "approve") return { ...it, approved: true };
          return it;
        });
      return { ok: true } as T;
    }
    let list = allMedia();
    if (q.kind) list = list.filter((i) => i.kind === q.kind);
    if (q.dayId) list = list.filter((i) => i.dayId === q.dayId);
    if (q.moment) list = list.filter((i) => i.momentTag === q.moment);
    if (q.filter === "favourites") list = list.filter((i) => i.favourite);
    if (q.filter === "hidden") list = list.filter((i) => i.visibility === "hidden");
    if (q.filter === "pending") list = list.filter((i) => i.approved === false);
    return page(list, q.cursor) as T;
  }
  if ((m = p.match(/^\/occasions\/([^/]+)\/messages$/))) return { messages: demoMessages } as T;
  if ((m = p.match(/^\/occasions\/([^/]+)\/missions$/))) {
    if (method === "POST") missions = [...missions, { id: `mi${Date.now()}`, title: String(b.title), sortOrder: missions.length }];
    if (method === "DELETE") missions = missions.filter((x) => x.id !== q.missionId);
    return { missions } as T;
  }
  if ((m = p.match(/^\/occasions\/([^/]+)\/share-links$/))) {
    if (method === "POST") {
      const token = `link-${links.length + 1}`;
      links = [...links, { id: token, token, url: `https://ourpixs.com/s/${token}`, scope: String(b.scope), label: (b.label as string) ?? null, expiresAt: null }];
    }
    return { links } as T;
  }
  if ((m = p.match(/\/uploads$/))) {
    const files = (b.files as { clientId: string }[]) ?? [];
    const target = { url: "demo://upload", method: "PUT" as const, headers: {} };
    return { uploads: files.map((f) => ({ clientId: f.clientId, mediaId: `demo-${f.clientId}`, original: target, display: target, thumb: target })) } as T;
  }
  if (p.endsWith("/uploads/complete")) return { ok: true } as T;

  // guest
  if ((m = p.match(/^\/g\/([^/]+)$/))) return { occasion: demoPublic() } as T;
  if ((m = p.match(/^\/g\/([^/]+)\/join$/))) return { guestToken: DEMO_GUEST_TOKEN, guest: { id: "demo-guest", displayName: String(b.name ?? "Ayşe") } } as T;
  if ((m = p.match(/^\/g\/([^/]+)\/feed$/))) return (q.after ? { items: [], nextCursor: null } : page(allMedia(), q.cursor)) as T;
  if ((m = p.match(/^\/g\/([^/]+)\/reactions$/))) {
    const it = allMedia().find((x) => x.id === b.mediaId);
    const reacted = !it?.reactedByMe;
    if (it) {
      it.reactedByMe = reacted;
      it.reactionCount += reacted ? 1 : -1;
    }
    return { reacted, count: it?.reactionCount ?? 0 } as T;
  }
  if ((m = p.match(/^\/g\/([^/]+)\/missions$/))) return { missions: demoGuestMissions() } as T;
  if ((m = p.match(/^\/g\/([^/]+)\/messages$/))) return { message: { id: "new", kind: "text", body: b.body ?? null, mediaUrl: null, durationS: null, guestName: "Ayşe", createdAt: new Date().toISOString() } } as T;
  if ((m = p.match(/^\/g\/([^/]+)\/report$/))) return { ok: true } as T;
  if ((m = p.match(/^\/occasions\/([^/]+)\/guests\/([^/]+)\/block$/))) return { ok: true } as T;
  if (p === "/me" && method === "DELETE") return { ok: true } as T;
  if ((m = p.match(/^\/g\/([^/]+)\/mine$/))) return (method === "DELETE" ? { ok: true } : { items: allMedia().slice(0, 4) }) as T;

  throw new Error(`demo: unhandled ${method} ${path}`);
}
