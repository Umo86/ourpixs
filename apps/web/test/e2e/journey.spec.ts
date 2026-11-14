/**
 * The whole product, end to end, on a phone: host signs up and pays, guests join, upload, opt in and buy, the gallery
 * ends, the host downloads, refunds and deletes, and the crons clean up behind them (with the fake clock).
 * Languages: iphone14 → host English, guest Turkish (Accept-Language); pixel7 → host Turkish (EN/TR switch), guest English.
 */
import { test, expect, type APIRequestContext, type BrowserContext, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PDFDocument } from "pdf-lib";
import sharp from "sharp";
import {
  BASE, DAY, FIX, apiUpload, assertLayout, bearer, checkPage, clockNow, cron, newMobileContext, one, q, resetClock, shooter,
  signInUI, STRIPE, stripeRefund, stripeSessions, travelTo, uniqueEmail, waitForEmail, waitProcessed, watch, paths,
} from "./helpers";

test.describe.configure({ mode: "serial" });

type Lang = "en" | "tr";
let hostLang: Lang, guestLang: Lang;
let hostEmail: string, hostToken: string, occasionId: string, slug: string, guestUrl: string, wallUrl: string;
let opensAt: Date, closesAt: Date;
let host: BrowserContext, hostPage: Page;
let guestA: BrowserContext, guestAPage: Page, guestAToken: string, guestAId: string;
let guestB: BrowserContext, guestBPage: Page;
let guestAMedia: string[] = [];
let hostMedia: string[] = [];
let purchaseSession: string, downloadLink: string;
let api: APIRequestContext;

const msgs = (lang: Lang, ns: string) => JSON.parse(readFileSync(join(__dirname, `../../src/messages/${lang}/${ns}.json`), "utf8"));
const get = (o: Record<string, unknown>, path: string) => path.split(".").reduce<unknown>((a, k) => (a as Record<string, unknown>)?.[k], o) as string;

test.beforeAll(async ({ browser, playwright }, info) => {
  await resetClock();
  hostLang = info.project.name === "pixel7" ? "tr" : "en";
  guestLang = hostLang === "en" ? "tr" : "en";
  hostEmail = uniqueEmail(info, "host");
  // The host's phone is English; the Pixel 7 host switches to Turkish with the EN/TR switch.
  host = await newMobileContext(browser, info, { locale: "en" });
  await host.addInitScript(() => { delete (window as unknown as { showSaveFilePicker?: unknown }).showSaveFilePicker; });
  hostPage = await host.newPage();
  api = await playwright.request.newContext({ baseURL: BASE });
});

test.afterAll(async () => {
  await host?.close();
  await guestA?.close();
  await guestB?.close();
  await api?.dispose();
  await resetClock();
});

test("host: landing → pricing → start free → sign in", async ({}, info) => {
  const page = hostPage;
  const w = watch(page);
  const shot = shooter(page, info, `host-${hostLang}`);
  await page.goto("/");
  if (hostLang === "tr") {
    // On a phone the EN/TR switch sits in the header menu.
    await page.locator("header button[aria-expanded]").first().click();
    await page.locator("button[lang=tr]:visible").first().click();
    await page.waitForLoadState("load");
    await expect(page.locator("html")).toHaveAttribute("lang", "tr");
  }
  await checkPage(page, hostLang);
  await shot("landing");
  await page.goto("/pricing");
  await checkPage(page, hostLang);
  await expect(page.locator("main")).toContainText("£69");
  await shot("pricing");
  // "Start free" leads to sign-in (then the wizard).
  const start = page.locator("main a[href*='/dashboard/new'], main a[href*='/login']").first();
  await start.click();
  await page.waitForURL(/\/login/);
  await checkPage(page, hostLang);
  await signInUI(page, hostEmail, { shot });
  hostToken = (await host.cookies()).find((c) => c.name === "op_session")!.value;
  expect(hostToken).toBeTruthy();
  // No marketing tick → no consent row.
  expect(await q("select 1 from marketing_consents where email = $1", [hostEmail])).toHaveLength(0);
  w.assertClean();
});

