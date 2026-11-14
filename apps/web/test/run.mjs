#!/usr/bin/env node
/**
 * `npm run test:e2e` — the isolated end-to-end run (docs/TESTING.md):
 *   1. fixtures (sharp/ffmpeg), 2. a throwaway PostgreSQL with every migration, 3. `next build` into .next-e2e with the
 *   test env (skip with E2E_SKIP_BUILD=1), 4. the local storage server, the fake Stripe and `next start`, all with the
 *   fake clock preloaded (E2E_SERVE=1 stops here and keeps them running), 5. Playwright (test/playwright.config.ts; extra args are passed through), 6. teardown, and a
 *   scan of the server log for 5xx / unhandled errors (fails the run).
 * Nothing here talks to Neon, Stripe, Resend, Vercel Blob or R2.
 */
import { spawn, spawnSync } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { APP_PORT, BASE, PG_PORT, STORAGE_PORT, STRIPE_PORT, WORK, appEnv, paths } from "./harness/env.mjs";
import { resetDatabase, startPostgres } from "./harness/db.mjs";

const WEB = new URL("../", import.meta.url).pathname;
const CLOCK = join(WEB, "test/harness/clock.cjs");
const children = [];

function stopAll() {
  // Each service runs in its own process group (detached), so `npx next start` takes next-server down with it.
  for (const c of children) {
    if (c.exitCode !== null) continue;
    try { process.kill(-c.pid, "SIGTERM"); } catch { c.kill("SIGTERM"); }
  }
}
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => { stopAll(); process.exit(130); });

async function waitFor(url, ms = 60_000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try {
      const r = await fetch(url);
      if (r.status < 500) return;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`timed out waiting for ${url}`);
}

function startProc(name, cmd, args, env, log) {
  const out = createWriteStream(log, { flags: "a" });
  const p = spawn(cmd, args, { cwd: WEB, env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"], detached: true });
  p.stdout.pipe(out);
  p.stderr.pipe(out);
  p.on("exit", (code) => { if (code && code !== 143) console.error(`[e2e] ${name} exited with ${code} (see ${log})`); });
  children.push(p);
  return p;
}

// 1. clean work dir, fixtures
for (const d of [paths.storage, paths.emails, paths.downloads, paths.shots]) rmSync(d, { recursive: true, force: true });
for (const d of [WORK, paths.storage, paths.emails, paths.downloads, paths.shots]) mkdirSync(d, { recursive: true });
writeFileSync(paths.clock, "0");
for (const f of [paths.serverLog, join(WORK, "stripe.log"), join(WORK, "storage.log")]) rmSync(f, { force: true });
spawnSync("node", ["test/fixtures/make-fixtures.mjs"], { cwd: WEB, stdio: "inherit" });

// 2. database
const pg = await startPostgres(WORK, PG_PORT);
const tags = await resetDatabase(pg.url);
console.log(`[e2e] postgres ready, ${tags.length} migrations applied (${tags.at(-1)})`);

const env = appEnv();
const preload = { NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ""} --require ${CLOCK}`.trim() };
let status = 1;
try {
  // 3. build
  if (process.env.E2E_SKIP_BUILD !== "1" || !existsSync(join(WEB, ".next-e2e/BUILD_ID"))) {
    console.log("[e2e] next build (.next-e2e)…");
    const b = spawnSync("npx", ["next", "build"], {
      cwd: WEB, stdio: "inherit",
      env: { ...process.env, ...env, NEXT_FONT_GOOGLE_MOCKED_RESPONSES: process.env.NEXT_FONT_GOOGLE_MOCKED_RESPONSES || join(WEB, "test/harness/fontmock.cjs") },
    });
    if (b.status !== 0) throw new Error("next build failed");
  }

  // 4. services
  startProc("storage", "node", ["--require", CLOCK, "test/harness/storage-server.mjs"],
    { ...env, LOCAL_STORAGE_PORT: String(STORAGE_PORT) }, join(WORK, "storage.log"));
  startProc("stripe", "node", ["--require", CLOCK, "test/harness/stripe-fake.mjs"],
    { ...env, STRIPE_FAKE_PORT: String(STRIPE_PORT), STRIPE_FAKE_WEBHOOK_URL: `${BASE}/api/stripe/webhook` }, join(WORK, "stripe.log"));
  startProc("next", "npx", ["next", "start", "-p", String(APP_PORT)], { ...env, ...preload }, paths.serverLog);
  await waitFor(`${BASE}/robots.txt`, 90_000);
  await waitFor(`http://127.0.0.1:${STRIPE_PORT}/test/sessions`);
  console.log(`[e2e] app on ${BASE}`);

  if (process.env.E2E_SERVE === "1") {
    // Manual testing / spec development: keep everything running until Ctrl-C (then run `npx playwright test -c test/playwright.config.ts`).
    console.log("[e2e] E2E_SERVE=1: services running, Ctrl-C to stop");
    await new Promise(() => {});
  }
  // 5. playwright
  const r = spawnSync("npx", ["playwright", "test", "-c", "test/playwright.config.ts", ...process.argv.slice(2)], {
    cwd: WEB, stdio: "inherit", env: { ...process.env, ...env, NODE_ENV: "test" },
  });
  status = r.status ?? 1;
} catch (e) {
  console.error("[e2e]", e);
} finally {
  stopAll();
  if (process.env.E2E_KEEP_DB !== "1") await pg.stop();
}

// 6. server log scan
const log = existsSync(paths.serverLog) ? readFileSync(paths.serverLog, "utf8") : "";
const bad = log.split("\n").filter((l) => /⨯|Unhandled|TypeError|ReferenceError|\b500\b|digest:/.test(l) && !/E2E-EXPECTED/.test(l));
if (bad.length) {
  console.error(`[e2e] server log has ${bad.length} error line(s) (${paths.serverLog}):\n${bad.slice(0, 40).join("\n")}`);
  if (status === 0) status = 1;
}
console.log(`[e2e] screenshots in ${paths.shots}`);
process.exit(status);
