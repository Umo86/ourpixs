# BizimResimler (+ Our Pixs alias) — engineering conventions

One platform, one main brand plus an English alias, three surfaces:
- **bizimresimler.com** — the main brand **"BizimResimler"** (one word, capital R). Turkish + English: a first-time visitor's language follows their phone/browser (Turkish → `tr`, anything else → `en`); the EN/TR switch wins after that. Turkish suffixes take an apostrophe: BizimResimler'e, BizimResimler'de, BizimResimler'i, BizimResimler'in.
- **ourpixs.com** — "Our Pixs", the English alias brand (English by default, switch still works). Secondary: wherever both names appear, BizimResimler comes first (or alone).
- Both domains are served by ONE Next.js app (`apps/web`). The brand comes from the request host (`src/lib/config.ts → brandFromHost`, exact domains + subdomains; any other host, e.g. `*.vercel.app` or localhost, → `DEFAULT_BRAND`, default `bizimresimler`). Never hard-code a brand name in UI; use `t("brand.<brand>")` or `BRANDS[brand].name` (`MAIN_BRAND` for legal/Stripe/JSON-LD).
- **apps/mobile** — Expo (React Native) app "BizimResimler" (`com.bizimresimler.app`) for iOS and Android. It talks to the web app's JSON API under `/api/v1/*` (default `https://bizimresimler.com`) and follows the phone language.
- One email address for everything: **hello@bizimresimler.com** (support + sender for both brands).

Guests never install anything: they scan a QR code and use the web guest app at `/g/[slug]`. The mobile app is primarily for hosts (and also lets anyone join an event by scanning a QR).

## Repo layout
```
apps/web/                Next.js 15 App Router, TypeScript, Tailwind v4
  src/app/(marketing)/   public website: /, /features, /pricing, /privacy, /terms, /credits, /help, /guides, /templates (/partners redirects to /pricing)
  src/app/(host)/        host app: /login, /dashboard, /dashboard/new, /dashboard/[id]/...
  src/app/g/[slug]/      guest web app (welcome, feed, upload, missions, camera, guestbook)
  src/app/wall/[slug]/   live wall slideshow
  src/app/s/[token]/     family-abroad share link
  src/app/admin/         superadmin dashboard (ADMIN_EMAILS only, 404 for everyone else); routes under /api/admin, helpers in src/lib/admin*.ts
  src/app/api/           route handlers; mobile API under /api/v1
  src/db/                Drizzle schema + client (Neon serverless HTTP)
  src/lib/config.ts      brands, occasions, package defaults, themes — SINGLE SOURCE OF TRUTH (live prices/limits: src/lib/settings.ts)
  src/i18n/              getT (server), useT (client), message files in src/messages/{en,tr}/*.json
  src/components/ui/     shared design-system components
apps/mobile/             Expo SDK (latest), Expo Router, TypeScript
```

## Language
- Supported locales: `en`, `tr`. Every user-facing string goes through i18n. No string literals in JSX except proper nouns.
- Server: `const { t, locale } = await getT("marketing")`. Client: `const t = useT("guest")` (inside `<I18nProvider>`).
- Message namespaces: `common`, `marketing`, `host`, `guest`, `admin`. Each namespace has an EN and TR JSON file. Add keys to BOTH files. Write natural Turkish (not translated-sounding): "Harika! 3 fotoğraf yüklendi", "İnternet zayıf, yüklemeler devam edecek".
- Locale (`getLocale` in `src/i18n/index.ts`): `lang` cookie (the EN/TR switch via `setLanguage` in `src/i18n/client.tsx`, or `?lang=en|tr` pinned by middleware) > Accept-Language (`src/i18n/negotiate.ts`) on bizimresimler.com > brand default (`en`). On ourpixs.com only guest pages (`getT(ns, { preferBrowser: true })`) follow the phone. Pages read cookies/headers, so they render per request with `Cache-Control: private, no-store` and a response is never shared between visitors: never make a language-dependent page static (`force-static`, ISR, `revalidate`).
- SEO: bizimresimler.com pages list hreflang `en` → `?lang=en`, `tr` → `?lang=tr`, `x-default` → bare URL (`src/components/marketing/meta.ts`, `sitemap.ts`); ourpixs.com pages have a self canonical and no hreflang.

