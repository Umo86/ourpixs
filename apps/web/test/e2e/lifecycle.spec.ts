/**
 * Retention and deletion rules with the fake clock (API-driven; screens are covered by journey/screens):
 *  - unpaid event: reminder 7 days before (day 83), deleted with its test uploads on day 90;
 *  - admin "Back to setup" restarts the unpaid clock (setup_reset_at);
 *  - refunded event: files deleted 90 days after the refund;
 *  - paid event: 12-month retention with reminders 30 and 7 days before, then the files are deleted.
 */
import { test, expect, type APIRequestContext } from "@playwright/test";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { ADMIN_EMAIL, BASE, DAY, FIX, apiUpload, bearer, cron, emails, one, paths, q, resetClock, signInApi, stripeRefund, travelTo, uniqueEmail } from "./helpers";

test.describe.configure({ mode: "serial" });
let api: APIRequestContext;

test.beforeAll(async ({ playwright }) => {
  await resetClock();
  api = await playwright.request.newContext({ baseURL: BASE });
});
test.afterAll(async () => {
  await api.dispose();
  await resetClock();
});

async function newEvent(token: string, opts: { daysAhead?: number } = {}) {
  const startsOn = new Date(Date.now() + (opts.daysAhead ?? 10) * DAY).toISOString().slice(0, 10);
  const r = await api.post("/api/v1/occasions", { headers: bearer(token), data: { type: "dogum_gunu", title: "Lifecycle test", honorees: ["Deniz"], startsOn } });
  expect(r.status(), await r.text()).toBe(201);
  return (await r.json()).occasion as { id: string; slug: string; package: { opensAt: string; closesAt: string } };
}

async function payEvent(token: string, id: string) {
  const r = await api.post(`/api/v1/occasions/${id}/checkout`, { headers: bearer(token), data: {} });
  expect(r.status(), await r.text()).toBe(200);
  const { url } = await r.json();
  const paid = await api.post(url, { form: { email: "" }, maxRedirects: 0 });
  expect(paid.status()).toBe(303);
  await expect.poll(async () => (await one<{ s: string }>("select package_status s from occasions where id = $1", [id])).s).toBe("paid");
  return new URL(url).pathname.split("/").pop()!;
}

const filesOf = (id: string) => {
  const dir = join(paths.storage, "o", id);
  return existsSync(dir) ? readdirSync(dir, { recursive: true }).map(String).filter((f) => /\.(jpg|webp|mp4|heic)$/.test(f)) : [];
};

test("unpaid event: reminder on day 83, deleted with its test uploads on day 90", async ({}, info) => {
  const email = uniqueEmail(info, "unpaid");
  const token = await signInApi(api, email);
  const o = await newEvent(token);
  await apiUpload(api, `${BASE}/api/v1/occasions/${o.id}`, bearer(token), [{ path: join(FIX, "photo-4.jpg"), mime: "image/jpeg", kind: "photo" }]);
  expect(filesOf(o.id).length).toBeGreaterThan(0);
  const created = (await one<{ created_at: Date }>("select created_at from occasions where id = $1", [o.id])).created_at;
  const ev = await (await api.get(`/api/v1/occasions/${o.id}`, { headers: bearer(token) })).json();
  expect(new Date(ev.occasion.deleteAfter).getTime()).toBe(new Date(created).getTime() + 90 * DAY);

  await travelTo(new Date(new Date(created).getTime() + 82 * DAY));
  await cron(api, "expiry");
  expect(emails(email).filter((m) => /delet|silin/i.test(m.subject))).toHaveLength(0);
  await travelTo(new Date(new Date(created).getTime() + 83 * DAY + 3600_000));
  await cron(api, "expiry");
  const reminders = emails(email).filter((m) => m.text.includes(`/dashboard/${o.id}`));
  expect(reminders).toHaveLength(1);
  expect(reminders[0]!.text).toContain(`/dashboard/${o.id}/download`);
  await cron(api, "expiry");
  expect(emails(email).filter((m) => m.text.includes(`/dashboard/${o.id}`))).toHaveLength(1);
  await cron(api, "cleanup");
  expect(await q("select 1 from occasions where id = $1", [o.id])).toHaveLength(1);

  await travelTo(new Date(new Date(created).getTime() + 90 * DAY + 3600_000));
  await cron(api, "cleanup");
  expect(await q("select 1 from occasions where id = $1", [o.id])).toHaveLength(0);
  expect(filesOf(o.id)).toEqual([]);
  await resetClock();
});

