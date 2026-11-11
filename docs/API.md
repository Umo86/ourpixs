# Mobile / JSON API contract (`/api/v1`)

Base URL: `https://ourpixs.com` (or `https://bizimresimler.com`; same backend). All bodies JSON. Errors: `{ "error": { "code": string, "message": string } }` with a 4xx/5xx status.
Auth: `Authorization: Bearer <jwt>` (same JWT as the web `op_session` cookie, 30-day expiry).

## Auth
- `POST /api/v1/auth/request-code` `{ email, locale?: "en"|"tr", brand?: "ourpixs"|"bizimresimler" }` → `{ ok: true, previewCode?: string }` (previewCode only when PREVIEW_SHOW_CODE=1 and email not configured)
- `POST /api/v1/auth/verify` `{ email, code }` → `{ token, host: Host }` (also sets the `op_session` cookie for web). If env `REVIEW_EMAIL` and `REVIEW_CODE` are both set, that email signs in with that code (app-store review).
- `GET /api/v1/me` → `{ host: Host & { subscription: Subscription } }` (see "Account subscription" below)
- `PATCH /api/v1/me` `{ name?, locale? }` → `{ host }` (same shape as GET)
- `DELETE /api/v1/me` → `{ ok: true }` — cancels the Stripe subscription immediately (if any; no refund), then deletes the account, events it owns (all files), memberships, push tokens. `502 billing_error` if Stripe can't be reached (nothing is deleted then).
- `POST /api/v1/auth/logout` → `{ ok: true }` (web: clears the cookie)
- `POST /api/v1/push-tokens` `{ token, platform: "ios"|"android" }` → `{ ok: true }`

## Occasions (host)
- `GET /api/v1/occasions` → `{ occasions: OccasionSummary[] }`
- `POST /api/v1/occasions` `{ type, title, honorees: string[], startsOn?: "YYYY-MM-DD", venueName?, city?, theme?, days?: {name, date?}[] }` → `{ occasion: Occasion, trialStarted: boolean }` — the host's first event starts the 3-day free trial (`trialStarted: true`). `402 plan_required` when `subscription.canCreateEvents` is false.
- `GET /api/v1/occasions/:id` → `{ occasion: Occasion, stats: Stats }`
- `PATCH /api/v1/occasions/:id` `{ title?, honorees?, startsOn?, venueName?, city?, theme?, approvalMode?, revealMode?, revealAt?, uploadOpensAt?, uploadClosesAt?, pin?: string|null, disposableShots?: number|null }` → `{ occasion }`
- `DELETE /api/v1/occasions/:id` → `{ ok: true }`
- `GET /api/v1/occasions/:id/media?cursor=&dayId=&moment=&guestId=&kind=photo|video&filter=favourites|hidden|pending` → `{ items: MediaItem[], nextCursor: string|null }`
- `PATCH /api/v1/occasions/:id/media` `{ ids: string[], action: "hide"|"show"|"delete"|"favourite"|"unfavourite"|"approve" }` → `{ ok: true }`
- `POST /api/v1/occasions/:id/uploads` (host uploads) — same shape as the guest uploads endpoint below
- `GET /api/v1/occasions/:id/messages` → `{ messages: Message[] }`
- `GET|POST|DELETE /api/v1/occasions/:id/missions` → `{ missions: Mission[] }` (POST `{ title }`, DELETE `?missionId=`)
- `GET|POST /api/v1/occasions/:id/share-links` → `{ links: ShareLink[] }` (POST `{ label?, scope }`)
- `GET /api/v1/occasions/:id/download?dayId=` → `{ files: { id, name, url, mime, kind, bytes, dayId, guestName, createdAt }[] }` — ZIP manifest: every visible original (oldest first) with signed download URLs (1 hour). `402 plan_required` while `access.canDownload` is false.
- `GET /api/v1/occasions/:id/media/:mediaId/download` → `{ url }` — signed download URL for one original. `402 plan_required` while `access.canDownload` is false.

