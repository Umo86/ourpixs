# Consumer launch: agreed design

Source: Umit's "Business Features Brief" (consumer launch, steps 1–8) plus his answers on 14 Nov 2026.
Work only on branch `consumer-launch`. It deploys to a Vercel **preview** with its own Neon branch database (`consumer-launch`, br-dark-cell-za8203d3), so `main`, the live site, DNS, domains and live payments are never touched. Stripe in **test mode** only.

## Business model (replaces the account subscriptions)
- **One event package: £69 per event**, paid once by the host (organiser) through Stripe Checkout (mode `payment`, GBP; Apple Pay, Google Pay and card via automatic payment methods). The price is editable in admin.
- **The gallery is live for up to 7 days.** The organiser sets when it goes live and when it ends (start and end date/time, end ≤ start + 7 days, editable until it starts; can end early). The window length is editable in admin (default 7 days).
- Before paying, the host can set the event up for free: details, days, QR codes and cards, and a **test mode** where only the host can upload (up to 20 items) to see how it works. Guests can't join until the package is paid and the window has started. *(This replaces the old 3-day free trial: Umit chose "7 days for £69".)*
- **When the gallery ends**, guest uploads close and the host gets an email with a link to download everything in full quality (photos and videos, as a ZIP or per-day ZIPs). The host can also download any time from the dashboard during the window and afterwards.
- **Retention:** after the window ends, the event stays available to the host (and to paying guests) for **12 months**, then files are deleted. Reminder emails go out 30 days and 7 days before deletion. *(Assumption: Umit did not answer; 12 months is our default, editable in config.)*
- The monthly/yearly subscriptions are **removed** (nobody has paid). Keep `orders` for event-package and guest-download payments.
- Fair use: unlimited guests, photos and videos. **Videos up to 60 seconds each** (friendly message if longer, checked in the browser before upload and on the server). Background limit **50 GB per event**; past it, uploads keep working but admin gets an alert (dashboard flag and email). Both editable in admin.

## Guests
- QR code and short link → mobile web page. No app, no account. **First name only** to upload.
- Guests see the gallery as **low-resolution, watermarked previews** (photos and videos). Watermark: "BizimResimler" (or "Our Pixs" on ourpixs.com) plus the event name, semi-transparent, in a corner and repeated faintly.
- Guests can always see and keep their **own** uploads (they already have the originals on their phone).
- **Guests pay £3** (editable in admin) to download everything from the event in full quality: all photos and videos, one ZIP (or per-day ZIPs if large) through signed, expiring links, plus an email with a download link valid for **30 days**. Stripe Checkout, Apple Pay, Google Pay and card. Purchases are tied to the guest's device token and email.
- Email is optional and never needed to upload. After a guest has uploaded a few items (3), offer: "Want all the photos from this event emailed to you afterwards?" (email field). A **separate, unticked** box: "Send me offers and news from BizimResimler." Store each consent with a timestamp, the wording shown and the locale. Every marketing email has a one-click unsubscribe link.

## Storage and media pipeline
- Originals in a **private** bucket. Production target is **Cloudflare R2** (`R2_*` env). Until Umit creates the R2 bucket, the preview uses Vercel Blob; we flag that Blob objects are public-but-unguessable and so do **not** meet "originals only after payment" until R2 is set.
- On upload, create copies:
  - photos: **display** WebP about 2,000 px long edge (clean; host, slideshow), **guest preview** WebP about 1,200 px **watermarked**, and a small thumb (watermarked).
  - videos: **1080p H.264 MP4** (clean; host, slideshow), **720p watermarked** MP4 for guests, and a poster frame. Made on the server (ffmpeg in a Vercel Function after upload completes). Until it's ready the item shows "processing".
- The gallery and slideshow only ever load compressed copies. Guests never receive original or clean-display URLs unless they've paid; hosts receive clean copies, and originals only through the download endpoints.
- Originals are served only through **signed, expiring** links (≤ 1 hour for in-app downloads; the emailed link is a signed token valid 30 days that mints fresh short-lived links when opened).

## Printables and screen
- Printable table QR cards as **PDF in A6 and A5** with the couple's or host's names (plus the existing poster).
- Live slideshow for a venue screen showing new photos as they arrive (the existing `/wall/[slug]`), clean compressed copies.

## Admin
Super admin: events with status and window, **payments** (event packages and guest downloads, test/live flag), **storage per event** with the 50 GB flag, **marketing consents** (list and CSV export), pause an event, remove a photo or video. Prices, window days, fair-use GB, video seconds and retention editable in an admin **Settings** page (stored in a `settings` table, falling back to config defaults).

## Later, not now
Business accounts and branding, photographer uploads and FTP, watermarked photo sales by photographers, bundles, Stripe Connect payouts, find-my-photos face matching, marketing pack.

## Before going live (Umit's yes required)
- Stripe test keys on the preview; live keys only after his yes.
- Cloudflare R2 bucket and keys.
- Vercel Pro (Hobby doesn't allow commercial use).
- Privacy and terms checked by a solicitor.