test("admin 'Back to setup' restarts the unpaid clock", async ({}, info) => {
  const token = await signInApi(api, uniqueEmail(info, "reset"));
  const o = await newEvent(token);
  const created = new Date((await one<{ created_at: Date }>("select created_at from occasions where id = $1", [o.id])).created_at);
  const adminToken = await signInApi(api, ADMIN_EMAIL);
  const mark = await api.post(`/api/admin/events/${o.id}`, { headers: bearer(adminToken), data: { action: "mark_paid", reason: "e2e comp" } });
  expect(mark.status(), await mark.text()).toBe(200);
  // 100 days later an admin puts it back into setup: without the reset clock it would be deleted at once.
  await travelTo(new Date(created.getTime() + 100 * DAY));
  const admin2 = await signInApi(api, ADMIN_EMAIL);
  const reset = await api.post(`/api/admin/events/${o.id}`, { headers: bearer(admin2), data: { action: "reset_setup", reason: "e2e reset" } });
  expect(reset.status(), await reset.text()).toBe(200);
  const row = await one<{ setup_reset_at: Date; package_status: string }>("select setup_reset_at, package_status from occasions where id = $1", [o.id]);
  expect(row.package_status).toBe("setup");
  const resetAt = new Date(row.setup_reset_at);
  await cron(api, "cleanup");
  expect(await q("select 1 from occasions where id = $1 and deleted_at is null", [o.id])).toHaveLength(1);
  const token2 = await signInApi(api, (await one<{ email: string }>("select h.email from hosts h join occasions o on o.owner_id = h.id where o.id = $1", [o.id])).email);
  const ev = await (await api.get(`/api/v1/occasions/${o.id}`, { headers: bearer(token2) })).json();
  expect(ev.occasion.package.status).toBe("setup");
  expect(new Date(ev.occasion.deleteAfter).getTime()).toBe(resetAt.getTime() + 90 * DAY);
  await travelTo(new Date(resetAt.getTime() + 90 * DAY + 3600_000));
  await cron(api, "cleanup");
  expect(await q("select 1 from occasions where id = $1", [o.id])).toHaveLength(0);
  await resetClock();
});

test("refunded event: files deleted 90 days after the refund", async ({}, info) => {
  const token = await signInApi(api, uniqueEmail(info, "refund"));
  const o = await newEvent(token);
  await apiUpload(api, `${BASE}/api/v1/occasions/${o.id}`, bearer(token), [{ path: join(FIX, "photo-4.jpg"), mime: "image/jpeg", kind: "photo" }]);
  const session = await payEvent(token, o.id);
  await stripeRefund(api, session);
  const r = await one<{ package_status: string; refunded_at: Date }>("select package_status, refunded_at from occasions where id = $1", [o.id]);
  expect(r.package_status).toBe("refunded");
  expect(r.refunded_at).toBeTruthy();
  await travelTo(new Date(new Date(r.refunded_at).getTime() + 89 * DAY));
  await cron(api, "cleanup");
  expect(await q("select 1 from occasions where id = $1", [o.id])).toHaveLength(1);
  expect(filesOf(o.id).length).toBeGreaterThan(0);
  await travelTo(new Date(new Date(r.refunded_at).getTime() + 90 * DAY + 3600_000));
  const c = await cron(api, "cleanup");
  expect(Number(c.refundedDeleted)).toBeGreaterThanOrEqual(1);
  expect(await q("select 1 from occasions where id = $1", [o.id])).toHaveLength(0);
  expect(filesOf(o.id)).toEqual([]);
  expect(await q("select 1 from orders where stripe_session_id = $1 and status = 'refunded'", [session])).toHaveLength(1);
  await resetClock();
});

test("paid event: 12-month retention, reminders 30 and 7 days before, then deleted", async ({}, info) => {
  const email = uniqueEmail(info, "retention");
  const token = await signInApi(api, email);
  const o = await newEvent(token, { daysAhead: 3 });
  await apiUpload(api, `${BASE}/api/v1/occasions/${o.id}`, bearer(token), [{ path: join(FIX, "photo-4.jpg"), mime: "image/jpeg", kind: "photo" }]);
  await payEvent(token, o.id);
  const { delete_after: del, closes_at: closes } = await one<{ delete_after: Date; closes_at: Date }>("select delete_after, closes_at from occasions where id = $1", [o.id]);
  const deleteAfter = new Date(del);
  const closesAt = new Date(closes);
  expect(deleteAfter.getUTCFullYear() * 12 + deleteAfter.getUTCMonth() - (closesAt.getUTCFullYear() * 12 + closesAt.getUTCMonth())).toBe(12);
  const mine = () => emails(email).filter((m) => m.text.includes(`/dashboard/${o.id}/download`));
  await travelTo(new Date(closesAt.getTime() + 3600_000));
  await cron(api, "expiry");
  expect(mine()).toHaveLength(1); // "gallery ended — download everything"
  await travelTo(new Date(deleteAfter.getTime() - 29 * DAY));
  await cron(api, "expiry");
  expect(mine()).toHaveLength(2); // 30-day reminder
  await travelTo(new Date(deleteAfter.getTime() - 6 * DAY));
  await cron(api, "expiry");
  await cron(api, "expiry");
  expect(mine()).toHaveLength(3); // 7-day reminder, once
  await cron(api, "cleanup");
  expect(filesOf(o.id).length).toBeGreaterThan(0);
  await travelTo(new Date(deleteAfter.getTime() + 3600_000));
  await cron(api, "cleanup");
  const after = await one<{ status: string; package_status: string }>("select status, package_status from occasions where id = $1", [o.id]);
  expect(after).toMatchObject({ status: "archived", package_status: "expired" });
  expect(filesOf(o.id)).toEqual([]);
  await resetClock();
});
