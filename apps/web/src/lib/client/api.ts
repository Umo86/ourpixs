"use client";

export class ApiClientError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

/** Same-origin JSON fetch (cookies carry host/guest auth). Throws ApiClientError with the server's error code. */
export async function api<T>(path: string, opts: { method?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  if (path.startsWith("/api/v1/g/demo/")) {
    const { demoApi } = await import("./demo-api");
    return demoApi<T>(path, opts);
  }
  let res: Response;
  try {
    res = await fetch(path, {
      method: opts.method || (opts.body !== undefined ? "POST" : "GET"),
      headers: opts.body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      credentials: "same-origin",
      cache: "no-store",
      signal: opts.signal,
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new ApiClientError(0, "offline", "Network error");
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = (data as { error?: { code?: string; message?: string } } | null)?.error;
    throw new ApiClientError(res.status, err?.code || "server_error", err?.message || res.statusText);
  }
  return data as T;
}

/** Maps an error to translated copy: t("errors.<code>") or the generic message. */
export function errorMessage(t: (k: string) => string, e: unknown): string {
  const code = e instanceof ApiClientError ? e.code : "server_error";
  const v = t(`errors.${code}`);
  return v === `errors.${code}` ? t("errors.generic") : v;
}
