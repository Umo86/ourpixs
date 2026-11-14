/**
 * Admin and consent flows: the ADMIN_EMAILS user signs in and sees payments, consents (CSV), storage per event; a price
 * change reaches the pricing page and Checkout; suspending a host closes the gallery and the wall; unsubscribe page
 * (GET shows a confirmation, POST unsubscribes) and the RFC 8058 one-click POST.
 */
import { test, expect, type APIRequestContext, type BrowserContext, type Page } from "@playwright/test";
import { join } from "node:path";
import {
  ADMIN_EMAIL, BASE, FIX, apiUpload, assertLayout, bearer, checkPage, newMobileContext, one, q, resetClock, shooter, signInApi, signInUI,
  stripeSessions, travelTo, uniqueEmail, unsubscribeToken, watch,
} from "./helpers";

test.describe.configure({ mode: "serial" });
let api: APIRequestContext;
let admin: BrowserContext, page: Page;
let hostToken: string, hostEmail: string, occasionId: string, slug: string, wallKey: string;
let lang: "en" | "tr";

test.beforeAll(async ({ browser, playwright }, info) => {
  await resetClock();
  lang = info.project.name === "pixel7" ? "tr" : "en";
  api = await playwright.request.newContext({ baseURL: BASE });
  admin = await newMobileContext(browser, info, { locale: lang });
  page = await admin.newPage();
  // A live, paid event with one guest upload and a guest who opted in to marketing.
  hostEmail = uniqueEmail(info, "admin-host");
  hostToken = await signInApi(api, hostEmail);
  const startsOn = new Date().toISOString().slice(0, 10);
  const r = await api.post("/api/v1/occasions", { headers: bearer(hostToken), data: { type: "nisan", title: "Admin test", honorees: ["Elif", "Can"], startsOn } });
  const o = (await r.json()).occasion;
  occasionId = o.id; slug = o.slug; wallKey = new URL(o.wallUrl).searchParams.get("k")!;
  const c = await api.post(`/api/v1/occasions/${occasionId}/checkout`, { headers: bearer(hostToken), data: {} });
  await api.post((await c.json()).url, { form: { email: "" }, maxRedirects: 0 });
  await travelTo(new Date(new Date(o.package.opensAt).getTime() + 3600_000));
  const j = await api.post(`/api/v1/g/${slug}/join`, { data: { name: "Deniz", consent: true } });
  const gt = (await j.json()).guestToken;
  await apiUpload(api, `${BASE}/api/v1/g/${slug}`, { "X-Guest-Token": gt }, [{ path: join(FIX, "photo-2.jpg"), mime: "image/jpeg", kind: "photo" }]);
  await api.post(`/api/v1/g/${slug}/contact`, { headers: { "X-Guest-Token": gt }, data: { email: `deniz-${info.project.name}@e2e.test`, marketing: true, locale: lang } });
});

test.afterAll(async () => {
  await admin?.close();
  await api?.dispose();
  await resetClock();
});

test("non-admins get 404 on /admin and /api/admin", async () => {
  expect((await api.get("/admin")).status()).toBe(404);
  expect((await api.get("/api/admin/consents/export", { headers: bearer(hostToken) })).status()).toBe(404);
  const anon = await api.get("/admin/payments", { headers: { Cookie: "" } });
  expect(anon.status()).toBe(404);
});

test("admin: sign in, overview, payments, events with storage, consents + CSV export", async ({}, info) => {
  const w = watch(page);
  const shot = shooter(page, info, `admin-${lang}`);
  await signInUI(page, ADMIN_EMAIL);
  for (const [path, name] of [["/admin", "overview"], ["/admin/payments", "payments"], ["/admin/events", "events"], [`/admin/events/${occasionId}`, "event"],
    ["/admin/users", "users"], ["/admin/consents", "consents"], ["/admin/settings", "settings"], ["/admin/system", "system"], ["/admin/audit", "audit"],
    ["/admin/moderation", "moderation"], ["/admin/enquiries", "enquiries"]] as const) {
    const r = await page.goto(path);
    expect(r?.status(), path).toBe(200);
    await checkPage(page, lang, { tapTargets: false });
    await shot(name);
  }
  await page.goto("/admin/payments");
  await expect(page.locator("main")).toContainText("£69");
  await page.goto(`/admin/events/${occasionId}`);
  await expect(page.locator("main")).toContainText(/KB|MB|kB/);
  // Consents: the guest's opt-in with the wording, exported as CSV (audited).
  await page.goto("/admin/consents");
  await expect(page.locator("main")).toContainText(`deniz-${info.project.name}@e2e.test`);
  const csv = await page.request.get("/api/admin/consents/export");
  expect(csv.status()).toBe(200);
  expect(csv.headers()["content-type"]).toContain("text/csv");
  const text = await csv.text();
  expect(text).toContain(`deniz-${info.project.name}@e2e.test`);
  const wording = (await one<{ wording: string }>("select wording from marketing_consents where email = $1", [`deniz-${info.project.name}@e2e.test`])).wording;
  expect(text).toContain(wording.split(" ").slice(0, 3).join(" "));
  expect(await q("select 1 from admin_audit where action like 'consents.export%'")).not.toHaveLength(0);
  w.assertClean();
});

