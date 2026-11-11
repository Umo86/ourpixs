/**
 * Typed client for the Our Pixs JSON API (docs/API.md, /api/v1).
 * - Host calls send `Authorization: Bearer <jwt>`.
 * - Guest calls send `X-Guest-Token` (and `X-Occasion-Pin` when the event has a PIN).
 * - Errors are normalised to ApiError { status, code, message }.
 * - With EXPO_PUBLIC_DEMO=1 every call is answered from built-in sample data (store screenshots).
 */
import { API_URL, DEMO_MODE, type Brand, type Locale } from "@/config";
import { demoRequest } from "@/demo/demoApi";
import type {
  GuestMission, Host, MediaAction, Organisation, MediaItem, MediaQuery, Message, MessageKind, Mission, Occasion, OccasionCreate,
  OccasionPatch, OccasionSummary, Page, PublicOccasion, ShareLink, Stats, UploadFileSpec, UploadGrant,
} from "./types";

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
  get isNetwork() {
    return this.status === 0;
  }
  get isAuth() {
    return this.status === 401;
  }
}

type GuestAuth = { token?: string | null; pin?: string | null };

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | boolean | null | undefined>;
  /** "host" adds the bearer token; a GuestAuth adds guest headers; "none" adds nothing. */
  auth?: "host" | "none" | GuestAuth;
  timeoutMs?: number;
};

// ---- session state (set by AuthProvider / I18nProvider) ----
let hostToken: string | null = null;
let currentLocale: Locale = "en";
let unauthorizedHandler: (() => void) | null = null;

export function setHostToken(token: string | null) {
  hostToken = token;
}
export function setApiLocale(locale: Locale) {
  currentLocale = locale;
}
export function onUnauthorized(fn: (() => void) | null) {
  unauthorizedHandler = fn;
}

function buildUrl(path: string, query?: RequestOptions["query"]): string {
  const qs = query
    ? Object.entries(query)
        .filter(([, v]) => v !== undefined && v !== null && v !== "")
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join("&")
    : "";
  return `${API_URL}${path}${qs ? `?${qs}` : ""}`;
}

export async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const method = opts.method ?? "GET";
  if (DEMO_MODE) return demoRequest<T>(method, path, opts.body, opts.query);

  const headers: Record<string, string> = { Accept: "application/json", "Accept-Language": currentLocale };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  const auth = opts.auth ?? "host";
  if (auth === "host") {
    if (hostToken) headers.Authorization = `Bearer ${hostToken}`;
  } else if (auth !== "none") {
    if (auth.token) headers["X-Guest-Token"] = auth.token;
    if (auth.pin) headers["X-Occasion-Pin"] = auth.pin;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 30_000);
  let res: Response;
  try {
    res = await fetch(buildUrl(path, opts.query), {
      method,
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: controller.signal,
    });
  } catch {
    throw new ApiError(0, "network_error", "Network request failed");
  } finally {
    clearTimeout(timer);
  }

  const text = await res.text();
  let json: unknown = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
  }

  if (!res.ok) {
    const err = (json as { error?: { code?: string; message?: string } } | null)?.error;
    const apiErr = new ApiError(res.status, err?.code ?? `http_${res.status}`, err?.message ?? res.statusText ?? "Request failed");
    if (res.status === 401 && auth === "host" && hostToken) unauthorizedHandler?.();
    throw apiErr;
  }
  return json as T;
}

const enc = encodeURIComponent;

// ---------------- Auth ----------------
export const authApi = {
  requestCode: (email: string, locale: Locale, brand: Brand) =>
    request<{ ok: true; previewCode?: string }>("/api/v1/auth/request-code", { method: "POST", body: { email, locale, brand }, auth: "none" }),
  verify: (email: string, code: string) =>
    request<{ token: string; host: Host }>("/api/v1/auth/verify", { method: "POST", body: { email, code }, auth: "none" }),
  me: () => request<{ host: Host }>("/api/v1/me"),
  updateMe: (patch: { name?: string; locale?: Locale }) => request<{ host: Host }>("/api/v1/me", { method: "PATCH", body: patch }),
  registerPushToken: (token: string, platform: "ios" | "android") =>
    request<{ ok: true }>("/api/v1/push-tokens", { method: "POST", body: { token, platform } }),
};