test("host: create an event with the wizard (gallery window)", async ({}, info) => {
  const page = hostPage;
  const w = watch(page);
  const shot = shooter(page, info, `host-${hostLang}`);
  await page.goto("/dashboard/new");
  await checkPage(page, hostLang);
  await shot("wizard-type");
  await page.locator("main button[aria-pressed]").first().click();
  await page.locator("#name-0").fill("Ayşe");
  if (await page.locator("#name-1").count()) await page.locator("#name-1").fill("Mehmet");
  await shot("wizard-names");
  await page.locator("form button[type=submit]").click();
  const date = new Date(Date.now() + 10 * DAY).toISOString().slice(0, 10);
  await page.locator("#date").fill(date);
  await page.locator("#city").fill("London");
  await page.locator("#venue").fill("The Savoy");
  await checkPage(page, hostLang);
  await shot("wizard-details-window");
  await page.locator("form button[type=submit]").click();
  await shot("wizard-theme");
  await page.locator("main button.self-start").last().click();
  await expect(page.locator("main code")).toContainText("/g/");
  await checkPage(page, hostLang);
  await shot("wizard-done");
  const o = await one<{ id: string; slug: string; opens_at: Date; closes_at: Date; package_status: string }>(
    "select o.id, o.slug, o.opens_at, o.closes_at, o.package_status from occasions o join hosts h on h.id = o.owner_id where h.email = $1", [hostEmail]);
  occasionId = o.id; slug = o.slug; opensAt = new Date(o.opens_at); closesAt = new Date(o.closes_at);
  expect(o.package_status).toBe("setup");
  expect(closesAt.getTime() - opensAt.getTime()).toBe(7 * DAY);
  const r = await api.get(`/api/v1/occasions/${occasionId}`, { headers: bearer(hostToken) });
  const body = await r.json();
  guestUrl = body.occasion.guestUrl; wallUrl = body.occasion.wallUrl;
  expect(body.occasion.package.status).toBe("setup");
  expect(body.occasion.deleteAfter).toBeTruthy();
  w.assertClean();
});

test("host: QR studio and A6/A5 PDF cards", async ({}, info) => {
  const page = hostPage;
  const w = watch(page);
  const shot = shooter(page, info, `host-${hostLang}`);
  await page.goto(`/dashboard/${occasionId}/qr`);
  await checkPage(page, hostLang);
  await shot("qr-studio");
  const sizes: Record<string, [number, number]> = { a6: [105, 148], a5: [148, 210] };
  for (const size of ["a6", "a5"] as const) {
    const link = page.locator(`a[href*="cards.pdf"][href*="size=${size}"]`).first();
    let buf: Buffer;
    if (await link.count()) {
      const [dl] = await Promise.all([page.waitForEvent("download"), link.click()]);
      buf = readFileSync((await dl.path())!);
    } else {
      const r = await page.request.get(`/api/v1/occasions/${occasionId}/cards.pdf?size=${size}`);
      expect(r.status()).toBe(200);
      buf = await r.body();
    }
    const pdf = await PDFDocument.load(buf);
    const { width, height } = pdf.getPage(0).getSize();
    const mm = (pt: number) => Math.round((pt / 72) * 25.4);
    expect([mm(width), mm(height)], `${size} page size`).toEqual(sizes[size]);
  }
  w.assertClean();
});

test("host: test-mode uploads (limit 20) and the guest link before paying", async ({ browser }, info) => {
  const page = hostPage;
  const w = watch(page);
  const shot = shooter(page, info, `host-${hostLang}`);
  await page.goto(`/dashboard/${occasionId}`);
  await checkPage(page, hostLang);
  const notPaid = msgs(hostLang, "host");
  await expect(page.locator("main")).toContainText(get(notPaid, "package.kicker"));
  await shot("event-setup");
  // Settings while the gallery dates can still change (window editor with the time-zone list).
  await page.goto(`/dashboard/${occasionId}/settings`);
  await expect(page.locator("select").first()).toBeVisible();
  await checkPage(page, hostLang);
  await shot("event-settings-setup");
  await page.goto(`/dashboard/${occasionId}`);
  // Two uploads through the album UI…
  await page.locator("input[type=file]").first().setInputFiles([join(FIX, "photo-1.jpg"), join(FIX, "photo-2.jpg")]);
  await expect.poll(async () => (await q("select count(*)::int n from media where occasion_id = $1 and status = 'uploaded'", [occasionId]))[0]!.n, { timeout: 60_000 }).toBe(2);
  await shot("event-test-uploads");
  // …then 18 more through the API reach the limit of 20; the 21st is refused with test_limit.
  const base = `${BASE}/api/v1/occasions/${occasionId}`;
  const many = Array.from({ length: 18 }, (_, i) => ({ path: join(FIX, `photo-${(i % 4) + 1}.jpg`), mime: "image/jpeg", kind: "photo" as const }));
  const up = await apiUpload(api, base, bearer(hostToken), many);
  expect(up.status).toBe(200);
  hostMedia = up.mediaIds;
  const over = await apiUpload(api, base, bearer(hostToken), [{ path: join(FIX, "photo-3.jpg"), mime: "image/jpeg", kind: "photo" }]);
  expect(over.status).toBe(402);
  expect(over.body.error?.code).toBe("test_limit");
  // Before paying: downloads are only the host's own test uploads.
  const man = await api.get(`${base}/download`, { headers: bearer(hostToken) });
  expect(man.status()).toBe(200);
  expect((await man.json()).files.length).toBe(20);

  // A guest opening the link sees "not open yet" (no join form).
  guestA = await newMobileContext(browser, info, { locale: guestLang });
  guestAPage = await guestA.newPage();
  const gw = watch(guestAPage);
  const gshot = shooter(guestAPage, info, `guest-${guestLang}`);
  await guestAPage.goto(guestUrl.replace(/^https?:\/\/[^/]+/, ""));
  await checkPage(guestAPage, guestLang);
  await expect(guestAPage.locator("#g-name")).toHaveCount(0);
  await expect(guestAPage.locator("main")).toContainText(get(msgs(guestLang, "guest"), "notOpen.title"));
  await gshot("not-open-unpaid");
  const join_ = await api.post(`/api/v1/g/${slug}/join`, { data: { name: "Early", consent: true } });
  expect(join_.status()).toBe(403);
  expect((await join_.json()).error.code).toBe("not_open");
  w.assertClean();
  gw.assertClean();
});

