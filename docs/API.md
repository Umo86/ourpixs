# Mobile / JSON API contract (`/api/v1`)

Base URL: `https://bizimresimler.com` (or `https://ourpixs.com`; same backend). The request host decides the brand: bizimresimler.com and any host that is not one of our domains → `bizimresimler`; ourpixs.com → `ourpixs`. Language: `lang` cookie > `Accept-Language` (first supported language; Turkish → `tr`, anything else → `en`) > `en`. All bodies JSON. Errors: `{ "error": { "code": string, "message": string } }` with a 4xx/5xx status.
Auth: `Authorization: Bearer <jwt>` (same JWT as the web `op_session` cookie, 30-day expiry).

## Auth
- `POST /api/v1/auth/request-code` `{ email, locale?: "en"|"tr", brand?: "bizimresimler"|"ourpixs" }` (brand defaults to the request host's brand; the app sends `bizimresimler`) → `{ ok: true, previewCode?: string }` (previewCode only when PREVIEW_SHOW_CODE=1 and email not configured)
- `POST /api/v1/auth/verify` `{ email, code }` → `{ token, host: Host }` (also sets the `op_session` cookie for web). If env `REVIEW_EMAIL` and `REVIEW_CODE` are both set, that email signs in with that code (app-store review).
- `GET /api/v1/me` → `{ host: Host }` (no `subscription` any more: payments are per event — see "Event package" below)
- `PATCH /api/v1/me` `{ name?, locale? }` → `{ host }` (same shape as GET)
- `DELETE /api/v1/me` → `{ ok: true }` — deletes the account, events it owns (all files), memberships, push tokens. (Event packages are one-off payments; there is nothing to cancel.)
- `POST /api/v1/auth/logout` → `{ ok: true }` (web: clears the cookie)
- `POST /api/v1/push-tokens` `{ token, platform: "ios"|"android" }` → `{ ok: true }`

## Occasions (host)
- `GET /api/v1/occasions` → `{ occasions: OccasionSummary[] }`
- `POST /api/v1/occasions` `{ type, title, honorees: string[], startsOn?: "YYYY-MM-DD", venueName?, city?, theme?, days?: {name, date?}[], opensAt?: iso, closesAt?: iso, timeZone?: IANA }` → `{ occasion: Occasion }` — always free: the event starts in `setup` (test mode). Without `opensAt`/`closesAt` the window defaults to `startsOn` 10:00 in `timeZone` (default `Europe/London`) for `windowDays` days. (`trialStarted` was removed.)
- `GET /api/v1/occasions/:id` → `{ occasion: Occasion, stats: Stats }`
- `PATCH /api/v1/occasions/:id` `{ title?, honorees?, startsOn?, venueName?, city?, theme?, approvalMode?, revealMode?, revealAt?, uploadOpensAt?, uploadClosesAt?, pin?: string|null, disposableShots?: number|null, opensAt?, closesAt?, timeZone? }` → `{ occasion }` — see "Event package" for the window rules.
- `DELETE /api/v1/occasions/:id` → `{ ok: true }`
- `GET /api/v1/occasions/:id/media?cursor=&dayId=&moment=&guestId=&kind=photo|video&filter=favourites|hidden|pending` → `{ items: MediaItem[], nextCursor: string|null }`
- `PATCH /api/v1/occasions/:id/media` `{ ids: string[], action: "hide"|"show"|"delete"|"favourite"|"unfavourite"|"approve" }` → `{ ok: true }`
- `POST /api/v1/occasions/:id/uploads` (host uploads) — same shape as the guest uploads endpoint below
- `GET /api/v1/occasions/:id/messages` → `{ messages: Message[] }`
- `GET|POST|DELETE /api/v1/occasions/:id/missions` → `{ missions: Mission[] }` (POST `{ title }`, DELETE `?missionId=`)
- `GET|POST /api/v1/occasions/:id/share-links` → `{ links: ShareLink[] }` (POST `{ label?, scope }`)
- `GET /api/v1/occasions/:id/download?dayId=` → `{ files: { id, name, url, mime, kind, bytes, dayId, guestName, createdAt }[], totalBytes }` — ZIP manifest: every visible original (oldest first) with signed download URLs (≤1 hour, minted per request). Hosts and co-hosts only. `402 payment_required` before the event is paid (other states: `410 event_expired`, `403 download_closed` / `account_suspended`). Above ~2 GB, download one day at a time.
- `POST /api/v1/occasions/:id/download` `{ ids: string[] }` (1–500) → same manifest for a selection (hidden items included).
- `GET /api/v1/occasions/:id/media/:mediaId/download` → `{ url }` — signed download URL (≤1 hour) for one original. Same errors as above. This and the manifest are the ONLY way hosts get originals.

## Guest (web guest app + mobile "join by QR")
Guest auth is a cookie on web; on mobile pass header `X-Guest-Token: <token>` returned by join.
- `GET /api/v1/g/:slug` → `{ occasion: PublicOccasion, guest, uploadsOpen: boolean }` (requires PIN cookie/header `X-Occasion-Pin` if set)
- `POST /api/v1/g/:slug/join` `{ name, consent: true, pin? }` → `{ guestToken, guest: { id, displayName }, uploadsOpen: boolean }` — only while the gallery is live or ended (`403 not_open` before it opens, `410 event_unavailable` after a refund or deletion). After it ends guests can still join and look.
- `GET /api/v1/g/:slug/feed?after=<iso>&cursor=` → `{ items: MediaItem[], nextCursor, uploadsOpen: boolean }`
- `POST /api/v1/g/:slug/uploads` `{ files: { clientId, name, mime, bytes, kind, width?, height?, durationS?, dayId?, momentTag?, missionId?, fromDisposable?, hasDisplay: boolean, hasThumb: boolean }[] }` → `{ uploads: { clientId, mediaId, original: { url, method: "PUT", headers }, display?: {...}, thumb?: {...} }[] }`
- `POST /api/v1/g/:slug/uploads/complete` `{ mediaIds: string[] }` → `{ ok: true }`
- `POST /api/v1/g/:slug/reactions` `{ mediaId }` → `{ reacted: boolean, count: number }` (toggles)
- `GET /api/v1/g/:slug/missions` → `{ missions: (Mission & { done: boolean, doneCount: number })[] }`
- `POST /api/v1/g/:slug/messages` `{ kind: "text"|"voice"|"video", body?, mediaKey? }` → `{ message }`
- `GET /api/v1/g/:slug/mine` → `{ items: MediaItem[] }`; `DELETE /api/v1/g/:slug/mine?mediaId=`

## Types
```ts
type Host = { id: string; email: string; name: string|null; locale: "en"|"tr"; brand: "ourpixs"|"bizimresimler" };
type PackageStatus = "setup"|"paid"|"live"|"ended"|"expired"|"refunded"; // effective state (stored state + the clock)
// canUpload = the host's and co-hosts' upload right (test mode included); guests follow PublicOccasion.uploadsOpen.
type OccasionAccess = { canUpload: boolean; canDownload: boolean; readOnly: boolean; reason: "setup"|"not_open"|"ended"|"expired"|"refunded"|"suspended"|"locked"|null };
type EventPackage = { status: PackageStatus; pricePence: number; paidAt: string|null; comped: boolean; opensAt: string|null; closesAt: string|null; timeZone: string; deleteAfter: string|null; testMode: boolean; testUploadLimit: number; canEditWindow: boolean; canEndEarly: boolean; canPay: boolean; windowDays: number; daysLeft: number|null };
type OccasionSummary = { id; slug; type; title; startsOn: string|null; coverUrl: string|null; mediaCount: number; guestCount: number; role: "owner"|"cohost"; access: OccasionAccess; packageStatus: PackageStatus; opensAt: string|null; closesAt: string|null; deleteAfter: string|null; testMode: boolean; timeZone: string };
type Occasion = OccasionSummary & { honorees: string[]; venueName; city; theme; brand; approvalMode: boolean; revealMode: "live"|"next_morning"; revealAt; uploadOpensAt; uploadClosesAt; hasPin: boolean; disposableShots: number|null; storageExpiresAt /* = package.deleteAfter, null before paying */; days: { id; name; date; sortOrder }[]; guestUrl: string; wallUrl: string; package: EventPackage };
type Stats = { guests: number; photos: number; videos: number; messages: number; bytes: number; pendingApproval: number };
type PublicOccasion = { slug; type; title; honorees; startsOn; venueName; city; theme; brand; days; moments: string[]; liveWall: boolean; missionsEnabled: boolean; disposableShots: number|null; voiceGuestbook: boolean; uploadOpen: boolean; uploadsOpen: boolean; downloadsOpen: boolean; revealMode; revealAt; galleryState: "not_open"|"live"|"ended"|"unavailable"; opensAt: string|null; closesAt: string|null; timeZone: string; videoMaxSeconds: number };
// CHANGED (Nov 2026, media copies): originalUrl is ALWAYS null in lists (host album, guest feed and "mine", share links,
// live wall). Originals only come from the download endpoints as signed links (≤1 h).
// thumbUrl/displayUrl/playbackUrl are compressed copies: CLEAN for hosts/co-hosts, the live wall and a guest's own uploads
// (`mine: true`); WATERMARKED for everyone else (other guests, share links). They are null while the copies are being made
// (`processing: "pending"`: show a "processing" tile; never fall back to anything else) or when no preview could be made
// (`processing: "failed"`: placeholder). Videos: playbackUrl = 1080p clean or 720p watermarked MP4, null until ready.
// Every 402 uses the standard error shape: { "error": { "code": "payment_required", "message": "…" } }.
type MediaItem = { id; kind: "photo"|"video"|"voice"; thumbUrl: string|null; displayUrl: string|null; originalUrl?: null; playbackUrl?: string|null /* videos only */; processing?: "pending"|"ready"|"failed"; mine?: boolean /* guest feed */; width; height; durationS; momentTag; dayId; guestName: string|null; reactionCount: number; reactedByMe?: boolean; favourite?: boolean; visibility?: string; approved?: boolean; createdAt: string };
type Mission = { id; title; sortOrder };
type Message = { id; kind; body; mediaUrl: string|null; durationS; guestName: string|null; createdAt };
type ShareLink = { id; token; url; scope; label; expiresAt };
```
URLs in responses are short-lived signed URLs (1 hour).


---

## Additions (additive unless marked; the event-package changes of Nov 2026 are listed under "Event package")

### Errors
Stable `error.code` values: `unauthorized`, `forbidden`, `not_found`, `invalid_request`, `rate_limited` (429), `code_invalid`, `code_expired`, `email_unavailable`, `email_failed`, `pin_required`, `pin_invalid`, `not_joined`, `guest_blocked`, `upload_closed` (403; gallery ended or uploads closed), `plan_limit` (402; file too big), `storage_not_configured` (503), `storage_error`, `payments_unavailable` (503), `shots_exhausted` (409),
event package: `payment_required` (402; downloads before paying), `test_limit` (402; test-mode upload limit reached), `video_too_long` (402), `video_duration_required` (400; videos must send `durationS`), `not_open` (403; guests before the gallery opens), `event_unavailable` (410; refunded / deleted gallery), `download_closed` (403), `event_refunded` (403), `event_expired` (410), `window_order` / `window_too_long` / `window_past` / `window_incomplete` (400), `window_locked` (409; window can't change once live), `window_required` / `window_past` (409; checkout), `already_paid` (409), `cannot_pay` (409), `not_live` (409; end-now on a gallery that isn't live), `slug_taken` (409), `slug_invalid`, `slug_reserved`, `server_error`.
Removed: `plan_feature`, `already_on_plan`, `partner_inactive`, `org_owner`, and with the subscriptions `plan_required`, `already_subscribed`, `no_subscription`, `billing_error`.
CORS: `/api/v1/*` answers preflight and sends `Access-Control-Allow-Origin: *` (auth is Bearer / X-Guest-Token, never cookies cross-site).

### Uploads
- Upload request file objects may also carry `phash?: string` (64-bit dHash of the thumbnail, 16 lowercase hex chars) and `blurScore?: number` (variance of Laplacian on a ≤320px greyscale copy). The server flags likely duplicates (Hamming ≤ 4 within the event) and blurry photos (score < 20).
- Each presigned target may include `multipart?: { partSize, parts: { partNumber, url }[] }` (R2, originals > 50 MB). PUT each slice `[ (n-1)*partSize, n*partSize )` to its URL **instead of** `url`; then call complete as usual — the server assembles the parts. Ignoring `multipart` and PUTting the whole file to `url` also works.
- `POST …/uploads/complete` returns `{ ok: true, missing: string[] }` — ids whose files never reached storage (retry them).
- `POST /api/v1/occasions/:id/uploads/complete` `{ mediaIds }` → `{ ok: true, missing }` (host uploads).
- After complete, when `OPENAI_API_KEY` is set, photos are checked with OpenAI moderation (`omni-moderation-latest`); flagged items get `approved=false` and the flag `nsfw`. Nothing is ever auto-deleted.
- JPEG originals have GPS removed in the browser before upload (orientation kept). HEIC/video originals may keep location metadata.

### Occasion (host) — extra fields
`vanitySlug: string|null`. `days[]` items also have `uploadOpensAt`, `uploadClosesAt`, `guestUrl` (per-day link `…/g/{slug}?d={dayId}` that preselects and locks the day) and `active` (false = beyond the 5-day limit, hidden from guests). `access: OccasionAccess` (also on OccasionSummary). Removed: `plan`, `organisationId`, `brandingMode`, `branding`.
`guestUrl`/`wallUrl` use the vanity name when set. `wallUrl` carries a `k` key.

### PATCH /api/v1/occasions/:id — extra fields
`days?: { id?, name, date?, uploadOpensAt?, uploadClosesAt? }[]` (1–5; ids kept are updated, new ones created, missing ones removed), `coverMediaId?: string|null`, `vanitySlug?: string|null` (a–z 0–9 and hyphens, 3–40, unique, reserved words blocked).
PATCH, cover changes, missions (POST), share links (POST) and co-hosts (POST) fail while the event is read-only (`event_locked`, `account_suspended`, `event_refunded`, `event_expired`). Hiding/deleting media, guestbook entries and blocking guests always work.

### Cover photo
- `POST /api/v1/occasions/:id/cover` `{ mime: "image/webp"|"image/jpeg"|"image/png", bytes }` → `{ key, upload: PresignedPut }`
- `POST /api/v1/occasions/:id/cover/complete` `{ key }` → `{ occasion }`; `DELETE /api/v1/occasions/:id/cover` → `{ occasion }`

### Media (host)
- `GET …/media` `filter` also accepts `flagged | duplicates | blurry`. MediaItem (host) also has `guestId`, `missionId`, `mime`, `moderationFlags: string[]` (`duplicate`, `blurry`, `nsfw`, `reported`).
- `PATCH …/media` alternatively `{ match: "duplicates"|"blurry"|"flagged", action: "hide"|"approve" }` (bulk on every visible matching item).

### Guests (host)
- `GET /api/v1/occasions/:id/guests` → `{ guests: { id, displayName, uploads, blocked, joinedAt }[] }`
- `POST /api/v1/occasions/:id/guests/:guestId/block` → `{ ok }` (hides their media, that device can't upload/join again; error `guest_blocked`). `DELETE` same path unblocks.

### Other host endpoints
- `GET|POST|DELETE /api/v1/occasions/:id/cohosts` → `{ members: { hostId, email, name, role }[], invites: { id, email }[] }` (POST `{ email }` owner only; DELETE `?hostId=` or `?inviteId=`)
- `DELETE /api/v1/occasions/:id/share-links?linkId=` → `{ links }`; POST also accepts `expiresInDays?`
- `DELETE /api/v1/occasions/:id/messages?messageId=` → `{ messages }`
- `GET /api/v1/occasions/:id/missions` also returns `doneCount` per mission and `leaderboard: { guestId, guestName, done }[]`

### Guest
- `GET /api/v1/g/:slug` — `:slug` may be the random slug or the vanity name. Response also has `guest: { id, displayName, shotsTaken } | null`. PublicOccasion also has `coverUrl`, `hasPin` and `days[].uploadOpen`. Style the guest app from `theme` (`THEMES` colours), `honorees` and `coverUrl`. Removed: `plan`, `brandingMode`, `branding`.
- `uploadOpen` / `uploadsOpen` (same value) and `days[].uploadOpen` are true only while the gallery is live (and inside any per-day / legacy upload window). `galleryState` tells the guest app what to show: `not_open` → "This gallery opens on {opensAt}" (no join form), `live` → join and upload, `ended` → join and look, uploads closed, `unavailable` → refunded or deleted. Times are shown in `timeZone`. `downloadsOpen` follows the event's download access.
- `join`, `feed`, `uploads`, `uploads/complete` and `messages` answer `403 not_open` before the gallery opens and `410 event_unavailable` after a refund or deletion; `GET /g/:slug` always answers (it drives the "opens on …" page).
- `POST …/join` also accepts `shareToken?` (a `view_upload` share-link token skips the PIN).
- `GET …/feed` also accepts `kind=photo|video`, `moment`, `dayId`, `sort=new|top`. Items carry `mine` and `processing`; other people's media are watermarked copies only (see MediaItem). `originalUrl` is always null.
- `GET …/missions` also returns `leaderboard: { guestName, done }[]` and `me: { rank|null, done } | null`.
- `GET …/mine` items are clean copies and include `approved`; `originalUrl` is null (download via `GET …/media/:mediaId/download`).
- `POST /api/v1/g/:slug/messages/upload-url` `{ mime, bytes, kind?, durationS? }` → `{ mediaKey, upload: PresignedPut }` (voice/video guestbook). Then `POST …/messages` `{ kind, mediaKey, durationS? }`.
- `POST /api/v1/g/:slug/report` `{ mediaId, reason? }` → `{ ok }` — sets `approved=false`, adds flag `reported`, emails + pushes the hosts.
- `/g/demo` is a built-in demo (web only, simulated in the browser; the API returns 404 for `demo`).

### Live wall
- `GET /api/v1/wall/:slug?k=<key>&after=<iso>` → `{ items: MediaItem[], stats: { photos, guests } }` (key from `wallUrl`). The host's screen: works in every state (test uploads included) until the event is refunded or deleted (`410 event_unavailable`).

### Event package (replaces the account subscription, Nov 2026)
One price per event (default £69, GBP, VAT included; admin-editable), paid once by the owner. No subscription. Every rule is in `src/lib/access.ts`; `occasion.access` and `occasion.package` mirror it.
- **setup** (`reason: "setup"`, `package.testMode: true`): the host configures everything and prints QR cards. Test mode: hosts and co-hosts can upload up to `package.testUploadLimit` items (default 20; then `402 test_limit`). Guests opening the link get `galleryState: "not_open"`. Downloads `402 payment_required`.
- **paid**, before `opensAt` (`reason: "not_open"`): guests still see "opens on …"; hosts can upload and download; the window can still change.
- **live** (`opensAt ≤ now < closesAt`, `reason: null`): guests join and upload. The window is fixed; the host can end it early.
- **ended** (`closesAt ≤ now`, `reason: "ended"`): guest uploads closed (`upload_closed`), guests can still join and look, hosts can still add their own photos and download. The owner gets one "download everything" email (daily cron, or lazily when the event is opened).
- **expired** (`now ≥ deleteAfter` = `closesAt` + 12 months by default): files deleted by the daily cron, `readOnly`, everything closed. Reminder emails go out 30 and 7 days before.
- **refunded** (full refund in Stripe): `readOnly`, guests can't open it, downloads closed. Never reopened by a late webhook.
- Window rules: `closesAt − opensAt ≤ package.windowDays` (default 7), `closesAt` in the future; editable any time before paying and, once paid, until it opens (`409 window_locked` after). `timeZone` is the IANA zone the times were entered in.
- Video length: `durationS` is required for videos and must be ≤ `PublicOccasion.videoMaxSeconds` (default 60; `402 video_too_long`). The stored size is also capped from the length.
- Fair use: past 50 GB per event (admin-editable) uploads keep working; the event is flagged for admins.
- `POST /api/v1/occasions/:id/checkout` → `{ url }` (owner only) — Stripe Checkout, mode `payment`, card / Apple Pay / Google Pay. After paying Stripe returns to `/dashboard/:id?paid=1`; the webhook marks the event paid. Errors: `409 window_required` / `window_past` (set dates first), `409 already_paid`, `503 payments_unavailable`. Web only; mobile store builds don't sell packages in the app.
- `POST /api/v1/occasions/:id/end` → `{ occasion }` — closes a live gallery now (owner and co-hosts). `409 not_live` otherwise.
- Removed: `POST /api/v1/billing/checkout`, `POST /api/v1/billing/portal`, `GET /me` → `host.subscription`, `trialStarted`.

### Push notifications (Expo)
Tokens from `POST /api/v1/push-tokens` receive: first guest upload of the day ("Guests are uploading!"), new guestbook message (≤3 / 10 min), shots awaiting approval (≤1 / 30 min). Payload `data: { occasionId, kind: "first_upload"|"message"|"pending" }`. Each host gets the text in their own `locale`.

### Universal links
`/.well-known/apple-app-site-association` (appID `$APPLE_TEAM_ID.com.bizimresimler.app`, paths `/g/*`) and `/.well-known/assetlinks.json` (`com.bizimresimler.app`, fingerprints from `ANDROID_SHA256_FINGERPRINTS`) are served on both domains.

### Admin overrides
Set by our team from the web admin dashboard (`/admin`, web only; not part of this API).
- An admin can mark an event as paid without a payment (`package.comped: true`), undo that, and clear the fair-use flag.
- `OccasionAccess.reason` may also be `"suspended"` (the owner's account is suspended: read-only, downloads locked) or `"locked"` (this event's uploads were closed by our team: read-only).
- Error codes: `account_suspended` (403; `POST /auth/verify` and every host endpoint for a suspended account — show "Your account is suspended, please contact support"), `event_locked` (403; host edits and uploads on a locked event).
- `POST /api/v1/g/:slug/report` also records the report (reason + a hash of the IP) for our moderation queue; the response is unchanged.


### Media copies and guest downloads (Nov 2026, consumer launch stage B)
**Copies.** After `uploads/complete` the server makes, from the clean display copy the app uploaded (photos: send a ≈2,000 px WebP `display` and ≈400 px `thumb` as before), a ≈1,200 px **watermarked** guest preview and a watermarked thumb; for videos a clean 1080p MP4, a 720p watermarked MP4 and posters (the app's own poster upload is replaced). This takes seconds for photos and up to a minute or two for videos; until then items have `processing: "pending"`. Re-read the list to pick up finished items (the web app re-polls the first page every 8 s while anything is pending). Hosts and the live wall get clean copies; guests get clean copies of their own uploads and watermarked copies of everyone else's.

**PublicOccasion.guestDownload** (additive): `{ pricePence, available, payments, purchased, expiresAt }` — `available`: guests can buy "download everything" now (Stripe configured, event paid and live or ended); `payments`: Stripe is configured; `purchased`: this device has an active purchase (30 days, `expiresAt`).

Guest endpoints (guest device token required):
- `GET /api/v1/g/:slug/media/:mediaId/download` → `{ url }` — signed link (≤1 h) to one original. Own uploads: always free. Anyone else's: needs an active purchase on this device, else `402 purchase_required`.
- `GET /api/v1/g/:slug/purchase` → `{ guestDownload, summary: { photos, videos, bytes, days: { id|null, name|null, count, bytes }[], split } | null }` (summary once bought; `split` = offer one ZIP per day, > ~2 GB).
- `POST /api/v1/g/:slug/purchase` → `{ url }` — Stripe Checkout (mode payment, GBP, `guestDownloadPence`, card / Apple Pay / Google Pay; Checkout collects the email). Success returns to `/g/:slug/download?session_id=…`, cancel to `/g/:slug`. Errors: `409 cannot_pay` (event not paid, not open, expired, refunded), `409 already_paid`, `503 payments_unavailable`, `429 rate_limited`. **Web only:** mobile store builds must not sell this in the app (App Store 3.1.1 / Play billing); open the web page instead.
- `GET /api/v1/g/:slug/purchase/files?dayId=<uuid>|none` → `{ files: { id, name, url, mime, kind, bytes, dayId, createdAt }[], totalBytes }` — ZIP manifest with fresh signed links (≤1 h) minted per request. `402 purchase_required` without an active purchase.

Emailed link (no guest token; the token in the URL is the credential, valid 30 days from payment, stored only as a hash):
- `GET /api/v1/d/:token` → `{ title, expiresAt, summary }`; `GET /api/v1/d/:token/files?dayId=` → manifest as above; `GET /api/v1/d/:token/files/:mediaId` → `{ url }`. `404 not_found` when the token is unknown, refunded, past 30 days, or the event's files are gone. Rate-limited per IP and per token (`429`).
- Web pages: `/g/:slug/download` (after Checkout, on the paying device) and `/d/:token` (from the email).

A purchase covers every visible, approved, revealed photo and video of the event at download time (also ones added after paying). A full refund in Stripe ends access and kills the link.

**Internal (not for clients):** `POST /api/internal/media/process` (HMAC-signed ids, server-to-server) and `GET /api/cron/media` (Vercel Cron) make the copies.
New error codes: `purchase_required` (402), `already_paid` / `cannot_pay` (409) on the guest purchase.