// ---------------- Host ----------------
export const hostApi = {
  list: () => request<{ occasions: OccasionSummary[] }>("/api/v1/occasions"),
  create: (body: OccasionCreate) => request<{ occasion: Occasion }>("/api/v1/occasions", { method: "POST", body }),
  get: (id: string) => request<{ occasion: Occasion; stats: Stats }>(`/api/v1/occasions/${enc(id)}`),
  update: (id: string, patch: OccasionPatch) => request<{ occasion: Occasion }>(`/api/v1/occasions/${enc(id)}`, { method: "PATCH", body: patch }),
  remove: (id: string) => request<{ ok: true }>(`/api/v1/occasions/${enc(id)}`, { method: "DELETE" }),

  media: (id: string, q: MediaQuery = {}) =>
    request<Page<MediaItem>>(`/api/v1/occasions/${enc(id)}/media`, { query: { ...q, cursor: q.cursor ?? undefined } }),
  mediaAction: (id: string, ids: string[], action: MediaAction) =>
    request<{ ok: true }>(`/api/v1/occasions/${enc(id)}/media`, { method: "PATCH", body: { ids, action } }),

  requestUploads: (id: string, files: UploadFileSpec[]) =>
    request<{ uploads: UploadGrant[] }>(`/api/v1/occasions/${enc(id)}/uploads`, { method: "POST", body: { files } }),
  /**
   * ASSUMPTION: the contract lists host uploads as "same shape as the guest endpoint" but does not
   * name a host complete route. We call the mirror of the guest route.
   */
  completeUploads: (id: string, mediaIds: string[]) =>
    request<{ ok: true }>(`/api/v1/occasions/${enc(id)}/uploads/complete`, { method: "POST", body: { mediaIds } }),

  messages: (id: string) => request<{ messages: Message[] }>(`/api/v1/occasions/${enc(id)}/messages`),

  missions: (id: string) => request<{ missions: Mission[] }>(`/api/v1/occasions/${enc(id)}/missions`),
  addMission: (id: string, title: string) =>
    request<{ missions: Mission[] }>(`/api/v1/occasions/${enc(id)}/missions`, { method: "POST", body: { title } }),
  removeMission: (id: string, missionId: string) =>
    request<{ missions: Mission[] }>(`/api/v1/occasions/${enc(id)}/missions`, { method: "DELETE", query: { missionId } }),

  shareLinks: (id: string) => request<{ links: ShareLink[] }>(`/api/v1/occasions/${enc(id)}/share-links`),
  createShareLink: (id: string, body: { label?: string; scope: string }) =>
    request<{ links: ShareLink[] }>(`/api/v1/occasions/${enc(id)}/share-links`, { method: "POST", body }),

  checkout: (id: string, plan: "tek" | "buyuk") =>
    request<{ url: string }>(`/api/v1/occasions/${enc(id)}/checkout`, { method: "POST", body: { plan } }),
};

// ---------------- Organisations (venues / Partner plan) ----------------
/**
 * PROVISIONAL: announced under /api/v1/organisations but not yet in docs/API.md.
 * A 404 (route not deployed yet) is treated as "no organisations".
 */
export const orgApi = {
  list: async (): Promise<Organisation[]> => {
    try {
      return (await request<{ organisations: Organisation[] }>("/api/v1/organisations")).organisations ?? [];
    } catch (e) {
      if (e instanceof ApiError && (e.status === 404 || e.status === 405)) return [];
      throw e;
    }
  },
  occasions: (orgId: string) => request<{ occasions: OccasionSummary[] }>(`/api/v1/organisations/${enc(orgId)}/occasions`),
};

// ---------------- Guest ----------------
export const guestApi = {
  occasion: (slug: string, auth: GuestAuth) => request<{ occasion: PublicOccasion }>(`/api/v1/g/${enc(slug)}`, { auth }),
  join: (slug: string, body: { name: string; consent: true; pin?: string }, auth: GuestAuth = {}) =>
    request<{ guestToken: string; guest: { id: string; displayName: string } }>(`/api/v1/g/${enc(slug)}/join`, { method: "POST", body, auth }),
  feed: (slug: string, auth: GuestAuth, q: { after?: string; cursor?: string | null } = {}) =>
    request<Page<MediaItem>>(`/api/v1/g/${enc(slug)}/feed`, { auth, query: { after: q.after, cursor: q.cursor ?? undefined } }),
  requestUploads: (slug: string, auth: GuestAuth, files: UploadFileSpec[]) =>
    request<{ uploads: UploadGrant[] }>(`/api/v1/g/${enc(slug)}/uploads`, { method: "POST", body: { files }, auth }),
  completeUploads: (slug: string, auth: GuestAuth, mediaIds: string[]) =>
    request<{ ok: true }>(`/api/v1/g/${enc(slug)}/uploads/complete`, { method: "POST", body: { mediaIds }, auth }),
  react: (slug: string, auth: GuestAuth, mediaId: string) =>
    request<{ reacted: boolean; count: number }>(`/api/v1/g/${enc(slug)}/reactions`, { method: "POST", body: { mediaId }, auth }),
  missions: (slug: string, auth: GuestAuth) => request<{ missions: GuestMission[] }>(`/api/v1/g/${enc(slug)}/missions`, { auth }),
  postMessage: (slug: string, auth: GuestAuth, body: { kind: MessageKind; body?: string; mediaKey?: string }) =>
    request<{ message: Message }>(`/api/v1/g/${enc(slug)}/messages`, { method: "POST", body, auth }),
  mine: (slug: string, auth: GuestAuth) => request<{ items: MediaItem[] }>(`/api/v1/g/${enc(slug)}/mine`, { auth }),
  deleteMine: (slug: string, auth: GuestAuth, mediaId: string) =>
    request<{ ok: true }>(`/api/v1/g/${enc(slug)}/mine`, { method: "DELETE", auth, query: { mediaId } }),
};

export type { GuestAuth };

/** Maps an error to a user-facing i18n key. */
export function errorKey(e: unknown): "errors.network" | "errors.session" | "errors.notFound" | "errors.generic" {
  if (e instanceof ApiError) {
    if (e.isNetwork) return "errors.network";
    if (e.status === 401) return "errors.session";
    if (e.status === 404) return "errors.notFound";
  }
  return "errors.generic";
}

/** Server message if it sent a human-readable one, else the generic key's text. */
export function errorMessage(e: unknown, t: (k: ReturnType<typeof errorKey>) => string): string {
  if (e instanceof ApiError && e.status >= 400 && e.status < 500 && e.status !== 401 && e.status !== 404 && e.message && !e.message.startsWith("http_")) {
    return e.message;
  }
  return t(errorKey(e));
}