test("host: pays £69 with (fake) Stripe Checkout; webhook marks it paid", async ({}, info) => {
  const page = hostPage;
  const w = watch(page);
  const shot = shooter(page, info, `host-${hostLang}`);
  await page.goto(`/dashboard/${occasionId}`);
  const pay = page.getByRole("button", { name: /£69/ }).first();
  await pay.click();
  await page.waitForURL(/127\.0\.0\.1:\d+\/pay\//);
  await expect(page.locator("#amount")).toHaveAttribute("data-pence", "6900");
  await shot("checkout");
  await page.locator("#pay").click();
  await page.waitForURL(/\/dashboard\/.*paid=1/);
  await expect.poll(async () => (await one<{ s: string }>("select package_status s from occasions where id = $1", [occasionId])).s).toBe("paid");
  const order = await one<{ amount_pence: number; status: string; kind: string; livemode: boolean }>("select amount_pence, status, kind, livemode from orders where occasion_id = $1", [occasionId]);
  expect(order).toMatchObject({ amount_pence: 6900, status: "paid", kind: "event_package", livemode: false });
  await page.reload();
  await checkPage(page, hostLang);
  await shot("event-paid");
  // A replayed webhook changes nothing (idempotent).
  const sessions = await stripeSessions(api);
  const s = sessions.find((x) => x.metadata?.occasionId === occasionId)!;
  expect(s.status).toBe("complete");
  const replay = await api.post(`${STRIPE}/test/webhook`, { data: { session: s.id } });
  expect((await replay.json()).status).toBe(200);
  // A forged webhook is refused.
  const forged = await api.post(`/api/stripe/webhook`, { data: "{}", headers: { "Stripe-Signature": "t=1,v1=bad" } });
  expect(forged.status()).toBe(400);
  expect((await q("select count(*)::int n from orders where occasion_id = $1", [occasionId]))[0]!.n).toBe(1);
  // Paid but not open yet: guests still see "opens on…".
  await guestAPage.reload();
  await expect(guestAPage.locator("main")).toContainText(get(msgs(guestLang, "guest"), "notOpen.title"));
  await shooter(guestAPage, info, `guest-${guestLang}-b`)("opens-on");
  w.assertClean();
});

test("window opens (time travel); guests join, upload, 70 s video refused", async ({ browser }, info) => {
  await travelTo(new Date(opensAt.getTime() + 3600_000));
  const page = guestAPage;
  const w = watch(page);
  const shot = shooter(page, info, `guest-${guestLang}-c`);
  await page.reload();
  await expect(page.locator("#g-name")).toBeVisible();
  await checkPage(page, guestLang);
  await shot("welcome");
  await page.locator("#g-name").fill("Zeynep");
  await page.locator("form input[type=checkbox]").check();
  await page.locator("form button[type=submit]").click();
  await expect.poll(async () => (await q("select 1 from guests where occasion_id = $1 and display_name = 'Zeynep'", [occasionId])).length).toBe(1);
  await expect(page.locator("#g-name")).toHaveCount(0);
  const g = await one<{ id: string }>("select id from guests where occasion_id = $1 and display_name = 'Zeynep'", [occasionId]);
  guestAId = g.id;
  await checkPage(page, guestLang);
  await shot("feed-empty");
  // Upload three photos and a 5-second video through the guest app.
  await page.goto(`/g/${slug}/upload`);
  await checkPage(page, guestLang);
  await shot("upload");
  await page.locator("input[type=file]").setInputFiles([join(FIX, "photo-3.jpg"), join(FIX, "photo-4.jpg"), join(FIX, "photo-5.heic"), join(FIX, "video-5s.mp4")]);
  await expect.poll(async () => (await q("select count(*)::int n from media where guest_id = $1 and status = 'uploaded'", [guestAId]))[0]!.n, { timeout: 120_000 }).toBe(4);
  await shot("upload-done");
  guestAMedia = (await q<{ id: string }>("select id from media where guest_id = $1", [guestAId])).map((r) => r.id);
  // A 70-second video is refused in the browser with the friendly message…
  await page.locator("input[type=file]").setInputFiles([join(FIX, "video-70s.mp4")]);
  const tooLong = get(msgs(guestLang, "guest"), "errors.video_too_long").replace("{seconds}", "60");
  await expect(page.locator("main")).toContainText(tooLong, { timeout: 30_000 });
  await shot("video-too-long");
  // …and by the server.
  const cookie = (await guestA.cookies()).find((c) => c.name.startsWith("op_g_"))!;
  guestAToken = cookie.value;
  const srv = await apiUpload(api, `${BASE}/api/v1/g/${slug}`, { "X-Guest-Token": guestAToken }, [{ path: join(FIX, "video-70s.mp4"), mime: "video/mp4", kind: "video", durationS: 70 }]);
  expect(srv.status).toBe(402);
  expect(srv.body.error?.code).toBe("video_too_long");
  // Processing (real sharp + ffmpeg) finishes for every item.
  await waitProcessed([...guestAMedia, ...hostMedia], 240_000);
  const vid = await one<{ key_video: string; key_guest_video: string; key_guest: string }>("select key_video, key_guest_video, key_guest from media where guest_id = $1 and kind = 'video'", [guestAId]);
  expect(vid.key_video).toMatch(/\.mp4$/);
  expect(vid.key_guest_video).toMatch(/\.mp4$/);
  // Second guest.
  guestB = await newMobileContext(browser, info, { locale: guestLang });
  guestBPage = await guestB.newPage();
  await guestBPage.goto(`/g/${slug}`);
  await guestBPage.locator("#g-name").fill("Ali");
  await guestBPage.locator("form input[type=checkbox]").check();
  await guestBPage.locator("form button[type=submit]").click();
  await expect(guestBPage.locator("#g-name")).toHaveCount(0);
  w.assertClean();
});

test("who sees what: watermarked for others, clean for own / host / wall (ready items only)", async ({}, info) => {
  const shotB = shooter(guestBPage, info, `guest-${guestLang}-d`);
  const bToken = (await guestB.cookies()).find((c) => c.name.startsWith("op_g_"))!.value;
  const feedB = await (await api.get(`/api/v1/g/${slug}/feed`, { headers: { "X-Guest-Token": bToken } })).json();
  const feedA = await (await api.get(`/api/v1/g/${slug}/feed`, { headers: { "X-Guest-Token": guestAToken } })).json();
  const rows = await q<Record<string, string>>("select id, key_original, key_display, key_thumb, key_guest, key_guest_thumb, key_video, key_guest_video from media where occasion_id = $1", [occasionId]);
  const byId = new Map(rows.map((r) => [r.id, r]));
  const keyOf = (url: string | null) => (url ? decodeURIComponent(new URL(url).pathname.slice(1)) : null);
  expect(feedB.items.length).toBeGreaterThanOrEqual(4);
  for (const it of feedB.items) {
    const r = byId.get(it.id)!;
    expect(it.originalUrl ?? null).toBeNull();
    expect(it.mine).toBeFalsy();
    if (it.kind === "photo") {
      expect(keyOf(it.displayUrl)).toBe(r.key_guest);
      expect(keyOf(it.thumbUrl)).toBe(r.key_guest_thumb);
    } else {
      expect(keyOf(it.playbackUrl)).toBe(r.key_guest_video);
    }
  }
  for (const it of feedA.items.filter((x: { mine: boolean }) => x.mine)) {
    const r = byId.get(it.id)!;
    if (it.kind === "photo") expect(keyOf(it.displayUrl)).toBe(r.key_display);
    else expect(keyOf(it.playbackUrl)).toBe(r.key_video);
  }
  // The guest preview really carries the watermark: it differs from the clean display copy, most in the bottom-right corner.
  const photo = rows.find((r) => r.id === guestAMedia.find((id) => byId.get(id)!.key_guest && byId.get(id)!.key_display && byId.get(id)!.key_original.endsWith(".jpg")))!;
  const px = async (key: string) => sharp(join(paths.storage, key)).resize(300, 300, { fit: "fill" }).removeAlpha().raw().toBuffer();
  const [wm, clean] = await Promise.all([px(photo.key_guest), px(photo.key_display)]);
  const diff = (x0: number, y0: number, x1: number, y1: number) => {
    let sum = 0, n = 0;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) for (let c = 0; c < 3; c++) { const i = (y * 300 + x) * 3 + c; sum += Math.abs(wm[i]! - clean[i]!); n++; }
    return sum / n;
  };
  // Bottom-right corner mark vs an area away from it (only encoding noise there, ≈1).
  const corner = diff(230, 270, 295, 295);
  expect(corner, "watermark in the corner").toBeGreaterThan(5);
  expect(corner, "corner mark stands out from encoding noise").toBeGreaterThan(4 * diff(0, 0, 60, 60));
  // GPS was stripped from the JPEG original in the browser (the fixture has it).
  const hasGps = async (path: string) => { const e = (await sharp(path).metadata()).exif; return !!e && e.includes(Buffer.from([0x25, 0x88])); };
  expect(await hasGps(join(FIX, "photo-3.jpg"))).toBe(true);
  expect(await hasGps(join(paths.storage, photo.key_original))).toBe(false);
  // The host's guest list counts each guest's uploads.
  const gl = await (await api.get(`/api/v1/occasions/${occasionId}/guests`, { headers: bearer(hostToken) })).json();
  expect(gl.guests.find((x: { id: string }) => x.id === guestAId).uploads).toBe(4);
  // Host sees clean copies.
  const album = await (await api.get(`/api/v1/occasions/${occasionId}/media`, { headers: bearer(hostToken) })).json();
  for (const it of album.items) {
    const r = byId.get(it.id)!;
    if (it.kind === "photo") expect(keyOf(it.displayUrl)).toBe(r.key_display);
    expect(it.originalUrl ?? null).toBeNull();
  }
  // Live wall: clean, ready items only.
  await q("insert into media (id, occasion_id, guest_id, kind, mime, bytes, key_original, status, processing_status) select gen_random_uuid(), occasion_id, guest_id, 'photo', 'image/jpeg', 1, key_original || '-pending', 'uploaded', 'pending' from media where id = $1", [guestAMedia[0]]);
  const wall = new URL(wallUrl);
  const wallJson = await (await api.get(`/api/v1/wall/${slug}?k=${wall.searchParams.get("k")}`)).json();
  expect(wallJson.items.length).toBeGreaterThan(0);
  const ready = new Set(rows.map((r) => r.id));
  for (const it of wallJson.items) {
    expect(ready.has(it.id), "wall shows only ready items").toBeTruthy();
    const r = byId.get(it.id)!;
    if (it.kind === "photo") expect(keyOf(it.displayUrl)).toBe(r.key_display);
    else expect(keyOf(it.playbackUrl)).toBe(r.key_video);
  }
  await q("delete from media where key_original like '%-pending'");
  // Screens.
  await guestBPage.goto(`/g/${slug}`);
  await checkPage(guestBPage, guestLang);
  await shotB("feed-watermarked");
  await guestAPage.goto(`/g/${slug}/mine`);
  await checkPage(guestAPage, guestLang);
  await shooter(guestAPage, info, `guest-${guestLang}-e`)("mine-clean");
  const wallPage = await host.newPage();
  await wallPage.goto(wallUrl.replace(/^https?:\/\/[^/]+/, ""));
  await expect(wallPage.locator("img, video").first()).toBeVisible();
  await shooter(wallPage, info, `host-${hostLang}-wall`)("live-wall");
  await wallPage.close();
  await hostPage.goto(`/dashboard/${occasionId}`);
  await checkPage(hostPage, hostLang);
  await shooter(hostPage, info, `host-${hostLang}-b`)("album-live");
});

