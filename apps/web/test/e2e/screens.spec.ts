/**
 * Every screen, EN and TR, on the phone: correct <html lang>, no console errors / 5xx, no horizontal overflow (also at
 * 360 px), tap targets ≥ 44 px, plus a full-page screenshot for the design review (/tmp/e2e-shots/<device>/screens-*).
 * Also: the Our Pixs brand on ourpixs.com, 404s, and the PWA (manifests, icons, iOS tags, no service worker).
 */
import { test, expect, type APIRequestContext } from "@playwright/test";
import { join } from "node:path";
import sharp from "sharp";
import {
  BASE, FIX, apiUpload, assertLayout, bearer, checkPage, newMobileContext, resetClock, shooter, signInApi, travelTo, uniqueEmail, watch,
} from "./helpers";

test.describe.configure({ mode: "serial" });
const MARKETING = ["/", "/features", "/pricing", "/help", "/guides", "/guides/how-to-collect-wedding-photos-from-guests", "/templates", "/for/wedding",
  "/compare", "/privacy", "/terms", "/credits", "/support", "/demo", "/login", "/g/demo", "/no-such-page", "/g/no-such-event"];

let api: APIRequestContext;
let hostToken: string, occasionId: string, slug: string, wallPath: string, sharePath: string, guestToken: string;

test.beforeAll(async ({ playwright }, info) => {
  await resetClock();
  api = await playwright.request.newContext({ baseURL: BASE });
  // A live event with a few uploads, a share link and a guest, for the signed-in screens.
  hostToken = await signInApi(api, uniqueEmail(info, "screens"));
  const startsOn = new Date().toISOString().slice(0, 10);
  const o = (await (await api.post("/api/v1/occasions", { headers: bearer(hostToken), data: { type: "dugun", title: "Selin & Emre", honorees: ["Selin", "Emre"], startsOn, city: "İstanbul", venueName: "Çırağan Sarayı" } })).json()).occasion;
  occasionId = o.id; slug = o.slug; wallPath = new URL(o.wallUrl).pathname + new URL(o.wallUrl).search;
  const c = await api.post(`/api/v1/occasions/${occasionId}/checkout`, { headers: bearer(hostToken), data: {} });
  await api.post((await c.json()).url, { form: { email: "" }, maxRedirects: 0 });
  await travelTo(new Date(new Date(o.package.opensAt).getTime() + 3600_000));
  const j = await (await api.post(`/api/v1/g/${slug}/join`, { data: { name: "Ayla", consent: true } })).json();
  guestToken = j.guestToken;
  await apiUpload(api, `${BASE}/api/v1/g/${slug}`, { "X-Guest-Token": guestToken }, ["photo-1.jpg", "photo-2.jpg", "photo-3.jpg"].map((f) => ({ path: join(FIX, f), mime: "image/jpeg", kind: "photo" as const })));
  await apiUpload(api, `${BASE}/api/v1/occasions/${occasionId}`, bearer(hostToken), [{ path: join(FIX, "video-5s.mp4"), mime: "video/mp4", kind: "video", durationS: 5 }]);
  const sl = await (await api.post(`/api/v1/occasions/${occasionId}/share-links`, { headers: bearer(hostToken), data: { scope: "view", label: "Family" } })).json();
  sharePath = new URL(sl.links?.[0]?.url ?? sl.link?.url ?? sl.url).pathname;
});

test.afterAll(async () => {
  await api?.dispose();
  await resetClock();
});