## Guest (web guest app + mobile "join by QR")
Guest auth is a cookie on web; on mobile pass header `X-Guest-Token: <token>` returned by join.
- `GET /api/v1/g/:slug` → `{ occasion: PublicOccasion, guest, uploadsOpen: boolean }` (requires PIN cookie/header `X-Occasion-Pin` if set)
- `POST /api/v1/g/:slug/join` `{ name, consent: true, pin? }` → `{ guestToken, guest: { id, displayName }, uploadsOpen: boolean }` (joining works while the event is read-only; guests can still look)
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
type Subscription = { status: "none"|"trialing"|"active"|"past_due"|"cancelled"|"expired"; interval: "month"|"year"|null; trialEndsAt: string|null; currentPeriodEnd: string|null; cancelAtPeriodEnd: boolean; deleteAfter: string|null; canCreateEvents: boolean; canDownload: boolean; readOnly: boolean; showUpgradePrompt: boolean; daysLeft: number|null };
type OccasionAccess = { canUpload: boolean; canDownload: boolean; readOnly: boolean; reason: "trial"|"trial_ended"|"cancelled"|"past_due"|null };
type OccasionSummary = { id; slug; type; title; startsOn: string|null; coverUrl: string|null; mediaCount: number; guestCount: number; role: "owner"|"cohost"; access: OccasionAccess };
type Occasion = OccasionSummary & { honorees: string[]; venueName; city; theme; brand; approvalMode: boolean; revealMode: "live"|"next_morning"; revealAt; uploadOpensAt; uploadClosesAt; hasPin: boolean; disposableShots: number|null; storageExpiresAt /* = owner's deleteAfter, null while active/trialing */; days: { id; name; date; sortOrder }[]; guestUrl: string; wallUrl: string };
type Stats = { guests: number; photos: number; videos: number; messages: number; bytes: number; pendingApproval: number };
type PublicOccasion = { slug; type; title; honorees; startsOn; venueName; city; theme; brand; days; moments: string[]; liveWall: boolean; missionsEnabled: boolean; disposableShots: number|null; voiceGuestbook: boolean; uploadOpen: boolean; uploadsOpen: boolean; downloadsOpen: boolean; revealMode; revealAt };
// originalUrl is null when downloads are locked for the event (access.canDownload / downloadsOpen false):
// on host and guest media, share links and the live wall. thumbUrl/displayUrl are always there.
// This includes videos: while locked, videos have no playable URL (show the poster from displayUrl).
// Every 402 uses the standard error shape: { "error": { "code": "plan_required", "message": "…" } }.
type MediaItem = { id; kind: "photo"|"video"|"voice"; thumbUrl: string|null; displayUrl: string|null; originalUrl?: string|null; playbackUrl?: string|null /* videos only; always present so videos play while downloads are locked */; width; height; durationS; momentTag; dayId; guestName: string|null; reactionCount: number; reactedByMe?: boolean; favourite?: boolean; visibility?: string; approved?: boolean; createdAt: string };
type Mission = { id; title; sortOrder };
type Message = { id; kind; body; mediaUrl: string|null; durationS; guestName: string|null; createdAt };
type ShareLink = { id; token; url; scope; label; expiresAt };
```
URLs in responses are short-lived signed URLs (1 hour).


---

## Additions (all additive — nothing above changed shape)

### Errors
Stable `error.code` values: `unauthorized`, `forbidden`, `not_found`, `invalid_request`, `rate_limited` (429), `code_invalid`, `code_expired`, `email_unavailable`, `email_failed`, `pin_required`, `pin_invalid`, `not_joined`, `guest_blocked`, `upload_closed` (403; also when the owner's account is read-only), `plan_limit` (402; file/limit too big), `plan_required` (402; downloads locked, can't create events, or editing a read-only event), `storage_not_configured` (503), `storage_error`, `payments_unavailable` (503), `already_subscribed` (409), `no_subscription` (409), `billing_error` (502), `shots_exhausted` (409), `slug_taken` (409), `slug_invalid`, `slug_reserved`, `server_error`.
Removed: `plan_feature`, `already_on_plan`, `partner_inactive`, `org_owner` (every feature is on every account now).
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
PATCH, cover changes, missions (POST), share links (POST) and co-hosts (POST) return `402 plan_required` while the event is read-only. Hiding/deleting media, guestbook entries and blocking guests always work.

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
- `uploadOpen` / `uploadsOpen` (same value) and `days[].uploadOpen` are false when the event is outside its upload window **or the owner's account is read-only** (trial ended unpaid, subscription ended). Show a friendly "uploads closed" state; viewing keeps working. `downloadsOpen` is false while the owner's downloads are locked (trial / unpaid).
- `POST …/join` also accepts `shareToken?` (a `view_upload` share-link token skips the PIN).
- `GET …/feed` also accepts `kind=photo|video`, `moment`, `dayId`, `sort=new|top`. Videos include `playbackUrl` (always, for playback); `originalUrl` follows the download lock.
- `GET …/missions` also returns `leaderboard: { guestName, done }[]` and `me: { rank|null, done } | null`.
- `GET …/mine` items include `originalUrl` and `approved`.
- `POST /api/v1/g/:slug/messages/upload-url` `{ mime, bytes, kind?, durationS? }` → `{ mediaKey, upload: PresignedPut }` (voice/video guestbook). Then `POST …/messages` `{ kind, mediaKey, durationS? }`.
- `POST /api/v1/g/:slug/report` `{ mediaId, reason? }` → `{ ok }` — sets `approved=false`, adds flag `reported`, emails + pushes the hosts.
- `/g/demo` is a built-in demo (web only, simulated in the browser; the API returns 404 for `demo`).

### Live wall
- `GET /api/v1/wall/:slug?k=<key>&after=<iso>` → `{ items: MediaItem[], stats: { photos, guests } }` (key from `wallUrl`). Works on every account, including the trial and while read-only.

### Account subscription (billing)
One subscription per host account: Monthly £9.99 or Yearly £69.99 (GBP, VAT included), every feature, unlimited events. An event's access always follows its **owner's** subscription (co-hosts see the owner's state in `occasion.access`).
- Free trial: 3 days, no card, starts when the host creates their first event. Everything works except downloads (`canDownload: false`, `originalUrl: null`, download endpoints → `402 plan_required`). `showUpgradePrompt` turns true 24 h into the trial.
- `expired` (trial ended unpaid): `readOnly: true`, uploads closed, downloads locked; files kept until `deleteAfter` (trial end + 30 days), then deleted.
- `cancelled` (paid period over, or `past_due` for more than 7 days): `readOnly: true`, uploads closed, `canDownload: true` until `deleteAfter` (period end + 90 days), then deleted.
- `past_due`: everything keeps working for 7 days from the first failed payment (`daysLeft`), `showUpgradePrompt: true` (send the host to the billing portal).
- `active` with `cancelAtPeriodEnd: true`: works normally until `currentPeriodEnd`.
- Subscribing (or paying) before `deleteAfter` restores everything immediately.
- `POST /api/v1/billing/checkout` `{ interval: "month"|"year" }` → `{ url }` — Stripe Checkout (subscription). `409 already_subscribed` when active/past_due (use the portal), `503 payments_unavailable` when payments aren't configured. Web only; mobile store builds don't call this.
- `POST /api/v1/billing/portal` → `{ url }` — Stripe Customer Portal (card, switch monthly/yearly, cancel at period end, invoices). `409 no_subscription` before the first subscription.

### Push notifications (Expo)
Tokens from `POST /api/v1/push-tokens` receive: first guest upload of the day ("Guests are uploading!"), new guestbook message (≤3 / 10 min), shots awaiting approval (≤1 / 30 min). Payload `data: { occasionId, kind: "first_upload"|"message"|"pending" }`.

### Universal links
`/.well-known/apple-app-site-association` (appID `$APPLE_TEAM_ID.com.ourpixs.app`, paths `/g/*`) and `/.well-known/assetlinks.json` (`com.ourpixs.app`, fingerprints from `ANDROID_SHA256_FINGERPRINTS`) are served on both domains.