test("email card after 3 uploads: without and with the marketing tick", async ({}, info) => {
  const page = guestAPage;
  const shot = shooter(page, info, `guest-${guestLang}-f`);
  await page.goto(`/g/${slug}/upload`);
  const card = page.locator("section[aria-labelledby]").filter({ has: page.locator("input[type=email]") });
  await expect(card).toBeVisible();
  await expect(card.locator("input[type=checkbox]")).not.toBeChecked();
  await shot("email-card");
  const emailA = `zeynep-${info.project.name}@e2e.test`;
  await card.locator("input[type=email]").fill(emailA);
  await card.locator("button[type=submit]").click();
  await expect(page.locator("[role=status]").first()).toBeVisible();
  await shot("email-card-sent");
  const contact = await one<{ email: string; locale: string }>("select email, locale from guest_contacts where occasion_id = $1 and guest_id = $2", [occasionId, guestAId]);
  expect(contact).toMatchObject({ email: emailA, locale: guestLang });
  expect(await q("select 1 from marketing_consents where email = $1", [emailA])).toHaveLength(0);
  // Guest B ticks the separate marketing box (via the API the card uses; the UI path is the same component).
  const bToken = (await guestB.cookies()).find((c) => c.name.startsWith("op_g_"))!.value;
  const emailB = `ali-${info.project.name}@e2e.test`;
  const r = await api.post(`/api/v1/g/${slug}/contact`, { headers: { "X-Guest-Token": bToken, "User-Agent": "e2e" }, data: { email: emailB, marketing: true, locale: guestLang } });
  expect(r.status()).toBe(200);
  const c = await one<{ wording: string; locale: string; source: string; consented_at: Date; ip_hash: string | null }>(
    "select wording, locale, source, consented_at, ip_hash from marketing_consents where email = $1", [emailB]);
  const expected = get(msgs(guestLang, "guest"), "emailOffer.marketing").replace("{brand}", "BizimResimler");
  expect(c.wording).toBe(expected);
  expect(c.locale).toBe(guestLang);
  expect(c.consented_at).toBeTruthy();
});

