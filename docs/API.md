# Mobile / JSON API contract (`/api/v1`)

Base URL: `https://ourpixs.com` (or `https://bizimresimler.com`; same backend). All bodies JSON. Errors: `{ "error": { "code": string, "message": string } }` with a 4xx/5xx status.
Auth: `Authorization: Bearer <jwt>` (same JWT as the web `op_session` cookie, 30-day expiry).

## Auth
- `POST /api/v1/auth/request-code` `{ email, locale?: "en"|"tr", brand?: "ourpixs"|"bizimresimler" }` → `{ ok: true, previewCode?: string }` (previewCode only when PREVIEW_SHOW_CODE=1 and email not configured)
- `POST /api/v1/auth/verify` `{ email, code }` → `{ token, host: Host }` (also sets the `op_session` cookie for web). If env `REVIEW_EMAIL` and `REVIEW_CODE` are both set, that email signs in with that code (app-store review).
- `GET /api/v1/me` → `{ host: Host }`
- `PATCH /api/v1/me` `{ name?, locale? }` → `{ host }`
- `DELETE /api/v1/me` → `{ ok: true }` — deletes the account, events it owns (all files), memberships, push tokens. `409 org_owner` while the host owns a partner account that isn't cancelled.
- `POST /api/v1/auth/logout` → `{ ok: true }` (web: clears the cookie)
- `POST /api/v1/push-tokens` `{ token, platform: "ios"|"android" }` → `{ ok: true }`

## Occasions (host)
- `GET /api/v1/occasions` → `{ occasions: OccasionSummary[] }`
- `POST /api/v1/occasions` `{ type, title, honorees: string[], startsOn?: "YYYY-MM-DD", venueName?, city?, theme?, days?: {name, date?}[] }` → `{ occasion: Occasion }`
- `GET /api/v1/occasions/:id` → `{ occasion: Occasion, stats: Stats }`
- `PATCH /api/v1/occasions/:id` `{ title?, honorees?, startsOn?, venueName?, city?, theme?, approvalMode?, revealMode?, revealAt?, uploadOpensAt?, uploadClosesAt?, pin?: string|null, disposableShots?: number|null }` → `{ occasion }`
- `DELETE /api/v1/occasions/:id` → `{ ok: true }`
- `GET /api/v1/occasions/:id/media?cursor=&dayId=&moment=&guestId=&kind=photo|video&filter=favourites|hidden|pending` → `{ items: MediaItem[], nextCursor: string|null }`
- `PATCH /api/v1/occasions/:id/media` `{ ids: string[], action: "hide"|"show"|"delete"|"favourite"|"unfavourite"|"approve" }` → `{ ok: true }`
- `POST /api/v1/occasions/:id/uploads` (host uploads) — same shape as the guest uploads endpoint below
- `GET /api/v1/occasions/:id/messages` → `{ messages: Message[] }`
- `GET|POST|DELETE /api/v1/occasions/:id/missions` → `{ missions: Mission[] }` (POST `{ title }`, DELETE `?missionId=`)
- `GET|POST /api/v1/occasions/:id/share-links` → `{ links: ShareLink[] }` (POST `{ label?, scope }`)
- `POST /api/v1/occasions/:id/checkout` `{ plan: "tek"|"buyuk" }` → `{ url }` (Stripe Checkout URL; open in browser)

## Guest (web guest app + mobile "join by QR")
Guest auth is a cookie on web; on mobile pass header `X-Guest-Token: <token>` returned by join.
- `GET /api/v1/g/:slug` → `{ occasion: PublicOccasion }` (requires PIN cookie/header `X-Occasion-Pin` if set)
- `POST /api/v1/g/:slug/join` `{ name, consent: true, pin? }` → `{ guestToken, guest: { id, displayName } }`
- `GET /api/v1/g/:slug/feed?after=<iso>&cursor=` → `{ items: MediaItem[], nextCursor }`
- `POST /api/v1/g/:slug/uploads` `{ files: { clientId, name, mime, bytes, kind, width?, height?, durationS?, dayId?, momentTag?, missionId?, fromDisposable?, hasDisplay: boolean, hasThumb: boolean }[] }` → `{ uploads: { clientId, mediaId, original: { url, method: "PUT", headers }, display?: {...}, thumb?: {...} }[] }`
- `POST /api/v1/g/:slug/uploads/complete` `{ mediaIds: string[] }` → `{ ok: true }`
- `POST /api/v1/g/:slug/reactions` `{ mediaId }` → `{ reacted: boolean, count: number }` (toggles)
- `GET /api/v1/g/:slug/missions` → `{ missions: (Mission & { done: boolean, doneCount: number })[] }`
- `POST /api/v1/g/:slug/messages` `{ kind: "text"|"voice"|"video", body?, mediaKey? }` → `{ message }`
- `GET /api/v1/g/:slug/mine` → `{ items: MediaItem[] }`; `DELETE /api/v1/g/:slug/mine?mediaId=`

