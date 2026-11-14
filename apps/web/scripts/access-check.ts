/**
 * Exercises the event-package access rules (src/lib/access.ts → access-rules.ts) over the key states and prints
 * a table plus PASS/FAIL per expectation. No database: rows are built in memory.
 *
 *   npx tsx --conditions=react-server --require ./scripts/server-only-shim.cjs scripts/access-check.ts
 *
 * (The shim and `--conditions=react-server` let the "server-only" import and React `cache` in access.ts load outside Next.)
 */
import { ApiError } from "../src/lib/http";
import {
  assertCanDownload, assertCanEditWindow, assertCanPay, assertCanUpload, assertGuestCanUpload, assertGuestsCanView, assertWritable,
  computeAccess, type Access, type EventPackageRow,
} from "../src/lib/access";
import { PACKAGE_DEFAULTS } from "../src/lib/config";
import { addMonths, windowError } from "../src/lib/window";

const DAY = 86400_000;
const now = new Date("2027-06-12T12:00:00Z");
const at = (days: number) => new Date(now.getTime() + days * DAY);
const settings = { retentionMonths: PACKAGE_DEFAULTS.retentionMonths, hostTestUploadLimit: PACKAGE_DEFAULTS.hostTestUploadLimit };
const ok = { suspendedAt: null };

function row(p: Partial<EventPackageRow>): EventPackageRow {
  return { packageStatus: "setup", opensAt: at(3), closesAt: at(10), deleteAfter: null, adminLockedAt: null, compedAt: null, paidAt: null, ...p };
}
const paid = (opens: number, closes: number, extra: Partial<EventPackageRow> = {}) =>
  row({ packageStatus: "paid", paidAt: at(-20), opensAt: at(opens), closesAt: at(closes), deleteAfter: addMonths(at(closes), settings.retentionMonths), ...extra });

type Expect = Partial<Pick<Access, "state" | "reason" | "testMode" | "canUpload" | "guestsCanView" | "guestsCanUpload" | "canDownload" | "readOnly" | "canEditWindow" | "canEndEarly" | "canPay" | "deleted">>;
const cases: { name: string; o: EventPackageRow; owner?: { suspendedAt: Date | null }; expect: Expect; guard?: { fn: (a: Access) => void; code: string | null } }[] = [
  { name: "setup (unpaid, test mode)", o: row({}), expect: { state: "setup", reason: "setup", testMode: true, canUpload: true, guestsCanView: false, guestsCanUpload: false, canDownload: false, readOnly: false, canEditWindow: true, canPay: true },
    guard: { fn: assertGuestsCanView, code: "not_open" } },
  { name: "setup: downloads locked", o: row({}), expect: { canUpload: true }, guard: { fn: assertCanDownload, code: "payment_required" } },
  { name: "setup with a past window", o: row({ opensAt: at(-10), closesAt: at(-5) }), expect: { state: "setup", guestsCanView: false, canPay: true } },
  { name: "paid, before opens_at", o: paid(3, 10), expect: { state: "paid", reason: "not_open", canUpload: true, guestsCanView: false, guestsCanUpload: false, canDownload: true, canEditWindow: true, canPay: false, canEndEarly: false },
    guard: { fn: assertGuestCanUpload, code: "not_open" } },
  { name: "paid, live (opens ≤ now < closes)", o: paid(-1, 6), expect: { state: "live", reason: null, canUpload: true, guestsCanView: true, guestsCanUpload: true, canDownload: true, canEditWindow: false, canEndEarly: true },
    guard: { fn: assertCanEditWindow, code: "window_locked" } },
  { name: "stored 'live' + clock", o: paid(-1, 6, { packageStatus: "live" }), expect: { state: "live" } },
  { name: "ended (closes_at ≤ now)", o: paid(-8, -1), expect: { state: "ended", reason: "ended", guestsCanView: true, guestsCanUpload: false, canDownload: true, canUpload: true, readOnly: false, canEndEarly: false },
    guard: { fn: assertGuestCanUpload, code: "upload_closed" } },
  { name: "ended early (stored 'ended', closes in future)", o: paid(-1, 5, { packageStatus: "ended" }), expect: { state: "ended", guestsCanUpload: false } },
  { name: "expired (now > delete_after)", o: paid(-400, -393), expect: { state: "expired", reason: "expired", deleted: true, canDownload: false, guestsCanView: false, readOnly: true },
    guard: { fn: assertGuestsCanView, code: "event_unavailable" } },
  { name: "expired, derived from closes_at + 12 months", o: paid(-400, -393, { deleteAfter: null }), expect: { state: "expired" } },
  { name: "refunded", o: paid(-1, 6, { packageStatus: "refunded" }), expect: { state: "refunded", reason: "refunded", canUpload: false, guestsCanView: false, canDownload: false, readOnly: true, canPay: false },
    guard: { fn: assertWritable, code: "event_refunded" } },
  { name: "locked by admin (live event)", o: paid(-1, 6, { adminLockedAt: at(-0.5) }), expect: { state: "live", reason: "locked", canUpload: false, guestsCanUpload: false, guestsCanView: true, canDownload: true, readOnly: true, canEndEarly: false },
    guard: { fn: assertCanUpload, code: "event_locked" } },
  { name: "owner suspended (live event)", o: paid(-1, 6), owner: { suspendedAt: at(-1) }, expect: { reason: "suspended", canUpload: false, guestsCanUpload: false, canDownload: false, readOnly: true, canPay: false },
    guard: { fn: assertCanDownload, code: "account_suspended" } },
  { name: "comped by admin (paid, live)", o: paid(-1, 6, { compedAt: at(-2) }), expect: { state: "live", canDownload: true }, guard: { fn: assertCanPay, code: "already_paid" } },
];

