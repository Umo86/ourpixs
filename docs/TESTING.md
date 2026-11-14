# End-to-end tests (local, fully isolated)

`npm run test:e2e` (from `apps/web`) runs the whole product on a phone-sized Chromium against a local copy of every
outside service. Nothing talks to Neon, Stripe, Resend, Vercel Blob/R2 or the internet.

```bash
cd apps/web
npm install
npm run test:e2e                      # build + run everything (≈ 8–10 min)
E2E_SKIP_BUILD=1 npm run test:e2e     # reuse the last test build (.next-e2e)
npm run test:e2e -- --project=iphone14 journey   # extra args go to Playwright
E2E_SERVE=1 E2E_SKIP_BUILD=1 npm run test:e2e    # start the services and keep them running (manual testing, spec work)
```

Needs: Node 22, a local PostgreSQL (16 tested; found under `/usr/lib/postgresql/<v>/bin`, or set `PG_BIN`, or point
`TEST_DATABASE_URL` at a **disposable** server: the database is dropped and recreated), and a Playwright Chromium
(`PLAYWRIGHT_BROWSERS_PATH`, or `npx playwright install chromium`). When run as root, PostgreSQL runs as the `postgres` user.

Results: Playwright's list report; traces of failures in `apps/web/test-results/`; full-page phone screenshots of every
screen visited (EN and TR, both devices) in `/tmp/e2e-shots/<device>/NNN-<flow>-<screen>.png` (`E2E_SHOTS` to change);
captured emails, storage, logs in `/tmp/br-e2e/` (`E2E_WORK`). The run fails if the server log shows a 5xx or an
unhandled error.

## What runs (`apps/web/test/run.mjs`)
1. Fixtures (`test/fixtures/make-fixtures.mjs`, not committed): four real JPEGs with EXIF + GPS, a HEIF `.heic`, a 5-second and a
   70-second H.264 MP4 (sharp, ffmpeg-static).
2. PostgreSQL: `initdb` into `/tmp/br-e2e/pgdata`, port 54329, a fresh `bizimresimler_test` database, every migration in
   `drizzle/meta/_journal.json` order (0000 → latest), plus the test clock (below).
3. `next build` into `.next-e2e` with the test environment (`test/harness/env.mjs`), then `next start` on port 3100.
4. The local storage server (`test/harness/storage-server.mjs`, port 4580) and the fake Stripe (`test/harness/stripe-fake.mjs`, port 12111).
5. Playwright (`test/playwright.config.ts`): projects **iphone14** (390×844) and **pixel7** (412×915), one worker.

## The test doubles (test-only; production code paths are unchanged without these env vars)
| Piece | Switch | Where | Refused in production |
|---|---|---|---|
| Database: node-postgres instead of Neon HTTP (`db.batch` runs the queries in order) | `TEST_DB=postgres` + `TEST_DATABASE_URL` | `src/db/index.ts` | yes (`VERCEL_ENV=production` throws) |
| Storage: files under `LOCAL_STORAGE_DIR`, presigned PUT/GET URLs with HMAC signature + expiry, served by the storage server (403 for unsigned, tampered or expired URLs, like a private R2 bucket) | `STORAGE_DRIVER=local` + `LOCAL_STORAGE_DIR/URL/SECRET` | `src/lib/storage-local.ts`, `src/lib/storage.ts` | yes |
| Stripe: the real `stripe` library pointed at the fake API; Checkout "pays" on a local page, posts a correctly signed `checkout.session.completed` (`stripe.webhooks.generateTestHeaderString`, `STRIPE_WEBHOOK_SECRET`) to `/api/stripe/webhook`, then redirects to `success_url`; `POST /test/refund` sends `charge.refunded` | `STRIPE_FAKE=1` + `STRIPE_FAKE_URL` | `src/lib/stripe.ts` | yes |
| Email: written as JSON (to, subject, html, text, headers) to `EMAIL_CAPTURE_DIR`; with `PREVIEW_SHOW_CODE=1` the login code is also returned to the UI | `EMAIL_CAPTURE_DIR` | `src/lib/email.ts`, `src/lib/auth.ts` | yes |
| Clock: `test/harness/clock.cjs` (preloaded with `--require`, never bundled) shifts `Date` in the Next server, storage server and fake Stripe by the offset in `TEST_CLOCK_FILE`; PostgreSQL's `now()` follows `testing.clock` (`public.now()` with `search_path = public, pg_catalog`, test database only); the browsers follow through Playwright's clock | `TEST_CLOCK_FILE` | `test/harness/*` | n/a (not in the app) |
| Separate build dir | `NEXT_DIST_DIR=.next-e2e` | `next.config.ts` | n/a |

Specs use `setClock` / `travelTo` (`test/e2e/helpers.ts`) to move every service at once, call the crons with `CRON_SECRET`,
read the database directly (assertions only) and read captured emails.

## Specs (`apps/web/test/e2e/`)
- `journey.spec.ts` — landing → pricing → start free → sign in (code shown on screen and in the captured email) → wizard
  (gallery window) → QR studio and the A6/A5 PDFs (page sizes checked) → 20 test uploads, the 21st refused → guest link
  "opens on…" before and after paying → pay £69 (fake Checkout, signed webhook, replay harmless, forged refused) → time
  travel into the window → guest joins with a first name, uploads 3 photos (one HEIF) and a 5 s video; a 70 s video is
  refused in the browser (friendly message) and by the server → real sharp/ffmpeg processing → watermarked previews for
  other guests (pixel check), clean copies for own uploads, host and wall (ready items only), GPS stripped from JPEG
  originals → email card after 3 uploads (no marketing) and a marketing opt-in (wording, locale stored) → £3 purchase
  refused without the waiver, then paid: clean previews on that device, download page, `/d/<token>` email link, ZIP
  manifest, originals only through signed ≤1 h links → paywall probes (unpaid guest, anonymous, storage URLs) → gallery
  ends: guest uploads closed, gallery-ready email without any price, host "download everything" email, host ZIP from the
  dashboard → host refund → paid guest link still works → host deletes → files kept until the guest link expires, then
  deleted by the cleanup cron. iphone14: host English, guest Turkish (Accept-Language); pixel7: host Turkish (EN/TR switch), guest English.
- `lifecycle.spec.ts` — unpaid event: reminder on day 83, deleted with its files on day 90; admin "Back to setup"
  restarts the unpaid clock; refunded event deleted 90 days after the refund; 12-month retention with the 30/7-day reminders.
- `admin.spec.ts` — 404 for non-admins; admin pages; payments; storage per event; consents + audited CSV export; a price
  change reaches /pricing and the Checkout amount; suspending a host closes gallery, wall and sign-in; unsubscribe page
  (GET only confirms, POST withdraws) and the one-click POST.
- `screens.spec.ts` — every marketing, host, guest, share, wall and 404 screen in EN and TR; the EN/TR switch on a guest
  page; Our Pixs on ourpixs.com (Chromium maps it to 127.0.0.1); the PWA (manifests, icon sizes, iOS tags, no service worker).

Every page visited is checked for: `<html lang>`, no console errors / page errors / 5xx responses, no horizontal
overflow at the device width and at 360 px, and pill buttons ≥ 44 px tall (layout findings are collected and reported
by the last test of each spec, so one finding doesn't hide the rest of the flow).

## Not automated
- Real Stripe, Resend, R2 and Vercel (network); Apple Pay / Google Pay sheets; real iOS Safari / Android Chrome (Chromium
  with mobile emulation stands in; "Add to Home Screen" itself can't be driven); camera and microphone capture
  (guestbook voice/video, disposable camera); push notifications; the Expo app (type-checked only).