## Types
```ts
type Host = { id: string; email: string; name: string|null; locale: "en"|"tr"; brand: "ourpixs"|"bizimresimler" };
type OccasionSummary = { id; slug; type; title; startsOn: string|null; plan: "free"|"tek"|"buyuk"; coverUrl: string|null; mediaCount: number; guestCount: number; role: "owner"|"cohost" };
type Occasion = OccasionSummary & { honorees: string[]; venueName; city; theme; brand; approvalMode: boolean; revealMode: "live"|"next_morning"; revealAt; uploadOpensAt; uploadClosesAt; hasPin: boolean; disposableShots: number|null; storageExpiresAt; days: { id; name; date; sortOrder }[]; guestUrl: string; wallUrl: string };
type Stats = { guests: number; photos: number; videos: number; messages: number; bytes: number; pendingApproval: number };
type PublicOccasion = { slug; type; title; honorees; startsOn; venueName; city; theme; brand; plan; days; moments: string[]; liveWall: boolean; missionsEnabled: boolean; disposableShots: number|null; voiceGuestbook: boolean; uploadOpen: boolean; revealMode; revealAt };
type MediaItem = { id; kind: "photo"|"video"|"voice"; thumbUrl: string|null; displayUrl: string|null; originalUrl?: string; width; height; durationS; momentTag; dayId; guestName: string|null; reactionCount: number; reactedByMe?: boolean; favourite?: boolean; visibility?: string; approved?: boolean; createdAt: string };
type Mission = { id; title; sortOrder };
type Message = { id; kind; body; mediaUrl: string|null; durationS; guestName: string|null; createdAt };
type ShareLink = { id; token; url; scope; label; expiresAt };
```
URLs in responses are short-lived signed URLs (1 hour).


---

## Additions (all additive — nothing above changed shape)

### Errors
Stable `error.code` values: `unauthorized`, `forbidden`, `not_found`, `invalid_request`, `rate_limited` (429), `code_invalid`, `code_expired`, `email_unavailable`, `email_failed`, `pin_required`, `pin_invalid`, `not_joined`, `guest_blocked`, `upload_closed`, `plan_limit` (402), `plan_feature` (402), `storage_not_configured` (503), `storage_error`, `payments_unavailable` (503), `already_on_plan` (409), `shots_exhausted` (409), `slug_taken` (409), `slug_invalid`, `slug_reserved`, `partner_inactive`, `no_subscription`, `org_owner` (409), `server_error`.
CORS: `/api/v1/*` answers preflight and sends `Access-Control-Allow-Origin: *` (auth is Bearer / X-Guest-Token, never cookies cross-site).

### Uploads
- Upload request file objects may also carry `phash?: string` (64-bit dHash of the thumbnail, 16 lowercase hex chars) and `blurScore?: number` (variance of Laplacian on a ≤320px greyscale copy). The server flags likely duplicates (Hamming ≤ 4 within the event) and blurry photos (score < 20).
- Each presigned target may include `multipart?: { partSize, parts: { partNumber, url }[] }` (R2, originals > 50 MB). PUT each slice `[ (n-1)*partSize, n*partSize )` to its URL **instead of** `url`; then call complete as usual — the server assembles the parts. Ignoring `multipart` and PUTting the whole file to `url` also works.
- `POST …/uploads/complete` returns `{ ok: true, missing: string[] }` — ids whose files never reached storage (retry them).
- `POST /api/v1/occasions/:id/uploads/complete` `{ mediaIds }` → `{ ok: true, missing }` (host uploads).
- After complete, when `OPENAI_API_KEY` is set, photos are checked with OpenAI moderation (`omni-moderation-latest`); flagged items get `approved=false` and the flag `nsfw`. Nothing is ever auto-deleted.
- JPEG originals have GPS removed in the browser before upload (orientation kept). HEIC/video originals may keep location metadata.