test("guest buys £3: waiver required; clean previews, download page, /d link, ZIP manifest, signed originals", async ({}, info) => {
  const page = guestAPage;
  const w = watch(page);
  const shot = shooter(page, info, `guest-${guestLang}-g`);
  // Without the waiver the API refuses.
  const no = await api.post(`/api/v1/g/${slug}/purchase`, { headers: { "X-Guest-Token": guestAToken }, data: { locale: guestLang } });
  expect(no.status()).toBe(400);
  expect((await no.json()).error.code).toBe("waiver_required");
  await page.goto(`/g/${slug}`);
  const cardBtn = page.locator("button", { hasText: "£3" }).first();
  await expect(cardBtn).toBeDisabled();
  await shot("purchase-card");
  await page.locator("label", { has: page.locator("input[type=checkbox]") }).filter({ hasText: /14/ }).first().locator("input").check();
  await cardBtn.click();
  await page.waitForURL(/\/pay\//);
  await expect(page.locator("#amount")).toHaveAttribute("data-pence", "300");
  const buyer = `buyer-${info.project.name}@e2e.test`;
  await page.locator("input#email").fill(buyer);
  await shot("checkout-guest");
  await page.locator("#pay").click();
  await page.waitForURL(/\/download\?session_id=/);
  purchaseSession = new URL(page.url()).searchParams.get("session_id")!;
  await checkPage(page, guestLang);
  await shot("download-page");
  const p = await one<{ status: string; waiver_wording: string; waiver_accepted_at: Date; email: string }>(
    "select status, waiver_wording, waiver_accepted_at, email from guest_purchases where stripe_checkout_session_id = $1", [purchaseSession]);
  expect(p.status).toBe("paid");
  expect(p.email).toBe(buyer);
  expect(p.waiver_wording).toBe(get(msgs(guestLang, "guest"), "purchase.waiver").replace("{days}", "14"));
  // Clean previews of everything on the paying device.
  const feed = await (await api.get(`/api/v1/g/${slug}/feed`, { headers: { "X-Guest-Token": guestAToken } })).json();
  const rows = await q<Record<string, string>>("select id, key_display, key_video from media where occasion_id = $1", [occasionId]);
  const byId = new Map(rows.map((r) => [r.id, r]));
  for (const it of feed.items) {
    const key = decodeURIComponent(new URL(it.kind === "video" ? it.playbackUrl : it.displayUrl).pathname.slice(1));
    expect(key).toBe(it.kind === "video" ? byId.get(it.id)!.key_video : byId.get(it.id)!.key_display);
  }
  // The emailed /d/<token> link.
  const mail = await waitForEmail(buyer, /./);
  downloadLink = /https?:\/\/[^\s"]+\/d\/[A-Za-z0-9_-]+/.exec(mail.text)![0];
  expect(mail.text).not.toMatch(/£\d/);
  const dPath = new URL(downloadLink).pathname;
  await page.goto(dPath);
  await checkPage(page, guestLang);
  await shot("d-token-page");
  const token = dPath.split("/").pop()!;
  const man = await api.get(`/api/v1/d/${token}/files`);
  expect(man.status()).toBe(200);
  const files = (await man.json()).files as { id: string; url: string }[];
  expect(files.length).toBe(rows.length);
  // Originals: only through signed, expiring links (≤ 1 h).
  const u = new URL(files[0]!.url);
  const exp = Number(u.searchParams.get("exp"));
  expect(exp * 1000 - clockNow().getTime()).toBeLessThanOrEqual(3600_000 + 5000);
  expect((await api.get(files[0]!.url)).status()).toBe(200);
  u.searchParams.set("exp", String(exp + 3600));
  expect((await api.get(u.toString())).status(), "tampered expiry").toBe(403);
  // The device's ZIP manifest.
  const zip = await api.get(`/api/v1/g/${slug}/purchase/files`, { headers: { "X-Guest-Token": guestAToken } });
  expect(zip.status()).toBe(200);
  expect((await zip.json()).files.length).toBe(rows.length);
  w.assertClean();
});

test("paywall probes: unpaid guest and anonymous visitor can't reach originals or clean copies", async () => {
  const bToken = (await guestB.cookies()).find((c) => c.name.startsWith("op_g_"))!.value;
  const rows = await q<Record<string, string>>("select id, guest_id, key_original, key_display, key_video, kind from media where occasion_id = $1", [occasionId]);
  const others = rows.filter((r) => r.guest_id !== null);
  for (const [who, headers] of [["guest B", { "X-Guest-Token": bToken }], ["anonymous", {}]] as const) {
    for (const r of others) {
      const d = await api.get(`/api/v1/g/${slug}/media/${r.id}/download`, { headers });
      expect([401, 402, 403, 404], `${who} download ${r.id}`).toContain(d.status());
    }
    const pf = await api.get(`/api/v1/g/${slug}/purchase/files`, { headers });
    expect([401, 402, 403, 404]).toContain(pf.status());
    for (const path of [`/api/v1/occasions/${occasionId}/download`, `/api/v1/occasions/${occasionId}/media`, `/api/v1/occasions/${occasionId}`]) {
      expect([401, 404], `${who} ${path}`).toContain((await api.get(path, { headers })).status());
    }
    const feed = await api.get(`/api/v1/g/${slug}/feed`, { headers });
    if (feed.status() === 200) {
      const text = await feed.text();
      for (const r of others) {
        expect(text).not.toContain(encodeURIComponent(r.key_original).replace(/%2F/g, "/"));
        expect(text).not.toContain(r.key_original);
        if (r.key_display) expect(text).not.toContain(r.key_display);
        if (r.key_video) expect(text).not.toContain(r.key_video);
      }
    }
  }
  expect((await api.get(`/api/v1/d/${"x".repeat(43)}/files`)).status()).toBe(404);
  // Storage itself: unsigned, wrongly signed or expired requests are refused.
  const any = others[0]!;
  const storage = `http://127.0.0.1:${process.env.E2E_STORAGE_PORT || 4580}`;
  expect((await api.get(`${storage}/${any.key_original}`)).status()).toBe(403);
  expect((await api.get(`${storage}/${any.key_original}?m=GET&exp=9999999999&sig=${"0".repeat(64)}`)).status()).toBe(403);
  // A guest's own original: allowed (signed, short-lived).
  const own = rows.find((r) => r.guest_id === guestAId)!;
  const ok = await api.get(`/api/v1/g/${slug}/media/${own.id}/download`, { headers: { "X-Guest-Token": guestAToken } });
  expect(ok.status()).toBe(200);
});

test("gallery ends (time travel): uploads closed, guest email has no price, host gets the download email and the ZIP", async ({}, info) => {
  await travelTo(new Date(closesAt.getTime() + 3600_000));
  const ex = await cron(api, "expiry");
  expect(Number(ex.endedEmails)).toBeGreaterThanOrEqual(1);
  const up = await apiUpload(api, `${BASE}/api/v1/g/${slug}`, { "X-Guest-Token": guestAToken }, [{ path: join(FIX, "photo-1.jpg"), mime: "image/jpeg", kind: "photo" }]);
  expect(up.status).toBe(403);
  expect(up.body.error?.code).toBe("upload_closed");
  const guestMail = await waitForEmail(`zeynep-${info.project.name}@e2e.test`, /./);
  expect(guestMail.text + guestMail.html).not.toMatch(/£|\bGBP\b|€|\$\d/);
  expect(guestMail.text).toContain(`/g/`);
  expect(guestMail.headers["List-Unsubscribe"]).toBeUndefined();
  const hostMail = await waitForEmail(hostEmail, /./);
  expect(hostMail.text).toContain(`/dashboard/${occasionId}/download`);
  // Host downloads everything as a ZIP from the dashboard.
  const page = hostPage;
  const shot = shooter(page, info, `host-${hostLang}-c`);
  await page.goto(`/dashboard/${occasionId}/download`);
  await checkPage(page, hostLang);
  await shot("download");
  const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 120_000 }), page.locator("main button").filter({ hasText: /ZIP/i }).first().click()]);
  const path = await dl.path();
  const zip = readFileSync(path!);
  expect(zip.subarray(0, 2).toString()).toBe("PK");
  const count = (await q<{ n: number }>("select count(*)::int n from media where occasion_id = $1 and visibility = 'visible'", [occasionId]))[0]!.n;
  const entries = zip.toString("latin1").split("PK\u0001\u0002").length - 1;
  expect(entries).toBe(count);
  // Guest page after the end.
  await guestAPage.goto(`/g/${slug}`);
  await checkPage(guestAPage, guestLang);
  await shooter(guestAPage, info, `guest-${guestLang}-h`)("ended");
});