test("admin: price change reaches the pricing page and Checkout", async ({}, info) => {
  const adminToken = await signInApi(api, ADMIN_EMAIL);
  const set = await api.patch("/api/admin/settings", { headers: bearer(adminToken), data: { values: { eventPricePence: 7900 }, reason: "e2e price test" } });
  expect(set.status(), await set.text()).toBe(200);
  try {
    await page.goto("/pricing");
    await expect(page.locator("main")).toContainText("£79");
    await expect(page.locator("main")).not.toContainText("£69");
    await shooter(page, info, `admin-${lang}-b`)("pricing-79");
    const token = await signInApi(api, uniqueEmail(info, "price"));
    const startsOn = new Date(Date.now() + 20 * 86_400_000).toISOString().slice(0, 10);
    const o = (await (await api.post("/api/v1/occasions", { headers: bearer(token), data: { type: "dugun", title: "Price", honorees: ["A"], startsOn } })).json()).occasion;
    const c = await api.post(`/api/v1/occasions/${o.id}/checkout`, { headers: bearer(token), data: {} });
    const sid = new URL((await c.json()).url).pathname.split("/").pop();
    const s = (await stripeSessions(api)).find((x) => x.id === sid)!;
    expect(s.amount_total).toBe(7900);
  } finally {
    await api.patch("/api/admin/settings", { headers: bearer(adminToken), data: { values: { eventPricePence: 6900 }, reason: "e2e price reset" } });
  }
});

test("admin: suspending the host closes the gallery and the wall", async ({}, info) => {
  const g0 = await (await api.get(`/api/v1/g/${slug}`)).json();
  expect(g0.occasion.galleryState).toBe("live");
  expect((await api.get(`/api/v1/wall/${slug}?k=${wallKey}`)).status()).toBe(200);
  const adminToken = await signInApi(api, ADMIN_EMAIL);
  const hostId = (await one<{ id: string }>("select id from hosts where email = $1", [hostEmail])).id;
  const s = await api.post(`/api/admin/users/${hostId}`, { headers: bearer(adminToken), data: { action: "suspend", reason: "e2e suspension" } });
  expect(s.status(), await s.text()).toBe(200);
  try {
    const g = await (await api.get(`/api/v1/g/${slug}`)).json();
    expect(g.occasion.galleryState).toBe("unavailable");
    expect((await api.post(`/api/v1/g/${slug}/join`, { data: { name: "Late", consent: true } })).status()).toBe(410);
    expect((await api.get(`/api/v1/wall/${slug}?k=${wallKey}`)).status()).toBe(410);
    const guest = await page.context().browser()!.newContext({ viewport: page.viewportSize()!, locale: lang === "tr" ? "tr-TR" : "en-GB", extraHTTPHeaders: { "Accept-Language": lang } });
    const gp = await guest.newPage();
    await gp.goto(`${BASE}/g/${slug}`);
    await expect(gp.locator("#g-name")).toHaveCount(0);
    await shooter(gp, info, `admin-${lang}-c`)("guest-suspended");
    await gp.goto(`${BASE}/wall/${slug}?k=${wallKey}`);
    await shooter(gp, info, `admin-${lang}-c`)("wall-suspended");
    await guest.close();
    // The host can't sign in.
    const rc = await api.post("/api/v1/auth/request-code", { data: { email: hostEmail } });
    const v = await api.post("/api/v1/auth/verify", { data: { email: hostEmail, code: (await rc.json()).previewCode } });
    expect(v.status()).toBe(403);
    expect((await v.json()).error.code).toBe("account_suspended");
  } finally {
    await api.post(`/api/admin/users/${hostId}`, { headers: bearer(adminToken), data: { action: "unsuspend", reason: "e2e done" } });
  }
});

test("unsubscribe: GET shows a confirmation only, POST unsubscribes; one-click POST works", async ({}, info) => {
  // Consent 1: host signs in with the separate marketing box ticked (UI).
  const ctx = await newMobileContext(page.context().browser()!, info, { locale: lang });
  const p = await ctx.newPage();
  const w = watch(p);
  const email = uniqueEmail(info, "optin");
  await signInUI(p, email, { marketing: true });
  const c1 = await one<{ id: string; wording: string; source: string; withdrawn_at: Date | null }>("select id, wording, source, withdrawn_at from marketing_consents where email = $1", [email]);
  expect(c1.withdrawn_at).toBeNull();
  const shot = shooter(p, info, `unsubscribe-${lang}`);
  await p.goto(`/unsubscribe/${unsubscribeToken(c1.id)}`);
  await checkPage(p, lang);
  await shot("confirm");
  expect((await one<{ w: Date | null }>("select withdrawn_at w from marketing_consents where id = $1", [c1.id])).w).toBeNull();
  await p.locator("main form button").click();
  await p.waitForURL(/\/unsubscribe\//);
  await shot("done");
  expect((await one<{ w: Date | null }>("select withdrawn_at w from marketing_consents where id = $1", [c1.id])).w).not.toBeNull();
  // Consent 2 (dashboard toggle on again) → one-click POST.
  const on = await p.request.put("/api/v1/me/marketing", { data: { consented: true, locale: lang } });
  expect(on.status(), await on.text()).toBe(200);
  const c2 = await one<{ id: string }>("select id from marketing_consents where email = $1 and withdrawn_at is null", [email]);
  const oneClick = await api.post(`/api/v1/unsubscribe/${unsubscribeToken(c2.id)}`, { form: { "List-Unsubscribe": "One-Click" } });
  expect(oneClick.status()).toBe(200);
  expect((await one<{ w: Date | null }>("select withdrawn_at w from marketing_consents where id = $1", [c2.id])).w).not.toBeNull();
  w.assertClean();
  await ctx.close();
});

test("layout: no horizontal overflow (also at 360 px), tap targets ≥ 44 px", () => assertLayout());