## Design system (Version 2 — "stylish, fun, high-end")
- Colours: black `#0A0A0A`, white `#FFFFFF`, royal blue `#2347E0` (hover `#16309F`), on-dark blue `#4D6BFF` / `#8097FF`, tint `#F2F4FB`, greys `#3A3A3A` text-2, `#6B6B6B` muted (on white only), `#C8CAD2` muted-on-dark, `#15171F` dark surface, `#23262F` dark surface-2.
- Type: **Inter Tight** (UI + huge 800–900 weight headlines, tight letter-spacing) and **Bodoni Moda italic** for 1–3 emphasis words, often in blue. Loaded via `next/font/google` as CSS vars `--font-sans`, `--font-serif`. Tailwind: `font-sans`, `font-serif`.
- Shapes: pill buttons (`rounded-full`), 24–32px rounded cards, the occasional rotated "sticker" badge. Photos are large, full-bleed, rounded.
- Mobile-first. Touch targets ≥ 44px. Contrast ≥ 4.5:1. Real `<button>`, `<a>`, `<label>`. Visible focus rings (`focus-visible:ring-2 ring-[#4D6BFF]`).
- No emoji in UI. Icons: inline SVG (lucide-style 24px stroke 2) or `lucide-react`.
- Guest app is dark (black background). Host dashboard is light. Marketing alternates.

## Data & security rules
- DB: `import { db, schema } from "@/db"`. Drizzle ORM, `drizzle-orm/neon-http`. No raw string SQL with user input.
- NOTE: the dev sandbox cannot reach Neon or most external hosts. Verify your work with `npx tsc --noEmit` and `npm run build` (from `apps/web`). Don't try to run queries locally.
- Host auth: email + 6-digit code (stored hashed in `login_tokens`), then a signed JWT session cookie `op_session` (HS256, `AUTH_SECRET`, `jose`). Mobile gets the same JWT as a Bearer token. Helpers in `src/lib/auth.ts`.
- Guest identity: per-occasion httpOnly cookie `op_g_<slug>` holding an HMAC-signed random device token (`GUEST_TOKEN_SECRET`); DB stores only its hash.
- Every host route/API checks membership in `occasion_members`.
- Media storage is behind `src/lib/storage.ts` (presigned PUT/GET). Driver chosen by env: `R2_*` vars → Cloudflare R2 (S3 API, **private** bucket); else `BLOB_READ_WRITE_TOKEN` → Vercel Blob (public-but-unguessable URLs: previews only, does NOT keep originals private); else a clear "storage not configured" error. Browser uploads go directly to storage, never through a Vercel function body.
- **Media pipeline and paywall** (never weaken these):
  - Copies: the browser uploads the original + a clean ≈2,000 px WebP display + ≈400 px thumb. After upload completion the server (`src/lib/media-processing.ts`, via `POST /api/internal/media/process`, HMAC-signed, `maxDuration` 300; inline fallback; cron sweep `/api/cron/media`, 3 attempts) makes the WATERMARKED guest preview (≈1,200 px) and guest thumb with `sharp`, and for videos a clean 1080p H.264 MP4, a 720p watermarked MP4 and clean/watermarked posters with `ffmpeg-static`. Columns: `key_guest`, `key_guest_thumb`, `key_video`, `key_guest_video`, `processing_status` (pending/ready/failed).
  - Watermarks are pre-rendered PNGs in `apps/web/assets/watermark/<brand>/` (`scripts/make-watermarks.mjs`); never render text at runtime. The event's brand picks the wordmark. ffmpeg and the PNGs reach the functions through `outputFileTracingIncludes` in `next.config.ts`: a new route that processes media must be added there.
  - Who sees what is decided ONLY by `planMediaKeys` in `src/lib/media-urls.ts` (used by `toMediaItems`): hosts, co-hosts and the live wall get clean copies; a guest gets clean copies of their OWN uploads; a guest whose device bought "download everything" (`purchased`, decided only by `guestSeesClean` in `purchase-rules.ts`: paid, not refunded, inside 30 days, event downloads open) and the buyer's `/d/<token>` page (audience `buyer`) get clean copies of everything; everyone else (other guests, share links) gets watermarked copies, and nothing at all while processing (never a fallback to a clean copy or the original). `originalUrl` is always null in lists.
  - The live wall (`/wall/[slug]`, `wallMedia` in `src/lib/queries.ts`) only shows items whose copies are READY (photos: clean display; videos: the clean 1080p MP4, muted). It polls with a `cursor` (max `processed_at`) so items that finish processing later still arrive.
  - Originals are handed out only by `privateGetUrl` (signed, ≤1 h) from permission-checked download endpoints: hosts/co-hosts of paid events (`assertCanDownload`), a guest's own uploads, and guests with a paid "download everything" purchase (`src/lib/guest-purchase.ts`, rules in `purchase-rules.ts`; emailed `/d/<token>` link valid 30 days, only its hash stored). `scripts/paywall-check.ts` asserts all of this: run it after touching serializers, storage or downloads.
