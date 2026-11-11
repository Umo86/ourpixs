# Our Pixs / Bizim Resimler: going live

What is already done, and the steps that need an account owner. Every setting listed here is described in `apps/web/.env.example`.

## Already set up
- **GitHub:** `Umo86/ourpixs`, connected to the Vercel project `ourpixs` (root directory `apps/web`). Every push to `main` deploys to production.
- **Neon Postgres:** project `fancy-hall-12485138` (London). Migrations 0000 to 0003 are applied; 0004 and 0005 are new (see step 3).
- **Vercel Blob:** media storage in London.
- **Vercel settings:** `DATABASE_URL`, `AUTH_SECRET`, `GUEST_TOKEN_SECRET`, `CRON_SECRET`, `DEFAULT_BRAND`, `PREVIEW_SHOW_CODE`, `BLOB_READ_WRITE_TOKEN`.

## 1. Domains (Vercel → Project → Settings → Domains)
1. Add `ourpixs.com`, `www.ourpixs.com`, `bizimresimler.com` and `www.bizimresimler.com`.
2. Point the DNS at Vercel: an A record `76.76.21.21` for each apex, and a CNAME `cname.vercel-dns.com` for each `www`.
3. Set `NEXT_PUBLIC_URL_EN=https://ourpixs.com` and `NEXT_PUBLIC_URL_TR=https://bizimresimler.com`, then redeploy.

Both domains serve the same app; the domain decides the brand.

## 2. Email (Resend)
Production sign-in needs this. In production, login codes are never shown on screen.
1. Create a Resend account and add both domains as sending domains. Add the DNS records it gives you (SPF, DKIM).
2. Set `RESEND_API_KEY`, `EMAIL_FROM_EN="Our Pixs <hello@ourpixs.com>"` and `EMAIL_FROM_TR="Bizim Resimler <merhaba@bizimresimler.com>"`.
3. Remove `PREVIEW_SHOW_CODE`.
4. Set up inboxes (or forwarding) for `hello@ourpixs.com` and `merhaba@bizimresimler.com`. Support replies go there.

## 3. Payments (Stripe, GBP)
One account subscription: Monthly £9.99 or Yearly £69.99, VAT included (`SUBSCRIPTION` in `apps/web/src/lib/config.ts`). Checkout sends the prices inline, so **no products or prices need to be created** in Stripe.
1. Activate the Stripe account (UK business details).
2. Set `STRIPE_SECRET_KEY`. Use a test key first.
3. Add a webhook at `https://ourpixs.com/api/stripe/webhook` (one endpoint serves both domains) with these events, then set `STRIPE_WEBHOOK_SECRET`:
   `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`.
4. Turn on the Customer Portal (Settings → Billing → Customer portal):
   - Cancellations: allow, **at the end of the billing period** (not immediately).
   - Subscriptions: allow customers to **switch plans**. The portal can only switch to prices of products listed there, and Checkout's inline prices create a one-off product per checkout. So create one product (e.g. "Our Pixs") with two prices, £9.99/month and £69.99/year (VAT inclusive), and add both to the portal's product list; any subscription can then switch to them. Without this step hosts can still cancel and resubscribe on the other interval.
   - Payment methods and invoice history: allow.
5. Settings → Billing → Subscriptions and emails: turn on emails for failed payments and **upcoming renewal reminders** (the terms promise a reminder before a yearly renewal).
6. Refunds (14-day money-back guarantee on the first payment) are done by hand in the Stripe dashboard: refund the payment and cancel the subscription.

Until step 2 is done, the subscribe buttons show "Payments coming soon".

**Database:** apply migration `0004_account_subscriptions` (adds the billing columns; hosts who already have events start their 3-day trial at that moment), deploy, then apply `0005_drop_partner_plan` (drops the old partner tables and branding columns).

## 4. Optional
- `OPENAI_API_KEY`: turns on the free automatic NSFW check for uploaded photos.
- **Cloudflare R2 instead of Blob:** private bucket with presigned URLs. Set the four `R2_*` settings, and add a CORS rule that allows PUT and GET from both domains, the `Content-Type` header, and exposes `ETag`.
- **Vercel Pro:** lets the clean-up job run hourly instead of daily (`apps/web/vercel.json`). Functions run in London (`regions: ["lhr1"]`), next to the database.

## 5. Mobile apps (Expo / EAS)
See `apps/mobile/README.md` and `apps/mobile/store/checklist.md`. In short:
1. Run `npm i -g eas-cli`, then `eas login`, then `eas init` in `apps/mobile`.
2. Replace the placeholder icon and splash in `apps/mobile/assets`.
3. Run `eas build --platform all --profile production`.
4. Set `APPLE_TEAM_ID` and `ANDROID_SHA256_FINGERPRINTS` (from `eas credentials`) in Vercel, so universal links work.
5. Set `REVIEW_EMAIL` and `REVIEW_CODE` in Vercel, and put the same values in the review notes for App Store Connect and Play Console.
6. Google Play: run a closed test with at least 12 testers for 14 days before production access.
7. Run `eas submit --platform ios` and `eas submit --platform android`, using the metadata in `apps/mobile/store/`.

## 6. Legal (before launch)
- Fill in `[COMPANY NAME]`, `[COMPANY NUMBER]`, `[REGISTERED ADDRESS]` and `[ICO REGISTRATION NUMBER]` on the privacy and terms pages.
- Register with the ICO (data protection fee).
- Have a solicitor review the privacy policy and terms.

## Local development
```bash
cd apps/web && cp .env.example .env.local   # fill in values
npm install && npm run dev
npx tsc --noEmit && npm run build           # must pass before every push
```
