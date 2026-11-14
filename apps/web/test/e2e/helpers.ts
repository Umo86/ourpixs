/**
 * Shared e2e helpers: fake clock, database access, captured emails, sign-in, API uploads, page checks, screenshots.
 * TEST ONLY (see docs/TESTING.md).
 */
import { expect, type APIRequestContext, type Browser, type BrowserContext, type Page, type TestInfo } from "@playwright/test";
import { createHmac } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";
import { ADMIN_EMAIL, BASE, DB_URL, STRIPE_PORT, paths, secrets } from "../harness/env.mjs";

export { ADMIN_EMAIL, BASE, paths, secrets };
export const FIX = join(__dirname, "../fixtures/generated");
export const DAY = 86_400_000;
export const STRIPE = `http://127.0.0.1:${STRIPE_PORT}`;

// ── Database ────────────────────────────────────────────────────────────────────────────────────

let pool: pg.Pool | null = null;
export function db() {
  pool ??= new pg.Pool({ connectionString: DB_URL, max: 3 });
  return pool;
}
export async function q<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  return (await db().query(sql, params)).rows as T[];
}
export async function one<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T> {
  const r = await q<T>(sql, params);
  expect(r.length, `expected one row: ${sql}`).toBeGreaterThan(0);
  return r[0]!;
}

// ── Fake clock (server process, storage server, fake Stripe and PostgreSQL now()) ────────────────────

let clockOffset = 0;
const contexts = new Set<BrowserContext>();
/** Installs the fake clock in a browser context (call before its first page) so it follows setClock. */
export async function trackClock(c: BrowserContext) {
  await c.clock.install({ time: clockNow() });
  contexts.add(c);
  c.on("close", () => contexts.delete(c));
}
export const clockNow = () => new Date(Date.now() + clockOffset);
/** Moves "now" for every service to `real now + ms` (never backwards within a spec unless reset). */
export async function setClock(ms: number) {
  clockOffset = Math.round(ms);
  // Browsers follow the same clock (server-rendered dates and "today" must match after hydration).
  for (const c of contexts) await c.clock.setSystemTime(clockNow()).catch(() => contexts.delete(c));
  writeFileSync(paths.clock, String(clockOffset));
  await q("update testing.clock set offset_ms = $1 where id = 1", [clockOffset]);
  // Rate-limit buckets refill from updated_at; a jump in time must not leave them in the future.
  await q("delete from rate_limits");
  await new Promise((r) => setTimeout(r, 250));
}
export async function travelTo(when: Date) {
  await setClock(when.getTime() - Date.now());
}
export async function resetClock() {
  await setClock(0);
}

// ── Captured emails ───────────────────────────────────────────────────────────────────────────

export type Mail = { file: string; from: string; to: string; subject: string; html: string; text: string; headers: Record<string, string> };
export function emails(to?: string): Mail[] {
  let files: string[] = [];
  // Oldest first by real write time (file names carry the fake clock's time, which jumps around between specs).
  try {
    files = readdirSync(paths.emails).filter((f) => f.endsWith(".json"))
      .map((f) => ({ f, t: statSync(join(paths.emails, f)).mtimeMs })).sort((a, b) => a.t - b.t).map((x) => x.f);
  } catch { return []; }
  return files.map((f) => ({ file: f, ...JSON.parse(readFileSync(join(paths.emails, f), "utf8")) }))
    .filter((m: Mail) => !to || m.to.toLowerCase() === to.toLowerCase());
}
export async function waitForEmail(to: string, match: RegExp, timeout = 20_000): Promise<Mail> {
  const end = Date.now() + timeout;
  for (;;) {
    const m = emails(to).reverse().find((x) => match.test(x.subject) || match.test(x.text));
    if (m) return m;
    if (Date.now() > end) throw new Error(`no email to ${to} matching ${match} (have: ${emails(to).map((x) => x.subject).join(" | ")})`);
    await new Promise((r) => setTimeout(r, 300));
  }
}

// ── Crons ─────────────────────────────────────────────────────────────────────────────────────

export async function cron(request: APIRequestContext, name: "expiry" | "cleanup" | "media"): Promise<Record<string, unknown>> {
  const r = await request.get(`${BASE}/api/cron/${name}`, { headers: { Authorization: `Bearer ${secrets.CRON_SECRET}` } });
  expect(r.status(), `cron ${name}`).toBe(200);
  return r.json();
}

// ── Fake Stripe controls ───────────────────────────────────────────────────────────────────────

export async function stripeSessions(request: APIRequestContext): Promise<Array<{ id: string; status: string; amount_total: number; metadata?: Record<string, string> }>> {
  return (await request.get(`${STRIPE}/test/sessions`)).json();
}
export async function stripeRefund(request: APIRequestContext, sessionId: string, amount?: number) {
  const r = await request.post(`${STRIPE}/test/refund`, { data: { session: sessionId, ...(amount ? { amount } : {}) } });
  expect(r.ok()).toBeTruthy();
  const body = await r.json();
  expect(body.webhook.status, `refund webhook: ${body.webhook.body}`).toBe(200);
  return body;
}