- Business model: the **event package** — one price per event (default £69), paid once by the host via Stripe Checkout (mode `payment`). Prices and limits (guest download £3, window 7 days, fair use 50 GB, videos 60 s, retention 12 months, 20 test uploads) are admin-editable: read them through `src/lib/settings.ts` (`getSettings()`, defaults `PACKAGE_DEFAULTS` in `src/lib/config.ts`), never hard-code them. Event states: setup (free; host-only test mode) → paid → live (opens_at ≤ now < closes_at, the organiser's gallery window, ≤ windowDays) → ended (guest uploads closed; download email) → expired (closes_at + retentionMonths: files deleted), or refunded. All checks go through `src/lib/access.ts` (pure rules in `access-rules.ts`, exercised by `scripts/access-check.ts`), enforced server-side; an event's access derives from the event itself, not the account. The old `hosts` subscription columns are legacy and unused. No venue/partner plan.
- Email via Resend (`RESEND_API_KEY`, `EMAIL_FROM_EN`, `EMAIL_FROM_TR`). If not configured and `PREVIEW_SHOW_CODE=1`, the login code is returned to the UI for testing (never in production).
- **Guest email and marketing consent (UK GDPR / PECR)** — `src/lib/consent.ts`, never weaken:
  - Email is never needed to upload. After a device's 3rd successful upload the guest app offers (once, dismissible, remembered in localStorage) "email me the photos" (`POST /api/v1/g/:slug/contact` → `guest_contacts`). When the gallery ends, `sendGuestGalleryEmails` (expiry cron + lazy hooks in `package.ts`) sends each guest ONE transactional email: the gallery link and the event's own £3 offer, nothing else. Rows go with the event's files.
  - Marketing is a SEPARATE, UNTICKED opt-in (guest card, host sign-in form, host dashboard toggle). Each consent is a row in `marketing_consents` with the exact wording shown (rendered server-side from the same message key and locale via `consentWording`), source, locale, hashed IP, user agent and time. Withdrawal sets `withdrawn_at` on every current consent of that email + brand; withdrawn records are purged 2 years later (cleanup cron).
  - Marketing email goes ONLY through `sendMarketingEmail()`: it refuses without a current consent and adds the visible `/unsubscribe/<token>` link plus `List-Unsubscribe` / `List-Unsubscribe-Post: List-Unsubscribe=One-Click` (→ `POST /api/v1/unsubscribe/<token>`). The token is HMAC(`UNSUBSCRIBE_SECRET` or `AUTH_SECRET`, consent id); only its hash is stored. Never call `sendMarketingRaw` directly.
  - Guests buying "download everything" must tick the immediate-supply box first (CCR 2013 digital content: they lose the 14-day cancellation right); the API refuses without it (`400 waiver_required`) and stores the time and wording on `guest_purchases`.
- **Printable QR cards**: `GET /api/v1/occasions/:id/cards.pdf` (pdf-lib + fontkit, `src/lib/qr-cards.ts`, vector QR, one card per page at A6/A5 trim size, optional bleed/crop marks; works in setup). Fonts are the bundled DejaVu TTFs in `apps/web/assets/fonts/` (full Turkish coverage), traced through `outputFileTracingIncludes`. Sample PDFs: `npx tsx scripts/qr-cards-sample.ts /tmp/qr-cards`.
- Stripe Checkout in payment mode, GBP, inline price from settings (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`; `src/lib/billing.ts` for the event package, `src/lib/guest-purchase.ts` for guests' £3 "download everything" (metadata `kind: guest_download`); webhook events `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `charge.refunded`). Test keys only until live payments are approved. If not configured, Pay buttons show "Payments coming soon". The mobile store builds never sell or link to the event package (App Store 3.1.1 / Play billing).
- `noindex` on `/g`, `/s`, `/d`, `/wall`, `/dashboard`, `/admin`, `/unsubscribe`.
- Admin (`/admin`, `/api/admin/*`): every page calls `requireAdmin()` and every route uses `adminRoute()` / `requireAdminApi()` from `src/lib/admin.ts`; every mutation is zod-validated, rate-limited and written to `admin_audit`. Admin overrides (event marked as paid, suspension, event lock) live in `src/lib/access.ts` like every other access rule; product settings are edited on `/admin/settings`. `/admin/payments` lists event packages and guest purchases (filters: kind, status, live/test, dates; totals); `/admin/consents` lists marketing consents with an audited CSV export (`/api/admin/consents/export`).

## Code style
- TypeScript strict. Server Components by default; `"use client"` only where needed.
- Server Actions or route handlers with `zod` validation.
- Keep files focused; shared UI goes in `src/components/ui`.
- Before finishing any task: `npx tsc --noEmit` and `npm run build` pass in `apps/web`. Media/paywall changes: also `npx tsx --conditions=react-server --require ./scripts/server-only-shim.cjs scripts/paywall-check.ts` (and `scripts/media-smoke.ts` for the sharp/ffmpeg pipeline). Access rules: `scripts/access-check.ts`. QR card PDFs: `scripts/qr-cards-sample.ts`.
