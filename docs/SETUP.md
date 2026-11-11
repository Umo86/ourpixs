# BizimResimler (and Our Pixs): going live

What is already done, and the steps that need an account owner. Every setting listed here is described in `apps/web/.env.example`.

## Already set up
- **GitHub:** `Umo86/ourpixs`, connected to the Vercel project `ourpixs` (root directory `apps/web`). Every push to `main` deploys to production.
- **Neon Postgres:** project `fancy-hall-12485138` (London). Migrations 0000 to 0003 are applied; 0004 and 0005 are new (see step 3), and 0006 (see step 5).
- **Vercel Blob:** media storage in London.
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
4. Set up one inbox for `hello@bizimresimler.com`. Support replies go there. `NEXT_PUBLIC_SUPPORT_EMAIL` can override the address shown on the site (default `hello@bizimresimler.com`).

## 3. Payments (Stripe, GBP)
One account subscription: Monthly £9.99 or Yearly £69.99, VAT included (`SUBSCRIPTION` in `apps/web/src/lib/config.ts`). Checkout sends the prices inline, so **no products or prices need to be created** in Stripe. The checkout product is always named "BizimResimler — Monthly/Yearly", on both domains. Set the Stripe account's public business name and statement descriptor to BizimResimler.
1. Activate the Stripe account (UK business details).
2. Set `STRIPE_SECRET_KEY`. Use a test key first.
3. Add a webhook at `https://bizimresimler.com/api/stripe/webhook` (one endpoint serves both domains) with these events, then set `STRIPE_WEBHOOK_SECRET`:
   `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`.
4. Turn on the Customer Portal (Settings → Billing → Customer portal):
   - Cancellations: allow, **at the end of the billing period** (not immediately).
   - Subscriptions: allow customers to **switch plans**. The portal can only switch to prices of products listed there, and Checkout's inline prices create a one-off product per checkout. So create one product (e.g. "BizimResimler") with two prices, £9.99/month and £69.99/year (VAT inclusive), and add both to the portal's product list; any subscription can then switch to them. Without this step hosts can still cancel and resubscribe on the other interval.
   - Payment methods and invoice history: allow.
5. Settings → Billing → Subscriptions and emails: turn on emails for failed payments and **upcoming renewal reminders** (the terms promise a reminder before a yearly renewal).
6. Refunds (14-day money-back guarantee on the first payment) are done by hand in the Stripe dashboard: refund the payment and cancel the subscription.

Until step 2 is done, the subscribe buttons show "Payments coming soon".

**Database:** apply migration `0004_account_subscriptions` (adds the billing columns; hosts who already have events start their 3-day trial at that moment), deploy, then apply `0005_drop_partner_plan` (drops the old partner tables and branding columns).

## 4. Optional
- `OPENAI_API_KEY`: turns on the free automatic NSFW check for uploaded photos.
- **Cloudflare R2 instead of Blob:** private bucket with presigned URLs. Set the four `R2_*` settings, and add a CORS rule that allows PUT and GET from both domains (bizimresimler.com and ourpixs.com, with www), the `Content-Type` header, and exposes `ETag`.
- **Vercel Pro:** lets the clean-up job run hourly instead of daily (`apps/web/vercel.json`). Functions run in London (`regions: ["lhr1"]`), next to the database.

## 5. Admin dashboard
A superadmin area at `/admin` on both domains (overview, users, events, moderation, enquiries, audit log, system health).
1. **Database first:** apply migration `0006_admin_dashboard` (additive: new columns `hosts.comp_until`, `hosts.suspended_at`, `hosts.suspended_reason`, `occasions.admin_locked_at`, `leads.handled_at`; new tables `admin_audit`, `media_reports`, `cron_runs`; a few indexes), **then** deploy. The new code reads these columns on every request.
2. Set `ADMIN_EMAILS` in Vercel to a comma-separated list of admin emails (e.g. `you@bizimresimler.com`) and redeploy.
3. Sign in at `/login` with that email as usual, then open `/admin`. Admin pages need a sign-in from the last 12 hours; after that you're asked to sign in again.

Anyone who isn't on the list (or isn't signed in) gets a 404 on `/admin` and `/api/admin/*`. `/admin` is `noindex` and disallowed in `robots.txt`. Every admin change (trial extensions, complimentary access, cancellations, suspensions, deletions, moderation, cron runs) is recorded in the audit log at `/admin/audit` with the admin's email and the reason typed.

What the admin overrides do:
- **Complimentary access** (until a date): full access, downloads included; the daily jobs never expire, warn or delete the account while it lasts. Afterwards a read-only account gets its full grace period before anything is deleted.
- **Suspend**: the host can't sign in or use the app (a neutral "account suspended, contact support" message); their events stay viewable for guests but read-only, downloads locked.
- **Close guest uploads** on one event: read-only until reopened. Archive hides an event from guests; delete removes it with every file.
- **Run now** on `/admin/system` runs the same expiry / cleanup job as the daily schedule.

## 6. Mobile apps (Expo / EAS)
See `apps/mobile/README.md` and `apps/mobile/store/checklist.md`. In short:
1. Run `npm i -g eas-cli`, then `eas login`, then `eas init` in `apps/mobile`.
2. Replace the placeholder icon and splash in `apps/mobile/assets`.
3. Run `eas build --platform all --profile production`.
4. Set `APPLE_TEAM_ID` and `ANDROID_SHA256_FINGERPRINTS` (from `eas credentials`) in Vercel, so universal links work. The app is "BizimResimler", bundle id / package `com.bizimresimler.app`.
5. Set `REVIEW_EMAIL` and `REVIEW_CODE` in Vercel, and put the same values in the review notes for App Store Connect and Play Console.
6. Google Play: run a closed test with at least 12 testers for 14 days before production access.
7. Run `eas submit --platform ios` and `eas submit --platform android`, using the metadata in `apps/mobile/store/`.

## 7. Legal (before launch)
- Fill in `[COMPANY NAME]`, `[COMPANY NUMBER]`, `[REGISTERED ADDRESS]` and `[ICO REGISTRATION NUMBER]` on the privacy and terms pages.
- Register with the ICO (data protection fee).
- Have a solicitor review the privacy policy and terms.

## Local development
```bash
cd apps/web && cp .env.example .env.local   # fill in values
npm install && npm run dev
npx tsc --noEmit && npm run build           # must pass before every push
```