### Occasion (host) — extra fields
`vanitySlug: string|null`, `organisationId: string|null`, `brandingMode: "platform"|"venue"|"couple"|"both"`. `days[]` items also have `uploadOpensAt`, `uploadClosesAt`, `guestUrl` (per-day link `…/g/{slug}?d={dayId}` that preselects and locks the day) and `active` (false = beyond the plan's maxDays, hidden from guests until upgrade).
`guestUrl`/`wallUrl` use the vanity name when set. `wallUrl` carries a `k` key.

### PATCH /api/v1/occasions/:id — extra fields
`days?: { id?, name, date?, uploadOpensAt?, uploadClosesAt? }[]` (1–5; ids kept are updated, new ones created, missing ones removed), `coverMediaId?: string|null`, `vanitySlug?: string|null` (a–z 0–9 and hyphens, 3–40, unique, reserved words blocked), `brandingMode?` (partner events only).
POST /api/v1/occasions also accepts `brandingMode?`.

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
- `GET /api/v1/g/:slug` — `:slug` may be the random slug or the vanity name. Response also has `guest: { id, displayName, shotsTaken } | null`. PublicOccasion also has `coverUrl`, `hasPin`, `brandingMode`, `branding: { mode, venueName, logoUrl, poweredBy, colours: { bg, fg, accent }, venueLogoUrl, primaryColor, accentColor, monogram, coupleLogoUrl }`, and `days[].uploadOpen`.
- `POST …/join` also accepts `shareToken?` (a `view_upload` share-link token skips the PIN).
- `GET …/feed` also accepts `kind=photo|video`, `moment`, `dayId`, `sort=new|top`. Videos include `originalUrl` (needed for playback).
- `GET …/missions` also returns `leaderboard: { guestName, done }[]` and `me: { rank|null, done } | null`.
- `GET …/mine` items include `originalUrl` and `approved`.
- `POST /api/v1/g/:slug/messages/upload-url` `{ mime, bytes, kind?, durationS? }` → `{ mediaKey, upload: PresignedPut }` (voice/video guestbook; Big Day). Then `POST …/messages` `{ kind, mediaKey, durationS? }`.
- `POST /api/v1/g/:slug/report` `{ mediaId, reason? }` → `{ ok }` — sets `approved=false`, adds flag `reported`, emails + pushes the hosts.
- `/g/demo` is a built-in demo (web only, simulated in the browser; the API returns 404 for `demo`).

### Live wall
- `GET /api/v1/wall/:slug?k=<key>&after=<iso>` → `{ items: MediaItem[], stats: { photos, guests } }` (key from `wallUrl`; 402 `plan_feature` without a live-wall plan)

### Partner plan (organisations)
`Organisation = { id, name, slug, logoUrl, primaryColour, accentColour, primaryColor, accentColor, supportEmail, status: "trialing"|"active"|"past_due"|"cancelled", active: boolean, currentPeriodEnd, hidePoweredBy, role: "owner"|"staff" }`
(`role` is `owner` or `staff` — mobile's provisional `admin|member` should map `staff` → member. `status: "cancelled"` also means "never subscribed".)
- `GET /api/v1/organisations` → `{ organisations: Organisation[] }`; `POST` `{ name }` → `{ organisation }` (creator = owner)
- `GET /api/v1/organisations/:orgId` → `{ organisation }`; `PATCH` (owner) `{ name?, primaryColour?, accentColour?, supportEmail?, hidePoweredBy? }` (#RRGGBB)
- `POST /api/v1/organisations/:orgId/logo` `{ mime, bytes }` → `{ key, upload }`; `POST …/logo/complete` `{ key }` → `{ organisation }`
- `POST /api/v1/organisations/:orgId/checkout` → `{ url }` (Stripe subscription Checkout, `STRIPE_PRICE_PARTNER`); `POST …/portal` → `{ url }` (Stripe billing portal)
- `GET /api/v1/organisations/:orgId/occasions` → `{ occasions: OccasionSummary[] }`; `POST` = POST /occasions body + `brandingMode?` + `coupleEmail?` → `{ occasion }` (plan `buyuk`; the couple is invited as co-host). 402 `partner_inactive` without an active subscription.
- `GET|POST|DELETE /api/v1/organisations/:orgId/members` → `{ members: { hostId, email, name, role }[], invites: { id, email }[] }` (POST `{ email }`, DELETE `?hostId=`/`?inviteId=`; owner only)
Organisation staff can open every event of the organisation (as co-host). Events stay writable while the subscription is active/trialing and for 7 days after it goes past_due; then uploads/edits return `partner_inactive`.

### Push notifications (Expo)
Tokens from `POST /api/v1/push-tokens` receive: first guest upload of the day ("Guests are uploading!"), new guestbook message (≤3 / 10 min), shots awaiting approval (≤1 / 30 min). Payload `data: { occasionId, kind: "first_upload"|"message"|"pending" }`.

### Universal links
`/.well-known/apple-app-site-association` (appID `$APPLE_TEAM_ID.com.ourpixs.app`, paths `/g/*`) and `/.well-known/assetlinks.json` (`com.ourpixs.app`, fingerprints from `ANDROID_SHA256_FINGERPRINTS`) are served on both domains.
