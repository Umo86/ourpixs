# Our Pixs / Bizim Resimler — engineering conventions

One platform, two brands, three surfaces:
- **ourpixs.com** — English-first brand "Our Pixs"
- **bizimresimler.com** — Turkish-first brand "Bizim Resimler"
- Both domains are served by ONE Next.js app (`apps/web`). The brand comes from the request host (`src/lib/config.ts → brandFromHost`). Never hard-code a brand name in UI; use `t("brand.<brand>")` or `BRANDS[brand].name`.
- **apps/mobile** — Expo (React Native) app for iOS and Android. It talks to the web app's JSON API under `/api/v1/*`.

Guests never install anything: they scan a QR code and use the web guest app at `/g/[slug]`. The mobile app is primarily for hosts (and also lets anyone join an event by scanning a QR).

## Repo layout
```
apps/web/                Next.js 15 App Router, TypeScript, Tailwind v4
  src/app/(marketing)/   public website: /, /features, /pricing, /partners, /privacy, /terms, /credits
  src/app/(host)/        host app: /login, /dashboard, /dashboard/new, /dashboard/[id]/...
  src/app/g/[slug]/      guest web app (welcome, feed, upload, missions, camera, guestbook)
  src/app/wall/[slug]/   live wall slideshow
  src/app/s/[token]/     family-abroad share link
  src/app/api/           route handlers; mobile API under /api/v1
  src/db/                Drizzle schema + client (Neon serverless HTTP)
  src/lib/config.ts      brands, occasions, plans, themes — SINGLE SOURCE OF TRUTH
  src/i18n/              getT (server), useT (client), message files in src/messages/{en,tr}/*.json
  src/components/ui/     shared design-system components
apps/mobile/             Expo SDK (latest), Expo Router, TypeScript
```

## Language
- Supported locales: `en`, `tr`. Every user-facing string goes through i18n. No string literals in JSX except proper nouns.
- Server: `const { t, locale } = await getT("marketing")`. Client: `const t = useT("guest")` (inside `<I18nProvider>`).
- Message namespaces: `common`, `marketing`, `host`, `guest`. Each namespace has an EN and TR JSON file. Add keys to BOTH files. Write natural Turkish (not translated-sounding): "Harika! 3 fotoğraf yüklendi", "İnternet zayıf, yüklemeler devam edecek".
- Language switch sets the `lang` cookie (`setLanguage` in `src/i18n/client.tsx`). Guest pages use `getT(ns, { preferBrowser: true })` so a Turkish phone gets Turkish.

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
- Media storage is behind `src/lib/storage.ts` (presigned PUT/GET). Driver chosen by env: `R2_*` vars → Cloudflare R2 (S3 API); else `BLOB_READ_WRITE_TOKEN` → Vercel Blob; else a clear "storage not configured" error. Browser uploads go directly to storage, never through a Vercel function body.
- Plan limits from `PLANS` in `src/lib/config.ts`, enforced server-side.
- Email via Resend (`RESEND_API_KEY`, `EMAIL_FROM_EN`, `EMAIL_FROM_TR`). If not configured and `PREVIEW_SHOW_CODE=1`, the login code is returned to the UI for testing (never in production).
- Stripe Checkout one-off GBP (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`). If not configured, upgrade buttons show "Payments coming soon".
- `noindex` on `/g`, `/s`, `/wall`, `/dashboard`.

## Code style
- TypeScript strict. Server Components by default; `"use client"` only where needed.
- Server Actions or route handlers with `zod` validation.
- Keep files focused; shared UI goes in `src/components/ui`.
- Before finishing any task: `npx tsc --noEmit` and `npm run build` pass in `apps/web`.