// ── Sign-in ───────────────────────────────────────────────────────────────────────────────────

/** UI sign-in with the code shown on screen (PREVIEW_SHOW_CODE) and cross-checked against the captured email. */
export async function signInUI(page: Page, email: string, opts: { marketing?: boolean; shot?: (n: string) => Promise<void> } = {}) {
  await page.goto("/login");
  await page.locator("#email").fill(email);
  if (opts.marketing) await page.getByRole("checkbox").check();
  await opts.shot?.("login-email");
  await page.locator("form button[type=submit]").click();
  const codeInput = page.locator("#code");
  await expect(codeInput).toBeVisible();
  const shown = (await page.locator("span.font-black").filter({ hasText: /^\d{6}$/ }).first().textContent())!.trim();
  const mail = await waitForEmail(email, new RegExp(shown));
  expect(mail.text).toContain(shown);
  await opts.shot?.("login-code");
  await codeInput.fill(shown);
  await page.locator("form button[type=submit]").click();
  await page.waitForURL(/\/dashboard/);
}

/** API sign-in: returns the bearer token (the cookie is set on the request context too). */
export async function signInApi(request: APIRequestContext, email: string, locale: "en" | "tr" = "en"): Promise<string> {
  const r = await request.post(`${BASE}/api/v1/auth/request-code`, { data: { email, locale } });
  expect(r.status(), await r.text()).toBe(200);
  const { previewCode } = await r.json();
  const v = await request.post(`${BASE}/api/v1/auth/verify`, { data: { email, code: previewCode } });
  expect(v.status(), await v.text()).toBe(200);
  return (await v.json()).token;
}
export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

// ── Uploads through the API (presign → PUT to local storage → complete) ───────────────────────────────

export type UpFile = { path: string; mime: string; kind: "photo" | "video"; durationS?: number; width?: number; height?: number };
export async function apiUpload(request: APIRequestContext, base: string, headers: Record<string, string>, files: UpFile[]): Promise<{ status: number; body: { error?: { code: string } } & Record<string, unknown>; mediaIds: string[] }> {
  const body = {
    files: files.map((f, i) => ({
      clientId: `c${i}-${Math.random().toString(36).slice(2)}`, name: f.path.split("/").pop(), mime: f.mime, bytes: statSync(f.path).size, kind: f.kind,
      durationS: f.durationS, width: f.width, height: f.height, hasDisplay: false, hasThumb: false,
    })),
  };
  const r = await request.post(`${base}/uploads`, { headers, data: body });
  const json = await r.json().catch(() => ({}));
  if (r.status() !== 200) return { status: r.status(), body: json, mediaIds: [] };
  for (const [i, u] of json.uploads.entries()) {
    const put = await request.put(u.original.url, { headers: u.original.headers, data: readFileSync(files[i]!.path) });
    expect(put.status(), `PUT ${u.original.url}`).toBe(200);
  }
  const mediaIds = json.uploads.map((u: { mediaId: string }) => u.mediaId);
  const c = await request.post(`${base}/uploads/complete`, { headers, data: { mediaIds } });
  expect(c.status(), await c.text()).toBe(200);
  return { status: 200, body: await c.json(), mediaIds };
}

export async function waitProcessed(ids: string[], timeout = 180_000) {
  const end = Date.now() + timeout;
  for (;;) {
    const rows = await q<{ id: string; processing_status: string; processing_error: string | null }>(
      "select id, processing_status, processing_error from media where id = any($1)", [ids]);
    if (rows.length === ids.length && rows.every((r) => r.processing_status !== "pending")) {
      for (const r of rows) expect(r.processing_status, `${r.id}: ${r.processing_error}`).toBe("ready");
      return;
    }
    if (Date.now() > end) throw new Error(`processing timed out: ${JSON.stringify(rows)}`);
    await new Promise((r) => setTimeout(r, 1000));
  }
}

// ── Unsubscribe token (same HMAC as src/lib/consent.ts) ─────────────────────────────────────────────

export function unsubscribeToken(consentId: string) {
  return createHmac("sha256", "e2e-unsubscribe-secret-0123456789").update(`unsub:${consentId}`).digest("base64url");
}

// ── Page checks and screenshots ──────────────────────────────────────────────────────────────────

/** Collects console errors, page errors and 5xx responses of a page; `assertClean` fails on any. */
export function watch(page: Page) {
  const problems: string[] = [];
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const t = m.text();
    // Fonts are mocked offline (fonts.gstatic.com unreachable in the sandbox) and expected 4xx answers log a resource error.
    if (/fonts\.gstatic|Failed to load resource: the server responded with a status of 4\d\d/.test(t)) return;
    problems.push(`console: ${t}`);
  });
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  page.on("response", (r) => { if (r.status() >= 500) problems.push(`HTTP ${r.status()} ${r.url()}`); });
  return {
    problems,
    assertClean() { expect(problems, problems.join("\n")).toEqual([]); },
  };
}