test("host refund → event refunded; the paid guest link still works; host deletes → files kept until the link expires", async ({}, info) => {
  const sessions = await stripeSessions(api);
  const pkg = sessions.find((x) => x.metadata?.occasionId === occasionId && x.metadata?.kind === "event_package")!;
  await stripeRefund(api, pkg.id);
  expect((await one<{ s: string }>("select package_status s from occasions where id = $1", [occasionId])).s).toBe("refunded");
  const token = new URL(downloadLink).pathname.split("/").pop()!;
  expect((await api.get(`/api/v1/d/${token}/files`)).status()).toBe(200);
  await hostPage.goto(`/dashboard/${occasionId}`);
  await shooter(hostPage, info, `host-${hostLang}-d`)("refunded");
  // Delete the event (owner).
  const del = await api.delete(`/api/v1/occasions/${occasionId}`, { headers: bearer(hostToken) });
  expect(del.status()).toBe(200);
  const o = await one<{ deleted_at: Date | null; files_delete_after: Date | null }>("select deleted_at, files_delete_after from occasions where id = $1", [occasionId]);
  expect(o.deleted_at).toBeTruthy();
  expect(o.files_delete_after).toBeTruthy();
  expect((await api.get(`/api/v1/occasions/${occasionId}`, { headers: bearer(hostToken) })).status()).toBe(404);
  expect((await api.get(`/api/v1/d/${token}/files`)).status()).toBe(200);
  await cron(api, "cleanup");
  expect((await q("select 1 from media where occasion_id = $1", [occasionId])).length).toBeGreaterThan(0);
  // 31 days after the purchase: the link has expired, the cron deletes the files and the event.
  await travelTo(new Date(new Date(o.files_delete_after!).getTime() + DAY));
  expect((await api.get(`/api/v1/d/${token}/files`)).status()).toBe(404);
  await cron(api, "cleanup");
  expect(await q("select 1 from occasions where id = $1", [occasionId])).toHaveLength(0);
  expect(await q("select 1 from media where occasion_id = $1", [occasionId])).toHaveLength(0);
  const { readdirSync, existsSync } = await import("node:fs");
  const dir = join(paths.storage, "o", occasionId);
  expect(existsSync(dir) ? readdirSync(dir, { recursive: true }).filter((f) => !String(f).endsWith(".meta.json") && String(f).includes(".")) : []).toEqual([]);
  // Payment records are kept, anonymised.
  expect(await q("select 1 from orders where stripe_session_id = $1", [pkg.id])).toHaveLength(1);
});

test("layout: no horizontal overflow (also at 360 px), tap targets ≥ 44 px", () => assertLayout());