let failures = 0;
const yn = (b: boolean) => (b ? "yes" : " - ");
console.log(`now = ${now.toISOString()}, retention ${settings.retentionMonths} months, test limit ${settings.hostTestUploadLimit}\n`);
console.log("case".padEnd(48), "state".padEnd(9), "reason".padEnd(10), "hostUp guestView guestUp download readOnly window pay");
for (const c of cases) {
  const a = computeAccess(c.o, c.owner ?? ok, settings, now);
  console.log(c.name.padEnd(48), a.state.padEnd(9), String(a.reason).padEnd(10),
    ` ${yn(a.canUpload)}     ${yn(a.guestsCanView)}       ${yn(a.guestsCanUpload)}     ${yn(a.canDownload)}      ${yn(a.readOnly)}     ${yn(a.canEditWindow)}   ${yn(a.canPay)}`);
  for (const [k, v] of Object.entries(c.expect)) {
    const got = (a as Record<string, unknown>)[k];
    if (got !== v) { failures++; console.log(`   FAIL ${k}: expected ${String(v)}, got ${String(got)}`); }
  }
  if (c.guard) {
    let code: string | null = null;
    try { c.guard.fn(a); } catch (e) { code = e instanceof ApiError ? e.code : String(e); }
    if (code !== c.guard.code) { failures++; console.log(`   FAIL guard ${c.guard.fn.name}: expected ${String(c.guard.code)}, got ${String(code)}`); }
    else console.log(`   guard ${c.guard.fn.name} → ${code ?? "allowed"}`);
  }
}

// Gallery window rules.
const W = PACKAGE_DEFAULTS.windowDays;
const windows: [string, Date | null, Date | null, string | null][] = [
  ["7 days exactly", at(1), at(1 + W), null],
  ["8 days", at(1), at(1 + W + 1), "window_too_long"],
  ["closes before opens", at(2), at(1), "window_order"],
  ["already over", at(-3), at(-1), "window_past"],
  ["missing end", at(1), null, "window_incomplete"],
];
console.log("\nwindow rules (windowDays = " + W + ")");
for (const [name, o, c, want] of windows) {
  const got = windowError({ opensAt: o, closesAt: c }, W, now);
  const pass = got === want;
  if (!pass) failures++;
  console.log(`  ${pass ? "PASS" : "FAIL"} ${name.padEnd(22)} → ${got ?? "ok"}`);
}

// Test-mode limit is enforced in uploads.ts against the stored count: used + new ≤ testUploadLimit.
const limitOk = (used: number, adding: number) => used + adding <= settings.hostTestUploadLimit;
const limitCases: [number, number, boolean][] = [[0, 20, true], [19, 1, true], [20, 1, false], [15, 6, false]];
console.log(`\ntest-mode limit (${settings.hostTestUploadLimit})`);
for (const [used, adding, want] of limitCases) {
  const pass = limitOk(used, adding) === want;
  if (!pass) failures++;
  console.log(`  ${pass ? "PASS" : "FAIL"} ${used} used + ${adding} new → ${limitOk(used, adding) ? "allowed" : "test_limit"}`);
}

console.log(failures ? `\n${failures} FAILURE(S)` : "\nAll access checks passed.");
process.exit(failures ? 1 : 0);