/**
 * Layout findings (overflow, small tap targets) are collected here instead of stopping the serial flow; every spec ends
 * with `assertLayout()`, which fails if anything was found.
 */
export const layoutIssues: string[] = [];
export function assertLayout() {
  expect(layoutIssues, layoutIssues.join("\n")).toEqual([]);
}

/** html lang matches, nothing overflows horizontally (also at 360 px), primary buttons are ≥ 44 px tall. */
export async function checkPage(page: Page, lang: "en" | "tr", opts: { narrow?: boolean; tapTargets?: boolean } = {}) {
  // Let hydration and late requests finish before measuring (and before the 360 px resize).
  await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});
  await expect(page.locator("html")).toHaveAttribute("lang", lang);
  const overflow = async () => page.evaluate(() => {
    const w = document.documentElement.clientWidth;
    const offenders: string[] = [];
    for (const el of Array.from(document.querySelectorAll("body *"))) {
      const r = (el as HTMLElement).getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      // Fixed overlays (cookie notice, dialogs) are listed only if they themselves overflow.
      let fixedAncestor = false;
      for (let p = (el as HTMLElement).parentElement; p; p = p.parentElement) if (getComputedStyle(p).position === "fixed") { fixedAncestor = true; break; }
      if (fixedAncestor || getComputedStyle(el as HTMLElement).position === "fixed") continue;
      if (r.right > w + 1 && !(el as HTMLElement).closest("[data-scroll-x], .overflow-x-auto, .overflow-x-scroll, .overflow-hidden")) {
        offenders.push(`${el.tagName.toLowerCase()}.${String((el as HTMLElement).className).slice(0, 60)} → ${Math.round(r.right)}`);
      }
    }
    return { scroll: document.documentElement.scrollWidth, w, offenders: offenders.slice(0, 5) };
  });
  const o = await overflow();
  if (o.scroll > o.w + 1) layoutIssues.push(`horizontal overflow at ${o.w}px on ${page.url()}: ${o.offenders.join(", ")}`);
  if (opts.narrow !== false) {
    const vp = page.viewportSize()!;
    await page.setViewportSize({ width: 360, height: vp.height });
    await page.waitForTimeout(150);
    const n = await overflow();
    await page.setViewportSize(vp);
    if (n.scroll > 361) layoutIssues.push(`horizontal overflow at 360px on ${page.url()}: ${n.offenders.join(", ")}`);
  }
  if (opts.tapTargets !== false) {
    const small = await page.evaluate(() => Array.from(document.querySelectorAll("main button:not([disabled]), main a.rounded-full, main [role=button]"))
      .map((el) => ({ el, r: (el as HTMLElement).getBoundingClientRect() }))
      // A control inside a <label> is hit through the whole label row: measure that.
      .map(({ el, r }) => ({ el, r: el.closest("label") ? el.closest("label")!.getBoundingClientRect() : r }))
      .filter(({ el, r }) => r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden" && r.height < 43.5 && String(el.getAttribute("class")).includes("rounded-full"))
      .map(({ el, r }) => `${(el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 30)} (${Math.round(r.width)}×${Math.round(r.height)})`));
    if (small.length) layoutIssues.push(`tap targets < 44 px on ${page.url()}: ${small.join(", ")}`);
  }
}

/** Full-page screenshots in visiting order: /tmp/e2e-shots/<device>/<NNN>-<prefix>-<name>.png (NNN counts per device). */
const shotCounter = new Map<string, number>();
export function shooter(page: Page, info: TestInfo, prefix: string) {
  const dir = join(paths.shots, info.project.name);
  mkdirSync(dir, { recursive: true });
  return async (name: string) => {
    const n = (shotCounter.get(dir) ?? 0) + 1;
    shotCounter.set(dir, n);
    await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
    await page.screenshot({ path: join(dir, `${String(n).padStart(3, "0")}-${prefix}-${name}.png`), fullPage: true });
  };
}

export async function newMobileContext(browser: Browser, info: TestInfo, opts: { locale?: "en" | "tr" } = {}): Promise<BrowserContext> {
  const u = info.project.use;
  const c = await browser.newContext({
    timezoneId: opts.locale === "tr" ? "Europe/Istanbul" : "Europe/London",
    viewport: u.viewport, userAgent: u.userAgent, deviceScaleFactor: u.deviceScaleFactor, isMobile: u.isMobile, hasTouch: u.hasTouch,
    baseURL: BASE, acceptDownloads: true,
    locale: opts.locale === "tr" ? "tr-TR" : "en-GB",
    extraHTTPHeaders: { "Accept-Language": opts.locale === "tr" ? "tr-TR,tr;q=0.9" : "en-GB,en;q=0.9" },
  });
  await trackClock(c);
  return c;
}

/** A unique email per run and project. */
export function uniqueEmail(info: TestInfo, who: string) {
  return `${who}-${info.project.name}-${Date.now().toString(36)}@e2e.test`;
}
