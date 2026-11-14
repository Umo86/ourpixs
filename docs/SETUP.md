# BizimResimler (and Our Pixs): going live

What is already done, and the steps that need an account owner. Every setting listed here is described in `apps/web/.env.example`.

## Already set up
- **GitHub:** `Umo86/ourpixs`, connected to the Vercel project `ourpixs` (root directory `apps/web`). Every push to `main` deploys to production.
- **Neon Postgres:** project `fancy-hall-12485138` (London). Migrations 0000 to 0003 are applied; 0004 and 0005 are new (see step 3), 0006 (see step 7), 0007, 0008, 0009 and 0010 (see step 3).
- **Vercel Blob:** media storage in London (temporary: originals are not private on Blob; production needs R2, step 4).
- **Vercel settings:** `DATABASE_URL`, `AUTH_SECRET`, `GUEST_TOKEN_SECRET`, `CRON_SECRET`, `DEFAULT_BRAND`, `PREVIEW_SHOW_CODE`, `BLOB_READ_WRITE_TOKEN`.

## 1. Domains (Vercel → Project → Settings → Domains)
**bizimresimler.com is the primary domain** (the main brand, BizimResimler: Turkish and English, the language follows the visitor's phone or browser). **ourpixs.com** is the English alias brand, Our Pixs: same app, English by default.
1. Add `bizimresimler.com`, `www.bizimresimler.com`, `ourpixs.com` and `www.ourpixs.com`.
2. Point the DNS at Vercel: an A record `76.76.21.21` for each apex, and a CNAME `cname.vercel-dns.com` for each `www`.
3. Set `NEXT_PUBLIC_URL_TR=https://bizimresimler.com` (BizimResimler) and `NEXT_PUBLIC_URL_EN=https://ourpixs.com` (Our Pixs), then redeploy.
4. Set `DEFAULT_BRAND=bizimresimler`. It is the brand for every other host name (`*.vercel.app`, preview URLs, localhost). Leaving it unset gives the same result.

Both domains serve the same app; the domain decides the brand. Only the exact domains (and their subdomains) count: `ourpixs.vercel.app` is BizimResimler.

Language: on bizimresimler.com a first-time visitor gets Turkish if their phone/browser prefers Turkish, otherwise English. ourpixs.com is English by default. The EN/TR switch (the `lang` cookie) always wins, and `?lang=en` / `?lang=tr` on any URL pins a language (search engines use these URLs: each page lists both as hreflang alternates, with the bare URL as `x-default`).

## 2. Email (Resend)
Production sign-in needs this. In production, login codes are never shown on screen.
One address for everything: **hello@bizimresimler.com** sends every email (both brands) and is the support address.
1. Create a Resend account and add **bizimresimler.com** as the sending domain (ourpixs.com does not need verifying). Add the DNS records it gives you (SPF, DKIM).
2. Set `RESEND_API_KEY`, `EMAIL_FROM_EN="Our Pixs <hello@bizimresimler.com>"` (Our Pixs accounts) and `EMAIL_FROM_TR="BizimResimler <hello@bizimresimler.com>"` (BizimResimler accounts, English or Turkish).
3. Remove `PREVIEW_SHOW_CODE`.
4. Set up one inbox for `hello@bizimresimler.com`. Support replies go there. `NEXT_PUBLIC_SUPPORT_EMAIL` can override the address shown on the site (default `hello@bizimresimler.com`). Unsubscribe requests by email (`mailto:` in the List-Unsubscribe header) also land there: withdraw them on `/admin/consents` (search the address) or tell the person to use the link.
5. **Marketing email and one-click unsubscribe.** No marketing campaigns exist yet; when they do, they must go through `sendMarketingEmail()` (`apps/web/src/lib/consent.ts`), which refuses addresses without a current opt-in and adds a visible unsubscribe link plus the `List-Unsubscribe` and `List-Unsubscribe-Post: List-Unsubscribe=One-Click` headers (sent to Resend as custom `headers`; Gmail and Yahoo require them for bulk senders). Nothing to switch on in Resend. Optional: set `UNSUBSCRIBE_SECRET` (any long random string) so unsubscribe links don't depend on `AUTH_SECRET`; set it before the first marketing email and never change it afterwards (old links would stop working).
6. Guests who asked on the event page get one "the gallery has closed" email from the daily expiry job (or as soon as the event is opened after it ends). That needs Resend too.

## 3. Payments (Stripe, GBP) — the event package
One price per event, paid once by the host: **£69** by default (VAT included), editable on `/admin/settings` (stored in the `settings` table; defaults in `PACKAGE_DEFAULTS`, `apps/web/src/lib/config.ts`). Stripe Checkout runs in `payment` mode with the price sent inline, so **no products or prices need to be created** in Stripe, and Checkout offers card, Apple Pay and Google Pay itself (turn them on under Settings → Payment methods). The product is always named "BizimResimler · Event package", on both domains. Set the Stripe account's public business name and statement descriptor to BizimResimler.
1. Activate the Stripe account (UK business details).
2. Set `STRIPE_SECRET_KEY`. **Test key only** (`sk_test_…`) until Umit says yes to live payments; `/admin/system` shows which mode the key is in.
3. Add a webhook at `https://bizimresimler.com/api/stripe/webhook` (one endpoint serves both domains; on the preview, use the preview URL) with these events, then set `STRIPE_WEBHOOK_SECRET`:
   `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `charge.refunded` (the same events serve guest downloads).
   (The old subscription events — `customer.subscription.*`, `invoice.*` — can be removed from the endpoint; they're ignored.)
4. Apple Pay: verify both domains under Settings → Payment methods → Apple Pay (Stripe hosts the verification file for Checkout).
5. Refunds are done by hand in the Stripe dashboard. Full refund any time before the gallery goes live (our promise); after it's live, within 14 days of paying, a pro-rata refund (Consumer Contracts Regulations). A **full** refund makes the event `refunded` (read-only, closed to guests) through the `charge.refunded` webhook; partial refunds only update the payment record. A second payment for an already-paid event is flagged "Duplicate: refund" on `/admin/events/:id`.

Until step 2 is done, Pay buttons show "Payments coming soon". The Customer Portal is no longer used.

**Database:** migrations `0004`–`0006` as before (`0005_drop_partner_plan` is intentionally left unapplied on some branches), then apply `0007_event_package` (additive: `occasions.package_status`, `paid_at`, `comped_at`, `opens_at`, `closes_at`, `time_zone`, `delete_after`, email markers, `fair_use_alerted_at`, `stripe_checkout_session_id`; `orders.kind`, `stripe_payment_intent_id`, `livemode`, `paid_at`, `refunded_at`; `orders.plan` becomes nullable; new `settings` table; legacy `orders` rows are marked `kind = 'legacy_plan'`). The old `hosts` subscription columns stay in the database, unused. Existing events start in `setup`.

**Guest downloads (£3, "download everything").** The same Stripe account and webhook also sell guests every photo and video of an event in full quality (price on `/admin/settings`, default £3; Checkout product "BizimResimler · Every photo and video"; metadata `kind = guest_download`). No extra Stripe setup. The guest gets a download page straight after paying and an email with a `/d/<token>` link valid 30 days (Resend must be configured for the email). A full refund in the Stripe dashboard ends that guest's access and kills the link; partial refunds don't. Guest purchases are listed on `/admin` (Recent payments) and on each event's admin page.

**Database:** apply `0008_short_kitty_pryde` (additive: new enum `media_processing_status`; `media.key_guest`, `key_guest_thumb`, `key_video`, `key_guest_video`, `processing_status` (default `pending`), `processed_at`, `processing_error`, `processing_attempts`, `processing_started_at`; new table `guest_purchases`). Apply it **before** deploying this code. Existing media start as `pending`: guests see them as "getting ready" until the media sweep has made their watermarked copies (run "Photo and video processing" on `/admin/system` a few times to backfill right away; each run handles up to 60 items).

**Database (consumer launch stage C):** apply `0009_illegal_sunset_bain` (additive: new tables `guest_contacts` and `marketing_consents`; `guest_purchases.waiver_accepted_at`, `waiver_wording`). Apply it **before** deploying this code: the guest purchase, guest email card, host sign-in and dashboard write to these.

**Database (payment records kept, review fix):** apply `0010_short_energizer` (safe, no data change: `orders.occasion_id`, `orders.host_id` and `guest_purchases.occasion_id` become nullable and their foreign keys change to `ON DELETE SET NULL`). Apply it **before** deploying this code. Deleting an event or an account now keeps its payment rows in anonymised form (amount, dates, kind, live/test flag and Stripe ids stay; the links to the event and host are cut, a guest buyer's email and download token are cleared), as the privacy policy promises (six years). If the code runs before the migration, deleting an account that has payments fails safely with a database error instead of deleting the records.

## 4. Storage: Cloudflare R2 (required before going live)
Originals must stay private: they are only ever handed out as signed links that expire within an hour, after the permission or payment check. **Vercel Blob can't do that** (its URLs are public and never expire, only unguessable), so Blob is a stop-gap for previews and `/admin/system` shows a red warning while it is in use. Newer Vercel Blob stores can be private; switching to one would need a code change, so R2 remains the plan.
1. Cloudflare → R2 → create a bucket (e.g. `bizimresimler-media`, location hint Western Europe). Keep it **private**: no public access, no `r2.dev` subdomain, no custom public domain.
2. R2 → Manage API tokens → create a token with **Object Read & Write** on that bucket only. Note the account id, access key id and secret.
3. Bucket → Settings → CORS policy:
   ```json
   [{ "AllowedOrigins": ["https://bizimresimler.com", "https://www.bizimresimler.com", "https://ourpixs.com", "https://www.ourpixs.com"],
      "AllowedMethods": ["PUT", "GET", "HEAD"], "AllowedHeaders": ["Content-Type"], "ExposeHeaders": ["ETag"], "MaxAgeSeconds": 3600 }]
   ```
   (Add the preview URL while testing on a preview.) Browsers upload straight to R2 and download ZIPs straight from it.
4. Set `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` in Vercel and redeploy. R2 wins over Blob as soon as all four are set. Files already in Blob are not moved: switch before real events.

## 5. Media processing (previews, watermarks, videos)
After an upload completes the server makes the copies guests see: a ≈1,200 px watermarked preview and thumb for photos (sharp), and for videos a clean 1080p MP4, a 720p watermarked MP4 and posters (ffmpeg, bundled through `ffmpeg-static`). The watermark is the brand wordmark ("BizimResimler", or "Our Pixs" for ourpixs.com events), pre-rendered as PNGs in `apps/web/assets/watermark/`.
- How it runs: the upload completion request calls the internal route `POST /api/internal/media/process` (signed with a key derived from `CRON_SECRET`, or `GUEST_TOKEN_SECRET` if that's missing; not callable from outside). If that call fails, the completion request does the work itself. `/api/cron/media` retries anything still pending or failed after 10 minutes, at most 3 attempts per item.
- **Function time:** video transcoding needs long functions. These routes ask for `maxDuration = 300` seconds. **Check your Vercel plan's maximum function duration**: if the plan allows less, long videos will time out and stay "processing" (the item is marked failed after 3 attempts; the host still has the original). A 60-second phone video normally takes well under a minute; 4K or HDR clips take longer.
- **Cron frequency:** on Hobby, crons run once a day, so the retry sweep is daily (`52 5 * * *` in `apps/web/vercel.json`). On Pro, change it to every 10 minutes (`*/10 * * * *`).
- **Preview deployments with Vercel Authentication:** turn on Settings → Deployment Protection → "Protection Bypass for Automation". Vercel then provides `VERCEL_AUTOMATION_BYPASS_SECRET`, which the internal call sends. Without it the internal call is refused and the completion request processes the files itself (slower uploads finish the same).
- Bundle size: the processing functions carry ffmpeg (≈80 MB) and sharp (≈40 MB); about 125 MB in total, under Vercel's 250 MB limit. ffmpeg-static downloads its binary during `npm install` on Vercel.

## 6. Optional
- `OPENAI_API_KEY`: turns on the free automatic NSFW check for uploaded photos.
- **Vercel Pro:** lets the jobs run hourly instead of daily (`apps/web/vercel.json`). On Hobby the "gallery ended — download everything" email can lag up to a day; it is also sent as soon as the host (or a guest) opens an ended event. Functions run in London (`regions: ["lhr1"]`), next to the database.

## 7. Admin dashboard
A superadmin area at `/admin` on both domains (overview, users, events, moderation, enquiries, settings, audit log, system health).
1. **Database first:** apply migration `0006_admin_dashboard` (additive: new columns `hosts.comp_until`, `hosts.suspended_at`, `hosts.suspended_reason`, `occasions.admin_locked_at`, `leads.handled_at`; new tables `admin_audit`, `media_reports`, `cron_runs`; a few indexes), **then** deploy. The new code reads these columns on every request.
2. Set `ADMIN_EMAILS` in Vercel to a comma-separated list of admin emails (e.g. `you@bizimresimler.com`) and redeploy.
3. Sign in at `/login` with that email as usual, then open `/admin`. Admin pages need a sign-in from the last 12 hours; after that you're asked to sign in again.

Anyone who isn't on the list (or isn't signed in) gets a 404 on `/admin` and `/api/admin/*`. `/admin` is `noindex` and disallowed in `robots.txt`. Every admin change (settings, events marked as paid, suspensions, deletions, moderation, cron runs) is recorded in the audit log at `/admin/audit` with the admin's email and the reason typed.

What the admin overrides do:
- **Mark as paid (free)** on one event: a complimentary package (no payment); it opens on its gallery dates and follows the usual retention. "Back to setup" undoes it (only when there is no real payment).
- **Settings** (`/admin/settings`): event price, guest download price, longest gallery window, fair-use GB, longest video, retention months, the test-upload limit and after how many days unpaid events are deleted (default 90).
- **Deleted events kept for guests**: when an event is deleted (by its host, with the host's account, by an admin or as unpaid) or passes retention while guests still hold paid download links, its photos and videos are kept for those guests only until the last link expires; the event page in admin says so ("Deleted by host · files kept until <date> for N guest purchases"; filter **Deleted · kept for guests** on `/admin/events`). The daily cleanup cron deletes the files and the event afterwards. Such an event can still be locked (which ends those links), but not restored.
- **Fair use**: events past the limit are flagged on `/admin/events` (and admins in `ADMIN_EMAILS` get one email each); "Clear fair-use flag" resets it.
- **Suspend**: the host can't sign in or use the app (a neutral "account suspended, contact support" message); their events stay viewable for guests but read-only, downloads locked.
- **Close guest uploads** on one event: read-only until reopened. Archive hides an event from guests; delete removes it with every file.
- **Run now** on `/admin/system` runs the same expiry / cleanup job as the daily schedule.
- **Payments** (`/admin/payments`): every event package and guest download, filtered by kind, status, live/test and dates, with totals. Real money only: set Mode to Live.
- **Marketing consents** (`/admin/consents`): who opted in to offers and news, the exact wording they saw, where and when, and withdrawals. **Download CSV** exports the filtered list (UTF-8, opens in Excel); every export is written to the audit log with the filters and row count. Treat the file as personal data: keep it out of shared drives and delete it when done.

## 8. Mobile apps (Expo / EAS)
See `apps/mobile/README.md` and `apps/mobile/store/checklist.md`. In short:
1. Run `npm i -g eas-cli`, then `eas login`, then `eas init` in `apps/mobile`.
2. Replace the placeholder icon and splash in `apps/mobile/assets`.
3. Run `eas build --platform all --profile production`.
4. Set `APPLE_TEAM_ID` and `ANDROID_SHA256_FINGERPRINTS` (from `eas credentials`) in Vercel, so universal links work. The app is "BizimResimler", bundle id / package `com.bizimresimler.app`.
5. Set `REVIEW_EMAIL` and `REVIEW_CODE` in Vercel, and put the same values in the review notes for App Store Connect and Play Console.
6. Google Play: run a closed test with at least 12 testers for 14 days before production access.
7. Run `eas submit --platform ios` and `eas submit --platform android`, using the metadata in `apps/mobile/store/`.

## 9. Legal (before launch)
- Fill in `[COMPANY NAME]`, `[COMPANY NUMBER]`, `[REGISTERED ADDRESS]` and `[ICO REGISTRATION NUMBER]` on the privacy and terms pages.
- Register with the ICO (data protection fee).
- Have a solicitor review the privacy policy and terms. Sections changed for the event package and for the consumer launch (guest email, marketing consent and unsubscribe, the £3 guest download with the immediate-supply / cancellation-right checkbox and its 30-day link surviving event removal, watermarked previews, processors, retention, unpaid events deleted after 90 days) show an "Updated · to be checked" badge (the `review: true` flag in `messages/*/marketing.json`); remove the flag once approved.

## Local development
```bash
cd apps/web && cp .env.example .env.local   # fill in values
npm install && npm run dev
npx tsc --noEmit && npm run build           # must pass before every push
# paywall rules (who gets which copy, who may download originals) and the sharp/ffmpeg pipeline, no database needed:
npx tsx --conditions=react-server --require ./scripts/server-only-shim.cjs scripts/paywall-check.ts
npx tsx --conditions=react-server --require ./scripts/server-only-shim.cjs scripts/media-smoke.ts
```
Printable QR cards: `npx tsx scripts/qr-cards-sample.ts /tmp/qr-cards` writes sample A6/A5 PDFs (EN/TR, three designs, plus bleed and crop marks) without a database. The fonts are DejaVu (Bitstream Vera licence, `assets/fonts/LICENSE-DejaVu.txt`).
Watermark PNGs: `node scripts/make-watermarks.mjs` re-renders `assets/watermark/` (needs DejaVu Sans Bold; only when the wordmark changes).