for (const lang of ["en", "tr"] as const) {
  test(`marketing and public screens (${lang})`, async ({ browser }, info) => {
    const ctx = await newMobileContext(browser, info, { locale: lang });
    const page = await ctx.newPage();
    const w = watch(page);
    const shot = shooter(page, info, `screens-${lang}-public`);
    for (const path of MARKETING) {
      const r = await page.goto(`${path}${path.includes("?") ? "&" : "?"}lang=${lang}`);
      expect(r!.status(), path).toBe(path.includes("no-such") ? 404 : 200);
      await checkPage(page, lang);
      await shot(path === "/" ? "home" : path.replace(/^\//, "").replace(/[/?=&]/g, "_"));
    }
    w.assertClean();
    await ctx.close();
  });

  test(`host screens (${lang})`, async ({ browser }, info) => {
    const ctx = await newMobileContext(browser, info, { locale: lang });
    await ctx.addCookies([{ name: "op_session", value: hostToken, url: BASE }, { name: "lang", value: lang, url: BASE }]);
    const page = await ctx.newPage();
    const w = watch(page);
    const shot = shooter(page, info, `screens-${lang}-host`);
    for (const path of ["/dashboard", "/dashboard/new", `/dashboard/${occasionId}`, `/dashboard/${occasionId}/qr`, `/dashboard/${occasionId}/download`,
      `/dashboard/${occasionId}/guestbook`, `/dashboard/${occasionId}/missions`, `/dashboard/${occasionId}/settings`, "/account/delete"]) {
      const r = await page.goto(path);
      expect(r!.status(), path).toBe(200);
      await checkPage(page, lang);
      await shot(path.replace(occasionId, "event").replace(/^\//, "").replace(/\//g, "_"));
    }
    // The host's guest list counts each guest's uploads (correlated subquery regression).
    const guests = await (await api.get(`/api/v1/occasions/${occasionId}/guests`, { headers: bearer(hostToken) })).json();
    expect(guests.guests.find((g: { displayName: string }) => g.displayName === "Ayla").uploads).toBe(3);
    // Dashboard cards count media and guests and pick a cover (correlated subqueries, single-table select).
    const list = await (await api.get("/api/v1/occasions", { headers: bearer(hostToken) })).json();
    const card = list.occasions.find((x: { id: string }) => x.id === occasionId);
    expect(card).toMatchObject({ mediaCount: 4, guestCount: 1 });
    expect(card.coverUrl).toBeTruthy();
    // Live wall.
    await page.goto(wallPath);
    await expect(page.locator("html")).toHaveAttribute("lang", lang);
    await shot("wall");
    w.assertClean();
    await ctx.close();
  });

  test(`guest screens (${lang})`, async ({ browser }, info) => {
    const ctx = await newMobileContext(browser, info, { locale: lang });
    await ctx.addCookies([{ name: `op_g_${slug}`, value: guestToken, url: BASE }]);
    const page = await ctx.newPage();
    const w = watch(page);
    const shot = shooter(page, info, `screens-${lang}-guest`);
    for (const path of [`/g/${slug}`, `/g/${slug}/upload`, `/g/${slug}/mine`, `/g/${slug}/missions`, `/g/${slug}/guestbook`, `/g/${slug}/camera`, sharePath]) {
      const r = await page.goto(path);
      expect(r!.status(), path).toBe(200);
      await checkPage(page, lang);
      await shot(path.replace(slug, "event").replace(/^\//, "").replace(/\//g, "_"));
    }
    // The EN/TR switch on a guest page flips the language and keeps it.
    const other = lang === "en" ? "tr" : "en";
    await page.goto(`/g/${slug}`);
    await page.locator(`button[lang=${other}]:visible`).first().click();
    await expect(page.locator("html")).toHaveAttribute("lang", other);
    await page.goto(`/g/${slug}/upload`);
    await expect(page.locator("html")).toHaveAttribute("lang", other);
    await shot("after-switch");
    w.assertClean();
    await ctx.close();
  });
}

test("Our Pixs on ourpixs.com: brand name, English by default, its own manifest", async ({ browser }, info) => {
  const ctx = await browser.newContext({ viewport: info.project.use.viewport, isMobile: true, extraHTTPHeaders: { "Accept-Language": "tr-TR,tr;q=0.9" } });
  const page = await ctx.newPage();
  const shot = shooter(page, info, "screens-ourpixs");
  const host = `http://ourpixs.com:${new URL(BASE).port}`;
  await page.goto(`${host}/`);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator("header")).toContainText("Our Pixs");
  await shot("home");
  await page.goto(`${host}/pricing`);
  await shot("pricing");
  // Through the browser (Playwright's API client doesn't use Chromium's host mapping).
  const m = await page.evaluate(async () => (await fetch("/manifest.webmanifest")).json());
  expect(m.name).toBe("Our Pixs");
  expect(m.icons[0].src).toContain("/icons/ourpixs/");
  await ctx.close();
});

test("PWA: valid manifests, icons load, iOS tags, guest galleries start in the gallery, no service worker", async ({ browser }, info) => {
  const res = await api.get("/manifest.webmanifest");
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("manifest+json");
  const m = await res.json();
  expect(m).toMatchObject({ name: "BizimResimler", short_name: "BizimResimler", start_url: "/", scope: "/", display: "standalone", theme_color: "#0A0A0A", background_color: "#0A0A0A" });
  const sizes = new Set<string>();
  for (const icon of m.icons) {
    const r = await api.get(icon.src);
    expect(r.status(), icon.src).toBe(200);
    expect(r.headers()["content-type"]).toBe("image/png");
    const meta = await sharp(await r.body()).metadata();
    expect(`${meta.width}x${meta.height}`).toBe(icon.sizes);
    sizes.add(`${icon.sizes}:${icon.purpose}`);
  }
  expect([...sizes].sort()).toEqual(["192x192:any", "512x512:any", "512x512:maskable"]);
  // Guest gallery manifest.
  const g = await (await api.get(`/g/${slug}/manifest.webmanifest`)).json();
  expect(g).toMatchObject({ start_url: `/g/${slug}`, scope: `/g/${slug}`, display: "standalone", name: "Selin & Emre" });
  // Tags in the pages.
  const ctx = await newMobileContext(browser, info, { locale: "en" });
  const page = await ctx.newPage();
  for (const [path, manifest] of [["/", "/manifest.webmanifest"], [`/g/${slug}`, `/g/${slug}/manifest.webmanifest`]] as const) {
    await page.goto(path);
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", manifest);
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute("href", /\/icons\/bizimresimler\/apple-touch-icon\.png/);
    await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute("content", "yes");
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#0A0A0A");
    const touch = await api.get("/icons/bizimresimler/apple-touch-icon.png");
    expect((await sharp(await touch.body()).metadata()).width).toBe(180);
    const sw = await page.evaluate(async () => ("serviceWorker" in navigator ? (await navigator.serviceWorker.getRegistrations()).length : 0));
    expect(sw).toBe(0);
  }
  await ctx.close();
});

test("layout: no horizontal overflow (also at 360 px), tap targets ≥ 44 px", () => assertLayout());
